import AppStore from "./app-store";
import BlocklyStore from "./blockly-store";
import DashboardStore from "./dashboard-store";
import FlyoutStore from "./flyout-store";
import JournalStore from "./journal-store";
import LoadModalStore from "./load-modal-store";
import QuickStrategyStore from "./quick-strategy-store";
import RunPanelStore from "./run-panel-store";
import SaveModalStore from "./save-modal-store";
import SummaryCardStore from "./summary-card-store";
import ToolbarStore from "./toolbar-store";
import TransactionsStore from "./transactions-store";

export default class RootStore {
  public dbot: unknown;
  public app: AppStore;
  public dashboard: DashboardStore;
  public toolbar: ToolbarStore;
  public flyout: FlyoutStore;
  public quick_strategy: QuickStrategyStore;
  public journal: JournalStore;
  public summary_card: SummaryCardStore;
  public transactions: TransactionsStore;
  public run_panel: RunPanelStore;
  public blockly_store: BlocklyStore;
  public load_modal: LoadModalStore;
  public save_modal: SaveModalStore;

  constructor(dbot: unknown) {
    this.dbot = dbot;
    this.app = new AppStore(this);
    this.dashboard = new DashboardStore(this);
    this.toolbar = new ToolbarStore(this);
    this.flyout = new FlyoutStore(this);
    this.quick_strategy = new QuickStrategyStore(this);
    // journal/summary_card/transactions must be instantiated before run_panel
    this.journal = new JournalStore(this);
    this.summary_card = new SummaryCardStore(this);
    this.transactions = new TransactionsStore(this);
    this.run_panel = new RunPanelStore(this);
    this.load_modal = new LoadModalStore(this);
    this.save_modal = new SaveModalStore(this);
    this.blockly_store = new BlocklyStore(this);
  }
}
