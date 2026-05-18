import { action, computed, makeObservable, observable } from "mobx";
import { observer as globalObserver } from "@/external/bot-skeleton/utils/observer";
import type RootStore from "./root-store";

export const CONTRACT_STAGES = {
  NOT_RUNNING: 0,
  STARTING: 1,
  PURCHASE_SENT: 2,
  PURCHASED: 3,
  IS_STOPPING: 4,
} as const;

export type ContractStage = (typeof CONTRACT_STAGES)[keyof typeof CONTRACT_STAGES];

export default class RunPanelStore {
  root_store: RootStore;
  is_running = false;
  is_drawer_open = false;
  has_open_contract = false;
  contract_stage: ContractStage = CONTRACT_STAGES.NOT_RUNNING;
  run_id = "";

  private _registered_listeners: Array<{ event: string; handler: (data: unknown) => void }> = [];

  constructor(root_store: RootStore) {
    makeObservable(this, {
      is_running: observable,
      is_drawer_open: observable,
      has_open_contract: observable,
      contract_stage: observable,
      run_id: observable,
      is_stop_button_visible: computed,
      setIsRunning: action.bound,
      toggleDrawer: action.bound,
      setContractStage: action.bound,
      setHasOpenContract: action.bound,
      onBotRunningEvent: action.bound,
      onBotStopEvent: action.bound,
      onContractStatusEvent: action.bound,
      onBotContractEvent: action.bound,
      onErrorEvent: action.bound,
    });
    this.root_store = root_store;
  }

  get is_stop_button_visible(): boolean {
    return this.is_running || this.has_open_contract;
  }

  setIsRunning(is_running: boolean): void {
    this.is_running = is_running;
    if (!is_running) {
      this.contract_stage = CONTRACT_STAGES.NOT_RUNNING;
      this.has_open_contract = false;
    }
  }

  toggleDrawer(is_drawer_open: boolean): void {
    this.is_drawer_open = is_drawer_open;
  }

  setContractStage(stage: ContractStage): void {
    this.contract_stage = stage;
  }

  setHasOpenContract(has_open: boolean): void {
    this.has_open_contract = has_open;
  }

  onBotRunningEvent() {
    this.is_running = true;
    this.contract_stage = CONTRACT_STAGES.STARTING;
    this.run_id = crypto.randomUUID();
    this.root_store.journal.clear();
    this.root_store.transactions.clear();
    this.root_store.summary_card.clear();
  }

  onBotStopEvent() {
    this.is_running = false;
    this.has_open_contract = false;
    this.contract_stage = CONTRACT_STAGES.NOT_RUNNING;
  }

  onContractStatusEvent(data: { id?: string } | unknown) {
    const status = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
    switch (status.id) {
      case "contract.purchase_sent":
        this.contract_stage = CONTRACT_STAGES.PURCHASE_SENT;
        this.has_open_contract = true;
        break;
      case "contract.purchased":
        this.contract_stage = CONTRACT_STAGES.PURCHASED;
        break;
      case "contract.sold":
        this.contract_stage = CONTRACT_STAGES.STARTING;
        this.has_open_contract = false;
        break;
      default:
        break;
    }
  }

  onBotContractEvent(data: Record<string, unknown>) {
    this.root_store.summary_card.onBotContractEvent(data);
    this.root_store.transactions.onBotContractEvent(data);
  }

  onErrorEvent(data: unknown) {
    const message =
      typeof data === "string"
        ? data
        : (data as { message?: string })?.message ?? "An error occurred.";
    this.root_store.journal.onError(message);
    this.is_running = false;
    this.has_open_contract = false;
    this.contract_stage = CONTRACT_STAGES.NOT_RUNNING;
  }

  registerBotListeners() {
    const listeners: Array<[string, (data: unknown) => void]> = [
      ["bot.running", this.onBotRunningEvent],
      ["bot.stop", this.onBotStopEvent],
      ["contract.status", this.onContractStatusEvent],
      ["bot.contract", this.onBotContractEvent],
      ["Error", this.onErrorEvent],
    ];
    for (const [event, handler] of listeners) {
      globalObserver.register(event, handler);
      this._registered_listeners.push({ event, handler });
    }
    this.root_store.journal.registerEventListeners();
  }

  unregisterBotListeners() {
    for (const { event, handler } of this._registered_listeners) {
      globalObserver.unregister(event, handler);
    }
    this._registered_listeners = [];
  }
}
