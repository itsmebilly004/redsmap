import { action, computed, makeObservable, observable } from "mobx";
import type RootStore from "./root-store";

export default class SummaryCardStore {
  root_store: RootStore;
  contract_info: Record<string, unknown> | null = null;
  is_contract_loading = false;
  disposeReactionsFn: () => void = () => {};

  constructor(root_store: RootStore) {
    makeObservable(this, {
      contract_info: observable,
      is_contract_loading: observable,
      is_multiplier: computed,
      onBotContractEvent: action.bound,
      clear: action.bound,
      clearContractUpdateConfigValues: action.bound,
    });
    this.root_store = root_store;
  }

  get is_multiplier(): boolean {
    const contract_type = String(this.contract_info?.contract_type ?? "");
    return contract_type.includes("MULT");
  }

  onBotContractEvent(data: Record<string, unknown>) {
    this.contract_info = { ...(this.contract_info ?? {}), ...data };
  }

  clear() {
    this.contract_info = null;
    this.is_contract_loading = false;
  }

  clearContractUpdateConfigValues() {
    // stub: multiplier/accumulator stop-loss config reset — not needed for visual-only
  }
}
