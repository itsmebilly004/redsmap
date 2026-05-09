import { createFileRoute } from "@tanstack/react-router";

type DerivAccountOtpRequest = {
  accessToken?: string;
  accountId?: string;
};

export const Route = createFileRoute("/api/deriv-account-otp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { accessToken, accountId } = (await request.json()) as DerivAccountOtpRequest;
          if (!accessToken || !accountId) {
            return Response.json({ error: "Missing Deriv access token or account ID" }, { status: 400 });
          }

          const appId = process.env.VITE_DERIV_APP_ID ?? "";
          if (!appId) {
            return Response.json({ error: "Missing Deriv App ID" }, { status: 400 });
          }

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
