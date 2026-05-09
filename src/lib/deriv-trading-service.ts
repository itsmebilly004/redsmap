import {
  forgetSubscription,
  getTradingSocketAccountId,
  onMessage,
  send,
  type DerivMessage,
} from "@/lib/deriv";

type DerivRecord = Record<string, unknown>;

export async function requestProposal(payload: DerivRecord) {
  console.info("[Deriv Trading] Proposal payload", payload);
  const response = await send(payload);
  if (!response.proposal?.id) {
    throw new Error("Deriv did not return a proposal id.");
  }
  return response;
}

export async function buyProposal(proposalId: string, price: number) {
  const response = await send({ buy: proposalId, price });
  console.info("[Deriv Trading] Buy response", response.buy);
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
