import { createFileRoute } from "@tanstack/react-router";
import {
  accountLoginId,
  normalizeDerivAccount,
  stringFrom,
  type DerivAccountLike,
} from "@/lib/deriv-account";
import { DERIV_API_BASE_URL, DERIV_OAUTH_CLIENT_ID } from "@/lib/deriv-config";

type DerivAccountsRequest = {
  accessToken?: string;
  appIdMode?: "oauth" | "legacy";
  legacyAccounts?: DerivAccount[];
  oauthClientId?: string;
  oauthAppId?: string;
};
type AppIdCandidate = { value: string; source: string };

type DerivAccount = DerivAccountLike & {
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

function addAppIdCandidate(candidates: AppIdCandidate[], value: unknown, source: string) {
  const text = String(value ?? "").trim();
  if (!text || candidates.some((candidate) => candidate.value === text)) return;
  candidates.push({ value: text, source });
}

function oauthAppIdCandidates(
  requestHints?: Pick<DerivAccountsRequest, "oauthClientId" | "oauthAppId">,
) {
  const candidates: AppIdCandidate[] = [];
  addAppIdCandidate(candidates, DERIV_OAUTH_CLIENT_ID, "DERIV_OAUTH_CLIENT_ID");
  if (requestHints?.oauthClientId === DERIV_OAUTH_CLIENT_ID) {
    addAppIdCandidate(candidates, requestHints.oauthClientId, "request.oauthClientId");
  }
  if (requestHints?.oauthAppId === DERIV_OAUTH_CLIENT_ID) {
    addAppIdCandidate(candidates, requestHints.oauthAppId, "request.oauthAppId");
  }
  return candidates;
}

function derivApiAppId(
  _mode: DerivAccountsRequest["appIdMode"] = "oauth",
  requestHints?: Pick<DerivAccountsRequest, "oauthClientId" | "oauthAppId">,
) {
  return oauthAppIdCandidates(requestHints)[0]?.value ?? "";
}

function derivApiAppIdSource(
  _mode: DerivAccountsRequest["appIdMode"] = "oauth",
  requestHints?: Pick<DerivAccountsRequest, "oauthClientId" | "oauthAppId">,
) {
  const hasOAuthAppId = oauthAppIdCandidates(requestHints).length > 0;
  if (hasOAuthAppId) {
    return oauthAppIdCandidates(requestHints)[0]?.source ?? "unknown";
  }
  return "missing:VITE_DERIV_CLIENT_ID_OR_VITE_DERIV_APP_ID";
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

function normalizeAccount(account: DerivAccount, fallbackToken?: string | null) {
  const normalized = normalizeDerivAccount(account, { trustVirtualFlags: true });
  if (!normalized) return null;
  const accountId = accountLoginId(normalized);
  return {
    account_id: accountId,
    loginid: accountId,
    deriv_token: stringFrom(account.deriv_token, fallbackToken) || null,
    type: normalized.type,
    normalizedType: normalized.normalizedType,
    label: normalized.label,
    currency: normalized.currency ?? "",
    balance: normalized.balance,
    is_demo: normalized.is_demo,
    is_virtual: normalized.is_virtual,
    account_type: normalized.account_type ?? "",
    classification_reason: normalized.classification_reason,
    detected_prefix: normalized.detected_prefix,
    final_tab_placement: normalized.final_tab_placement,
    status: normalized.status ?? "active",
  };
}

async function fetchOptionsAccounts(accessToken: string, appIdCandidates: AppIdCandidate[]) {
  if (!appIdCandidates.length) {
    throw new Error("Missing OAuth Deriv App ID candidates for accounts fetch.");
  }
  const attemptedAppIds: Array<{ appId: string; appIdSource: string; status: number }> = [];
  const requestWithCandidate = async (candidate: AppIdCandidate) => {
    const response = await fetch(`${DERIV_API_BASE_URL}/trading/v1/options/accounts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Deriv-App-ID": candidate.value,
      },
    });
    const data = (await response.json().catch(() => ({
      errors: [{ message: "Deriv accounts endpoint returned a non-JSON response" }],
    }))) as DerivAccountsResponse;
    attemptedAppIds.push({
      appId: candidate.value,
      appIdSource: candidate.source,
      status: response.status,
    });
    return { response, data, appIdCandidate: candidate };
  };

  let result = await requestWithCandidate(appIdCandidates[0]);
  for (let index = 1; index < appIdCandidates.length; index += 1) {
    if (result.response.status !== 401 && result.response.status !== 403) break;
    const nextCandidate = appIdCandidates[index];
    console.warn(
      "[Deriv Accounts API] OAuth accounts fetch rejected for app id; retrying next app id candidate",
      {
        previousAppIdSource: result.appIdCandidate.source,
        previousStatus: result.response.status,
        nextAppIdSource: nextCandidate.source,
      },
    );
    result = await requestWithCandidate(nextCandidate);
  }

  return { ...result, attemptedAppIds };
}

async function createDemoOptionsAccount(accessToken: string, appIdCandidates: AppIdCandidate[]) {
  if (!appIdCandidates.length) {
    throw new Error("Missing OAuth Deriv App ID candidates for demo account creation.");
  }
  const attemptedAppIds: Array<{ appId: string; appIdSource: string; status: number }> = [];
  const requestWithCandidate = async (candidate: AppIdCandidate) => {
    const response = await fetch(`${DERIV_API_BASE_URL}/trading/v1/options/accounts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Deriv-App-ID": candidate.value,
      },
      body: JSON.stringify({ currency: "USD", group: "row", account_type: "demo" }),
    });
    const data = (await response.json().catch(() => ({
      errors: [{ message: "Deriv account creation endpoint returned a non-JSON response" }],
    }))) as DerivAccountsResponse;
    attemptedAppIds.push({
      appId: candidate.value,
      appIdSource: candidate.source,
      status: response.status,
    });
    return { response, data, appIdCandidate: candidate };
  };

  let result = await requestWithCandidate(appIdCandidates[0]);
  for (let index = 1; index < appIdCandidates.length; index += 1) {
    if (result.response.status !== 401 && result.response.status !== 403) break;
    const nextCandidate = appIdCandidates[index];
    console.warn(
      "[Deriv Accounts API] OAuth demo account create rejected for app id; retrying next app id candidate",
      {
        previousAppIdSource: result.appIdCandidate.source,
        previousStatus: result.response.status,
        nextAppIdSource: nextCandidate.source,
      },
    );
    result = await requestWithCandidate(nextCandidate);
  }

  return { ...result, attemptedAppIds };
}

export const Route = createFileRoute("/api/deriv-accounts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const {
            accessToken,
            appIdMode = "oauth",
            legacyAccounts = [],
            oauthClientId,
            oauthAppId,
          } = (await request.json()) as DerivAccountsRequest;
          const appIdHints = {
            oauthClientId,
            oauthAppId,
          } satisfies Pick<DerivAccountsRequest, "oauthClientId" | "oauthAppId">;
          console.log("[Deriv Accounts API] request received", {
            hasAccessToken: Boolean(accessToken),
            appIdMode,
            legacyAccountCount: legacyAccounts.length,
            oauthClientIdHint: oauthClientId ? `${oauthClientId.slice(0, 4)}...` : null,
            oauthAppIdHint: oauthAppId ? `${oauthAppId.slice(0, 4)}...` : null,
          });
          if (legacyAccounts.length || appIdMode === "legacy") {
            return Response.json(
              {
                error:
                  "Reconnect through Deriv OAuth2. ArkTrader uses client_id 33dF8d2wwjIpeFDBvNkln for account loading across all account types.",
              },
              { status: 400 },
            );
          }

          if (!accessToken) {
            return Response.json({ error: "Missing Deriv access token" }, { status: 400 });
          }

          const oauthCandidates = oauthAppIdCandidates(appIdHints);
          const appId = oauthCandidates[0]?.value ?? "";
          if (!appId) {
            console.error("[Deriv Accounts API] missing Deriv App ID");
            return Response.json({ error: "Missing Deriv App ID" }, { status: 400 });
          }

          console.log("[Deriv Accounts API] accounts fetch started", {
            endpoint: `${DERIV_API_BASE_URL}/trading/v1/options/accounts`,
            method: "GET",
            hasAccessToken: Boolean(accessToken),
            appId,
            appIdMode,
            appIdSource: derivApiAppIdSource(appIdMode, appIdHints),
            oauthAppIdCandidates: oauthCandidates.map((candidate) => candidate.source),
          });
          const {
            response: accountsResponse,
            data: accountsData,
            appIdCandidate: accountsAppIdCandidate,
            attemptedAppIds: accountsAttemptedAppIds,
          } = await fetchOptionsAccounts(accessToken, oauthCandidates);

          console.log("Deriv accounts server response", {
            ok: accountsResponse.ok,
            status: accountsResponse.status,
            accountCount: accountsFromResponse(accountsData).length,
            dataShape: Array.isArray(accountsData.data) ? "array" : typeof accountsData.data,
            sampleKeys: accountShape(accountsFromResponse(accountsData)),
            error: errorMessage(accountsData),
            appIdSource: accountsAppIdCandidate.source,
            attemptedAppIds: accountsAttemptedAppIds,
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
          console.info("[Deriv Accounts API] raw accounts before normalization", rawAccounts);
          let normalizedAccounts = rawAccounts
            .map(normalizeAccount)
            .filter((account): account is NonNullable<ReturnType<typeof normalizeAccount>> =>
              Boolean(account),
            );
          const unknownAccounts = normalizedAccounts.filter(
            (account) => account.normalizedType === "unknown",
          );
          if (unknownAccounts.length) {
            console.warn("[Deriv Accounts API] unknown accounts excluded", unknownAccounts);
          }
          let accounts = normalizedAccounts.filter(
            (account) => account.normalizedType !== "unknown",
          );
          console.log("Deriv normalized Options accounts", {
            rawCount: rawAccounts.length,
            eligibleCount: accounts.length,
            skippedCount: rawAccounts.length - accounts.length,
            accounts: accounts.map((account) => ({
              account_id: account.account_id,
              loginid: account.loginid,
              detected_prefix: account.detected_prefix,
              normalizedType: account.normalizedType,
              final_tab_placement: account.final_tab_placement,
              is_demo: account.is_demo,
              is_virtual: account.is_virtual,
              reason: account.classification_reason,
            })),
          });

          if (!accounts.length) {
            console.warn(
              "No eligible Options accounts returned. Attempting demo account creation.",
            );
            const {
              response: createResponse,
              data: createData,
              appIdCandidate: createAppIdCandidate,
              attemptedAppIds: createAttemptedAppIds,
            } = await createDemoOptionsAccount(accessToken, oauthCandidates);
            console.log("Deriv demo Options account creation response", {
              ok: createResponse.ok,
              status: createResponse.status,
              accountCount: accountsFromResponse(createData).length,
              dataShape: Array.isArray(createData.data) ? "array" : typeof createData.data,
              sampleKeys: accountShape(accountsFromResponse(createData)),
              error: errorMessage(createData),
              appIdSource: createAppIdCandidate.source,
              attemptedAppIds: createAttemptedAppIds,
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
            console.info(
              "[Deriv Accounts API] raw created accounts before normalization",
              rawAccounts,
            );
            normalizedAccounts = rawAccounts
              .map(normalizeAccount)
              .filter((account): account is NonNullable<ReturnType<typeof normalizeAccount>> =>
                Boolean(account),
              );
            const createdUnknownAccounts = normalizedAccounts.filter(
              (account) => account.normalizedType === "unknown",
            );
            if (createdUnknownAccounts.length) {
              console.warn(
                "[Deriv Accounts API] unknown created accounts excluded",
                createdUnknownAccounts,
              );
            }
            accounts = normalizedAccounts.filter((account) => account.normalizedType !== "unknown");
            console.log("Deriv normalized created Options accounts", {
              rawCount: rawAccounts.length,
              eligibleCount: accounts.length,
              skippedCount: rawAccounts.length - accounts.length,
              accounts: accounts.map((account) => ({
                account_id: account.account_id,
                loginid: account.loginid,
                detected_prefix: account.detected_prefix,
                normalizedType: account.normalizedType,
                final_tab_placement: account.final_tab_placement,
                is_demo: account.is_demo,
                is_virtual: account.is_virtual,
                reason: account.classification_reason,
              })),
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
