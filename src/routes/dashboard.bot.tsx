import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/bot")({
  beforeLoad: () => { throw redirect({ to: "/" }); },
  component: () => null,
});
