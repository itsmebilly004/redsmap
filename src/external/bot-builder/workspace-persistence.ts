import {
  hasMeaningfulBotBuilderState,
  initialBotBuilderSettings,
  persistCurrentBotSettings,
  type BotBuilderDurationUnit,
  type BotBuilderSettings,
  type BotBuilderTradeType,
} from "@/lib/bot-builder-state";
import { scheduleRecentWorkspaceWrite } from "./recent-workspaces";

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

// Recursively evaluate a value-input block tree into a numeric literal. Handles
// the most common shapes a Deriv bot uses for AMOUNT / DURATION:
//   * math_number  (a literal `1`)
//   * math_arithmetic (ADD/MINUS/MULTIPLY/DIVIDE/POWER over two children)
//   * variables_get   (follow back to a matching variables_set and recurse)
// Anything more exotic returns null so the caller can fall back to a default.
function evaluateMathBlock(
  block: any,
  workspace: any,
  visited: Set<string>,
): number | null {
  if (!block || !block.type) return null;
  const id = block.id ?? `${block.type}-${Math.random()}`;
  if (visited.has(id)) return null;
  visited.add(id);

  if (block.type === "math_number") {
    return readFirstNumber(block.getFieldValue?.("NUM"));
  }

  if (block.type === "math_arithmetic") {
    const op = block.getFieldValue?.("OP");
    const a = evaluateMathBlock(
      block.getInputTargetBlock?.("A"),
      workspace,
      visited,
    );
    const b = evaluateMathBlock(
      block.getInputTargetBlock?.("B"),
      workspace,
      visited,
    );
    if (a === null || b === null) return null;
    switch (op) {
      case "ADD":
        return a + b;
      case "MINUS":
        return a - b;
      case "MULTIPLY":
        return a * b;
      case "DIVIDE":
        return b === 0 ? null : a / b;
      case "POWER":
        return Math.pow(a, b);
      default:
        return null;
    }
  }

  if (block.type === "math_single") {
    const op = block.getFieldValue?.("OP");
    const num = evaluateMathBlock(
      block.getInputTargetBlock?.("NUM"),
      workspace,
      visited,
    );
    if (num === null) return null;
    switch (op) {
      case "ROOT":
        return Math.sqrt(num);
      case "ABS":
        return Math.abs(num);
      case "NEG":
        return -num;
      case "LN":
        return Math.log(num);
      case "LOG10":
        return Math.log10(num);
      case "EXP":
        return Math.exp(num);
      case "POW10":
        return Math.pow(10, num);
      default:
        return null;
    }
  }

  if (block.type === "variables_get") {
    const var_id = block.getFieldValue?.("VAR");
    if (!var_id) return null;
    if (!workspace?.getAllBlocks) return null;
    const all = workspace.getAllBlocks(true);
    for (const candidate of all) {
      if (candidate?.type !== "variables_set") continue;
      const candidate_var = candidate.getFieldValue?.("VAR");
      if (candidate_var !== var_id) continue;
      const valueBlock = candidate.getInputTargetBlock?.("VALUE");
      const evaluated = evaluateMathBlock(valueBlock, workspace, visited);
      if (evaluated !== null) return evaluated;
    }
    return null;
  }

  return null;
}

function readNumberInput(block: any, inputName: string, workspace: any): number | null {
  if (!block?.getInputTargetBlock) return null;
  const target = block.getInputTargetBlock(inputName);
  if (!target) return null;
  // Fast path: literal math_number shadow.
  const literal = readFirstNumber(target.getFieldValue?.("NUM"));
  if (literal !== null) return literal;
  // Slow path: walk through math/variables blocks.
  return evaluateMathBlock(target, workspace, new Set());
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

  const stake = readNumberInput(options, "AMOUNT", workspace);
  const duration = readNumberInput(options, "DURATION", workspace);

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
  options?: { name?: string },
) {
  if (!workspace) return;
  try {
    const B = (window as any).Blockly;
    if (B?.Xml && workspace.getAllBlocks?.()?.length) {
      const xml_dom = B.Xml.workspaceToDom(workspace);
      const xml_text = B.Xml.domToText(xml_dom);
      writeSavedWorkspaceXml(userId, xml_text);
      // ALSO write to the localForage key dbot.initWorkspace reads from on
      // every mount. This is the canonical restore path — by writing here,
      // refresh / re-open of /bot-builder picks up the user's last bot
      // automatically without any post-init React work.
      scheduleRecentWorkspaceWrite(workspace, options?.name ?? "My bot strategy");
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[bot-builder] failed to persist workspace xml", err);
  }
  try {
    const settings = extractSettingsFromWorkspace(workspace);
    // CRITICAL: don't overwrite the current-settings with the
    // initialBotBuilderSettings defaults. For complex bots where AMOUNT/
    // DURATION feed off variables we can't statically evaluate, extraction
    // returns the base defaults. If we wrote those, the footer Run button
    // would use $1 instead of the deployed preset's actual stake.
    if (hasMeaningfulBotBuilderState(settings)) {
      persistCurrentBotSettings(userId, settings);
    }
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
    // disable events (that suppresses BLOCK_CREATE and stops Blockly's
    // renderer from drawing new blocks until the next page refresh).
    B.Events?.setGroup?.(`bot-load-${Date.now()}`);

    // 1) Force every top block deletable so clearWorkspaceAndLoadFromXml can
    //    actually dispose them. Older saves stored deletable=false on the
    //    root block which would otherwise leave the previous strategy stuck.
    const top_blocks_before = workspace.getTopBlocks?.(false) ?? [];
    for (const block of top_blocks_before) {
      try {
        if (block && "deletable_" in block) block.deletable_ = true;
        block.setDeletable?.(true);
      } catch {
        /* noop */
      }
    }

    // 2) Use Blockly's canonical "wipe + load" helper. This is one atomic
    //    operation that clears variables + top blocks AND renders the new
    //    DOM into the same workspace — no race, no leftover blocks.
    if (typeof B.Xml.clearWorkspaceAndLoadFromXml === "function") {
      B.Xml.clearWorkspaceAndLoadFromXml(dom, workspace);
    } else {
      // Fallback for older Blockly builds.
      workspace.clear?.();
      B.Xml.domToWorkspace(dom, workspace);
    }

    workspace.clearUndo?.();
    B.Events?.setGroup?.(previous_group ?? false);

    const new_top = workspace.getTopBlocks?.(false) ?? [];

    // 3) Explicitly render every top block. clearWorkspaceAndLoadFromXml
    //    creates the SVG nodes but the v10 Zelos renderer sometimes needs a
    //    second pass after the workspace's metrics settle.
    for (const block of new_top) {
      try {
        block.initSvg?.();
        block.render?.(false);
      } catch {
        /* noop */
      }
    }

    // 4) Recompute Blockly's metrics, scroll to home, kick a resize so the
    //    surrounding React layout updates too. rAF defers the render-batch
    //    pass until after the DOM commit so the user sees blocks immediately.
    const flush = () => {
      try {
        B.svgResize?.(workspace);
      } catch {
        /* noop */
      }
      try {
        workspace.render?.();
      } catch {
        /* noop */
      }
      try {
        workspace.scrollCenter?.();
      } catch {
        /* noop */
      }
      try {
        window.dispatchEvent(new Event("resize"));
      } catch {
        /* noop */
      }
    };
    flush();
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(flush);
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
