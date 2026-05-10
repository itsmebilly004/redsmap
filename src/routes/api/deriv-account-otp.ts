import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { normalizeDerivAccount } from "@/lib/deriv-account";
import type { Database } from "@/integrations/supabase/types";

type DerivAccountOtpRequest = {
  accessToken?: string;
  accountId?: string;
  appIdMode?: "oauth" | "legacy";
};

type SessionRow = {
  account_id: string;
  loginid: string | null;
  deriv_token: string | null;
  is_demo: boolean;
  is_virtual: boolean | null;
  currency: string | null;
  balance: number | null;
  expires_at: string | null;
  is_active: boolean;
};

const DERIV_SESSION_EXPIRED = "DERIV_SESSION_EXPIRED";
const RECONNECT_MESSAGE = "Please reconnect your Deriv account.";

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

function isExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt).getTime();
  return Number.isFinite(expiry) && expiry <= Date.now();
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

export const Route = createFileRoute("/api/deriv-account-otp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { accessToken: bodyAccessToken, accountId, appIdMode = "oauth" } =
            await requestBody(request);
          if (!accountId) {
            return errorResponse(
              "DERIV_ACCOUNT_REQUIRED",
              "Missing Deriv account ID.",
              400,
              { hasAccessToken: Boolean(bodyAccessToken) },
            );
          }

          const authHeader = request.headers.get("authorization") ?? "";
          const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
          const supabase = jwt ? createRouteSupabase(jwt) : null;
          if (!jwt || !supabase) {
            console.warn("[Deriv OTP API] Supabase session missing", {
              requestedAccountId: accountId,
              hasAuthorizationHeader: Boolean(authHeader),
              hasSupabaseClient: Boolean(supabase),
            });
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
            });
            return sessionExpired({
              requestedAccountId: accountId,
              sessionFound: false,
              derivTokenExists: false,
            });
          }

          const { data: sessionRows, error: sessionsError } = await supabase
            .from("sessions")
            .select(
              "account_id, loginid, deriv_token, is_demo, is_virtual, currency, balance, expires_at, is_active",
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

          const selectedSession = ((sessionRows ?? []) as SessionRow[]).find(
            (session) =>
              sameAccountId(session.account_id, accountId) ||
              sameAccountId(session.loginid, accountId),
          );
          const normalized = selectedSession
            ? normalizeDerivAccount(selectedSession, { trustVirtualFlags: false })
            : null;
          const storedToken = stringFrom(selectedSession?.deriv_token);
          const tokenExpired = isExpired(selectedSession?.expires_at);
          const selectedAccountType = normalized?.normalizedType ?? "unknown";

          console.info("[Deriv OTP API] session validation", {
            requestedAccountId: accountId,
            authenticatedUserId: userId,
            sessionFound: Boolean(selectedSession),
            deriv_token_exists: Boolean(storedToken),
            tokenExpiry: selectedSession?.expires_at ?? null,
            tokenExpired,
            selectedAccountType,
            appIdMode,
            bodyToken: tokenLogValue(bodyAccessToken),
            storedToken: tokenLogValue(storedToken),
            bodyTokenMatchesStoredToken: Boolean(
              bodyAccessToken && storedToken && bodyAccessToken === storedToken,
            ),
          });

          if (!selectedSession || !storedToken || tokenExpired) {
            return sessionExpired({
              requestedAccountId: accountId,
              authenticatedUserId: userId,
              sessionFound: Boolean(selectedSession),
              derivTokenExists: Boolean(storedToken),
              tokenExpiry: selectedSession?.expires_at ?? null,
              selectedAccountType,
            });
          }

          if (bodyAccessToken && bodyAccessToken !== storedToken) {
            console.warn("[Deriv OTP API] stale client token ignored", {
              requestedAccountId: accountId,
              authenticatedUserId: userId,
              bodyToken: tokenLogValue(bodyAccessToken),
              storedToken: tokenLogValue(storedToken),
            });
          }

          if (!isLikelyDerivOAuthToken(storedToken)) {
            console.info("[Deriv OTP API] legacy token requires direct WebSocket authorization", {
              requestedAccountId: accountId,
              authenticatedUserId: userId,
              selectedAccountType,
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

          const appId = derivApiAppId("oauth");
          if (!appId) {
            return errorResponse("DERIV_APP_ID_MISSING", "Missing Deriv App ID.", 500);
          }

          console.info("[Deriv OTP API] request started", {
            endpoint: `https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`,
            requestedAccountId: accountId,
            authenticatedUserId: userId,
            sessionFound: true,
            deriv_token_exists: true,
            tokenExpiry: selectedSession.expires_at,
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
            authenticatedUserId: userId,
            status: otpResponse.status,
            ok: otpResponse.ok,
            responseWasJson: parsed.isJson,
            selectedAccountType,
          });

          if (otpResponse.status === 401 || otpResponse.status === 403) {
            return sessionExpired({
              requestedAccountId: accountId,
              authenticatedUserId: userId,
              selectedAccountType,
              otpStatus: otpResponse.status,
              responseWasJson: parsed.isJson,
            });
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
