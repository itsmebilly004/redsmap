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
  applyRunSettingsToBotXml,
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
  /** When true, the provided XML is authoritative: any previously saved user edits
   *  for this preset are overwritten (used by the AI assistant so freshly-tuned
   *  run-loop values are never shadowed by a stale saved workspace). */
  force?: boolean;
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
  if (input.presetId && userId && !input.force) {
    const savedUserXml = readPresetWorkspaceXml(userId, input.presetId);
    if (savedUserXml) {
      workspaceXml = sanitizeDbotXml(savedUserXml);
    }
  }

  if (input.presetId) {
    persistCurrentBotPresetId(userId, input.presetId);
    // On a forced import the fresh XML is authoritative — overwrite any stale saved
    // workspace so re-deploying the same preset keeps the new run-loop values.
    // Otherwise only seed the store on first deploy so autosave can update it.
    if (input.force || !readPresetWorkspaceXml(userId, input.presetId)) {
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
  maxRuns?: number;
  presetId: string;
  stake: number;
  stopLoss?: number;
  takeProfit?: number;
  userId: string;
}): Promise<{ name: string }> {
  const asset = TRADING_BOT_ASSETS.find((item) => item.id === input.presetId);
  if (!asset) {
    throw new Error(`Bot preset "${input.presetId}" is not registered as a deployable asset.`);
  }

  const martingale = Math.max(1, input.martingale);
  const stake = Math.max(0.35, input.stake);
  const stopLoss = input.stopLoss != null ? Math.max(0, input.stopLoss) : undefined;
  const takeProfit = input.takeProfit != null ? Math.max(0, input.takeProfit) : undefined;
  const maxRuns =
    input.maxRuns != null ? Math.max(1, Math.round(input.maxRuns)) : undefined;

  const rawXml = await fetchBotXmlFromDatabase(input.presetId);
  // Inject the user's run-loop values into the XML's INITIALIZATION literals so
  // the DBot runtime actually runs with them — the panel/run-loop re-read these
  // variables, so setting `current-settings` alone is not enough (XML wins).
  const xml = applyRunSettingsToBotXml(rawXml, { martingale, stake, stopLoss, takeProfit });
  await importBotXmlIntoBuilderMemory(input.userId, {
    force: true,
    name: asset.name,
    presetId: input.presetId,
    xml,
  });

  // Apply the user's stake & martingale on top of XML-derived defaults so the
  // bot-builder panel + footer Run both pick them up immediately.
  const baseSettings: BotBuilderSettings =
    extractSettingsFromXmlText(xml) ?? { ...initialBotBuilderSettings };
  persistCurrentBotSettings(
    input.userId,
    {
      ...baseSettings,
      martingale,
      maxRuns: maxRuns ?? baseSettings.maxRuns,
      maxStake: Math.max(baseSettings.maxStake, stake * Math.max(1, martingale) * 8),
      stake,
      stopLoss: stopLoss ?? baseSettings.stopLoss,
      takeProfit: takeProfit ?? baseSettings.takeProfit,
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
