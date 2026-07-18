const DEPLOYED_PRESETS_STORAGE_VERSION = 1;

function deployedPresetStorageKey(userId?: string | null) {
  return `Redsmap:bot-builder:${userId ?? "guest"}:deployed-presets`;
}

export function readDeployedBotPresetIds(userId?: string | null) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(deployedPresetStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { ids?: unknown; version?: unknown };
    if (!Array.isArray(parsed.ids)) return [];
    return parsed.ids.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function markDeployedBotPresetId(userId: string | null | undefined, presetId: string) {
  if (typeof window === "undefined") return [];
  const ids = readDeployedBotPresetIds(userId);
  // Move redeployed presets to the end so `.at(-1)` always means "latest".
  const nextIds = [...ids.filter((id) => id !== presetId), presetId];
  try {
    window.localStorage.setItem(
      deployedPresetStorageKey(userId),
      JSON.stringify({
        ids: nextIds,
        savedAt: new Date().toISOString(),
        version: DEPLOYED_PRESETS_STORAGE_VERSION,
      }),
    );
  } catch {
    /* Local persistence is best effort. */
  }
  return nextIds;
}
