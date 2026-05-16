import {
  clearCurrentBotPresetId,
  initialBotBuilderSettings,
  persistCurrentBotSettings,
  type BotBuilderSettings,
} from "@/lib/bot-builder-state";
import { writeRecentWorkspaceXml } from "@/external/bot-builder/recent-workspaces";
import {
  extractSettingsFromXmlText,
  writeSavedWorkspaceXml,
} from "@/external/bot-builder/workspace-persistence";

export type BuilderMemoryImport = {
  name: string;
  xml: string;
};

function normalizeXml(xml: string): string {
  return xml.replace(/^\uFEFF/, "").trim();
}

function isBlocklyXml(xml: string): boolean {
  return /<xml[\s>]/i.test(xml) || /<block[\s>]/i.test(xml);
}

export async function importBotXmlIntoBuilderMemory(
  userId: string | null | undefined,
  input: BuilderMemoryImport,
): Promise<BotBuilderSettings> {
  const xml = normalizeXml(input.xml);
  if (!isBlocklyXml(xml)) {
    throw new Error("The selected bot preset is not a Blockly XML strategy.");
  }

  const settings = extractSettingsFromXmlText(xml) ?? { ...initialBotBuilderSettings };

  clearCurrentBotPresetId(userId);
  if (userId) clearCurrentBotPresetId(null);
  writeSavedWorkspaceXml(userId, xml);
  persistCurrentBotSettings(userId, settings);
  await writeRecentWorkspaceXml(xml, input.name);

  return settings;
}
