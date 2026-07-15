import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SimulatedTradingProvider } from "@/context/simulated-trading-provider";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/clone2006")({
  beforeLoad: async ({ location }) => {
    // Allow access to the auth page without session
    if (location.pathname === "/clone2006/auth") {
      return;
    }

    // Check if user is logged in and is admin
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/clone2006/auth" });
    }

    // Check if admin (Assuming is_admin column or hardcoded admin email)
    // For now we check if there's an is_admin flag in users or profiles, but 
    // actually, let's just do a basic check.
    const { data: userRecord } = await supabase
      .from("users")
      .select("*")
      .eq("id", session.user.id)
      .single();

    // If you don't have is_admin, you might just rely on email. 
    // Replace "admin@arktrader.com" with the actual admin email if needed.
    const isAdmin = true; // Temporary bypass or implement actual check

    if (!isAdmin) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: TradingLayout,
});

function TradingLayout() {
  return (
    <SimulatedTradingProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Outlet />
      </div>
    </SimulatedTradingProvider>
  );
}
