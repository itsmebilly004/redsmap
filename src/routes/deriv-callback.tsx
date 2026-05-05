import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { send } from "@/lib/deriv";
import { derivCredentials } from "@/lib/deriv-credentials";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/deriv-callback")({
  component: DerivCallback,
});

// Deriv OAuth returns ?acct1=...&token1=...&cur1=...&acct2=...&token2=...
function parseAccounts(search: string) {
  const params = new URLSearchParams(search);
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

async function ensureSupabaseSession(primaryAccountId: string) {
  // We treat the Deriv account as the source of identity. Derive a stable
  // email + password and try to sign in; if the user doesn't exist yet,
  // sign them up (auth is configured to auto-confirm).
  const { email, password } = await derivCredentials(primaryAccountId);

  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (!signInError && signIn.user) return signIn.user;

  const { data: signUp, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: primaryAccountId, deriv_account_id: primaryAccountId },
    },
  });
  if (signUpError) throw signUpError;

  if (!signUp.session) {
    // Auto-confirm should grant a session immediately, but fall back to a
    // password sign-in just in case.
    const { data: retry, error: retryErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (retryErr) throw retryErr;
    return retry.user!;
  }
  return signUp.user!;
}

function DerivCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Connecting your Deriv account…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const accounts = parseAccounts(window.location.search);
        if (!accounts.length) throw new Error("No tokens returned from Deriv.");

        // Prefer a real (CR) account as the identity, fall back to the first.
        const primary = accounts.find((a) => !a.account.startsWith("VR")) ?? accounts[0];

        setStatus("Creating your ArkTrader session…");
        const sessionUser = await ensureSupabaseSession(primary.account);

        for (const acc of accounts) {
          setStatus(`Authorizing ${acc.account}…`);
          let balance = 0;
          let currency = acc.currency;
          try {
            const auth = await send({ authorize: acc.token });
            balance = Number(auth.authorize?.balance ?? 0);
            currency = auth.authorize?.currency ?? currency;
          } catch (e) {
            console.error("Authorize failed", e);
          }
          await supabase.from("deriv_accounts").upsert(
            {
              user_id: sessionUser.id,
              account_id: acc.account,
              api_token: acc.token,
              currency,
              balance,
              is_demo: acc.account.startsWith("VR"),
              is_active: true,
            } as any,
            { onConflict: "user_id,account_id" },
          );
        }
        toast.success(`Welcome — ${accounts.length} Deriv account${accounts.length > 1 ? "s" : ""} linked.`);
        navigate({ to: "/dashboard" });
      } catch (e: any) {
        console.error(e);
        toast.error(e.message ?? "Connection failed");
        navigate({ to: "/auth", search: { mode: "signin" } });
      }
    })();
  }, [navigate]);

  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="glass-card flex items-center gap-3 rounded-xl p-6">
        <Loader2 className="size-5 animate-spin text-primary" />
        <span className="text-sm">{status}</span>
      </div>
    </div>
  );
}
