import {
  initialBotBuilderSettings,
  persistCurrentBotSettings,
  type BotBuilderDurationUnit,
  type BotBuilderSettings,
  type BotBuilderTradeType,
} from "@/lib/bot-builder-state";

// Local-storage key for the raw Blockly XML so the workspace round-trips
// across navigation. Settings (the footer-monitor input) live under the
// existing `arktrader:bot-builder:${userId}:current-settings` key managed by
// bot-builder-state.ts so the rest of the app keeps reading one source.
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

// Map Deriv's TRADETYPE_LIST value → arktrader's BotBuilderTradeType.
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
  // Deriv encodes contract types like CALL, PUT, DIGITEVEN, DIGITODD, ...
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

// Read a numeric Blockly value-input. Trade-options uses `math_number` shadow
// blocks for AMOUNT / DURATION, so we peek into the child block's NUM field.
function readNumberInput(block: any, inputName: string): number | null {
  if (!block?.getInputTargetBlock) return null;
  const target = block.getInputTargetBlock(inputName);
  if (!target) return null;
  return readFirstNumber(target.getFieldValue?.("NUM"));
}

/**
 * Walk the Blockly workspace and pluck out the fields the footer
 * BotRunMonitorPanel needs. Anything we can't determine is filled from
 * initialBotBuilderSettings so the consumer never sees undefined.
 */
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
  // Save raw XML for round-trip restore on next /bot-builder visit.
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
  // Save a derived BotBuilderSettings snapshot so the footer Run button can
  // pick it up from anywhere in the app.
  try {
    const settings = extractSettingsFromWorkspace(workspace);
    persistCurrentBotSettings(userId, settings);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[bot-builder] failed to persist derived settings", err);
  }
}

export function loadWorkspaceXmlIntoBlockly(
  workspace: any,
  xml_text: string | null,
): boolean {
  if (!workspace || !xml_text) return false;
  try {
    const B = (window as any).Blockly;
    if (!B?.Xml || !B?.utils?.xml?.textToDom) return false;
    const dom = B.utils.xml.textToDom(xml_text);
    workspace.clear?.();
    B.Xml.domToWorkspace(dom, workspace);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[bot-builder] failed to restore workspace xml", err);
    return false;
  }
}
