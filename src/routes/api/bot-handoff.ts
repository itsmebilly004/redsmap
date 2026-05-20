// Receives sendBeacon from the client when the browser tab is closing.
// Updates the bot session to "pending" and invokes the Supabase Edge Function
// to continue running the bot server-side.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/bot-handoff")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let sessionId: string;
        try {
          const raw = await request.text();
          const body = JSON.parse(raw) as Record<string, unknown>;
          sessionId = body.sessionId as string;
          if (!sessionId || typeof sessionId !== "string") throw new Error("Missing sessionId");
        } catch {
          return Response.json({ error: "Bad request" }, { status: 400 });
        }

        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
        const serviceKey =
          process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: "Server misconfigured" }, { status: 500 });
        }

        // Verify the session exists and is in a state that can be handed off
        const { data } = await supabaseAdmin
          .from("active_bot_sessions")
          .select("id, status")
          .eq("id", sessionId)
          .in("status", ["browser_running", "pending"])
          .single();

        if (!data) {
          // Session already stopped or doesn't exist — nothing to hand off
          return Response.json({ ok: true, message: "No active session to hand off" });
        }

        // Mark session as pending so the edge function knows to pick it up
        await supabaseAdmin
          .from("active_bot_sessions")
          .update({ status: "pending" })
          .eq("id", sessionId);

        // Invoke the Edge Function asynchronously — fire and forget
        void fetch(`${supabaseUrl}/functions/v1/run-bot`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId }),
        }).catch(() => {});

        return Response.json({ ok: true });
      },
    },
  },
});
