import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { send } from "@/lib/deriv";
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

function DerivCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Connecting your Deriv account…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          toast.error("Please sign in first.");
          navigate({ to: "/auth", search: { mode: "signin" } });
          return;
        }
        const accounts = parseAccounts(window.location.search);
        if (!accounts.length) throw new Error("No tokens returned from Deriv.");

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
              user_id: (await supabase.auth.getUser()).data.user!.id,
              deriv_account_id: acc.account,
              api_token: acc.token,
              currency,
              balance,
              is_demo: acc.account.startsWith("VR"),
              is_active: true,
            },
            { onConflict: "user_id,deriv_account_id" },
          );
        }
        toast.success(`Connected ${accounts.length} Deriv account${accounts.length > 1 ? "s" : ""}.`);
        navigate({ to: "/dashboard" });
      } catch (e: any) {
        toast.error(e.message ?? "Connection failed");
        navigate({ to: "/dashboard" });
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
