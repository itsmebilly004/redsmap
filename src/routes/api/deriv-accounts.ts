import { createFileRoute } from "@tanstack/react-router";

type DerivAccountsRequest = {
  accessToken?: string;
};

type DerivAccount = {
  account_id?: string;
  loginid?: string;
  currency?: string;
  balance?: string | number;
  is_demo?: boolean;
  is_virtual?: boolean;
};

type DerivAccountsResponse = {
  data?: DerivAccount[];
  message?: string;
  error?: { message?: string };
};

export const Route = createFileRoute("/api/deriv-accounts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { accessToken } = (await request.json()) as DerivAccountsRequest;
          if (!accessToken) {
            return Response.json({ error: "Missing Deriv access token" }, { status: 400 });
          }

          const appId = process.env.VITE_DERIV_APP_ID ?? "";
          if (!appId) {
            return Response.json({ error: "Missing Deriv App ID" }, { status: 400 });
          }

          const accountsResponse = await fetch(
            "https://api.derivws.com/trading/v1/options/accounts",
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Deriv-App-ID": appId,
              },
            },
          );
          const accountsData = (await accountsResponse.json().catch(() => ({
            error: { message: "Deriv accounts endpoint returned a non-JSON response" },
          }))) as DerivAccountsResponse;

          console.log("Deriv accounts server response", {
            ok: accountsResponse.ok,
            status: accountsResponse.status,
            accountCount: accountsData.data?.length ?? 0,
            error: accountsData.error?.message ?? accountsData.message,
          });

          if (accountsResponse.status === 429) {
            return Response.json(
              {
                error:
                  "Deriv is rate limiting account requests. Please wait a moment, then start login again.",
              },
              { status: 429 },
            );
          }

          if (!accountsResponse.ok) {
            return Response.json(
              {
                error:
                  accountsData.message ??
                  accountsData.error?.message ??
                  "Could not load Deriv accounts",
              },
              { status: accountsResponse.status || 400 },
            );
          }

          const accounts = (accountsData.data ?? []).map((account) => {
            const accountId = String(account.loginid ?? account.account_id ?? "");
            const isVirtual = account.is_virtual ?? account.is_demo ?? accountId.startsWith("VR");
            return {
              account_id: accountId,
              loginid: accountId,
              currency: account.currency ?? (isVirtual ? "USD" : ""),
              balance: Number(account.balance ?? 0),
              is_demo: isVirtual,
              is_virtual: isVirtual,
            };
          });

          return Response.json({ data: accounts });
        } catch (error: unknown) {
          console.error("Deriv accounts server request failed", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Could not load Deriv accounts" },
            { status: 400 },
          );
        }
      },
    },
  },
});
