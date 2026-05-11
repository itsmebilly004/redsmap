// src/lib/deriv.ts
import { supabase } from "@/integrations/supabase/client";
import {
  accountLoginId,
  getDerivAccountPrefix,
  getDerivAccountType,
  normalizeDerivAccount,
  type DerivAccountLike,
} from "@/lib/deriv-account";
import {
  DERIV_OAUTH_AUTHORIZE_ENDPOINT,
  DERIV_OAUTH_CLIENT_ID,
  DERIV_OAUTH_SCOPE,
  DERIV_REDIRECT_URI,
} from "@/lib/deriv-config";

const DERIV_APP_ID = DERIV_OAUTH_CLIENT_ID;
const DERIV_CLIENT_ID = DERIV_OAUTH_CLIENT_ID;
const DERIV_OAUTH_ENDPOINT = DERIV_OAUTH_AUTHORIZE_ENDPOINT;
const DERIV_SCOPE = DERIV_OAUTH_SCOPE;
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
const DERIV_OAUTH_ONLY_RECONNECT_MESSAGE =
  "Reconnect this Deriv account through OAuth2. ArkTrader uses client_id 33dF8d2wwjIpeFDBvNkln for all account types.";
const DERIV_SESSION_EXPIRED_CODE = "DERIV_SESSION_EXPIRED";
const DERIV_OTP_AUTH_FAILED_CODE = "DERIV_OTP_AUTH_FAILED";
const DERIV_RECONNECT_MESSAGE = "Please reconnect your Deriv account.";
export const DERIV_TRADING_AUTHORIZATION_NOT_READY_MESSAGE =
  "Account connected. Trading authorization not ready yet.";
const TOKEN_EXPIRY_CLOCK_SKEW_MS = 60_000;
const TRADING_AUTHORIZATION_FRESH_MS = 10 * 60 * 1000;

export const DERIV_APP_ID_VALUE = DERIV_APP_ID;
export const DERIV_CLIENT_ID_VALUE = DERIV_CLIENT_ID;
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
export type TradingWebSocketMode = "oauth-otp";
export type DerivTokenSource = "oauth_access_token" | "legacy_authorize_token";
export type TradingAuthorizationState = {
  account_id: string;
  trading_authorized: boolean;
  trading_adapter: TradingAdapter;
  token_source: DerivTokenSource;
  trading_authorized_at: string | null;
  last_trading_error: string | null;
};
type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};
type DerivSocketError = Error & {
  code?: string;
  status?: number;
  retryable?: boolean;
};
type TradingReadinessSchemaError = Error & {
  code: "DERIV_TRADING_READINESS_SCHEMA_MISSING";
  cause?: unknown;
};
export type DerivTradingSession = {
  account_id: string;
  sessionId: string | null;
  accountId: string;
  loginid: string;
  deriv_token: string;
  token: string;
  token_source: DerivTokenSource;
  tokenSource: DerivTokenSource;
  adapter: TradingAdapter;
  websocketMode: TradingWebSocketMode;
  expires_at: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  sessionAccountId: string;
  sessionLoginid: string | null;
  normalizedType: "real" | "demo" | "unknown";
  trading_authorized: boolean;
  trading_adapter: TradingAdapter;
  trading_authorized_at: string | null;
  last_trading_error: string | null;
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
let authenticatedAccount: {
  accessToken: string;
  accountId: string;
  isDemo?: boolean | null;
  tokenSource: DerivTokenSource;
} | null = null;

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
  tokenSource: DerivTokenSource,
) {
  const accountIdentity = { account_id: accountId, loginid: accountId };
  const normalizedType = getDerivAccountType(accountIdentity);
  const detectedPrefix = getDerivAccountPrefix(accountIdentity);
  const normalizedIsDemo =
    normalizedType === "demo" ? true : normalizedType === "real" ? false : (isDemo ?? null);
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
    websocketMode: tradingWebSocketMode(tokenSource),
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

export function isDerivTradingAuthorizationFailure(error: unknown) {
  const socketError = error as DerivSocketError;
  const text = `${socketError?.message ?? ""} ${socketError?.code ?? ""}`.toLowerCase();
  return (
    socketError?.code === DERIV_OTP_AUTH_FAILED_CODE ||
    socketError?.code === "DERIV_OAUTH_TRADING_AUTH_FAILED" ||
    text.includes("trading authorization failed") ||
    text.includes("trading authorization not ready")
  );
}

export async function getActiveDerivTradingSession(
  selectedAccount?: DerivAccountLike | null,
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

  const normalizedRequested = selectedAccount
    ? normalizeDerivAccount(selectedAccount, { trustVirtualFlags: false })
    : null;
  const requestedAccountId = selectedAccount
    ? (normalizedRequested?.account_id ?? accountLoginId(selectedAccount))
    : "";
  const selectedAccountToken = selectedAccount ? textFrom(selectedAccount.deriv_token) : "";
  const selectedAccountExplicitTokenSource =
    selectedAccountToken && selectedAccount ? explicitTokenSourceForAccount(selectedAccount) : null;

  const { data: authData, error: authError } = await supabase.auth.getSession();
  const userId = authData.session?.user?.id ?? null;
  if (authError || !userId) {
    const normalizedType = normalizedRequested?.normalizedType ?? "unknown";
    if (
      requestedAccountId &&
      normalizedRequested &&
      selectedAccountToken &&
      selectedAccountExplicitTokenSource === "oauth_access_token" &&
      (normalizedType === "real" || normalizedType === "demo")
    ) {
      const expiry = effectiveTokenExpiryState(
        textFrom(selectedAccount?.expires_at) || null,
        textFrom(selectedAccount?.created_at) || null,
        selectedAccountExplicitTokenSource,
      );
      const adapter = adapterForTokenSource(selectedAccountExplicitTokenSource);
      const websocketMode = tradingWebSocketMode(selectedAccountExplicitTokenSource);
      console.warn(
        "[Deriv Trading] Supabase session unavailable; using selected OAuth account token",
        {
          context: options.context ?? "trade",
          selectedAccountId: requestedAccountId,
          authError: authError?.message ?? null,
          tokenExists: true,
          tokenExpiry: expiry.expiresAt,
          storedTokenExpiry: expiry.storedExpiresAt,
          platformTokenExpiry: expiry.platformExpiresAt,
          shortProviderTokenExpiry: expiry.shortProviderExpiresAt,
          expiryPolicy: expiry.expiryPolicy,
          tokenExpired: expiry.expired,
          tokenSource: selectedAccountExplicitTokenSource,
          adapter,
          websocketMode,
        },
      );
      if (!expiry.expired) {
        return {
          account_id: requestedAccountId,
          sessionId: null,
          accountId: requestedAccountId,
          loginid: normalizedRequested.loginid,
          deriv_token: selectedAccountToken,
          token: selectedAccountToken,
          token_source: selectedAccountExplicitTokenSource,
          tokenSource: selectedAccountExplicitTokenSource,
          adapter,
          websocketMode,
          expires_at: expiry.expiresAt,
          expiresAt: expiry.expiresAt,
          createdAt: textFrom(selectedAccount?.created_at) || null,
          sessionAccountId: requestedAccountId,
          sessionLoginid: normalizedRequested.loginid ?? null,
          normalizedType,
          trading_authorized: false,
          trading_adapter: adapter,
          trading_authorized_at: null,
          last_trading_error: null,
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

  const savedSelection = readSavedSelectedAccount(userId);
  const selectedAccountId = textFrom(savedSelection.accountId, requestedAccountId);
  if (!selectedAccountId) {
    console.warn("[Deriv Trading] no selected Deriv account", {
      context: options.context ?? "trade",
      userId,
      requestedAccountId: requestedAccountId || null,
      savedSelectedAccountId: savedSelection.accountId,
    });
    throw createDerivSocketError(
      "Connect and select your Deriv account first.",
      "DERIV_NO_ACTIVE_SESSION",
      401,
      false,
    );
  }

  if (requestedAccountId && !sameDerivId(requestedAccountId, selectedAccountId)) {
    console.warn("[Deriv Trading] page account differed from persisted Dashboard selection", {
      context: options.context ?? "trade",
      requestedAccountId,
      persistedSelectedAccountId: selectedAccountId,
      reason: "Trading will resolve the persisted selected account to prevent account mismatch.",
    });
  }

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("sessions")
    .select("*")
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
  const selectedAccountMatchesRequest =
    !requestedAccountId || sameDerivId(requestedAccountId, selectedAccountId);
  const selectedAccountForToken = selectedAccountMatchesRequest ? selectedAccount : null;
  const normalizedSelected =
    (selectedSession
      ? normalizeDerivAccount(selectedSession, { trustVirtualFlags: false })
      : null) ??
    (selectedAccountMatchesRequest && normalizedRequested ? normalizedRequested : null);
  if (!normalizedSelected) {
    throw createDerivSocketError(
      "Selected Deriv account could not be verified.",
      "DERIV_ACCOUNT_INVALID",
      undefined,
      false,
    );
  }
  const normalizedType =
    savedSelection.accountType && sameDerivId(savedSelection.accountId, selectedAccountId)
      ? savedSelection.accountType
      : normalizedSelected.normalizedType;
  if (normalizedType !== "real" && normalizedType !== "demo") {
    throw createDerivSocketError(
      "Selected Deriv account type could not be verified.",
      "DERIV_ACCOUNT_TYPE_INVALID",
      undefined,
      false,
    );
  }

  const storedToken = textFrom(selectedSession?.deriv_token);
  const selectedAccountPersistedTokenSource = readStoredTokenSource(userId, selectedAccountId);
  const sessionTokenSource = tokenSourceFromText(selectedSession?.token_source);
  const savedSelectedTokenSource = sameDerivId(savedSelection.accountId, selectedAccountId)
    ? savedSelection.tokenSource
    : null;
  const requestedToken = selectedAccountForToken
    ? textFrom(selectedAccountForToken.deriv_token)
    : "";
  const requestedExplicitTokenSource =
    requestedToken && selectedAccountForToken
      ? explicitTokenSourceForAccount(selectedAccountForToken)
      : null;
  const selectedAccountResolvedTokenSource =
    requestedExplicitTokenSource ??
    sessionTokenSource ??
    selectedAccountPersistedTokenSource ??
    savedSelectedTokenSource;
  const selectedAccountExpiresAt = selectedAccountForToken
    ? textFrom(selectedAccountForToken.expires_at)
    : "";
  const selectedAccountCreatedAt = selectedAccountForToken
    ? textFrom(selectedAccountForToken.created_at)
    : "";
  const selectedAccountTokenFreshness = tokenFreshnessScore(
    selectedAccountExpiresAt,
    selectedAccountCreatedAt,
  );
  const storedTokenFreshness = tokenFreshnessScore(
    selectedSession?.expires_at,
    selectedSession?.created_at,
  );
  const useSelectedAccountOAuthFallback =
    !storedToken && requestedToken && selectedAccountResolvedTokenSource === "oauth_access_token";
  const useSelectedAccountOAuthToken =
    Boolean(requestedToken) &&
    selectedAccountResolvedTokenSource === "oauth_access_token" &&
    (!storedToken ||
      requestedToken === storedToken ||
      selectedAccountTokenFreshness >= storedTokenFreshness);
  const resolvedToken = useSelectedAccountOAuthToken
    ? requestedToken
    : storedToken || (useSelectedAccountOAuthFallback ? requestedToken : "");
  const storedTokenSource = storedToken ? selectedAccountPersistedTokenSource : null;
  const tokenSource = resolvedToken ? selectedAccountResolvedTokenSource : null;
  const resolvedExpiresAt = useSelectedAccountOAuthToken
    ? selectedAccountExpiresAt || selectedSession?.expires_at || null
    : (selectedSession?.expires_at ?? selectedAccountExpiresAt ?? null);
  const resolvedCreatedAt = useSelectedAccountOAuthToken
    ? selectedAccountCreatedAt || selectedSession?.created_at || null
    : (selectedSession?.created_at ?? selectedAccountCreatedAt ?? null);
  const expiry = effectiveTokenExpiryState(resolvedExpiresAt, resolvedCreatedAt, tokenSource);
  const adapter = tokenSource ? adapterForTokenSource(tokenSource) : null;
  const websocketMode = tokenSource ? tradingWebSocketMode(tokenSource) : null;
  const storedAuthorization = readStoredTradingAuthorizationState(userId, selectedAccountId);
  const sessionAuthorization = authorizationStateFromSessionRow(
    selectedSession,
    selectedAccountId,
    tokenSource,
  );
  const preparedAuthorization = storedAuthorization ?? sessionAuthorization;

  console.info("[Deriv Trading] pre-trade session validation", {
    context: options.context ?? "trade",
    savedSelection,
    requestedAccountId: requestedAccountId || null,
    selectedAccount: {
      account_id: selectedAccountId,
      loginid: normalizedSelected.loginid,
      normalizedType,
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
      selectedAccountTokenExists: Boolean(requestedToken),
      selectedAccountOAuthFallback: Boolean(useSelectedAccountOAuthFallback),
      selectedAccountOAuthTokenPreferred: Boolean(useSelectedAccountOAuthToken),
      resolvedTokenSource: useSelectedAccountOAuthToken
        ? "selected-account-context"
        : "supabase-session",
      selectedAccountTokenFreshness,
      storedTokenFreshness,
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
      selectedAccountExplicitTokenSource: requestedExplicitTokenSource,
      selectedAccountPersistedTokenSource,
      sessionTokenSource,
      savedSelectedTokenSource,
      tokenSource,
      adapter,
      websocketMode,
      createdAt: resolvedCreatedAt,
      preparedTradingAuthorization: preparedAuthorization,
      preparedTradingAuthorizationFresh: tradingAuthorizationIsFresh(preparedAuthorization),
    },
    selectedReactTokenMatchesSession: Boolean(
      selectedAccountForToken &&
      textFrom(selectedAccountForToken.deriv_token) &&
      storedToken &&
      textFrom(selectedAccountForToken.deriv_token) === storedToken,
    ),
  });

  if (resolvedToken && !tokenSource) {
    throw createDerivSocketError(
      "Could not determine the Deriv trading adapter for this account. Please reconnect this account once.",
      "DERIV_TOKEN_SOURCE_MISSING",
      undefined,
      false,
    );
  }

  if (
    (!selectedSession && !useSelectedAccountOAuthFallback) ||
    !resolvedToken ||
    !tokenSource ||
    expiry.expired
  ) {
    throw createDerivSocketError(
      "Your Deriv session expired. Please reconnect your Deriv account.",
      DERIV_SESSION_EXPIRED_CODE,
      401,
      false,
    );
  }

  const session: DerivTradingSession = {
    account_id: selectedAccountId,
    sessionId: selectedSession?.id ?? null,
    accountId: selectedAccountId,
    loginid: normalizedSelected.loginid,
    deriv_token: resolvedToken,
    token: resolvedToken,
    token_source: tokenSource,
    tokenSource,
    adapter: adapterForTokenSource(tokenSource),
    websocketMode: tradingWebSocketMode(tokenSource),
    expires_at: resolvedExpiresAt,
    expiresAt: resolvedExpiresAt,
    createdAt: resolvedCreatedAt,
    sessionAccountId: selectedSession?.account_id ?? selectedAccountId,
    sessionLoginid: selectedSession?.loginid ?? normalizedSelected.loginid ?? null,
    normalizedType,
    trading_authorized: Boolean(preparedAuthorization?.trading_authorized),
    trading_adapter: preparedAuthorization?.trading_adapter ?? adapterForTokenSource(tokenSource),
    trading_authorized_at: preparedAuthorization?.trading_authorized_at ?? null,
    last_trading_error: preparedAuthorization?.last_trading_error ?? null,
  };
  persistSelectedTradingSession(userId, session);
  return session;
}

export async function prepareDerivTradingSession(
  selectedAccount: DerivAccountLike,
  options: { context?: string } = {},
): Promise<DerivTradingSession> {
  const session = await getActiveDerivTradingSession(selectedAccount, options);
  setAuthenticatedAccount(
    session.deriv_token,
    session.account_id,
    session.normalizedType === "demo",
    session.token_source,
  );
  return session;
}

export async function ensureDerivTradingConnection(
  selectedAccount: DerivAccountLike,
  options: { context?: string } = {},
): Promise<DerivTradingSession> {
  const session = await prepareDerivTradingSession(selectedAccount, options);
  await prepareTradingAuthorization(session, {
    context: options.context ?? "trade",
  });
  await connect();
  console.info("[Deriv Trading] active trading connection ready", {
    context: options.context ?? "trade",
    activeTradingAccount: {
      account_id: session.account_id,
      loginid: session.loginid,
      normalizedType: session.normalizedType,
      token_source: session.token_source,
      adapter: session.adapter,
      websocketMode: session.websocketMode,
      expires_at: session.expires_at,
    },
    websocketMode: session.websocketMode,
    connectionStatus: getStatus(),
    websocketAccountId: getTradingSocketAccountId(),
  });
  return session;
}

export async function prepareTradingAuthorization(
  session: DerivTradingSession,
  options: { context?: string; force?: boolean } = {},
): Promise<TradingAuthorizationState> {
  if (!isBrowser) {
    throw createDerivSocketError(
      "Deriv trading authorization is only available in the browser.",
      "DERIV_BROWSER_REQUIRED",
      undefined,
      false,
    );
  }

  const { data: authData } = await supabase.auth.getSession();
  const userId = authData.session?.user?.id ?? null;
  const cached = readStoredTradingAuthorizationState(userId, session.account_id);
  if (
    !options.force &&
    cached &&
    tradingAuthorizationIsFresh(cached) &&
    cached.token_source === session.token_source &&
    cached.trading_adapter === session.adapter
  ) {
    console.info("[Deriv Trading] trading authorization reused", {
      context: options.context ?? "trade",
      selectedAccountId: session.account_id,
      token_source: session.token_source,
      adapter: session.adapter,
      websocketMode: session.websocketMode,
      trading_authorized_at: cached.trading_authorized_at,
      freshnessMs: cached.trading_authorized_at
        ? Date.now() - new Date(cached.trading_authorized_at).getTime()
        : null,
    });
    return cached;
  }

  console.info("[Deriv Trading] trading authorization started", {
    context: options.context ?? "trade",
    selectedAccountId: session.account_id,
    loginid: session.loginid,
    normalizedType: session.normalizedType,
    token_source: session.token_source,
    adapter: session.adapter,
    websocketMode: session.websocketMode,
    cachedFound: Boolean(cached),
    cachedFresh: tradingAuthorizationIsFresh(cached),
    force: Boolean(options.force),
  });

  try {
    if (session.token_source !== "oauth_access_token") {
      throw createDerivSocketError(
        DERIV_OAUTH_ONLY_RECONNECT_MESSAGE,
        "DERIV_OAUTH_RECONNECT_REQUIRED",
        401,
        false,
      );
    }
    const authenticatedWsUrl = await getAuthenticatedWsUrl(
      session.deriv_token,
      session.account_id,
      session.token_source,
    );
    await verifyOAuthOtpTradingSocket(authenticatedWsUrl, session);

    const state: TradingAuthorizationState = {
      account_id: session.account_id,
      trading_authorized: true,
      trading_adapter: session.adapter,
      token_source: session.token_source,
      trading_authorized_at: new Date().toISOString(),
      last_trading_error: null,
    };
    await persistTradingAuthorizationState(userId, state);
    console.info("[Deriv Trading] trading authorization passed", {
      context: options.context ?? "trade",
      selectedAccountId: session.account_id,
      token_source: session.token_source,
      adapter: session.adapter,
      websocketMode: session.websocketMode,
      trading_authorized_at: state.trading_authorized_at,
    });
    return state;
  } catch (error) {
    if (isTradingReadinessSchemaError(error)) throw error;
    const message = getDerivTradingErrorMessage(error);
    const state: TradingAuthorizationState = {
      account_id: session.account_id,
      trading_authorized: false,
      trading_adapter: session.adapter,
      token_source: session.token_source,
      trading_authorized_at: null,
      last_trading_error: message,
    };
    await persistTradingAuthorizationState(userId, state);
    console.warn("[Deriv Trading] trading authorization failed", {
      context: options.context ?? "trade",
      selectedAccountId: session.account_id,
      token_source: session.token_source,
      adapter: session.adapter,
      websocketMode: session.websocketMode,
      last_trading_error: message,
      error,
    });
    throw error;
  }
}

function verifyOAuthOtpTradingSocket(
  authenticatedWsUrl: string,
  session: DerivTradingSession,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket | null = null;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      reject(
        createDerivSocketError(
          "OAuth trading WebSocket verification timed out.",
          "DERIV_OAUTH_TRADING_AUTH_FAILED",
          408,
          false,
        ),
      );
    }, 15000);

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws?.close(1000, "OAuth trading authorization verified");
      } catch {
        /* ignore */
      }
      if (error) reject(error);
      else resolve();
    };

    try {
      ws = new WebSocket(authenticatedWsUrl);
      ws.onopen = () => {
        console.info("[Deriv Trading] OAuth OTP trading socket verification opened", {
          selectedAccountId: session.account_id,
          token_source: session.token_source,
          adapter: session.adapter,
          websocketMode: session.websocketMode,
          authorizationResult: "oauth-otp-socket-open",
        });
        finish();
      };
      ws.onerror = () => {
        finish(
          createDerivSocketError(
            "OAuth trading WebSocket verification failed.",
            "DERIV_OAUTH_TRADING_AUTH_FAILED",
            401,
            false,
          ),
        );
      };
      ws.onclose = (event) => {
        if (settled) return;
        finish(
          createDerivSocketError(
            event.reason
              ? `OAuth trading WebSocket closed: ${event.reason}`
              : `OAuth trading WebSocket closed with code ${event.code}`,
            "DERIV_OAUTH_TRADING_AUTH_FAILED",
            401,
            false,
          ),
        );
      };
    } catch (error) {
      finish(
        error instanceof Error ? error : new Error("OAuth trading WebSocket verification failed."),
      );
    }
  });
}

function authenticatedAccountTypeLabel(account: NonNullable<typeof authenticatedAccount>) {
  if (account.isDemo === true) return "demo";
  if (account.isDemo === false) return "real";
  return "unknown";
}

function tokenSourceFromText(value: unknown): DerivTokenSource | null {
  const text = textFrom(value);
  if (text === "oauth_access_token" || text === "legacy_authorize_token") return text;
  return null;
}

function createDerivSocketError(message: string, code: string, status?: number, retryable = true) {
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

function activeAccountStorageKey(userId: string) {
  return `deriv_active_account:${userId}`;
}

function selectedAccountIdStorageKey(userId: string) {
  return `selected_deriv_account_id:${userId}`;
}

function selectedAccountTypeStorageKey(userId: string) {
  return `selected_deriv_account_type:${userId}`;
}

function selectedTokenSourceStorageKey(userId: string) {
  return `selected_deriv_token_source:${userId}`;
}

function selectedAdapterStorageKey(userId: string) {
  return `selected_deriv_adapter:${userId}`;
}

function tradingAdapterStorageKey(userId: string, accountId: string) {
  return `deriv_trading_adapter:${userId}:${accountId.toUpperCase()}`;
}

function tradingAuthorizationStorageKey(userId: string, accountId: string) {
  return `deriv_trading_authorization:${userId}:${accountId.toUpperCase()}`;
}

function tokenSourceIsValid(value: unknown): value is DerivTokenSource {
  return value === "oauth_access_token" || value === "legacy_authorize_token";
}

function adapterIsValid(value: unknown): value is TradingAdapter {
  return value === "newOAuthTradingAdapter" || value === "legacyTradingAdapter";
}

function accountTypeIsValid(value: unknown): value is DerivTradingSession["normalizedType"] {
  return value === "real" || value === "demo" || value === "unknown";
}

function tradingAuthorizationStateIsValid(value: unknown): value is TradingAuthorizationState {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<TradingAuthorizationState>;
  return (
    typeof record.account_id === "string" &&
    typeof record.trading_authorized === "boolean" &&
    adapterIsValid(record.trading_adapter) &&
    tokenSourceIsValid(record.token_source) &&
    (record.trading_authorized_at === null || typeof record.trading_authorized_at === "string") &&
    (record.last_trading_error === null || typeof record.last_trading_error === "string")
  );
}

function isSupabaseMissingColumnError(error: unknown) {
  const supabaseError = error as SupabaseErrorLike;
  const text =
    `${supabaseError?.message ?? ""} ${supabaseError?.details ?? ""} ${supabaseError?.hint ?? ""}`.toLowerCase();
  return (
    supabaseError?.code === "PGRST204" ||
    (text.includes("schema cache") &&
      (text.includes("trading_authorized") ||
        text.includes("trading_adapter") ||
        text.includes("token_source") ||
        text.includes("trading_authorized_at") ||
        text.includes("last_trading_error")))
  );
}

function createTradingReadinessSchemaError(cause?: unknown): TradingReadinessSchemaError {
  const error = new Error(
    "Supabase sessions schema is missing trading readiness columns. Run the migration `supabase/migrations/20260510000100_add_deriv_trading_readiness.sql` and reload the PostgREST schema cache.",
  ) as TradingReadinessSchemaError;
  error.code = "DERIV_TRADING_READINESS_SCHEMA_MISSING";
  error.cause = cause;
  return error;
}

function isTradingReadinessSchemaError(error: unknown): error is TradingReadinessSchemaError {
  return (error as TradingReadinessSchemaError)?.code === "DERIV_TRADING_READINESS_SCHEMA_MISSING";
}

export function tradingAuthorizationIsFresh(state: TradingAuthorizationState | null | undefined) {
  if (!state?.trading_authorized || !state.trading_authorized_at) return false;
  const authorizedAt = new Date(state.trading_authorized_at).getTime();
  if (!Number.isFinite(authorizedAt)) return false;
  return Date.now() - authorizedAt <= TRADING_AUTHORIZATION_FRESH_MS;
}

export function readStoredTradingAuthorizationState(
  userId: string | null | undefined,
  accountId: string | null | undefined,
): TradingAuthorizationState | null {
  if (!isBrowser || !userId || !accountId) return null;
  try {
    const raw = localStorage.getItem(tradingAuthorizationStorageKey(userId, accountId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!tradingAuthorizationStateIsValid(parsed)) return null;
    if (!sameDerivId(parsed.account_id, accountId)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function authorizationStateFromSessionRow(
  row: DerivRecord | null | undefined,
  accountId: string,
  fallbackTokenSource: DerivTokenSource | null,
): TradingAuthorizationState | null {
  if (!row) return null;
  const tokenSource = tokenSourceFromText(row.token_source) ?? fallbackTokenSource;
  const adapter = adapterIsValid(row.trading_adapter)
    ? row.trading_adapter
    : tokenSource
      ? adapterForTokenSource(tokenSource)
      : null;
  if (!tokenSource || !adapter) return null;
  const tradingAuthorized = row.trading_authorized === true || row.trading_authorized === "true";
  const state = {
    account_id: textFrom(row.account_id, row.loginid, accountId),
    trading_authorized: tradingAuthorized,
    trading_adapter: adapter,
    token_source: tokenSource,
    trading_authorized_at: textFrom(row.trading_authorized_at) || null,
    last_trading_error: textFrom(row.last_trading_error) || null,
  } satisfies TradingAuthorizationState;
  return tradingAuthorizationStateIsValid(state) ? state : null;
}

export async function persistTradingAuthorizationState(
  userId: string | null | undefined,
  state: TradingAuthorizationState,
) {
  if (!isBrowser || !userId) return;
  try {
    localStorage.setItem(
      tradingAuthorizationStorageKey(userId, state.account_id),
      JSON.stringify(state),
    );
    localStorage.setItem(tokenSourceStorageKey(userId, state.account_id), state.token_source);
    localStorage.setItem(tradingAdapterStorageKey(userId, state.account_id), state.trading_adapter);
    const selectedAccountId =
      localStorage.getItem(selectedAccountIdStorageKey(userId)) ??
      localStorage.getItem(activeAccountStorageKey(userId));
    if (sameDerivId(selectedAccountId, state.account_id)) {
      localStorage.setItem(selectedTokenSourceStorageKey(userId), state.token_source);
      localStorage.setItem(selectedAdapterStorageKey(userId), state.trading_adapter);
    }
  } catch (error) {
    console.warn("[Deriv Trading] could not persist trading readiness locally", {
      userId,
      accountId: state.account_id,
      error,
    });
  }

  const { error } = await supabase
    .from("sessions")
    .update({
      trading_authorized: state.trading_authorized,
      trading_adapter: state.trading_adapter,
      token_source: state.token_source,
      trading_authorized_at: state.trading_authorized_at,
      last_trading_error: state.last_trading_error,
    })
    .eq("user_id", userId)
    .eq("account_id", state.account_id);

  if (error) {
    if (isSupabaseMissingColumnError(error)) {
      try {
        localStorage.removeItem(tradingAuthorizationStorageKey(userId, state.account_id));
      } catch {
        /* ignore localStorage cleanup failures */
      }
      console.error("[Deriv Trading] trading readiness schema is missing", {
        userId,
        accountId: state.account_id,
        migration: "supabase/migrations/20260510000100_add_deriv_trading_readiness.sql",
        message: error.message,
        code: error.code,
        details: error.details,
      });
      throw createTradingReadinessSchemaError(error);
    }
    console.warn("[Deriv Trading] could not persist trading readiness to Supabase", {
      userId,
      accountId: state.account_id,
      trading_authorized: state.trading_authorized,
      trading_adapter: state.trading_adapter,
      token_source: state.token_source,
      message: error.message,
      code: error.code,
      details: error.details,
    });
  }

  console.info("[Deriv Trading] stored trading readiness state", {
    userId,
    ...state,
  });
}

function readSavedSelectedAccount(userId: string) {
  if (!isBrowser) {
    return {
      accountId: null,
      accountType: null,
      tokenSource: null,
      adapter: null,
    };
  }
  try {
    const accountId =
      localStorage.getItem(selectedAccountIdStorageKey(userId)) ??
      localStorage.getItem(activeAccountStorageKey(userId));
    const accountType = localStorage.getItem(selectedAccountTypeStorageKey(userId));
    const tokenSource = localStorage.getItem(selectedTokenSourceStorageKey(userId));
    const adapter = localStorage.getItem(selectedAdapterStorageKey(userId));
    return {
      accountId,
      accountType: accountTypeIsValid(accountType) ? accountType : null,
      tokenSource: tokenSourceIsValid(tokenSource) ? tokenSource : null,
      adapter: adapterIsValid(adapter) ? adapter : null,
    };
  } catch {
    return {
      accountId: null,
      accountType: null,
      tokenSource: null,
      adapter: null,
    };
  }
}

function persistSelectedTradingSession(userId: string, session: DerivTradingSession) {
  if (!isBrowser) return;
  try {
    localStorage.setItem(selectedAccountIdStorageKey(userId), session.account_id);
    localStorage.setItem(activeAccountStorageKey(userId), session.account_id);
    localStorage.setItem(selectedAccountTypeStorageKey(userId), session.normalizedType);
    localStorage.setItem(selectedTokenSourceStorageKey(userId), session.token_source);
    localStorage.setItem(selectedAdapterStorageKey(userId), session.adapter);
    localStorage.setItem(tokenSourceStorageKey(userId, session.account_id), session.token_source);
    localStorage.setItem(tradingAdapterStorageKey(userId, session.account_id), session.adapter);
    console.info("[Deriv Trading] selected account persisted", {
      userId,
      selectedAccountId: session.account_id,
      accountType: session.normalizedType,
      token_source: session.token_source,
      adapter: session.adapter,
      websocketMode: session.websocketMode,
    });
  } catch (error) {
    console.warn("[Deriv Trading] could not persist selected account", {
      userId,
      selectedAccountId: session.account_id,
      error,
    });
  }
}

function readStoredTokenSource(userId: string, accountId: string): DerivTokenSource | null {
  if (!isBrowser) return null;
  try {
    const saved = localStorage.getItem(tokenSourceStorageKey(userId, accountId));
    if (saved === "oauth_access_token" || saved === "legacy_authorize_token") return saved;
    const selectedAccountId =
      localStorage.getItem(selectedAccountIdStorageKey(userId)) ??
      localStorage.getItem(activeAccountStorageKey(userId));
    if (sameDerivId(selectedAccountId, accountId)) {
      const selectedTokenSource = localStorage.getItem(selectedTokenSourceStorageKey(userId));
      if (
        selectedTokenSource === "oauth_access_token" ||
        selectedTokenSource === "legacy_authorize_token"
      ) {
        return selectedTokenSource;
      }
    }
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

function tokenFreshnessScore(
  expiresAt: string | null | undefined,
  createdAt: string | null | undefined,
) {
  return Math.max(timestampValue(expiresAt), timestampValue(createdAt));
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
  _createdAt: string | null | undefined,
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

  return {
    ...tokenExpiryState(expiresAt),
    storedExpiresAt: expiresAt ?? null,
    platformExpiresAt: null,
    shortProviderExpiresAt: null,
    expiryPolicy: "oauth-provider-expires_in",
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
    (lower.includes("authorize") && lower.includes("token"))
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
        "Trading authorization failed for this account. Please switch account or reconnect if it continues.",
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

function explicitTokenSourceForAccount(account: DerivAccountLike): DerivTokenSource | null {
  return tokenSourceFromText(account.token_source) ?? tokenSourceFromText(account.tokenSource);
}

export function adapterForTokenSource(tokenSource: DerivTokenSource): TradingAdapter {
  return tokenSource === "oauth_access_token" ? "newOAuthTradingAdapter" : "legacyTradingAdapter";
}

export function tradingWebSocketMode(tokenSource: DerivTokenSource): TradingWebSocketMode {
  return "oauth-otp";
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
        tokenSource: authenticatedAccount.tokenSource,
        adapter: adapterForTokenSource(authenticatedAccount.tokenSource),
        websocketMode: tradingWebSocketMode(authenticatedAccount.tokenSource),
        disconnectReason: "selected-account-changed",
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
  return new Promise((resolve, reject) => {
    let ws: WebSocket | null = null;
    let settled = false;
    const websocketMode = tradingWebSocketMode(account.tokenSource);

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
        mode: websocketMode,
        tokenSource: account.tokenSource,
        adapter: adapterForTokenSource(account.tokenSource),
        authorizationResult: "oauth-otp-authorized",
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
          mode: websocketMode,
          tokenSource: account.tokenSource,
          adapter: adapterForTokenSource(account.tokenSource),
          disconnectReason: error.message,
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
        mode: websocketMode,
        tokenSource: account.tokenSource,
        adapter: adapterForTokenSource(account.tokenSource),
        disconnectReason: error.message,
        error: error.message,
        code: (error as DerivSocketError).code ?? null,
        status: (error as DerivSocketError).status ?? null,
        retried,
      });
      reject(error);
    };

    const start = async () => {
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

        if (account.tokenSource !== "oauth_access_token") {
          throw createDerivSocketError(
            DERIV_OAUTH_ONLY_RECONNECT_MESSAGE,
            "DERIV_OAUTH_RECONNECT_REQUIRED",
            401,
            false,
          );
        }
        const authenticatedWsUrl = await getAuthenticatedWsUrl(
          account.accessToken,
          account.accountId,
          account.tokenSource,
        );
        if (!isCurrentAuthenticatedAccount(account)) {
          connecting = null;
          reject(new Error("Deriv account changed while opening WebSocket."));
          return;
        }
        console.info("[Deriv WS] WebSocket URL prepared", {
          accountId: account.accountId,
          accountType: authenticatedAccountTypeLabel(account),
          mode: websocketMode,
          tokenSource: account.tokenSource,
          adapter: adapterForTokenSource(account.tokenSource),
          authorizationResult: "oauth-otp-url-issued",
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
            mode: websocketMode,
            tokenSource: account.tokenSource,
            readyState: ws.readyState,
          });

          console.info("[Deriv WS] OAuth OTP socket authorization ready", {
            accountId: account.accountId,
            mode: websocketMode,
            tokenSource: account.tokenSource,
            adapter: adapterForTokenSource(account.tokenSource),
            authorizationResult: "oauth-otp-socket-open",
          });
          completeOpen();
        };
        ws.onerror = (event) => {
          console.error("[Deriv WS] onerror", {
            accountId: account.accountId,
            mode: websocketMode,
            tokenSource: account.tokenSource,
            adapter: adapterForTokenSource(account.tokenSource),
            disconnectReason: "websocket-error",
            readyState: ws?.readyState ?? null,
            event,
          });
          void fail(new Error("Deriv WebSocket connection failed"));
        };
        ws.onclose = (event) => {
          console.warn("[Deriv WS] onclose", {
            accountId: account.accountId,
            mode: websocketMode,
            tokenSource: account.tokenSource,
            adapter: adapterForTokenSource(account.tokenSource),
            readyState: ws?.readyState ?? null,
            code: event.code,
            reason: event.reason,
            disconnectReason: event.reason || `close-code-${event.code}`,
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
            listeners.forEach((l) => l(data));
          } catch {
            /* ignore */
          }
        };
      } catch (e) {
        void fail(e instanceof Error ? e : new Error("Deriv WebSocket connection failed"));
      }
    };

    void start();
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

  if (
    parsed.origin === "https://home.deriv.com" &&
    parsed.pathname.startsWith("/dashboard/login")
  ) {
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
    forbiddenMarkers,
    clientIdIsConfigured: Boolean(DERIV_CLIENT_ID),
    clientIdLooksDefined: !["", "undefined", "null"].includes(
      (parsed.searchParams.get("client_id") ?? "").toLowerCase(),
    ),
    hasDoubleEncodedRedirectUri: /%3a%2f%2f/i.test(decodedRedirectUri),
    hasAppDerivDashboardRedirect: parsed.origin === "https://app.deriv.com",
    hasBrandDeriv: parsed.searchParams.get("brand") === "deriv",
    hasHomeDashboardLoginRedirect:
      parsed.origin === "https://home.deriv.com" && parsed.pathname.startsWith("/dashboard/login"),
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
    throw new Error(
      "Invalid Deriv OAuth URL. Authorization must use client_id only; app_id is not used.",
    );
  }
  if (!parsed.searchParams.get("client_id")) {
    throw new Error("Invalid Deriv OAuth URL. Authorization URL must include client_id.");
  }
  const diagnostics = getDerivOAuthDiagnostics(url);
  const missingParam = Object.entries(diagnostics.requiredParamsPresent).find(
    ([, exists]) => !exists,
  );
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
    app_id_param: diagnostics.appId ?? "(not included)",
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
  const debugOAuth =
    options.debug === true ||
    new URLSearchParams(window.location.search).get("debug_oauth") === "1";
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
    throw new Error(
      "Invalid Deriv OAuth URL. Authorization URL must not include redirect or brand.",
    );
  }
  if (!parsed.searchParams.get("client_id")) {
    throw new Error("Invalid Deriv OAuth URL. Authorization URL must include client_id.");
  }
  const diagnostics = getDerivOAuthDiagnostics(url);
  if (diagnostics.hasAppId) {
    throw new Error(
      "Invalid Deriv OAuth URL. Authorization must use client_id only; app_id is not used.",
    );
  }
  logOAuthDebug("[Deriv OAuth Debug] Exact final authorization URL", url);
  logOAuthDebug("[Deriv OAuth Debug] Authorization diagnostics", {
    attemptId,
    finalOAuthUrl: url,
    endpoint: DERIV_OAUTH_ENDPOINT,
    client_id: DERIV_CLIENT_ID,
    app_id_param: diagnostics.appId ?? "(not included)",
    clientIdExists: Boolean(DERIV_CLIENT_ID),
    appIdParamExists: diagnostics.hasAppId,
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
    app_id_param: diagnostics.appId ?? "(not included)",
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
  tokenSource: DerivTokenSource,
): Promise<string> {
  const appIdMode: DerivAppIdMode = "oauth";
  if (tokenSource !== "oauth_access_token") {
    throw createDerivSocketError(
      DERIV_OAUTH_ONLY_RECONNECT_MESSAGE,
      "DERIV_OAUTH_RECONNECT_REQUIRED",
      401,
      false,
    );
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
      throw createDerivSocketError(DERIV_RECONNECT_MESSAGE, DERIV_SESSION_EXPIRED_CODE, 401, false);
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (supabaseAccessToken) {
    headers.Authorization = `Bearer ${supabaseAccessToken}`;
  }

  if (!supabaseAccessToken && tokenSource !== "oauth_access_token") {
    throw createDerivSocketError(DERIV_RECONNECT_MESSAGE, DERIV_SESSION_EXPIRED_CODE, 401, false);
  }

  console.info("[Deriv WS] requesting OAuth OTP trading WebSocket", {
    selectedAccount: {
      account_id: accountId,
      loginid: accountId,
      normalizedType: getDerivAccountType({ account_id: accountId }),
      detected_prefix: getDerivAccountPrefix({ account_id: accountId }),
    },
    adapter: adapterForTokenSource(tokenSource),
    websocketMode: tradingWebSocketMode(tokenSource),
    appIdMode,
    tokenSource,
    tokenExists: Boolean(accessToken),
    supabaseJwtExists: Boolean(supabaseAccessToken),
    oauthClientIdHint: DERIV_CLIENT_ID ? `${DERIV_CLIENT_ID.slice(0, 4)}...` : null,
    oauthAppIdHint: DERIV_APP_ID ? `${DERIV_APP_ID.slice(0, 4)}...` : null,
  });

  const response = await fetch("/api/deriv-account-otp", {
    method: "POST",
    headers,
    body: JSON.stringify({
      accessToken,
      accountId,
      appIdMode,
      tokenSource,
      oauthClientId: DERIV_CLIENT_ID ?? "",
      oauthAppId: DERIV_APP_ID ?? "",
    }),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const responseWasJson = contentType.toLowerCase().includes("application/json");
  const otpData = responseWasJson ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    const code = textFrom(
      otpData?.error,
      response.status === 401 ? DERIV_SESSION_EXPIRED_CODE : "DERIV_OTP_FAILED",
    );
    const message = textFrom(
      otpData?.message,
      otpData?.error === DERIV_SESSION_EXPIRED_CODE ? DERIV_RECONNECT_MESSAGE : "",
      otpData?.error,
      responseWasJson ? "" : "Deriv OTP route returned a non-JSON response",
      "Failed to get authenticated Deriv WebSocket URL",
    );
    console.warn("[Deriv WS] OTP request failed", {
      accountId,
      tokenSource,
      adapter: adapterForTokenSource(tokenSource),
      websocketMode: tradingWebSocketMode(tokenSource),
      authorizationResult: "oauth-otp-failed",
      status: response.status,
      responseWasJson,
      code,
      message,
      details: otpData,
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
  console.info("[Deriv WS] OAuth OTP trading WebSocket ready", {
    accountId,
    tokenSource,
    adapter: adapterForTokenSource(tokenSource),
    websocketMode: tradingWebSocketMode(tokenSource),
    authorizationResult: "oauth-otp-url-issued",
  });
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
