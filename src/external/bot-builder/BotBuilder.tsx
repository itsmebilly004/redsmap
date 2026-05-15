import * as React from "react";
import { observer } from "mobx-react-lite";
import {
  FolderOpen,
  Redo2,
  RefreshCw,
  Save,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoreProvider, useStore } from "@/external/stores/useStore";
import dbot from "@/external/bot-skeleton/scratch/dbot";
import { useAuth } from "@/hooks/use-auth";
import { ToolboxItems } from "./toolbox-items";
import {
  loadWorkspaceXmlIntoBlockly,
  persistWorkspaceSnapshot,
  readSavedWorkspaceXml,
} from "./workspace-persistence";
import "./bot-builder.css";

const PERSIST_DEBOUNCE_MS = 500;

const BotBuilderInner = observer(() => {
  const store = useStore();
  const { app, dashboard, toolbar, flyout, blockly_store, save_modal, load_modal } = store;
  const { is_loading } = blockly_store;
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);

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

      // Wait one paint so the flex layout settles and the wrapper has measurable height.
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

        // Restore a previously-saved workspace XML (auto-save round-trip).
        if (workspace) {
          const saved_xml = readSavedWorkspaceXml(userId);
          if (saved_xml) {
            loadWorkspaceXmlIntoBlockly(workspace, saved_xml);
          }

          // Debounced auto-save on every meaningful change.
          const schedulePersist = () => {
            if (persist_timer !== null) window.clearTimeout(persist_timer);
            persist_timer = window.setTimeout(() => {
              persist_timer = null;
              persistWorkspaceSnapshot(userId, workspace);
            }, PERSIST_DEBOUNCE_MS);
          };
          persist_listener = (event: any) => {
            // Ignore UI-only events (selection, click).
            if (!event || event.type === "selected" || event.type === "ui") return;
            if (event.isUiEvent) return;
            schedulePersist();
          };
          workspace.addChangeListener?.(persist_listener);
          // Persist the initial state too so the footer Run button has something
          // to read on the user's very first visit.
          persistWorkspaceSnapshot(userId, workspace);
        }

        blockly_store.setLoading(false);
        blockly_store.onMount();

        // Force Blockly to recompute its SVG metrics now that the workspace is
        // mounted inside a real flex container.
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
        // Final flush so the latest edits aren't lost on unmount.
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
  }, [userId]);

  return (
    <div className="bot-builder-shell">
      <div className="bot-builder-toolbar">
        <Button variant="outline" size="sm" onClick={() => load_modal.onLoadModalOpen()}>
          <FolderOpen className="size-4" />
          Load
        </Button>
        <Button variant="outline" size="sm" onClick={() => save_modal.toggleSaveModal()}>
          <Save className="size-4" />
          Save
        </Button>
        <div className="bot-builder-toolbar-divider" aria-hidden />
        <Button variant="ghost" size="sm" onClick={toolbar.onUndoClick} aria-label="Undo">
          <Undo2 className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={toolbar.onRedoClick} aria-label="Redo">
          <Redo2 className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={toolbar.onSortClick} aria-label="Sort">
          <RefreshCw className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={toolbar.onResetClick} aria-label="Reset">
          <Trash2 className="size-4" />
        </Button>
        <div className="bot-builder-toolbar-divider" aria-hidden />
        <Button variant="ghost" size="sm" onClick={() => toolbar.onZoomInOutClick(true)} aria-label="Zoom in">
          <ZoomIn className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => toolbar.onZoomInOutClick(false)} aria-label="Zoom out">
          <ZoomOut className="size-4" />
        </Button>
      </div>
      <div ref={wrapperRef} className="bot-builder-workspace-wrapper">
        {/* Blockly injects an SVG into #scratch_div. Don't put React children inside it. */}
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
      <div id="modal_root" />
    </div>
  );
});

export const BotBuilder: React.FC = () => (
  <StoreProvider dbot={dbot}>
    <BotBuilderInner />
  </StoreProvider>
);

export default BotBuilder;
