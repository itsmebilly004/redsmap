import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { buildOAuthUrl } from "@/lib/deriv";
import { ArrowRight, ShieldCheck } from "lucide-react";

const search = z.object({
  mode: z.enum(["signin", "signup"]).catch("signin"),
});

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: search,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  async function handleDeriv() {
    setBusy(true);
    try {
      const url = await buildOAuthUrl({ mode, returnTo: "/dashboard" });
      console.info("[Deriv OAuth] Sign in button redirecting to authorization URL", url);
      window.location.href = url;
    } catch (error) {
      console.error("Could not build Deriv OAuth URL", error);
      setBusy(false);
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
