// src/lib/deriv.ts
import { supabase } from "@/integrations/supabase/client";
import {
  accountLoginId,
  getDerivAccountPrefix,
  getDerivAccountType,
  normalizeDerivAccount,
  type DerivAccountLike,
} from "@/lib/deriv-account";

const DERIV_APP_ID = import.meta.env.VITE_DERIV_APP_ID;
const DERIV_CLIENT_ID = import.meta.env.VITE_DERIV_CLIENT_ID;
const DERIV_LEGACY_APP_ID = String(import.meta.env.VITE_DERIV_LEGACY_APP_ID ?? "").trim();
const DERIV_REDIRECT_URI =
  import.meta.env.VITE_DERIV_REDIRECT_URI ?? "https://www.arktradershub.com/deriv-callback";
const DERIV_OAUTH_ENDPOINT = "https://auth.deriv.com/oauth2/auth";
const DERIV_SCOPE = "trade account_manage";
const PUBLIC_WS_URL = "wss://ws.derivws.com/websockets/v3?app_id=1089";
const LEGACY_OAUTH_MARKERS = [
  "oauth.deriv.com",
  "/oauth2/authorize",
  "redirect=home",
  "brand=deriv",
];
export const DERIV_OAUTH_DASHBOARD_FAILURE_MESSAGE =
  "Deriv redirected to dashboard instead of authorization. This account may not support the new OAuth app flow or the OAuth app configuration must be checked.";
const DERIV_LEGACY_OAUTH_ROUTE_MESSAGE =
  "Blocked legacy Deriv OAuth route. Use the OAuth2 PKCE authorization endpoint.";
const DERIV_SESSION_EXPIRED_CODE = "DERIV_SESSION_EXPIRED";
const DERIV_RECONNECT_MESSAGE = "Please reconnect your Deriv account.";
const TOKEN_EXPIRY_CLOCK_SKEW_MS = 60_000;
const DERIV_OAUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const DERIV_APP_ID_VALUE = DERIV_APP_ID;
export const DERIV_CLIENT_ID_VALUE = DERIV_CLIENT_ID;
export const DERIV_LEGACY_APP_ID_VALUE = DERIV_LEGACY_APP_ID;
export const DERIV_REDIRECT_URI_VALUE = DERIV_REDIRECT_URI;
export const DERIV_OAUTH_ENDPOINT_VALUE = DERIV_OAUTH_ENDPOINT;
export type DerivOAuthDiagnostics = {
  finalUrl: string;
  endpoint: string;
  decodedRedirectUri: string;
  clientId: string;
  appId: string | null;
  scopes: string;
  responseType: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  hasAppId: boolean;
  appIdMatchesClientId: boolean;
  appIdIsLegacyNumeric: boolean;
  appIdLooksLikeClientId: boolean;
  forbiddenMarkers: string[];
  clientIdIsConfigured: boolean;
  clientIdLooksDefined: boolean;
  hasDoubleEncodedRedirectUri: boolean;
  hasAppDerivDashboardRedirect: boolean;
  hasBrandDeriv: boolean;
  hasHomeDashboardLoginRedirect: boolean;
  hasLegacyAuthorizeEndpoint: boolean;
  hasOAuthDerivHost: boolean;
  hasRedirectHome: boolean;
  redirectUriMatchesRegisteredUrl: boolean;
  requiredParamsPresent: Record<string, boolean>;
};
export type DerivOAuthRedirectFailure = {
  message: string;
  reason: "app-dashboard" | "home-dashboard";
  url: string;
};

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

type DerivRecord = Record<string, unknown>;
type DerivError = { message?: string };
export type DerivMessage = DerivRecord & {
  req_id?: number;
  msg_type?: string;
  error?: DerivError;
  subscription?: { id?: string };
  tick?: { symbol?: string; quote?: string | number; epoch?: string | number };
  balance?: {
    balance?: string | number;
    currency?: string;
    loginid?: string;
  };
  proposal?: DerivRecord;
  buy?: DerivRecord;
  sell?: DerivRecord;
  authorize?: DerivRecord;
  proposal_open_contract?: DerivRecord & { is_sold?: boolean };
  candles?: Array<{
    epoch?: string | number;
    open?: string | number;
    high?: string | number;
    low?: string | number;
    close?: string | number;
  }>;
  history?: {
    prices?: Array<string | number>;
    times?: Array<string | number>;
  };
  active_symbols?: Array<{
    symbol?: string;
    display_name?: string;
    market?: string;
    underlying_symbol?: string;
    underlying_symbol_name?: string;
    underlying_symbol_type?: string;
  }>;
};
export type DerivBalance = { balance: number; currency: string; loginid: string };
export type ActiveSymbol = { symbol: string; display_name: string; market: string };
type DerivAppIdMode = "oauth" | "legacy";
export type TradingAdapter = "newOAuthTradingAdapter" | "legacyTradingAdapter";
export type DerivTokenSource = "oauth_access_token" | "legacy_authorize_token";
type DerivSocketError = Error & {
  code?: string;
  status?: number;
  retryable?: boolean;
};
export type DerivTradingSession = {
  sessionId: string | null;
  accountId: string;
  loginid: string;
  token: string;
  tokenSource: DerivTokenSource;
  adapter: TradingAdapter;
  expiresAt: string | null;
  createdAt: string | null;
  sessionAccountId: string;
  sessionLoginid: string | null;
  normalizedType: "real" | "demo" | "unknown";
};

type Listener = (msg: DerivMessage) => void;
type StatusListener = (s: ConnectionStatus) => void;

// Singleton state
let socket: WebSocket | null = null;
let socketAccountId: string | null = null;
const listeners = new Set<Listener>();
const statusListeners = new Set<StatusListener>();
let status: ConnectionStatus = "disconnected";
let reqId = 1;
let connecting: Promise<WebSocket> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectAttempts = 0;
let authenticatedAccount:
  | {
      accessToken: string;
      accountId: string;
      isDemo?: boolean | null;
      tokenSource: DerivTokenSource;
    }
  | null = null;

const isBrowser = typeof window !== "undefined";

// Active subscriptions to replay after a reconnect.
type Sub = { send: DerivRecord; key: string };
const activeSubs = new Map<string, Sub>();

function isCurrentAuthenticatedAccount(account: NonNullable<typeof authenticatedAccount>) {
  return (
    authenticatedAccount?.accessToken === account.accessToken &&
    authenticatedAccount.accountId === account.accountId &&
    authenticatedAccount.isDemo === account.isDemo &&
    authenticatedAccount.tokenSource === account.tokenSource
  );
}

function setStatus(s: ConnectionStatus) {
  if (status === s) return;
  status = s;
  statusListeners.forEach((l) => l(s));
}

export function onStatus(fn: StatusListener) {
  statusListeners.add(fn);
  fn(status);
  return () => statusListeners.delete(fn);
}

export function getStatus() {
  return status;
}

export function getTradingSocketAccountId() {
  return socket?.readyState === WebSocket.OPEN ? socketAccountId : null;
}

export function getSelectedTradingAccountId() {
  return authenticatedAccount?.accountId ?? null;
}

export function setAuthenticatedAccount(
  accessToken: string,
  accountId: string,
  isDemo?: boolean | null,
  tokenSource: DerivTokenSource = tokenSourceFor(accessToken),
) {
  const accountIdentity = { account_id: accountId, loginid: accountId };
  const normalizedType = getDerivAccountType(accountIdentity);
  const detectedPrefix = getDerivAccountPrefix(accountIdentity);
  const normalizedIsDemo =
    normalizedType === "demo" ? true : normalizedType === "real" ? false : isDemo ?? null;
  const sameAccount =
    authenticatedAccount?.accessToken === accessToken &&
    authenticatedAccount.accountId === accountId &&
    authenticatedAccount.isDemo === normalizedIsDemo &&
    authenticatedAccount.tokenSource === tokenSource;
  if (sameAccount) return;

  authenticatedAccount = { accessToken, accountId, isDemo: normalizedIsDemo, tokenSource };
  console.info("[Deriv WS] Active account configured", {
    accountId,
    detected_prefix: detectedPrefix,
    normalizedType,
    requested_is_demo: isDemo,
    forced_is_demo: normalizedIsDemo,
    accountType: normalizedType,
    tokenSource,
    adapter: adapterForTokenSource(tokenSource),
    socketReadyState: socket?.readyState ?? null,
  });
  if (socket) {
    try {
      socket.close(1000, "Switching Deriv account");
    } catch {
      /* ignore */
    }
    socket = null;
    socketAccountId = null;
  }
  connecting = null;
}

export function getDerivTradingErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const socketError = error as DerivSocketError;
    if (
      socketError.code === DERIV_SESSION_EXPIRED_CODE ||
      isInvalidDerivTokenMessage(error.message, socketError.code)
    ) {
      return "Your Deriv session expired. Please reconnect your Deriv account.";
    }
    return error.message;
  }
  return "Trade failed.";
}

export async function prepareDerivTradingSession(
  selectedAccount: DerivAccountLike,
  options: { context?: string } = {},
): Promise<DerivTradingSession> {
  if (!isBrowser) {
    throw createDerivSocketError(
      "Deriv trading is only available in the browser.",
      "DERIV_BROWSER_REQUIRED",
      undefined,
      false,
    );
  }

  const normalizedSelected = normalizeDerivAccount(selectedAccount, { trustVirtualFlags: false });
  const selectedAccountId = normalizedSelected?.account_id ?? accountLoginId(selectedAccount);
  if (!normalizedSelected || !selectedAccountId) {
    throw createDerivSocketError(
      "Selected Deriv account could not be verified.",
      "DERIV_ACCOUNT_INVALID",
      undefined,
      false,
    );
  }
  const selectedAccountToken = textFrom(selectedAccount.deriv_token);
  const selectedAccountTokenSource = selectedAccountToken
    ? tokenSourceForAccount(selectedAccount, selectedAccountToken)
    : null;
  const normalizedType = normalizedSelected.normalizedType;
  if (normalizedType !== "real" && normalizedType !== "demo") {
    throw createDerivSocketError(
      "Selected Deriv account type could not be verified from its prefix.",
      "DERIV_ACCOUNT_TYPE_INVALID",
      undefined,
      false,
    );
  }

  const { data: authData, error: authError } = await supabase.auth.getSession();
  const userId = authData.session?.user?.id ?? null;
  if (authError || !userId) {
    if (selectedAccountToken && selectedAccountTokenSource === "oauth_access_token") {
      const expiry = effectiveTokenExpiryState(
        textFrom(selectedAccount.expires_at) || null,
        textFrom(selectedAccount.created_at) || null,
        selectedAccountTokenSource,
      );
      console.warn("[Deriv Trading] Supabase session unavailable; using selected OAuth account token", {
        context: options.context ?? "trade",
        selectedAccountId,
        authError: authError?.message ?? null,
        tokenExists: true,
        tokenExpiry: expiry.expiresAt,
        storedTokenExpiry: expiry.storedExpiresAt,
        platformTokenExpiry: expiry.platformExpiresAt,
        shortProviderTokenExpiry: expiry.shortProviderExpiresAt,
        expiryPolicy: expiry.expiryPolicy,
        tokenExpired: expiry.expired,
        tokenSource: selectedAccountTokenSource,
        adapter: adapterForTokenSource(selectedAccountTokenSource),
      });
      if (!expiry.expired) {
        setAuthenticatedAccount(
          selectedAccountToken,
          selectedAccountId,
          normalizedType === "demo",
          selectedAccountTokenSource,
        );
        return {
          sessionId: null,
          accountId: selectedAccountId,
          loginid: normalizedSelected.loginid,
          token: selectedAccountToken,
          tokenSource: selectedAccountTokenSource,
          adapter: adapterForTokenSource(selectedAccountTokenSource),
          expiresAt: expiry.expiresAt,
          createdAt: textFrom(selectedAccount.created_at) || null,
          sessionAccountId: selectedAccountId,
          sessionLoginid: normalizedSelected.loginid ?? null,
          normalizedType,
        };
      }
    }
    throw createDerivSocketError(
      "Your Deriv session expired. Please reconnect your Deriv account.",
      DERIV_SESSION_EXPIRED_CODE,
      401,
      false,
    );
  }

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("sessions")
    .select(
      "id, account_id, loginid, deriv_token, is_demo, is_virtual, currency, balance, expires_at, is_active, created_at",
    )
    .eq("user_id", userId)
    .eq("is_active", true);

  if (sessionsError) {
    console.error("[Deriv Trading] Supabase session lookup failed", {
      context: options.context ?? "trade",
      selectedAccountId,
      userId,
      message: sessionsError.message,
      code: sessionsError.code,
      details: sessionsError.details,
    });
    throw createDerivSocketError(
      "Could not verify your Deriv trading session.",
      "DERIV_SESSION_LOOKUP_FAILED",
      undefined,
      false,
    );
  }

  const matchingSessions = (sessionRows ?? [])
    .filter(
      (session) =>
        sameDerivId(textFrom(session.account_id), selectedAccountId) ||
        sameDerivId(textFrom(session.loginid), selectedAccountId),
    )
    .sort(compareSessionFreshness);
  const selectedSession = matchingSessions[0] ?? null;
  const storedToken = textFrom(selectedSession?.deriv_token);
  const useSelectedAccountOAuthFallback =
    !storedToken &&
    selectedAccountToken &&
    selectedAccountTokenSource === "oauth_access_token";
  const resolvedToken = storedToken || (useSelectedAccountOAuthFallback ? selectedAccountToken : "");
  const storedTokenSource = storedToken
    ? readStoredTokenSource(userId, selectedAccountId)
    : null;
  const tokenSource = resolvedToken
    ? storedTokenSource ?? tokenSourceForAccount(selectedAccount, resolvedToken)
    : null;
  const resolvedExpiresAt =
    selectedSession?.expires_at ?? textFrom(selectedAccount.expires_at) ?? null;
  const resolvedCreatedAt =
    selectedSession?.created_at ?? textFrom(selectedAccount.created_at) ?? null;
  const expiry = effectiveTokenExpiryState(
    resolvedExpiresAt,
    resolvedCreatedAt,
    tokenSource,
  );
  const adapter = tokenSource ? adapterForTokenSource(tokenSource) : null;

  console.info("[Deriv Trading] pre-trade session validation", {
    context: options.context ?? "trade",
    selectedAccount: {
      account_id: selectedAccountId,
      loginid: normalizedSelected.loginid,
      normalizedType: normalizedSelected.normalizedType,
      detected_prefix: normalizedSelected.detected_prefix,
      final_tab_placement: normalizedSelected.final_tab_placement,
    },
    session: {
      found: Boolean(selectedSession),
      matchingSessionCount: matchingSessions.length,
      sessionId: selectedSession?.id ?? null,
      account_id: selectedSession?.account_id ?? null,
      loginid: selectedSession?.loginid ?? null,
      tokenExists: Boolean(resolvedToken),
      storedTokenExists: Boolean(storedToken),
      selectedAccountTokenExists: Boolean(selectedAccountToken),
      selectedAccountOAuthFallback: Boolean(useSelectedAccountOAuthFallback),
      tokenExpiry: expiry.expiresAt,
      storedTokenExpiry: expiry.storedExpiresAt,
      platformTokenExpiry: expiry.platformExpiresAt,
      shortProviderTokenExpiry: expiry.shortProviderExpiresAt,
      expiryPolicy: expiry.expiryPolicy,
      currentTime: expiry.currentTime,
      tokenExpired: expiry.expired,
      expiresWithinClockSkew: expiry.expiresWithinClockSkew,
      invalidExpiry: expiry.invalidExpiry,
      storedTokenSource,
      tokenSource,
      adapter,
      createdAt: resolvedCreatedAt,
    },
    selectedReactTokenMatchesSession: Boolean(
      textFrom(selectedAccount.deriv_token) &&
        storedToken &&
        textFrom(selectedAccount.deriv_token) === storedToken,
    ),
  });

  if ((!selectedSession && !useSelectedAccountOAuthFallback) || !resolvedToken || expiry.expired) {
    throw createDerivSocketError(
      "Your Deriv session expired. Please reconnect your Deriv account.",
      DERIV_SESSION_EXPIRED_CODE,
      401,
      false,
    );
  }

  setAuthenticatedAccount(resolvedToken, selectedAccountId, normalizedType === "demo", tokenSource);
  return {
    sessionId: selectedSession?.id ?? null,
    accountId: selectedAccountId,
    loginid: normalizedSelected.loginid,
    token: resolvedToken,
    tokenSource,
    adapter,
    expiresAt: resolvedExpiresAt,
    createdAt: resolvedCreatedAt,
    sessionAccountId: selectedSession?.account_id ?? selectedAccountId,
    sessionLoginid: selectedSession?.loginid ?? normalizedSelected.loginid ?? null,
    normalizedType,
  };
}

function authenticatedAccountTypeLabel(account: NonNullable<typeof authenticatedAccount>) {
  if (account.isDemo === true) return "demo";
  if (account.isDemo === false) return "real";
  return "unknown";
}

function isLikelyDerivOAuthToken(token: string | null | undefined) {
  if (!token) return false;
  return token.startsWith("ory_") || token.includes("ory_at_");
}

function tokenSourceFromText(value: unknown): DerivTokenSource | null {
  const text = textFrom(value).toLowerCase();
  if (!text) return null;
  if (text.includes("oauth")) return "oauth_access_token";
  if (text.includes("legacy")) return "legacy_authorize_token";
  return null;
}

function numericDerivAppId(...ids: Array<string | undefined>) {
  return ids.map((id) => String(id ?? "").trim()).find((id) => /^\d+$/.test(id)) ?? "";
}

function legacyTradingWsUrl() {
  const appId = numericDerivAppId(DERIV_LEGACY_APP_ID, DERIV_APP_ID, "1089");
  return `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`;
}

function createDerivSocketError(
  message: string,
  code: string,
  status?: number,
  retryable = true,
) {
  const error = new Error(message) as DerivSocketError;
  error.code = code;
  error.status = status;
  error.retryable = retryable;
  return error;
}

function isRetryableSocketError(error: Error) {
  const socketError = error as DerivSocketError;
  if (socketError.retryable === false) return false;
  if (
    socketError.code === DERIV_SESSION_EXPIRED_CODE ||
    socketError.code === "DERIV_LEGACY_DIRECT_WS_REQUIRED" ||
    socketError.code === "DERIV_AUTHORIZE_FAILED" ||
    socketError.status === 401 ||
    socketError.status === 403
  ) {
    return false;
  }
  return true;
}

function textFrom(...values: unknown[]) {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function tokenSourceStorageKey(userId: string, accountId: string) {
  return `deriv_token_source:${userId}:${accountId.toUpperCase()}`;
}

function readStoredTokenSource(
  userId: string,
  accountId: string,
): DerivTokenSource | null {
  if (!isBrowser) return null;
  try {
    const saved = localStorage.getItem(tokenSourceStorageKey(userId, accountId));
    if (saved === "oauth_access_token" || saved === "legacy_authorize_token") return saved;
  } catch {
    /* ignore localStorage access failures */
  }
  return null;
}

function sameDerivId(left: string | null | undefined, right: string | null | undefined) {
  return Boolean(left && right && left.trim().toUpperCase() === right.trim().toUpperCase());
}

function timestampValue(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function tokenExpiryState(expiresAt: string | null | undefined) {
  const currentTimeMs = Date.now();
  if (!expiresAt) {
    return {
      expiresAt: null,
      currentTime: new Date(currentTimeMs).toISOString(),
      expired: false,
      expiresWithinClockSkew: false,
      invalidExpiry: false,
    };
  }
  const expiry = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiry)) {
    return {
      expiresAt,
      currentTime: new Date(currentTimeMs).toISOString(),
      expired: false,
      expiresWithinClockSkew: false,
      invalidExpiry: true,
    };
  }
  return {
    expiresAt,
    currentTime: new Date(currentTimeMs).toISOString(),
    expired: expiry <= currentTimeMs - TOKEN_EXPIRY_CLOCK_SKEW_MS,
    expiresWithinClockSkew: expiry <= currentTimeMs + TOKEN_EXPIRY_CLOCK_SKEW_MS,
    invalidExpiry: false,
  };
}

function effectiveTokenExpiryState(
  expiresAt: string | null | undefined,
  createdAt: string | null | undefined,
  tokenSource: DerivTokenSource | null,
) {
  if (tokenSource !== "oauth_access_token") {
    return {
      ...tokenExpiryState(expiresAt),
      storedExpiresAt: expiresAt ?? null,
      platformExpiresAt: null,
      expiryPolicy: "stored",
    };
  }

  const storedExpiryMs = timestampValue(expiresAt);
  const createdAtMs = timestampValue(createdAt);
  const currentTimeMs = Date.now();
  const platformExpiryMs = createdAtMs ? createdAtMs + DERIV_OAUTH_SESSION_TTL_MS : 0;
  const shortProviderExpiryMs =
    storedExpiryMs &&
    storedExpiryMs >= currentTimeMs - DERIV_OAUTH_SESSION_TTL_MS &&
    storedExpiryMs <= currentTimeMs + 24 * 60 * 60 * 1000
      ? storedExpiryMs + DERIV_OAUTH_SESSION_TTL_MS
      : 0;
  const effectiveExpiryMs = Math.max(storedExpiryMs, platformExpiryMs, shortProviderExpiryMs);
  const effectiveExpiresAt = effectiveExpiryMs
    ? new Date(effectiveExpiryMs).toISOString()
    : expiresAt;

  return {
    ...tokenExpiryState(effectiveExpiresAt),
    storedExpiresAt: expiresAt ?? null,
    platformExpiresAt: platformExpiryMs ? new Date(platformExpiryMs).toISOString() : null,
    shortProviderExpiresAt: shortProviderExpiryMs
      ? new Date(shortProviderExpiryMs).toISOString()
      : null,
    expiryPolicy: "oauth-platform-week",
  };
}

function compareSessionFreshness(
  left: {
    expires_at?: string | null;
    created_at?: string | null;
  },
  right: {
    expires_at?: string | null;
    created_at?: string | null;
  },
) {
  const leftExpiry = timestampValue(left.expires_at);
  const rightExpiry = timestampValue(right.expires_at);
  if (leftExpiry !== rightExpiry) return rightExpiry - leftExpiry;
  return timestampValue(right.created_at) - timestampValue(left.created_at);
}

function isInvalidDerivTokenMessage(message: string | undefined, code?: string) {
  const lower = `${message ?? ""} ${code ?? ""}`.toLowerCase();
  return (
    lower.includes("token is invalid") ||
    lower.includes("invalid token") ||
    lower.includes("token invalid") ||
    lower.includes("authorization required") ||
    lower.includes("authorize") && lower.includes("token")
  );
}

function derivMessageError(error: DerivError | undefined) {
  const message = textFrom(error?.message, "Deriv request failed.");
  if (isInvalidDerivTokenMessage(message)) {
    if (authenticatedAccount?.tokenSource === "legacy_authorize_token") {
      void deactivateInvalidDerivSession("deriv-invalid-token");
    } else {
      console.warn("[Deriv Trading] OAuth invalid-token response did not deactivate session", {
        accountId: authenticatedAccount?.accountId ?? null,
        tokenSource: authenticatedAccount?.tokenSource ?? null,
        reason:
          "OAuth sessions are kept active until their stored expiry or manual logout to avoid false immediate disconnects after reconnect.",
      });
      return createDerivSocketError(
        "Deriv rejected OAuth trading authorization for this account. Please refresh balances and try again.",
        "DERIV_OAUTH_TRADING_AUTH_FAILED",
        401,
        false,
      );
    }
    return createDerivSocketError(
      "Your Deriv session expired. Please reconnect your Deriv account.",
      DERIV_SESSION_EXPIRED_CODE,
      401,
      false,
    );
  }
  return createDerivSocketError(message, "DERIV_REQUEST_FAILED", undefined, true);
}

async function deactivateInvalidDerivSession(reason: string) {
  if (!isBrowser || !authenticatedAccount?.accountId) return;
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return;
    console.warn("[Deriv Trading] deactivating invalid Deriv session", {
      reason,
      userId,
      accountId: authenticatedAccount.accountId,
    });
    await supabase
      .from("sessions")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("account_id", authenticatedAccount.accountId);
    window.dispatchEvent(
      new CustomEvent("deriv:sessions-updated", {
        detail: {
          userId,
          selectedAccountId: authenticatedAccount.accountId,
          reason,
        },
      }),
    );
  } catch (error) {
    console.warn("[Deriv Trading] could not deactivate invalid Deriv session", {
      reason,
      error,
    });
  }
}

function tokenSourceFor(token: string): DerivTokenSource {
  return isLikelyDerivOAuthToken(token)
    ? "oauth_access_token"
    : "legacy_authorize_token";
}

function adapterForToken(token: string): TradingAdapter {
  return adapterForTokenSource(tokenSourceFor(token));
}

function tokenSourceForAccount(
  account: DerivAccountLike,
  fallbackToken: string,
): DerivTokenSource {
  return (
    tokenSourceFromText(account.token_source) ??
    tokenSourceFromText(account.deriv_token_source) ??
    tokenSourceFromText(account.session_source) ??
    tokenSourceFromText(account.auth_type) ??
    tokenSourceFromText(account.tokenSource) ??
    tokenSourceFor(fallbackToken)
  );
}

function adapterForTokenSource(tokenSource: DerivTokenSource): TradingAdapter {
  return tokenSource === "oauth_access_token"
    ? "newOAuthTradingAdapter"
    : "legacyTradingAdapter";
}

function startKeepalive() {
  stopKeepalive();
  if (!isBrowser) return;
  pingTimer = setInterval(() => {
    if (socket?.readyState === 1) {
      // 1 = OPEN
      try {
        socket.send(JSON.stringify({ ping: 1, req_id: reqId++ }));
      } catch {
        /* ignore */
      }
    }
  }, 30000);
}

function stopKeepalive() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

function connect(): Promise<WebSocket> {
  if (!isBrowser) {
    return new Promise((_, reject) => reject(new Error("WebSocket unavailable on server")));
  }
  if (!authenticatedAccount) {
    return Promise.reject(new Error("Authenticated Deriv account has not been set."));
  }
  if (socket && socket.readyState === WebSocket.OPEN) {
    if (socketAccountId !== authenticatedAccount.accountId) {
      console.warn("[Deriv WS] Closing mismatched open socket", {
        socketAccountId,
        selectedAccountId: authenticatedAccount.accountId,
      });
      try {
        socket.close(1000, "Selected Deriv account changed");
      } catch {
        /* ignore */
      }
      socket = null;
      socketAccountId = null;
    } else {
      console.info("[Deriv WS] Reusing open socket", {
        accountId: authenticatedAccount.accountId,
        readyState: socket.readyState,
      });
      return Promise.resolve(socket);
    }
  }
  if (connecting) return connecting;

  setStatus(reconnectAttempts > 0 ? "reconnecting" : "connecting");
  connecting = openAuthenticatedSocket(authenticatedAccount, false);
  return connecting;
}

function openAuthenticatedSocket(
  account: NonNullable<typeof authenticatedAccount>,
  retried: boolean,
): Promise<WebSocket> {
  return new Promise(async (resolve, reject) => {
    let ws: WebSocket | null = null;
    let settled = false;
    let legacyAuthorizeReqId: number | null = null;
    const useLegacyDirectWs = account.tokenSource === "legacy_authorize_token";

    const completeOpen = () => {
      if (!ws) {
        reject(new Error("Deriv WebSocket was not created."));
        return;
      }
      if (!isCurrentAuthenticatedAccount(account)) {
        try {
          ws.close(1000, "Deriv account changed while connecting");
        } catch {
          /* ignore */
        }
        if (!settled) {
          settled = true;
          connecting = null;
          reject(new Error("Deriv account changed while opening WebSocket."));
        }
        return;
      }
      if (settled) return;
      settled = true;
      socket = ws;
      socketAccountId = account.accountId;
      connecting = null;
      reconnectAttempts = 0;
      setStatus("connected");
      console.info("[Deriv WS] authenticated socket ready", {
        accountId: account.accountId,
        accountType: authenticatedAccountTypeLabel(account),
        mode: useLegacyDirectWs ? "legacy-direct-authorize" : "oauth-otp",
        readyState: ws.readyState,
      });
      startKeepalive();
      for (const sub of activeSubs.values()) {
        try {
          ws.send(JSON.stringify(sub.send));
        } catch {
          /* ignore */
        }
      }
      resolve(ws);
    };

    const fail = async (error: Error) => {
      if (settled) return;
      settled = true;
      if (ws === socket) {
        socket = null;
        socketAccountId = null;
      }
      connecting = null;
      stopKeepalive();
      setStatus("disconnected");
      if (!retried && isRetryableSocketError(error)) {
        console.warn("[Deriv WS] Socket failed. Retrying once.", {
          accountId: account.accountId,
          accountType: authenticatedAccountTypeLabel(account),
          mode: useLegacyDirectWs ? "legacy-direct-authorize" : "oauth-otp",
          error: error.message,
          code: (error as DerivSocketError).code ?? null,
          status: (error as DerivSocketError).status ?? null,
        });
        setStatus("reconnecting");
        connecting = openAuthenticatedSocket(account, true);
        try {
          resolve(await connecting);
        } catch (retryError) {
          reject(retryError);
        }
        return;
      }
      console.warn("[Deriv WS] Socket failed without retry", {
        accountId: account.accountId,
        accountType: authenticatedAccountTypeLabel(account),
        mode: useLegacyDirectWs ? "legacy-direct-authorize" : "oauth-otp",
        error: error.message,
        code: (error as DerivSocketError).code ?? null,
        status: (error as DerivSocketError).status ?? null,
        retried,
      });
      reject(error);
    };

    try {
      if (socket) {
        console.info("[Deriv WS] Closing old socket before opening fresh trading socket", {
          accountId: account.accountId,
          readyState: socket.readyState,
        });
        try {
          socket.close(1000, "Opening fresh Deriv trading socket");
        } catch {
          /* ignore */
        }
        socket = null;
        socketAccountId = null;
      }

      const authenticatedWsUrl = useLegacyDirectWs
        ? legacyTradingWsUrl()
        : await getAuthenticatedWsUrl(account.accessToken, account.accountId, account.tokenSource);
      if (!isCurrentAuthenticatedAccount(account)) {
        connecting = null;
        reject(new Error("Deriv account changed while opening WebSocket."));
        return;
      }
      console.info("[Deriv WS] WebSocket URL prepared", {
        accountId: account.accountId,
        accountType: authenticatedAccountTypeLabel(account),
        mode: useLegacyDirectWs ? "legacy-direct-authorize" : "oauth-otp",
        wsUrl: authenticatedWsUrl,
        retried,
      });

      ws = new WebSocket(authenticatedWsUrl);
      console.info("[Deriv WS] Socket created", {
        accountId: account.accountId,
        readyState: ws.readyState,
      });
      ws.onopen = () => {
        if (!isCurrentAuthenticatedAccount(account)) {
          try {
            ws?.close(1000, "Deriv account changed while connecting");
          } catch {
            /* ignore */
          }
          if (!settled) {
            settled = true;
            connecting = null;
            reject(new Error("Deriv account changed while opening WebSocket."));
          }
          return;
        }
        console.info("[Deriv WS] onopen", {
          accountId: account.accountId,
          mode: useLegacyDirectWs ? "legacy-direct-authorize" : "oauth-otp",
          readyState: ws.readyState,
        });

        if (useLegacyDirectWs) {
          legacyAuthorizeReqId = reqId++;
          console.info("[Deriv WS] legacy authorize started", {
            accountId: account.accountId,
            req_id: legacyAuthorizeReqId,
          });
          try {
            ws.send(
              JSON.stringify({
                authorize: account.accessToken,
                req_id: legacyAuthorizeReqId,
              }),
            );
          } catch (error) {
            void fail(
              error instanceof Error
                ? error
                : new Error("Could not send Deriv legacy authorize request"),
            );
          }
          return;
        }

        completeOpen();
      };
      ws.onerror = (event) => {
        console.error("[Deriv WS] onerror", {
          accountId: account.accountId,
          readyState: ws?.readyState ?? null,
          event,
        });
        void fail(new Error("Deriv WebSocket connection failed"));
      };
      ws.onclose = (event) => {
        console.warn("[Deriv WS] onclose", {
          accountId: account.accountId,
          readyState: ws?.readyState ?? null,
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        if (socket === ws) {
          socket = null;
          socketAccountId = null;
          stopKeepalive();
          setStatus("disconnected");
        }
        reconnectAttempts++;
        void fail(
          new Error(
            event.reason
              ? `Deriv WebSocket closed: ${event.reason}`
              : `Deriv WebSocket closed with code ${event.code}`,
          ),
        );
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as DerivMessage;
          if (
            useLegacyDirectWs &&
            !settled &&
            (data.req_id === legacyAuthorizeReqId || data.msg_type === "authorize")
          ) {
            if (data.error) {
              if (isInvalidDerivTokenMessage(data.error.message)) {
                void deactivateInvalidDerivSession("legacy-authorize-invalid-token");
              }
              void fail(
                isInvalidDerivTokenMessage(data.error.message)
                  ? createDerivSocketError(
                      "Your Deriv session expired. Please reconnect your Deriv account.",
                      DERIV_SESSION_EXPIRED_CODE,
                      401,
                      false,
                    )
                  : createDerivSocketError(
                      data.error.message ?? DERIV_RECONNECT_MESSAGE,
                      "DERIV_AUTHORIZE_FAILED",
                      401,
                      false,
                    ),
              );
              return;
            }
            const authorizedLoginid = textFrom(data.authorize?.loginid, data.authorize?.account_id);
            if (authorizedLoginid && !sameDerivId(authorizedLoginid, account.accountId)) {
              void fail(
                createDerivSocketError(
                  "Your Deriv session expired. Please reconnect your Deriv account.",
                  "DERIV_TOKEN_ACCOUNT_MISMATCH",
                  401,
                  false,
                ),
              );
              return;
            }
            console.info("[Deriv WS] legacy authorize success", {
              accountId: account.accountId,
              authorizedLoginid: authorizedLoginid || null,
              req_id: legacyAuthorizeReqId,
              msg_type: data.msg_type,
            });
            completeOpen();
            return;
          }
          listeners.forEach((l) => l(data));
        } catch {
          /* ignore */
        }
      };
    } catch (e) {
      void fail(e instanceof Error ? e : new Error("Deriv WebSocket connection failed"));
    }
  });
}

export function onMessage(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function forgetSubscription(subscriptionId: string) {
  if (!subscriptionId) return;
  try {
    await send({ forget: subscriptionId });
  } catch (error) {
    console.warn("[Deriv WS] Could not forget subscription", { subscriptionId, error });
  }
}

export async function send(payload: DerivRecord): Promise<DerivMessage> {
  if (!isBrowser) return {};
  if (payload.proposal === 1 && "underlying_symbol" in payload) {
    throw createDerivSocketError(
      "Invalid Deriv proposal payload: use symbol, not underlying_symbol.",
      "DERIV_PAYLOAD_INVALID",
      undefined,
      false,
    );
  }
  const ws = await connect();
  if (authenticatedAccount && socketAccountId !== authenticatedAccount.accountId) {
    throw new Error("Deriv WebSocket account does not match the selected account.");
  }
  const id = reqId++;
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      off();
      reject(new Error("Deriv request timed out"));
    }, 15000);
    const off = onMessage((msg) => {
      if (msg.req_id === id) {
        clearTimeout(timeoutId);
        off();
        if (msg.error) reject(derivMessageError(msg.error));
        else resolve(msg);
      }
    });
    ws.send(JSON.stringify({ ...payload, req_id: id }));
  });
}

export async function subscribeTicks(
  symbol: string,
  onTick: (price: number, time: number) => void,
) {
  if (!isBrowser) return () => {};
  const ws = await connectPublic();
  const sub = { send: { ticks: symbol, subscribe: 1 } };
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.msg_type === "tick" && msg.tick?.symbol === symbol) {
        onTick(Number(msg.tick.quote), Number(msg.tick.epoch));
      }
    } catch {
      /* ignore */
    }
  };
  ws.send(JSON.stringify(sub.send));
  return () => {
    try {
      if (ws.readyState === 1) ws.send(JSON.stringify({ forget_all: "ticks" }));
      ws.close();
    } catch {
      /* ignore */
    }
  };
}

export async function subscribeBalance(token: string, onBalance: (b: DerivBalance) => void) {
  if (!isBrowser) return () => {};
  const key = `balance:${token.slice(-6)}`;
  const sub = { send: { balance: 1, subscribe: 1 }, key };
  const ws = await connect();
  activeSubs.set(key, sub);
  const off = onMessage((msg) => {
    if (msg.msg_type === "balance" && msg.balance) {
      onBalance({
        balance: Number(msg.balance.balance),
        currency: String(msg.balance.currency ?? ""),
        loginid: String(msg.balance.loginid ?? ""),
      });
    }
  });
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(sub.send));
  return () => {
    off();
    activeSubs.delete(key);
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ forget_all: "balance" }));
    }
  };
}

export type Candle = { time: number; open: number; high: number; low: number; close: number };
export type TickPoint = { time: number; value: number };

export async function fetchCandles(
  symbol: string,
  granularity: number,
  count = 500,
): Promise<Candle[]> {
  if (!isBrowser) return [];
  const res = await publicSend({
    ticks_history: symbol,
    style: "candles",
    granularity,
    count,
    end: "latest",
    adjust_start_time: 1,
  });
  return (res?.candles ?? []).map((c) => ({
    time: Number(c.epoch),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
  }));
}

export async function fetchTicks(symbol: string, count = 500): Promise<TickPoint[]> {
  if (!isBrowser) return [];
  const res = await publicSend({
    ticks_history: symbol,
    style: "ticks",
    count,
    end: "latest",
    adjust_start_time: 1,
  });
  const prices = res?.history?.prices ?? [];
  const times = res?.history?.times ?? [];
  return prices
    .map((price, index: number) => ({
      time: Number(times[index]),
      value: Number(price),
    }))
    .filter((point: TickPoint) => Number.isFinite(point.time) && Number.isFinite(point.value));
}

export async function getActiveSymbols(): Promise<ActiveSymbol[]> {
  if (!isBrowser) return [];
  if (symbolsCache) return symbolsCache;
  const res = await publicSend({ active_symbols: "brief", product_type: "basic" });
  symbolsCache = (res?.active_symbols ?? []).map((s) => ({
    symbol: String(s.underlying_symbol ?? s.symbol ?? ""),
    display_name: String(s.underlying_symbol_name ?? s.display_name ?? ""),
    market: String(s.underlying_symbol_type ?? s.market ?? ""),
  }));
  return symbolsCache!;
}

let symbolsCache: ActiveSymbol[] | null = null;

export function disconnectAll(): void {
  if (!isBrowser) return;
  activeSubs.clear();
  authenticatedAccount = null;
  stopKeepalive();
  if (socket) {
    try {
      socket.close();
    } catch {
      /* ignore */
    }
    socket = null;
    socketAccountId = null;
  }
  connecting = null;
  setStatus("disconnected");
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  arr.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  return crypto.subtle.digest("SHA-256", data);
}

function legacyOAuthMarker(url: string) {
  const lower = url.toLowerCase();
  return LEGACY_OAUTH_MARKERS.find((item) => lower.includes(item)) ?? null;
}

function safeParseUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function oauthDebugEnabled() {
  if (!isBrowser) return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("debug_oauth") === "1" || sessionStorage.getItem("deriv_oauth_debug") === "1";
}

function logOAuthDebug(label: string, payload: unknown) {
  if (oauthDebugEnabled()) console.info(label, payload);
}

function forbiddenOAuthMarkers(url: string) {
  const parsed = safeParseUrl(url);
  const lower = url.toLowerCase();
  const markers: string[] = [];
  if (parsed?.origin === "https://oauth.deriv.com") markers.push("oauth.deriv.com");
  if (parsed?.origin === "https://app.deriv.com") markers.push("app.deriv.com");
  if (
    parsed?.origin === "https://home.deriv.com" &&
    parsed.pathname.startsWith("/dashboard/login")
  ) {
    markers.push("home.deriv.com/dashboard/login");
  }
  if (parsed?.pathname === "/oauth2/authorize" || lower.includes("/oauth2/authorize")) {
    markers.push("/oauth2/authorize");
  }
  if (parsed?.searchParams.get("redirect") === "home" || lower.includes("redirect=home")) {
    markers.push("redirect=home");
  }
  if (parsed?.searchParams.get("brand") === "deriv" || lower.includes("brand=deriv")) {
    markers.push("brand=deriv");
  }
  return markers;
}

function isNumericLegacyAppId(appId: string | null | undefined) {
  return !appId || /^\d+$/.test(appId);
}

export function getDerivOAuthRedirectFailure(url: string | null | undefined) {
  if (!url) return null;
  const parsed = safeParseUrl(url);
  if (!parsed) return null;

  // This detects Deriv returning the browser to a dashboard instead of the
  // OAuth callback. Legacy OAuth URL blocking is outbound-only in
  // assertValidDerivOAuthRedirectUrl so Deriv's internal compatibility routing
  // after consent is not treated as an app-started legacy login.
  if (
    parsed.origin === "https://app.deriv.com" &&
    parsed.pathname === "/" &&
    (!parsed.search || parsed.searchParams.has("account"))
  ) {
    return {
      message: DERIV_OAUTH_DASHBOARD_FAILURE_MESSAGE,
      reason: "app-dashboard",
      url,
    } satisfies DerivOAuthRedirectFailure;
  }

  if (parsed.origin === "https://home.deriv.com" && parsed.pathname.startsWith("/dashboard/login")) {
    return {
      message: DERIV_OAUTH_DASHBOARD_FAILURE_MESSAGE,
      reason: "home-dashboard",
      url,
    } satisfies DerivOAuthRedirectFailure;
  }

  return null;
}

export function getDerivOAuthDiagnostics(url: string): DerivOAuthDiagnostics {
  const parsed = new URL(url);
  const decodedRedirectUri = parsed.searchParams.get("redirect_uri") ?? "";
  const clientId = parsed.searchParams.get("client_id") ?? "";
  const appId = parsed.searchParams.get("app_id");
  const forbiddenMarkers = forbiddenOAuthMarkers(url);
  const requiredParams = [
    "response_type",
    "client_id",
    "redirect_uri",
    "scope",
    "state",
    "code_challenge",
    "code_challenge_method",
  ];
  const requiredParamsPresent = requiredParams.reduce<Record<string, boolean>>((acc, param) => {
    acc[param] = Boolean(parsed.searchParams.get(param));
    return acc;
  }, {});

  return {
    finalUrl: url,
    endpoint: `${parsed.origin}${parsed.pathname}`,
    decodedRedirectUri,
    clientId,
    appId,
    scopes: parsed.searchParams.get("scope") ?? "",
    responseType: parsed.searchParams.get("response_type") ?? "",
    state: parsed.searchParams.get("state") ?? "",
    codeChallenge: parsed.searchParams.get("code_challenge") ?? "",
    codeChallengeMethod: parsed.searchParams.get("code_challenge_method") ?? "",
    hasAppId: parsed.searchParams.has("app_id"),
    appIdMatchesClientId: Boolean(appId && appId === clientId),
    appIdIsLegacyNumeric: isNumericLegacyAppId(appId),
    appIdLooksLikeClientId: Boolean(appId && appId === clientId),
    forbiddenMarkers,
    clientIdIsConfigured: Boolean(DERIV_CLIENT_ID),
    clientIdLooksDefined: !["", "undefined", "null"].includes(
      (parsed.searchParams.get("client_id") ?? "").toLowerCase(),
    ),
    hasDoubleEncodedRedirectUri: /%3a%2f%2f/i.test(decodedRedirectUri),
    hasAppDerivDashboardRedirect: parsed.origin === "https://app.deriv.com",
    hasBrandDeriv: parsed.searchParams.get("brand") === "deriv",
    hasHomeDashboardLoginRedirect:
      parsed.origin === "https://home.deriv.com" &&
      parsed.pathname.startsWith("/dashboard/login"),
    hasLegacyAuthorizeEndpoint: parsed.pathname === "/oauth2/authorize",
    hasOAuthDerivHost: parsed.origin === "https://oauth.deriv.com",
    hasRedirectHome: parsed.searchParams.get("redirect") === "home",
    redirectUriMatchesRegisteredUrl: decodedRedirectUri === DERIV_REDIRECT_URI,
    requiredParamsPresent,
  };
}

export function assertValidDerivOAuthRedirectUrl(url: string) {
  const redirectFailure = getDerivOAuthRedirectFailure(url);
  if (redirectFailure) {
    console.error("[Deriv OAuth] Blocked invalid authorization redirect", redirectFailure);
    throw new Error(redirectFailure.message);
  }

  const marker = legacyOAuthMarker(url);
  if (marker) {
    console.error("Blocked legacy Deriv OAuth URL", { marker, url });
    throw new Error(DERIV_LEGACY_OAUTH_ROUTE_MESSAGE);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid Deriv OAuth URL. Refusing to redirect.");
  }

  if (parsed.origin !== "https://auth.deriv.com" || parsed.pathname !== "/oauth2/auth") {
    throw new Error("Invalid Deriv OAuth endpoint. Refusing to redirect to a non-OAuth URL.");
  }
  if (parsed.searchParams.has("redirect") || parsed.searchParams.has("brand")) {
    console.error("Blocked legacy Deriv OAuth URL", {
      marker: parsed.searchParams.has("redirect") ? "redirect" : "brand",
      url,
    });
    throw new Error("Blocked legacy Deriv OAuth URL");
  }
  if (parsed.searchParams.has("app_id")) {
    const appId = parsed.searchParams.get("app_id");
    if (!isNumericLegacyAppId(appId)) {
      throw new Error("Invalid Deriv OAuth URL. app_id must be the numeric legacy V1 app ID.");
    }
    if (appId === parsed.searchParams.get("client_id")) {
      throw new Error("Invalid Deriv OAuth URL. app_id must not be the OAuth client_id.");
    }
  }
  if (!parsed.searchParams.get("client_id")) {
    throw new Error("Invalid Deriv OAuth URL. Authorization URL must include client_id.");
  }
  const diagnostics = getDerivOAuthDiagnostics(url);
  const missingParam = Object.entries(diagnostics.requiredParamsPresent).find(([, exists]) => !exists);
  if (missingParam) {
    throw new Error(`Invalid Deriv OAuth URL. Missing required parameter: ${missingParam[0]}.`);
  }
  if (diagnostics.responseType !== "code") {
    throw new Error("Invalid Deriv OAuth URL. response_type must be code.");
  }
  if (diagnostics.codeChallengeMethod !== "S256") {
    throw new Error("Invalid Deriv OAuth URL. code_challenge_method must be S256.");
  }
  if (!diagnostics.redirectUriMatchesRegisteredUrl) {
    throw new Error(
      "Invalid Deriv OAuth URL. redirect_uri must exactly match https://www.arktradershub.com/deriv-callback.",
    );
  }
  if (diagnostics.hasDoubleEncodedRedirectUri) {
    throw new Error("Invalid Deriv OAuth URL. redirect_uri appears to be double-encoded.");
  }
  console.info("[Deriv OAuth] Legacy URL blocked", false);
}

export function redirectToDerivOAuth(url: string) {
  assertValidDerivOAuthRedirectUrl(url);
  if (sessionStorage.getItem("deriv_oauth_redirecting") === "true") {
    console.info("[Deriv OAuth] Authorization redirect already in progress; duplicate ignored.");
    return;
  }
  const diagnostics = getDerivOAuthDiagnostics(url);
  logOAuthDebug("[Deriv OAuth Debug] Exact final URL before redirect", url);
  logOAuthDebug("[Deriv OAuth Debug] Final URL diagnostics before redirect", diagnostics);
  console.info("[Deriv OAuth] Redirecting to authorization endpoint", {
    endpoint: diagnostics.endpoint,
    client_id: diagnostics.clientId,
    legacy_app_id: diagnostics.appId ?? "(not configured)",
    redirect_uri: diagnostics.decodedRedirectUri,
    scope: diagnostics.scopes,
    finalOAuthUrl: url,
    forbiddenMarkers: diagnostics.forbiddenMarkers,
  });
  sessionStorage.setItem("deriv_oauth_last_authorization_url", url);
  sessionStorage.setItem("deriv_oauth_started_at", new Date().toISOString());
  sessionStorage.setItem("deriv_oauth_redirecting", "true");
  window.location.href = url;
}

export async function buildOAuthUrl(
  options: {
    debug?: boolean;
    mode?: "signin" | "signup";
    returnTo?: string;
  } = {},
) {
  if (!isBrowser) return "";
  const debugOAuth = options.debug === true || new URLSearchParams(window.location.search).get("debug_oauth") === "1";
  if (debugOAuth) sessionStorage.setItem("deriv_oauth_debug", "1");
  else sessionStorage.removeItem("deriv_oauth_debug");
  if (!DERIV_CLIENT_ID) throw new Error("Missing required OAuth parameter: client_id");
  if (!DERIV_REDIRECT_URI) throw new Error("Missing required OAuth parameter: redirect_uri");
  if (DERIV_REDIRECT_URI !== "https://www.arktradershub.com/deriv-callback") {
    throw new Error(
      "Deriv redirect_uri must be exactly https://www.arktradershub.com/deriv-callback",
    );
  }

  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = base64UrlEncode(verifierBytes);
  const codeChallenge = base64UrlEncode(await sha256(codeVerifier));
  const state = crypto.randomUUID();
  const attemptId = crypto.randomUUID();

  sessionStorage.removeItem("deriv_callback_processing");
  sessionStorage.removeItem("deriv_oauth_processing");
  sessionStorage.removeItem("deriv_oauth_redirecting");
  sessionStorage.removeItem("deriv_callback_failed");
  sessionStorage.setItem("deriv_code_verifier", codeVerifier);
  sessionStorage.setItem("deriv_oauth_state", state);
  sessionStorage.setItem("deriv_oauth_attempt_id", attemptId);
  sessionStorage.setItem(
    "deriv_oauth_return_to",
    options.returnTo ??
      (options.mode === "signup" ? "/dashboard" : window.location.pathname || "/dashboard"),
  );

  const params = new URLSearchParams({
    response_type: "code",
    client_id: DERIV_CLIENT_ID,
    redirect_uri: DERIV_REDIRECT_URI,
    scope: DERIV_SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  if (DERIV_LEGACY_APP_ID) {
    if (!isNumericLegacyAppId(DERIV_LEGACY_APP_ID)) {
      throw new Error("Invalid VITE_DERIV_LEGACY_APP_ID. It must be a numeric legacy V1 app ID.");
    }
    if (DERIV_LEGACY_APP_ID === DERIV_CLIENT_ID) {
      throw new Error("Invalid VITE_DERIV_LEGACY_APP_ID. It must not equal VITE_DERIV_CLIENT_ID.");
    }
    params.set("app_id", DERIV_LEGACY_APP_ID);
  }
  // The provider handles the login and consent screens. `prompt` is only
  // documented for signup, where it must be `registration`.
  const prompt = options.mode === "signup" ? "registration" : undefined;
  if (prompt) params.set("prompt", prompt);

  const requiredParams = [
    "response_type",
    "client_id",
    "redirect_uri",
    "scope",
    "state",
    "code_challenge",
    "code_challenge_method",
  ];
  const missingParam = requiredParams.find((param) => !params.get(param));
  if (missingParam) {
    throw new Error(`Missing required OAuth parameter: ${missingParam}`);
  }
  const url = `${DERIV_OAUTH_ENDPOINT}?${params.toString()}`;
  assertValidDerivOAuthRedirectUrl(url);
  const parsed = new URL(url);
  if (parsed.origin !== "https://auth.deriv.com" || parsed.pathname !== "/oauth2/auth") {
    throw new Error("Invalid Deriv OAuth endpoint. Refusing to redirect to a non-OAuth URL.");
  }
  if (parsed.searchParams.has("redirect") || parsed.searchParams.has("brand")) {
    throw new Error("Invalid Deriv OAuth URL. Authorization URL must not include redirect or brand.");
  }
  if (!parsed.searchParams.get("client_id")) {
    throw new Error("Invalid Deriv OAuth URL. Authorization URL must include client_id.");
  }
  const diagnostics = getDerivOAuthDiagnostics(url);
  if (diagnostics.hasAppId && (!diagnostics.appIdIsLegacyNumeric || diagnostics.appIdLooksLikeClientId)) {
    throw new Error("Invalid Deriv OAuth URL. app_id must be the numeric legacy V1 app ID.");
  }
  logOAuthDebug("[Deriv OAuth Debug] Exact final authorization URL", url);
  logOAuthDebug("[Deriv OAuth Debug] Authorization diagnostics", {
    attemptId,
    finalOAuthUrl: url,
    endpoint: DERIV_OAUTH_ENDPOINT,
    client_id: DERIV_CLIENT_ID,
    legacy_app_id: DERIV_LEGACY_APP_ID || "(not configured)",
    clientIdExists: Boolean(DERIV_CLIENT_ID),
    legacyAppIdExists: Boolean(DERIV_LEGACY_APP_ID),
    redirect_uri: DERIV_REDIRECT_URI,
    scopes: DERIV_SCOPE,
    prompt: prompt ?? "standard-login",
    forbiddenMarkers: diagnostics.forbiddenMarkers,
    stateExists: Boolean(state),
    codeChallengeExists: Boolean(codeChallenge),
    codeVerifierStored: sessionStorage.getItem("deriv_code_verifier") === codeVerifier,
    stateStored: sessionStorage.getItem("deriv_oauth_state") === state,
  });
  console.info("[Deriv OAuth] Authorization URL prepared", {
    attemptId,
    endpoint: diagnostics.endpoint,
    client_id: diagnostics.clientId,
    legacy_app_id: diagnostics.appId ?? "(not configured)",
    redirect_uri: diagnostics.decodedRedirectUri,
    scope: diagnostics.scopes,
    prompt: prompt ?? "standard-login",
    finalOAuthUrl: url,
    forbiddenMarkers: diagnostics.forbiddenMarkers,
  });
  return url;
}

export async function getAuthenticatedWsUrl(
  accessToken: string,
  accountId: string,
  tokenSource: DerivTokenSource = tokenSourceFor(accessToken),
): Promise<string> {
  const appIdMode: DerivAppIdMode =
    tokenSource === "oauth_access_token" ? "oauth" : "legacy";
  if (appIdMode === "legacy") {
    console.info("[Deriv WS] legacy token detected; using direct WebSocket authorization", {
      accountId,
      wsUrl: legacyTradingWsUrl(),
    });
    return legacyTradingWsUrl();
  }

  const { data: authData, error: authError } = await supabase.auth.getSession();
  const supabaseAccessToken = authData.session?.access_token ?? "";
  if (authError || !supabaseAccessToken) {
    if (tokenSource === "oauth_access_token" && accessToken) {
      console.warn("[Deriv WS] Supabase JWT unavailable; using OAuth token-only OTP fallback", {
        accountId,
        authError: authError?.message ?? null,
        hasDerivAccessToken: Boolean(accessToken),
      });
    } else {
      throw createDerivSocketError(
        DERIV_RECONNECT_MESSAGE,
        DERIV_SESSION_EXPIRED_CODE,
        401,
        false,
      );
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (supabaseAccessToken) {
    headers.Authorization = `Bearer ${supabaseAccessToken}`;
  }

  if (!supabaseAccessToken && tokenSource !== "oauth_access_token") {
    throw createDerivSocketError(
      DERIV_RECONNECT_MESSAGE,
      DERIV_SESSION_EXPIRED_CODE,
      401,
      false,
    );
  }

  const response = await fetch("/api/deriv-account-otp", {
    method: "POST",
    headers,
    body: JSON.stringify({ accessToken, accountId, appIdMode, tokenSource }),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const responseWasJson = contentType.toLowerCase().includes("application/json");
  const otpData = responseWasJson ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    const code = textFrom(otpData?.error, response.status === 401 ? DERIV_SESSION_EXPIRED_CODE : "DERIV_OTP_FAILED");
    const message = textFrom(
      otpData?.message,
      otpData?.error === DERIV_SESSION_EXPIRED_CODE ? DERIV_RECONNECT_MESSAGE : "",
      otpData?.error,
      responseWasJson ? "" : "Deriv OTP route returned a non-JSON response",
      "Failed to get authenticated Deriv WebSocket URL",
    );
    console.warn("[Deriv WS] OTP request failed", {
      accountId,
      status: response.status,
      responseWasJson,
      code,
      message,
    });
    throw createDerivSocketError(
      code === DERIV_SESSION_EXPIRED_CODE ? DERIV_RECONNECT_MESSAGE : message,
      code,
      response.status,
      response.status >= 500 || response.status === 429,
    );
  }
  const url = otpData?.url;
  if (!url) {
    throw createDerivSocketError(
      "Deriv OTP response did not include a WebSocket URL",
      "DERIV_OTP_URL_MISSING",
      502,
      false,
    );
  }
  return url;
}

function connectPublic(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(PUBLIC_WS_URL);
      ws.onopen = () => resolve(ws);
      ws.onerror = () => reject(new Error("Could not connect to Deriv public WebSocket"));
    } catch (e) {
      reject(e);
    }
  });
}

async function publicSend(payload: DerivRecord): Promise<DerivMessage> {
  const ws = await connectPublic();
  const id = reqId++;
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(new Error("Deriv public request timed out"));
    }, 15000);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.req_id === id) {
          clearTimeout(timeoutId);
          try {
            ws.close();
          } catch {
            /* ignore */
          }
          if (msg.error) reject(derivMessageError(msg.error));
          else resolve(msg);
        }
      } catch {
        /* ignore */
      }
    };
    ws.onerror = () => {
      clearTimeout(timeoutId);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(new Error("Deriv public request failed"));
    };
    ws.send(JSON.stringify({ ...payload, req_id: id }));
  });
}

export const SYNTHETIC_MARKETS = [
  { symbol: "R_10", name: "Volatility 10 Index" },
  { symbol: "R_25", name: "Volatility 25 Index" },
  { symbol: "R_50", name: "Volatility 50 Index" },
  { symbol: "R_75", name: "Volatility 75 Index" },
  { symbol: "R_100", name: "Volatility 100 Index" },
  { symbol: "1HZ10V", name: "Volatility 10 (1s) Index" },
  { symbol: "1HZ25V", name: "Volatility 25 (1s) Index" },
  { symbol: "1HZ50V", name: "Volatility 50 (1s) Index" },
  { symbol: "1HZ75V", name: "Volatility 75 (1s) Index" },
  { symbol: "1HZ100V", name: "Volatility 100 (1s) Index" },
  { symbol: "BOOM500", name: "Boom 500 Index" },
  { symbol: "BOOM1000", name: "Boom 1000 Index" },
  { symbol: "CRASH500", name: "Crash 500 Index" },
  { symbol: "CRASH1000", name: "Crash 1000 Index" },
  { symbol: "stpRNG", name: "Step Index" },
  { symbol: "RDBEAR", name: "Bear Market Index" },
  { symbol: "RDBULL", name: "Bull Market Index" },
];

export type TradeCategory =
  | "rise_fall"
  | "higher_lower"
  | "touch_no_touch"
  | "even_odd"
  | "over_under"
  | "matches_differs"
  | "accumulator"
  | "multiplier";

export const TRADE_CATEGORIES: { value: TradeCategory; label: string; description: string }[] = [
  {
    value: "rise_fall",
    label: "Rise / Fall",
    description: "Predict if the market goes up or down.",
  },
  { value: "higher_lower", label: "Higher / Lower", description: "Predict vs. a barrier price." },
  {
    value: "touch_no_touch",
    label: "Touch / No Touch",
    description: "Will the price touch a barrier?",
  },
  {
    value: "even_odd",
    label: "Even / Odd",
    description: "Last digit of the exit spot is even or odd.",
  },
  {
    value: "over_under",
    label: "Over / Under",
    description: "Last digit over/under a chosen number.",
  },
  {
    value: "matches_differs",
    label: "Matches / Differs",
    description: "Last digit matches your prediction.",
  },
  {
    value: "accumulator",
    label: "Accumulators",
    description: "Compound profit while price stays in range.",
  },
  {
    value: "multiplier",
    label: "Multipliers",
    description: "Amplify profit and loss with a multiplier.",
  },
];

export function contractTypeFor(category: TradeCategory, side: string): string {
  const map: Record<string, string> = {
    "rise_fall:up": "CALL",
    "rise_fall:down": "PUT",
    "higher_lower:higher": "CALL",
    "higher_lower:lower": "PUT",
    "touch_no_touch:touch": "ONETOUCH",
    "touch_no_touch:no_touch": "NOTOUCH",
    "even_odd:even": "DIGITEVEN",
    "even_odd:odd": "DIGITODD",
    "over_under:over": "DIGITOVER",
    "over_under:under": "DIGITUNDER",
    "matches_differs:matches": "DIGITMATCH",
    "matches_differs:differs": "DIGITDIFF",
    "accumulator:buy": "ACCU",
    "multiplier:up": "MULTUP",
    "multiplier:down": "MULTDOWN",
  };
  return map[`${category}:${side}`] ?? "CALL";
}

export const SIDES_BY_CATEGORY: Record<TradeCategory, { value: string; label: string }[]> = {
  rise_fall: [
    { value: "up", label: "Rise" },
    { value: "down", label: "Fall" },
  ],
  higher_lower: [
    { value: "higher", label: "Higher" },
    { value: "lower", label: "Lower" },
  ],
  touch_no_touch: [
    { value: "touch", label: "Touch" },
    { value: "no_touch", label: "No Touch" },
  ],
  even_odd: [
    { value: "even", label: "Even" },
    { value: "odd", label: "Odd" },
  ],
  over_under: [
    { value: "over", label: "Over" },
    { value: "under", label: "Under" },
  ],
  matches_differs: [
    { value: "matches", label: "Matches" },
    { value: "differs", label: "Differs" },
  ],
  accumulator: [{ value: "buy", label: "Buy Accumulator" }],
  multiplier: [
    { value: "up", label: "Multiplier Up" },
    { value: "down", label: "Multiplier Down" },
  ],
};
