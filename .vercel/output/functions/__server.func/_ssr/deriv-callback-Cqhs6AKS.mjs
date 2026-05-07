import { K as reactExports, j as jsxRuntimeExports } from "./index.mjs";
import { a as useNavigate, R as Route$d, s as send, b as supabase, t as toast } from "./router-BtJUm4Bw.mjs";
import { c as createLucideIcon } from "./createLucideIcon-PCEr6oYE.mjs";
import "node:events";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
const __iconNode = [["path", { d: "M21 12a9 9 0 1 1-6.219-8.56", key: "13zald" }]];
const LoaderCircle = createLucideIcon("loader-circle", __iconNode);
function parseAccounts(params) {
  const out = [];
  let i = 1;
  while (params.get(`acct${i}`)) {
    out.push({
      account: params.get(`acct${i}`),
      token: params.get(`token${i}`),
      currency: params.get(`cur${i}`) ?? ""
    });
    i++;
  }
  return out;
}
async function ensureSupabaseSession(primaryAccountId) {
  const {
    data,
    error
  } = await supabase.functions.invoke("deriv-auth", {
    body: {
      derivAccountId: primaryAccountId
    }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  if (!data?.session) throw new Error("No session returned from auth service");
  const {
    error: setErr
  } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token
  });
  if (setErr) throw setErr;
  const {
    data: {
      user
    },
    error: userErr
  } = await supabase.auth.getUser();
  if (userErr || !user) throw userErr ?? new Error("Failed to retrieve user");
  return user;
}
function DerivCallback() {
  const navigate = useNavigate();
  const search = Route$d.useSearch();
  const [status, setStatus] = reactExports.useState("Connecting your Deriv account…");
  const ran = reactExports.useRef(false);
  reactExports.useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const params = new URLSearchParams(search);
        if (!params.get("acct1") && typeof window !== "undefined") {
          const urlParams = new URLSearchParams(window.location.search);
          urlParams.forEach((v, k) => params.set(k, v));
        }
        const accounts = parseAccounts(params);
        if (!accounts.length) {
          throw new Error("No tokens returned from Deriv. Please try again.");
        }
        const primary = accounts.find((a) => !a.account.startsWith("VR")) ?? accounts[0];
        setStatus("Setting up your internal profile…");
        const sessionUser = await ensureSupabaseSession(primary.account);
        for (const acc of accounts) {
          setStatus(`Syncing account ${acc.account}…`);
          let balance = 0;
          let currency = acc.currency;
          try {
            const auth = await send({
              authorize: acc.token
            });
            balance = Number(auth.authorize?.balance ?? 0);
            currency = auth.authorize?.currency ?? currency;
          } catch (e) {
            console.error(`Token validation failed for ${acc.account}`, e);
          }
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString();
          const {
            error: upsertError
          } = await supabase.from("sessions").upsert({
            user_id: sessionUser.id,
            account_id: acc.account,
            deriv_token: acc.token,
            currency,
            balance,
            is_demo: acc.account.startsWith("VR"),
            is_active: true,
            expires_at: expiresAt
          }, {
            onConflict: "user_id,account_id"
          });
          if (upsertError) {
            console.error(`Failed to store token for ${acc.account}`, upsertError);
          }
        }
        toast.success(`Connected ${accounts.length} account${accounts.length > 1 ? "s" : ""} successfully.`);
        navigate({
          to: "/"
        });
      } catch (e) {
        console.error("OAuth Processing Error:", e);
        toast.error(e.message || "Authentication failed. Please check your Deriv connection.");
        navigate({
          to: "/auth",
          search: {
            mode: "signin"
          }
        });
      }
    })();
  }, [navigate]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid min-h-dvh place-items-center bg-background", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card flex flex-col items-center gap-4 rounded-2xl p-8 text-center max-w-sm", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { className: "size-8 animate-spin text-primary" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-semibold text-lg", children: "Authorizing" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: status })
    ] })
  ] }) });
}
export {
  DerivCallback as component
};
