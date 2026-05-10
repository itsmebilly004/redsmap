import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  DERIV_OAUTH_ENDPOINT_VALUE,
  buildOAuthUrl,
  redirectToDerivOAuth,
  type DerivOAuthAppIdMode,
} from "@/lib/deriv";
import { ArrowRight, ShieldCheck } from "lucide-react";

const search = z.object({
  mode: z.enum(["signin", "signup"]).catch("signin"),
  debug_oauth: z.union([z.literal("1"), z.literal(1)]).optional(),
});

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
  const [oauthAppIdMode, setOauthAppIdMode] = useState<DerivOAuthAppIdMode>(() => {
    if (typeof window === "undefined") return "client_id_app_id";
    return localStorage.getItem("deriv_oauth_app_id_mode") === "client_id_only"
      ? "client_id_only"
      : "client_id_app_id";
  });

  const isSignup = mode === "signup";
  const showOAuthDebug = import.meta.env.DEV || String(debug_oauth ?? "") === "1";

  async function handleDeriv() {
    setBusy(true);
    setErrorMessage(null);
    setDebugUrl(null);
    try {
      if (showOAuthDebug) localStorage.setItem("deriv_oauth_app_id_mode", oauthAppIdMode);
      const url = await buildOAuthUrl({
        appIdMode: showOAuthDebug ? oauthAppIdMode : undefined,
        mode,
        returnTo: "/dashboard",
      });
      console.info("[Deriv OAuth Debug] Exact final URL before redirect", url);
      if (showOAuthDebug) {
        setDebugUrl(url);
      } else {
        redirectToDerivOAuth(url);
      }
    } catch (error) {
      console.error("Could not build Deriv OAuth URL", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not start Deriv OAuth. Check the configured client_id and app_id.",
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
            {busy
              ? "Connecting to Deriv..."
              : isSignup
                ? "Sign up with Deriv"
                : "Sign in with Deriv"}
            <ArrowRight className="ml-1 size-4" />
          </Button>

          {showOAuthDebug && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-background/80 p-3 text-xs">
              <div className="mb-2 font-semibold text-foreground">Deriv OAuth debug</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem("deriv_oauth_app_id_mode", "client_id_only");
                    setOauthAppIdMode("client_id_only");
                    setDebugUrl(null);
                  }}
                  className={`rounded-md border px-2 py-1.5 ${
                    oauthAppIdMode === "client_id_only"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  client_id only
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem("deriv_oauth_app_id_mode", "client_id_app_id");
                    setOauthAppIdMode("client_id_app_id");
                    setDebugUrl(null);
                  }}
                  className={`rounded-md border px-2 py-1.5 ${
                    oauthAppIdMode === "client_id_app_id"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  client_id + app_id
                </button>
              </div>
              <div className="mt-3 space-y-1 text-muted-foreground">
                <div>
                  Expected endpoint:{" "}
                  <span className="font-mono text-foreground">{DERIV_OAUTH_ENDPOINT_VALUE}</span>
                </div>
                <div>Selected mode: {oauthAppIdMode}</div>
              </div>
              {debugUrl && (
                <div className="mt-3 space-y-2">
                  <div className="break-all rounded-md bg-muted p-2 font-mono text-[11px] text-foreground">
                    {debugUrl}
                  </div>
                  <Button onClick={continueToDeriv} className="h-10 w-full">
                    Continue to Deriv
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
