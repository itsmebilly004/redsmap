import type { TradeCategory } from "@/lib/deriv";

type ProcDef = {
  params: string[];
  body: Element | null;
  returnBlock: Element | null;
};

export type BotVarState = {
  vars: Record<string, number>;
  listVars: Record<string, number[]>;
  procs: Record<string, ProcDef>;
  result: "win" | "loss" | null;
  totalProfit: number;
  lastProfit: number;
  purchaseType: string | null;
  tickDigits: number[];
  entrySpot: number | null;
  exitSpot: number | null;
  buyPrice: number | null;
  payout: number | null;
  balance: number;
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

function isListBlock(block: Element | null): boolean {
  if (!block) return false;
  const type = block.getAttribute("type") ?? "";
  return type === "lastDigitList" || type === "lists_create_with";
}

function evalListExpr(block: Element | null, state: BotVarState): number[] {
  if (!block) return [];
  const type = block.getAttribute("type") ?? "";
  switch (type) {
    case "lastDigitList":
      return [...state.tickDigits];
    case "variables_get": {
      const name = getField(block, "VAR").toLowerCase();
      return state.listVars[name] ?? [];
    }
    case "lists_create_with": {
      const mutation = getMutation(block);
      const items = Number(mutation?.getAttribute("items") ?? 0);
      const result: number[] = [];
      for (let i = 0; i < items; i++) {
        result.push(Number(evalExpr(getValueBlock(block, `ADD${i}`), state)));
      }
      return result;
    }
    default:
      return [];
  }
}

function callProcedure(
  name: string,
  args: (number | boolean | string)[],
  state: BotVarState,
): number {
  const proc = state.procs[name.toLowerCase()];
  if (!proc) return 0;
  const saved: Record<string, number> = {};
  for (let i = 0; i < proc.params.length; i++) {
    const p = proc.params[i]!;
    saved[p] = state.vars[p] ?? 0;
    state.vars[p] = Number(args[i] ?? 0);
  }
  let returnValue = 0;
  try {
    if (proc.body) execChain(proc.body, state);
    if (proc.returnBlock) returnValue = Number(evalExpr(proc.returnBlock, state));
  } catch (e) {
    if (!(e instanceof BreakSignal)) throw e;
  }
  for (const p of proc.params) {
    state.vars[p] = saved[p] ?? 0;
  }
  return returnValue;
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
      if (state.listVars[name] !== undefined) return 0;
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

    case "math_round": {
      const op = getField(block, "OP");
      const n = Number(evalExpr(getValueBlock(block, "NUM"), state));
      if (op === "ROUNDUP") return Math.ceil(n);
      if (op === "ROUNDDOWN") return Math.floor(n);
      return Math.round(n);
    }

    case "math_modulo": {
      const a = Number(evalExpr(getValueBlock(block, "DIVIDEND"), state));
      const b = Number(evalExpr(getValueBlock(block, "DIVISOR"), state));
      return b !== 0 ? a % b : 0;
    }

    case "math_constrain": {
      const n = Number(evalExpr(getValueBlock(block, "VALUE"), state));
      const low = Number(evalExpr(getValueBlock(block, "LOW"), state));
      const high = Number(evalExpr(getValueBlock(block, "HIGH"), state));
      return Math.min(Math.max(n, low), high);
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

    case "math_random_float":
      return Math.random();

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
      // DDBOt createDetails(contract) array, accessed via readDetails(i) = createDetails[i-1]:
      // idx 2 → buy_price (stake paid)
      // idx 3 → sell_price (payout received)
      // idx 4 → profit = sell_price - buy_price (signed)
      // idx 7 → entry_tick spot value
      // idx 9 → exit_tick spot value
      const idx = Number(getField(block, "DETAIL_INDEX"));
      if (idx === 2) return state.buyPrice ?? 0;
      if (idx === 3) return state.payout ?? 0;
      if (idx === 4) return state.lastProfit;
      if (idx === 7) return state.entrySpot ?? 0;
      if (idx === 9) return state.exitSpot ?? 0;
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

    // lastDigitList used directly as a number expression → returns list length
    case "lastDigitList":
    case "lastdigitlist":
      return state.tickDigits.length;

    // DDBOt camelCase variant — VALUE holds a list-producing block, AT holds the index
    case "lists_getIndex": {
      const where = getField(block, "WHERE");
      const list = evalListExpr(getValueBlock(block, "VALUE"), state);
      const at = Math.max(1, Math.round(Number(evalExpr(getValueBlock(block, "AT"), state)) || 1));
      if (where === "FROM_END") return list.length >= at ? (list[list.length - at] ?? 0) : 0;
      if (where === "FROM_START") return list.length >= at ? (list[at - 1] ?? 0) : 0;
      if (where === "FIRST") return list.length > 0 ? (list[0] ?? 0) : 0;
      if (where === "LAST") return list.length > 0 ? (list[list.length - 1] ?? 0) : 0;
      return list.length >= at ? (list[list.length - at] ?? 0) : 0;
    }

    // Legacy lowercase variant — operates directly on tickDigits via WHERE1/AT1
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

    case "read_balance":
      return state.balance;

    case "text":
      return getField(block, "TEXT");

    case "procedures_callreturn": {
      const mutation = getMutation(block);
      const name = (mutation?.getAttribute("name") ?? "").toLowerCase();
      const proc = state.procs[name];
      if (!proc) return 0;
      const args = proc.params.map((_, i) => evalExpr(getValueBlock(block, `ARG${i}`), state));
      return callProcedure(name, args, state);
    }

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
      const valueBlock = getValueBlock(block, "VALUE");
      if (isListBlock(valueBlock)) {
        state.listVars[name] = evalListExpr(valueBlock, state);
      } else {
        state.vars[name] = Number(evalExpr(valueBlock, state));
      }
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

    case "controls_for": {
      const varName = getField(block, "VAR").toLowerCase();
      const from = Number(evalExpr(getValueBlock(block, "FROM"), state));
      const to = Number(evalExpr(getValueBlock(block, "TO"), state));
      const by = Number(evalExpr(getValueBlock(block, "BY"), state)) || 1;
      const doBlock = getStatementBlock(block, "DO");
      let safetyCount = 0;
      try {
        if (by > 0) {
          for (let i = from; i <= to && safetyCount++ < 10000; i += by) {
            state.vars[varName] = i;
            execChain(doBlock, state);
          }
        } else if (by < 0) {
          for (let i = from; i >= to && safetyCount++ < 10000; i += by) {
            state.vars[varName] = i;
            execChain(doBlock, state);
          }
        }
      } catch (e) {
        if (!(e instanceof BreakSignal)) throw e;
      }
      break;
    }

    case "controls_whileUntil": {
      const mode = getField(block, "MODE");
      const doBlock = getStatementBlock(block, "DO");
      let safetyCount = 0;
      try {
        while (safetyCount++ < 10000) {
          const cond = Boolean(evalExpr(getValueBlock(block, "BOOL"), state));
          if (mode === "UNTIL" ? cond : !cond) break;
          execChain(doBlock, state);
        }
      } catch (e) {
        if (!(e instanceof BreakSignal)) throw e;
      }
      break;
    }

    case "purchase":
    case "apollo_purchase":
      state.purchaseType = getField(block, "PURCHASE_LIST") || null;
      break;

    case "tick_analysis":
      try {
        execChain(getStatementBlock(block, "TICKANALYSIS_STACK"), state);
      } catch {
        // ignore tick-level errors
      }
      break;

    case "timeout":
      try {
        execChain(getStatementBlock(block, "TIMEOUTSTACK"), state);
      } catch {
        // ignore
      }
      break;

    case "procedures_callnoreturn": {
      const mutation = getMutation(block);
      const name = (mutation?.getAttribute("name") ?? "").toLowerCase();
      const proc = state.procs[name];
      if (proc) {
        const args = proc.params.map((_, i) => evalExpr(getValueBlock(block, `ARG${i}`), state));
        callProcedure(name, args, state);
      }
      break;
    }

    // Expression blocks that may appear in statement position — no side effects needed
    case "lists_create_with":
    case "text_join":
    case "text_append":
    case "trade_again":
    case "notify":
    case "btnotify":
    case "text_print":
    case "text_statement":
    // Procedure definitions are processed at init time via buildProcRegistry
    case "procedures_defnoreturn":
    case "procedures_defreturn":
      break;

    default:
      break;
  }
}

function buildProcRegistry(doc: Document): Record<string, ProcDef> {
  const procs: Record<string, ProcDef> = {};
  for (const defType of ["procedures_defnoreturn", "procedures_defreturn"]) {
    for (const defBlock of doc.querySelectorAll(`block[type="${defType}"]`)) {
      const name = getField(defBlock as Element, "NAME").toLowerCase();
      if (!name) continue;
      const mutation = getMutation(defBlock as Element);
      const params: string[] = [];
      if (mutation) {
        for (const arg of mutation.children) {
          if (arg.tagName === "arg") {
            const paramName = arg.getAttribute("name");
            if (paramName) params.push(paramName.toLowerCase());
          }
        }
      }
      procs[name] = {
        params,
        body: getStatementBlock(defBlock as Element, "STACK"),
        returnBlock: getValueBlock(defBlock as Element, "RETURN"),
      };
    }
  }
  return procs;
}

export function initBotState(xmlText: string): BotVarState | null {
  const doc = parseXmlDoc(xmlText);
  if (!doc) return null;

  const state: BotVarState = {
    vars: {},
    listVars: {},
    procs: buildProcRegistry(doc),
    result: null,
    totalProfit: 0,
    lastProfit: 0,
    purchaseType: null,
    tickDigits: [],
    entrySpot: null,
    exitSpot: null,
    buyPrice: null,
    payout: null,
    balance: 0,
  };

  for (const variable of doc.querySelectorAll("variables > variable")) {
    const name = (variable.textContent ?? "").trim().toLowerCase();
    if (name) state.vars[name] = 0;
  }

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
    // ignore runtime errors in after_purchase
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
    // ignore runtime errors in before_purchase
  }
}

export function runTickAnalysis(xmlText: string, state: BotVarState): void {
  const doc = parseXmlDoc(xmlText);
  if (!doc) return;
  for (const block of doc.querySelectorAll('block[type="tick_analysis"]')) {
    try {
      execChain(getStatementBlock(block as Element, "TICKANALYSIS_STACK"), state);
    } catch {
      // ignore runtime errors in tick_analysis
    }
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
