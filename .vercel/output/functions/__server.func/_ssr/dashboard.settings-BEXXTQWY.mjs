import { K as reactExports, j as jsxRuntimeExports } from "./index.mjs";
import { u as useAuth, d as buildOAuthUrl, b as supabase, t as toast } from "./router-BtJUm4Bw.mjs";
import { B as Button } from "./button-DWMTRLlu.mjs";
import { I as Input } from "./input-DS0ndUjQ.mjs";
import { T as Trash2, L as Label, S as Switch } from "./switch-D92KhjSM.mjs";
import { P as Plug } from "./plug-CcVKMJ69.mjs";
import "node:events";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "./clsx-DgYk2OaC.mjs";
import "./createLucideIcon-PCEr6oYE.mjs";
import "./index-CBd3c19k.mjs";
import "./index-GFW5LlN8.mjs";
function SettingsPage() {
  const {
    user
  } = useAuth();
  const [accounts, setAccounts] = reactExports.useState([]);
  const [settings, setSettings] = reactExports.useState(null);
  async function load() {
    if (!user) return;
    const [{
      data: accs
    }, {
      data: sett
    }] = await Promise.all([supabase.from("sessions").select("*").eq("user_id", user.id).order("is_demo"), supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle()]);
    setAccounts(accs ?? []);
    setSettings(sett ?? {
      default_stake: 1,
      default_duration: "5t",
      preferred_symbol: "R_100",
      theme: "dark"
    });
  }
  reactExports.useEffect(() => {
    load();
  }, [user]);
  async function disconnect(id) {
    await supabase.from("sessions").delete().eq("id", id);
    toast.success("Account disconnected");
    load();
  }
  async function saveSettings() {
    if (!user || !settings) return;
    const {
      error
    } = await supabase.from("user_settings").upsert({
      ...settings,
      user_id: user.id
    });
    if (error) toast.error(error.message);
    else toast.success("Settings saved");
  }
  async function deleteAccount() {
    if (!user) return;
    if (!confirm("Permanently delete your account and all data?")) return;
    await supabase.from("sessions").delete().eq("user_id", user.id);
    await supabase.from("trades").delete().eq("user_id", user.id);
    await supabase.from("bots").delete().eq("user_id", user.id);
    await supabase.auth.signOut();
    toast.success("Account data cleared.");
    window.location.href = "/";
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "max-w-3xl space-y-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "Settings" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Manage your Deriv connections, risk controls, and account." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "glass-card rounded-xl p-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-4 flex items-center justify-between", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-sm font-medium", children: "Deriv accounts" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { size: "sm", onClick: () => window.location.href = buildOAuthUrl(), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Plug, { className: "mr-1 size-4" }),
          " Connect / Reconnect"
        ] })
      ] }),
      accounts.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "No accounts connected yet." }) : /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "divide-y divide-glass-border", children: accounts.map((a) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex items-center justify-between py-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono text-sm", children: a.account_id }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${a.is_demo ? "bg-foreground/5 text-muted-foreground" : "bg-success/20 text-success"}`, children: a.is_demo ? "Demo" : "Live" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "font-mono text-xs text-muted-foreground", children: [
            Number(a.balance ?? 0).toFixed(2),
            " ",
            a.currency
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "icon", variant: "ghost", onClick: () => disconnect(a.id), children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "size-4" }) })
      ] }, a.id)) })
    ] }),
    settings && /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "glass-card rounded-xl p-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mb-4 text-sm font-medium", children: "Risk controls" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Daily loss limit (USD)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { type: "number", value: settings.daily_loss_limit, onChange: (e) => setSettings({
            ...settings,
            daily_loss_limit: Number(e.target.value)
          }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Max stake per trade" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { type: "number", value: settings.max_stake, onChange: (e) => setSettings({
            ...settings,
            max_stake: Number(e.target.value)
          }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Max consecutive losses" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { type: "number", value: settings.max_consecutive_losses, onChange: (e) => setSettings({
            ...settings,
            max_consecutive_losses: Number(e.target.value)
          }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between rounded-lg border border-glass-border bg-foreground/[0.02] p-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Default to demo" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[11px] text-muted-foreground", children: "New trades & bots default to demo." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Switch, { checked: settings.default_demo, onCheckedChange: (v) => setSettings({
            ...settings,
            default_demo: v
          }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { className: "mt-4", onClick: saveSettings, children: "Save settings" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "glass-card rounded-xl border-destructive/30 p-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-sm font-medium text-destructive", children: "Danger zone" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Permanently remove your data from ArkTrader Hub." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "destructive", className: "mt-4", onClick: deleteAccount, children: "Delete account & data" })
    ] })
  ] });
}
export {
  SettingsPage as component
};
