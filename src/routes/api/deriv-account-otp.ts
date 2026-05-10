import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { normalizeDerivAccount } from "@/lib/deriv-account";
import type { Database } from "@/integrations/supabase/types";

type DerivAccountOtpRequest = {
  accessToken?: string;
  accountId?: string;
  appIdMode?: "oauth" | "legacy";
  tokenSource?: "oauth_access_token" | "legacy_authorize_token";
};

type SessionRow = {
  id?: string | null;
  account_id: string;
  loginid: string | null;
  deriv_token: string | null;
  is_demo: boolean;
  is_virtual: boolean | null;
  currency: string | null;
  balance: number | null;
  expires_at: string | null;
  is_active: boolean;
  created_at?: string | null;
};

const DERIV_SESSION_EXPIRED = "DERIV_SESSION_EXPIRED";
const RECONNECT_MESSAGE = "Please reconnect your Deriv account.";
const TOKEN_EXPIRY_CLOCK_SKEW_MS = 60_000;
const DERIV_OAUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function derivApiAppId(mode: DerivAccountOtpRequest["appIdMode"] = "oauth") {
  const oauthAppId = process.env.VITE_DERIV_APP_ID ?? process.env.VITE_DERIV_CLIENT_ID ?? "";
  const legacyAppId = process.env.VITE_DERIV_LEGACY_APP_ID ?? "";
  return mode === "legacy" ? legacyAppId || oauthAppId : oauthAppId;
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
  return "missing:VITE_DERIV_APP_ID_OR_VITE_DERIV_CLIENT_ID";
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function errorResponse(
  error: string,
  message: string,
  status: number,
  details: Record<string, unknown> = {},
) {
  return jsonResponse({ ok: false, error, message, ...details }, status);
}

function sessionExpired(details: Record<string, unknown> = {}) {
  return errorResponse(DERIV_SESSION_EXPIRED, RECONNECT_MESSAGE, 401, details);
}

function stringFrom(...values: unknown[]) {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
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
  tokenSource: DerivAccountOtpRequest["tokenSource"] | null,
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

function compareSessionFreshness(left: SessionRow, right: SessionRow) {
  const leftExpiry = timestampValue(left.expires_at);
  const rightExpiry = timestampValue(right.expires_at);
  if (leftExpiry !== rightExpiry) return rightExpiry - leftExpiry;
  return timestampValue(right.created_at) - timestampValue(left.created_at);
}

function isLikelyDerivOAuthToken(token: string | null | undefined) {
  if (!token) return false;
  return token.startsWith("ory_") || token.includes("ory_at_");
}

function numericAppId(...ids: Array<string | undefined>) {
  return ids.map((id) => String(id ?? "").trim()).find((id) => /^\d+$/.test(id)) ?? "";
}

function legacyWsUrl() {
  const appId = numericAppId(
    process.env.VITE_DERIV_LEGACY_APP_ID,
    process.env.VITE_DERIV_APP_ID,
    "1089",
  );
  return `wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(appId)}`;
}

function createRouteSupabase(jwt: string) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  return createClient<Database, "public">(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
  });
}

async function parseJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.toLowerCase().includes("application/json");
  if (!isJson) {
    const text = await response.text().catch(() => "");
    return { isJson, data: null, text };
  }
  const data = await response.json().catch(() => null);
  return { isJson, data, text: "" };
}

async function requestBody(request: Request) {
  return (await request.json().catch(() => ({}))) as DerivAccountOtpRequest;
}

async function requestOAuthOtp({
  accountId,
  authMode,
  authenticatedUserId,
  selectedAccountType,
  storedToken,
  tokenExpiry,
}: {
  accountId: string;
  authMode: "supabase-session" | "oauth-token-only";
  authenticatedUserId?: string | null;
  selectedAccountType: string;
  storedToken: string;
  tokenExpiry?: string | null;
}) {
  const appId = derivApiAppId("oauth");
  if (!appId) {
    return errorResponse("DERIV_APP_ID_MISSING", "Missing Deriv App ID.", 500);
  }

  console.info("[Deriv OTP API] request started", {
    endpoint: `https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`,
    requestedAccountId: accountId,
    authenticatedUserId: authenticatedUserId ?? null,
    authMode,
    sessionFound: authMode === "supabase-session",
    deriv_token_exists: true,
    tokenExpiry: tokenExpiry ?? null,
    selectedAccountType,
    appId,
    appIdMode: "oauth",
    appIdSource: derivApiAppIdSource("oauth"),
  });
  const otpResponse = await fetch(
    `https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${storedToken}`,
        "Deriv-App-ID": appId,
      },
    },
  );
  const parsed = await parseJsonResponse(otpResponse);

  console.info("[Deriv OTP API] endpoint response", {
    requestedAccountId: accountId,
    authenticatedUserId: authenticatedUserId ?? null,
    authMode,
    status: otpResponse.status,
    ok: otpResponse.ok,
    responseWasJson: parsed.isJson,
    selectedAccountType,
  });

  if (otpResponse.status === 401 || otpResponse.status === 403) {
    return errorResponse(
      "DERIV_OTP_AUTH_FAILED",
      "Deriv rejected the trading WebSocket authorization. Your Deriv account remains connected; reconnect only if this continues.",
      409,
      {
        requestedAccountId: accountId,
        authenticatedUserId: authenticatedUserId ?? null,
        authMode,
        selectedAccountType,
        otpStatus: otpResponse.status,
        responseWasJson: parsed.isJson,
        sessionDeactivated: false,
      },
    );
  }

  if (otpResponse.status === 429) {
    return errorResponse(
      "DERIV_RATE_LIMITED",
      "Deriv is rate limiting account requests. Please wait a moment, then try again.",
      429,
      {
        requestedAccountId: accountId,
        responseWasJson: parsed.isJson,
      },
    );
  }

  if (!otpResponse.ok) {
    const data = parsed.data as
      | { message?: string; error?: { message?: string } | string }
      | null;
    const message =
      data?.message ??
      (typeof data?.error === "string" ? data.error : data?.error?.message) ??
      "Failed to get authenticated Deriv WebSocket URL.";
    return errorResponse("DERIV_OTP_FAILED", message, otpResponse.status || 400, {
      requestedAccountId: accountId,
      responseWasJson: parsed.isJson,
    });
  }

  const data = parsed.data as { data?: { url?: string }; url?: string } | null;
  const url = data?.data?.url ?? data?.url;
  if (!url) {
    return errorResponse(
      "DERIV_OTP_URL_MISSING",
      "Deriv OTP response did not include a WebSocket URL.",
      502,
      {
        requestedAccountId: accountId,
        responseWasJson: parsed.isJson,
      },
    );
  }

  return jsonResponse({
    ok: true,
    url,
    requestedAccountId: accountId,
    selectedAccountType,
  });
}

export const Route = createFileRoute("/api/deriv-account-otp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const {
            accessToken: bodyAccessToken,
            accountId,
            appIdMode = "oauth",
            tokenSource,
          } =
            await requestBody(request);
          if (!accountId) {
            return errorResponse(
              "DERIV_ACCOUNT_REQUIRED",
              "Missing Deriv account ID.",
              400,
              { hasAccessToken: Boolean(bodyAccessToken) },
            );
          }
          const requestTokenSource: DerivAccountOtpRequest["tokenSource"] | null =
            tokenSource ?? (appIdMode === "oauth" ? "oauth_access_token" : null);
          const canUseOAuthTokenOnly =
            requestTokenSource === "oauth_access_token" && Boolean(bodyAccessToken);

          const authHeader = request.headers.get("authorization") ?? "";
          const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
          const supabase = jwt ? createRouteSupabase(jwt) : null;
          if (!jwt || !supabase) {
            console.warn("[Deriv OTP API] Supabase session missing", {
              requestedAccountId: accountId,
              hasAuthorizationHeader: Boolean(authHeader),
              hasSupabaseClient: Boolean(supabase),
              tokenSource: requestTokenSource,
              canUseOAuthTokenOnly,
            });
            if (canUseOAuthTokenOnly) {
              return requestOAuthOtp({
                accountId,
                authMode: "oauth-token-only",
                authenticatedUserId: null,
                selectedAccountType: "unknown",
                storedToken: bodyAccessToken!,
                tokenExpiry: null,
              });
            }
            return sessionExpired({
              requestedAccountId: accountId,
              sessionFound: false,
              derivTokenExists: false,
            });
          }

          const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
          const userId = userData.user?.id ?? null;
          if (userError || !userId) {
            console.warn("[Deriv OTP API] Supabase user validation failed", {
              requestedAccountId: accountId,
              error: userError?.message ?? null,
              tokenSource: requestTokenSource,
              canUseOAuthTokenOnly,
            });
            if (canUseOAuthTokenOnly) {
              return requestOAuthOtp({
                accountId,
                authMode: "oauth-token-only",
                authenticatedUserId: null,
                selectedAccountType: "unknown",
                storedToken: bodyAccessToken!,
                tokenExpiry: null,
              });
            }
            return sessionExpired({
              requestedAccountId: accountId,
              sessionFound: false,
              derivTokenExists: false,
            });
          }

          const { data: sessionRows, error: sessionsError } = await supabase
            .from("sessions")
            .select(
              "id, account_id, loginid, deriv_token, is_demo, is_virtual, currency, balance, expires_at, is_active, created_at",
            )
            .eq("user_id", userId)
            .eq("is_active", true);

          if (sessionsError) {
            console.error("[Deriv OTP API] Supabase session lookup failed", {
              requestedAccountId: accountId,
              authenticatedUserId: userId,
              message: sessionsError.message,
              code: sessionsError.code,
              details: sessionsError.details,
            });
            return errorResponse(
              "DERIV_SESSION_LOOKUP_FAILED",
              "Could not verify your Deriv account session.",
              500,
            );
          }

          const matchingSessions = ((sessionRows ?? []) as SessionRow[])
            .filter(
              (session) =>
                sameAccountId(session.account_id, accountId) ||
                sameAccountId(session.loginid, accountId),
            )
            .sort(compareSessionFreshness);
          const selectedSession = matchingSessions[0] ?? null;
          const normalized = selectedSession
            ? normalizeDerivAccount(selectedSession, { trustVirtualFlags: false })
            : null;
          const storedToken = stringFrom(selectedSession?.deriv_token);
          const selectedAccountType = normalized?.normalizedType ?? "unknown";
          const requestedTokenSource: DerivAccountOtpRequest["tokenSource"] =
            requestTokenSource ??
            (appIdMode === "oauth" || isLikelyDerivOAuthToken(storedToken)
              ? "oauth_access_token"
              : "legacy_authorize_token");
          const shouldUseOAuthOtp =
            appIdMode === "oauth" || requestedTokenSource === "oauth_access_token";
          const tokenForOtp =
            shouldUseOAuthOtp && bodyAccessToken ? bodyAccessToken : storedToken;
          const tokenForOtpSource =
            shouldUseOAuthOtp && bodyAccessToken
              ? "request-body-oauth-token"
              : "supabase-session-token";
          const expiry = effectiveTokenExpiryState(
            selectedSession?.expires_at,
            selectedSession?.created_at,
            requestedTokenSource,
          );

          console.info("[Deriv OTP API] session validation", {
            requestedAccountId: accountId,
            authenticatedUserId: userId,
            sessionFound: Boolean(selectedSession),
            matchingSessionCount: matchingSessions.length,
            sessionId: selectedSession?.id ?? null,
            deriv_token_exists: Boolean(storedToken),
            tokenExpiry: expiry.expiresAt,
            storedTokenExpiry: expiry.storedExpiresAt,
            platformTokenExpiry: expiry.platformExpiresAt,
            shortProviderTokenExpiry: expiry.shortProviderExpiresAt,
            expiryPolicy: expiry.expiryPolicy,
            currentTime: expiry.currentTime,
            tokenExpired: expiry.expired,
            expiresWithinClockSkew: expiry.expiresWithinClockSkew,
            invalidExpiry: expiry.invalidExpiry,
            selectedAccountType,
            createdAt: selectedSession?.created_at ?? null,
            appIdMode,
            tokenSource: requestedTokenSource,
            bodyToken: tokenLogValue(bodyAccessToken),
            storedToken: tokenLogValue(storedToken),
            tokenForOtp: tokenLogValue(tokenForOtp),
            tokenForOtpSource,
            bodyTokenMatchesStoredToken: Boolean(
              bodyAccessToken && storedToken && bodyAccessToken === storedToken,
            ),
          });

          if ((!selectedSession || !storedToken) && canUseOAuthTokenOnly) {
            console.warn("[Deriv OTP API] Supabase session row unavailable; using OAuth token-only fallback", {
              requestedAccountId: accountId,
              authenticatedUserId: userId,
              sessionFound: Boolean(selectedSession),
              derivTokenExists: Boolean(storedToken),
              tokenSource: requestedTokenSource,
            });
            return requestOAuthOtp({
              accountId,
              authMode: "oauth-token-only",
              authenticatedUserId: userId,
              selectedAccountType,
              storedToken: bodyAccessToken!,
              tokenExpiry: null,
            });
          }

          if (expiry.expired && shouldUseOAuthOtp && bodyAccessToken) {
            console.warn("[Deriv OTP API] Stored OAuth expiry is stale; letting Deriv validate the provided OAuth token", {
              requestedAccountId: accountId,
              authenticatedUserId: userId,
              sessionFound: Boolean(selectedSession),
              derivTokenExists: Boolean(storedToken),
              tokenExpiry: expiry.expiresAt,
              tokenSource: requestedTokenSource,
            });
            return requestOAuthOtp({
              accountId,
              authMode: "oauth-token-only",
              authenticatedUserId: userId,
              selectedAccountType,
              storedToken: bodyAccessToken,
              tokenExpiry: expiry.expiresAt,
            });
          }

          if (!selectedSession || !storedToken || expiry.expired) {
            return sessionExpired({
              requestedAccountId: accountId,
              authenticatedUserId: userId,
              sessionFound: Boolean(selectedSession),
              derivTokenExists: Boolean(storedToken),
              tokenExpiry: expiry.expiresAt,
              currentTime: expiry.currentTime,
              tokenExpired: expiry.expired,
              selectedAccountType,
            });
          }

          if (bodyAccessToken && bodyAccessToken !== storedToken) {
            console.warn(
              shouldUseOAuthOtp
                ? "[Deriv OTP API] using request OAuth token for OTP instead of stored session token"
                : "[Deriv OTP API] stale client token ignored",
              {
                requestedAccountId: accountId,
                authenticatedUserId: userId,
                bodyToken: tokenLogValue(bodyAccessToken),
                storedToken: tokenLogValue(storedToken),
                tokenForOtpSource,
              },
            );
          }

          if (!shouldUseOAuthOtp && !isLikelyDerivOAuthToken(storedToken)) {
            console.info("[Deriv OTP API] legacy token requires direct WebSocket authorization", {
              requestedAccountId: accountId,
              authenticatedUserId: userId,
              selectedAccountType,
              tokenSource: requestedTokenSource,
              wsUrl: legacyWsUrl(),
            });
            return errorResponse(
              "DERIV_LEGACY_DIRECT_WS_REQUIRED",
              "Legacy accounts use direct Deriv WebSocket authorization instead of the OAuth OTP endpoint.",
              409,
              {
                requestedAccountId: accountId,
                selectedAccountType,
                legacyWsUrl: legacyWsUrl(),
              },
            );
          }

          return requestOAuthOtp({
            accountId,
            authMode: "supabase-session",
            authenticatedUserId: userId,
            selectedAccountType,
            storedToken: tokenForOtp,
            tokenExpiry: expiry.expiresAt,
          });
        } catch (error: unknown) {
          console.error("[Deriv OTP API] request failed", error);
          return errorResponse(
            "DERIV_OTP_ROUTE_FAILED",
            error instanceof Error
              ? error.message
              : "Failed to get authenticated Deriv WebSocket URL.",
            500,
          );
        }
      },
    },
  },
});
