import { action, computed, makeObservable, observable } from "mobx";
import { api_base } from "@/external/bot-skeleton/services/api/api-base";
import type RootStore from "./root-store";

export type TransactionRecord = {
  id: string;
  contract_id: string;
  contract_type: string;
  buy_price: number;
  sell_price: number;
  profit: number;
  status: "open" | "won" | "lost";
  timestamp: number;
};

export type TransactionStats = {
  total_runs: number;
  total_stake: number;
  total_payout: number;
  total_profit: number;
  won_contracts: number;
  lost_contracts: number;
};

export default class TransactionsStore {
  root_store: RootStore;
  elements: Record<string, TransactionRecord[]> = {};
  disposeReactionsFn: () => void = () => {};

  constructor(root_store: RootStore) {
    makeObservable(this, {
      elements: observable,
      transactions: computed,
      statistics: computed,
      onBotContractEvent: action.bound,
      pushTransaction: action.bound,
      clear: action.bound,
    });
    this.root_store = root_store;
  }

  get transactions(): TransactionRecord[] {
    const account_id = api_base.account_id || "guest";
    return this.elements[account_id] ?? [];
  }

  get statistics(): TransactionStats {
    const txns = this.transactions;
    return {
      total_runs: txns.length,
      total_stake: txns.reduce((sum, t) => sum + t.buy_price, 0),
      total_payout: txns.reduce((sum, t) => sum + t.sell_price, 0),
      total_profit: txns.reduce((sum, t) => sum + t.profit, 0),
      won_contracts: txns.filter((t) => t.status === "won").length,
      lost_contracts: txns.filter((t) => t.status === "lost").length,
    };
  }

  onBotContractEvent(data: Record<string, unknown>) {
    if (!data || !data.contract_id) return;
    const contract_id = String(data.contract_id);
    const account_id = api_base.account_id || "guest";
    if (!this.elements[account_id]) this.elements[account_id] = [];

    const existing = this.elements[account_id].find((t) => t.contract_id === contract_id);
    if (existing) {
      const is_sold =
        data.is_sold === 1 || data.is_sold === true || data.status === "won" || data.status === "lost";
      if (is_sold) {
        const buy_price = Number(data.buy_price ?? existing.buy_price);
        const sell_price = Number(data.sell_price ?? 0);
        existing.sell_price = sell_price;
        existing.profit = sell_price - buy_price;
        existing.status = String(data.status ?? "").toLowerCase() === "won" ? "won" : "lost";
      }
    } else {
      this.pushTransaction(data);
    }
  }

  pushTransaction(data: Record<string, unknown>) {
    const account_id = api_base.account_id || "guest";
    if (!this.elements[account_id]) this.elements[account_id] = [];
    this.elements[account_id].unshift({
      id: String(data.id ?? crypto.randomUUID()),
      contract_id: String(data.contract_id ?? ""),
      contract_type: String(data.contract_type ?? ""),
      buy_price: Number(data.buy_price ?? 0),
      sell_price: Number(data.sell_price ?? 0),
      profit: Number(data.profit ?? 0),
      status: "open",
      timestamp: Date.now(),
    });
    if (this.elements[account_id].length > 500) {
      this.elements[account_id].splice(500);
    }
  }

  clear() {
    const account_id = api_base.account_id || "guest";
    this.elements[account_id] = [];
  }
}
