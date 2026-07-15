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
  const response = await sendFreeWs(payload);
  if (response.proposal?.id) {
    activeProposals.set(response.proposal.id, payload);
  }
  return response as DerivMessage;
}

export async function simulatedBuyProposal(
  proposalId: string,
  price: number,
  userId: string,
  accountId: string
): Promise<DerivMessage> {
  const payload = activeProposals.get(proposalId);
  if (!payload) throw new Error("Proposal expired or invalid in simulated environment.");

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

  // Create trade in trades table
  const contractId = crypto.randomUUID();
  const { error: tradeErr } = await supabase
    .from("trades")
    .insert({
      id: contractId,
      user_id: userId,
      stake: price,
      symbol: payload.underlying_symbol ?? payload.symbol ?? "",
      trade_type: payload.contract_type ?? "",
      status: "open",
    });

  if (tradeErr) throw new Error("Could not create simulated trade record");

  activeContracts.set(contractId, payload);

  return {
    buy: {
      contract_id: contractId,
      buy_price: price,
      contract_type: payload.contract_type,
    },
  } as DerivMessage;
}

export async function simulatedSellContract(contractId: string, price: number): Promise<DerivMessage> {
  throw new Error("Early sell is not supported in the simulated environment.");
}

export async function simulatedSubscribeOpenContract(
  contractId: string,
  userId: string,
  accountId: string,
  onUpdate: (contract: Record<string, unknown>, message: DerivMessage) => void
): Promise<() => Promise<void>> {
  
  const { data: trade } = await supabase.from("trades").select("*").eq("id", contractId).single();
  if (!trade) throw new Error("Simulated trade not found");

  const symbol = trade.symbol;
  let isActive = true;
  let entrySpot: number | null = null;
  let startTime = Date.now() / 1000;
  
  // Default duration for simulation if we can't parse it
  let ticksLeft = 5; 
  let durationInSeconds = 5;
  let isTickBased = true;
  
  const payload = activeContracts.get(contractId);
  if (payload) {
    if (payload.duration_unit === 't') {
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
    }

    const isExpired = isTickBased ? (ticksLeft <= 0) : ((Date.now() / 1000 - startTime) >= durationInSeconds);

    if (isExpired) {
      isActive = false;
      
      let won = false;
      if (trade.trade_type === "CALL" || trade.trade_type === "UPORDOWN") {
        won = currentSpot > entrySpot;
      } else if (trade.trade_type === "PUT" || trade.trade_type === "EXPIRYMISS") {
        won = currentSpot < entrySpot;
      } else {
        won = Math.random() > 0.5;
      }

      const payout = won ? Number(trade.stake) * 1.95 : 0; // Simulated 95% payout
      const profit = payout - Number(trade.stake);

      // Update balance if won
      if (won) {
         const { data: sessionData } = await supabase
          .from("sessions")
          .select("balance")
          .eq("user_id", userId)
          .eq("account_id", accountId)
          .single();
          
         if (sessionData) {
            await supabase
              .from("sessions")
              .update({ balance: Number(sessionData.balance) + payout })
              .eq("user_id", userId)
              .eq("account_id", accountId);
         }
      }

      // Update trade
      await supabase
        .from("trades")
        .update({
          status: won ? "won" : "lost",
          profit_loss: profit,
          payout: payout,
          exit_spot: currentSpot,
          closed_at: new Date().toISOString()
        })
        .eq("id", contractId);

      // Emit final status
      const contractState = {
        contract_id: contractId,
        is_sold: 1,
        status: won ? "won" : "lost",
        profit,
        payout,
        sell_price: payout,
        buy_price: trade.stake,
        entry_spot: entrySpot,
        exit_tick: currentSpot,
        currency: "USD"
      };

      onUpdate(contractState, { proposal_open_contract: contractState } as any);
      
      if (subscriptionId) {
        await sendFreeWs({ forget: subscriptionId }).catch(()=>null);
      }
    } else {
      // Emit active status
      const profit = (currentSpot - entrySpot) > 0 ? (trade.stake * 0.5) : -(trade.stake * 0.5); // fake unrealized profit
      const contractState = {
        contract_id: contractId,
        is_sold: 0,
        status: "open",
        profit,
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
