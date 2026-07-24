import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { DerivBalanceProvider } from "@/context/deriv-balance-context";
import { SimulatedTradingProvider } from "@/context/simulated-trading-provider";
import { BotRunnerProvider } from "@/context/bot-runner-context";

import appCss from "../styles.css?url";
import faviconUrl from "../assets/redsmap-favicon.jpeg?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground font-mono">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

import { supabase } from "@/integrations/supabase/client";
import { setDynamicAppIds } from "@/lib/deriv-config";

export const Route = createRootRoute({
  beforeLoad: async () => {
    try {
      const { data } = await supabase.from("site_settings").select("key, value");
      if (data) {
        let legacyId = "";
        let oauthId = "";
        data.forEach((row) => {
          if (row.key === "deriv_legacy_app_id") legacyId = row.value;
          if (row.key === "deriv_oauth_app_id") oauthId = row.value;
        });
        setDynamicAppIds(legacyId, oauthId);
      }
    } catch (err) {
      console.warn("Failed to load site settings:", err);
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Redsmap Traders — Trade Smarter with Automation" },
      {
        name: "description",
        content:
          "Redsmap Traders is a third-party trading platform for Deriv. Trade synthetic indices, automate strategies, and stay in control of risk.",
      },
      { name: "author", content: "Redsmap Traders" },
      { property: "og:title", content: "Redsmap Traders — Trade Smarter with Automation" },
      {
        property: "og:description",
        content:
          "Connect your Deriv account to a high-performance terminal with bots, analytics, and built-in risk controls.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/jpeg", href: faviconUrl },
      { rel: "apple-touch-icon", href: faviconUrl },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

const THEME_INIT_SCRIPT = `
(function(){try{
  var t = localStorage.getItem('Redsmap-theme');
  if (t !== 'dark' && t !== 'light') t = 'light';
  var r = document.documentElement;
  r.classList.toggle('dark', t === 'dark');
  r.dataset.theme = t;
  r.style.colorScheme = t;
}catch(e){}})();
`;

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const isClone = useRouterState({ select: (s) => s.location.pathname.startsWith("/clone2006") });

  const Provider = isClone ? SimulatedTradingProvider : DerivBalanceProvider;

  return (
    <Provider>
      <BotRunnerProvider>
        <Outlet />
      </BotRunnerProvider>
    </Provider>
  );
}
