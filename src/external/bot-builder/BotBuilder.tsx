import * as React from "react";
import { observer } from "mobx-react-lite";
import classNames from "classnames";
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
import { ToolboxItems } from "./toolbox-items";
import "./bot-builder.css";

const BotBuilderInner = observer(() => {
  const store = useStore();
  const { app, dashboard, toolbar, flyout, blockly_store, save_modal, load_modal } = store;
  const { is_loading } = blockly_store;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    app.onMount();
    return () => app.onUnmount();
  }, [app]);

  React.useEffect(() => {
    let cancelled = false;
    let initialised = false;

    const init = async () => {
      if (!containerRef.current) return;
      try {
        blockly_store.setLoading(true);
        const dbot_store = {
          is_mobile: false,
          is_dark_mode_on: document.documentElement.classList.contains("dark"),
          client: { loginid: null },
          dashboard,
          toolbar,
          flyout,
          save_modal,
          load_modal,
          toolbox: null,
          setLoading: blockly_store.setLoading,
          handleFileChange: () => {},
          toggleStrategyModal: () => {},
        };
        await dbot.initWorkspace("/", dbot_store, {}, false, dbot_store.is_dark_mode_on);
        if (cancelled) return;
        initialised = true;

        const workspace: any = (window as any).Blockly?.derivWorkspace;
        if (workspace) {
          try {
            const toolbox_xml = ToolboxItems();
            workspace.updateToolbox?.(toolbox_xml);
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn("Failed to update toolbox", err);
          }
        }
        blockly_store.setLoading(false);
        blockly_store.onMount();
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error("BotBuilder init failed:", err);
        setError(err instanceof Error ? err.message : String(err));
        blockly_store.setLoading(false);
      }
    };

    void init();

    return () => {
      cancelled = true;
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
  }, []);

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
      <div
        ref={containerRef}
        id="scratch_div"
        className={classNames("bot-builder-workspace", {
          "bot-builder-workspace--loading": is_loading,
        })}
      >
        {is_loading && <div className="bot-builder-loading">Loading Blockly…</div>}
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
