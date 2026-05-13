import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Layers3, Search } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { getActiveSymbols, type ActiveSymbol } from "@/lib/deriv";
import { findActiveSymbol, groupActiveSymbols, type MarketGroup } from "@/lib/market-groups";
import { cn } from "@/lib/utils";

type MarketSelectorProps = {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
};

export function MarketSelector({ className, onValueChange, value }: MarketSelectorProps) {
  const [symbols, setSymbols] = useState<ActiveSymbol[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [openMarkets, setOpenMarkets] = useState<string[]>(["synthetic_index"]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getActiveSymbols()
      .then((items) => {
        if (active) setSymbols(items);
      })
      .catch((error) => {
        console.warn("[Market Selector] active symbols unavailable, using fallback markets", error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const groups = useMemo(() => groupActiveSymbols(symbols), [symbols]);
  const selected = useMemo(() => findActiveSymbol(symbols, value), [symbols, value]);
  const filteredGroups = useMemo(() => filterGroups(groups, query), [groups, query]);
  const totalSymbols = groups.reduce((total, group) => total + group.items.length, 0);

  useEffect(() => {
    if (!selected?.market) return;
    setOpenMarkets((current) =>
      current.includes(selected.market) ? current : [selected.market, ...current],
    );
  }, [selected?.market]);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-md border border-[#d6d9dc] bg-white shadow-sm dark:border-[#2f3337] dark:bg-[#151515]",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-[#f7f9fa] dark:hover:bg-[#202020]"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#f1fbfb] text-[#228f8d] ring-1 ring-[#d7eeee] dark:bg-[#112323] dark:text-[#6bd6d4] dark:ring-[#245250]">
          <Layers3 className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-[#6f767d] dark:text-[#a8b0b8]">
            Market
          </span>
          <span className="block truncate text-sm font-bold text-[#1f2328] dark:text-[#f2f2f2]">
            {selected?.display_name ?? value}
          </span>
          <span className="block truncate text-[11px] text-[#6f767d] dark:text-[#a8b0b8]">
            {selected?.market_display_name ?? "Deriv markets"} /{" "}
            {selected?.submarket_display_name ?? (loading ? "Loading" : `${totalSymbols} symbols`)}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[#6f767d] transition-transform dark:text-[#a8b0b8]",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-[#eceded] bg-[#fbfcfd] p-2 dark:border-[#2a2e32] dark:bg-[#101010]">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7a838c] dark:text-[#a8b0b8]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Forex, commodities, crypto..."
              className="h-9 rounded-md border-[#d6d9dc] bg-white pl-9 text-sm dark:border-[#30343a] dark:bg-[#151515] dark:text-[#f2f2f2]"
            />
          </div>

          <Accordion
            type="multiple"
            value={openMarkets}
            onValueChange={setOpenMarkets}
            className="max-h-[min(420px,52dvh)] overflow-y-auto pr-1"
          >
            {filteredGroups.map((group) => (
              <AccordionItem
                key={group.key}
                value={group.key}
                className="border-[#e6e9ec] dark:border-[#2a2e32]"
              >
                <AccordionTrigger className="py-2 text-xs font-bold uppercase tracking-wide text-[#424950] no-underline hover:no-underline dark:text-[#dce1e5]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{group.label}</span>
                    <span className="rounded-full bg-[#eef2f4] px-2 py-0.5 text-[10px] text-[#6f767d] dark:bg-[#20262a] dark:text-[#a8b0b8]">
                      {group.items.length}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  <div className="space-y-3">
                    {group.subgroups.map((subgroup) => (
                      <div key={subgroup.key}>
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#7a838c] dark:text-[#a8b0b8]">
                          {subgroup.label}
                        </div>
                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                          {subgroup.items.map((item) => {
                            const active = item.symbol === value;
                            return (
                              <button
                                key={item.symbol}
                                type="button"
                                onClick={() => {
                                  onValueChange(item.symbol);
                                  setExpanded(false);
                                }}
                                className={cn(
                                  "min-w-0 rounded-md border px-2 py-1.5 text-left transition",
                                  active
                                    ? "border-[#4bb4b3] bg-[#e9fbfb] text-[#0f6f6d] dark:bg-[#12302f] dark:text-[#7ee0df]"
                                    : "border-[#e2e6ea] bg-white text-[#1f2328] hover:border-[#4bb4b3] hover:bg-[#f7fafa] dark:border-[#30343a] dark:bg-[#151515] dark:text-[#f2f2f2] dark:hover:bg-[#202020]",
                                )}
                              >
                                <span className="block truncate text-xs font-bold">
                                  {item.display_name}
                                </span>
                                <span className="block truncate font-mono text-[10px] opacity-70">
                                  {item.symbol}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </section>
  );
}

function filterGroups(groups: MarketGroup[], query: string): MarketGroup[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return groups;

  return groups
    .map((group) => {
      const groupMatches = group.label.toLowerCase().includes(normalized);
      const subgroups = group.subgroups
        .map((subgroup) => {
          const subgroupMatches = subgroup.label.toLowerCase().includes(normalized);
          const items =
            groupMatches || subgroupMatches
              ? subgroup.items
              : subgroup.items.filter((item) =>
                  [
                    item.display_name,
                    item.symbol,
                    item.market_display_name,
                    item.submarket_display_name,
                  ]
                    .join(" ")
                    .toLowerCase()
                    .includes(normalized),
                );
          return { ...subgroup, items };
        })
        .filter((subgroup) => subgroup.items.length > 0);

      return {
        ...group,
        items: subgroups.flatMap((subgroup) => subgroup.items),
        subgroups,
      };
    })
    .filter((group) => group.items.length > 0);
}
