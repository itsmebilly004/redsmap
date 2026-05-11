import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  DERIV_OAUTH_ENDPOINT_VALUE,
  buildOAuthUrl,
  getDerivOAuthRedirectFailure,
  getDerivOAuthDiagnostics,
  redirectToDerivOAuth,
  type DerivOAuthRedirectFailure,
  type DerivOAuthDiagnostics,
} from "@/lib/deriv";
import { ArrowRight, ShieldCheck } from "lucide-react";

const search = z.object({
  mode: z.enum(["signin", "signup"]).catch("signin"),
  debug_oauth: z.union([z.literal("1"), z.literal(1)]).optional(),
});

const DERIV_RAPID_APPROVAL_MESSAGE = "Please wait one minute and try again.";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: search,
});

function AuthPage() {
  const { debug_oauth, mode } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<string | null>(null);
  const [debugUrl, setDebugUrl] = useState<string | null>(null);
  const [oauthFailure, setOauthFailure] = useState<DerivOAuthRedirectFailure | null>(null);
  const [oauthDiagnostics, setOauthDiagnostics] = useState<DerivOAuthDiagnostics | null>(null);

  const isSignup = mode === "signup";
  const showOAuthDebug = String(debug_oauth ?? "") === "1";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkDashboardRedirectReturn = () => {
      const attemptedAt = sessionStorage.getItem("deriv_oauth_started_at");
      if (!attemptedAt) return;
      const rapidApprovalUrl =
        getDerivLegacyApprovalUrl(window.location.href) ??
        getDerivLegacyApprovalUrl(document.referrer);
      if (rapidApprovalUrl) {
        setOauthFailure(null);
        setErrorMessage(DERIV_RAPID_APPROVAL_MESSAGE);
        console.warn("[Deriv OAuth] Deriv reported rapid repeated approval", {
          url: rapidApprovalUrl,
          attemptedAt,
        });
        return;
      }
      const failure =
        getDerivOAuthRedirectFailure(window.location.href) ??
        getDerivOAuthRedirectFailure(document.referrer);
      if (!failure) return;
      setOauthFailure(failure);
      setErrorMessage(failure.message);
      console.warn("[Deriv OAuth] Authorization flow returned from non-OAuth Deriv route", {
        reason: failure.reason,
        url: failure.url,
        attemptedAt,
      });
    };
    checkDashboardRedirectReturn();
    window.addEventListener("pageshow", checkDashboardRedirectReturn);
    window.addEventListener("focus", checkDashboardRedirectReturn);
    return () => {
      window.removeEventListener("pageshow", checkDashboardRedirectReturn);
      window.removeEventListener("focus", checkDashboardRedirectReturn);
    };
  }, []);

  async function handleDeriv() {
    setBusy(true);
    setErrorMessage(null);
    setOauthFailure(null);
    setDebugUrl(null);
    setOauthDiagnostics(null);
    try {
      const url = await buildOAuthUrl({
        debug: showOAuthDebug,
        mode,
        returnTo: "/dashboard",
      });
      const diagnostics = getDerivOAuthDiagnostics(url);
      if (showOAuthDebug) {
        console.info("[Deriv OAuth Debug] Exact final URL before redirect", url);
        console.info("[Deriv OAuth Debug] OAuth diagnostics", diagnostics);
        setDebugUrl(url);
        setOauthDiagnostics(diagnostics);
      } else {
        redirectToDerivOAuth(url);
      }
    } catch (error) {
      console.error("Could not build Deriv OAuth URL", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not start Deriv OAuth. Check the configured client_id.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function clearRuntimeCaches() {
    if (typeof window === "undefined") return;
    setCacheStatus("Checking browser cache...");
    const registrations =
      "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistrations() : [];
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const cacheKeys = "caches" in window ? await caches.keys() : [];
    await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    setCacheStatus(
      `Cleared ${registrations.length} service worker registration(s) and ${cacheKeys.length} cache bucket(s).`,
    );
  }

  function continueToDeriv() {
    if (!debugUrl) return;
    try {
      console.info("[Deriv OAuth Debug] Redirecting to exact URL", debugUrl);
      redirectToDerivOAuth(debugUrl);
    } catch (error) {
      console.error("Could not redirect to Deriv OAuth URL", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not redirect to Deriv OAuth.",
      );
    }
  }

  return (
    <div className="relative grid min-h-dvh overflow-hidden px-3 py-8 sm:place-items-center sm:px-4 sm:py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 left-1/2 size-80 -translate-x-1/2 rounded-full bg-primary/10 blur-[120px] sm:size-[500px] sm:blur-[140px]" />
      </div>
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
          <div className="size-7 rotate-45 rounded-sm bg-primary" />
          <span className="text-lg font-semibold tracking-tight">ArkTrader Hub</span>
        </Link>

        <div className="glass-card rounded-2xl p-5 sm:p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
            <ShieldCheck className="size-3.5" /> Official Deriv OAuth
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isSignup
              ? "You'll be redirected to Deriv to register, then sent straight back to your dashboard."
              : "Continue with the Deriv account you already use to trade — no passwords stored here."}
          </p>

          <Button
            onClick={handleDeriv}
            size="lg"
            disabled={busy}
            className="mt-6 h-12 w-full text-base shadow-[0_0_30px_-5px_oklch(0.78_0.16_230_/_0.5)]"
          >
            {busy ? "Connecting to Deriv..." : "Sign in with Deriv"}
            <ArrowRight className="ml-1 size-4" />
          </Button>

          {showOAuthDebug && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-background/80 p-3 text-xs">
              <div className="mb-2 font-semibold text-foreground">Deriv OAuth debug</div>
              <div className="mt-3 space-y-1 text-muted-foreground">
                <div>
                  Expected endpoint:{" "}
                  <span className="font-mono text-foreground">{DERIV_OAUTH_ENDPOINT_VALUE}</span>
                </div>
                <div>OAuth mode: client_id-only OAuth2 PKCE</div>
                <div>Legacy app_id: not used</div>
                <div>Legacy Deriv users are handled by the OAuth2 client_id infrastructure.</div>
              </div>
              {debugUrl && (
                <div className="mt-3 space-y-2">
                  <div className="break-all rounded-md bg-muted p-2 font-mono text-[11px] text-foreground">
                    {debugUrl}
                  </div>
                  <Button onClick={continueToDeriv} className="h-10 w-full">
                    Continue to Deriv authorization
                  </Button>
                </div>
              )}
              <button
                type="button"
                onClick={() => void clearRuntimeCaches()}
                className="mt-3 text-primary hover:underline"
              >
                Clear service worker/cache for this site
              </button>
              {cacheStatus && <div className="mt-2 text-muted-foreground">{cacheStatus}</div>}
            </div>
          )}

          {showOAuthDebug && oauthDiagnostics && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-background/80 p-3 text-xs">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="font-semibold text-foreground">Deriv OAuth validation</div>
                <span
                  className={`rounded-full px-2 py-0.5 font-semibold ${
                    oauthValidationPassed(oauthDiagnostics)
                      ? "bg-success/15 text-success"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {oauthValidationPassed(oauthDiagnostics) ? "Valid URL" : "Invalid URL"}
                </span>
              </div>

              <div className="space-y-1.5">
                {oauthValidationRows(oauthDiagnostics).map((row) => (
                  <div
                    key={row.label}
                    className="grid gap-1 rounded-md border border-border/70 bg-background/50 p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{row.label}</span>
                      <span
                        className={
                          row.ok
                            ? "font-semibold text-success"
                            : row.warning
                              ? "font-semibold text-amber-600"
                              : "font-semibold text-destructive"
                        }
                      >
                        {row.ok ? "PASS" : row.warning ? "CHECK" : "FAIL"}
                      </span>
                    </div>
                    <div className="break-all font-mono text-[11px] text-muted-foreground">
                      {row.actual}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Expected: {row.expected}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-md border border-border/70 bg-background/60 p-2">
                <div className="mb-1 font-semibold text-foreground">Production env snapshot</div>
                <div className="space-y-1 break-all font-mono text-[11px] text-muted-foreground">
                  <div>
                    OAuth app_id query param included: {oauthDiagnostics.hasAppId ? "yes" : "no"}
                  </div>
                  <div>Expected app_id query param: absent</div>
                </div>
              </div>

              <div className="mt-3 break-all rounded-md bg-muted p-2 font-mono text-[11px] text-foreground">
                {oauthDiagnostics.finalUrl}
              </div>

              <div className="mt-3 rounded-md border border-amber-300/50 bg-amber-50 p-2 text-[11px] text-amber-900">
                If Deriv sends this validated URL to app.deriv.com or
                home.deriv.com/dashboard/login, Deriv rejected the OAuth authorization route for
                that account or OAuth app configuration.
              </div>

              {oauthFailure && (
                <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">
                  <div className="font-semibold">{oauthFailure.message}</div>
                  <div className="mt-1 break-all font-mono">{oauthFailure.url}</div>
                </div>
              )}

              <Button
                onClick={continueToDeriv}
                disabled={!oauthValidationPassed(oauthDiagnostics)}
                className="mt-3 h-10 w-full"
              >
                Continue to Deriv authorization
              </Button>
            </div>
          )}

          {errorMessage && (
            <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          )}

          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="mt-1 size-1 shrink-0 rounded-full bg-primary" />
              You authenticate on <span className="text-foreground">deriv.com</span> directly.
            </li>
            <li className="flex gap-2">
              <span className="mt-1 size-1 shrink-0 rounded-full bg-primary" />
              ArkTrader receives a trading token only — never your password.
            </li>
            <li className="flex gap-2">
              <span className="mt-1 size-1 shrink-0 rounded-full bg-primary" />
              Demo and live accounts both supported. Demo is selected by default.
            </li>
          </ul>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignup ? "Already have a Deriv account?" : "New to Deriv?"}{" "}
            <Link
              to="/auth"
              search={{ mode: isSignup ? "signin" : "signup" }}
              className="text-primary hover:underline"
            >
              {isSignup ? "Sign in" : "Sign up"}
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to trade at your own risk. ArkTrader Hub is an independent
          third-party interface for the Deriv API.
        </p>
      </div>
    </div>
  );
}

function oauthValidationPassed(diagnostics: DerivOAuthDiagnostics) {
  return oauthValidationRows(diagnostics).every((row) => row.ok || row.warning);
}

function oauthValidationRows(diagnostics: DerivOAuthDiagnostics) {
  return [
    {
      label: "endpoint",
      actual: diagnostics.endpoint,
      expected: "https://auth.deriv.com/oauth2/auth",
      ok: diagnostics.endpoint === "https://auth.deriv.com/oauth2/auth",
    },
    {
      label: "response_type",
      actual: diagnostics.responseType || "(missing)",
      expected: "code",
      ok: diagnostics.responseType === "code",
    },
    {
      label: "client_id",
      actual: diagnostics.clientId || "(missing)",
      expected: "Configured OAuth app Client ID from Deriv Partners, not undefined/null",
      ok: diagnostics.clientIdIsConfigured && diagnostics.clientIdLooksDefined,
      warning: diagnostics.clientIdIsConfigured && diagnostics.clientIdLooksDefined,
    },
    {
      label: "app_id param",
      actual: diagnostics.appId ?? "(absent)",
      expected: "absent; OAuth2 authorization uses client_id only",
      ok: !diagnostics.hasAppId,
    },
    {
      label: "redirect_uri",
      actual: diagnostics.decodedRedirectUri || "(missing)",
      expected: "https://www.arktradershub.com/deriv-callback",
      ok: diagnostics.redirectUriMatchesRegisteredUrl,
    },
    {
      label: "scope",
      actual: diagnostics.scopes || "(missing)",
      expected: "trade account_manage",
      ok: diagnostics.scopes === "trade account_manage",
    },
    {
      label: "state",
      actual: diagnostics.state ? `${diagnostics.state.slice(0, 8)}...` : "(missing)",
      expected: "present",
      ok: Boolean(diagnostics.state),
    },
    {
      label: "code_challenge",
      actual: diagnostics.codeChallenge
        ? `${diagnostics.codeChallenge.slice(0, 12)}...`
        : "(missing)",
      expected: "present",
      ok: Boolean(diagnostics.codeChallenge),
    },
    {
      label: "code_challenge_method",
      actual: diagnostics.codeChallengeMethod || "(missing)",
      expected: "S256",
      ok: diagnostics.codeChallengeMethod === "S256",
    },
    {
      label: "redirect_uri encoding",
      actual: diagnostics.hasDoubleEncodedRedirectUri
        ? "double-encoded"
        : "normal URLSearchParams encoding",
      expected: "encoded once in the final URL",
      ok: !diagnostics.hasDoubleEncodedRedirectUri,
    },
    {
      label: "legacy OAuth host",
      actual: diagnostics.hasOAuthDerivHost ? "oauth.deriv.com present" : "absent",
      expected: "absent",
      ok: !diagnostics.hasOAuthDerivHost,
    },
    {
      label: "legacy authorize path",
      actual: diagnostics.hasLegacyAuthorizeEndpoint ? "/oauth2/authorize present" : "absent",
      expected: "absent",
      ok: !diagnostics.hasLegacyAuthorizeEndpoint,
    },
    {
      label: "app.deriv.com dashboard",
      actual: diagnostics.hasAppDerivDashboardRedirect ? "app.deriv.com present" : "absent",
      expected: "absent",
      ok: !diagnostics.hasAppDerivDashboardRedirect,
    },
    {
      label: "home dashboard login",
      actual: diagnostics.hasHomeDashboardLoginRedirect
        ? "home.deriv.com/dashboard/login present"
        : "absent",
      expected: "absent",
      ok: !diagnostics.hasHomeDashboardLoginRedirect,
    },
    {
      label: "redirect=home",
      actual: diagnostics.hasRedirectHome ? "present" : "absent",
      expected: "absent",
      ok: !diagnostics.hasRedirectHome,
    },
    {
      label: "brand=deriv",
      actual: diagnostics.hasBrandDeriv ? "present" : "absent",
      expected: "absent",
      ok: !diagnostics.hasBrandDeriv,
    },
  ];
}

function getDerivLegacyApprovalUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.origin === "https://oauth.deriv.com" && parsed.pathname === "/oauth2/authorize") {
      return url;
    }
  } catch {
    return null;
  }
  return null;
}
