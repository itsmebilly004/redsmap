import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopShell } from "@/components/top-shell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Activity, TrendingUp, Users, DollarSign } from "lucide-react";

export const Route = createFileRoute("/admin/profits")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/" });
    }
    const { data: profile } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", session.user.id)
      .single();
    
    if (!profile?.is_admin) {
      throw redirect({ to: "/" });
    }
  },
  component: AdminProfitsPage,
});

type TradeRow = {
  id: string;
  profit_loss: number;
  symbol: string;
  closed_at: string;
  user_id: string;
  users: {
    email: string;
  };
};

function AdminProfitsPage() {
  const { user } = useAuth();
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [totalProfits, setTotalProfits] = useState(0);
  const [totalWinningTrades, setTotalWinningTrades] = useState(0);
  const [uniqueUsers, setUniqueUsers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProfits() {
      if (!user) return;
      setIsLoading(true);

      // Fetch the latest 100 for the feed
      const feedPromise = supabase
        .from("trades")
        .select(`
          id,
          profit_loss,
          symbol,
          closed_at,
          user_id
        `)
        .not("deriv_contract_id", "like", "SIM_%")
        .gt("profit_loss", 0)
        .order("closed_at", { ascending: false })
        .limit(100);

      // Fetch aggregations for all time
      const statsPromise = supabase
        .from("trades")
        .select("profit_loss, user_id")
        .not("deriv_contract_id", "like", "SIM_%")
        .gt("profit_loss", 0);

      const [feedRes, statsRes] = await Promise.all([feedPromise, statsPromise]);

      if (!feedRes.error && feedRes.data) {
        const rawTrades = feedRes.data;
        const userIds = [...new Set(rawTrades.map(t => t.user_id))];
        
        const profileMap = new Map();
        
        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from("users")
            .select("id, email")
            .in("id", userIds);
            
          usersData?.forEach(u => profileMap.set(u.id, u));
        }

        const enrichedTrades = rawTrades.map(t => ({
          ...t,
          users: profileMap.get(t.user_id) || { email: "Unknown Trader" }
        }));
        
        setTrades(enrichedTrades as unknown as TradeRow[]);
      }

      if (!statsRes.error && statsRes.data) {
        const total = statsRes.data.reduce((sum, t) => sum + Number(t.profit_loss), 0);
        const users = new Set(statsRes.data.map((t) => t.user_id)).size;
        setTotalProfits(total);
        setTotalWinningTrades(statsRes.data.length);
        setUniqueUsers(users);
      }

      setIsLoading(false);
    }
    loadProfits();

    // Subscribe to new trades
    const channel = supabase
      .channel("admin_profits_feed")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trades",
          filter: "profit_loss=gt.0",
        },
        (payload) => {
          // If it's a simulated trade, ignore it.
          const newTrade = payload.new as any;
          const oldTrade = payload.old as any;
          
          if (newTrade.deriv_contract_id?.startsWith("SIM_")) return;
          
          // Only process if it just became a winning trade (was open or 0 before)
          if (oldTrade && oldTrade.profit_loss > 0) return;

          // We need to fetch the profile for this new user to display it correctly
          supabase
            .from("users")
            .select("email")
            .eq("id", newTrade.user_id)
            .single()
            .then(({ data: userProfile }) => {
              if (userProfile) {
                setTrades((prev) => {
                  // Prevent duplicates if the row is updated multiple times
                  if (prev.some(t => t.id === newTrade.id)) return prev;
                  
                  // Update live aggregations only for new unique trades
                  setTotalProfits((p) => p + Number(newTrade.profit_loss));
                  setTotalWinningTrades((p) => p + 1);

                  return [
                    {
                      ...newTrade,
                      users: userProfile,
                    },
                    ...prev,
                  ].slice(0, 100); // Keep last 100
                });
              }
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <div className="flex h-screen flex-col bg-[#f1f2f3] dark:bg-[#101010]">
      <TopShell />
      <div className="flex-1 overflow-auto p-4 sm:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#333] dark:text-[#eee]">Platform Overview</h1>
            <p className="text-sm text-[#777] dark:text-[#aaa]">Real-time feed of all winning trades across the main platform.</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
            <div className="rounded-lg border border-[#e5e5e5] bg-white p-6 shadow-sm dark:border-[#333] dark:bg-[#151515]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#777] dark:text-[#aaa]">Realized Profits</p>
                  <p className="mt-2 text-3xl font-bold text-[#078a5b] dark:text-[#42d48c]">
                    +${totalProfits.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-full bg-[#e6f7ef] p-3 dark:bg-[#163a2a]">
                  <DollarSign className="size-6 text-[#078a5b] dark:text-[#42d48c]" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#e5e5e5] bg-white p-6 shadow-sm dark:border-[#333] dark:bg-[#151515]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#777] dark:text-[#aaa]">Winning Trades</p>
                  <p className="mt-2 text-3xl font-bold text-[#333] dark:text-[#eee]">
                    {totalWinningTrades}
                  </p>
                </div>
                <div className="rounded-full bg-[#f3f4f5] p-3 dark:bg-[#202020]">
                  <Activity className="size-6 text-[#555] dark:text-[#ccc]" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#e5e5e5] bg-white p-6 shadow-sm dark:border-[#333] dark:bg-[#151515]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#777] dark:text-[#aaa]">Active Winners</p>
                  <p className="mt-2 text-3xl font-bold text-[#333] dark:text-[#eee]">
                    {uniqueUsers}
                  </p>
                </div>
                <div className="rounded-full bg-[#f3f4f5] p-3 dark:bg-[#202020]">
                  <Users className="size-6 text-[#555] dark:text-[#ccc]" />
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-[#e5e5e5] bg-white shadow-sm dark:border-[#333] dark:bg-[#151515]">
            <div className="border-b border-[#e5e5e5] px-6 py-4 dark:border-[#333]">
              <h2 className="text-lg font-semibold text-[#333] dark:text-[#eee]">Live Feed</h2>
            </div>
            
            {isLoading ? (
              <div className="p-8 text-center text-sm text-[#777] dark:text-[#aaa]">Loading profits...</div>
            ) : trades.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#777] dark:text-[#aaa]">No winning trades recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[#555] dark:text-[#ccc]">
                  <thead className="bg-[#f8f8f8] text-xs uppercase text-[#777] dark:bg-[#202020] dark:text-[#aaa]">
                    <tr>
                      <th className="px-6 py-3">Trader</th>
                      <th className="px-6 py-3">Symbol</th>
                      <th className="px-6 py-3">Time</th>
                      <th className="px-6 py-3 text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((trade) => (
                      <tr key={trade.id} className="border-b border-[#e5e5e5] last:border-0 hover:bg-[#f8f8f8] dark:border-[#333] dark:hover:bg-[#202020]">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-[#333] dark:text-[#eee]">
                          {trade.users?.email || "Unknown Trader"}
                        </p>
                        </td>
                        <td className="px-6 py-4 font-medium">{trade.symbol}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {new Date(trade.closed_at || Date.now()).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-[#078a5b] dark:text-[#42d48c]">
                          +${Number(trade.profit_loss).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
