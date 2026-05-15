import {
  initialBotBuilderSettings,
  persistCurrentBotSettings,
  type BotBuilderDurationUnit,
  type BotBuilderSettings,
  type BotBuilderTradeType,
} from "@/lib/bot-builder-state";

const xmlStorageKey = (userId: string | null | undefined) =>
  `arktrader:bot-builder:${userId ?? "guest"}:workspace-xml`;

export function readSavedWorkspaceXml(userId: string | null | undefined): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(xmlStorageKey(userId));
  } catch {
    return null;
  }
}

export function writeSavedWorkspaceXml(
  userId: string | null | undefined,
  xml: string,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(xmlStorageKey(userId), xml);
  } catch {
    // ignore quota errors
  }
}

function mapTradeType(value: string): BotBuilderTradeType {
  const v = value.toLowerCase();
  if (v.includes("digit") || v === "matchesdiffers" || v === "evenodd" || v === "overunder") {
    return "digits";
  }
  if (v === "callput" || v === "risefall" || v === "rise_fall" || v === "fall") return "rise_fall";
  if (v === "higherlower" || v === "higher_lower" || v === "higher") return "higher_lower";
  if (v === "touchnotouch" || v === "touch_no_touch" || v === "touch") return "touch_no_touch";
  if (v === "multiplier" || v.startsWith("mult")) return "multiplier";
  return initialBotBuilderSettings.tradeType;
}

function mapDirection(tradeType: string, contractType: string): string {
  const t = String(tradeType ?? "").toLowerCase();
  const c = String(contractType ?? "").toLowerCase();
  if (c === "both" || !c) {
    if (t.includes("evenodd")) return "even";
    if (t.includes("matchesdiffers")) return "matches";
    if (t.includes("overunder")) return "over";
    if (t === "callput" || t.includes("rise") || t.includes("fall")) return "up";
    if (t.includes("higher") || t.includes("lower")) return "higher";
    if (t.includes("touch")) return "touch";
    return initialBotBuilderSettings.purchaseDirection;
  }
  if (c === "call" || c === "callput_up" || c === "rise") return "up";
  if (c === "put" || c === "callput_down" || c === "fall") return "down";
  if (c === "digiteven") return "even";
  if (c === "digitodd") return "odd";
  if (c === "digitmatch") return "matches";
  if (c === "digitdiff") return "differs";
  if (c === "digitover") return "over";
  if (c === "digitunder") return "under";
  if (c === "higher" || c === "callspread") return "higher";
  if (c === "lower" || c === "putspread") return "lower";
  if (c === "onetouch") return "touch";
  if (c === "notouch") return "no_touch";
  return c;
}

function mapDurationUnit(value: string): BotBuilderDurationUnit {
  const v = String(value ?? "").toLowerCase();
  if (v === "m" || v === "minutes" || v === "minute") return "m";
  if (v === "s" || v === "seconds" || v === "second") return "s";
  return "t";
}

function readFirstNumber(...candidates: unknown[]): number | null {
  for (const value of candidates) {
    if (value === null || value === undefined) continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function readNumberInput(block: any, inputName: string): number | null {
  if (!block?.getInputTargetBlock) return null;
  const target = block.getInputTargetBlock(inputName);
  if (!target) return null;
  return readFirstNumber(target.getFieldValue?.("NUM"));
}

export function extractSettingsFromWorkspace(workspace: any): BotBuilderSettings {
  const base = { ...initialBotBuilderSettings };
  if (!workspace?.getAllBlocks) return base;

  const blocks = workspace.getAllBlocks(true) as Array<{
    type: string;
    getFieldValue?: (name: string) => string | null;
    getInputTargetBlock?: (name: string) => unknown;
  }>;
  const find = (type: string) => blocks.find((b) => b.type === type) ?? null;

  const market = find("trade_definition_market");
  const tradetype = find("trade_definition_tradetype");
  const contracttype = find("trade_definition_contracttype");
  const options = find("trade_definition_tradeoptions");
  const candle = find("trade_definition_candleinterval");

  const symbol = market?.getFieldValue?.("SYMBOL_LIST") || "";
  const market_value = market?.getFieldValue?.("MARKET_LIST") || "";
  const trade_type = tradetype?.getFieldValue?.("TRADETYPE_LIST") || "";
  const contract_type = contracttype?.getFieldValue?.("TYPE_LIST") || "";
  const duration_unit = options?.getFieldValue?.("DURATIONTYPE_LIST") || "";
  const currency = options?.getFieldValue?.("CURRENCY_LIST") || "";
  const candle_interval = candle?.getFieldValue?.("CANDLEINTERVAL_LIST") || "";

  const stake = readNumberInput(options, "AMOUNT");
  const duration = readNumberInput(options, "DURATION");

  return {
    ...base,
    symbol: symbol || base.symbol,
    market: market_value || base.market,
    tradeType: trade_type ? mapTradeType(trade_type) : base.tradeType,
    purchaseDirection:
      trade_type || contract_type
        ? mapDirection(trade_type, contract_type)
        : base.purchaseDirection,
    durationUnit: duration_unit ? mapDurationUnit(duration_unit) : base.durationUnit,
    duration: duration ?? base.duration,
    stake: stake ?? base.stake,
    currency: currency || base.currency,
    candleInterval: candle_interval || base.candleInterval,
  };
}

export function persistWorkspaceSnapshot(
  userId: string | null | undefined,
  workspace: any,
) {
  if (!workspace) return;
  try {
    const B = (window as any).Blockly;
    if (B?.Xml && workspace.getAllBlocks?.()?.length) {
      const xml_dom = B.Xml.workspaceToDom(workspace);
      const xml_text = B.Xml.domToText(xml_dom);
      writeSavedWorkspaceXml(userId, xml_text);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[bot-builder] failed to persist workspace xml", err);
  }
  try {
    const settings = extractSettingsFromWorkspace(workspace);
    persistCurrentBotSettings(userId, settings);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[bot-builder] failed to persist derived settings", err);
  }
}

/**
 * Load a Blockly strategy XML into the workspace. Disposes every existing
 * top-level block (including deletable=false root blocks), groups events so
 * listeners see one transaction, then rerenders + recenters.
 *
 * Returns true if domToWorkspace completed without throwing.
 */
export function loadWorkspaceXmlIntoBlockly(
  workspace: any,
  xml_text: string | null,
): boolean {
  if (!workspace || !xml_text) return false;
  const B = (window as any).Blockly;
  if (!B?.Xml || !B?.utils?.xml?.textToDom) return false;

  const previous_group = B.Events?.getGroup?.();
  try {
    const dom = B.utils.xml.textToDom(xml_text);

    // Group teardown + rebuild as one transaction. We intentionally do NOT
    // call Events.disable() — disabling events suppresses BLOCK_CREATE and
    // therefore prevents Blockly's renderer from drawing the new blocks
    // until something else (page resize / refresh) triggers a redraw.
    B.Events?.setGroup?.(`bot-load-${Date.now()}`);

    // Dispose every top block (including deletable=false root blocks) before
    // clear() to be defensive about older saved workspaces.
    const top_blocks = workspace.getTopBlocks?.(false) ?? [];
    for (const block of top_blocks) {
      try {
        if (block && "deletable_" in block) block.deletable_ = true;
        block.setDeletable?.(true);
        block.dispose?.(false, false);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[bot-builder] dispose failed for", block?.type, err);
      }
    }
    workspace.clear?.();

    B.Xml.domToWorkspace(dom, workspace);

    // Reset undo so the load itself isn't undoable (otherwise Ctrl+Z brings
    // the previous bot back over the new one).
    workspace.clearUndo?.();

    B.Events?.setGroup?.(previous_group ?? false);

    // Force each top-level block to render now that Blockly's batch is
    // complete. cleanUp() lays the stacks out cleanly, svgResize recomputes
    // metrics for the SVG host, scrollCenter brings the user back to (0,0).
    const new_top = workspace.getTopBlocks?.(false) ?? [];
    for (const block of new_top) {
      try {
        block.render?.(false);
      } catch {
        /* noop */
      }
    }
    try {
      workspace.cleanUp?.(0, 60);
    } catch {
      /* swallow — cleanUp can throw on stubbed dropdowns */
    }
    try {
      B.svgResize?.(workspace);
    } catch {
      /* noop */
    }
    try {
      workspace.scrollCenter?.();
    } catch {
      /* noop */
    }
    // Final nudge so any change-listeners (and React effects watching for
    // resize) pick up the new content immediately.
    try {
      window.dispatchEvent(new Event("resize"));
    } catch {
      /* noop */
    }

    const block_count = workspace.getAllBlocks?.(false)?.length ?? 0;
    // eslint-disable-next-line no-console
    console.info(
      "[bot-builder] loaded workspace, block_count =",
      block_count,
      "top_blocks =",
      new_top.length,
    );
    return block_count > 0;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[bot-builder] failed to load workspace xml", err);
    try {
      B.Events?.setGroup?.(previous_group ?? false);
    } catch {
      /* noop */
    }
    return false;
  }
}
