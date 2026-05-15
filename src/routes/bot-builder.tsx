import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BotBuilder } from "@/external/bot-builder/BotBuilder";
import { TopShell } from "@/components/top-shell";

const search = z.object({
  preset: z.string().optional(),
});

export const Route = createFileRoute("/bot-builder")({
  component: BotBuilderPage,
  validateSearch: search,
  ssr: false,
});

function BotBuilderPage() {
  const { preset } = Route.useSearch();
  return (
    <TopShell>
      <BotBuilder presetId={preset ?? null} />
    </TopShell>
  );
}
