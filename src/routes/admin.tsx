import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopShell } from "@/components/top-shell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Activity, TrendingUp, Users, DollarSign, Shield, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { disconnectAll } from "@/lib/deriv";

export const Route = createFileRoute("/admin")({
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
    referee_id?: string;
  };
};

function AdminProfitsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [totalProfits, setTotalProfits] = useState(0);
  const [totalWinningTrades, setTotalWinningTrades] = useState(0);
  const [uniqueUsers, setUniqueUsers] = useState(0);
  
  const [referees, setReferees] = useState<{ id: string; name: string }[]>([]);
  const [newRefereeName, setNewRefereeName] = useState("");
  const [refereeProfits, setRefereeProfits] = useState<Record<string, number>>({});
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAuthAndLoad() {
      if (authLoading) return;
      if (!user) {
        setIsLoading(false);
        setIsAdmin(false);
        return;
      }

      setIsLoading(true);

      const { data: profile } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      setIsAdmin(true);

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
        .not("deriv_contract_id", "like", "DEMO_%")
        .gt("profit_loss", 0)
        .order("closed_at", { ascending: false })
        .limit(100);

      // Fetch aggregations for all time
      const statsPromise = supabase
        .from("trades")
        .select("profit_loss, user_id")
        .not("deriv_contract_id", "like", "SIM_%")
        .not("deriv_contract_id", "like", "DEMO_%")
        .gt("profit_loss", 0);

      // Fetch referees
      const refsPromise = supabase.from("referees").select("*").order("name");

      const [feedRes, statsRes, refsRes] = await Promise.all([feedPromise, statsPromise, refsPromise]);

      if (refsRes.data) {
        setReferees(refsRes.data);
      }

      if (!feedRes.error && feedRes.data && !statsRes.error && statsRes.data) {
        const rawTrades = feedRes.data;
        const allUserIds = [...new Set([...rawTrades.map(t => t.user_id), ...statsRes.data.map(t => t.user_id)])];
        
        const profileMap = new Map();
        
        if (allUserIds.length > 0) {
          const { data: usersData } = await supabase
            .from("users")
            .select("id, email, referee_id")
            .in("id", allUserIds);
            
          usersData?.forEach(u => profileMap.set(u.id, u));
        }

        const enrichedTrades = rawTrades.map(t => ({
          ...t,
          users: profileMap.get(t.user_id) || { email: "Unknown Trader" }
        }));
        
        setTrades(enrichedTrades as unknown as TradeRow[]);

        const total = statsRes.data.reduce((sum, t) => sum + Number(t.profit_loss), 0);
        const usersCount = new Set(statsRes.data.map((t) => t.user_id)).size;
        setTotalProfits(total);
        setTotalWinningTrades(statsRes.data.length);
        setUniqueUsers(usersCount);

        const refProfits: Record<string, number> = {};
        statsRes.data.forEach(t => {
          const p = profileMap.get(t.user_id);
          const refId = p?.referee_id || "unreferred";
          refProfits[refId] = (refProfits[refId] || 0) + Number(t.profit_loss);
        });
        setRefereeProfits(refProfits);
      }

      setIsLoading(false);
    }
    checkAuthAndLoad();

    // Subscribe to new trades only if admin
    if (!isAdmin) return;
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
          const newTrade = payload.new as any;
          const oldTrade = payload.old as any;
          
          if (newTrade.deriv_contract_id?.startsWith("SIM_") || newTrade.deriv_contract_id?.startsWith("DEMO_")) return;
          if (oldTrade && oldTrade.profit_loss > 0) return;

          supabase
            .from("users")
            .select("email, referee_id")
            .eq("id", newTrade.user_id)
            .single()
            .then(({ data: userProfile }) => {
              if (userProfile) {
                setTrades((prev) => {
                  if (prev.some(t => t.id === newTrade.id)) return prev;
                  
                  setTotalProfits((p) => p + Number(newTrade.profit_loss));
                  setTotalWinningTrades((p) => p + 1);
                  
                  const refId = userProfile.referee_id || "unreferred";
                  setRefereeProfits((rp) => ({
                    ...rp,
                    [refId]: (rp[refId] || 0) + Number(newTrade.profit_loss)
                  }));

                  return [
                    {
                      ...newTrade,
                      users: userProfile,
                    },
                    ...prev,
                  ].slice(0, 100);
                });
              }
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading, isAdmin]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoginLoading(false);
    } else {
      toast.success("Admin logged in successfully");
    }
  };

  const handleSignOut = async () => {
    disconnectAll();
    await supabase.auth.signOut();
    navigate({ to: "/admin" });
  };

  const handleAddReferee = async () => {
    if (!newRefereeName.trim()) return;
    const { data, error } = await supabase.from("referees").insert({ name: newRefereeName.trim() }).select().single();
    if (error) { toast.error(error.message); return; }
    if (data) setReferees([...referees, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewRefereeName("");
    toast.success("Referee added");
  };

  const handleDeleteReferee = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this referee? This will orphan users assigned to them.")) return;
    const { error } = await supabase.from("referees").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setReferees(referees.filter(r => r.id !== id));
    toast.success("Referee deleted");
  };

  if (authLoading || isLoading) {
    return (
      <TopShell>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#4bb4b3] border-t-transparent" />
        </div>
      </TopShell>
    );
  }

  if (!user) {
    return (
      <TopShell>
        <div className="flex flex-1 flex-col items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-[#e5e5e5] bg-white p-8 shadow-sm dark:border-[#333] dark:bg-[#151515]">
            <div className="mb-8 text-center">
              <Shield className="mx-auto mb-4 h-16 w-16 text-[#4bb4b3]" />
              <h1 className="mb-2 text-2xl font-bold text-[#333] dark:text-[#eee]">Admin Login</h1>
              <p className="text-sm text-[#777] dark:text-[#aaa]">
                Sign in with your administrator credentials.
              </p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#333] dark:text-[#eee]">Email</label>
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-transparent"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#333] dark:text-[#eee]">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-transparent"
                />
              </div>
              <Button type="submit" className="w-full bg-[#4bb4b3] text-white hover:bg-[#3ca09f]" disabled={loginLoading}>
                {loginLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </div>
        </div>
      </TopShell>
    );
  }

  if (isAdmin === false) {
    return (
      <TopShell>
        <div className="flex flex-1 flex-col items-center justify-center p-4">
          <div className="max-w-md text-center">
            <Shield className="mx-auto mb-4 h-16 w-16 text-red-500" />
            <h1 className="mb-2 text-2xl font-bold text-[#333] dark:text-[#eee]">Access Denied</h1>
            <p className="mb-6 text-[#777] dark:text-[#aaa]">
              Your connected account does not have administrator privileges.
            </p>
            <Button onClick={handleSignOut} variant="outline" className="border-[#e5e5e5] dark:border-[#333]">
              Sign out to log in as Admin
            </Button>
          </div>
        </div>
      </TopShell>
    );
  }

  return (
    <TopShell>
      <div className="flex-1 overflow-auto p-4 sm:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#333] dark:text-[#eee]">Platform Overview</h1>
            <p className="text-sm text-[#777] dark:text-[#aaa]">Real-time feed of all winning trades and traffic.</p>
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
                    {totalWinningTrades.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-full bg-[#f3f4f6] p-3 dark:bg-[#222]">
                  <TrendingUp className="size-6 text-[#4bb4b3]" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#e5e5e5] bg-white p-6 shadow-sm dark:border-[#333] dark:bg-[#151515]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#777] dark:text-[#aaa]">Active Profiting Traders</p>
                  <p className="mt-2 text-3xl font-bold text-[#333] dark:text-[#eee]">
                    {uniqueUsers.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-full bg-[#f3f4f6] p-3 dark:bg-[#222]">
                  <Users className="size-6 text-[#4bb4b3]" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 mb-8">
            {/* Referee Volume Panel */}
            <div className="col-span-1 rounded-lg border border-[#e5e5e5] bg-white shadow-sm dark:border-[#333] dark:bg-[#151515]">
              <div className="border-b border-[#e5e5e5] px-6 py-4 dark:border-[#333]">
                <h2 className="text-lg font-semibold text-[#333] dark:text-[#eee]">Trade Volume by Referee</h2>
              </div>
              <div className="p-6 space-y-4">
                {referees.map(r => (
                  <div key={r.id} className="flex items-center justify-between">
                    <span className="font-medium text-[#555] dark:text-[#ccc]">{r.name}</span>
                    <span className="font-bold text-[#078a5b] dark:text-[#42d48c]">
                      ${(refereeProfits[r.id] || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-4 border-t border-[#eee] dark:border-[#333]">
                  <span className="font-medium text-[#999] dark:text-[#888]">Unreferred Traffic</span>
                  <span className="font-bold text-[#078a5b] dark:text-[#42d48c]">
                    ${(refereeProfits["unreferred"] || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Referee Management Panel */}
            <div className="col-span-1 lg:col-span-2 rounded-lg border border-[#e5e5e5] bg-white shadow-sm dark:border-[#333] dark:bg-[#151515]">
              <div className="border-b border-[#e5e5e5] px-6 py-4 dark:border-[#333]">
                <h2 className="text-lg font-semibold text-[#333] dark:text-[#eee]">Referee Management</h2>
              </div>
              <div className="p-6">
                <div className="flex gap-2 mb-6">
                  <Input 
                    value={newRefereeName}
                    onChange={e => setNewRefereeName(e.target.value)}
                    placeholder="Enter new referee name..."
                    className="flex-1 bg-transparent border-[#e5e5e5] dark:border-[#333] text-[#333] dark:text-[#eee]"
                  />
                  <Button onClick={handleAddReferee} className="bg-[#4bb4b3] text-white hover:bg-[#3ca09f]">
                    <Plus className="mr-2 size-4" /> Add Referee
                  </Button>
                </div>

                <div className="space-y-2">
                  {referees.map(r => (
                    <div key={r.id} className="flex items-center justify-between rounded-md border border-[#eee] bg-[#fafafa] p-3 dark:border-[#2b2b2b] dark:bg-[#111]">
                      <span className="font-medium text-[#333] dark:text-[#eee]">{r.name}</span>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteReferee(r.id)} className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-[#2a1010]">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {referees.length === 0 && (
                    <p className="text-sm text-[#777] dark:text-[#aaa] text-center py-4">No referees created yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-[#e5e5e5] bg-white shadow-sm dark:border-[#333] dark:bg-[#151515]">
            <div className="border-b border-[#e5e5e5] px-6 py-4 dark:border-[#333]">
              <h2 className="text-lg font-semibold text-[#333] dark:text-[#eee]">Live Feed (Last 100 Trades)</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#555] dark:text-[#ccc]">
                <thead className="bg-[#fbfbfb] text-[#777] dark:bg-[#111] dark:text-[#aaa]">
                  <tr>
                    <th className="px-6 py-3 font-medium">Time</th>
                    <th className="px-6 py-3 font-medium">Trader</th>
                    <th className="px-6 py-3 font-medium">Asset</th>
                    <th className="px-6 py-3 font-medium text-right">Profit (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e5e5] dark:divide-[#333]">
                  {trades.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-[#777] dark:text-[#aaa]">
                        <Activity className="mx-auto mb-2 size-6 opacity-50" />
                        No profiting trades yet.
                      </td>
                    </tr>
                  ) : (
                    trades.map((trade) => (
                      <tr key={trade.id} className="transition-colors hover:bg-[#fbfbfb] dark:hover:bg-[#111]">
                        <td className="whitespace-nowrap px-6 py-4 text-[#555] dark:text-[#ccc]">
                          {new Date(trade.closed_at || Date.now()).toLocaleTimeString()}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 font-medium text-[#333] dark:text-[#eee]">
                          {trade.users?.email || "Unknown Trader"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className="inline-flex items-center rounded-full bg-[#f3f4f6] px-2.5 py-0.5 text-xs font-medium text-[#555] dark:bg-[#222] dark:text-[#ccc]">
                            {trade.symbol}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right font-bold text-[#078a5b] dark:text-[#42d48c]">
                          +${Number(trade.profit_loss).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </TopShell>
  );
}
