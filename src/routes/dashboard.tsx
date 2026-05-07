import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

// The dashboard section has been consolidated — all trading happens on the
// root "/" route using the top-tab navigation. Any direct /dashboard visit
// (or any /dashboard/* sub-route) is redirected to the main page.
export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => <Outlet />,
});
