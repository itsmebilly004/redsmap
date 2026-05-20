// Vercel Cron endpoint — runs every minute.
// Finds bot sessions whose browser heartbeat has gone stale (browser likely closed
// without the beforeunload beacon firing) and invokes the Edge Function to resume them.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/bot-orphan-check")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Vercel injects Authorization: Bearer <CRON_SECRET> on cron invocations.
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
          const auth = request.headers.get("Authorization");
          if (auth !== `Bearer ${cronSecret}`) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }
        }

        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const serviceKey =
          process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: "Server misconfigured" }, { status: 500 });
        }

        // Find sessions that:
        //  • are explicitly awaiting handoff (pending)
        //  • OR were running in the browser but the heartbeat has gone stale for >90 seconds
        const staleThreshold = new Date(Date.now() - 90_000).toISOString();

        const { data: orphans } = await supabaseAdmin
          .from("active_bot_sessions")
          .select("id, status")
          .or(
            `status.eq.pending,and(status.eq.browser_running,last_heartbeat_at.lt.${staleThreshold})`,
          )
          .is("runner_id", null); // skip sessions already claimed by a runner

        if (!orphans?.length) {
          return Response.json({ ok: true, resumed: 0 });
        }

        // Mark each orphan as pending before invoking the Edge Function
        const sessionIds = orphans.map((s) => s.id);
        await supabaseAdmin
          .from("active_bot_sessions")
          .update({ status: "pending" })
          .in("id", sessionIds);

        // Invoke the Edge Function for each orphaned session
        await Promise.allSettled(
          sessionIds.map((sessionId) =>
            fetch(`${supabaseUrl}/functions/v1/run-bot`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ sessionId }),
            }).catch(() => {}),
          ),
        );

        return Response.json({ ok: true, resumed: sessionIds.length });
      },
    },
  },
});
