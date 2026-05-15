import * as React from "react";
import { observer } from "mobx-react-lite";
import classNames from "classnames";
import {
  FolderOpen,
  Library,
  Redo2,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { StoreProvider, useStore } from "@/external/stores/useStore";
import dbot from "@/external/bot-skeleton/scratch/dbot";
import { useAuth } from "@/hooks/use-auth";
import {
  deleteSavedBotPreset,
  initialBotBuilderSettings,
  persistSavedBotPreset,
  readSavedBotPresets,
  type SavedBotPreset,
} from "@/lib/bot-builder-state";
import { ToolboxItems } from "./toolbox-items";
import {
  extractSettingsFromWorkspace,
  loadWorkspaceXmlIntoBlockly,
  persistWorkspaceSnapshot,
  readSavedWorkspaceXml,
} from "./workspace-persistence";
import {
  loadWorkspaceFromFile,
  resetWorkspaceToDefault,
  saveWorkspaceToFile,
} from "./workspace-io";
import { BlocksMenuSidebar, closeBlocklyFlyout } from "./blocks-menu-sidebar";
import { hasPresetXml, loadPresetXml } from "./preset-xml-loader";
import "./bot-builder.css";

const PERSIST_DEBOUNCE_MS = 500;
const SIDEBAR_PREF_KEY = "arktrader:bot-builder:sidebar-collapsed";

const generatePresetId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `saved-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
};

const formatSavedAt = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
};

const BotBuilderInner = observer(({ presetId }: { presetId: string | null }) => {
  const store = useStore();
  const { app, dashboard, toolbar, flyout, blockly_store, save_modal, load_modal, quick_strategy } = store;
  const { is_loading } = blockly_store;
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [saveName, setSaveName] = React.useState("My bot strategy");
  const [saveToLibrary, setSaveToLibrary] = React.useState(true);
  const [downloadOnSave, setDownloadOnSave] = React.useState(false);
  const [loadOpen, setLoadOpen] = React.useState(false);
  const [savedPresets, setSavedPresets] = React.useState<SavedBotPreset[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = window.localStorage.getItem(SIDEBAR_PREF_KEY);
      if (stored === null) return window.matchMedia("(max-width: 640px)").matches;
      return stored === "1";
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_PREF_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      /* noop */
    }
    const id = window.requestAnimationFrame(() => {
      try {
        const B = (window as any).Blockly;
        const ws = B?.derivWorkspace;
        if (ws && B?.svgResize) B.svgResize(ws);
        window.dispatchEvent(new Event("resize"));
      } catch {
        /* noop */
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [sidebarCollapsed]);

  React.useEffect(() => {
    app.onMount();
    return () => app.onUnmount();
  }, [app]);

  const refreshSavedPresets = React.useCallback(() => {
    setSavedPresets(readSavedBotPresets(userId));
  }, [userId]);

  React.useEffect(() => {
    refreshSavedPresets();
  }, [refreshSavedPresets, loadOpen]);

  // Two-effect split: a *mount* effect does the heavy Blockly init once per
  // component instance, then a *load* effect re-runs whenever presetId changes
  // and only swaps the XML in the existing workspace. This avoids
  // re-injecting Blockly into the same DOM node (which silently fails) when
  // the user navigates between presets without leaving the route.
  //
  // userId is read via a ref so a late auth resolution (anonymous → logged in)
  // doesn't re-fire the mount effect and reset the workspace back to main.xml.
  const initialisedRef = React.useRef(false);
  const userIdRef = React.useRef<string | null>(userId);
  const presetIdRef = React.useRef<string | null>(presetId);
  React.useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);
  React.useEffect(() => {
    presetIdRef.current = presetId;
  }, [presetId]);

  React.useEffect(() => {
    let cancelled = false;
    let resize_observer: ResizeObserver | null = null;
    let persist_timer: number | null = null;
    let persist_listener: ((event: unknown) => void) | null = null;

    const init = async () => {
      const wrapper = wrapperRef.current;
      const container = containerRef.current;
      if (!wrapper || !container) return;

      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      if (cancelled) return;

      try {
        blockly_store.setLoading(true);
        let toolbox_xml: string;
        try {
          toolbox_xml = ToolboxItems();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("Failed to build toolbox XML", err);
          toolbox_xml =
            '<xml id="toolbox"><category name="Logic" id="logic"><block type="controls_if"/><block type="logic_compare"/><block type="logic_operation"/></category><category name="Math" id="math"><block type="math_number"/><block type="math_arithmetic"/></category></xml>';
        }
        const dbot_store = {
          is_mobile: false,
          is_dark_mode_on: document.documentElement.classList.contains("dark"),
          client: {
            loginid: null,
            currency: "USD",
            landing_company_shortcode: "svg",
            is_logged_in: false,
            getToken: () => "",
          },
          dashboard,
          toolbar,
          flyout,
          save_modal,
          load_modal,
          toolbox: null,
          toolbox_xml,
          setLoading: blockly_store.setLoading,
          handleFileChange: () => {},
          toggleStrategyModal: () => {},
        };
        await dbot.initWorkspace("/", dbot_store, {}, false, dbot_store.is_dark_mode_on);
        if (cancelled) return;
        initialisedRef.current = true;

        const workspace: any = (window as any).Blockly?.derivWorkspace;
        if (workspace) {
          // First-mount choice: a deploy preset wins; otherwise restore the
          // user's last saved workspace XML — reading both user-specific AND
          // guest keys so a bot saved while logged out is still restored once
          // the user signs in.
          const currentPreset = presetIdRef.current;
          const currentUser = userIdRef.current;
          let restoredXmlSuccessfully = false;
          if (currentPreset && hasPresetXml(currentPreset)) {
            const preset_xml = await loadPresetXml(currentPreset);
            if (preset_xml && !cancelled) {
              restoredXmlSuccessfully = loadWorkspaceXmlIntoBlockly(
                workspace,
                preset_xml,
              );
            }
          } else {
            const saved_xml =
              readSavedWorkspaceXml(currentUser) ?? readSavedWorkspaceXml(null);
            if (saved_xml) {
              restoredXmlSuccessfully = loadWorkspaceXmlIntoBlockly(
                workspace,
                saved_xml,
              );
            }
          }

          const schedulePersist = () => {
            if (persist_timer !== null) window.clearTimeout(persist_timer);
            persist_timer = window.setTimeout(() => {
              persist_timer = null;
              persistWorkspaceSnapshot(userIdRef.current, workspace);
            }, PERSIST_DEBOUNCE_MS);
          };
          persist_listener = (event: any) => {
            if (!event || event.type === "selected" || event.type === "ui") return;
            if (event.isUiEvent) return;
            schedulePersist();
          };
          workspace.addChangeListener?.(persist_listener);

          // CRITICAL: only persist after the load if something *was* actually
          // restored. If the saved XML failed to parse (e.g. block type no
          // longer registered), we'd otherwise overwrite the user's saved
          // workspace with the default main.xml that dbot.initWorkspace put
          // in place, losing their bot permanently. Skipping the persist here
          // leaves the on-disk XML intact so the next refresh can retry it.
          if (restoredXmlSuccessfully) {
            persistWorkspaceSnapshot(userIdRef.current, workspace);
          }
        }

        blockly_store.setLoading(false);
        blockly_store.onMount();

        const fireResize = () => {
          try {
            window.dispatchEvent(new Event("resize"));
            const ws = (window as any).Blockly?.derivWorkspace;
            if (ws && (window as any).Blockly?.svgResize) {
              (window as any).Blockly.svgResize(ws);
            }
          } catch {
            /* noop */
          }
        };
        fireResize();
        resize_observer = new ResizeObserver(fireResize);
        resize_observer.observe(wrapper);
      } catch (err) {
        if (cancelled) return;
        const blocklyRef: any = (window as any).Blockly;
        const blockKeys = blocklyRef?.Blocks ? Object.keys(blocklyRef.Blocks) : [];
        // eslint-disable-next-line no-console
        console.error("BotBuilder init failed:", err, {
          hasBlockly: !!blocklyRef,
          blockCount: blockKeys.length,
          hasTradeDefinition: blockKeys.includes("trade_definition"),
          sampleKeys: blockKeys.slice(0, 10),
        });
        setError(err instanceof Error ? err.message : String(err));
        blockly_store.setLoading(false);
      }
    };

    void init();

    return () => {
      cancelled = true;
      resize_observer?.disconnect();
      if (persist_timer !== null) window.clearTimeout(persist_timer);
      const ws: any = (window as any).Blockly?.derivWorkspace;
      if (persist_listener && ws?.removeChangeListener) {
        try {
          ws.removeChangeListener(persist_listener);
        } catch {
          /* noop */
        }
        try {
          persistWorkspaceSnapshot(userIdRef.current, ws);
        } catch {
          /* noop */
        }
      }
      if (initialisedRef.current) {
        blockly_store.onUnmount();
        try {
          dbot.terminateBot?.();
        } catch {
          /* noop */
        }
        initialisedRef.current = false;
      }
    };
    // Mount-only: run init exactly once per route mount. Auth resolution
    // (userId null → uuid) and preset URL changes are handled by their own
    // effects so we never re-inject Blockly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the user signs in AFTER the bot-builder has already mounted, copy
  // anything they had saved while anonymous into their user-specific key so
  // future refreshes restore correctly.
  React.useEffect(() => {
    if (!initialisedRef.current) return;
    if (!userId) return;
    const guest_xml = readSavedWorkspaceXml(null);
    const user_xml = readSavedWorkspaceXml(userId);
    if (guest_xml && !user_xml) {
      const ws = (window as any).Blockly?.derivWorkspace;
      if (ws) persistWorkspaceSnapshot(userId, ws);
    }
  }, [userId]);

  // Hot-swap preset XML in the existing workspace whenever the URL preset
  // changes (e.g. /trading-bots → Deploy → /bot-builder?preset=mega-mind).
  React.useEffect(() => {
    if (!presetId) return;
    let cancelled = false;
    (async () => {
      // Wait until the first-mount init has produced a workspace.
      for (let i = 0; i < 50 && !initialisedRef.current && !cancelled; i += 1) {
        await new Promise((r) => setTimeout(r, 60));
      }
      if (cancelled) return;
      if (!hasPresetXml(presetId)) return;
      const workspace = (window as any).Blockly?.derivWorkspace;
      if (!workspace) return;
      const preset_xml = await loadPresetXml(presetId);
      if (!preset_xml || cancelled) return;
      closeBlocklyFlyout();
      const ok = loadWorkspaceXmlIntoBlockly(workspace, preset_xml);
      if (ok) {
        persistWorkspaceSnapshot(userIdRef.current, workspace);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [presetId]);

  const handleLoadClick = () => setLoadOpen(true);
  const handleFilePickerOpen = () => fileInputRef.current?.click();

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const workspace = (window as any).Blockly?.derivWorkspace;
    if (!workspace) {
      toast.error("Workspace isn't ready yet.");
      return;
    }
    closeBlocklyFlyout();
    const result = await loadWorkspaceFromFile(file, workspace, userId);
    if (result.ok) {
      toast.success(`Loaded ${file.name} — ${result.blockCount} block${result.blockCount === 1 ? "" : "s"}.`);
      setSaveName(file.name.replace(/\.xml$/i, "") || "My bot strategy");
      setLoadOpen(false);
    } else {
      toast.error(result.reason);
    }
  };

  const handleLoadSavedPreset = (preset: SavedBotPreset) => {
    const workspace = (window as any).Blockly?.derivWorkspace;
    if (!workspace) {
      toast.error("Workspace isn't ready yet.");
      return;
    }
    closeBlocklyFlyout();
    if (preset.xml) {
      const ok = loadWorkspaceXmlIntoBlockly(workspace, preset.xml);
      if (ok) {
        persistWorkspaceSnapshot(userId, workspace);
        toast.success(`Loaded "${preset.name}".`);
        setSaveName(preset.name);
        setLoadOpen(false);
        return;
      }
    }
    toast.error("This saved preset doesn't have a workspace snapshot. Save it again to capture the current workspace.");
  };

  const handleDeleteSavedPreset = (id: string, name: string) => {
    const next = deleteSavedBotPreset(userId, id);
    setSavedPresets(next);
    toast.success(`Removed "${name}" from your library.`);
  };

  const handleSaveSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const workspace = (window as any).Blockly?.derivWorkspace;
    if (!workspace) {
      toast.error("Workspace isn't ready yet.");
      return;
    }
    if (!saveToLibrary && !downloadOnSave) {
      toast.error("Pick at least one destination.");
      return;
    }

    let succeeded = false;

    if (saveToLibrary) {
      try {
        const B: any = (window as any).Blockly;
        const xml_dom = B?.Xml?.workspaceToDom?.(workspace);
        const xml_text: string = xml_dom ? B.Xml.domToText(xml_dom) : "";
        if (!xml_text) {
          toast.error("Workspace is empty.");
          return;
        }
        const settings = extractSettingsFromWorkspace(workspace) ?? { ...initialBotBuilderSettings };
        const preset: SavedBotPreset = {
          id: generatePresetId(),
          name: saveName.trim() || "Saved bot strategy",
          savedAt: new Date().toISOString(),
          settings,
          source: "manual",
          xml: xml_text,
        };
        persistSavedBotPreset(userId, preset);
        refreshSavedPresets();
        succeeded = true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save to library.");
        return;
      }
    }

    if (downloadOnSave) {
      const result = saveWorkspaceToFile(workspace, saveName);
      if (!result.ok) {
        toast.error(result.reason ?? "Could not save file.");
        if (!succeeded) return;
      } else {
        succeeded = true;
      }
    }

    if (succeeded) {
      toolbar.setFileName(saveName);
      const dest = saveToLibrary && downloadOnSave ? "your library and downloaded" : saveToLibrary ? "your library" : "a download";
      toast.success(`Saved "${saveName.trim() || "Saved bot strategy"}" to ${dest}.`);
      setSaveOpen(false);
    }
  };

  const handleResetConfirm = () => {
    const workspace = (window as any).Blockly?.derivWorkspace;
    if (!workspace) return;
    if (resetWorkspaceToDefault(workspace, userId)) {
      toolbar.setResetButtonState(true);
      toast.success("Workspace reset to the default strategy.");
    } else {
      toast.error("Could not reset workspace.");
    }
    setResetOpen(false);
  };

  return (
    <div
      className={classNames("bot-builder-shell", {
        "bot-builder-shell--sidebar-collapsed": sidebarCollapsed,
      })}
    >
      <div className="bot-builder-toolbar">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml,application/xml,text/xml"
          className="sr-only"
          onChange={handleFileSelected}
          aria-hidden
        />
        <Button variant="outline" size="sm" onClick={handleLoadClick}>
          <FolderOpen className="size-4" />
          <span className="hidden sm:inline">Load</span>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)}>
          <Save className="size-4" />
          <span className="hidden sm:inline">Save</span>
        </Button>
        <div className="bot-builder-toolbar-divider" aria-hidden />
        <Button variant="ghost" size="sm" onClick={toolbar.onUndoClick} aria-label="Undo" title="Undo">
          <Undo2 className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={toolbar.onRedoClick} aria-label="Redo" title="Redo">
          <Redo2 className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={toolbar.onSortClick} aria-label="Sort blocks" title="Sort blocks">
          <RefreshCw className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setResetOpen(true)}
          aria-label="Reset workspace"
          title="Reset workspace"
        >
          <RotateCcw className="size-4" />
        </Button>
        <div className="bot-builder-toolbar-divider" aria-hidden />
        <Button variant="ghost" size="sm" onClick={() => toolbar.onZoomInOutClick(true)} aria-label="Zoom in" title="Zoom in">
          <ZoomIn className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => toolbar.onZoomInOutClick(false)} aria-label="Zoom out" title="Zoom out">
          <ZoomOut className="size-4" />
        </Button>
        <div className="ml-auto truncate text-xs text-muted-foreground hidden sm:block">
          {toolbar.file_name}
        </div>
      </div>
      <div className="bot-builder-body">
        <BlocksMenuSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
          onQuickStrategy={() => quick_strategy.setOpen(true)}
        />
        <div ref={wrapperRef} className="bot-builder-workspace-wrapper">
          <div ref={containerRef} id="scratch_div" />
          {is_loading && (
            <div className="bot-builder-overlay" aria-live="polite">
              Loading Blockly…
            </div>
          )}
          {error && (
            <div className="bot-builder-error" role="alert">
              <strong>Blockly failed to mount:</strong> {error}
            </div>
          )}
        </div>
      </div>
      <div id="modal_root" />

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              Any unsaved blocks will be cleared and the default trade-definition strategy will be loaded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetConfirm}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <form onSubmit={handleSaveSubmit}>
            <DialogHeader>
              <DialogTitle>Save bot strategy</DialogTitle>
              <DialogDescription>
                Save the current workspace so you can load it from the Load menu later, or download it as XML.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <label htmlFor="bot-builder-save-name" className="text-sm font-medium">
                  Bot name
                </label>
                <Input
                  id="bot-builder-save-name"
                  autoFocus
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="My bot strategy"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Where to save</label>
                <label className="flex items-start gap-3 rounded-md border border-border bg-background p-3 text-sm cursor-pointer">
                  <Checkbox
                    checked={saveToLibrary}
                    onCheckedChange={(v) => setSaveToLibrary(v === true)}
                    className="mt-0.5"
                  />
                  <span className="flex-1">
                    <span className="font-medium">Save to your library</span>
                    <span className="block text-xs text-muted-foreground">
                      Stored in this browser. Re-open it from the Load menu without re-uploading.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-md border border-border bg-background p-3 text-sm cursor-pointer">
                  <Checkbox
                    checked={downloadOnSave}
                    onCheckedChange={(v) => setDownloadOnSave(v === true)}
                    className="mt-0.5"
                  />
                  <span className="flex-1">
                    <span className="font-medium">Also download as .xml</span>
                    <span className="block text-xs text-muted-foreground">
                      Downloads the file so you can keep a backup or share it.
                    </span>
                  </span>
                </label>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Load a bot</DialogTitle>
            <DialogDescription>
              Open one from your library or upload a strategy XML from your computer.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleFilePickerOpen}
            >
              <Upload className="size-4" />
              Open from your computer…
            </Button>
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Library className="size-4" /> My saved bots
                {savedPresets.length > 0 && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {savedPresets.length}
                  </span>
                )}
              </div>
              {savedPresets.length === 0 ? (
                <p className="rounded-md border border-dashed border-border bg-background p-4 text-center text-xs text-muted-foreground">
                  No saved bots yet. Click Save in the toolbar to add the current workspace to your library.
                </p>
              ) : (
                <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-border bg-background p-1">
                  {savedPresets.map((preset) => (
                    <li key={preset.id} className="flex items-center gap-2 rounded p-2 hover:bg-muted">
                      <button
                        type="button"
                        onClick={() => handleLoadSavedPreset(preset)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-sm font-medium">{preset.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          Saved {formatSavedAt(preset.savedAt)} · {preset.settings.symbol || "—"}
                          {preset.xml ? "" : " · settings only"}
                        </span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${preset.name}`}
                        title={`Delete ${preset.name}`}
                        onClick={() => handleDeleteSavedPreset(preset.id, preset.name)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setLoadOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export const BotBuilder: React.FC<{ presetId?: string | null }> = ({ presetId = null }) => (
  <StoreProvider dbot={dbot}>
    <BotBuilderInner presetId={presetId} />
  </StoreProvider>
);

export default BotBuilder;
