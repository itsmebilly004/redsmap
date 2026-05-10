import { createFileRoute } from "@tanstack/react-router";

type DerivAccountOtpRequest = {
  accessToken?: string;
  accountId?: string;
  appIdMode?: "oauth" | "legacy";
};

function derivApiAppId(mode: DerivAccountOtpRequest["appIdMode"] = "oauth") {
  const oauthAppId = process.env.VITE_DERIV_APP_ID ?? process.env.VITE_DERIV_CLIENT_ID ?? "";
  const legacyAppId = process.env.VITE_DERIV_LEGACY_APP_ID ?? "";
  return mode === "legacy" ? legacyAppId || oauthAppId : oauthAppId || legacyAppId;
}

function derivApiAppIdSource(mode: DerivAccountOtpRequest["appIdMode"] = "oauth") {
  const hasOAuthAppId = Boolean(process.env.VITE_DERIV_APP_ID ?? process.env.VITE_DERIV_CLIENT_ID);
  const hasLegacyAppId = Boolean(process.env.VITE_DERIV_LEGACY_APP_ID);
  if (mode === "legacy") {
    if (hasLegacyAppId) return "VITE_DERIV_LEGACY_APP_ID";
    return process.env.VITE_DERIV_APP_ID ? "VITE_DERIV_APP_ID" : "VITE_DERIV_CLIENT_ID";
  }
  if (hasOAuthAppId) {
    return process.env.VITE_DERIV_APP_ID ? "VITE_DERIV_APP_ID" : "VITE_DERIV_CLIENT_ID";
  }
  return "VITE_DERIV_LEGACY_APP_ID";
}

export const Route = createFileRoute("/api/deriv-account-otp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { accessToken, accountId, appIdMode = "oauth" } = (await request.json()) as DerivAccountOtpRequest;
          if (!accessToken || !accountId) {
            return Response.json({ error: "Missing Deriv access token or account ID" }, { status: 400 });
          }

          const appId = derivApiAppId(appIdMode);
          if (!appId) {
            return Response.json({ error: "Missing Deriv App ID" }, { status: 400 });
          }

          console.log("[Deriv OTP API] request started", {
            endpoint: `https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`,
            hasAccessToken: Boolean(accessToken),
            accountId,
            appId,
            appIdMode,
            appIdSource: derivApiAppIdSource(appIdMode),
          });
          const otpResponse = await fetch(
            `https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Deriv-App-ID": appId,
              },
            },
          );
          const otpData = await otpResponse.json().catch(() => ({
            error: { message: "Deriv OTP endpoint returned a non-JSON response" },
          }));

          if (otpResponse.status === 429) {
            return Response.json(
              {
                error:
                  "Deriv is rate limiting account requests. Please wait a moment, then try again.",
              },
              { status: 429 },
            );
          }

          if (!otpResponse.ok) {
            return Response.json(
              {
                error:
                  otpData?.message ??
                  otpData?.error?.message ??
                  "Failed to get authenticated Deriv WebSocket URL",
              },
              { status: otpResponse.status || 400 },
            );
          }

          const url = otpData?.data?.url;
          if (!url) {
            return Response.json(
              { error: "Deriv OTP response did not include a WebSocket URL" },
              { status: 400 },
            );
          }

          return Response.json({ url });
        } catch (error: unknown) {
          console.error("Deriv OTP server request failed", error);
          return Response.json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to get authenticated Deriv WebSocket URL",
            },
            { status: 400 },
          );
        }
      },
    },
  },
});
