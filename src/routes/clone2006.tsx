import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { SimulatedTradingProvider } from "@/context/simulated-trading-provider";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/clone2006")({
  component: TradingLayout,
});

function TradingLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { location } = useRouterState();

  useEffect(() => {
    if (location.pathname === "/clone2006/auth") return;
    if (!loading && !user) {
      navigate({ to: "/clone2006/auth", search: { mode: "signin" } });
    }
  }, [user, loading, location.pathname, navigate]);

  return <Outlet />;
}
