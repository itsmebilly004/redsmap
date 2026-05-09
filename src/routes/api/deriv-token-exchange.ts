import { createFileRoute } from "@tanstack/react-router";

const DERIV_REDIRECT_URI =
  process.env.VITE_DERIV_REDIRECT_URI ?? "https://www.arktradershub.com/deriv-callback";

type TokenExchangeRequest = {
  code?: string;
  codeVerifier?: string;
};

export const Route = createFileRoute("/api/deriv-token-exchange")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { code, codeVerifier } = (await request.json()) as TokenExchangeRequest;
          if (!code || !codeVerifier) {
            return Response.json({ error: "Missing code or codeVerifier" }, { status: 400 });
          }

          const clientId = process.env.VITE_DERIV_CLIENT_ID ?? process.env.VITE_DERIV_APP_ID ?? "";
          if (!clientId) {
            return Response.json({ error: "Missing Deriv OAuth client_id" }, { status: 400 });
          }
          if (!DERIV_REDIRECT_URI) {
            return Response.json({ error: "Missing Deriv OAuth redirect_uri" }, { status: 400 });
          }

          const body = new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            code,
            code_verifier: codeVerifier,
            redirect_uri: DERIV_REDIRECT_URI,
          });

          const tokenResponse = await fetch("https://auth.deriv.com/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
          });
          const tokenData = await tokenResponse.json().catch(() => ({
            error: "invalid_response",
            error_description: "Deriv token endpoint returned a non-JSON response",
          }));

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
