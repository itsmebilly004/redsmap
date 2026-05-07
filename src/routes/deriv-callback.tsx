import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { send } from "@/lib/deriv";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/deriv-callback")({
  // Accept all string search params so Deriv's acct1/token1/cur1/acct2/... are preserved
  // through TanStack Router's navigation and server-side redirect.
  validateSearch: z.record(z.string()).catch({}),
  component: DerivCallback,
});

// Deriv OAuth returns ?acct1=...&token1=...&cur1=...&acct2=...&token2=...
function parseAccounts(params: URLSearchParams) {
  const out: { account: string; token: string; currency: string }[] = [];
  let i = 1;
  while (params.get(`acct${i}`)) {
    out.push({
      account: params.get(`acct${i}`)!,
      token: params.get(`token${i}`)!,
      currency: params.get(`cur${i}`) ?? "",
    });
    i++;
  }
  return out;
}

// Uses the deriv-auth Edge Function (admin API) to find-or-create the Supabase
// user without triggering email confirmation or hitting signup rate limits.
// If the user is already authenticated in this browser, we reuse their session.
async function ensureSupabaseSession(primaryAccountId: string) {
  // Fast path: user already has a valid Supabase session in this browser.
  // This handles the case where a user re-authorises Deriv from within the app.
  const { data: { user: existingUser } } = await supabase.auth.getUser();
  if (existingUser) return existingUser;

  // Slow path: call the Edge Function to create/sign-in the Supabase account.
  const { data, error } = await supabase.functions.invoke("deriv-auth", {
    body: { derivAccountId: primaryAccountId },
  });

  if (error) {
    // FunctionsHttpError wraps the HTTP response — extract the body message.
    let msg = (error as any).message ?? "Auth service error";
    try {
      const ctx = (error as any).context;
      if (ctx) {
        const body = await ctx.json().catch(() => null);
        if (body?.error) msg = body.error;
      }
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  if (data?.error) throw new Error(data.error);
  if (!data?.session) throw new Error("No session returned from auth service");

  const { error: setErr } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (setErr) throw setErr;

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw userErr ?? new Error("Failed to retrieve user");
  return user;
}

function DerivCallback() {
  const navigate = useNavigate();
  // Route.useSearch() is the reliable source — populated by validateSearch
  // from both the server-side beforeLoad redirect and direct Deriv callbacks.
  const search = Route.useSearch();
  const [status, setStatus] = useState("Connecting your Deriv account…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        // Build URLSearchParams from the validated search object. This works
        // whether we arrived via beforeLoad redirect (search has all params)
        // or directly from Deriv's OAuth redirect.
        const params = new URLSearchParams(search as Record<string, string>);

        // Fallback: if the router search is empty (edge case during hydration),
        // read directly from the URL.
        if (!params.get("acct1") && typeof window !== "undefined") {
          const urlParams = new URLSearchParams(window.location.search);
          urlParams.forEach((v, k) => params.set(k, v));
        }

        const accounts = parseAccounts(params);

        if (!accounts.length) {
          throw new Error("No tokens returned from Deriv. Please try again.");
        }

        // Prefer a real CR account over demo VR account as the primary identity
        const primary = accounts.find((a) => !a.account.startsWith("VR")) ?? accounts[0];

        setStatus("Setting up your internal profile…");
        const sessionUser = await ensureSupabaseSession(primary.account);

        // Store all returned tokens in the Supabase 'sessions' table
        for (const acc of accounts) {
          setStatus(`Syncing account ${acc.account}…`);
          let balance = 0;
          let currency = acc.currency;

          try {
            const auth = await send({ authorize: acc.token });
            balance = Number(auth.authorize?.balance ?? 0);
            currency = auth.authorize?.currency ?? currency;
          } catch (e) {
            console.error(`Token validation failed for ${acc.account}`, e);
          }

          // Upsert — refresh the 30-day expiry window on every login
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          const { error: upsertError } = await supabase.from("sessions").upsert(
            {
              user_id: sessionUser.id,
              account_id: acc.account,
              deriv_token: acc.token,
              currency,
              balance,
              is_demo: acc.account.startsWith("VR"),
              is_active: true,
              expires_at: expiresAt,
            },
            { onConflict: "user_id,account_id" }
          );

          if (upsertError) {
            console.error(`Failed to store token for ${acc.account}`, upsertError);
          }
        }

        toast.success(`Connected ${accounts.length} account${accounts.length > 1 ? "s" : ""} successfully.`);
        navigate({ to: "/" });
      } catch (e: any) {
        console.error("OAuth Processing Error:", e);
        toast.error(e.message || "Authentication failed. Please check your Deriv connection.");
        // If the user already has a session, send them home rather than to /auth.
        const { data: { user: fallbackUser } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
        if (fallbackUser) {
          navigate({ to: "/" });
        } else {
          navigate({ to: "/auth", search: { mode: "signin" } });
        }
      }
    })();
  }, [navigate]);

  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <div className="glass-card flex flex-col items-center gap-4 rounded-2xl p-8 text-center max-w-sm">
        <Loader2 className="size-8 animate-spin text-primary" />
        <div className="space-y-1">
          <h2 className="font-semibold text-lg">Authorizing</h2>
          <p className="text-sm text-muted-foreground">{status}</p>
        </div>
      </div>
    </div>
  );
}
