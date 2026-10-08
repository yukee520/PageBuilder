import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@pagebuilder/settings';

export interface SettingsState {
  githubToken: string;
  defaultRepoName: string;
  makeRepoPrivate: boolean;
  templateOwner: string;
  templateRepo: string;
  hydrated: boolean;

  setGithubToken: (token: string) => Promise<void>;
  setDefaultRepoName: (name: string) => Promise<void>;
  setMakeRepoPrivate: (value: boolean) => Promise<void>;
  setTemplate: (owner: string, repo: string) => Promise<void>;
  hydrate: () => Promise<void>;
  clearGithubToken: () => Promise<void>;
}

interface PersistedShape {
  githubToken: string;
  defaultRepoName: string;
  makeRepoPrivate: boolean;
  templateOwner: string;
  templateRepo: string;
}

const DEFAULTS: PersistedShape = {
  githubToken: '',
  defaultRepoName: '',
  makeRepoPrivate: true,
  templateOwner: 'yukee520',
  templateRepo: 'rn-blank-template',
};

/**
 * Persist settings to AsyncStorage.
 *
 * Errors are re-thrown so callers can surface them to the user. Silent
 * persistence failures are worse than noisy ones: the in-memory state
 * appears correct, but a relaunch brings back the old value — which
 * looks like "the app ignored my change".
 */
async function persist(state: PersistedShape): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    throw err instanceof Error
      ? err
      : new Error('Could not save settings.');
  }
}

function snapshot(s: SettingsState): PersistedShape {
  return {
    githubToken: s.githubToken,
    defaultRepoName: s.defaultRepoName,
    makeRepoPrivate: s.makeRepoPrivate,
    templateOwner: s.templateOwner,
    templateRepo: s.templateRepo,
  };
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  hydrated: false,

  setGithubToken: async token => {
    set({ githubToken: token });
    await persist({ ...snapshot(get()), githubToken: token });
  },

  setDefaultRepoName: async name => {
    set({ defaultRepoName: name });
    await persist({ ...snapshot(get()), defaultRepoName: name });
  },

  setMakeRepoPrivate: async value => {
    set({ makeRepoPrivate: value });
    await persist({ ...snapshot(get()), makeRepoPrivate: value });
  },

  setTemplate: async (owner, repo) => {
    set({ templateOwner: owner, templateRepo: repo });
    await persist({
      ...snapshot(get()),
      templateOwner: owner,
      templateRepo: repo,
    });
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        set({
          githubToken: parsed.githubToken ?? DEFAULTS.githubToken,
          defaultRepoName: parsed.defaultRepoName ?? DEFAULTS.defaultRepoName,
          makeRepoPrivate: parsed.makeRepoPrivate ?? DEFAULTS.makeRepoPrivate,
          templateOwner: parsed.templateOwner ?? DEFAULTS.templateOwner,
          templateRepo: parsed.templateRepo ?? DEFAULTS.templateRepo,
          hydrated: true,
        });
        return;
      }
      set({ hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  clearGithubToken: async () => {
    set({ githubToken: '' });
    await persist({ ...snapshot(get()), githubToken: '' });
  },
}));