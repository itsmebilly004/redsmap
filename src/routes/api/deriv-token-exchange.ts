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
          console.log("[Deriv Token Exchange] request received", {
            hasCode: Boolean(code),
            hasCodeVerifier: Boolean(codeVerifier),
          });
          if (!code || !codeVerifier) {
            return Response.json({ error: "Missing code or codeVerifier" }, { status: 400 });
          }

          const clientId = process.env.VITE_DERIV_CLIENT_ID ?? "";
          const rawClientSecret =
            process.env.DERIV_CLIENT_SECRET ?? process.env.VITE_DERIV_CLIENT_SECRET;
          const clientSecret =
            rawClientSecret && rawClientSecret !== "your_oauth_client_secret"
              ? rawClientSecret
              : undefined;
          if (!clientId) {
            console.error("[Deriv Token Exchange] missing client_id");
            return Response.json({ error: "Missing Deriv OAuth client_id" }, { status: 400 });
          }
          if (!DERIV_REDIRECT_URI) {
            console.error("[Deriv Token Exchange] missing redirect_uri");
            return Response.json({ error: "Missing Deriv OAuth redirect_uri" }, { status: 400 });
          }

          const body = new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            code,
            code_verifier: codeVerifier,
            redirect_uri: DERIV_REDIRECT_URI,
          });
          if (clientSecret) body.set("client_secret", clientSecret);
          console.log("Deriv token exchange request", {
            endpoint: "https://auth.deriv.com/oauth2/token",
            method: "POST",
            grant_type: "authorization_code",
            client_id: clientId,
            redirect_uri: DERIV_REDIRECT_URI,
            hasCode: Boolean(code),
            hasCodeVerifier: Boolean(codeVerifier),
            hasClientSecret: Boolean(clientSecret),
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
          console.log("Deriv token exchange response", {
            ok: tokenResponse.ok,
            status: tokenResponse.status,
            hasAccessToken: Boolean(tokenData?.access_token),
            expiresIn: tokenData?.expires_in,
            error: tokenData?.error,
            errorDescription: tokenData?.error_description,
          });

          if (!tokenResponse.ok) {
            return Response.json(tokenData, { status: tokenResponse.status || 400 });
          }

          return Response.json(tokenData);
        } catch (error: unknown) {
          console.error("[Deriv Token Exchange] request failed", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Token exchange failed" },
            { status: 400 },
          );
        }
      },
    },
  },
});
