import type { LucideIcon } from "lucide-react";
import { Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { TradeTypeConfig } from "@/lib/trade-types";

export function TradeTypeCard({
  config,
  onNext,
  onPrevious,
}: {
  config: TradeTypeConfig;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <div className="rounded-lg border border-[#e6e6e6] bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onPrevious}
          className="flex size-8 items-center justify-center rounded-md text-[#646464] hover:bg-[#f2f3f4]"
          aria-label="Previous trade type"
        >
          ‹
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f2f3f4] text-sm font-black text-[#ff444f]">
            {config.icon}
          </span>
          <div className="min-w-0 text-center">
            <div className="truncate text-sm font-bold text-[#333333]">{config.label}</div>
            <div className="truncate text-[11px] text-[#777777]">{config.description}</div>
          </div>
        </div>
        <button
          onClick={onNext}
          className="flex size-8 items-center justify-center rounded-md text-[#646464] hover:bg-[#f2f3f4]"
          aria-label="Next trade type"
        >
          ›
        </button>
      </div>
    </div>
  );
}

export function TickDurationSelector({
  duration,
  durationUnit,
  onDurationChange,
  onUnitChange,
  showUnits,
}: {
  duration: number;
  durationUnit: "t" | "s" | "m";
  onDurationChange: (value: number) => void;
  onUnitChange: (value: "t" | "s" | "m") => void;
  showUnits: boolean;
}) {
  return (
    <div className="rounded-lg border border-[#e6e6e6] bg-white p-3 shadow-sm">
      <div className="text-center text-sm font-medium text-[#646464]">
        {durationUnit === "t" ? "Ticks" : durationUnit === "s" ? "Seconds" : "Minutes"}
      </div>
      <Slider
        className="mt-3"
        min={1}
        max={10}
        step={1}
        value={[duration]}
        onValueChange={(value) => onDurationChange(value[0])}
      />
      <div className="mt-2 text-center text-sm font-bold text-[#333333]">
        {duration} {durationUnit === "t" ? `Tick${duration > 1 ? "s" : ""}` : durationUnit}
      </div>
      {showUnits && (
        <div className="mt-2 flex justify-center gap-1">
          {(["t", "s", "m"] as const).map((unit) => (
            <button
              key={unit}
              onClick={() => onUnitChange(unit)}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] font-medium",
                durationUnit === unit
                  ? "bg-[#ff444f] text-white"
                  : "bg-[#f2f3f4] text-[#646464] hover:bg-[#e6e9e9]",
              )}
            >
              {unit === "t" ? "ticks" : unit === "s" ? "sec" : "min"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DigitSelector({
  currentDigit,
  mode,
  selectedDigit,
  onDigitChange,
}: {
  currentDigit: number | null;
  mode: "barrier" | "prediction";
  selectedDigit: number;
  onDigitChange: (digit: number) => void;
}) {
  return (
    <div className="rounded-lg border border-[#e6e6e6] bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-[#333333]">
            {mode === "barrier" ? "Last digit barrier" : "Last digit prediction"}
          </div>
          <div className="text-[11px] text-[#777777]">Current digit: {currentDigit ?? "-"}</div>
        </div>
        <span className="rounded-md bg-[#ff444f] px-2.5 py-1 text-xs font-bold text-white">
          {currentDigit ?? "-"}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 10 }, (_, digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => onDigitChange(digit)}
            className={cn(
              "h-10 rounded-md border text-sm font-bold transition",
              selectedDigit === digit
                ? "border-[#333333] bg-[#333333] text-white"
                : "border-[#d6d6d6] bg-[#f7f7f7] text-[#333333] hover:border-[#999999]",
            )}
          >
            {digit}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StakePayoutToggle({
  currency,
  mode,
  onModeChange,
  onStakeChange,
  stake,
}: {
  currency: string;
  mode: "stake" | "payout";
  onModeChange: (mode: "stake" | "payout") => void;
  onStakeChange: (value: number) => void;
  stake: number;
}) {
  return (
    <div className="rounded-lg border border-[#e6e6e6] bg-white p-3 shadow-sm">
      <div className="mb-3 grid grid-cols-2 rounded-md bg-[#f2f3f4] p-1">
        {(["stake", "payout"] as const).map((item) => (
          <button
            key={item}
            onClick={() => onModeChange(item)}
            className={cn(
              "rounded py-1.5 text-sm font-bold capitalize transition",
              mode === item ? "bg-white text-[#333333] shadow-sm" : "text-[#646464]",
            )}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="text-center text-sm text-[#646464]">{mode === "stake" ? "Stake" : "Payout"}</div>
      <div className="mt-2 flex min-w-0 items-center gap-1.5">
        <StepperButton icon={Minus} label="Decrease" onClick={() => onStakeChange(Math.max(0.35, +(stake - 1).toFixed(2)))} />
        <Input
          type="number"
          min={0.35}
          step={1}
          value={stake}
          onChange={(event) => onStakeChange(Number(event.target.value))}
          className="min-w-0 text-center font-mono text-base"
        />
        <StepperButton icon={Plus} label="Increase" onClick={() => onStakeChange(+(stake + 1).toFixed(2))} />
        <span className="w-12 shrink-0 truncate text-center text-xs font-bold text-[#646464]">
          {currency}
        </span>
      </div>
    </div>
  );
}

export function ProposalButton({
  disabled,
  label,
  loading,
  onClick,
  payout,
  pct,
  tone,
}: {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onClick: () => void;
  payout?: string;
  pct?: string;
  tone: "up" | "down";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full overflow-hidden rounded-lg text-left text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60",
        tone === "up"
          ? "bg-gradient-to-r from-[#1db6a6] to-[#0f8f80] hover:from-[#18a898] hover:to-[#0c8174]"
          : "bg-gradient-to-r from-[#ff5f67] to-[#d93d47] hover:from-[#f4535c] hover:to-[#c9333d]",
      )}
    >
      <div className="flex items-center justify-between bg-black/5 px-3 py-1.5 text-xs">
        <span>Payout {payout ?? "-"}</span>
        <span className="font-mono">{pct ?? ""}</span>
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-base font-bold">{loading ? "Loading..." : label}</span>
        <span className="text-lg font-black">{tone === "up" ? "↗" : "↘"}</span>
      </div>
    </button>
  );
}

export function ProposalSummary({
  rows,
}: {
  rows: Array<[string, string | number | null | undefined]>;
}) {
  return (
    <div className="rounded-lg border border-[#e6e6e6] bg-white p-3 text-sm shadow-sm">
      <div className="mb-2 text-sm font-bold text-[#333333]">Active contract</div>
      <div className="grid grid-cols-2 gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-md bg-[#f7f7f7] p-2">
            <div className="text-[10px] font-bold uppercase text-[#999999]">{label}</div>
            <div className="mt-0.5 truncate font-mono text-xs font-bold text-[#333333]">
              {value ?? "-"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepperButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-md bg-[#f2f3f4] p-2 hover:bg-[#e6e9e9]"
      aria-label={label}
    >
      <Icon className="size-4" />
    </button>
  );
}
