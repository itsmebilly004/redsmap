import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { buildOAuthUrl } from "@/lib/deriv";
import { Plug, Trash2 } from "lucide-react";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: accs, error: accsErr }, { data: sett, error: settErr }] = await Promise.all([
      supabase.from("sessions").select("*").eq("user_id", user.id).order("is_demo"),
      supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    if (accsErr) { toast.error("Could not load accounts"); return; }
    if (settErr) { toast.error("Could not load settings"); return; }
    setAccounts(accs ?? []);
    setSettings(sett ?? { default_stake: 1, default_duration: "5t", preferred_symbol: "R_100", theme: "dark" });
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function disconnect(id: string) {
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) { toast.error("Failed to disconnect account"); return; }
    toast.success("Account disconnected");
    load();
  }

  async function saveSettings() {
    if (!user || !settings) return;
    const { error } = await supabase.from("user_settings").upsert({ ...settings, user_id: user.id });
    if (error) toast.error(error.message);
    else toast.success("Settings saved");
  }

  async function deleteAccount() {
    if (!user) return;
    if (!confirm("Permanently delete your account and all data?")) return;
    const results = await Promise.all([
      supabase.from("sessions").delete().eq("user_id", user.id),
      supabase.from("trades").delete().eq("user_id", user.id),
      supabase.from("bots").delete().eq("user_id", user.id),
    ]);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast.error("Partial deletion failed: " + failed.error.message);
      return;
    }
    await supabase.auth.signOut();
    toast.success("Account data cleared.");
    window.location.href = "/";
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your Deriv connections, risk controls, and account.</p>
      </div>

      <section className="glass-card rounded-xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium">Deriv accounts</h3>
          <Button size="sm" onClick={() => (window.location.href = buildOAuthUrl())}>
            <Plug className="mr-1 size-4" /> Connect / Reconnect
          </Button>
        </div>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts connected yet.</p>
        ) : (
          <ul className="divide-y divide-glass-border">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{a.account_id}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                      a.is_demo ? "bg-foreground/5 text-muted-foreground" : "bg-success/20 text-success"
                    }`}>{a.is_demo ? "Demo" : "Live"}</span>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {Number(a.balance ?? 0).toFixed(2)} {a.currency}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => disconnect(a.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {settings && (
        <section className="glass-card rounded-xl p-5">
          <h3 className="mb-4 text-sm font-medium">Risk controls</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Daily loss limit</Label>
              <Input type="number" value={settings.daily_loss_limit ?? ""} onChange={(e) => setSettings({ ...settings, daily_loss_limit: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Max stake per trade</Label>
              <Input type="number" value={settings.max_stake ?? ""} onChange={(e) => setSettings({ ...settings, max_stake: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Max consecutive losses</Label>
              <Input type="number" value={settings.max_consecutive_losses ?? ""} onChange={(e) => setSettings({ ...settings, max_consecutive_losses: Number(e.target.value) })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-glass-border bg-foreground/[0.02] p-3">
              <div>
                <Label>Default to demo</Label>
                <p className="text-[11px] text-muted-foreground">New trades & bots default to demo.</p>
              </div>
              <Switch checked={!!settings.default_demo} onCheckedChange={(v) => setSettings({ ...settings, default_demo: v })} />
            </div>
          </div>
          <Button className="mt-4" onClick={saveSettings}>Save settings</Button>
        </section>
      )}

      <section className="glass-card rounded-xl border-destructive/30 p-5">
        <h3 className="text-sm font-medium text-destructive">Danger zone</h3>
        <p className="mt-1 text-sm text-muted-foreground">Permanently remove your data from ArkTrader Hub.</p>
        <Button variant="destructive" className="mt-4" onClick={deleteAccount}>Delete account & data</Button>
      </section>
    </div>
  );
}
