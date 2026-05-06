--- START OF FILE src/routes/deriv-callback.tsx ---
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { send } from "@/lib/deriv";
import { derivCredentials } from "@/lib/deriv-credentials";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

function DerivCallback() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const [status, setStatus] = useState("Connecting your Deriv account…");
  const ran = useRef(false);

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

async function ensureSupabaseSession(primaryAccountId: string) {
  // We treat the Deriv account as the source of identity. 
  // Derive a stable email + password based on the account ID.
  const { email, password } = await derivCredentials(primaryAccountId);

  // Try to sign in first
  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (!signInError && signIn.user) return signIn.user;

  // If sign in fails, create the user
  const { data: signUp, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { 
        display_name: primaryAccountId, 
        deriv_account_id: primaryAccountId 
      },
    },
  });
  
  if (signUpError) throw signUpError;

  if (!signUp.session) {
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
  const searchParams = Route.useSearch();
  const [status, setStatus] = useState("Connecting your Deriv account…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const accounts = parseAccounts(params);
        
        if (!accounts.length) {
          throw new Error("No tokens returned from Deriv. Please try again.");
        }

        // Identify the primary account (Real CR account preferred over VR)
        const primary = accounts.find((a) => !a.account.startsWith("VR")) ?? accounts[0];

        setStatus("Setting up your internal profile…");
        const sessionUser = await ensureSupabaseSession(primary.account);

        // Store all returned tokens in the Supabase 'sessions' table
        for (const acc of accounts) {
          setStatus(`Syncing account ${acc.account}…`);
          let balance = 0;
          let currency = acc.currency;
          
          try {
            // Validate token and get fresh balance/currency
            const auth = await send({ authorize: acc.token });
            balance = Number(auth.authorize?.balance ?? 0);
            currency = auth.authorize?.currency ?? currency;
          } catch (e) {
            console.error(`Validation failed for ${acc.account}`, e);
          }

          // Use upsert to handle both new and existing account links
          const { error: upsertError } = await supabase.from("sessions").upsert(
            {
              user_id: sessionUser.id,
              account_id: acc.account,
              deriv_token: acc.token,
              currency,
              balance,
              is_demo: acc.account.startsWith("VR"),
              is_active: true,
            },
            { onConflict: "user_id,account_id" }
          );

          if (upsertError) {
            console.error(`Failed to store token for ${acc.account}`, upsertError);
          }
        }

        toast.success(`Successfully connected ${accounts.length} account${accounts.length > 1 ? 's' : ''}.`);
        navigate({ to: "/dashboard" });
      } catch (e: any) {
        console.error("OAuth Processing Error:", e);
        toast.error(e.message || "Authentication failed. Please check your Deriv connection.");
        navigate({ to: "/auth", search: { mode: "signin" } });
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