import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { normalizeDerivAccount } from "@/lib/deriv-account";
import { DERIV_API_BASE_URL, DERIV_OAUTH_CLIENT_ID } from "@/lib/deriv-config";
import type { Database } from "@/integrations/supabase/types";

type DerivAccountOtpRequest = {
  accessToken?: string;
  accountId?: string;
  appIdMode?: "oauth";
  tokenSource?: "oauth_access_token";
  oauthClientId?: string;
  oauthAppId?: string;
};

type TokenSource = NonNullable<DerivAccountOtpRequest["tokenSource"]>;
type AppIdMode = NonNullable<DerivAccountOtpRequest["appIdMode"]>;
type AppIdCandidate = { value: string; source: string };

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
const OAUTH_ONLY_RECONNECT_MESSAGE =
  "Reconnect this Deriv account through OAuth2. Redsmap uses client_id 33dF8d2wwjIpeFDBvNkln for all account types.";
const TOKEN_EXPIRY_CLOCK_SKEW_MS = 60_000;

function addAppIdCandidate(candidates: AppIdCandidate[], value: unknown, source: string) {
  const text = String(value ?? "").trim();
  if (!text || candidates.some((candidate) => candidate.value === text)) return;
  candidates.push({ value: text, source });
}

function oauthAppIdCandidates(
  requestHints?: Pick<DerivAccountOtpRequest, "oauthClientId" | "oauthAppId">,
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
  _mode: DerivAccountOtpRequest["appIdMode"] = "oauth",
  requestHints?: Pick<DerivAccountOtpRequest, "oauthClientId" | "oauthAppId">,
) {
  return oauthAppIdCandidates(requestHints)[0]?.value ?? "";
}

function derivApiAppIdSource(
  _mode: DerivAccountOtpRequest["appIdMode"] = "oauth",
  requestHints?: Pick<DerivAccountOtpRequest, "oauthClientId" | "oauthAppId">,
) {
  const oauthCandidates = oauthAppIdCandidates(requestHints);
  if (oauthCandidates.length) return oauthCandidates[0].source;
  return "missing:VITE_DERIV_CLIENT_ID_OR_VITE_DERIV_APP_ID";
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
  _createdAt: string | null | undefined,
  tokenSource: DerivAccountOtpRequest["tokenSource"] | null,
) {
  if (tokenSource !== "oauth_access_token") {
    return {
      ...tokenExpiryState(expiresAt),
      storedExpiresAt: expiresAt ?? null,
      platformExpiresAt: null,
      shortProviderExpiresAt: null,
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

function compareSessionFreshness(left: SessionRow, right: SessionRow) {
  const leftExpiry = timestampValue(left.expires_at);
  const rightExpiry = timestampValue(right.expires_at);
  if (leftExpiry !== rightExpiry) return rightExpiry - leftExpiry;
  return timestampValue(right.created_at) - timestampValue(left.created_at);
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

async function deactivateSessionRows(
  supabase: ReturnType<typeof createRouteSupabase>,
  userId: string,
  accountId: string,
) {
  if (!supabase) return false;
  const { error } = await supabase
    .from("sessions")
    .update({ is_active: false })
    .eq("user_id", userId)
    .or(`account_id.eq.${accountId},loginid.eq.${accountId}`);
  if (error) {
    console.warn("[Deriv OTP API] could not deactivate expired OAuth session rows", {
      authenticatedUserId: userId,
      requestedAccountId: accountId,
      message: error.message,
      code: error.code,
      details: error.details,
    });
    return false;
  }
  return true;
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

function redactedOtpBody(parsed: Awaited<ReturnType<typeof parseJsonResponse>>) {
  if (!parsed.isJson) return parsed.text ? { text: parsed.text.slice(0, 500) } : null;
  return parsed.data;
}

function accountsFromOptionsResponse(data: unknown) {
  const payload =
    data && typeof data === "object" && "data" in data ? (data as { data?: unknown }).data : data;
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object" && "accounts" in payload) {
    const accounts = (payload as { accounts?: unknown }).accounts;
    if (Array.isArray(accounts)) return accounts as Record<string, unknown>[];
  }
  return [];
}

async function verifyOAuthTokenAccount({
  accessToken,
  appId,
  accountId,
}: {
  accessToken: string;
  appId: string;
  accountId: string;
}) {
  const response = await fetch("https://api.derivws.com/trading/v1/options/accounts", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Deriv-App-ID": appId,
    },
  });
  const parsed = await parseJsonResponse(response);
  const accounts = accountsFromOptionsResponse(parsed.data);
  const accountIds = accounts
    .map((account) => normalizeDerivAccount(account, { trustVirtualFlags: false }))
    .filter((account): account is NonNullable<ReturnType<typeof normalizeDerivAccount>> =>
      Boolean(account),
    )
    .map((account) => account.account_id);
  return {
    ok: response.ok,
    status: response.status,
    responseWasJson: parsed.isJson,
    responseBody: response.ok ? null : redactedOtpBody(parsed),
    accountIds,
    containsRequestedAccount: accountIds.some((id) => sameAccountId(id, accountId)),
  };
}

async function requestOAuthOtp({
  accountId,
  alternateToken,
  alternateTokenSourceLabel,
  authMode,
  authenticatedUserId,
  supabaseClient,
  appIdHints,
  selectedAccountType,
  storedToken,
  tokenSourceLabel = "primary-oauth-token",
  tokenExpiry,
}: {
  accountId: string;
  alternateToken?: string | null;
  alternateTokenSourceLabel?: string | null;
  authMode: "supabase-session" | "oauth-token-only";
  authenticatedUserId?: string | null;
  supabaseClient?: ReturnType<typeof createRouteSupabase> | null;
  appIdHints?: Pick<DerivAccountOtpRequest, "oauthClientId" | "oauthAppId">;
  selectedAccountType: string;
  storedToken: string;
  tokenSourceLabel?: string;
  tokenExpiry?: string | null;
}) {
  const appId = derivApiAppId("oauth", appIdHints);
  if (!appId) {
    return errorResponse("DERIV_APP_ID_MISSING", "Missing Deriv App ID.", 500);
  }
  const appIdCandidates = oauthAppIdCandidates(appIdHints);
  const primaryAppIdCandidate: AppIdCandidate = appIdCandidates[0] ?? {
    value: appId,
    source: derivApiAppIdSource("oauth", appIdHints),
  };
  const otpAppIdCandidates = appIdCandidates.length > 0 ? appIdCandidates : [primaryAppIdCandidate];

  const endpoint = `${DERIV_API_BASE_URL}/trading/v1/options/accounts/${accountId}/otp`;
  const requestOtp = async (token: string, sourceLabel: string, appIdCandidate: AppIdCandidate) => {
    console.info("[Deriv OTP API] request started", {
      endpoint,
      requestedAccountId: accountId,
      authenticatedUserId: authenticatedUserId ?? null,
      authMode,
      sessionFound: authMode === "supabase-session",
      deriv_token_exists: Boolean(token),
      token: tokenLogValue(token),
      tokenSourceLabel: sourceLabel,
      tokenExpiry: tokenExpiry ?? null,
      selectedAccountType,
      appId: appIdCandidate.value,
      appIdMode: "oauth",
      appIdSource: appIdCandidate.source,
    });
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Deriv-App-ID": appIdCandidate.value,
      },
    });
    const parsed = await parseJsonResponse(response);

    console.info("[Deriv OTP API] endpoint response", {
      requestedAccountId: accountId,
      authenticatedUserId: authenticatedUserId ?? null,
      authMode,
      tokenSourceLabel: sourceLabel,
      status: response.status,
      ok: response.ok,
      responseWasJson: parsed.isJson,
      responseBody: response.ok ? null : redactedOtpBody(parsed),
      selectedAccountType,
      appId: appIdCandidate.value,
      appIdSource: appIdCandidate.source,
    });

    return { response, parsed, sourceLabel, appIdCandidate };
  };

  const requestOtpWithAppIdFallback = async (token: string, sourceLabel: string) => {
    const attemptedAppIds: Array<{ appId: string; appIdSource: string; status: number }> = [];
    let result = await requestOtp(token, sourceLabel, otpAppIdCandidates[0]);
    attemptedAppIds.push({
      appId: result.appIdCandidate.value,
      appIdSource: result.appIdCandidate.source,
      status: result.response.status,
    });
    if ([429, 500, 502, 503, 504].includes(result.response.status)) {
      console.warn("[Deriv OTP API] transient OTP failure; retrying once", {
        requestedAccountId: accountId,
        authenticatedUserId: authenticatedUserId ?? null,
        authMode,
        tokenSourceLabel: sourceLabel,
        appIdSource: result.appIdCandidate.source,
        status: result.response.status,
      });
      result = await requestOtp(token, sourceLabel, result.appIdCandidate);
      attemptedAppIds.push({
        appId: result.appIdCandidate.value,
        appIdSource: result.appIdCandidate.source,
        status: result.response.status,
      });
    }
    for (let index = 1; index < otpAppIdCandidates.length; index += 1) {
      if (result.response.status !== 401 && result.response.status !== 403) break;
      const nextCandidate = otpAppIdCandidates[index];
      console.warn(
        "[Deriv OTP API] OAuth OTP rejected for app id; retrying next app id candidate",
        {
          requestedAccountId: accountId,
          authenticatedUserId: authenticatedUserId ?? null,
          authMode,
          tokenSourceLabel: sourceLabel,
          previousAppIdSource: result.appIdCandidate.source,
          previousStatus: result.response.status,
          nextAppIdSource: nextCandidate.source,
        },
      );
      result = await requestOtp(token, sourceLabel, nextCandidate);
      attemptedAppIds.push({
        appId: result.appIdCandidate.value,
        appIdSource: result.appIdCandidate.source,
        status: result.response.status,
      });
    }
    return { ...result, attemptedAppIds };
  };

  let currentOtpToken = storedToken;
  let {
    response: otpResponse,
    parsed,
    sourceLabel,
    appIdCandidate: appIdCandidateUsed,
    attemptedAppIds,
  } = await requestOtpWithAppIdFallback(storedToken, tokenSourceLabel);

  if (
    (otpResponse.status === 401 || otpResponse.status === 403) &&
    alternateToken &&
    alternateToken !== storedToken
  ) {
    console.warn("[Deriv OTP API] primary OAuth token rejected; retrying alternate token once", {
      requestedAccountId: accountId,
      authenticatedUserId: authenticatedUserId ?? null,
      primaryTokenSourceLabel: sourceLabel,
      alternateTokenSourceLabel: alternateTokenSourceLabel ?? "alternate-oauth-token",
      primaryStatus: otpResponse.status,
      primaryResponseWasJson: parsed.isJson,
      primaryResponseBody: redactedOtpBody(parsed),
    });
    const retry = await requestOtpWithAppIdFallback(
      alternateToken,
      alternateTokenSourceLabel ?? "alternate-oauth-token",
    );
    currentOtpToken = alternateToken;
    otpResponse = retry.response;
    parsed = retry.parsed;
    sourceLabel = retry.sourceLabel;
    appIdCandidateUsed = retry.appIdCandidate;
    attemptedAppIds = [...attemptedAppIds, ...retry.attemptedAppIds];
  }

  if (otpResponse.status === 401 || otpResponse.status === 403) {
    const tokenAccountVerificationByAppId = await Promise.all(
      otpAppIdCandidates.map(async (candidate) => {
        const verification = await verifyOAuthTokenAccount({
          accessToken: currentOtpToken,
          appId: candidate.value,
          accountId,
        }).catch((error: unknown) => ({
          ok: false,
          status: null,
          responseWasJson: false,
          responseBody: error instanceof Error ? error.message : "Account verification failed",
          accountIds: [],
          containsRequestedAccount: false,
        }));
        return {
          appId: candidate.value,
          appIdSource: candidate.source,
          ...verification,
        };
      }),
    );
    const tokenRejectedByAllAppIds =
      tokenAccountVerificationByAppId.length > 0 &&
      tokenAccountVerificationByAppId.every(
        (verification) => verification.status === 401 || verification.status === 403,
      );
    const tokenAccountVerification =
      tokenAccountVerificationByAppId.find(
        (verification) => verification.appId === appIdCandidateUsed.value,
      ) ?? tokenAccountVerificationByAppId[0];
    console.warn("[Deriv OTP API] OAuth token/account verification after OTP auth failure", {
      requestedAccountId: accountId,
      authenticatedUserId: authenticatedUserId ?? null,
      tokenSourceLabel: sourceLabel,
      appIdSource: appIdCandidateUsed.source,
      attemptedAppIds,
      tokenAccountVerification,
      tokenAccountVerificationByAppId,
    });
    if (tokenRejectedByAllAppIds) {
      const sessionDeactivated =
        authMode === "supabase-session" && authenticatedUserId
          ? await deactivateSessionRows(supabaseClient ?? null, authenticatedUserId, accountId)
          : false;
      console.warn(
        "[Deriv OTP API] OAuth token rejected by all app id candidates; session treated as expired",
        {
          requestedAccountId: accountId,
          authenticatedUserId: authenticatedUserId ?? null,
          tokenSourceLabel: sourceLabel,
          attemptedAppIds,
          otpStatus: otpResponse.status,
          responseBody: redactedOtpBody(parsed),
          tokenAccountVerificationByAppId,
          sessionDeactivated,
        },
      );
      return sessionExpired({
        requestedAccountId: accountId,
        authenticatedUserId: authenticatedUserId ?? null,
        authMode,
        selectedAccountType,
        tokenSourceLabel: sourceLabel,
        appIdSource: appIdCandidateUsed.source,
        attemptedAppIds,
        otpStatus: otpResponse.status,
        responseWasJson: parsed.isJson,
        responseBody: redactedOtpBody(parsed),
        tokenAccountVerificationByAppId,
        sessionDeactivated,
      });
    }
    return errorResponse(
      "DERIV_OTP_AUTH_FAILED",
      "Trading authorization failed for this account. Please switch account or reconnect if it continues.",
      409,
      {
        requestedAccountId: accountId,
        authenticatedUserId: authenticatedUserId ?? null,
        authMode,
        selectedAccountType,
        tokenSourceLabel: sourceLabel,
        appIdSource: appIdCandidateUsed.source,
        attemptedAppIds,
        otpStatus: otpResponse.status,
        responseWasJson: parsed.isJson,
        responseBody: redactedOtpBody(parsed),
        tokenAccountVerification,
        tokenAccountVerificationByAppId,
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
    const data = parsed.data as { message?: string; error?: { message?: string } | string } | null;
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
            oauthClientId,
            oauthAppId,
          } = await requestBody(request);
          if (!accountId) {
            return errorResponse("DERIV_ACCOUNT_REQUIRED", "Missing Deriv account ID.", 400, {
              hasAccessToken: Boolean(bodyAccessToken),
            });
          }
          const incomingAppIdMode = appIdMode;
          if (tokenSource !== "oauth_access_token") {
            return errorResponse(
              "DERIV_OAUTH_RECONNECT_REQUIRED",
              OAUTH_ONLY_RECONNECT_MESSAGE,
              400,
              {
                requestedAccountId: accountId,
                incomingAppIdMode,
                tokenSource: tokenSource ?? null,
              },
            );
          }
          const requestTokenSource: TokenSource = tokenSource;
          const appIdHints = {
            oauthClientId,
            oauthAppId,
          } satisfies Pick<DerivAccountOtpRequest, "oauthClientId" | "oauthAppId">;
          const finalAppIdMode: AppIdMode = "oauth";
          const canUseOAuthTokenOnly =
            finalAppIdMode === "oauth" &&
            requestTokenSource === "oauth_access_token" &&
            Boolean(bodyAccessToken);

          const authHeader = request.headers.get("authorization") ?? "";
          const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
          const supabase = jwt ? createRouteSupabase(jwt) : null;
          if (!jwt || !supabase) {
            console.warn("[Deriv OTP API] Supabase session missing", {
              requestedAccountId: accountId,
              hasAuthorizationHeader: Boolean(authHeader),
              hasSupabaseClient: Boolean(supabase),
              incomingAppIdMode,
              finalAppIdMode,
              incomingTokenSource: tokenSource ?? null,
              finalTokenSource: requestTokenSource,
              canUseOAuthTokenOnly,
            });
            if (canUseOAuthTokenOnly) {
              return requestOAuthOtp({
                accountId,
                authMode: "oauth-token-only",
                authenticatedUserId: null,
                supabaseClient: null,
                appIdHints,
                selectedAccountType: "unknown",
                storedToken: bodyAccessToken!,
                tokenSourceLabel: "request-body-oauth-token",
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
              incomingAppIdMode,
              finalAppIdMode,
              incomingTokenSource: tokenSource ?? null,
              finalTokenSource: requestTokenSource,
              canUseOAuthTokenOnly,
            });
            if (canUseOAuthTokenOnly) {
              return requestOAuthOtp({
                accountId,
                authMode: "oauth-token-only",
                authenticatedUserId: null,
                supabaseClient: null,
                appIdHints,
                selectedAccountType: "unknown",
                storedToken: bodyAccessToken!,
                tokenSourceLabel: "request-body-oauth-token",
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
          const requestedTokenSource = requestTokenSource;
          const shouldUseOAuthOtp =
            finalAppIdMode === "oauth" && requestedTokenSource === "oauth_access_token";
          const tokenForOtp = shouldUseOAuthOtp && bodyAccessToken ? bodyAccessToken : storedToken;
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
            selectedAccountPrefix: normalized?.detected_prefix ?? null,
            createdAt: selectedSession?.created_at ?? null,
            incomingAppIdMode,
            finalAppIdMode,
            incomingTokenSource: tokenSource ?? null,
            finalTokenSource: requestedTokenSource,
            storedSessionAccountId: selectedSession?.account_id ?? null,
            storedLoginid: selectedSession?.loginid ?? null,
            storedTokenSource: "not_persisted_in_sessions_table__using_request_token_source",
            derivAppIdHeaderSource: derivApiAppIdSource(finalAppIdMode, appIdHints),
            derivAppIdHeaderValue: derivApiAppId(finalAppIdMode, appIdHints),
            bodyToken: tokenLogValue(bodyAccessToken),
            storedToken: tokenLogValue(storedToken),
            tokenForOtp: tokenLogValue(tokenForOtp),
            tokenForOtpSource,
            bodyTokenMatchesStoredToken: Boolean(
              bodyAccessToken && storedToken && bodyAccessToken === storedToken,
            ),
          });

          if ((!selectedSession || !storedToken) && canUseOAuthTokenOnly) {
            console.warn(
              "[Deriv OTP API] Supabase session row unavailable; using OAuth token-only fallback",
              {
                requestedAccountId: accountId,
                authenticatedUserId: userId,
                sessionFound: Boolean(selectedSession),
                derivTokenExists: Boolean(storedToken),
                tokenSource: requestedTokenSource,
              },
            );
            return requestOAuthOtp({
              accountId,
              authMode: "oauth-token-only",
              authenticatedUserId: userId,
              supabaseClient: supabase,
              appIdHints,
              selectedAccountType,
              storedToken: bodyAccessToken!,
              tokenSourceLabel: "request-body-oauth-token",
              tokenExpiry: null,
            });
          }

          if (expiry.expired && shouldUseOAuthOtp && bodyAccessToken) {
            console.warn(
              "[Deriv OTP API] Stored OAuth expiry is stale; letting Deriv validate the provided OAuth token",
              {
                requestedAccountId: accountId,
                authenticatedUserId: userId,
                sessionFound: Boolean(selectedSession),
                derivTokenExists: Boolean(storedToken),
                tokenExpiry: expiry.expiresAt,
                tokenSource: requestedTokenSource,
              },
            );
            return requestOAuthOtp({
              accountId,
              authMode: "oauth-token-only",
              authenticatedUserId: userId,
              supabaseClient: supabase,
              appIdHints,
              selectedAccountType,
              storedToken: bodyAccessToken,
              alternateToken: storedToken || null,
              alternateTokenSourceLabel: "supabase-session-token",
              tokenSourceLabel: "request-body-oauth-token",
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

          return requestOAuthOtp({
            accountId,
            authMode: "supabase-session",
            authenticatedUserId: userId,
            supabaseClient: supabase,
            appIdHints,
            selectedAccountType,
            alternateToken:
              bodyAccessToken && bodyAccessToken !== tokenForOtp
                ? bodyAccessToken
                : storedToken && storedToken !== tokenForOtp
                  ? storedToken
                  : null,
            alternateTokenSourceLabel:
              bodyAccessToken && bodyAccessToken !== tokenForOtp
                ? "request-body-oauth-token"
                : storedToken && storedToken !== tokenForOtp
                  ? "supabase-session-token"
                  : null,
            storedToken: tokenForOtp,
            tokenSourceLabel: tokenForOtpSource,
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
