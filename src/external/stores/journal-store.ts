import { action, makeObservable, observable } from "mobx";
import { observer as globalObserver } from "@/external/bot-skeleton/utils/observer";
import { LogTypes } from "@/external/bot-skeleton/constants/messages";
import type RootStore from "./root-store";

export type JournalMessage = {
  id: string;
  message: string;
  type: "success" | "error" | "warn" | "info";
  timestamp: number;
};

export default class JournalStore {
  root_store: RootStore;
  unfiltered_messages: JournalMessage[] = [];
  journal_filters: string[] = [];

  constructor(root_store: RootStore) {
    makeObservable(this, {
      unfiltered_messages: observable,
      journal_filters: observable,
      onLogSuccess: action.bound,
      onError: action.bound,
      onNotify: action.bound,
      clear: action.bound,
    });
    this.root_store = root_store;
  }

  private push(message: string, type: JournalMessage["type"]) {
    this.unfiltered_messages.unshift({
      id: crypto.randomUUID(),
      message,
      type,
      timestamp: Date.now(),
    });
    if (this.unfiltered_messages.length > 500) {
      this.unfiltered_messages.splice(500);
    }
  }

  onLogSuccess(data: { message?: string } | string) {
    const message = typeof data === "string" ? data : (data?.message ?? "");
    this.push(message, "success");
  }

  onError(data: { message?: string } | string) {
    const message = typeof data === "string" ? data : (data?.message ?? "");
    this.push(message, "error");
  }

  onNotify(data: { message?: string; type?: string } | string) {
    if (typeof data === "string") {
      this.push(data, "info");
      return;
    }
    const message = data?.message ?? "";
    const rawType = data?.type ?? "info";
    const type: JournalMessage["type"] =
      rawType === "error" ? "error" :
      rawType === "success" ? "success" :
      rawType === "warn" ? "warn" :
      "info";
    this.push(message, type);
  }

  clear() {
    this.unfiltered_messages = [];
  }

  registerEventListeners() {
    globalObserver.register("ui.log.success", this.onLogSuccess);
    globalObserver.register("ui.log.error", this.onError);
    globalObserver.register("ui.log.notify", this.onNotify);
    globalObserver.register("ui.log.warn", (data: { message?: string } | string) => {
      const message = typeof data === "string" ? data : (data?.message ?? "");
      this.push(message, "warn");
    });
    globalObserver.register("Error", (data: { message?: string } | string) => {
      const message = typeof data === "string" ? data : (data?.message ?? "");
      this.push(message, "error");
    });
  }
}

// Satisfy possible import of LogTypes without breaking the build
void LogTypes;
