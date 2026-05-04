import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutGrid,
  Bot,
  LineChart as LineChartIcon,
  BarChart3,
  Cpu,
  Microscope,
  Target,
  Users,
  CandlestickChart,
  ChevronDown,
  TrendingUp,
  PencilLine,
  Download,
  Crosshair,
  Minus,
  Info,
  ArrowUp,
  Shield,
  Sun,
  HelpCircle,
  Settings,
  Globe,
  Maximize2,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

const TABS = [
  { icon: LayoutGrid, label: "Dashboard" },
  { icon: Bot, label: "Bot Builder" },
  { icon: LineChartIcon, label: "MANUAL TRADERS", active: true },
  { icon: BarChart3, label: "Charts" },
  { icon: Cpu, label: "Trading Bots" },
  { icon: Microscope, label: "Analysis Tool" },
  { icon: Target, label: "Strategies" },
  { icon: Users, label: "Copy Trading" },
  { icon: CandlestickChart, label: "TradingView" },
];

// Mock chart points for SVG line
const POINTS = [
  20, 28, 22, 34, 30, 42, 38, 48, 44, 56, 50, 62, 58, 52, 60, 54, 66, 60, 72, 64,
  70, 58, 64, 52, 58, 50, 56, 46, 52, 48, 56, 50, 58, 54, 62, 56, 64, 58, 66, 60,
];

function Index() {
  const { user } = useAuth();

  // Build SVG path
  const w = 1100;
  const h = 320;
  const max = Math.max(...POINTS);
  const min = Math.min(...POINTS);
  const stepX = w / (POINTS.length - 1);
  const norm = (v: number) => h - ((v - min) / (max - min)) * (h - 40) - 20;
  const linePath = POINTS.map((p, i) => `${i === 0 ? "M" : "L"} ${i * stepX} ${norm(p)}`).join(" ");
  const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;
  const lastY = norm(POINTS[POINTS.length - 1]);

  return (
    <div className="page min-h-dvh bg-[oklch(0.985_0.003_240)] text-[oklch(0.2_0.02_260)]">
      {/* Top bar */}
      <header className="flex h-14 items-center justify-between border-b border-[oklch(0.92_0.005_240)] bg-white px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-6 rotate-45 rounded-sm bg-[oklch(0.72_0.17_55)]" />
          <span className="text-lg font-bold tracking-tight text-[oklch(0.72_0.17_55)]">
            ArkTrader Hub
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild className="h-9 rounded-md bg-[oklch(0.55_0.22_265)] px-5 text-white hover:bg-[oklch(0.5_0.22_265)]">
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                className="h-9 rounded-md bg-[oklch(0.55_0.22_265)] px-5 font-medium text-white shadow-sm hover:bg-[oklch(0.5_0.22_265)]"
              >
                <Link to="/auth" search={{ mode: "signin" }}>Log in</Link>
              </Button>
              <Button
                asChild
                className="h-9 rounded-md bg-[oklch(0.55_0.22_265)] px-5 font-medium text-white shadow-sm hover:bg-[oklch(0.5_0.22_265)]"
              >
                <Link to="/auth" search={{ mode: "signup" }}>Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Tabs nav */}
      <nav className="border-b border-[oklch(0.92_0.005_240)] bg-white">
        <div className="flex items-center overflow-x-auto px-2">
          {TABS.map((t) => (
            <button
              key={t.label}
              className={[
                "flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                t.active
                  ? "bg-[oklch(0.7_0.17_150)] text-white"
                  : "text-[oklch(0.3_0.02_260)] hover:bg-[oklch(0.96_0.005_240)]",
              ].join(" ")}
            >
              <t.icon className="size-4" />
              <span className={t.active ? "uppercase tracking-wide" : ""}>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Chart workspace */}
      <main className="relative">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">
          <section className="relative border-r border-[oklch(0.92_0.005_240)] bg-white">
            {/* Symbol pill */}
            <div className="absolute left-6 top-6 z-10 flex items-center gap-3 rounded-md border border-[oklch(0.92_0.005_240)] bg-white px-3 py-2 shadow-sm">
              <div className="flex size-9 items-center justify-center rounded bg-gradient-to-br from-[oklch(0.45_0.18_265)] to-[oklch(0.3_0.15_265)] font-mono text-[10px] font-bold text-white">
                100
              </div>
              <div>
                <div className="text-sm font-semibold leading-tight">Volatility 100 (1s) Index</div>
                <div className="font-mono text-[11px] text-[oklch(0.55_0.02_260)]">
                  1353.44 · -0.01 (0.00%) <span className="text-[oklch(0.6_0.18_150)]">▲</span>
                </div>
              </div>
              <ChevronDown className="size-4 text-[oklch(0.55_0.02_260)]" />
            </div>

            {/* Left chart toolbar */}
            <div className="absolute left-3 top-44 z-10 flex flex-col gap-1 rounded-md border border-[oklch(0.92_0.005_240)] bg-white p-1 shadow-sm">
              {[TrendingUp, LineChartIcon, BarChart3, PencilLine, Download].map((Icon, i) => (
                <button
                  key={i}
                  className="flex size-9 items-center justify-center rounded text-[oklch(0.4_0.02_260)] hover:bg-[oklch(0.96_0.005_240)]"
                >
                  <Icon className="size-4" />
                </button>
              ))}
              <div className="my-1 h-px bg-[oklch(0.92_0.005_240)]" />
              <button className="flex size-9 items-center justify-center rounded text-[oklch(0.4_0.02_260)] hover:bg-[oklch(0.96_0.005_240)]">
                <Crosshair className="size-4" />
              </button>
              <button className="flex size-9 items-center justify-center rounded text-[oklch(0.4_0.02_260)] hover:bg-[oklch(0.96_0.005_240)]">
                <Minus className="size-4" />
              </button>
            </div>

            {/* Chart */}
            <div className="px-2 pt-4">
              <svg viewBox={`0 0 ${w} ${h}`} className="h-[420px] w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.5 0.02 260)" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="oklch(0.5 0.02 260)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* gridlines */}
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <line
                    key={i}
                    x1="0"
                    x2={w}
                    y1={(h / 6) * i}
                    y2={(h / 6) * i}
                    stroke="oklch(0.94 0.005 240)"
                    strokeWidth="1"
                  />
                ))}
                <path d={areaPath} fill="url(#area)" />
                <path d={linePath} fill="none" stroke="oklch(0.3 0.02 260)" strokeWidth="1.5" />

                {/* Forecast band */}
                <rect
                  x={w * 0.72}
                  y={lastY - 32}
                  width={w * 0.18}
                  height={64}
                  fill="oklch(0.78 0.16 230 / 0.12)"
                  stroke="oklch(0.78 0.16 230)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <line
                  x1={w * 0.72}
                  x2={w * 0.9}
                  y1={lastY}
                  y2={lastY}
                  stroke="oklch(0.4 0.02 260)"
                  strokeDasharray="2 4"
                />
                {/* current price tag */}
                <g>
                  <rect x={w * 0.72 - 4} y={lastY - 10} width="70" height="20" fill="oklch(0.18 0.02 260)" rx="2" />
                  <text
                    x={w * 0.72 + 31}
                    y={lastY + 4}
                    textAnchor="middle"
                    fill="white"
                    fontSize="11"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    1353.44
                  </text>
                </g>
                {/* dot at current */}
                <circle
                  cx={w * 0.72}
                  cy={lastY}
                  r="4"
                  fill="oklch(0.2 0.02 260)"
                />
              </svg>
            </div>

            {/* Stats strip */}
            <div className="flex items-center gap-4 border-t border-[oklch(0.92_0.005_240)] px-6 py-3 font-mono text-xs text-[oklch(0.4_0.02_260)]">
              <Info className="size-4" />
              <span className="font-semibold text-[oklch(0.2_0.02_260)]">Stats</span>
              <span>63</span>
              <span>1</span>
              <span>4</span>
              <span>37</span>
              <span>24</span>
              <span>32</span>
              <span>1</span>
              <span>19</span>
              <span>6</span>
              <span>18</span>
              <ArrowUp className="size-3" />
            </div>

            {/* Time axis */}
            <div className="flex justify-between border-t border-[oklch(0.92_0.005_240)] px-6 py-2 font-mono text-[11px] text-[oklch(0.55_0.02_260)]">
              {["13:59:45","13:59:50","13:59:55","14:00:00","14:00:05","14:00:10","14:00:15","14:00:20","14:00:25","14:00:30"].map(t => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </section>

          {/* Right rail (placeholder cards) */}
          <aside className="hidden flex-col gap-3 bg-[oklch(0.97_0.003_240)] p-4 lg:flex">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 rounded-md border border-[oklch(0.92_0.005_240)] bg-white shadow-sm"
              />
            ))}
          </aside>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[oklch(0.92_0.005_240)] bg-white px-4 py-3">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-md bg-[oklch(0.92_0.13_95)] px-4 py-1.5 text-sm font-semibold text-[oklch(0.3_0.1_80)] shadow-sm hover:brightness-105"
          >
            Risk Disclaimer
          </Link>
          <div className="flex items-center gap-3 font-mono text-xs text-[oklch(0.45_0.02_260)]">
            <span>2026-05-04 14:14:09 GMT</span>
            <Shield className="size-4" />
            <Sun className="size-4" />
            <HelpCircle className="size-4" />
            <Settings className="size-4" />
            <Globe className="size-4" />
            <span className="font-sans font-medium">EN</span>
          </div>
        </div>

        {/* Second status bar */}
        <div className="flex items-center justify-end gap-3 border-t border-[oklch(0.92_0.005_240)] bg-white px-4 py-2 font-mono text-xs text-[oklch(0.45_0.02_260)]">
          <span className="size-2 rounded-full bg-[oklch(0.7_0.17_150)]" />
          <span>2026-05-04 12:36:01 GMT</span>
          <Bot className="size-4" />
          <Shield className="size-4" />
          <Crosshair className="size-4" />
          <Sun className="size-4" />
          <HelpCircle className="size-4" />
          <Settings className="size-4" />
          <Globe className="size-4" />
          <span className="font-sans font-medium">EN</span>
          <Maximize2 className="size-4" />
        </div>
      </main>

      {/* Floating AI bubble */}
      <button
        aria-label="AI assistant"
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.55_0.22_300)] to-[oklch(0.4_0.2_280)] text-white shadow-[0_10px_30px_-5px_oklch(0.4_0.2_280_/_0.6)] transition-transform hover:scale-105"
      >
        <Sparkles className="size-5" />
        <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-[oklch(0.7_0.17_150)]" />
        <span className="absolute -bottom-1 text-[10px] font-bold">AI</span>
      </button>
    </div>
  );
}
