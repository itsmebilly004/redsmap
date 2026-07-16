import { supabase } from "@/integrations/supabase/client";
import { type DerivMessage } from "@/lib/deriv";
import { type TradeRequestContext } from "@/lib/deriv-trading-service";
import { DERIV_LEGACY_APP_ID } from "@/lib/deriv-config";

// Unauthenticated WebSocket for free API calls (proposals, ticks)
let freeWs: WebSocket | null = null;
let msgId = 1;
const pendingRequests = new Map<number, { resolve: (res: any) => void; reject: (err: any) => void }>();
const tickSubscribers = new Map<string, Set<(tick: any) => void>>();

function getFreeWs(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    if (freeWs && freeWs.readyState === WebSocket.OPEN) {
      return resolve(freeWs);
    }
    if (freeWs && freeWs.readyState === WebSocket.CONNECTING) {
      const interval = setInterval(() => {
        if (freeWs?.readyState === WebSocket.OPEN) {
          clearInterval(interval);
          resolve(freeWs);
        } else if (freeWs?.readyState === WebSocket.CLOSED) {
          clearInterval(interval);
          reject(new Error("WebSocket closed"));
        }
      }, 100);
      return;
    }

    const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_LEGACY_APP_ID || 1089}`);
    ws.onopen = () => {
      freeWs = ws;
      resolve(ws);
    };
    ws.onerror = (err) => {
      console.error("[SimulatedTrading] Free WS Error", err);
      reject(err);
    };
    ws.onclose = () => {
      freeWs = null;
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.req_id && pendingRequests.has(data.req_id)) {
          const { resolve, reject } = pendingRequests.get(data.req_id)!;
          pendingRequests.delete(data.req_id);
          if (data.error) reject(data.error);
          else resolve(data);
        }
        
        if (data.msg_type === "tick" && data.tick) {
          const symbol = data.tick.symbol;
          if (tickSubscribers.has(symbol)) {
            tickSubscribers.get(symbol)!.forEach((cb) => cb(data.tick));
          }
        }
      } catch (e) {
        console.error("Failed to parse simulated ws message", e);
      }
    };
  });
}

async function sendFreeWs(payload: Record<string, any>): Promise<any> {
  const ws = await getFreeWs();
  return new Promise((resolve, reject) => {
    const req_id = msgId++;
    pendingRequests.set(req_id, { resolve, reject });
    ws.send(JSON.stringify({ ...payload, req_id }));
  });
}

// ----------------------------------------------------------------------
// Simulated Trading API
// ----------------------------------------------------------------------

// Store proposal parameters to reconstruct the trade later
const activeProposals = new Map<string, any>();
const activeContracts = new Map<string, any>();

export async function simulatedRequestProposal(payload: Record<string, unknown>, context?: TradeRequestContext): Promise<DerivMessage> {
  const requestPayload = { ...payload };
  if ("underlying_symbol" in requestPayload) {
    requestPayload.symbol = requestPayload.underlying_symbol;
    delete requestPayload.underlying_symbol;
  }
  try {
    const response = await sendFreeWs(requestPayload);
    if (response.proposal?.id) {
      activeProposals.set(response.proposal.id, { payload, proposal: response.proposal });
    }
    return response as DerivMessage;
  } catch (error) {
    console.error("[SimulatedTrading] Request Proposal failed:", error);
    throw error;
  }
}

export async function simulatedBuyProposal(
  proposalId: string,
  price: number,
  userId: string,
  accountId: string
): Promise<DerivMessage> {
  const proposalData = activeProposals.get(proposalId);
  if (!proposalData) throw new Error("Proposal expired or invalid in simulated environment.");
  const { payload, proposal } = proposalData;

  // Deduct balance from sessions
  const { data: sessionData, error: sessionErr } = await supabase
    .from("sessions")
    .select("balance")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .single();

  if (sessionErr) throw new Error("Could not read balance for simulated trade");
  
  const currentBalance = Number(sessionData.balance ?? 0);
  if (currentBalance < price) throw new Error("Insufficient simulated balance");

  const { error: updateErr } = await supabase
    .from("sessions")
    .update({ balance: currentBalance - price })
    .eq("user_id", userId)
    .eq("account_id", accountId);

  if (updateErr) throw new Error("Could not deduct balance");

  // We do NOT insert into 'trades' table here. 
  // The UI (trade-panel / bot-runner) is responsible for syncing to Supabase, 
  // just like it does for real Deriv trades. This prevents duplicates.
  const contractId = crypto.randomUUID();

  activeContracts.set(contractId, payload);
  activeSimulatedContractsState.set(contractId, { status: "open", stake: price, payout: proposal.payout } as any);

  return {
    buy: {
      contract_id: contractId,
      buy_price: price,
      contract_type: payload.contract_type,
    },
  } as DerivMessage;
}

export const activeSimulatedContractsState = new Map<string, { status: "open" | "sold", stake: number, payout?: number, sellPrice?: number }>();

export async function simulatedSellContract(contractId: string, price: number): Promise<DerivMessage> {
  const state = activeSimulatedContractsState.get(contractId);
  if (state) {
    state.status = "sold";
    state.sellPrice = price;
    return { sell: { contract_id: Number(contractId), sold_for: price, profit: price - (state as any).stake } } as any;
  }
  throw new Error("Early sell is not supported or trade is not active.");
}

export async function simulatedSubscribeOpenContract(
  contractId: string,
  userId: string,
  accountId: string,
  onUpdate: (contract: Record<string, unknown>, message: DerivMessage) => void
): Promise<() => Promise<void>> {
  
  // We do NOT fetch the trade from 'trades' table here, because the UI inserted it with a different ID.
  // Instead, we get the state directly from activeSimulatedContractsState.
  const state = activeSimulatedContractsState.get(contractId);
  if (!state) throw new Error("Simulated trade not found in memory");

  const payload = activeContracts.get(contractId);
  if (!payload) throw new Error("Simulated trade payload not found in memory");

  const symbol = payload.underlying_symbol ?? payload.symbol ?? "";
  let isActive = true;
  let entrySpot: number | null = null;
  let startTime = Date.now() / 1000;
  
  let ticksLeft = 5; 
  let durationInSeconds = 5;
  let isTickBased = true;
  let isAccumulator = false;
  let growthRate = 0.03;
  let ticksPassed = 0;
  
  if (payload) {
    if (payload.contract_type === 'ACCU' || String(payload.contract_type).includes("ACCU")) {
      isAccumulator = true;
      isTickBased = false;
      growthRate = Number(payload.growth_rate) || 0.03;
    } else if (payload.duration_unit === 't') {
      isTickBased = true;
      ticksLeft = Number(payload.duration) || 5;
    } else {
      isTickBased = false;
      durationInSeconds = Number(payload.duration) || 5;
      if (payload.duration_unit === 'm') durationInSeconds *= 60;
      if (payload.duration_unit === 'h') durationInSeconds *= 3600;
      if (payload.duration_unit === 'd') durationInSeconds *= 86400;
    }
  }
  
  let subscriptionId: string | null = null;

  const tickCallback = async (tick: any) => {
    if (!isActive) return;
    
    const currentSpot = Number(tick.quote);
    if (entrySpot === null) {
      entrySpot = currentSpot;
      startTime = Number(tick.epoch);
    } else {
      if (isTickBased) {
        ticksLeft--;
      }
      ticksPassed++;
    }

    const state = activeSimulatedContractsState.get(contractId);
    const isManuallySold = state?.status === "sold";

    let isExpired = false;
    if (isAccumulator) {
      if (isManuallySold) isExpired = true;
      else if (ticksPassed > 0 && Math.random() < 0.02) isExpired = true; // 2% crash chance per tick
    } else {
      isExpired = isTickBased ? (ticksLeft <= 0) : ((Date.now() / 1000 - startTime) >= durationInSeconds);
      if (isManuallySold) isExpired = true;
    }

    if (isExpired) {
      isActive = false;
      
      let won = false;
      let payout = 0;
      
      if (isManuallySold) {
         won = true;
         payout = state?.sellPrice ?? (Number(state.stake) + (isAccumulator ? (Number(state.stake) * Math.pow(1 + growthRate, ticksPassed) - Number(state.stake)) : (Number(state.stake) * 0.5)));
      } else if (isAccumulator) {
         won = false;
         payout = 0;
      } else {
        const tradeType = payload.contract_type ?? "";
        if (tradeType === "CALL" || tradeType === "UPORDOWN") {
          won = currentSpot > entrySpot;
        } else if (tradeType === "PUT" || tradeType === "EXPIRYMISS") {
          won = currentSpot < entrySpot;
        } else {
          won = Math.random() > 0.5;
        }
        payout = won ? (Number(state.payout) || Number(state.stake) * 1.95) : 0;
      }

      const profit = payout - Number(state.stake);

      if (payout > 0) {
         const { data: sessionData } = await supabase
          .from("sessions")
          .select("balance")
          .eq("user_id", userId)
          .eq("account_id", accountId)
          .single();
          
         if (sessionData) {
            const { error: sessErr } = await supabase
              .from("sessions")
              .update({ balance: Number(sessionData.balance) + payout })
              .eq("user_id", userId)
              .eq("account_id", accountId);
            if (sessErr) console.error("[Simulated] Failed to update balance:", sessErr);
         }
      }

      // We do NOT update the 'trades' table here.
      // The UI (trade-panel / bot-runner) will update it when it receives the 'is_sold' event.
      // This prevents duplicates and sync issues.

      const contractState = {
        contract_id: contractId,
        is_sold: 1,
        status: won ? "won" : "lost",
        profit,
        payout,
        sell_price: payout,
        buy_price: state.stake,
        entry_spot: entrySpot,
        exit_tick: currentSpot,
        currency: "USD"
      };

      onUpdate(contractState, { proposal_open_contract: contractState } as any);
      
      if (subscriptionId) {
        await sendFreeWs({ forget: subscriptionId }).catch(()=>null);
      }
    } else {
      let profit = (currentSpot - entrySpot) > 0 ? (Number(trade.stake) * 0.5) : -(Number(trade.stake) * 0.5);
      let isValidToSell = 0;
      let bidPrice = Number(trade.stake);
      
      if (isAccumulator) {
         profit = Number(trade.stake) * Math.pow(1 + growthRate, ticksPassed) - Number(trade.stake);
         bidPrice = Number(trade.stake) + profit;
         isValidToSell = 1;
      }

      const contractState = {
        contract_id: contractId,
        is_sold: 0,
        status: "open",
        profit,
        bid_price: bidPrice,
        is_valid_to_sell: isValidToSell,
        buy_price: trade.stake,
        entry_spot: entrySpot,
        current_spot: currentSpot,
        currency: "USD"
      };
      onUpdate(contractState, { proposal_open_contract: contractState } as any);
    }
  };

  if (!tickSubscribers.has(symbol)) {
    tickSubscribers.set(symbol, new Set());
  }
  tickSubscribers.get(symbol)!.add(tickCallback);

  try {
    const res = await sendFreeWs({ ticks: symbol });
    subscriptionId = res.subscription?.id;
  } catch (e) {
    console.warn("Failed to subscribe to ticks for simulation", e);
  }

  return async () => {
    isActive = false;
    if (tickSubscribers.has(symbol)) {
      tickSubscribers.get(symbol)!.delete(tickCallback);
    }
    if (subscriptionId) {
      await sendFreeWs({ forget: subscriptionId }).catch(()=>null);
    }
  };
}
