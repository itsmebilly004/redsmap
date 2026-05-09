import { createFileRoute } from "@tanstack/react-router";

type DerivAccountsRequest = {
  accessToken?: string;
};

type UnknownRecord = Record<string, unknown>;

type DerivAccount = UnknownRecord & {
  account_id?: string;
  loginid?: string;
  login_id?: string;
  accountId?: string;
  id?: string;
  currency?: string;
  balance?: string | number | { amount?: string | number };
  is_demo?: boolean | string | number;
  is_virtual?: boolean | string | number;
  account_type?: string;
  category?: string;
  type?: string;
  status?: string;
};

type DerivAccountsResponse = {
  data?: DerivAccount[] | DerivAccount | { accounts?: DerivAccount[] };
  message?: string;
  error?: { message?: string } | string;
  errors?: { message?: string; code?: string; status?: number }[];
};

function stringFrom(...values: unknown[]) {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function booleanFrom(value: unknown) {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return null;
}

function numberFrom(value: unknown) {
  const raw = typeof value === "object" && value !== null && "amount" in value
    ? (value as { amount?: unknown }).amount
    : value;
  if (raw == null || raw === "") return 0;
  const number = Number(raw);
  return Number.isFinite(number) ? number : 0;
}

function errorMessage(data: DerivAccountsResponse) {
  if (typeof data.error === "string") return data.error;
  return (
    data.errors?.find((error) => error.message)?.message ??
    data.error?.message ??
    data.message ??
    "Could not load Deriv accounts"
  );
}

function accountsFromResponse(data: DerivAccountsResponse) {
  const payload = data.data;
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object" && "accounts" in payload) {
    const nested = (payload as { accounts?: DerivAccount[] }).accounts;
    return Array.isArray(nested) ? nested : [];
  }
  if (payload && typeof payload === "object") return [payload as DerivAccount];
  return [];
}

function accountShape(accounts: DerivAccount[]) {
  return accounts.slice(0, 3).map((account) => Object.keys(account).sort());
}

function isDemoAccount(account: DerivAccount, accountId: string) {
  const loginId = accountId.toUpperCase();
  const accountType = stringFrom(
    account.account_type,
    account.category,
    account.type,
    account["account_category"],
  ).toLowerCase();

  if (loginId.startsWith("VRTC") || loginId.startsWith("VR") || loginId.startsWith("DOT")) {
    return true;
  }
  if (loginId.startsWith("CR")) return false;
  const isVirtual = booleanFrom(account.is_virtual);
  const isDemo = booleanFrom(account.is_demo);
  if (isVirtual === true || isDemo === true) return true;
  if (isVirtual === false || isDemo === false) return false;
  if (accountType.includes("demo") || accountType.includes("virtual")) return true;
  if (accountType.includes("real")) return false;
  return false;
}

function normalizeAccount(account: DerivAccount) {
  const accountId = stringFrom(
    account.loginid,
    account.account_id,
    account.login_id,
    account.accountId,
    account.id,
  );
  if (!accountId) return null;

  const isVirtual = isDemoAccount(account, accountId);
  return {
    account_id: accountId,
    loginid: accountId,
    currency: stringFrom(account.currency, isVirtual ? "USD" : ""),
    balance: numberFrom(account.balance),
    is_demo: isVirtual,
    is_virtual: isVirtual,
    account_type: stringFrom(account.account_type, account.category, account.type),
    status: stringFrom(account.status, "active"),
  };
}

async function fetchOptionsAccounts(accessToken: string, appId: string) {
  const response = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Deriv-App-ID": appId,
    },
  });
  const data = (await response.json().catch(() => ({
    errors: [{ message: "Deriv accounts endpoint returned a non-JSON response" }],
  }))) as DerivAccountsResponse;
  return { response, data };
}

async function createDemoOptionsAccount(accessToken: string, appId: string) {
  const response = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Deriv-App-ID": appId,
    },
    body: JSON.stringify({ currency: "USD", group: "row", account_type: "demo" }),
  });
  const data = (await response.json().catch(() => ({
    errors: [{ message: "Deriv account creation endpoint returned a non-JSON response" }],
  }))) as DerivAccountsResponse;
  return { response, data };
}

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

          const { response: accountsResponse, data: accountsData } = await fetchOptionsAccounts(
            accessToken,
            appId,
          );

          console.log("Deriv accounts server response", {
            ok: accountsResponse.ok,
            status: accountsResponse.status,
            accountCount: accountsFromResponse(accountsData).length,
            dataShape: Array.isArray(accountsData.data) ? "array" : typeof accountsData.data,
            sampleKeys: accountShape(accountsFromResponse(accountsData)),
            error: errorMessage(accountsData),
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
              { error: errorMessage(accountsData) },
              { status: accountsResponse.status || 400 },
            );
          }

          let rawAccounts = accountsFromResponse(accountsData);
          let accounts = rawAccounts.map(normalizeAccount).filter((account) => account !== null);
          console.log("Deriv normalized Options accounts", {
            rawCount: rawAccounts.length,
            eligibleCount: accounts.length,
            skippedCount: rawAccounts.length - accounts.length,
          });

          if (!accounts.length) {
            console.warn("No eligible Options accounts returned. Attempting demo account creation.");
            const { response: createResponse, data: createData } = await createDemoOptionsAccount(
              accessToken,
              appId,
            );
            console.log("Deriv demo Options account creation response", {
              ok: createResponse.ok,
              status: createResponse.status,
              accountCount: accountsFromResponse(createData).length,
              dataShape: Array.isArray(createData.data) ? "array" : typeof createData.data,
              sampleKeys: accountShape(accountsFromResponse(createData)),
              error: errorMessage(createData),
            });

            if (createResponse.status === 429) {
              return Response.json(
                {
                  error:
                    "Deriv is rate limiting account setup. Please wait a moment, then start login again.",
                },
                { status: 429 },
              );
            }

            if (!createResponse.ok) {
              return Response.json(
                {
                  error:
                    "No eligible Deriv Options account was found for this login, and automatic setup failed. The Deriv account may need Options migration or may not be supported yet.",
                  detail: errorMessage(createData),
                },
                { status: createResponse.status || 400 },
              );
            }

            rawAccounts = accountsFromResponse(createData);
            accounts = rawAccounts.map(normalizeAccount).filter((account) => account !== null);
            console.log("Deriv normalized created Options accounts", {
              rawCount: rawAccounts.length,
              eligibleCount: accounts.length,
              skippedCount: rawAccounts.length - accounts.length,
            });
          }

          if (!accounts.length) {
            return Response.json(
              {
                error:
                  "No eligible Deriv Options account was found. This Deriv account may need migration or setup on Deriv before it can be used here.",
              },
              { status: 422 },
            );
          }

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
