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
  const previous_disabled = B.Events?.disabled_ ?? 0;
  try {
    const dom = B.utils.xml.textToDom(xml_text);

    // Suppress event re-entry while we tear down + rebuild so block onchange
    // handlers don't try to enforce TRADE_OPTIONS membership on a half-built
    // workspace.
    B.Events?.setGroup?.(`bot-load-${Date.now()}`);
    B.Events?.disable?.();

    // Workspace.clear() in v10 disposes top blocks, but we explicitly dispose
    // each first to be defensive about deletable=false guards in older saves.
    const top_blocks = workspace.getTopBlocks?.(false) ?? [];
    for (const block of top_blocks) {
      try {
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

    // Re-enable events so user interactions resume normally.
    B.Events?.enable?.();
    B.Events?.setGroup?.(previous_group ?? false);

    // Lay out the new blocks and force Blockly to recompute its SVG metrics.
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

    const block_count = workspace.getAllBlocks?.(false)?.length ?? 0;
    // eslint-disable-next-line no-console
    console.info(
      "[bot-builder] loaded workspace, block_count =",
      block_count,
      "top_blocks =",
      workspace.getTopBlocks?.(false)?.length ?? 0,
    );
    return block_count > 0;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[bot-builder] failed to load workspace xml", err);
    try {
      // Re-enable in error path so the workspace isn't left frozen.
      B.Events?.enable?.();
      B.Events?.setGroup?.(previous_group ?? false);
      if (typeof previous_disabled === "number") {
        // best-effort restoration of nested disable count
      }
    } catch {
      /* noop */
    }
    return false;
  }
}
