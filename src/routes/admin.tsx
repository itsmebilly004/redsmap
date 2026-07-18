import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopShell } from "@/components/top-shell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Activity, TrendingUp, Users, DollarSign, Shield, Trash2, Plus, Download, RefreshCw, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { disconnectAll } from "@/lib/deriv";
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { createClient } from "@supabase/supabase-js";

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

type CloneUser = {
  id: string;
  email: string | null;
  created_at: string;
};

const supabaseAdminClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);

function AdminProfitsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [allTrades, setAllTrades] = useState<any[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});
  
  const [totalProfits, setTotalProfits] = useState(0);
  const [totalWinningTrades, setTotalWinningTrades] = useState(0);
  const [uniqueUsers, setUniqueUsers] = useState(0);
  const [chartData, setChartData] = useState<{ date: string; profit: number }[]>([]);
  
  const [referees, setReferees] = useState<{ id: string; name: string }[]>([]);
  const [newRefereeName, setNewRefereeName] = useState("");
  const [refereeProfits, setRefereeProfits] = useState<Record<string, number>>({});

  const [cloneUsers, setCloneUsers] = useState<CloneUser[]>([]);
  const [newCloneEmail, setNewCloneEmail] = useState("");
  const [newClonePassword, setNewClonePassword] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  
  // Advanced reporting & analytics
  const [reportStartDate, setReportStartDate] = useState<string>("");
  const [reportEndDate, setReportEndDate] = useState<string>("");
  const [selectedRefereeDetails, setSelectedRefereeDetails] = useState<{id: string, name: string} | null>(null);
  const [selectedRefereeChartData, setSelectedRefereeChartData] = useState<{ date: string; profit: number }[]>([]);
  const [refereeModalStartDate, setRefereeModalStartDate] = useState<string>("");
  const [refereeModalEndDate, setRefereeModalEndDate] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);

  const fetchCloneUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, created_at")
      .eq("is_clone_user", true)
      .order("created_at", { ascending: false });
    
    if (error) {
      toast.error("Error fetching clone users: " + error.message);
    }
    if (data) setCloneUsers(data);
  };

  useEffect(() => {
    async function checkAuthAndLoad() {
      if (authLoading) return;
      if (!user) {
        setIsLoading(false);
        setIsAdmin(false);
        return;
      }

      setIsLoading(true);

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (profileError) {
        toast.error(`Auth check failed: ${profileError.message}`);
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      if (!profile?.is_admin) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      setIsAdmin(true);
      fetchCloneUsers();

      // Fetch the latest 100 for the feed
      const feedPromise = supabase
        .from("trades")
        .select(`
          id,
          profit_loss,
          symbol,
          closed_at,
          user_id,
          users!inner(is_clone_user)
        `)
        .not("deriv_contract_id", "like", "SIM_%")
        .not("deriv_contract_id", "like", "DEMO_%")
        .eq("users.is_clone_user", false)
        .gt("profit_loss", 0)
        .order("closed_at", { ascending: false })
        .limit(100);

      // Fetch aggregations for all time using pagination to avoid 1000 row limits
      let allStats: any[] = [];
      let fetchMore = true;
      let from = 0;
      while (fetchMore) {
        const { data, error } = await supabase
          .from("trades")
          .select("profit_loss, user_id, closed_at, symbol, users!inner(is_clone_user)")
          .not("deriv_contract_id", "like", "SIM_%")
          .not("deriv_contract_id", "like", "DEMO_%")
          .eq("users.is_clone_user", false)
          .gt("profit_loss", 0)
          .range(from, from + 999);
          
        if (error || !data || data.length === 0) {
          fetchMore = false;
        } else {
          allStats = [...allStats, ...data];
          if (data.length < 1000) {
            fetchMore = false;
          } else {
            from += 1000;
          }
        }
      }

      // Fetch referees
      const refsPromise = supabase.from("referees").select("*").order("name");

      const [feedRes, refsRes] = await Promise.all([feedPromise, refsPromise]);

      if (refsRes.data) {
        setReferees(refsRes.data);
      }

      if (!feedRes.error && feedRes.data) {
        const rawTrades = feedRes.data;
        setRecentTrades(rawTrades);
        setAllTrades(allStats);

        const allUserIds = [...new Set([...rawTrades.map(t => t.user_id), ...allStats.map(t => t.user_id)])];
        
        const profileMap: Record<string, any> = {};
        
        if (allUserIds.length > 0) {
          const chunkSize = 200;
          const chunks = [];
          for (let i = 0; i < allUserIds.length; i += chunkSize) {
            chunks.push(allUserIds.slice(i, i + chunkSize));
          }
          
          await Promise.all(chunks.map(async (chunk) => {
            const { data: usersData } = await supabase
              .from("users")
              .select("id, email, referee_id")
              .in("id", chunk);
              
            usersData?.forEach(u => profileMap[u.id] = u);
          }));
          
          setUserProfiles(profileMap);
        }

        const enrichedTrades = rawTrades.map(t => ({
          ...t,
          users: profileMap[t.user_id] || { email: "Unknown Trader" }
        }));
        
        setTrades(enrichedTrades as unknown as TradeRow[]);

        const total = allStats.reduce((sum, t) => sum + Number(t.profit_loss), 0);
        const usersCount = new Set(allStats.map((t) => t.user_id)).size;
        setTotalProfits(total);
        setTotalWinningTrades(allStats.length);
        setUniqueUsers(usersCount);

        const refProfits: Record<string, number> = {};
        const chartAgg: Record<string, number> = {};

        allStats.forEach(t => {
          // Referee aggregation
          const p = profileMap[t.user_id];
          const refId = p?.referee_id || "unreferred";
          refProfits[refId] = (refProfits[refId] || 0) + Number(t.profit_loss);

          // Chart aggregation (by day)
          if (t.closed_at) {
            const dateStr = new Date(t.closed_at).toLocaleDateString();
            chartAgg[dateStr] = (chartAgg[dateStr] || 0) + Number(t.profit_loss);
          }
        });
        setRefereeProfits(refProfits);

        const sortedChartData = Object.keys(chartAgg)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
          .map(date => ({ date, profit: chartAgg[date] }));
        
        setChartData(sortedChartData);
      }

      setIsLoading(false);
    }
    checkAuthAndLoad();

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

                  // Update chart data incrementally
                  setChartData(prevChart => {
                    const dateStr = new Date().toLocaleDateString();
                    const newChart = [...prevChart];
                    const existing = newChart.find(c => c.date === dateStr);
                    if (existing) {
                      existing.profit += Number(newTrade.profit_loss);
                    } else {
                      newChart.push({ date: dateStr, profit: Number(newTrade.profit_loss) });
                    }
                    return newChart;
                  });

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

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoginLoading(false);
      return;
    }

    if (authData.user) {
      // Verify admin status immediately
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile?.is_admin) {
        await supabase.auth.signOut();
        toast.error("Account does not have administrator privileges.");
        setLoginLoading(false);
        return;
      }
    }

    toast.success("Admin logged in successfully");
    setLoginLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/admin" });
  };

  const handleClearCache = () => {
    const supabaseKeys = Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    const authValues = supabaseKeys.map(k => ({ key: k, value: localStorage.getItem(k) }));

    localStorage.clear();
    sessionStorage.clear();

    authValues.forEach(({ key, value }) => {
      if (value) localStorage.setItem(key, value);
    });

    toast.success("System cache cleared. Reloading in 1s...");
    setTimeout(() => {
      window.location.reload();
    }, 1000);
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
    
    // First, set referee_id to null for any users assigned to this referee
    // to prevent foreign key constraint violations
    await supabase.from("users").update({ referee_id: null }).eq("referee_id", id);

    const { error } = await supabase.from("referees").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    
    setReferees(referees.filter(r => r.id !== id));
    toast.success("Referee deleted");
  };

  const handleDownloadReport = async (refereeId: string, refereeName: string) => {
    toast.success(`Generating report for ${refereeName}...`);
    
    let query = supabase.from("trades").select(`
      id, profit_loss, symbol, closed_at, user_id, users!inner(is_clone_user)
    `).not("deriv_contract_id", "like", "SIM_%").not("deriv_contract_id", "like", "DEMO_%").eq("users.is_clone_user", false).gt("profit_loss", 0);

    if (reportStartDate) {
      query = query.gte("closed_at", new Date(reportStartDate).toISOString());
    }
    if (reportEndDate) {
      const end = new Date(reportEndDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte("closed_at", end.toISOString());
    }

    const { data: tradesData } = await query;
    if (!tradesData) return;

    // Filter manually because foreign tables in supabase-js are tricky for top-level filtering
    const { data: usersData } = await supabase.from("users").select("id, email, referee_id");
    const userProfiles = (usersData || []).reduce((acc: any, u) => {
      acc[u.id] = u;
      return acc;
    }, {});

    let refereeTrades = tradesData;
    
    if (refereeId !== "general") {
      refereeTrades = tradesData.filter(t => {
        const u = userProfiles[t.user_id];
        if (refereeId === "unreferred") return !u || !u.referee_id;
        return u && u.referee_id === refereeId;
      });
    }

    const doc = new jsPDF();
    
    // Branding Header
    doc.setFontSize(22);
    doc.setTextColor(7, 138, 91); // Redsmap Traders Green
    doc.text("Redsmap Traders", 14, 20);
    
    doc.setFontSize(14);
    doc.setTextColor(51, 51, 51);
    doc.text(`Performance Report: ${refereeName}`, 14, 30);
    
    doc.setFontSize(10);
    doc.setTextColor(119, 119, 119);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 38);
    
    if (reportStartDate || reportEndDate) {
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const dateText = `Date Range: ${reportStartDate || 'Beginning'} to ${reportEndDate || 'Now'}`;
      doc.text(dateText, 14, 43);
    }
    
    const totalVol = refereeTrades.reduce((sum, t) => sum + Number(t.profit_loss), 0);
    doc.setTextColor(7, 138, 91);
    doc.text(`Total Profit Volume: $${totalVol.toFixed(2)}`, 14, 51);

    const tableData = refereeTrades.map(t => [
      t.closed_at ? new Date(t.closed_at).toLocaleString() : "Unknown",
      userProfiles[t.user_id]?.email || "Unknown",
      t.symbol,
      `+$${Number(t.profit_loss).toFixed(2)}`
    ]);

    if (tableData.length === 0) {
      tableData.push(["No data for this period", "-", "-", "$0.00"]);
    }

    try {
      if (typeof (doc as any).autoTable === "function") {
        (doc as any).autoTable({
          startY: 60,
          head: [['Time', 'Trader', 'Asset', 'Profit (USD)']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [7, 138, 91] }
        });
      } else {
        autoTable(doc, {
          startY: 60,
          head: [['Time', 'Trader', 'Asset', 'Profit (USD)']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [7, 138, 91] }
        });
      }
    } catch (err) {
      console.warn("AutoTable failed", err);
      doc.text("Table generation failed (plugin error).", 14, 60);
    }

    doc.save(`Redsmap_report_${refereeName.replace(/\s+/g, '_')}.pdf`);
  };

  const handleRefereeClick = (id: string, name: string) => {
    setSelectedRefereeDetails({ id, name });
    
    let refereeTrades = allTrades;
    if (id !== "general") {
      refereeTrades = allTrades.filter(t => {
        const u = userProfiles[t.user_id];
        if (id === "unreferred") return !u || !u.referee_id;
        return u && u.referee_id === id;
      });
    }

    const grouped = refereeTrades.reduce((acc, t) => {
      const date = new Date(t.closed_at || Date.now()).toLocaleDateString();
      acc[date] = (acc[date] || 0) + Number(t.profit_loss);
      return acc;
    }, {} as Record<string, number>);

    let chartData = Object.keys(grouped).map(date => ({
      date,
      profit: grouped[date]
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (chartData.length === 0) {
      const emptyData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        emptyData.push({ date: d.toLocaleDateString(), profit: 0 });
      }
      chartData = emptyData;
    } else if (chartData.length === 1) {
      const d = new Date(chartData[0].date);
      d.setDate(d.getDate() - 1);
      chartData.unshift({ date: d.toLocaleDateString(), profit: 0 });
    }

    setSelectedRefereeChartData(chartData);
  };

  const handleCreateCloneUser = async () => {
    if (!newCloneEmail.trim() || !newClonePassword.trim()) return;
    setCreateLoading(true);
    
    const { data: authData, error: authError } = await supabaseAdminClient.auth.signUp({
      email: newCloneEmail.trim(),
      password: newClonePassword,
    });

    if (authError) {
      toast.error(authError.message);
      setCreateLoading(false);
      return;
    }

    if (authData.user) {
      let attempts = 0;
      const markAsClone = async () => {
        const { data, error: updateError } = await supabase
          .from("users")
          .upsert({ 
            id: authData.user!.id, 
            email: authData.user!.email, 
            is_clone_user: true 
          })
          .select();
          
        if (updateError) {
          toast.error("Error setting clone status: " + updateError.message);
          setCreateLoading(false);
        } else if (!data || data.length === 0) {
          if (attempts < 5) {
            attempts++;
            setTimeout(markAsClone, 1000);
          } else {
            toast.error("Account created in Auth, but database trigger timed out.");
            setCreateLoading(false);
          }
        } else {
          toast.success("Clone user created successfully!");
          fetchCloneUsers();
          setNewCloneEmail("");
          setNewClonePassword("");
          setCreateLoading(false);
        }
      };
      
      setTimeout(markAsClone, 1000);
    } else {
      setCreateLoading(false);
    }
  };

  const handleDeleteCloneUser = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this clone user?")) return;
    const { error } = await supabase.rpc("delete_clone_user", { target_user_id: id });
    if (error) {
      toast.error("Failed to delete user: " + error.message);
      return;
    }
    toast.success("Clone user deleted");
    setCloneUsers(cloneUsers.filter(u => u.id !== id));
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
                  placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
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

  let displayChartData = selectedRefereeChartData;
  if (refereeModalStartDate || refereeModalEndDate) {
    displayChartData = displayChartData.filter(d => {
      const dDate = new Date(d.date);
      if (refereeModalStartDate && dDate < new Date(refereeModalStartDate)) return false;
      if (refereeModalEndDate) {
        const end = new Date(refereeModalEndDate);
        end.setHours(23, 59, 59, 999);
        if (dDate > end) return false;
      }
      return true;
    });
  }

  return (
    <TopShell>
      <div className="flex-1 overflow-auto p-4 sm:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#333] dark:text-[#eee]">Platform Overview</h1>
              <p className="text-sm text-[#777] dark:text-[#aaa]">Real-time feed of all winning trades and traffic.</p>
            </div>
            <Button onClick={handleClearCache} variant="outline" className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-red-900/50 dark:hover:bg-red-900/20">
              <ServerCrash className="mr-2 size-4" /> Clear System Cache
            </Button>
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

          {/* Growth Chart */}
          <div className="rounded-lg border border-[#e5e5e5] bg-white shadow-sm dark:border-[#333] dark:bg-[#151515] mb-8 p-6 h-80">
            <h2 className="text-lg font-semibold text-[#333] dark:text-[#eee] mb-4">Profit Growth Over Time</h2>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#078a5b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#078a5b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#151515', borderColor: '#333', color: '#eee', borderRadius: '8px' }}
                  itemStyle={{ color: '#078a5b' }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Profit']}
                />
                <Area type="monotone" dataKey="profit" stroke="#078a5b" fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 mb-8">
            {/* Clone User Management Panel */}
            <div className="col-span-1 rounded-lg border border-[#e5e5e5] bg-white shadow-sm dark:border-[#333] dark:bg-[#151515]">
              <div className="border-b border-[#e5e5e5] px-6 py-4 dark:border-[#333]">
                <h2 className="text-lg font-semibold text-[#333] dark:text-[#eee]">Clone Users Setup</h2>
              </div>
              <div className="p-6">
                <div className="flex gap-2 mb-6">
                  <Input 
                    value={newCloneEmail}
                    onChange={e => setNewCloneEmail(e.target.value)}
                    placeholder="Email"
                    type="email"
                    className="flex-1 bg-transparent border-[#e5e5e5] dark:border-[#333] text-[#333] dark:text-[#eee]"
                  />
                  <Input 
                    value={newClonePassword}
                    onChange={e => setNewClonePassword(e.target.value)}
                    placeholder="Password"
                    type="password"
                    className="flex-1 bg-transparent border-[#e5e5e5] dark:border-[#333] text-[#333] dark:text-[#eee]"
                  />
                  <Button onClick={handleCreateCloneUser} disabled={createLoading} className="bg-[#4bb4b3] text-white hover:bg-[#3ca09f]">
                    {createLoading ? <RefreshCw className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  </Button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {cloneUsers.map(u => (
                    <div key={u.id} className="flex items-center justify-between rounded-md border border-[#eee] bg-[#fafafa] p-3 dark:border-[#2b2b2b] dark:bg-[#111]">
                      <span className="font-medium text-[#333] dark:text-[#eee]">{u.email}</span>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteCloneUser(u.id)} className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-[#2a1010]">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {cloneUsers.length === 0 && (
                    <p className="text-sm text-[#777] dark:text-[#aaa] text-center py-4">No clone users created.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Referee Management Panel */}
            <div className="col-span-1 rounded-lg border border-[#e5e5e5] bg-white shadow-sm dark:border-[#333] dark:bg-[#151515]">
              <div className="flex flex-col gap-3 border-b border-[#e5e5e5] px-6 py-4 dark:border-[#333]">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-[#333] dark:text-[#eee]">Referee Analytics & Reports</h2>
                  <Button variant="outline" size="sm" onClick={() => handleDownloadReport("general", "All Platforms")} className="text-[#078a5b] border-[#078a5b]/20 hover:bg-[#078a5b]/10">
                    <Download className="mr-2 size-4" /> General Report
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#555] dark:text-[#ccc]">
                  <span>Filter Date:</span>
                  <Input 
                    type="date" 
                    value={reportStartDate} 
                    onChange={e => setReportStartDate(e.target.value)} 
                    className="h-8 w-36 bg-transparent dark:border-[#333]" 
                  />
                  <span>to</span>
                  <Input 
                    type="date" 
                    value={reportEndDate} 
                    onChange={e => setReportEndDate(e.target.value)} 
                    className="h-8 w-36 bg-transparent dark:border-[#333]" 
                  />
                </div>
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
                    <Plus className="mr-2 size-4" /> Add
                  </Button>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {referees.map(r => (
                    <div key={r.id} className="flex items-center justify-between rounded-md border border-[#eee] bg-[#fafafa] p-3 dark:border-[#2b2b2b] dark:bg-[#111]">
                      <div className="flex flex-col">
                        <span className="font-medium text-[#333] dark:text-[#eee] cursor-pointer hover:underline" onClick={() => handleRefereeClick(r.id, r.name)}>{r.name}</span>
                        <span className="text-xs font-bold text-[#078a5b] dark:text-[#42d48c]">Vol: ${(refereeProfits[r.id] || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleDownloadReport(r.id, r.name)} className="text-[#555] hover:bg-[#eaeaea] dark:text-[#ccc] dark:hover:bg-[#222]">
                          <Download className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteReferee(r.id)} className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-[#2a1010]">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-4 border-t border-[#eee] dark:border-[#333]">
                    <span className="font-medium text-[#999] dark:text-[#888] cursor-pointer hover:underline" onClick={() => handleRefereeClick("unreferred", "Unreferred Traffic")}>Unreferred Traffic</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#078a5b] dark:text-[#42d48c]">
                        ${(refereeProfits["unreferred"] || 0).toFixed(2)}
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => handleDownloadReport("unreferred", "Unreferred Traffic")} className="text-[#555] hover:bg-[#eaeaea] dark:text-[#ccc] dark:hover:bg-[#222]">
                        <Download className="size-4" />
                      </Button>
                    </div>
                  </div>
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

          {/* Referee Details Modal */}
          {selectedRefereeDetails && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-3xl rounded-xl border border-[#e5e5e5] bg-white p-6 shadow-xl dark:border-[#333] dark:bg-[#151515]">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-[#333] dark:text-[#eee]">{selectedRefereeDetails.name}</h2>
                    <p className="text-sm text-[#777] dark:text-[#aaa]">Performance Distribution Over Time</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-[#555] dark:text-[#ccc]">
                      <Input 
                        type="date" 
                        value={refereeModalStartDate} 
                        onChange={e => setRefereeModalStartDate(e.target.value)} 
                        className="h-8 w-36 bg-transparent dark:border-[#333]" 
                      />
                      <span>to</span>
                      <Input 
                        type="date" 
                        value={refereeModalEndDate} 
                        onChange={e => setRefereeModalEndDate(e.target.value)} 
                        className="h-8 w-36 bg-transparent dark:border-[#333]" 
                      />
                    </div>
                    <Button variant="ghost" onClick={() => setSelectedRefereeDetails(null)} className="text-[#555] hover:bg-[#eaeaea] dark:text-[#ccc] dark:hover:bg-[#222]">
                      Close
                    </Button>
                  </div>
                </div>
                
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={displayChartData}>
                      <defs>
                        <linearGradient id="colorProfitRef" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#078a5b" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#078a5b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                      <RechartsTooltip contentStyle={{ backgroundColor: "#151515", border: "none", borderRadius: "8px", color: "#eee" }} />
                      <Area type="monotone" dataKey="profit" stroke="#078a5b" strokeWidth={2} fillOpacity={1} fill="url(#colorProfitRef)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </TopShell>
  );
}
