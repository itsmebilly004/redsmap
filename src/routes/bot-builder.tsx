import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BarChart2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FolderOpen,
  LayoutList,
  LineChart,
  Play,
  Redo2,
  RefreshCw,
  Save,
  Search,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { TopShell } from "@/components/top-shell";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bot-builder")({
  component: BotBuilderPage,
});

const blockMenu = [
  { title: "Trade parameters" },
  { title: "Purchase conditions" },
  { title: "Sell conditions (optional)" },
  { title: "Restart trading conditions" },
  { collapsible: true, title: "Analysis" },
  { collapsible: true, title: "Utility" },
];

function BotBuilderPage() {
  const [status, setStatus] = useState<"running" | "stopped">("stopped");
  const [activeTab, setActiveTab] = useState("summary");
  const stats = useMemo(
    () => ({
      contractsLost: 0,
      contractsWon: 0,
      runs: 0,
      stake: "0.00 USD",
      totalProfitLoss: "0.00 USD",
      totalPayout: "0.00 USD",
    }),
    [],
  );

  return (
    <TopShell showAssistantButton={false}>
      <div className="min-w-0 bg-[#e9eaec] p-2 text-[#171717] dark:bg-[#0f0f0f]">
        <div className="grid h-[calc(100dvh-8.75rem)] min-h-[620px] grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[228px_minmax(0,1fr)_354px]">
          <BlocksMenu />
          <WorkspaceCanvas />
          <RunSummaryPanel
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            stats={stats}
            status={status}
            setStatus={setStatus}
          />
        </div>
      </div>
      <SiteFooter />
    </TopShell>
  );
}

function BlocksMenu() {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden bg-[#f5f5f5] text-[#101213] dark:bg-[#151515] dark:text-[#eeeeee]">
      <button className="mx-2 mt-2 flex h-40 min-h-10 items-start justify-center rounded-[4px] bg-[#ff444f] px-3 pt-3 text-sm font-bold text-white shadow-sm lg:h-40">
        Quick strategy
      </button>

      <div className="mt-2 flex h-[54px] items-center justify-between bg-[#eceeef] px-5 text-base font-bold dark:bg-[#202020]">
        <span>Blocks menu</span>
        <ChevronUp className="size-5" />
      </div>

      <div className="border-b border-[#e1e1e1] bg-white p-4 dark:border-[#2b2b2b] dark:bg-[#151515]">
        <div className="flex h-8 items-center gap-2 rounded-[6px] border border-[#d3d5d6] bg-white px-3 text-[#8d8f92] dark:border-[#333] dark:bg-[#101010]">
          <Search className="size-4" />
          <span className="text-sm">Search</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 bg-white dark:bg-[#151515]">
        {blockMenu.map((item) => (
          <button
            key={item.title}
            className="flex h-[41px] w-full items-center justify-between border-b border-[#eeeeee] px-5 text-left text-sm font-bold hover:bg-[#f7f7f7] dark:border-[#2b2b2b] dark:hover:bg-[#202020]"
          >
            <span>{item.title}</span>
            {item.collapsible && <ChevronDown className="size-5" />}
          </button>
        ))}
      </div>
    </aside>
  );
}

function WorkspaceCanvas() {
  return (
    <section className="relative min-h-0 overflow-hidden bg-white dark:bg-[#101010]">
      <WorkspaceToolbar />
      <ScrollArea className="h-full">
        <div className="relative h-[1420px] min-w-[1320px] bg-white dark:bg-[#101010]">
          <div className="absolute left-6 top-[62px] origin-top-left scale-[0.74] md:scale-[0.82] xl:scale-[0.9]">
            <TradeParametersBlock />
            <PurchaseConditionsBlock />
            <FunctionStack />
          </div>
          <div className="absolute right-[-9px] top-1/2 z-20 flex h-12 w-5 -translate-y-1/2 items-center justify-center border border-[#d2d2d2] bg-white text-[#5d5d5d] dark:border-[#333] dark:bg-[#151515]">
            <ChevronLeft className="size-4" />
            <ChevronRight className="-ml-3 size-4" />
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
}

function WorkspaceToolbar() {
  const icons = [
    RefreshCw,
    FolderOpen,
    Save,
    LayoutList,
    LineChart,
    BarChart2,
    Undo2,
    Redo2,
    ZoomIn,
    ZoomOut,
  ];

  return (
    <div className="absolute left-0 top-0 z-30 flex h-[54px] items-center bg-white pl-4 dark:bg-[#101010]">
      <div className="flex h-10 items-center overflow-hidden rounded-[4px] border border-[#d0d2d4] bg-white dark:border-[#333] dark:bg-[#151515]">
        {icons.map((Icon, index) => (
          <button
            key={`${Icon.displayName ?? Icon.name}-${index}`}
            className={cn(
              "flex size-10 items-center justify-center text-[#1f1f1f] hover:bg-[#f5f5f5] dark:text-[#e6e6e6] dark:hover:bg-[#202020]",
              index === 3 || index === 5 || index === 7
                ? "border-r border-[#d9dbdc]"
                : "border-r border-transparent",
            )}
            type="button"
          >
            <Icon className="size-[18px]" />
          </button>
        ))}
      </div>
    </div>
  );
}

function RunSummaryPanel({
  activeTab,
  setActiveTab,
  setStatus,
  stats,
  status,
}: {
  activeTab: string;
  setActiveTab: (value: string) => void;
  setStatus: (value: "running" | "stopped") => void;
  stats: {
    contractsLost: number;
    contractsWon: number;
    runs: number;
    stake: string;
    totalPayout: string;
    totalProfitLoss: string;
  };
  status: "running" | "stopped";
}) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden bg-white dark:bg-[#151515]">
      <div className="flex h-[49px] items-center gap-3 bg-[#f7f7f7] dark:bg-[#1c1c1c]">
        <Button
          className="h-[40px] w-[82px] rounded-none bg-[#4bb4b3] text-base font-bold text-white hover:bg-[#43a5a4]"
          onClick={() => setStatus(status === "running" ? "stopped" : "running")}
        >
          <Play className="mr-1 size-5 fill-white" />
          Run
        </Button>
        <div className="mr-4 flex h-[38px] flex-1 flex-col items-center justify-center rounded-[2px] border border-[#cfd2d4] bg-white dark:border-[#333] dark:bg-[#101010]">
          <div className="text-xs font-bold">
            Bot is {status === "running" ? "running" : "not running"}
          </div>
          <div className="mt-2 h-1 w-[92%] rounded-full bg-[#d8d8d8]">
            <div className="h-1 w-[4px] rounded-full bg-[#111]" />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="grid h-10 w-full grid-cols-3 rounded-none border-b border-[#e5e5e5] bg-white p-0 dark:border-[#2b2b2b] dark:bg-[#151515]">
          {["summary", "transactions", "journal"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="h-full rounded-none border-b-2 border-transparent bg-transparent text-sm font-medium capitalize text-[#444] shadow-none data-[state=active]:border-[#ff444f] data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:shadow-none dark:text-[#e6e6e6]"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="summary" className="m-0 min-h-0 flex-1 bg-white p-4 dark:bg-[#151515]">
          <div className="flex h-[258px] items-center justify-center bg-[#f1f2f3] px-8 text-center text-sm leading-5 text-[#444] dark:bg-[#202020] dark:text-[#d8d8d8]">
            <p>
              When you’re ready to trade, hit <strong>Run.</strong>
              <br />
              You’ll be able to track your bot’s
              <br />
              performance here.
            </p>
          </div>

          <div className="bg-[#f1f2f3] pb-4 dark:bg-[#202020]">
            <div className="px-5 pt-4 text-right text-[11px] underline">What’s this?</div>
            <div className="grid grid-cols-3 gap-y-6 px-5 pt-3 text-center">
              <SummaryMetric label="Total stake" value={stats.stake} />
              <SummaryMetric label="Total payout" value={stats.totalPayout} />
              <SummaryMetric label="No. of runs" value={stats.runs} />
              <SummaryMetric label="Contracts lost" value={stats.contractsLost} />
              <SummaryMetric label="Contracts won" value={stats.contractsWon} />
              <SummaryMetric label="Total profit/loss" value={stats.totalProfitLoss} />
            </div>
          </div>

          <button className="mt-3 h-10 w-full rounded-[3px] border border-[#999] bg-white text-sm font-bold hover:bg-[#f7f7f7] dark:bg-[#151515] dark:hover:bg-[#202020]">
            Reset
          </button>
        </TabsContent>

        <TabsContent value="transactions" className="m-0 flex-1 bg-white p-5 dark:bg-[#151515]">
          <EmptyPanel title="No transactions yet" />
        </TabsContent>
        <TabsContent value="journal" className="m-0 flex-1 bg-white p-5 dark:bg-[#151515]">
          <EmptyPanel title="Journal entries will appear here" />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-[#333] dark:text-[#eeeeee]">{label}</div>
      <div className="mt-3 text-xs text-[#333] dark:text-[#eeeeee]">{value}</div>
    </div>
  );
}

function EmptyPanel({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-[260px] items-center justify-center bg-[#f1f2f3] text-sm text-[#555] dark:bg-[#202020] dark:text-[#d8d8d8]">
      {title}
    </div>
  );
}

function TradeParametersBlock() {
  return (
    <div className="w-[760px]">
      <GreenHeader title="1. Trade parameters" width="w-[210px]" />
      <div className="rounded-b-[3px] bg-[#075773] pb-2 pl-2 pr-3 pt-2 text-[10px] text-[#242424] shadow-sm">
        <div className="space-y-2">
          <BlockLine>
            Market: <Pill>Derived</Pill> <span>&gt;</span> <Pill>Continuous Indices</Pill>{" "}
            <span>&gt;</span> <Pill>Volatility 10 (1s) Index</Pill>
          </BlockLine>
          <BlockLine>
            Trade Type: <Pill>Digits</Pill> <span>&gt;</span> <Pill>Over/Under</Pill>
          </BlockLine>
          <BlockLine>
            Contract Type: <Pill>Both</Pill>
          </BlockLine>
          <BlockLine>
            Default Candle Interval: <Pill>1 minute</Pill>
          </BlockLine>
          <BlockLine className="w-[265px]">
            Restart buy/sell on error (disable for better performance): <TinySquare />
          </BlockLine>
          <BlockLine className="w-[276px]">
            Restart last trade on error (bot ignores the unsuccessful trade): <TinySquare checked />
          </BlockLine>
        </div>
        <GreenHeader title="Run once at start:" width="w-[210px]" className="mt-2" />
        <div className="space-y-1 rounded-b-[3px] bg-[#eeeeee] p-1">
          <BlockLine className="w-[116px]">marketwizard v1.5</BlockLine>
          <SetLine label="profit" value="Auto Both By Chain" />
          <SetLine label="stake" value="5.97" />
          <SetLine label="Win Tries" value="5.97" />
          <SetLine label="Trend Loss" value="Auto Both By Chain" />
          <SetLine label="Expected Profit" value="100" />
          <SetLine label="Stop Loss" value="30" />
          <SetLine label="Loss" value="Is normal trend with" plus />
          <SetLine label="Expected Profit" plus />
          <SetLine label="3 Spot Loss" plus />
          <SetLine label="Stop Loss" plus />
          <BlockLine className="w-[305px]">
            Notify <Pill>blue</Pill> with sound: <Pill>Earned money</Pill> text
          </BlockLine>
          <SetLine label="Loss" value="0" />
        </div>
        <GreenHeader title="Trade options:" width="w-[210px]" className="mt-2" />
        <BlockLine className="w-[940px]">
          Duration: <Pill>Ticks</Pill> <Pill>1</Pill> Stake: USD <Pill>Stake</Pill> (min: 0.35 -
          max: 50000) prediction: <Pill>test</Pill> Loss <Pill>=</Pill> <Pill>0</Pill> if true
          <Pill>false</Pill> then Loss <Pill>+</Pill> <Pill>1</Pill> if true <Pill>false</Pill> then
          Loss <Pill>=</Pill> <Pill>4</Pill>
        </BlockLine>
      </div>
    </div>
  );
}

function PurchaseConditionsBlock() {
  return (
    <div className="mt-6 w-[460px]">
      <GreenHeader title="2. Purchase conditions" width="w-[210px]" />
      <div className="rounded-b-[3px] bg-[#075773] p-2 text-[10px] text-[#242424]">
        <BlockLine className="w-[310px]">
          Notify <Pill>blue</Pill> with sound: <Pill>Silent</Pill> Auto Both By Chain
        </BlockLine>
        <BlockLine className="mt-1 w-[210px]">
          set <Pill>test</Pill> to create text with
        </BlockLine>
        <NestedMini label="Last Digit &gt;" />
        <NestedMini label="Last Digit &lt;" />
      </div>
    </div>
  );
}

function FunctionStack() {
  return (
    <div className="mt-8 w-[740px] space-y-10 text-[10px] text-[#242424]">
      <BlockLine className="w-[430px]">
        function <strong>Martingale Core Functionality</strong> with:
      </BlockLine>
      <BlockLine className="ml-0 w-[330px]">
        function <strong>Martingale Trade Amount ()</strong>
      </BlockLine>
      <BlockLine className="ml-0 w-[300px]">
        function <strong>marketwizard v1.5 ()</strong>
      </BlockLine>
      <div className="space-y-2 rounded-[3px] bg-[#ededed] p-3">
        <BlockLine className="w-[650px]">
          function <strong>Martingale Trade Again After Purchase</strong> with: martingale:profit,
          martingale:resultIsWin <RoundPlus />
        </BlockLine>
        <BlockLine className="ml-6 w-[410px]">
          change <Pill>martingale:totalProfit</Pill> by <Pill>martingale:profit</Pill>
        </BlockLine>
        <BlockLine className="ml-6 w-[580px]">
          set <Pill>martingale:totalProfit</Pill> to <Pill>round</Pill>{" "}
          <Pill>martingale:totalProfit</Pill> * 100 / 100
        </BlockLine>
        <BlockLine className="ml-6 w-[570px]">
          Martingale Core Functionality with: martingale:resultIsWin{" "}
          <Pill>martingale:resultIsWin</Pill>
        </BlockLine>
        <BlockLine className="ml-6 w-[390px]">
          set <Pill>Notification:totalProfit</Pill> to create text with <RoundPlus />
        </BlockLine>
        <BlockLine className="ml-12 w-[220px]">
          Total Profit: <RoundMinus />
        </BlockLine>
        <BlockLine className="ml-12 w-[245px]">
          <Pill>martingale:totalProfit</Pill> <RoundMinus />
        </BlockLine>
        <BlockLine className="ml-6 w-[520px]">
          Notify <Pill>blue</Pill> with sound: <Pill>Silent</Pill>{" "}
          <Pill>Notification:totalProfit</Pill>
        </BlockLine>
        <BlockLine className="ml-6 w-[330px]">
          set <Pill>martingale:tradeAgain</Pill> to <Pill>false</Pill>
        </BlockLine>
        <BlockLine className="ml-6 w-[620px]">
          if <Pill>martingale:totalProfit</Pill> &lt; <Pill>martingale:profitThreshold</Pill> then
        </BlockLine>
        <BlockLine className="ml-12 w-[650px]">
          if <Pill>martingale:totalProfit</Pill> &gt; <Pill>martingale:lossThreshold</Pill> then
        </BlockLine>
      </div>
    </div>
  );
}

function GreenHeader({
  className,
  title,
  width,
}: {
  className?: string;
  title: string;
  width: string;
}) {
  return (
    <div
      className={cn(
        "flex h-[28px] items-center rounded-t-[3px] bg-[#075773] px-3 text-xs font-bold text-white",
        width,
        className,
      )}
    >
      {title}
    </div>
  );
}

function BlockLine({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex min-h-[26px] items-center gap-1 rounded-[3px] bg-[#eeeeee] px-2 shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SetLine({ label, plus, value }: { label: string; plus?: boolean; value?: string }) {
  return (
    <BlockLine className="w-fit">
      set <Pill>{label}</Pill>
      {value && (
        <>
          to <Pill>{value}</Pill>
        </>
      )}
      {plus && <RoundPlus />}
    </BlockLine>
  );
}

function NestedMini({ label }: { label: string }) {
  return (
    <div className="ml-8 mt-1 flex w-[180px] items-center justify-between rounded-[3px] bg-[#eeeeee] px-2 py-1">
      <span>{label}</span>
      <RoundPlus />
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[22px] items-center rounded-full border border-[#d8d8d8] bg-white px-2 text-[10px] shadow-sm">
      {children}
      <ChevronDown className="ml-1 size-3" />
    </span>
  );
}

function TinySquare({ checked }: { checked?: boolean }) {
  return (
    <span className="inline-flex size-4 items-center justify-center rounded-[2px] bg-white text-[10px]">
      {checked ? "✓" : ""}
    </span>
  );
}

function RoundPlus() {
  return (
    <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#333] text-[11px] font-bold text-white">
      +
    </span>
  );
}

function RoundMinus() {
  return (
    <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#333] text-[11px] font-bold text-white">
      -
    </span>
  );
}
