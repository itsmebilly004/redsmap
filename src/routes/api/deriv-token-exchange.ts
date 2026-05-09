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

          const clientId = process.env.VITE_DERIV_CLIENT_ID ?? process.env.VITE_DERIV_APP_ID ?? "";
          const clientSecret = process.env.DERIV_CLIENT_SECRET ?? "";

          const body = new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            code,
            code_verifier: codeVerifier,
            redirect_uri: process.env.VITE_DERIV_REDIRECT_URI ?? "",
          });
          // PKCE public clients do not send a secret. Only include this for confidential clients
          // after setting a real DERIV_CLIENT_SECRET server-side; never use the placeholder.
          if (clientSecret && clientSecret !== "your_oauth_client_secret") {
            body.set("client_secret", clientSecret);
          }

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
        } catch (error: unknown) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Token exchange failed" },
            { status: 400 },
          );
        }
      },
    },
  },
});
