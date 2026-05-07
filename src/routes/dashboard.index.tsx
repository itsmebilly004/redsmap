import { createFileRoute, redirect } from "@tanstack/react-router";

// The dark dashboard home has been replaced — users land on the Manual Traders
// page at "/" after login. Any direct /dashboard visit gets redirected there.
export const Route = createFileRoute("/dashboard/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});
