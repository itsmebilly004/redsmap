import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/deriv-token-exchange")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { code, codeVerifier } = await request.json();
          if (!code || !codeVerifier) {
            return Response.json({ error: "Missing code or codeVerifier" }, { status: 400 });
          }

          const body = new URLSearchParams({
            grant_type: "authorization_code",
            client_id: process.env.VITE_DERIV_APP_ID ?? "",
            // Set DERIV_CLIENT_SECRET in Vercel/server env only. Never expose it to the browser.
            client_secret: process.env.DERIV_CLIENT_SECRET ?? "",
            code,
            code_verifier: codeVerifier,
            redirect_uri: process.env.VITE_DERIV_REDIRECT_URI ?? "",
          });

          const tokenResponse = await fetch("https://auth.deriv.com/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
          });
          const tokenData = await tokenResponse.json();

          if (!tokenResponse.ok) {
            return Response.json(tokenData, { status: 400 });
          }

          return Response.json(tokenData);
        } catch (error: any) {
          return Response.json({ error: error?.message ?? "Token exchange failed" }, { status: 400 });
        }
      },
    },
  },
});
