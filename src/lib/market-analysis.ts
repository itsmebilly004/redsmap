import { fetchTicks, publicSendBatch, SYNTHETIC_MARKETS } from "@/lib/deriv";
import { BOT_PRESET_CONFIGS, type BotPresetConfig } from "@/lib/bot-presets";
import { calculateDigitStats, digitsFromPrices } from "@/lib/digit-stats";
import { TRADING_BOT_ASSETS } from "@/lib/trading-bot-database";

type TickPoint = { time: number; value: number };

type OverUnderRecommendation = {
  expected: number;
  probability: number;
  side: "over" | "under";
  threshold: number;
};

export type DigitMarketAnalysis = {
  counts: number[];
  evenPercentage: number;
  hottestDigits: number[];
  latestDigit: number | null;
  marketLabel: string;
  oddPercentage: number;
  overUnder: OverUnderRecommendation;
  percentages: number[];
  sampleSize: number;
  symbol: string;
};

export type BotOpportunity = {
  actualProbability: number;
  contractType: string;
  edge: number;
  expectedProbability: number;
  launchable: boolean;
  market: string;
  marketLabel: string;
  name: string;
  presetId: string;
  presetMartingale: number;
  presetMartingaleMode: "additive" | "multiplicative";
  presetStake: number;
  tradeType: BotPresetConfig["tradeType"];
};

export type ManualContractKind = "even_odd" | "matches_differs" | "over_under" | "rise_fall";

export type ManualMarketSuggestion = {
  detail: string;
  edge: number;
  expected: number;
  marketLabel: string;
  probability: number;
  sampleSize: number;
  side: string;
  symbol: string;
};

export type StakeRecommendation = {
  /** "additive" formula (CandleVault-style) requires using 1+m as the effective per-trade multiplier */
  effectiveMultiplier: number;
  martingale: number;
  rationale: string;
  riskBand: "aggressive" | "balanced" | "conservative";
  stake: number;
  /** Total currency at risk if the worst-case losing streak hits */
  worstCaseLoss: number;
  worstCaseLossStreak: number;
};

export type ManualStakeRecommendation = {
  rationale: string;
  riskBand: "aggressive" | "balanced" | "conservative";
  stake: number;
};

/**
 * 300 ticks gives a statistically meaningful window (~5 min on R_100, ~5 min
 * on 1HZ markets) while being noticeably faster on the wire than 500.
 */
const ANALYSIS_TICK_COUNT = 300;
/** Per-call timeout when individual symbols are fetched in isolation. */
const PUBLIC_REQUEST_TIMEOUT_MS = 10_000;
/** Per-symbol timeout inside a batched fetch — short because the WS handshake is paid once. */
const BATCH_REQUEST_TIMEOUT_MS = 9_000;

/**
 * Short-lived in-flight cache so the back-to-back "Best Bot scan → manual
 * digit heatmap" pattern doesn't open the same symbol twice. Rerun clears
 * the entry by expiry; explicit failures purge it immediately.
 */
const TICKS_CACHE_TTL_MS = 8_000;
const ticksCache = new Map<
  string,
  { expiresAt: number; promise: Promise<TickPoint[]> }
>();

function cacheTicksPromise(symbol: string, promise: Promise<TickPoint[]>) {
  ticksCache.set(symbol, { expiresAt: Date.now() + TICKS_CACHE_TTL_MS, promise });
  promise.catch(() => ticksCache.delete(symbol));
  return promise;
}

/**
 * Fetch ticks for many symbols in ONE WebSocket round-trip. This is the main
 * speed win for the AI assistant: instead of opening 10 sockets (10 × ~250ms
 * handshake), we open 1 and multiplex via req_id.
 *
 * Returns a `Map<symbol, TickPoint[]>`. Symbols whose batched request errored
 * are simply absent — callers must handle the partial-result case.
 */
export async function fetchTicksBatch(
  symbols: string[],
  count: number = ANALYSIS_TICK_COUNT,
): Promise<Map<string, TickPoint[]>> {
  const now = Date.now();
  const map = new Map<string, TickPoint[]>();
  const toFetch: string[] = [];
  const cachedPromises: { symbol: string; promise: Promise<TickPoint[]> }[] = [];

  for (const symbol of symbols) {
    const cached = ticksCache.get(symbol);
    if (cached && cached.expiresAt > now) {
      cachedPromises.push({ symbol, promise: cached.promise });
    } else {
      toFetch.push(symbol);
    }
  }

  // Resolve cached entries in parallel with the new batch
  const cacheTasks = cachedPromises.map(async ({ symbol, promise }) => {
    try {
      const ticks = await promise;
      if (ticks.length > 0) map.set(symbol, ticks);
    } catch {
      /* swallow — symbol simply absent from result map */
    }
  });

  if (toFetch.length > 0) {
    const responses = await publicSendBatch(
      toFetch.map((symbol) => ({
        ticks_history: symbol,
        style: "ticks",
        count,
        end: "latest",
        adjust_start_time: 1,
      })),
      { timeoutMs: BATCH_REQUEST_TIMEOUT_MS },
    );

    toFetch.forEach((symbol, index) => {
      const response = responses[index];
      if (response instanceof Error) {
        // Surface nothing for failed symbols; cache miss left as-is so a Rerun retries.
        return;
      }
      const history = response?.history as { prices?: unknown[]; times?: unknown[] } | undefined;
      const prices = Array.isArray(history?.prices) ? history.prices : [];
      const times = Array.isArray(history?.times) ? history.times : [];
      const ticks: TickPoint[] = prices
        .map((price, i) => ({ time: Number(times[i]), value: Number(price) }))
        .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value));
      if (ticks.length === 0) return;
      map.set(symbol, ticks);
      // Cache the resolved value so subsequent single-symbol calls (e.g. digit heatmap)
      // hit the cache instead of opening a new WS.
      cacheTicksPromise(symbol, Promise.resolve(ticks));
    });
  }

  await Promise.all(cacheTasks);
  return map;
}

/** Fetch ticks for a single symbol with the in-flight cache layered on top. */
async function fetchTicksSingle(symbol: string, count: number = ANALYSIS_TICK_COUNT) {
  const now = Date.now();
  const cached = ticksCache.get(symbol);
  if (cached && cached.expiresAt > now) return cached.promise;
  const promise = (async () => {
    // Use a tight timeout via Promise.race rather than the global 15s default.
    return await Promise.race<TickPoint[]>([
      fetchTicks(symbol, count),
      new Promise<TickPoint[]>((_, reject) =>
        setTimeout(
          () => reject(new Error("Deriv public request timed out")),
          PUBLIC_REQUEST_TIMEOUT_MS,
        ),
      ),
    ]);
  })();
  return cacheTicksPromise(symbol, promise);
}

function buildDigitAnalysis(symbol: string, ticks: TickPoint[]): DigitMarketAnalysis {
  const digits = digitsFromPrices(
    ticks.map((tick) => tick.value),
    ANALYSIS_TICK_COUNT,
  );
  const stats = calculateDigitStats(digits);
  const counts = stats.counts;
  const sampleSize = digits.length;
  const evenPercentage = sumPercentages(stats.percentages, [0, 2, 4, 6, 8]);
  const oddPercentage = sumPercentages(stats.percentages, [1, 3, 5, 7, 9]);
  const hottestValue = Math.max(...counts);
  const hottestDigits = counts
    .map((count, digit) => ({ count, digit }))
    .filter((item) => item.count === hottestValue && item.count > 0)
    .map((item) => item.digit);
  return {
    counts,
    evenPercentage,
    hottestDigits,
    latestDigit: stats.latest,
    marketLabel: marketLabelForSymbol(symbol),
    oddPercentage,
    overUnder: bestOverUnderRecommendation(counts, sampleSize),
    percentages: stats.percentages,
    sampleSize,
    symbol,
  } satisfies DigitMarketAnalysis;
}

export async function analyzeDigitsForSymbol(symbol: string) {
  const ticks = await fetchTicksSingle(symbol, ANALYSIS_TICK_COUNT);
  return buildDigitAnalysis(symbol, ticks);
}

const LAUNCHABLE_BOT_PRESET_IDS = new Set(TRADING_BOT_ASSETS.map((asset) => asset.id));

export async function analyzeBestBotOpportunities() {
  const markets = Array.from(new Set(BOT_PRESET_CONFIGS.map((preset) => preset.market)));
  // One WebSocket round-trip for ALL bot-relevant markets at once — much faster
  // than 1 socket per symbol.
  const ticksBySymbol = await fetchTicksBatch(markets, ANALYSIS_TICK_COUNT);
  const marketMap = new Map<string, DigitMarketAnalysis>();
  for (const symbol of markets) {
    const ticks = ticksBySymbol.get(symbol);
    if (!ticks || ticks.length === 0) continue;
    marketMap.set(symbol, buildDigitAnalysis(symbol, ticks));
  }
  if (marketMap.size === 0) {
    throw new Error(
      "Could not reach Deriv's market data right now. Check your connection and try again.",
    );
  }
  return BOT_PRESET_CONFIGS.map((preset) => {
    const analysis = marketMap.get(preset.market);
    if (!analysis) return null;
    const actualProbability = presetProbability(preset, analysis.counts, analysis.sampleSize);
    const expectedProbability = expectedPresetProbability(preset);
    return {
      actualProbability,
      contractType: preset.contractType,
      edge: actualProbability - expectedProbability,
      expectedProbability,
      launchable: LAUNCHABLE_BOT_PRESET_IDS.has(preset.id),
      market: preset.market,
      marketLabel: analysis.marketLabel,
      name: preset.name,
      presetId: preset.id,
      presetMartingale: preset.martingale,
      presetMartingaleMode: martingaleModeForPreset(preset),
      presetStake: preset.stake,
      tradeType: preset.tradeType,
    } satisfies BotOpportunity;
  })
    .filter((item): item is BotOpportunity => Boolean(item))
    .sort((left, right) => {
      // Launchable bots first so the AI's primary recommendation is one the user
      // can actually deploy with one tap.
      if (right.launchable !== left.launchable) return right.launchable ? 1 : -1;
      if (right.edge !== left.edge) return right.edge - left.edge;
      return right.actualProbability - left.actualProbability;
    });
}

/**
 * For a manual trader who has already chosen a contract family (Even/Odd,
 * Over/Under, Matches/Differs, Rise/Fall), scan every synthetic digit market
 * and return the markets ranked by the strongest empirical edge.
 *
 * Note: Deriv synthetic indices are RNG-driven; over a long enough horizon every
 * digit converges to 10% and every coin flip to 50%. These signals are short-term
 * statistical leans inside the most recent ~500-tick window — they are NOT a
 * guarantee. UI surface MUST present these as suggestions, not predictions.
 */
export async function analyzeBestMarketForContract(
  kind: ManualContractKind,
): Promise<ManualMarketSuggestion[]> {
  const symbols = MANUAL_ANALYZABLE_SYMBOLS;
  // One batched WebSocket round-trip for all 10 markets. Rise/Fall uses raw
  // tick prices; digit-style contracts derive digits from the same prices, so
  // both flows share the same fetch.
  const ticksBySymbol = await fetchTicksBatch(symbols, ANALYSIS_TICK_COUNT);

  if (kind === "rise_fall") {
    const results: ManualMarketSuggestion[] = [];
    for (const symbol of symbols) {
      const ticks = ticksBySymbol.get(symbol);
      if (!ticks || ticks.length < 2) continue;
      results.push(riseFallSuggestionFromTicks(symbol, ticks));
    }
    if (results.length === 0) {
      throw new Error(
        "Could not reach Deriv's market data right now. Check your connection and try again.",
      );
    }
    return results.sort((left, right) => right.edge - left.edge);
  }

  const suggestions: ManualMarketSuggestion[] = [];
  for (const symbol of symbols) {
    const ticks = ticksBySymbol.get(symbol);
    if (!ticks || ticks.length === 0) continue;
    const analysis = buildDigitAnalysis(symbol, ticks);
    if (kind === "even_odd") {
      const side =
        analysis.evenPercentage >= analysis.oddPercentage ? "Even" : "Odd";
      const probability = Math.max(analysis.evenPercentage, analysis.oddPercentage);
      suggestions.push({
        detail: `Last ${analysis.sampleSize} ticks on ${analysis.marketLabel} lean ${side.toLowerCase()} at ${probability.toFixed(1)}% (uniform expectation is 50%).`,
        edge: probability - 50,
        expected: 50,
        marketLabel: analysis.marketLabel,
        probability,
        sampleSize: analysis.sampleSize,
        side,
        symbol: analysis.symbol,
      });
    } else if (kind === "over_under") {
      const r = analysis.overUnder;
      const sideLabel = `${r.side === "over" ? "Over" : "Under"} ${r.threshold}`;
      suggestions.push({
        detail: `${sideLabel} on ${analysis.marketLabel} hit ${r.probability.toFixed(1)}% in the last ${analysis.sampleSize} ticks (uniform expectation ${r.expected.toFixed(0)}%).`,
        edge: r.probability - r.expected,
        expected: r.expected,
        marketLabel: analysis.marketLabel,
        probability: r.probability,
        sampleSize: analysis.sampleSize,
        side: sideLabel,
        symbol: analysis.symbol,
      });
    } else {
      // matches_differs — score each digit's match/differ edge and keep the best.
      const total = Math.max(analysis.sampleSize, 1);
      let bestDigit = 0;
      let bestEdge = -Infinity;
      let bestProbability = 0;
      let bestSide: "matches" | "differs" = "differs";
      let bestExpected = 90;
      for (let digit = 0; digit < 10; digit += 1) {
        const matchProb = ((analysis.counts[digit] ?? 0) / total) * 100;
        const differProb = 100 - matchProb;
        const matchEdge = matchProb - 10;
        const differEdge = differProb - 90;
        if (matchEdge > bestEdge) {
          bestEdge = matchEdge;
          bestProbability = matchProb;
          bestDigit = digit;
          bestSide = "matches";
          bestExpected = 10;
        }
        if (differEdge > bestEdge) {
          bestEdge = differEdge;
          bestProbability = differProb;
          bestDigit = digit;
          bestSide = "differs";
          bestExpected = 90;
        }
      }
      const sideLabel = `${bestSide === "matches" ? "Matches" : "Differs"} ${bestDigit}`;
      suggestions.push({
        detail: `${sideLabel} on ${analysis.marketLabel}: ${bestProbability.toFixed(1)}% in the last ${analysis.sampleSize} ticks (uniform expectation ${bestExpected}%).`,
        edge: bestEdge,
        expected: bestExpected,
        marketLabel: analysis.marketLabel,
        probability: bestProbability,
        sampleSize: analysis.sampleSize,
        side: sideLabel,
        symbol: analysis.symbol,
      });
    }
  }
  if (suggestions.length === 0) {
    throw new Error(
      "Could not reach Deriv's market data right now. Check your connection and try again.",
    );
  }
  return suggestions.sort((left, right) => right.edge - left.edge);
}

function riseFallSuggestionFromTicks(symbol: string, ticks: TickPoint[]): ManualMarketSuggestion {
  let rise = 0;
  let fall = 0;
  for (let index = 1; index < ticks.length; index += 1) {
    const previous = ticks[index - 1].value;
    const current = ticks[index].value;
    if (current > previous) rise += 1;
    else if (current < previous) fall += 1;
  }
  const total = rise + fall;
  const safeTotal = Math.max(total, 1);
  const risePercent = (rise / safeTotal) * 100;
  const fallPercent = (fall / safeTotal) * 100;
  const side = risePercent >= fallPercent ? "Rise" : "Fall";
  const probability = Math.max(risePercent, fallPercent);
  return {
    detail: `${marketLabelForSymbol(symbol)} closed ${side.toLowerCase()} on ${probability.toFixed(1)}% of the last ${safeTotal} non-flat ticks.`,
    edge: probability - 50,
    expected: 50,
    marketLabel: marketLabelForSymbol(symbol),
    probability,
    sampleSize: safeTotal,
    side,
    symbol,
  };
}

/**
 * Flat-stake sizing for manual binary contracts (no martingale recovery on losses).
 * Anchors stake at 1–3% of balance scaled by risk band; refuses to bet more than
 * one Deriv minimum if the user only has a few units of balance.
 */
export function recommendManualStake(input: {
  balance: number | null | undefined;
  edge?: number;
}): ManualStakeRecommendation {
  const balance = Math.max(0, Number(input.balance ?? 0));
  const riskBand: ManualStakeRecommendation["riskBand"] =
    balance < 50 ? "conservative" : balance < 500 ? "balanced" : "aggressive";
  const FRACTION = { conservative: 0.01, balanced: 0.02, aggressive: 0.03 } as const;
  const rawStake = balance > 0 ? balance * FRACTION[riskBand] : 0.5;
  const stake = Math.max(0.35, Math.round(rawStake * 100) / 100);
  const edge = Math.max(0, Number(input.edge ?? 0));
  const rationale =
    balance > 0
      ? `Flat ${(FRACTION[riskBand] * 100).toFixed(0)}% of your ${balance >= 100 ? balance.toFixed(0) : balance.toFixed(2)} balance (${riskBand}). ` +
        (edge > 0
          ? `Edge of ${edge.toFixed(1)}% is small — keep stake flat instead of compounding on losses.`
          : `No statistical edge detected; treat as a coin-flip and only stake what you can lose.`)
      : "Default opening stake — connect your Deriv account to size from real balance.";
  return { rationale, riskBand, stake };
}

/**
 * Size a stake and martingale so a worst-case losing streak consumes no more
 * than `riskFraction` of the account balance.
 *
 * For a multiplicative martingale with factor m, surviving N consecutive losses
 * requires capital = stake * (m^(N+1) - 1) / (m - 1). Solving for stake gives
 * the largest opening stake that fits inside the user's risk budget.
 *
 * For CandleVault-style ADDITIVE martingale (nextStake = currentStake + |lastProfit| * m),
 * the effective per-trade multiplier becomes (1 + m). Same formula applies.
 */
export function recommendStakeAndMartingale(input: {
  balance: number | null | undefined;
  presetMartingale: number;
  presetMartingaleMode?: "additive" | "multiplicative";
  presetStake: number;
  riskBand?: "aggressive" | "balanced" | "conservative";
}): StakeRecommendation {
  const balance = Math.max(0, Number(input.balance ?? 0));
  const mode = input.presetMartingaleMode ?? "multiplicative";
  const riskBand = input.riskBand ?? autoRiskBand(balance);

  const RISK_FRACTION: Record<StakeRecommendation["riskBand"], number> = {
    aggressive: 0.35,
    balanced: 0.2,
    conservative: 0.1,
  };
  const WORST_CASE_STREAK: Record<StakeRecommendation["riskBand"], number> = {
    aggressive: 4,
    balanced: 5,
    conservative: 6,
  };
  const MARTINGALE_CAP: Record<StakeRecommendation["riskBand"], number> = {
    aggressive: 2.3,
    balanced: 2.0,
    conservative: 1.8,
  };

  // Honour the preset's martingale shape but never exceed the risk-band cap.
  // Additive bots like CandleVault declare a much larger nominal martingale
  // (e.g. 11) because the math is different — keep their config as-is and let
  // the effectiveMultiplier handle the capital math.
  const martingale =
    mode === "additive"
      ? input.presetMartingale
      : clamp(input.presetMartingale, 1.5, MARTINGALE_CAP[riskBand]);
  const effectiveMultiplier = mode === "additive" ? 1 + martingale : martingale;

  const streak = WORST_CASE_STREAK[riskBand];
  const riskBudget = Math.max(balance * RISK_FRACTION[riskBand], 0.35);
  const tradesInStreak = streak + 1;

  let stake: number;
  if (Math.abs(effectiveMultiplier - 1) < 1e-6) {
    stake = riskBudget / tradesInStreak;
  } else {
    stake =
      (riskBudget * (effectiveMultiplier - 1)) /
      (Math.pow(effectiveMultiplier, tradesInStreak) - 1);
  }

  // Floor at Deriv's minimum stake, cap at 5% of balance per opening trade so
  // the first trade alone never burns through a large slice of the account.
  const stakeCap = balance > 0 ? Math.max(balance * 0.05, 0.35) : input.presetStake;
  stake = clamp(roundTo(stake, 2), 0.35, Math.max(stakeCap, 0.35));

  const worstCaseLoss = capitalForStreak(stake, effectiveMultiplier, streak);

  const balanceLabel = balance > 0 ? `${formatBalance(balance)}` : "your balance";
  const rationale =
    `Sized for a ${riskBand} risk band: limits worst-case exposure across ${streak} consecutive losses ` +
    `to roughly ${roundTo(worstCaseLoss, 2)} (≈${roundTo((worstCaseLoss / Math.max(balance, 1)) * 100, 1)}% of ${balanceLabel}).`;

  return {
    effectiveMultiplier,
    martingale: roundTo(martingale, 2),
    rationale,
    riskBand,
    stake,
    worstCaseLoss: roundTo(worstCaseLoss, 2),
    worstCaseLossStreak: streak,
  };
}

function martingaleModeForPreset(preset: BotPresetConfig): "additive" | "multiplicative" {
  // CandleVault uses an ADDITIVE martingale (math_change in XML). Heuristic: a
  // declared martingale ≥ 3 on a digit contract almost always means additive,
  // since a 3× multiplicative streak blows up too quickly to be a real strategy.
  if (preset.id === "candle-mine") return "additive";
  if (preset.tradeType === "matches_differs" && preset.martingale >= 3) return "additive";
  return "multiplicative";
}

function autoRiskBand(balance: number): StakeRecommendation["riskBand"] {
  if (balance < 50) return "conservative";
  if (balance < 500) return "balanced";
  return "aggressive";
}

function capitalForStreak(stake: number, multiplier: number, streak: number): number {
  const trades = streak + 1;
  if (Math.abs(multiplier - 1) < 1e-6) return stake * trades;
  return (stake * (Math.pow(multiplier, trades) - 1)) / (multiplier - 1);
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals: number) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function formatBalance(balance: number): string {
  return balance >= 100 ? balance.toFixed(0) : balance.toFixed(2);
}

const MANUAL_ANALYZABLE_SYMBOLS = [
  "R_10",
  "R_25",
  "R_50",
  "R_75",
  "R_100",
  "1HZ10V",
  "1HZ25V",
  "1HZ50V",
  "1HZ75V",
  "1HZ100V",
];

function bestOverUnderRecommendation(counts: number[], total: number): OverUnderRecommendation {
  const safeTotal = Math.max(total, 1);
  const candidates: OverUnderRecommendation[] = [];
  for (let threshold = 1; threshold <= 8; threshold += 1) {
    const underCount = counts.slice(0, threshold).reduce((sum, count) => sum + count, 0);
    const overCount = counts.slice(threshold + 1).reduce((sum, count) => sum + count, 0);
    candidates.push({
      expected: threshold * 10,
      probability: (underCount / safeTotal) * 100,
      side: "under",
      threshold,
    });
    candidates.push({
      expected: ((9 - threshold) / 10) * 100,
      probability: (overCount / safeTotal) * 100,
      side: "over",
      threshold,
    });
  }
  return candidates.sort((left, right) => {
    const leftEdge = left.probability - left.expected;
    const rightEdge = right.probability - right.expected;
    if (rightEdge !== leftEdge) return rightEdge - leftEdge;
    return right.probability - left.probability;
  })[0];
}

function presetProbability(preset: BotPresetConfig, counts: number[], total: number) {
  const safeTotal = Math.max(total, 1);
  if (preset.tradeType === "rise_fall") return 50;
  if (preset.tradeType === "even_odd") {
    const odd = counts[1] + counts[3] + counts[5] + counts[7] + counts[9];
    const even = counts[0] + counts[2] + counts[4] + counts[6] + counts[8];
    const wins = preset.contractType === "odd" ? odd : even;
    return (wins / safeTotal) * 100;
  }
  if (preset.tradeType === "matches_differs") {
    const digitCount = counts[preset.predictionDigit] ?? 0;
    const wins =
      preset.contractType === "matches" ? digitCount : safeTotal - digitCount;
    return (wins / safeTotal) * 100;
  }
  if (preset.contractType === "under") {
    const wins = counts.slice(0, preset.predictionDigit).reduce((sum, count) => sum + count, 0);
    return (wins / safeTotal) * 100;
  }
  const wins = counts
    .slice(Math.min(9, preset.predictionDigit + 1))
    .reduce((sum, count) => sum + count, 0);
  return (wins / safeTotal) * 100;
}

function expectedPresetProbability(preset: BotPresetConfig) {
  if (preset.tradeType === "rise_fall") return 50;
  if (preset.tradeType === "even_odd") return 50;
  if (preset.tradeType === "matches_differs") {
    return preset.contractType === "matches" ? 10 : 90;
  }
  if (preset.contractType === "under") return preset.predictionDigit * 10;
  return ((9 - preset.predictionDigit) / 10) * 100;
}

function marketLabelForSymbol(symbol: string) {
  return SYNTHETIC_MARKETS.find((market) => market.symbol === symbol)?.name ?? symbol;
}

function sumPercentages(percentages: number[], digits: number[]) {
  return digits.reduce((sum, digit) => sum + (percentages[digit] ?? 0), 0);
}
