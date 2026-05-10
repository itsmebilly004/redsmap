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
  "symbol",
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
  if ("underlying_symbol" in payload) {
    throw new Error(
      `Invalid ${adapter ?? "Deriv"} proposal payload: use symbol, not underlying_symbol.`,
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

export async function requestProposal(
  payload: DerivRecord,
  context: TradeRequestContext = {},
) {
  assertNoRejectedProposalProperties(payload, context.adapter);
  console.info("[Deriv Trading] Proposal request", {
    adapter: context.adapter ?? "unknown",
    selectedAccountId: context.selectedAccountId ?? null,
    selectedAccountType: context.selectedAccountType ?? null,
    contractType: context.contractType ?? payload.contract_type ?? null,
    finalPayload: payload,
  });
  const response = await send(payload);
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
  const payload = { buy: proposalId, price };
  console.info("[Deriv Trading] Buy request", {
    adapter: context.adapter ?? "unknown",
    selectedAccountId: context.selectedAccountId ?? null,
    selectedAccountType: context.selectedAccountType ?? null,
    contractType: context.contractType ?? null,
    finalPayload: payload,
  });
  const response = await send(payload);
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
  const response = await send({ sell: contractId, price });
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

  const initial = await send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 });
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
