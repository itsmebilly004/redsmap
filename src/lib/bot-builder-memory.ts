import {
  clearCurrentBotPresetId,
  initialBotBuilderSettings,
  persistCurrentBotPresetId,
  persistCurrentBotSettings,
  persistPresetWorkspaceXml,
  readPresetWorkspaceXml,
  type BotBuilderSettings,
} from "@/lib/bot-builder-state";
import { writeRecentWorkspaceXml } from "@/external/bot-builder/recent-workspaces";
import {
  extractSettingsFromXmlText,
  sanitizeDbotXml,
  writeSavedWorkspaceXml,
} from "@/external/bot-builder/workspace-persistence";
import { TRADING_BOT_ASSETS } from "@/lib/trading-bot-database";
import { fetchBotXmlFromDatabase } from "@/lib/bot-xml-storage";

export type BuilderMemoryImport = {
  name: string;
  xml: string;
  /** Optional bot preset ID — when provided, previously saved user edits for this
   *  preset are restored instead of overwriting with the fresh deployment XML. */
  presetId?: string;
};

function normalizeXml(xml: string): string {
  return xml.replace(/^﻿/, "").trim();
}

function isBlocklyXml(xml: string): boolean {
  return /<xml[\s>]/i.test(xml) || /<block[\s>]/i.test(xml);
}

export async function importBotXmlIntoBuilderMemory(
  userId: string | null | undefined,
  input: BuilderMemoryImport,
): Promise<void> {
  // Sanitize first to fix any structural issues (e.g. tradeoptions in the
  // wrong Blockly chain) before validation so the check itself doesn't fail.
  const freshXml = sanitizeDbotXml(normalizeXml(input.xml));
  if (!isBlocklyXml(freshXml)) {
    throw new Error("The selected bot preset is not a Blockly XML strategy.");
  }

  // If a presetId is given, check whether the user already has edits for this
  // preset saved. If so, restore those instead of wiping them with the fresh
  // deployment XML — this preserves any block-level adjustments the user made.
  // Sanitize the saved XML too so any structurally-broken older snapshot does
  // not prevent the workspace from loading.
  let workspaceXml = freshXml;
  if (input.presetId && userId) {
    const savedUserXml = readPresetWorkspaceXml(userId, input.presetId);
    if (savedUserXml) {
      workspaceXml = sanitizeDbotXml(savedUserXml);
    }
  }

  if (input.presetId) {
    persistCurrentBotPresetId(userId, input.presetId);
    // Also seed the preset workspace store on first deploy so autosave can
    // update it (the store may be empty if the user never deployed before).
    if (!readPresetWorkspaceXml(userId, input.presetId)) {
      persistPresetWorkspaceXml(userId, input.presetId, freshXml);
    }
  } else {
    clearCurrentBotPresetId(userId);
    if (userId) clearCurrentBotPresetId(null);
  }

  writeSavedWorkspaceXml(userId, workspaceXml);
  await writeRecentWorkspaceXml(workspaceXml, input.name);
}

/**
 * Deploy a bot preset from the AI assistant with a custom opening stake and
 * martingale already applied. The XML is loaded from the database (same
 * source as the Trading Bot Presets page) so the builder memory is identical
 * to a manual deploy — then we overwrite the run-loop knobs in
 * `current-settings` so the next Run uses the AI's risk-sized values.
 *
 * Caller is responsible for navigating to /bot-builder after this resolves.
 */
export async function deployBotFromAiSuggestion(input: {
  martingale: number;
  presetId: string;
  stake: number;
  userId: string;
}): Promise<{ name: string }> {
  const asset = TRADING_BOT_ASSETS.find((item) => item.id === input.presetId);
  if (!asset) {
    throw new Error(`Bot preset "${input.presetId}" is not registered as a deployable asset.`);
  }

  const xml = await fetchBotXmlFromDatabase(input.presetId);
  await importBotXmlIntoBuilderMemory(input.userId, {
    name: asset.name,
    presetId: input.presetId,
    xml,
  });

  // Apply the AI-recommended stake & martingale on top of XML-derived defaults
  // so the bot-builder panel + footer Run both pick them up immediately.
  const baseSettings: BotBuilderSettings =
    extractSettingsFromXmlText(xml) ?? { ...initialBotBuilderSettings };
  const martingale = Math.max(1, input.martingale);
  const stake = Math.max(0.35, input.stake);
  persistCurrentBotSettings(
    input.userId,
    {
      ...baseSettings,
      martingale,
      maxStake: Math.max(baseSettings.maxStake, stake * Math.max(1, martingale) * 8),
      stake,
    },
    { presetId: input.presetId },
  );

  // Notify any already-mounted BotBuilder that the workspace XML on disk has
  // changed. Without this, a user who is already on /bot-builder sees the OLD
  // workspace because navigate() is a no-op on the same route and BotBuilder
  // only reads `readSavedWorkspaceXml` once at mount.
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(BOT_DEPLOYED_EVENT, {
        detail: { presetId: input.presetId, source: "ai-assistant" },
      }),
    );
  }

  return { name: asset.name };
}

export const BOT_DEPLOYED_EVENT = "arktrader:bot-deployed";

export type BotDeployedEventDetail = {
  presetId: string;
  source: "ai-assistant" | "trading-bots" | "manual";
};
