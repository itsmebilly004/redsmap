import { r as reactExports, j as jsxRuntimeExports } from "../_libs/react.mjs";
import { T as TopShell } from "./top-shell-BKTx3Pm8.mjs";
import { c as cn, B as Button } from "./button-Cz8PAkJh.mjs";
import { I as Input } from "./input-DVeAuAgX.mjs";
import { C as Checkbox$1, a as CheckboxIndicator } from "../_libs/radix-ui__react-checkbox.mjs";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-BhjPe795.mjs";
import { R as Root2, L as List, T as Trigger$1, C as Content } from "../_libs/radix-ui__react-tabs.mjs";
import { R as Root, T as Trigger, P as Portal, C as Content$1, a as Close, b as Title, O as Overlay, D as Description } from "../_libs/radix-ui__react-dialog.mjs";
import { c as cva } from "../_libs/class-variance-authority.mjs";
import { u as useAuth, a as supabase, s as send, c as contractTypeFor } from "./router-R6L_Ezj3.mjs";
import { t as toast } from "../_libs/sonner.mjs";
import { C as ChevronDown, e as Search, D as Download, M as Menu, f as Activity, F as FolderOpen, g as ListOrdered, h as ChartLine, i as ChartBar, U as Undo2, R as Redo2, j as ZoomIn, k as ZoomOut, l as Save, m as Square, P as Play, n as RotateCcw, o as Shield, p as Sun, q as CircleQuestionMark, G as Globe, r as Maximize2, X, s as GripVertical, t as Check } from "../_libs/lucide-react.mjs";
import { n as numberType } from "../_libs/zod.mjs";
import "../_libs/tanstack__react-router.mjs";
import "../_libs/tanstack__router-core.mjs";
import "../_libs/tanstack__history.mjs";
import "../_libs/cookie-es.mjs";
import "../_libs/seroval.mjs";
import "../_libs/seroval-plugins.mjs";
import "node:stream/web";
import "node:stream";
import "../_libs/react-dom.mjs";
import "util";
import "crypto";
import "async_hooks";
import "stream";
import "../_libs/isbot.mjs";
import "../_libs/radix-ui__react-dropdown-menu.mjs";
import "../_libs/radix-ui__primitive.mjs";
import "../_libs/radix-ui__react-compose-refs.mjs";
import "../_libs/radix-ui__react-context.mjs";
import "../_libs/@radix-ui/react-use-controllable-state+[...].mjs";
import "../_libs/@radix-ui/react-use-layout-effect+[...].mjs";
import "../_libs/radix-ui__react-primitive.mjs";
import "../_libs/radix-ui__react-slot.mjs";
import "../_libs/radix-ui__react-menu.mjs";
import "../_libs/radix-ui__react-collection.mjs";
import "../_libs/radix-ui__react-direction.mjs";
import "../_libs/@radix-ui/react-dismissable-layer+[...].mjs";
import "../_libs/@radix-ui/react-use-callback-ref+[...].mjs";
import "../_libs/@radix-ui/react-use-escape-keydown+[...].mjs";
import "../_libs/radix-ui__react-focus-guards.mjs";
import "../_libs/radix-ui__react-focus-scope.mjs";
import "../_libs/radix-ui__react-popper.mjs";
import "../_libs/floating-ui__react-dom.mjs";
import "../_libs/floating-ui__dom.mjs";
import "../_libs/floating-ui__core.mjs";
import "../_libs/floating-ui__utils.mjs";
import "../_libs/radix-ui__react-arrow.mjs";
import "../_libs/radix-ui__react-use-size.mjs";
import "../_libs/radix-ui__react-portal.mjs";
import "../_libs/radix-ui__react-presence.mjs";
import "../_libs/radix-ui__react-roving-focus.mjs";
import "../_libs/radix-ui__react-id.mjs";
import "../_libs/aria-hidden.mjs";
import "../_libs/react-remove-scroll.mjs";
import "tslib";
import "../_libs/react-remove-scroll-bar.mjs";
import "../_libs/react-style-singleton.mjs";
import "../_libs/get-nonce.mjs";
import "../_libs/use-sidecar.mjs";
import "../_libs/use-callback-ref.mjs";
import "../_libs/clsx.mjs";
import "../_libs/tailwind-merge.mjs";
import "../_libs/radix-ui__react-use-previous.mjs";
import "../_libs/radix-ui__react-select.mjs";
import "../_libs/radix-ui__number.mjs";
import "../_libs/@radix-ui/react-visually-hidden+[...].mjs";
import "../_libs/supabase__supabase-js.mjs";
import "../_libs/supabase__postgrest-js.mjs";
import "../_libs/supabase__realtime-js.mjs";
import "../_libs/supabase__phoenix.mjs";
import "../_libs/supabase__storage-js.mjs";
import "../_libs/iceberg-js.mjs";
import "../_libs/supabase__auth-js.mjs";
import "../_libs/supabase__functions-js.mjs";
const Checkbox = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Checkbox$1,
  {
    ref,
    className: cn(
      "grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    ),
    ...props,
    children: /* @__PURE__ */ jsxRuntimeExports.jsx(CheckboxIndicator, { className: cn("grid place-content-center text-current"), children: /* @__PURE__ */ jsxRuntimeExports.jsx(Check, { className: "h-4 w-4" }) })
  }
));
Checkbox.displayName = Checkbox$1.displayName;
const Tabs = Root2;
const TabsList = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  List,
  {
    ref,
    className: cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      className
    ),
    ...props
  }
));
TabsList.displayName = List.displayName;
const TabsTrigger = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Trigger$1,
  {
    ref,
    className: cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
      className
    ),
    ...props
  }
));
TabsTrigger.displayName = Trigger$1.displayName;
const TabsContent = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Content,
  {
    ref,
    className: cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    ),
    ...props
  }
));
TabsContent.displayName = Content.displayName;
const Sheet = Root;
const SheetTrigger = Trigger;
const SheetPortal = Portal;
const SheetOverlay = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Overlay,
  {
    className: cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    ),
    ...props,
    ref
  }
));
SheetOverlay.displayName = Overlay.displayName;
const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom: "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right: "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm"
      }
    },
    defaultVariants: {
      side: "right"
    }
  }
);
const SheetContent = reactExports.forwardRef(({ side = "right", className, children, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsxs(SheetPortal, { children: [
  /* @__PURE__ */ jsxRuntimeExports.jsx(SheetOverlay, {}),
  /* @__PURE__ */ jsxRuntimeExports.jsxs(Content$1, { ref, className: cn(sheetVariants({ side }), className), ...props, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(Close, { className: "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(X, { className: "h-4 w-4" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "sr-only", children: "Close" })
    ] }),
    children
  ] })
] }));
SheetContent.displayName = Content$1.displayName;
const SheetHeader = ({ className, ...props }) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: cn("flex flex-col space-y-2 text-center sm:text-left", className), ...props });
SheetHeader.displayName = "SheetHeader";
const SheetTitle = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Title,
  {
    ref,
    className: cn("text-lg font-semibold text-foreground", className),
    ...props
  }
));
SheetTitle.displayName = Title.displayName;
const SheetDescription = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Description,
  {
    ref,
    className: cn("text-sm text-muted-foreground", className),
    ...props
  }
));
SheetDescription.displayName = Description.displayName;
const BLOCK_MENU = [{
  label: "Analysis Logics",
  emoji: "🔥"
}, {
  label: "Trade parameters"
}, {
  label: "Purchase conditions"
}, {
  label: "Sell conditions (optional)"
}, {
  label: "Restart trading conditions"
}, {
  label: "Analysis",
  chevron: true
}, {
  label: "Utility",
  chevron: true
}, {
  label: "Virtual Hook Switcher"
}, {
  label: "Binarytools"
}];
const MARKETS = {
  Derived: [{
    label: "Continuous Indices",
    symbols: [{
      value: "R_10",
      label: "Volatility 10 Index"
    }, {
      value: "R_25",
      label: "Volatility 25 Index"
    }, {
      value: "R_50",
      label: "Volatility 50 Index"
    }, {
      value: "R_75",
      label: "Volatility 75 Index"
    }, {
      value: "R_100",
      label: "Volatility 100 Index"
    }]
  }]
};
const TRADE_TYPES = {
  Digits: [{
    value: "even_odd",
    label: "Even/Odd",
    contracts: [{
      value: "even",
      label: "Even"
    }, {
      value: "odd",
      label: "Odd"
    }]
  }, {
    value: "over_under",
    label: "Over/Under",
    contracts: [{
      value: "over",
      label: "Over"
    }, {
      value: "under",
      label: "Under"
    }]
  }, {
    value: "matches_differs",
    label: "Matches/Differs",
    contracts: [{
      value: "matches",
      label: "Matches"
    }, {
      value: "differs",
      label: "Differs"
    }]
  }],
  "Ups & Downs": [{
    value: "rise_fall",
    label: "Rise/Fall",
    contracts: [{
      value: "up",
      label: "Rise"
    }, {
      value: "down",
      label: "Fall"
    }]
  }, {
    value: "higher_lower",
    label: "Higher/Lower",
    contracts: [{
      value: "higher",
      label: "Higher"
    }, {
      value: "lower",
      label: "Lower"
    }]
  }]
};
const paramSchemas = {
  stake: numberType({
    invalid_type_error: "Stake must be a number"
  }).positive("Stake must be greater than 0").max(1e4, "Stake cannot exceed 10,000"),
  stakeW: numberType({
    invalid_type_error: "Must be a number"
  }).min(0.1, "Must be at least 0.1").max(100, "Cannot exceed 100"),
  stopLoss: numberType({
    invalid_type_error: "Stop loss must be a number"
  }).nonnegative("Stop loss cannot be negative").max(1e6, "Stop loss is unrealistically large"),
  takeProfit: numberType({
    invalid_type_error: "Take profit must be a number"
  }).nonnegative("Take profit cannot be negative").max(1e6, "Take profit is unrealistically large"),
  durationTicks: numberType({
    invalid_type_error: "Ticks must be a number"
  }).int("Ticks must be a whole number").min(1, "Need at least 1 tick").max(10, "Maximum is 10 ticks"),
  martingaleAfterLoss: numberType({
    invalid_type_error: "Must be a number"
  }).min(1, "Multiplier must be at least 1").max(10, "Multiplier capped at 10x to limit risk")
};
const DEFAULT_BLOCKS = ["trade_parameters", "sell_conditions", "restart_conditions"];
const BLOCK_META = {
  trade_parameters: {
    index: 1,
    title: "Trade parameters"
  },
  sell_conditions: {
    index: 3,
    title: "Sell conditions"
  },
  restart_conditions: {
    index: 4,
    title: "Restart trading conditions",
    icon: "🎯"
  }
};
function BotBuilder() {
  const {
    user
  } = useAuth();
  const now = useNow();
  const [search, setSearch] = reactExports.useState("");
  const [menuOpen, setMenuOpen] = reactExports.useState(false);
  const [panelOpen, setPanelOpen] = reactExports.useState(false);
  const [marketGroup, setMarketGroup] = reactExports.useState("Derived");
  const [marketSubgroup, setMarketSubgroup] = reactExports.useState("Continuous Indices");
  const [symbol, setSymbol] = reactExports.useState("R_100");
  const [tradeTypeGroup, setTradeTypeGroup] = reactExports.useState("Digits");
  const [tradeType, setTradeType] = reactExports.useState("even_odd");
  const [contractType, setContractType] = reactExports.useState("even");
  const [candleInterval, setCandleInterval] = reactExports.useState("1 minute");
  const [restartOnError, setRestartOnError] = reactExports.useState(false);
  const [restartLastOnError, setRestartLastOnError] = reactExports.useState(true);
  const [stake, setStake] = reactExports.useState(1);
  const [stakeW, setStakeW] = reactExports.useState(1);
  const [stopLoss, setStopLoss] = reactExports.useState(2e3);
  const [takeProfit, setTakeProfit] = reactExports.useState(2);
  const [durationTicks, setDurationTicks] = reactExports.useState(1);
  const [martingaleAfterLoss, setMartingaleAfterLoss] = reactExports.useState(1);
  const [blockOrder, setBlockOrder] = reactExports.useState([...DEFAULT_BLOCKS]);
  const [dragId, setDragId] = reactExports.useState(null);
  const [bots, setBots] = reactExports.useState([]);
  const [currentBotId, setCurrentBotId] = reactExports.useState(null);
  const [botName, setBotName] = reactExports.useState("");
  const [tab, setTab] = reactExports.useState("summary");
  const [running, setRunning] = reactExports.useState(false);
  const [stats, setStats] = reactExports.useState({
    totalStake: 0,
    totalPayout: 0,
    runs: 0,
    contractsLost: 0,
    contractsWon: 0,
    totalProfit: 0
  });
  const [transactions, setTransactions] = reactExports.useState([]);
  const [journal, setJournal] = reactExports.useState([]);
  const [token, setToken] = reactExports.useState(null);
  const [isDemo, setIsDemo] = reactExports.useState(true);
  const errors = reactExports.useMemo(() => {
    const values = {
      stake,
      stakeW,
      stopLoss,
      takeProfit,
      durationTicks,
      martingaleAfterLoss
    };
    const out = {};
    Object.keys(values).forEach((k) => {
      const r = paramSchemas[k].safeParse(values[k]);
      if (!r.success) out[k] = r.error.issues[0]?.message ?? "Invalid";
    });
    return out;
  }, [stake, stakeW, stopLoss, takeProfit, durationTicks, martingaleAfterLoss]);
  const hasErrors = Object.keys(errors).length > 0;
  reactExports.useEffect(() => {
    if (!user) return;
    supabase.from("sessions").select("deriv_token, is_demo").eq("user_id", user.id).eq("is_active", true).order("is_demo", {
      ascending: true
    }).limit(1).maybeSingle().then(({
      data
    }) => {
      if (data) {
        setToken(data.deriv_token);
        setIsDemo(data.is_demo);
      }
    });
  }, [user]);
  async function loadBots() {
    if (!user) return;
    const {
      data
    } = await supabase.from("bots").select("id, name").eq("user_id", user.id).order("updated_at", {
      ascending: false
    });
    setBots(data ?? []);
  }
  reactExports.useEffect(() => {
    loadBots();
  }, [user]);
  const tradeTypesInGroup = TRADE_TYPES[tradeTypeGroup] ?? [];
  const currentTT = tradeTypesInGroup.find((t) => t.value === tradeType) ?? tradeTypesInGroup[0];
  reactExports.useEffect(() => {
    const first = TRADE_TYPES[tradeTypeGroup]?.[0];
    if (first && !TRADE_TYPES[tradeTypeGroup].some((t) => t.value === tradeType)) {
      setTradeType(first.value);
      setContractType(first.contracts[0].value);
    }
  }, [tradeTypeGroup]);
  function logJournal(msg) {
    setJournal((j) => [{
      time: (/* @__PURE__ */ new Date()).toLocaleTimeString(),
      msg
    }, ...j].slice(0, 200));
  }
  function buildStrategy() {
    return {
      symbol,
      tradeType,
      contractType,
      stake,
      stakeW,
      stopLoss,
      takeProfit,
      durationTicks,
      martingaleAfterLoss,
      candleInterval,
      restartOnError,
      restartLastOnError,
      marketGroup,
      marketSubgroup,
      tradeTypeGroup,
      blockOrder
    };
  }
  async function saveBot(saveAs = false) {
    if (!user) {
      toast.error("Sign in to save bots.");
      return;
    }
    if (hasErrors) {
      toast.error("Fix invalid parameters before saving.");
      return;
    }
    const name = botName.trim() || `${currentTT?.label ?? tradeType} on ${symbol}`;
    const payload = {
      name,
      user_id: user.id,
      strategy: buildStrategy(),
      status: "idle"
    };
    if (currentBotId && !saveAs) {
      const {
        error
      } = await supabase.from("bots").update(payload).eq("id", currentBotId);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Strategy updated");
    } else {
      const {
        data,
        error
      } = await supabase.from("bots").insert(payload).select("id, name").single();
      if (error) {
        toast.error(error.message);
        return;
      }
      setCurrentBotId(data.id);
      setBotName(data.name);
      toast.success("Strategy saved");
    }
    loadBots();
  }
  async function loadBotById(id) {
    if (!user) return;
    const {
      data,
      error
    } = await supabase.from("bots").select("id, name, strategy").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (error || !data) {
      toast.error("Could not load bot");
      return;
    }
    const s = data.strategy ?? {};
    setCurrentBotId(data.id);
    setBotName(data.name);
    if (s.symbol) setSymbol(s.symbol);
    if (s.tradeType) setTradeType(s.tradeType);
    if (s.contractType) setContractType(s.contractType);
    if (typeof s.stake === "number") setStake(s.stake);
    if (typeof s.stakeW === "number") setStakeW(s.stakeW);
    if (typeof s.stopLoss === "number") setStopLoss(s.stopLoss);
    if (typeof s.takeProfit === "number") setTakeProfit(s.takeProfit);
    if (typeof s.durationTicks === "number") setDurationTicks(s.durationTicks);
    if (typeof s.martingaleAfterLoss === "number") setMartingaleAfterLoss(s.martingaleAfterLoss);
    if (s.candleInterval) setCandleInterval(s.candleInterval);
    if (typeof s.restartOnError === "boolean") setRestartOnError(s.restartOnError);
    if (typeof s.restartLastOnError === "boolean") setRestartLastOnError(s.restartLastOnError);
    if (s.marketGroup) setMarketGroup(s.marketGroup);
    if (s.marketSubgroup) setMarketSubgroup(s.marketSubgroup);
    if (s.tradeTypeGroup) setTradeTypeGroup(s.tradeTypeGroup);
    if (Array.isArray(s.blockOrder) && s.blockOrder.length > 0) {
      const valid = s.blockOrder.filter((b) => DEFAULT_BLOCKS.includes(b));
      const missing = DEFAULT_BLOCKS.filter((b) => !valid.includes(b));
      setBlockOrder([...valid, ...missing]);
    }
    toast.success(`Loaded "${data.name}"`);
  }
  async function runOne() {
    if (!token) {
      toast.error("Connect your Deriv account first.");
      return;
    }
    if (hasErrors) {
      toast.error("Fix invalid parameters before running.");
      return;
    }
    try {
      await send({
        authorize: token
      });
      const ct = contractTypeFor(tradeType, contractType);
      const proposal = {
        proposal: 1,
        amount: stake,
        basis: "stake",
        contract_type: ct,
        currency: "USD",
        symbol,
        duration: durationTicks,
        duration_unit: "t"
      };
      if (tradeType === "over_under" || tradeType === "matches_differs") proposal.barrier = "5";
      const propResp = await send(proposal);
      const proposalId = propResp.proposal?.id;
      if (!proposalId) throw new Error("No proposal");
      const buyResp = await send({
        buy: proposalId,
        price: stake
      });
      const contract = buyResp.buy;
      logJournal(`Bought ${ct} contract ${contract.contract_id}`);
      const {
        data: trade
      } = await supabase.from("trades").insert({
        user_id: user.id,
        deriv_contract_id: String(contract.contract_id),
        symbol,
        trade_type: ct,
        stake,
        payout: contract.payout,
        status: "open"
      }).select().single();
      const poll = setInterval(async () => {
        try {
          const r = await send({
            proposal_open_contract: 1,
            contract_id: contract.contract_id
          });
          const c = r.proposal_open_contract;
          if (c?.is_sold) {
            clearInterval(poll);
            const profit = Number(c.profit ?? 0);
            const won = profit >= 0;
            setStats((s) => ({
              totalStake: s.totalStake + stake,
              totalPayout: s.totalPayout + Number(contract.payout ?? 0),
              runs: s.runs + 1,
              contractsLost: s.contractsLost + (won ? 0 : 1),
              contractsWon: s.contractsWon + (won ? 1 : 0),
              totalProfit: s.totalProfit + profit
            }));
            setTransactions((t) => [{
              id: String(contract.contract_id),
              time: (/* @__PURE__ */ new Date()).toLocaleTimeString(),
              type: ct,
              stake,
              profit
            }, ...t].slice(0, 200));
            logJournal(`${won ? "Won" : "Lost"} ${Math.abs(profit).toFixed(2)} USD`);
            if (trade?.id) {
              await supabase.from("trades").update({
                profit_loss: profit,
                status: won ? "won" : "lost",
                closed_at: (/* @__PURE__ */ new Date()).toISOString()
              }).eq("id", trade.id);
            }
          }
        } catch {
        }
      }, 1500);
      setTimeout(() => clearInterval(poll), 12e4);
    } catch (e) {
      logJournal(`Error: ${e.message ?? "trade failed"}`);
      toast.error(e.message ?? "Trade failed");
    }
  }
  async function startBot() {
    if (!token) {
      toast.error("Connect your Deriv account first.");
      return;
    }
    if (hasErrors) {
      toast.error("Fix invalid parameters before running.");
      return;
    }
    setRunning(true);
    logJournal("Bot started");
    await runOne();
    setRunning(false);
    logJournal("Bot finished one cycle");
  }
  function resetStats() {
    setStats({
      totalStake: 0,
      totalPayout: 0,
      runs: 0,
      contractsLost: 0,
      contractsWon: 0,
      totalProfit: 0
    });
    setTransactions([]);
    setJournal([]);
  }
  function exportCsv() {
    const escape = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [];
    lines.push("Section,Time,Type,Stake,Profit,Message");
    for (const t of transactions) {
      lines.push(["transaction", t.time, t.type, t.stake.toFixed(2), t.profit.toFixed(2), ""].map(escape).join(","));
    }
    for (const j of journal) {
      lines.push(["journal", j.time, "", "", "", j.msg].map(escape).join(","));
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bot-${(botName || "session").replace(/\s+/g, "-")}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  }
  function onDragStart(id) {
    setDragId(id);
  }
  function onDragOver(e) {
    e.preventDefault();
  }
  function onDrop(target) {
    if (!dragId || dragId === target) {
      setDragId(null);
      return;
    }
    setBlockOrder((order) => {
      const next = order.filter((b) => b !== dragId);
      const idx = next.indexOf(target);
      next.splice(idx, 0, dragId);
      return next;
    });
    setDragId(null);
  }
  const filteredMenu = reactExports.useMemo(() => BLOCK_MENU.filter((b) => b.label.toLowerCase().includes(search.toLowerCase())), [search]);
  function renderBlock(id) {
    const meta = BLOCK_META[id];
    const dragHandle = /* @__PURE__ */ jsxRuntimeExports.jsx("button", { draggable: true, onDragStart: () => onDragStart(id), onDragOver, onDrop: () => onDrop(id), className: "flex cursor-grab items-center gap-1 rounded bg-white/15 px-1.5 py-0.5 text-[10px] active:cursor-grabbing", title: "Drag to reorder", "aria-label": "Drag to reorder", children: /* @__PURE__ */ jsxRuntimeExports.jsx(GripVertical, { className: "size-3" }) });
    if (id === "trade_parameters") {
      return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { onDragOver, onDrop: () => onDrop(id), className: cn("w-full max-w-full overflow-hidden rounded-md shadow-md", dragId === id && "opacity-60"), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 bg-[oklch(0.32_0.13_265)] px-3 py-2 text-sm font-semibold text-white", children: [
          dragHandle,
          meta.index,
          ". ",
          meta.title
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2 bg-[oklch(0.99_0.003_240)] p-3 text-[13px]", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(Row, { label: "Market:", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Pill, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(NativeSelect, { value: marketGroup, onChange: setMarketGroup, options: Object.keys(MARKETS) }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: ">" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Pill, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(NativeSelect, { value: marketSubgroup, onChange: setMarketSubgroup, options: MARKETS[marketGroup].map((g) => g.label) }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: ">" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Pill, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(NativeSelect, { value: symbol, onChange: setSymbol, options: MARKETS[marketGroup].find((g) => g.label === marketSubgroup).symbols.map((s) => s.value), labels: Object.fromEntries(MARKETS[marketGroup].find((g) => g.label === marketSubgroup).symbols.map((s) => [s.value, s.label])) }) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(Row, { label: "Trade Type:", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Pill, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(NativeSelect, { value: tradeTypeGroup, onChange: setTradeTypeGroup, options: Object.keys(TRADE_TYPES) }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: ">" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Pill, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(NativeSelect, { value: tradeType, onChange: (v) => setTradeType(v), options: tradeTypesInGroup.map((t) => t.value), labels: Object.fromEntries(tradeTypesInGroup.map((t) => [t.value, t.label])) }) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Row, { label: "Contract Type:", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Pill, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(NativeSelect, { value: contractType, onChange: setContractType, options: (currentTT?.contracts ?? []).map((c) => c.value), labels: Object.fromEntries((currentTT?.contracts ?? []).map((c) => [c.value, c.label])) }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Row, { label: "Default Candle Interval:", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Pill, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(NativeSelect, { value: candleInterval, onChange: setCandleInterval, options: ["1 minute", "2 minutes", "3 minutes", "5 minutes", "10 minutes", "15 minutes", "30 minutes", "1 hour"] }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(CheckRow, { label: "Restart buy/sell on error (disable for better performance):", checked: restartOnError, onChange: setRestartOnError }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(CheckRow, { label: "Restart last trade on error (bot ignores the unsuccessful trade):", checked: restartLastOnError, onChange: setRestartLastOnError }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(SubBlockHeader, { title: "Run once at start:" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ParamRow, { label: "stake", value: stake, onChange: setStake, error: errors.stake }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ParamRow, { label: "stake w", value: stakeW, onChange: setStakeW, error: errors.stakeW }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ParamRow, { label: "stop loss", value: stopLoss, onChange: setStopLoss, error: errors.stopLoss }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ParamRow, { label: "take profit", value: takeProfit, onChange: setTakeProfit, error: errors.takeProfit }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ParamRow, { label: "Duration ticks", value: durationTicks, onChange: setDurationTicks, error: errors.durationTicks }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ParamRow, { label: "Product Martingale after loss", value: martingaleAfterLoss, onChange: setMartingaleAfterLoss, error: errors.martingaleAfterLoss })
        ] })
      ] }, id);
    }
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { onDragOver, onDrop: () => onDrop(id), className: cn("flex items-center gap-2 rounded-md bg-[oklch(0.32_0.13_265)] px-3 py-2 text-sm font-semibold text-white shadow", dragId === id && "opacity-60"), children: [
      dragHandle,
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "rounded bg-white/10 px-1.5 py-0.5 text-[10px]", children: meta.icon ?? "▤" }),
      meta.index,
      ". ",
      meta.title,
      /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { className: "ml-auto size-3.5" })
    ] }, id);
  }
  const blocksMenu = /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "p-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "w-full rounded-md bg-[oklch(0.27_0.12_265)] px-4 py-2 text-sm font-semibold text-white shadow", children: "Quick strategy" }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "border-t border-[oklch(0.94_0.005_240)] px-3 py-2 text-center text-xs font-medium tracking-wide text-[oklch(0.4_0.02_260)]", children: [
      "Blocks menu ",
      /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { className: "ml-1 inline size-3" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-3 pb-2", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Search, { className: "pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[oklch(0.6_0.02_260)]" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { value: search, onChange: (e) => setSearch(e.target.value), placeholder: "Search", className: "h-8 rounded-full bg-[oklch(0.96_0.005_240)] pl-7 text-sm" })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("nav", { className: "flex-1 overflow-y-auto pb-3", children: filteredMenu.map((b, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: cn("flex w-full items-center justify-between border-b border-[oklch(0.95_0.005_240)] px-4 py-2.5 text-left text-sm hover:bg-[oklch(0.97_0.005_240)]", i === 0 && "font-medium"), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
        b.label,
        " ",
        b.emoji && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-1", children: b.emoji })
      ] }),
      b.chevron && /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { className: "size-3.5 text-[oklch(0.5_0.02_260)]" })
    ] }, b.label)) })
  ] });
  const runPanel = /* @__PURE__ */ jsxRuntimeExports.jsxs(Tabs, { value: tab, onValueChange: setTab, className: "flex flex-1 flex-col", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(TabsList, { className: "grid grid-cols-3 rounded-none bg-transparent p-0", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(TabsTrigger, { value: "summary", className: "rounded-none data-[state=active]:bg-[oklch(0.62_0.18_150)] data-[state=active]:text-white", children: "Summary" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(TabsTrigger, { value: "transactions", className: "rounded-none", children: "Transactions" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(TabsTrigger, { value: "journal", className: "rounded-none", children: "Journal" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(TabsContent, { value: "summary", className: "m-0 flex flex-1 flex-col", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-1 items-center justify-center bg-[oklch(0.97_0.005_240)] px-6 py-8 text-center text-sm text-[oklch(0.45_0.02_260)]", children: [
        "When you're ready to trade, hit ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { className: "mx-1", children: "Run" }),
        ".",
        /* @__PURE__ */ jsxRuntimeExports.jsx("br", {}),
        "You'll be able to track your bot's performance here."
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "border-t border-[oklch(0.92_0.005_240)] p-4 text-sm", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-2 flex items-center justify-between", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { size: "sm", variant: "outline", onClick: exportCsv, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Download, { className: "mr-1 size-3" }),
            " Export CSV"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-[oklch(0.55_0.18_265)] underline", children: "What's this?" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Total stake", value: `${stats.totalStake.toFixed(2)} USD` }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Total payout", value: `${stats.totalPayout.toFixed(2)} USD` }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "No. of runs", value: String(stats.runs) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Contracts lost", value: String(stats.contractsLost) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Contracts won", value: String(stats.contractsWon) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Stat, { label: "Total profit", value: stats.totalProfit.toFixed(2) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "ghost", onClick: resetStats, className: "mt-4 w-full bg-[oklch(0.96_0.005_240)] text-[oklch(0.5_0.02_260)]", children: "Reset" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(TabsContent, { value: "transactions", className: "m-0 flex-1 overflow-auto p-3 text-xs", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-2 flex justify-end", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { size: "sm", variant: "outline", onClick: exportCsv, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Download, { className: "mr-1 size-3" }),
        " Export CSV"
      ] }) }),
      transactions.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "p-6 text-center text-sm text-muted-foreground", children: "No transactions yet." }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { className: "text-left text-[oklch(0.5_0.02_260)]", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Time" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Type" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Stake" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Profit" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: transactions.map((t) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "border-t border-[oklch(0.95_0.005_240)]", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: t.time }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: t.type }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: t.stake.toFixed(2) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: t.profit >= 0 ? "text-emerald-600" : "text-rose-600", children: t.profit.toFixed(2) })
        ] }, t.id)) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(TabsContent, { value: "journal", className: "m-0 flex-1 overflow-auto p-3 text-xs", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-2 flex justify-end", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { size: "sm", variant: "outline", onClick: exportCsv, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Download, { className: "mr-1 size-3" }),
        " Export CSV"
      ] }) }),
      journal.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "p-6 text-center text-sm text-muted-foreground", children: "No log entries." }) : /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "space-y-1", children: journal.map((j, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "border-b border-[oklch(0.95_0.005_240)] pb-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mr-2 text-[oklch(0.5_0.02_260)]", children: j.time }),
        j.msg
      ] }, i)) })
    ] })
  ] });
  return /* @__PURE__ */ jsxRuntimeExports.jsx(TopShell, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-h-[640px] flex-col bg-[oklch(0.97_0.005_240)] lg:h-[calc(100vh-180px)]", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2 border-b border-[oklch(0.92_0.005_240)] bg-white px-3 py-2 lg:hidden", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Sheet, { open: menuOpen, onOpenChange: setMenuOpen, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(SheetTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { variant: "outline", size: "sm", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Menu, { className: "mr-1 size-4" }),
          " Blocks"
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(SheetContent, { side: "left", className: "flex w-72 flex-col p-0", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(SheetHeader, { className: "px-4 pt-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SheetTitle, { children: "Blocks menu" }) }),
          blocksMenu
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex-1" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Sheet, { open: panelOpen, onOpenChange: setPanelOpen, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(SheetTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { variant: "outline", size: "sm", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Activity, { className: "mr-1 size-4" }),
          " Run panel"
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(SheetContent, { side: "right", className: "flex w-80 flex-col p-0 sm:w-96", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(SheetHeader, { className: "px-4 pt-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SheetTitle, { children: "Bot performance" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-1 flex-col", children: runPanel })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-1 min-h-0 flex-col lg:grid lg:grid-cols-[260px_1fr_360px]", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("aside", { className: "hidden flex-col border-r border-[oklch(0.92_0.005_240)] bg-white lg:flex", children: blocksMenu }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "flex flex-1 flex-col overflow-hidden", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center gap-1 border-b border-[oklch(0.92_0.005_240)] bg-white px-3 py-2 text-[oklch(0.45_0.02_260)]", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(ToolbarBtn, { icon: FolderOpen, title: "Open" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ToolbarBtn, { icon: ListOrdered, title: "Sort" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Divider, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ToolbarBtn, { icon: ChartLine, title: "Chart" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ToolbarBtn, { icon: ChartBar, title: "Trend" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Divider, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ToolbarBtn, { icon: Undo2, title: "Undo" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ToolbarBtn, { icon: Redo2, title: "Redo" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Divider, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ToolbarBtn, { icon: ZoomIn, title: "Zoom in" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(ToolbarBtn, { icon: ZoomOut, title: "Zoom out" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "ml-auto flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(Select, { value: currentBotId ?? "", onValueChange: (v) => v && loadBotById(v), children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { className: "h-7 w-[180px] text-xs", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "Load saved bot…" }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: bots.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "px-2 py-1 text-xs text-muted-foreground", children: "No bots yet" }) : bots.map((b) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: b.id, children: b.name }, b.id)) })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { value: botName, onChange: (e) => setBotName(e.target.value.slice(0, 80)), placeholder: "Bot name", className: "h-7 w-[160px] text-xs" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative flex-1 overflow-auto bg-[oklch(0.97_0.005_240)] p-4 sm:p-6", children: [
          hasErrors && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700", children: "Please fix the highlighted parameter errors below before saving or running this bot." }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-col gap-4", children: blockOrder.map((id) => renderBlock(id)) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("aside", { className: "hidden flex-col border-l border-[oklch(0.92_0.005_240)] bg-white lg:flex", children: runPanel })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 border-t border-[oklch(0.92_0.005_240)] bg-white px-4 py-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "rounded-md bg-[oklch(0.92_0.13_95)] px-3 py-1 text-xs font-semibold text-[oklch(0.3_0.1_80)]", children: "Risk Disclaimer" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { size: "sm", onClick: () => saveBot(false), variant: "outline", disabled: hasErrors, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Save, { className: "mr-1 size-3" }),
          " ",
          currentBotId ? "Update" : "Save"
        ] }),
        currentBotId && /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "sm", onClick: () => saveBot(true), variant: "outline", disabled: hasErrors, children: "Save as new" }),
        running ? /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { size: "sm", variant: "destructive", onClick: () => setRunning(false), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Square, { className: "mr-1 size-3" }),
          " Stop"
        ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { size: "sm", className: "bg-[oklch(0.55_0.22_265)] text-white", onClick: startBot, disabled: hasErrors, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Play, { className: "mr-1 size-3" }),
          " Run"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { size: "sm", variant: "ghost", onClick: resetStats, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(RotateCcw, { className: "mr-1 size-3" }),
          " Reset"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { size: "sm", variant: "ghost", onClick: exportCsv, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Download, { className: "mr-1 size-3" }),
          " CSV"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 font-mono text-[11px] text-[oklch(0.45_0.02_260)]", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: cn("inline-block size-2 rounded-full", token ? "bg-emerald-500" : "bg-rose-500") }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "hidden sm:inline", children: now }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Shield, { className: "size-3.5" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Sun, { className: "size-3.5" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(CircleQuestionMark, { className: "size-3.5" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Globe, { className: "size-3.5" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-sans font-medium", children: "EN" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Maximize2, { className: "size-3.5" })
      ] })
    ] })
  ] }) });
}
function useNow() {
  const [t, setT] = reactExports.useState(() => formatNow());
  reactExports.useEffect(() => {
    const i = setInterval(() => setT(formatNow()), 1e3);
    return () => clearInterval(i);
  }, []);
  return t;
}
function formatNow() {
  const d = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT`;
}
function ToolbarBtn({
  icon: Icon,
  title
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("button", { title, className: "rounded p-1.5 hover:bg-[oklch(0.95_0.005_240)]", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: "size-4" }) });
}
function Divider() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mx-1 hidden h-5 w-px bg-[oklch(0.92_0.005_240)] sm:inline-block" });
}
function SubBlockHeader({
  title
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "-mx-3 mt-2 bg-[oklch(0.32_0.13_265)] px-3 py-1.5 text-xs font-semibold text-white", children: title });
}
function Row({
  label,
  children
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center gap-1.5 rounded bg-white px-2 py-1.5 shadow-sm", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-[oklch(0.3_0.05_260)]", children: label }),
    children
  ] });
}
function Pill({
  children
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "inline-flex items-center rounded-full bg-[oklch(0.97_0.005_240)] px-2 py-0.5 text-xs ring-1 ring-[oklch(0.9_0.005_240)]", children });
}
function CheckRow({
  label,
  checked,
  onChange
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-3 rounded bg-white px-2 py-1.5 text-[12px] shadow-sm", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[oklch(0.3_0.05_260)]", children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Checkbox, { checked, onCheckedChange: (v) => onChange(Boolean(v)) })
  ] });
}
function ParamRow({
  label,
  value,
  onChange,
  error
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded bg-white px-2 py-1.5 text-[12px] shadow-sm", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[oklch(0.4_0.05_260)]", children: "set" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Pill, { children: label }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "to" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", value: Number.isFinite(value) ? value : "", onChange: (e) => onChange(e.target.value === "" ? NaN : Number(e.target.value)), "aria-invalid": !!error, className: cn("w-20 rounded-full bg-[oklch(0.97_0.005_240)] px-2 py-0.5 text-center text-xs ring-1 focus:outline-none", error ? "ring-rose-400 focus:ring-rose-500" : "ring-[oklch(0.9_0.005_240)]") })
    ] }),
    error && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 pl-1 text-[11px] text-rose-600", children: error })
  ] });
}
function NativeSelect({
  value,
  onChange,
  options,
  labels
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Select, { value, onValueChange: onChange, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { className: "h-5 border-0 bg-transparent p-0 text-xs shadow-none focus:ring-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { children: labels?.[value] ?? value }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: options.map((o) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: o, children: labels?.[o] ?? o }, o)) })
  ] });
}
function Stat({
  label,
  value
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-semibold text-[oklch(0.25_0.05_260)]", children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[oklch(0.45_0.02_260)]", children: value })
  ] });
}
export {
  BotBuilder as component
};
