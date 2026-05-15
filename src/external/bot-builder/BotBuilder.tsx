import * as React from "react";
import { observer } from "mobx-react-lite";
import classNames from "classnames";
import {
  FolderOpen,
  Redo2,
  RefreshCw,
  RotateCcw,
  Save,
  Undo2,
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
import { StoreProvider, useStore } from "@/external/stores/useStore";
import dbot from "@/external/bot-skeleton/scratch/dbot";
import { useAuth } from "@/hooks/use-auth";
import { ToolboxItems } from "./toolbox-items";
import {
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
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = window.localStorage.getItem(SIDEBAR_PREF_KEY);
      // Default collapsed on phone sizes for more workspace.
      if (stored === null) return window.matchMedia("(max-width: 640px)").matches;
      return stored === "1";
    } catch {
      return false;
    }
  });

  // Persist sidebar pref + tell Blockly to recalculate workspace metrics
  // whenever the sidebar width changes.
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

  React.useEffect(() => {
    let cancelled = false;
    let initialised = false;
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
        initialised = true;

        const workspace: any = (window as any).Blockly?.derivWorkspace;
        if (workspace) {
          // Deploy from Trading Bots wins over the user's last saved workspace,
          // so opening /bot-builder?preset=osam-autobot always loads that bot's
          // full strategy XML — the same one a manual file upload would use.
          if (presetId && hasPresetXml(presetId)) {
            const preset_xml = await loadPresetXml(presetId);
            if (preset_xml && !cancelled) {
              loadWorkspaceXmlIntoBlockly(workspace, preset_xml);
            }
          } else {
            const saved_xml = readSavedWorkspaceXml(userId);
            if (saved_xml) {
              loadWorkspaceXmlIntoBlockly(workspace, saved_xml);
            }
          }

          const schedulePersist = () => {
            if (persist_timer !== null) window.clearTimeout(persist_timer);
            persist_timer = window.setTimeout(() => {
              persist_timer = null;
              persistWorkspaceSnapshot(userId, workspace);
            }, PERSIST_DEBOUNCE_MS);
          };
          persist_listener = (event: any) => {
            if (!event || event.type === "selected" || event.type === "ui") return;
            if (event.isUiEvent) return;
            schedulePersist();
          };
          workspace.addChangeListener?.(persist_listener);
          persistWorkspaceSnapshot(userId, workspace);
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
          persistWorkspaceSnapshot(userId, ws);
        } catch {
          /* noop */
        }
      }
      if (initialised) {
        blockly_store.onUnmount();
        try {
          dbot.terminateBot?.();
        } catch {
          /* noop */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, presetId]);

  const handleLoadClick = () => fileInputRef.current?.click();

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
    } else {
      toast.error(result.reason);
    }
  };

  const handleSaveSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const workspace = (window as any).Blockly?.derivWorkspace;
    if (!workspace) {
      toast.error("Workspace isn't ready yet.");
      return;
    }
    const result = saveWorkspaceToFile(workspace, saveName);
    if (result.ok) {
      toolbar.setFileName(saveName);
      toast.success("Strategy downloaded.");
      setSaveOpen(false);
    } else {
      toast.error(result.reason ?? "Could not save.");
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
                Saves the current workspace as a Blockly XML file you can re-import later.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-2">
              <label htmlFor="bot-builder-save-name" className="text-sm font-medium">
                File name
              </label>
              <Input
                id="bot-builder-save-name"
                autoFocus
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="My bot strategy"
              />
              <p className="text-xs text-muted-foreground">Saved as {saveName.trim() || "bot-strategy"}.xml</p>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Download</Button>
            </DialogFooter>
          </form>
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
