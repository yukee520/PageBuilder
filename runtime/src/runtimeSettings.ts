import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * End-user settings for a generated APK. Persisted to AsyncStorage so they
 * survive app restarts. Stored per-project so multiple generated apps on
 * the same device don't clash.
 *
 * This is distinct from `project.json`, which contains the *creator's*
 * settings that ship inside the APK. `runtimeSettings` is the *end user's*
 * overrides, stored on their device only.
 */
export interface RuntimeSettings {
  /**
   * Whether background music should play. When false, BGM is suppressed on
   * every page even if the page was configured with it.
   */
  bgmEnabled: boolean;
}

export const DEFAULT_RUNTIME_SETTINGS: RuntimeSettings = {
  bgmEnabled: true,
};

const KEY_PREFIX = 'pb.runtimeSettings.';

function storageKey(projectId: string): string {
  return `${KEY_PREFIX}${projectId}`;
}

/**
 * Load the settings for a project. Returns defaults if nothing has been
 * saved yet, or if the stored value is corrupt.
 */
export async function loadRuntimeSettings(
  projectId: string,
): Promise<RuntimeSettings> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(projectId));
    if (!raw) return { ...DEFAULT_RUNTIME_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<RuntimeSettings>;
    return {
      bgmEnabled:
        typeof parsed.bgmEnabled === 'boolean'
          ? parsed.bgmEnabled
          : DEFAULT_RUNTIME_SETTINGS.bgmEnabled,
    };
  } catch {
    return { ...DEFAULT_RUNTIME_SETTINGS };
  }
}

/**
 * Persist the settings for a project.
 */
export async function saveRuntimeSettings(
  projectId: string,
  settings: RuntimeSettings,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      storageKey(projectId),
      JSON.stringify(settings),
    );
  } catch {
    // best-effort — a failed write means the setting won't persist, but the
    // in-memory state is still valid for the current session
  }
}

/**
 * Clear all persisted settings for a project. Useful for a "reset" action.
 */
export async function clearRuntimeSettings(projectId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(projectId));
  } catch {
    // best-effort
  }
}