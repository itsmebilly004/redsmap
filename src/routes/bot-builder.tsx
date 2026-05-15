import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BotBuilder } from "@/external/bot-builder/BotBuilder";

const search = z.object({
  preset: z.string().optional(),
});

export const Route = createFileRoute("/bot-builder")({
  component: BotBuilderPage,
  validateSearch: search,
  ssr: false,
});

function BotBuilderPage() {
  return <BotBuilder />;
}
