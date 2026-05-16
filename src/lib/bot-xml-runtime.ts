import type { TradeCategory } from "@/lib/deriv";

export type BotVarState = {
  vars: Record<string, number>;
  result: "win" | "loss" | null;
  totalProfit: number;
  lastProfit: number;
  purchaseType: string | null;
  tickDigits: number[];
};

class BreakSignal extends Error {
  constructor() {
    super("break");
    this.name = "BreakSignal";
  }
}

function parseXmlDoc(xmlText: string): Document | null {
  try {
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    if (doc.querySelector("parsererror")) return null;
    return doc;
  } catch {
    return null;
  }
}

function getField(el: Element, name: string): string {
  for (const child of el.children) {
    if (child.tagName === "field" && child.getAttribute("name") === name) {
      return child.textContent?.trim() ?? "";
    }
  }
  return "";
}

function getValueBlock(el: Element, name: string): Element | null {
  for (const child of el.children) {
    if (child.tagName === "value" && child.getAttribute("name") === name) {
      let shadow: Element | null = null;
      for (const inner of child.children) {
        if (inner.tagName === "block") return inner;
        if (inner.tagName === "shadow") shadow = inner;
      }
      return shadow;
    }
  }
  return null;
}

function getStatementBlock(el: Element, name: string): Element | null {
  for (const child of el.children) {
    if (child.tagName === "statement" && child.getAttribute("name") === name) {
      for (const inner of child.children) {
        if (inner.tagName === "block") return inner;
      }
      return null;
    }
  }
  return null;
}

function nextBlock(el: Element): Element | null {
  for (const child of el.children) {
    if (child.tagName === "next") {
      for (const inner of child.children) {
        if (inner.tagName === "block") return inner;
      }
    }
  }
  return null;
}

function getMutation(el: Element): Element | null {
  for (const child of el.children) {
    if (child.tagName === "mutation") return child;
  }
  return null;
}

function evalExpr(block: Element | null, state: BotVarState): number | boolean | string {
  if (!block) return 0;
  const type = block.getAttribute("type") ?? "";

  switch (type) {
    case "math_number":
    case "math_number_positive":
      return Number(getField(block, "NUM") || "0");

    case "variables_get": {
      const name = getField(block, "VAR").toLowerCase();
      return state.vars[name] ?? 0;
    }

    case "math_arithmetic": {
      const op = getField(block, "OP");
      const a = Number(evalExpr(getValueBlock(block, "A"), state));
      const b = Number(evalExpr(getValueBlock(block, "B"), state));
      if (op === "ADD") return a + b;
      if (op === "MINUS") return a - b;
      if (op === "MULTIPLY") return a * b;
      if (op === "DIVIDE") return b !== 0 ? a / b : 0;
      if (op === "POWER") return Math.pow(a, b);
      return 0;
    }

    case "math_single": {
      const op = getField(block, "OP");
      const n = Number(evalExpr(getValueBlock(block, "NUM"), state));
      if (op === "ABS") return Math.abs(n);
      if (op === "ROOT") return Math.sqrt(Math.max(0, n));
      if (op === "NEG") return -n;
      if (op === "LN") return Math.log(n);
      if (op === "LOG10") return Math.log10(n);
      if (op === "EXP") return Math.exp(n);
      if (op === "POW10") return Math.pow(10, n);
      if (op === "ROUND") return Math.round(n);
      if (op === "ROUNDUP") return Math.ceil(n);
      if (op === "ROUNDDOWN") return Math.floor(n);
      if (op === "SIN") return Math.sin((n * Math.PI) / 180);
      if (op === "COS") return Math.cos((n * Math.PI) / 180);
      if (op === "TAN") return Math.tan((n * Math.PI) / 180);
      return n;
    }

    case "math_constant": {
      const c = getField(block, "CONSTANT");
      const CONSTANTS: Record<string, number> = {
        PI: Math.PI,
        E: Math.E,
        GOLDEN_RATIO: 1.6180339887,
        SQRT2: Math.SQRT2,
        SQRT1_2: Math.SQRT1_2,
        INFINITY: Infinity,
      };
      return CONSTANTS[c] ?? 0;
    }

    case "math_number_property": {
      const prop = getField(block, "PROPERTY");
      const n = Number(evalExpr(getValueBlock(block, "NUMBER_TO_CHECK"), state));
      if (prop === "EVEN") return n % 2 === 0;
      if (prop === "ODD") return n % 2 !== 0;
      if (prop === "POSITIVE") return n > 0;
      if (prop === "NEGATIVE") return n < 0;
      if (prop === "WHOLE") return Number.isInteger(n);
      if (prop === "PRIME") {
        if (n < 2 || !Number.isInteger(n)) return false;
        for (let i = 2; i <= Math.sqrt(n); i++) if (n % i === 0) return false;
        return true;
      }
      if (prop === "DIVISIBLE_BY") {
        const div = Number(evalExpr(getValueBlock(block, "DIVISOR"), state));
        return div !== 0 && n % div === 0;
      }
      return false;
    }

    case "math_random_int": {
      const from = Math.round(Number(evalExpr(getValueBlock(block, "FROM"), state)));
      const to = Math.round(Number(evalExpr(getValueBlock(block, "TO"), state)));
      const min = Math.min(from, to);
      const max = Math.max(from, to);
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    case "logic_compare": {
      const op = getField(block, "OP");
      const a = Number(evalExpr(getValueBlock(block, "A"), state));
      const b = Number(evalExpr(getValueBlock(block, "B"), state));
      if (op === "EQ") return a === b;
      if (op === "NEQ") return a !== b;
      if (op === "LT") return a < b;
      if (op === "LTE") return a <= b;
      if (op === "GT") return a > b;
      if (op === "GTE") return a >= b;
      return false;
    }

    case "logic_operation": {
      const op = getField(block, "OP");
      const a = Boolean(evalExpr(getValueBlock(block, "A"), state));
      if (op === "AND") {
        if (!a) return false;
        return Boolean(evalExpr(getValueBlock(block, "B"), state));
      }
      if (op === "OR") {
        if (a) return true;
        return Boolean(evalExpr(getValueBlock(block, "B"), state));
      }
      return false;
    }

    case "logic_negate":
      return !Boolean(evalExpr(getValueBlock(block, "BOOL"), state));

    case "logic_boolean":
      return getField(block, "BOOL") === "TRUE";

    case "logic_ternary": {
      const cond = Boolean(evalExpr(getValueBlock(block, "IF"), state));
      return cond
        ? evalExpr(getValueBlock(block, "THEN"), state)
        : evalExpr(getValueBlock(block, "ELSE"), state);
    }

    case "total_profit":
      return state.totalProfit;

    case "contract_profit":
      return state.lastProfit;

    case "read_details": {
      const idx = Number(getField(block, "DETAIL_INDEX"));
      // Index 4 = profit/loss (negative on loss), index 5 = sell price (0 on loss)
      if (idx === 4) return state.lastProfit;
      if (idx === 5) return state.lastProfit > 0 ? state.lastProfit : 0;
      return 0;
    }

    case "contract_check_result": {
      const check = getField(block, "CHECK_RESULT").toLowerCase();
      if (check === "win") return state.result === "win";
      if (check === "loss") return state.result === "loss";
      return false;
    }

    case "last_digit": {
      const d = state.tickDigits;
      return d.length > 0 ? (d[d.length - 1] ?? 0) : 0;
    }

    case "lists_getindex": {
      const where = getField(block, "WHERE1");
      const at = Math.max(1, Math.round(Number(evalExpr(getValueBlock(block, "AT1"), state)) || 1));
      const d = state.tickDigits;
      if (where === "FROM_END") return d.length >= at ? (d[d.length - at] ?? 0) : 0;
      if (where === "FROM_START") return d.length >= at ? (d[at - 1] ?? 0) : 0;
      if (where === "FIRST") return d.length > 0 ? (d[0] ?? 0) : 0;
      if (where === "LAST") return d.length > 0 ? (d[d.length - 1] ?? 0) : 0;
      return d.length >= at ? (d[d.length - at] ?? 0) : 0;
    }

    case "lastdigitlist":
      return state.tickDigits.length;

    case "read_balance":
      return 0;

    case "text":
      return getField(block, "TEXT");

    default:
      return 0;
  }
}

function execChain(block: Element | null, state: BotVarState): void {
  let current: Element | null = block;
  while (current) {
    execBlock(current, state);
    current = nextBlock(current);
  }
}

function execBlock(block: Element, state: BotVarState): void {
  const type = block.getAttribute("type") ?? "";

  switch (type) {
    case "variables_set": {
      const name = getField(block, "VAR").toLowerCase();
      state.vars[name] = Number(evalExpr(getValueBlock(block, "VALUE"), state));
      break;
    }

    case "math_change": {
      const name = getField(block, "VAR").toLowerCase();
      const delta = Number(evalExpr(getValueBlock(block, "DELTA"), state));
      state.vars[name] = (state.vars[name] ?? 0) + delta;
      break;
    }

    case "controls_if": {
      const mutation = getMutation(block);
      const elseifCount = Number(mutation?.getAttribute("elseif") ?? 0);
      const hasElse = mutation?.getAttribute("else") === "1";

      if (Boolean(evalExpr(getValueBlock(block, "IF0"), state))) {
        execChain(getStatementBlock(block, "DO0"), state);
        return;
      }
      for (let i = 1; i <= elseifCount; i++) {
        if (Boolean(evalExpr(getValueBlock(block, `IF${i}`), state))) {
          execChain(getStatementBlock(block, `DO${i}`), state);
          return;
        }
      }
      if (hasElse) {
        execChain(getStatementBlock(block, "ELSE"), state);
      }
      break;
    }

    case "controls_flow_statements":
      if (getField(block, "FLOW") === "BREAK") throw new BreakSignal();
      break;

    case "controls_repeat_ext": {
      const times = Number(evalExpr(getValueBlock(block, "TIMES"), state));
      const limit = Number.isFinite(times)
        ? Math.min(10000, Math.max(0, Math.round(times)))
        : 1;
      try {
        for (let i = 0; i < limit; i++) {
          execChain(getStatementBlock(block, "DO"), state);
        }
      } catch (e) {
        if (!(e instanceof BreakSignal)) throw e;
      }
      break;
    }

    case "purchase":
      state.purchaseType = getField(block, "PURCHASE_LIST") || null;
      break;

    // Text / notify / side-effect blocks — skip content, let chain continue
    case "text_join":
    case "trade_again":
    case "notify":
    case "text_print":
    case "text_statement":
    case "timeout":
      break;

    default:
      break;
  }
}

export function initBotState(xmlText: string): BotVarState | null {
  const doc = parseXmlDoc(xmlText);
  if (!doc) return null;

  const state: BotVarState = {
    vars: {},
    result: null,
    totalProfit: 0,
    lastProfit: 0,
    purchaseType: null,
    tickDigits: [],
  };

  // Seed all declared variables with 0 as default
  for (const variable of doc.querySelectorAll("variables > variable")) {
    const name = (variable.textContent ?? "").trim().toLowerCase();
    if (name) state.vars[name] = 0;
  }

  // Execute INITIALIZATION block to set initial variable values
  const tradeDef = doc.querySelector('block[type="trade_definition"]');
  if (tradeDef) {
    try {
      execChain(getStatementBlock(tradeDef, "INITIALIZATION"), state);
    } catch {
      // Non-fatal — partial init is still usable
    }
  }

  return state;
}

export function runAfterPurchase(xmlText: string, state: BotVarState): void {
  const doc = parseXmlDoc(xmlText);
  if (!doc) return;
  const afterPurchase = doc.querySelector('block[type="after_purchase"]');
  if (!afterPurchase) return;
  try {
    execChain(getStatementBlock(afterPurchase, "AFTERPURCHASE_STACK"), state);
  } catch {
    // Ignore runtime errors in after_purchase
  }
}

export function runBeforePurchase(xmlText: string, state: BotVarState): void {
  state.purchaseType = null;
  const doc = parseXmlDoc(xmlText);
  if (!doc) return;
  const beforePurchase = doc.querySelector('block[type="before_purchase"]');
  if (!beforePurchase) return;
  try {
    execChain(getStatementBlock(beforePurchase, "BEFOREPURCHASE_STACK"), state);
  } catch {
    // Ignore runtime errors in before_purchase
  }
}

export function evalBotPrediction(xmlText: string, state: BotVarState): number | null {
  const doc = parseXmlDoc(xmlText);
  if (!doc) return null;
  const tradeoptions = doc.querySelector('block[type="trade_definition_tradeoptions"]');
  if (!tradeoptions) return null;
  const predBlock = getValueBlock(tradeoptions, "PREDICTION");
  if (!predBlock) return null;
  try {
    const result = evalExpr(predBlock, state);
    const n = Number(result);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function getBotStakeVar(state: BotVarState): number | null {
  for (const key of ["stake", "initial amount", "amount", "win stake"]) {
    const val = state.vars[key];
    if (val != null && Number.isFinite(val) && val > 0) return val;
  }
  return null;
}

export function purchaseTypeToSide(
  purchaseType: string,
): { tradeType: TradeCategory; side: string } | null {
  const map: Record<string, { tradeType: TradeCategory; side: string }> = {
    DIGITUNDER: { tradeType: "over_under", side: "under" },
    DIGITOVER: { tradeType: "over_under", side: "over" },
    DIGITEVEN: { tradeType: "even_odd", side: "even" },
    DIGITODD: { tradeType: "even_odd", side: "odd" },
    DIGITMATCH: { tradeType: "matches_differs", side: "matches" },
    DIGITDIFF: { tradeType: "matches_differs", side: "differs" },
    CALL: { tradeType: "rise_fall", side: "up" },
    PUT: { tradeType: "rise_fall", side: "down" },
    ONETOUCH: { tradeType: "touch_no_touch", side: "touch" },
    NOTOUCH: { tradeType: "touch_no_touch", side: "no_touch" },
    ACCU: { tradeType: "accumulator", side: "buy" },
    MULTUP: { tradeType: "multiplier", side: "up" },
    MULTDOWN: { tradeType: "multiplier", side: "down" },
  };
  return map[purchaseType.toUpperCase()] ?? null;
}
