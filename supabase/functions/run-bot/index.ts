// Supabase Edge Function: run-bot
// Executes a trading bot server-side using the user's stored Deriv token.
// Continues running even after the user closes their browser.
// Self-chains every ~110 seconds to survive Supabase's execution time limits.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DERIV_APP_ID = Deno.env.get("DERIV_APP_ID") ?? "133647";
const DERIV_WS_URL = `wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`;
const MAX_RUNTIME_MS = 110_000;

interface BotSettings {
  symbol: string;
  currency: string;
  tradeType: string;
  digitContract?: string;
  purchaseDirection: string;
  selectedDigit: number;
  duration: number;
  durationUnit: string;
  stake: number;
  martingale: number;
  maxStake: number;
  stopLoss: number;
  takeProfit: number;
  maxRuns: number;
  restartBuySellOnError?: boolean;
}

function buildContractInfo(s: BotSettings): { contractType: string; barrier: string | null } {
  if (s.tradeType === "digits") {
    const dc = s.digitContract ?? "over_under";
    const dir = s.purchaseDirection;
    if (dc === "over_under") {
      return { contractType: dir === "over" ? "DIGITOVER" : "DIGITUNDER", barrier: String(s.selectedDigit) };
    }
    if (dc === "matches_differs") {
      return { contractType: dir === "matches" ? "DIGITMATCH" : "DIGITDIFF", barrier: String(s.selectedDigit) };
    }
    if (dc === "even_odd") {
      return { contractType: dir === "even" ? "DIGITEVEN" : "DIGITODD", barrier: null };
    }
  }
  if (s.tradeType === "rise_fall") {
    const dir = s.purchaseDirection;
    return { contractType: (dir === "rise" || dir === "up") ? "CALL" : "PUT", barrier: null };
  }
  if (s.tradeType === "higher_lower") {
    const dir = s.purchaseDirection;
    return { contractType: dir === "higher" ? "CALL" : "PUT", barrier: "+0.10" };
  }
  return { contractType: "CALL", barrier: null };
}

// Minimal async Deriv WebSocket client
class DerivClient {
  ws: WebSocket;
  private reqId = 1;
  private pending = new Map<number, { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void }>();
  private listeners: Array<(msg: Record<string, unknown>) => void> = [];
  readonly ready: Promise<void>;

  constructor(url: string) {
    const ws = new WebSocket(url);
    this.ws = ws;
    this.ready = new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("Deriv WS connection failed"));
    });
    ws.onmessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data as string) as Record<string, unknown>;
        for (const fn of this.listeners) {
          try { fn(msg); } catch { /* ignore */ }
        }
        const id = msg.req_id as number | undefined;
        if (id !== undefined && this.pending.has(id)) {
          const handler = this.pending.get(id)!;
          this.pending.delete(id);
          const err = msg.error as Record<string, unknown> | undefined;
          if (err) handler.reject(new Error((err.message as string) ?? JSON.stringify(err)));
          else handler.resolve(msg);
        }
      } catch { /* ignore parse errors */ }
    };
  }

  send(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = this.reqId++;
    return this.ready.then(
      () =>
        new Promise((resolve, reject) => {
          this.pending.set(id, { resolve, reject });
          this.ws.send(JSON.stringify({ ...payload, req_id: id }));
        }),
    );
  }

  listen(fn: (msg: Record<string, unknown>) => void): () => void {
    this.listeners.push(fn);
    return () => {
      const i = this.listeners.indexOf(fn);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  close() {
    try { this.ws.close(); } catch { /* ignore */ }
  }
}

// Queues incoming ticks so the trade loop can await them one at a time
class TickQueue {
  private queue: Array<{ quote: number; epoch: number }> = [];
  private waiter: {
    resolve: (v: { quote: number; epoch: number }) => void;
    reject: (e: Error) => void;
    timer: number;
  } | null = null;
  private subId = "";
  private removeListener: (() => void) | null = null;

  constructor(private client: DerivClient, private symbol: string) {}

  async start(): Promise<void> {
    this.removeListener = this.client.listen((msg) => {
      if (msg.msg_type !== "tick") return;
      const tick = msg.tick as Record<string, unknown> | undefined;
      if (!tick || tick.symbol !== this.symbol) return;
      const item = { quote: Number(tick.quote), epoch: Number(tick.epoch) };
      if (this.waiter) {
        clearTimeout(this.waiter.timer);
        const w = this.waiter;
        this.waiter = null;
        w.resolve(item);
      } else {
        this.queue.push(item);
        if (this.queue.length > 3) this.queue.splice(0, this.queue.length - 3);
      }
    });

    const resp = await this.client.send({ ticks: this.symbol, subscribe: 1 });
    const sub = resp.subscription as Record<string, unknown> | undefined;
    if (sub?.id) this.subId = sub.id as string;
    const initialTick = resp.tick as Record<string, unknown> | undefined;
    if (initialTick?.symbol === this.symbol) {
      this.queue.push({ quote: Number(initialTick.quote), epoch: Number(initialTick.epoch) });
    }
  }

  next(timeoutMs = 30_000): Promise<{ quote: number; epoch: number }> {
    if (this.queue.length > 0) return Promise.resolve(this.queue.shift()!);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.waiter?.resolve === resolve) this.waiter = null;
        reject(new Error("Tick timeout after 30s"));
      }, timeoutMs) as unknown as number;
      this.waiter = { resolve, reject, timer };
    });
  }

  async stop(): Promise<void> {
    this.removeListener?.();
    this.removeListener = null;
    if (this.subId) {
      await this.client.send({ forget: this.subId }).catch(() => {});
      this.subId = "";
    }
    if (this.waiter) {
      clearTimeout(this.waiter.timer);
      this.waiter.reject(new Error("Tick queue stopped"));
      this.waiter = null;
    }
  }
}

function waitSettlement(
  client: DerivClient,
  contractId: number,
  timeoutMs = 60_000,
): Promise<{ status: "won" | "lost"; profit: number; payout: number }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let subId = "";
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Settlement timeout"));
    }, timeoutMs);

    const cleanup = () => {
      removeListener();
      if (subId) client.send({ forget: subId }).catch(() => {});
    };

    const removeListener = client.listen((msg) => {
      if (settled) return;
      const poc = msg.proposal_open_contract as Record<string, unknown> | undefined;
      if (!poc || Number(poc.contract_id) !== contractId) return;
      const st = poc.status as string;
      if (st === "won" || st === "lost") {
        settled = true;
        clearTimeout(timer);
        cleanup();
        resolve({ status: st, profit: Number(poc.profit ?? 0), payout: Number(poc.payout ?? 0) });
      }
    });

    client
      .send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 })
      .then((resp) => {
        const poc = resp.proposal_open_contract as Record<string, unknown> | undefined;
        const sub = resp.subscription as Record<string, unknown> | undefined;
        if (sub?.id) subId = sub.id as string;
        if (poc) {
          const st = poc.status as string;
          if ((st === "won" || st === "lost") && !settled) {
            settled = true;
            clearTimeout(timer);
            cleanup();
            resolve({ status: st, profit: Number(poc.profit ?? 0), payout: Number(poc.payout ?? 0) });
          }
        }
      })
      .catch((err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          cleanup();
          reject(err as Error);
        }
      });
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Parse session ID from request body (supports application/json and text/plain from sendBeacon)
  let sessionId: string;
  try {
    const raw = await req.text();
    const body = JSON.parse(raw) as Record<string, unknown>;
    sessionId = body.sessionId as string;
    if (!sessionId) throw new Error("sessionId required");
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 400 });
  }

  // Acquire distributed lock — prevents concurrent runners on the same session
  const runnerId = crypto.randomUUID();
  const { data: lockAcquired } = await db.rpc("acquire_bot_session_lock", {
    p_session_id: sessionId,
    p_runner_id: runnerId,
    p_lock_timeout_seconds: 30,
  });

  if (!lockAcquired) {
    return Response.json({ ok: true, message: "Another runner is active for this session" });
  }

  // Load session
  const { data: session, error: sessionErr } = await db
    .from("active_bot_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status === "stopped" || session.status === "error") {
    await db
      .from("active_bot_sessions")
      .update({ runner_id: null, runner_locked_at: null })
      .eq("id", sessionId);
    return Response.json({ ok: true, message: "Session already terminated" });
  }

  // Get the user's active Deriv token for the specified account
  const { data: derivSession } = await db
    .from("sessions")
    .select("deriv_token, is_demo")
    .eq("user_id", session.user_id)
    .eq("account_id", session.account_id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!derivSession?.deriv_token) {
    await db.from("active_bot_sessions").update({
      status: "error",
      error_message: "No active Deriv session found for this account. Please reconnect.",
      stopped_at: new Date().toISOString(),
      runner_id: null,
      runner_locked_at: null,
    }).eq("id", sessionId);
    return Response.json({ error: "No active Deriv session" }, { status: 400 });
  }

  // Mark session as server-running
  await db.from("active_bot_sessions").update({ status: "running" }).eq("id", sessionId);

  const settings = session.settings as BotSettings;
  const { contractType, barrier } = buildContractInfo(settings);
  const tpThreshold = Math.abs(Number(settings.takeProfit) || 0);
  const slThreshold = Math.abs(Number(settings.stopLoss) || 0);
  const runCap = Math.max(1, Math.round(Number(settings.maxRuns) || 10_000));
  const allowRestart = settings.restartBuySellOnError !== false;

  let runningProfit = Number(session.running_profit) || 0;
  let currentStake = Number(session.current_stake) > 0 ? Number(session.current_stake) : Number(settings.stake);
  let completedRuns = Number(session.completed_runs) || 0;
  let stopReason: string | null = null;

  const client = new DerivClient(DERIV_WS_URL);
  const tickQueue = new TickQueue(client, settings.symbol);

  const finalizeSession = async (finalStatus: string, reason: string | null, errMsg?: string) => {
    await tickQueue.stop().catch(() => {});
    client.close();
    await db.from("active_bot_sessions").update({
      status: finalStatus,
      running_profit: runningProfit,
      current_stake: currentStake,
      completed_runs: completedRuns,
      stop_reason: reason,
      error_message: errMsg ?? null,
      stopped_at: finalStatus !== "running" ? new Date().toISOString() : null,
      runner_id: null,
      runner_locked_at: null,
    }).eq("id", sessionId);
  };

  try {
    await client.ready;

    // Authorize with the user's Deriv token
    const authResp = await client.send({ authorize: derivSession.deriv_token });
    if (authResp.error) throw new Error(`Deriv authorization failed: ${(authResp.error as Record<string, unknown>).message}`);

    await tickQueue.start();

    const startTime = Date.now();
    let stopCheckCounter = 0;

    while (completedRuns < runCap) {
      // Self-chain: save state, release lock, re-invoke before the 150s Supabase limit
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        await finalizeSession("running", null); // keep running — new invocation picks it up
        // @ts-ignore — EdgeRuntime is available in Supabase Edge Functions
        EdgeRuntime.waitUntil(
          fetch(`${SUPABASE_URL}/functions/v1/run-bot`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SERVICE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ sessionId }),
          }).catch(() => {}),
        );
        return Response.json({ ok: true, chained: true });
      }

      // Poll for manual stop and refresh heartbeat every 5 trades
      stopCheckCounter++;
      if (stopCheckCounter >= 5) {
        stopCheckCounter = 0;
        const { data: check } = await db
          .from("active_bot_sessions")
          .select("status, runner_id")
          .eq("id", sessionId)
          .single();

        if (!check || check.status === "stopped" || check.runner_id !== runnerId) {
          stopReason = "manual";
          break;
        }
        await db
          .from("active_bot_sessions")
          .update({ last_heartbeat_at: new Date().toISOString() })
          .eq("id", sessionId);
      }

      // Wait for next tick before placing the trade
      await tickQueue.next(30_000);

      // Build proposal payload
      const proposalPayload: Record<string, unknown> = {
        proposal: 1,
        amount: currentStake,
        basis: "stake",
        contract_type: contractType,
        currency: settings.currency,
        underlying_symbol: settings.symbol,
        duration: settings.duration,
        duration_unit: settings.durationUnit,
      };
      if (barrier !== null) proposalPayload.barrier = barrier;

      let proposal: Record<string, unknown>;
      try {
        proposal = await client.send(proposalPayload);
        const p = proposal.proposal as Record<string, unknown> | undefined;
        if (!p?.id) continue;
      } catch {
        if (allowRestart) continue;
        throw new Error("Proposal request failed");
      }

      const proposalData = proposal.proposal as Record<string, unknown>;

      // Buy the contract
      let buyResp: Record<string, unknown>;
      try {
        buyResp = await client.send({ buy: proposalData.id, price: proposalData.ask_price });
        const buy = buyResp.buy as Record<string, unknown> | undefined;
        if (!buy?.contract_id) continue;
      } catch {
        if (allowRestart) continue;
        throw new Error("Buy request failed");
      }

      const contractId = Number((buyResp.buy as Record<string, unknown>).contract_id);

      // Wait for settlement
      let settlement: { status: "won" | "lost"; profit: number; payout: number };
      try {
        settlement = await waitSettlement(client, contractId, 60_000);
      } catch {
        // Settlement timeout — skip this trade and continue
        continue;
      }

      runningProfit += settlement.profit;
      completedRuns += 1;

      // Apply martingale stake adjustment
      if (settlement.status === "lost") {
        currentStake = Math.max(Math.min(currentStake * settings.martingale, settings.maxStake), 0.35);
      } else {
        currentStake = Number(settings.stake);
      }

      // Update session after each trade — Supabase Realtime pushes this to the client UI
      await db.from("active_bot_sessions").update({
        running_profit: runningProfit,
        current_stake: currentStake,
        completed_runs: completedRuns,
        last_heartbeat_at: new Date().toISOString(),
      }).eq("id", sessionId);

      // Enforce stop-loss and take-profit
      if (tpThreshold > 0 && runningProfit >= tpThreshold) {
        stopReason = "take_profit";
        break;
      }
      if (slThreshold > 0 && runningProfit <= -slThreshold) {
        stopReason = "stop_loss";
        break;
      }
    }

    if (!stopReason && completedRuns >= runCap) stopReason = "max_runs";

    await finalizeSession("stopped", stopReason);
    return Response.json({ ok: true, stopReason, completedRuns, runningProfit });
  } catch (err) {
    await finalizeSession("error", null, String(err));
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
