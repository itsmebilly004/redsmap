import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { derivAccountId } = await req.json();

    if (!derivAccountId || typeof derivAccountId !== "string") {
      return new Response(
        JSON.stringify({ error: "derivAccountId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Stable synthetic email per Deriv account so the user record is idempotent
    const email = `${derivAccountId.toLowerCase()}@deriv.arktradershub.com`;
    const stablePassword = `${derivAccountId}-${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(-16)}`;

    // Try sign-in first — the fast path for returning users
    let session = null;
    const { data: signInData, error: signInError } = await adminClient.auth.signInWithPassword({
      email,
      password: stablePassword,
    });

    if (!signInError && signInData.session) {
      session = signInData.session;
    } else {
      // User doesn't exist yet — create it
      const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: stablePassword,
        email_confirm: true,
        user_metadata: { deriv_account_id: derivAccountId },
      });

      if (createError) {
        // Race condition: another request just created it — retry sign-in
        const { data: retryData, error: retryError } = await adminClient.auth.signInWithPassword({
          email,
          password: stablePassword,
        });
        if (retryError || !retryData.session) {
          throw retryError ?? new Error("Failed to create or sign in user");
        }
        session = retryData.session;
      } else if (createData.user) {
        // Sign in immediately after creation
        const { data: newSignIn, error: newSignInErr } = await adminClient.auth.signInWithPassword({
          email,
          password: stablePassword,
        });
        if (newSignInErr || !newSignIn.session) {
          throw newSignInErr ?? new Error("Failed to sign in after user creation");
        }
        session = newSignIn.session;
      }
    }

    return new Response(
      JSON.stringify({ session }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[deriv-auth]", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
