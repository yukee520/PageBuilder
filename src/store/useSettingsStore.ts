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

  setGithubToken: (token: string) => void;
  setDefaultRepoName: (name: string) => void;
  setMakeRepoPrivate: (value: boolean) => void;
  setTemplate: (owner: string, repo: string) => void;
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

async function persist(state: PersistedShape): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // intentionally ignore persistence errors; UI will rehydrate on next launch
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  hydrated: false,

  setGithubToken: token => {
    set({ githubToken: token });
    const s = get();
    void persist({
      githubToken: token,
      defaultRepoName: s.defaultRepoName,
      makeRepoPrivate: s.makeRepoPrivate,
      templateOwner: s.templateOwner,
      templateRepo: s.templateRepo,
    });
  },

  setDefaultRepoName: name => {
    set({ defaultRepoName: name });
    const s = get();
    void persist({
      githubToken: s.githubToken,
      defaultRepoName: name,
      makeRepoPrivate: s.makeRepoPrivate,
      templateOwner: s.templateOwner,
      templateRepo: s.templateRepo,
    });
  },

  setMakeRepoPrivate: value => {
    set({ makeRepoPrivate: value });
    const s = get();
    void persist({
      githubToken: s.githubToken,
      defaultRepoName: s.defaultRepoName,
      makeRepoPrivate: value,
      templateOwner: s.templateOwner,
      templateRepo: s.templateRepo,
    });
  },

  setTemplate: (owner, repo) => {
    set({ templateOwner: owner, templateRepo: repo });
    const s = get();
    void persist({
      githubToken: s.githubToken,
      defaultRepoName: s.defaultRepoName,
      makeRepoPrivate: s.makeRepoPrivate,
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
    const s = get();
    await persist({
      githubToken: '',
      defaultRepoName: s.defaultRepoName,
      makeRepoPrivate: s.makeRepoPrivate,
      templateOwner: s.templateOwner,
      templateRepo: s.templateRepo,
    });
  },
}));