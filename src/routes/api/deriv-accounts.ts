import { createFileRoute } from "@tanstack/react-router";
import {
  accountLoginId,
  booleanFrom,
  normalizeDerivAccount,
  numberFrom,
  stringFrom,
  type DerivAccountLike,
} from "@/lib/deriv-account";

type DerivAccountsRequest = {
  accessToken?: string;
  appIdMode?: "oauth" | "legacy";
  legacyAccounts?: LegacyDerivAccountInput[];
};

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

type LegacyDerivAccountInput = DerivAccount & {
  deriv_token?: string | null;
  token?: string | null;
};

type DerivAccountsResponse = {
  data?: DerivAccount[] | DerivAccount | { accounts?: DerivAccount[] };
  message?: string;
  error?: { message?: string } | string;
  errors?: { message?: string; code?: string; status?: number }[];
};

type DerivRpcMessage = Record<string, unknown> & {
  req_id?: number;
  msg_type?: string;
  error?: { message?: string; code?: string };
};

type DerivWebSocketSnapshot = {
  accountId: string;
  authorize: DerivRpcMessage;
  balance: DerivRpcMessage;
};

function derivApiAppId(mode: DerivAccountsRequest["appIdMode"] = "oauth") {
  const oauthAppId = process.env.VITE_DERIV_CLIENT_ID ?? process.env.VITE_DERIV_APP_ID ?? "";
  const legacyAppId = process.env.VITE_DERIV_LEGACY_APP_ID ?? process.env.VITE_DERIV_APP_ID ?? "";
  return mode === "legacy" ? legacyAppId || oauthAppId : oauthAppId;
}

function derivApiAppIdSource(mode: DerivAccountsRequest["appIdMode"] = "oauth") {
  const hasOAuthAppId = Boolean(process.env.VITE_DERIV_CLIENT_ID ?? process.env.VITE_DERIV_APP_ID);
  const hasLegacyAppId = Boolean(process.env.VITE_DERIV_LEGACY_APP_ID);
  if (mode === "legacy") {
    if (hasLegacyAppId) return "VITE_DERIV_LEGACY_APP_ID";
    if (process.env.VITE_DERIV_APP_ID) return "VITE_DERIV_APP_ID";
    return process.env.VITE_DERIV_CLIENT_ID ? "VITE_DERIV_CLIENT_ID" : "missing:VITE_DERIV_LEGACY_APP_ID";
  }
  if (hasOAuthAppId) {
    return process.env.VITE_DERIV_CLIENT_ID ? "VITE_DERIV_CLIENT_ID" : "VITE_DERIV_APP_ID";
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

function tokenLogValue(token: string | null | undefined) {
  if (!token) return null;
  return {
    length: token.length,
    prefix: `${token.slice(0, 4)}...`,
  };
}

function sameAccountId(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && left.trim().toUpperCase() === right.trim().toUpperCase());
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

function messageDataText(data: unknown) {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  }
  const maybeText = data as { toString?: () => string };
  return typeof maybeText?.toString === "function" ? maybeText.toString() : String(data);
}

async function getWebSocketCtor() {
  if (typeof WebSocket !== "undefined") return WebSocket;
  const wsModule = await import("ws");
  return (wsModule.WebSocket ?? wsModule.default) as unknown as typeof WebSocket;
}

function addWebSocketListener(
  ws: WebSocket,
  eventName: "open" | "message" | "error" | "close",
  listener: (...args: unknown[]) => void,
) {
  const socket = ws as unknown as {
    addEventListener?: (eventName: string, listener: (...args: unknown[]) => void) => void;
    on?: (eventName: string, listener: (...args: unknown[]) => void) => void;
  };
  if (typeof socket.addEventListener === "function") {
    socket.addEventListener(eventName, listener);
    return;
  }
  if (typeof socket.on === "function") {
    socket.on(eventName, listener);
    return;
  }
  (ws as unknown as Record<string, unknown>)[`on${eventName}`] = listener;
}

async function fetchLegacyWebSocketSnapshot(
  input: LegacyDerivAccountInput,
  appId: string,
): Promise<DerivWebSocketSnapshot | null> {
  const token = stringFrom(input.deriv_token, input.token);
  const accountId = accountLoginId(input);
  if (!token || !accountId) {
    console.warn("[Deriv Accounts API] legacy account skipped before WebSocket fetch", {
      accountId,
      hasToken: Boolean(token),
    });
    return null;
  }

  const WebSocketCtor = await getWebSocketCtor();
  const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`;
  const ws = new WebSocketCtor(wsUrl) as WebSocket;
  let reqId = 1;
  let settled = false;
  const pending = new Map<
    number,
    {
      resolve: (message: DerivRpcMessage) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
      label: string;
    }
  >();

  const closeSocket = () => {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  };

  const rejectAll = (error: Error) => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    pending.clear();
  };

  const waitForOpen = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Deriv legacy WebSocket open timed out"));
    }, 15000);

    addWebSocketListener(ws, "open", () => {
      clearTimeout(timer);
      console.info("[Deriv Accounts API] legacy WebSocket opened", {
        accountId,
        endpoint: wsUrl,
        token: tokenLogValue(token),
      });
      resolve();
    });
    addWebSocketListener(ws, "error", (event) => {
      clearTimeout(timer);
      reject(new Error("Deriv legacy WebSocket connection failed"));
      rejectAll(new Error("Deriv legacy WebSocket connection failed"));
      console.error("[Deriv Accounts API] legacy WebSocket error", {
        accountId,
        event,
      });
    });
    addWebSocketListener(ws, "close", (event) => {
      const closeEvent = event as CloseEvent | undefined;
      if (settled) return;
      rejectAll(
        new Error(
          closeEvent?.reason
            ? `Deriv legacy WebSocket closed: ${closeEvent.reason}`
            : "Deriv legacy WebSocket closed before the balance snapshot completed",
        ),
      );
    });
    addWebSocketListener(ws, "message", (eventOrData) => {
      try {
        const event = eventOrData as MessageEvent | unknown;
        const raw =
          event && typeof event === "object" && "data" in event
            ? (event as MessageEvent).data
            : eventOrData;
        const message = JSON.parse(messageDataText(raw)) as DerivRpcMessage;
        console.info("[Deriv Accounts API] legacy raw Deriv API response", {
          accountId,
          msg_type: message.msg_type,
          req_id: message.req_id,
          response: message,
        });
        const request = message.req_id ? pending.get(message.req_id) : null;
        if (!request) return;
        clearTimeout(request.timer);
        pending.delete(message.req_id!);
        if (message.error) {
          request.reject(
            new Error(
              message.error.message ??
                `${request.label} failed${message.error.code ? ` (${message.error.code})` : ""}`,
            ),
          );
          return;
        }
        request.resolve(message);
      } catch (error) {
        console.warn("[Deriv Accounts API] legacy WebSocket message parse failed", {
          accountId,
          error,
        });
      }
    });
  });

  const rpc = async (payload: Record<string, unknown>, label: string) => {
    const id = reqId++;
    const message = { ...payload, req_id: id };
    return new Promise<DerivRpcMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${label} timed out`));
      }, 15000);
      pending.set(id, { resolve, reject, timer, label });
      ws.send(JSON.stringify(message));
    });
  };

  try {
    await waitForOpen;
    const authorize = await rpc({ authorize: token }, "Legacy authorize");
    const balance = await rpc({ balance: 1, account: "all" }, "Legacy balance fetch");
    settled = true;
    closeSocket();
    return { accountId, authorize, balance };
  } catch (error) {
    settled = true;
    rejectAll(error instanceof Error ? error : new Error("Legacy account snapshot failed"));
    closeSocket();
    console.error("[Deriv Accounts API] legacy balance fetch failed", {
      accountId,
      token: tokenLogValue(token),
      error,
    });
    return null;
  }
}

function authorizePayload(message: DerivRpcMessage) {
  return (message.authorize && typeof message.authorize === "object"
    ? message.authorize
    : {}) as Record<string, unknown>;
}

function accountListFromAuthorize(message: DerivRpcMessage) {
  const authorize = authorizePayload(message);
  const accountList = authorize.account_list;
  return Array.isArray(accountList) ? (accountList as DerivAccount[]) : [];
}

function findAuthorizeAccount(message: DerivRpcMessage, accountId: string) {
  return accountListFromAuthorize(message).find((account) =>
    sameAccountId(accountLoginId(account), accountId),
  );
}

function parseBalanceRecord(record: unknown, fallbackCurrency = "") {
  if (record == null) {
    return { found: false, balance: 0, currency: fallbackCurrency, raw: record };
  }
  if (typeof record !== "object") {
    return { found: true, balance: numberFrom(record), currency: fallbackCurrency, raw: record };
  }
  const payload = record as Record<string, unknown>;
  return {
    found: true,
    balance: numberFrom(
      payload.balance ??
        payload.amount ??
        payload.available_balance ??
        payload.cashier_balance ??
        payload.converted_amount,
    ),
    currency: stringFrom(payload.currency, fallbackCurrency),
    raw: record,
  };
}

function balanceForAccount(message: DerivRpcMessage, accountId: string) {
  const payload = (message.balance && typeof message.balance === "object"
    ? message.balance
    : {}) as Record<string, unknown>;
  const fallbackCurrency = stringFrom(payload.currency);
  const accounts = payload.accounts;

  if (Array.isArray(accounts)) {
    const match = (accounts as DerivAccount[]).find((account) =>
      sameAccountId(accountLoginId(account), accountId),
    );
    if (match) return parseBalanceRecord(match, fallbackCurrency);
    return { found: false, balance: 0, currency: fallbackCurrency, raw: accounts };
  } else if (accounts && typeof accounts === "object") {
    const accountMap = accounts as Record<string, unknown>;
    const directKey = Object.keys(accountMap).find((key) => sameAccountId(key, accountId));
    if (directKey) return parseBalanceRecord(accountMap[directKey], fallbackCurrency);
    return { found: false, balance: 0, currency: fallbackCurrency, raw: accounts };
  }

  const payloadLoginid = stringFrom(payload.loginid, payload.account_id);
  if (!payloadLoginid || sameAccountId(payloadLoginid, accountId)) {
    return {
      found: Boolean(payload.balance != null),
      balance: numberFrom(payload.balance),
      currency: fallbackCurrency,
      raw: payload,
    };
  }

  return { found: false, balance: 0, currency: fallbackCurrency, raw: payload };
}

function inactiveLegacyAccount(account: DerivAccount) {
  const status = stringFrom(account.status, account.state).toLowerCase();
  const activeFlag = booleanFrom(account.is_active);
  const disabledFlag = booleanFrom(account.is_disabled ?? account.disabled);
  return (
    activeFlag === false ||
    disabledFlag === true ||
    ["disabled", "inactive", "closed", "suspended", "unavailable"].includes(status)
  );
}

function accountFromLegacySnapshot(
  input: LegacyDerivAccountInput,
  snapshot: DerivWebSocketSnapshot,
) {
  const requestedId = accountLoginId(input);
  const token = stringFrom(input.deriv_token, input.token);
  const authorize = authorizePayload(snapshot.authorize);
  const authorizedLoginid = stringFrom(authorize.loginid, authorize.account_id);
  const accountId = requestedId || authorizedLoginid;
  if (!accountId) return null;

  const matchedAuthorizeAccount = findAuthorizeAccount(snapshot.authorize, accountId);
  const balance = balanceForAccount(snapshot.balance, accountId);
  if (requestedId && authorizedLoginid && !sameAccountId(requestedId, authorizedLoginid) && !balance.found) {
    console.warn("[Deriv Accounts API] legacy account skipped because token authorized a different account", {
      requestedId,
      authorizedLoginid,
      hasBalanceForRequestedAccount: balance.found,
    });
    return null;
  }

  const fallbackBalance = numberFrom(authorize.balance);
  const account = {
    ...(matchedAuthorizeAccount ?? {}),
    ...input,
    account_id: accountId,
    loginid: accountId,
    deriv_token: token,
    currency: stringFrom(balance.currency, matchedAuthorizeAccount?.currency, authorize.currency, input.currency, "USD"),
    balance: balance.found ? balance.balance : fallbackBalance,
    is_demo: matchedAuthorizeAccount?.is_demo ?? matchedAuthorizeAccount?.is_virtual ?? input.is_demo,
    is_virtual: matchedAuthorizeAccount?.is_virtual ?? input.is_virtual,
    account_type: stringFrom(
      matchedAuthorizeAccount?.account_type,
      matchedAuthorizeAccount?.category,
      matchedAuthorizeAccount?.type,
      input.account_type,
      input.category,
      input.type,
    ),
    status: stringFrom(matchedAuthorizeAccount?.status, input.status, "active"),
  } satisfies DerivAccount;

  if (inactiveLegacyAccount(account)) {
    console.warn("[Deriv Accounts API] legacy inactive account excluded", {
      account_id: account.account_id,
      status: account.status,
    });
    return null;
  }

  console.info("[Deriv Accounts API] legacy account snapshot merged", {
    rawAccountId: requestedId,
    authorizedLoginid,
    account_id: account.account_id,
    currency: account.currency,
    balance: account.balance,
    account_type: account.account_type,
    status: account.status,
    balanceFoundInDerivResponse: balance.found,
  });
  return account;
}

async function fetchLegacyAccounts(legacyAccounts: LegacyDerivAccountInput[], appId: string) {
  console.info("[Deriv Accounts API] legacy balance fetch started", {
    accountCount: legacyAccounts.length,
    accountIds: legacyAccounts.map((account) => accountLoginId(account)),
    tokenShapes: legacyAccounts.map((account) => tokenLogValue(stringFrom(account.deriv_token, account.token))),
    appId,
    endpoint: "wss://ws.derivws.com/websockets/v3",
  });

  const snapshots = await Promise.all(
    legacyAccounts.map((account) => fetchLegacyWebSocketSnapshot(account, appId)),
  );
  const accountsById = new Map<string, NonNullable<ReturnType<typeof accountFromLegacySnapshot>>>();

  for (const snapshot of snapshots) {
    if (!snapshot) continue;
    const original = legacyAccounts.find((account) =>
      sameAccountId(accountLoginId(account), snapshot.accountId),
    );
    if (!original) continue;
    const account = accountFromLegacySnapshot(original, snapshot);
    if (!account) continue;
    accountsById.set(accountLoginId(account), account);
  }

  const rawAccounts = Array.from(accountsById.values());
  console.info("[Deriv Accounts API] legacy balance fetch completed", {
    rawCount: rawAccounts.length,
    rawAccounts: rawAccounts.map((account) => ({
      account_id: account.account_id,
      loginid: account.loginid,
      currency: account.currency,
      balance: account.balance,
      account_type: account.account_type,
      status: account.status,
    })),
  });
  return rawAccounts;
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
          const {
            accessToken,
            appIdMode = "oauth",
            legacyAccounts = [],
          } = (await request.json()) as DerivAccountsRequest;
          console.log("[Deriv Accounts API] request received", {
            hasAccessToken: Boolean(accessToken),
            appIdMode,
            legacyAccountCount: legacyAccounts.length,
          });
          if (!accessToken && !legacyAccounts.length) {
            return Response.json({ error: "Missing Deriv access token" }, { status: 400 });
          }

          const appId = derivApiAppId(appIdMode);
          if (!appId) {
            console.error("[Deriv Accounts API] missing Deriv App ID");
            return Response.json({ error: "Missing Deriv App ID" }, { status: 400 });
          }

          if (legacyAccounts.length) {
            const rawAccounts = await fetchLegacyAccounts(legacyAccounts, appId);
            if (!rawAccounts.length) {
              return Response.json(
                {
                  error:
                    "Could not load fresh Deriv balances for this legacy account. Please wait a moment and reconnect.",
                },
                { status: 422 },
              );
            }

            console.info("[Deriv Accounts API] legacy raw accounts before normalization", rawAccounts);
            const normalizedAccounts = rawAccounts
              .map((account) => normalizeAccount(account, stringFrom(account.deriv_token)))
              .filter((account): account is NonNullable<ReturnType<typeof normalizeAccount>> =>
                Boolean(account),
              );
            const unknownAccounts = normalizedAccounts.filter(
              (account) => account.normalizedType === "unknown",
            );
            if (unknownAccounts.length) {
              console.warn("[Deriv Accounts API] unknown legacy accounts excluded", unknownAccounts);
            }
            const accounts = normalizedAccounts.filter(
              (account) => account.normalizedType !== "unknown",
            );
            console.log("[Deriv Accounts API] legacy normalized accounts", {
              rawCount: rawAccounts.length,
              eligibleCount: accounts.length,
              skippedCount: rawAccounts.length - accounts.length,
              accounts: accounts.map((account) => ({
                account_id: account.account_id,
                loginid: account.loginid,
                currency: account.currency,
                balance: account.balance,
                detected_prefix: account.detected_prefix,
                normalizedType: account.normalizedType,
                final_tab_placement: account.final_tab_placement,
                is_demo: account.is_demo,
                is_virtual: account.is_virtual,
                reason: account.classification_reason,
              })),
            });

            if (!accounts.length) {
              return Response.json(
                {
                  error:
                    "No active Deriv trading accounts were returned for this legacy login. The account may need migration inside Deriv.",
                },
                { status: 422 },
              );
            }

            return Response.json({ data: accounts });
          }

          if (!accessToken) {
            return Response.json({ error: "Missing Deriv access token" }, { status: 400 });
          }

          console.log("[Deriv Accounts API] accounts fetch started", {
            endpoint: "https://api.derivws.com/trading/v1/options/accounts",
            method: "GET",
            hasAccessToken: Boolean(accessToken),
            appId,
            appIdMode,
            appIdSource: derivApiAppIdSource(appIdMode),
          });
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
          let accounts = normalizedAccounts.filter((account) => account.normalizedType !== "unknown");
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
            console.info("[Deriv Accounts API] raw created accounts before normalization", rawAccounts);
            normalizedAccounts = rawAccounts
              .map(normalizeAccount)
              .filter((account): account is NonNullable<ReturnType<typeof normalizeAccount>> =>
                Boolean(account),
              );
            const createdUnknownAccounts = normalizedAccounts.filter(
              (account) => account.normalizedType === "unknown",
            );
            if (createdUnknownAccounts.length) {
              console.warn("[Deriv Accounts API] unknown created accounts excluded", createdUnknownAccounts);
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
