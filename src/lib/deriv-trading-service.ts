import {
  forgetSubscription,
  getTradingSocketAccountId,
  onMessage,
  send,
  type DerivMessage,
  type TradingAdapter,
} from "@/lib/deriv";

type DerivRecord = Record<string, unknown>;

const PROPOSAL_ALLOWED_KEYS = new Set([
  "proposal",
  "amount",
  "basis",
  "contract_type",
  "currency",
  "underlying_symbol",
  "duration",
  "duration_unit",
  "barrier",
  "multiplier",
  "limit_order",
  "growth_rate",
]);

export type TradeRequestContext = {
  adapter?: TradingAdapter;
  selectedAccountId?: string | null;
  selectedAccountType?: string | null;
  contractType?: string | null;
};

function assertNoRejectedProposalProperties(payload: DerivRecord, adapter?: TradingAdapter) {
  if ("symbol" in payload) {
    throw new Error(
      `Invalid ${adapter ?? "Deriv"} proposal payload: use underlying_symbol, not symbol.`,
    );
  }
  if (payload.proposal === 1) {
    for (const key of Object.keys(payload)) {
      if (!PROPOSAL_ALLOWED_KEYS.has(key)) {
        throw new Error(
          `Invalid ${adapter ?? "Deriv"} proposal payload: unsupported property ${key}.`,
        );
      }
    }
  }
}

export async function requestProposal(payload: DerivRecord, context: TradeRequestContext = {}) {
  assertNoRejectedProposalProperties(payload, context.adapter);
  console.info("[Deriv Trading] Proposal request", {
    adapter: context.adapter ?? "unknown",
    selectedAccountId: context.selectedAccountId ?? null,
    selectedAccountType: context.selectedAccountType ?? null,
    contractType: context.contractType ?? payload.contract_type ?? null,
    finalPayload: payload,
  });
  let response: DerivMessage;
  try {
    response = await send(payload);
  } catch (error) {
    console.warn("[Deriv Trading] Proposal request failed", {
      adapter: context.adapter ?? "unknown",
      selectedAccountId: context.selectedAccountId ?? null,
      selectedAccountType: context.selectedAccountType ?? null,
      contractType: context.contractType ?? payload.contract_type ?? null,
      failureReason: error instanceof Error ? error.message : String(error),
      error,
    });
    throw error;
  }
  if (!response.proposal?.id) {
    throw new Error("Deriv did not return a proposal id.");
  }
  return response;
}

export async function buyProposal(
  proposalId: string,
  price: number,
  context: TradeRequestContext = {},
) {
  if (!proposalId.trim()) {
    throw new Error("Deriv did not return a valid proposal id.");
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Deriv did not return a valid proposal price.");
  }
  const payload = { buy: proposalId, price };
  console.info("[Deriv Trading] Buy request", {
    adapter: context.adapter ?? "unknown",
    selectedAccountId: context.selectedAccountId ?? null,
    selectedAccountType: context.selectedAccountType ?? null,
    contractType: context.contractType ?? null,
    finalPayload: payload,
  });
  let response: DerivMessage;
  try {
    response = await send(payload);
  } catch (error) {
    console.warn("[Deriv Trading] Buy request failed", {
      adapter: context.adapter ?? "unknown",
      selectedAccountId: context.selectedAccountId ?? null,
      selectedAccountType: context.selectedAccountType ?? null,
      contractType: context.contractType ?? null,
      failureReason: error instanceof Error ? error.message : String(error),
      error,
    });
    throw error;
  }
  console.info("[Deriv Trading] Buy response", {
    adapter: context.adapter ?? "unknown",
    selectedAccountId: context.selectedAccountId ?? null,
    selectedAccountType: context.selectedAccountType ?? null,
    contractType: context.contractType ?? null,
    buy: response.buy,
  });
  if (!response.buy?.contract_id) {
    throw new Error("Deriv did not return a contract id.");
  }
  return response;
}

export async function sellContract(contractId: string, price: number) {
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("No valid sell price is available for this contract.");
  }
  let response: DerivMessage;
  try {
    response = await send({ sell: contractId, price });
  } catch (error) {
    console.warn("[Deriv Trading] Sell request failed", {
      contractId,
      failureReason: error instanceof Error ? error.message : String(error),
      error,
    });
    throw error;
  }
  console.info("[Deriv Trading] Sell response", response.sell);
  return response;
}

export async function subscribeOpenContract(
  contractId: string,
  onUpdate: (contract: DerivRecord, message: DerivMessage) => void,
) {
  let active = true;
  let subscriptionId: string | null = null;

  const off = onMessage((message) => {
    if (!active || message.msg_type !== "proposal_open_contract") return;
    const contract = message.proposal_open_contract;
    if (!contract) return;
    const messageContractId = String(contract.contract_id ?? "");
    if (messageContractId && messageContractId !== contractId) return;
    onUpdate(contract, message);
  });

  let initial: DerivMessage;
  try {
    initial = await send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 });
  } catch (error) {
    console.warn("[Deriv Trading] proposal_open_contract subscribe failed", {
      contractId,
      failureReason: error instanceof Error ? error.message : String(error),
      error,
    });
    throw error;
  }
  subscriptionId = String(initial.subscription?.id ?? "");
  if (initial.proposal_open_contract) {
    onUpdate(initial.proposal_open_contract, initial);
  }
  console.info("[Deriv Trading] proposal_open_contract subscribed", {
    contractId,
    subscriptionId,
    websocketAccountId: getTradingSocketAccountId(),
  });

  return async () => {
    if (!active) return;
    active = false;
    off();
    if (subscriptionId) {
      await forgetSubscription(subscriptionId);
    }
  };
}
