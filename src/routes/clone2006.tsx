import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SimulatedTradingProvider } from "@/context/simulated-trading-provider";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { TopShell } from "@/components/top-shell";

export const Route = createFileRoute("/clone2006")({
  component: TradingLayout,
});

function TradingLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { location } = useRouterState();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (location.pathname === "/clone2006/auth") {
      setIsAuthorized(true);
      return;
    }
    
    if (!loading && !user) {
      navigate({ to: "/clone2006/auth", search: { mode: "signin" } });
      return;
    }

    if (user) {
      supabase
        .from("users")
        .select("is_admin, is_clone_user")
        .eq("id", user.id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error("Error checking clone access:", error);
            setIsAuthorized(false);
          } else if (data && (data.is_admin || data.is_clone_user)) {
            setIsAuthorized(true);
          } else {
            setIsAuthorized(false);
          }
        });
    }
  }, [user, loading, location.pathname, navigate]);

  if (location.pathname === "/clone2006/auth") {
    return <Outlet />;
  }

  if (isAuthorized === null || loading) {
    return (
      <TopShell>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#4bb4b3] border-t-transparent" />
        </div>
      </TopShell>
    );
  }

  if (isAuthorized === false) {
    return (
      <TopShell>
        <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
          <h1 className="mb-2 text-2xl font-bold text-[#333] dark:text-[#eee]">Access Denied</h1>
          <p className="text-[#777] dark:text-[#aaa]">
            You do not have permission to access the Sandbox.
          </p>
        </div>
      </TopShell>
    );
  }

  return <Outlet />;
}
