import { create } from 'zustand';

export interface PreviewStoreState {
  activePageId: string | null;
  history: string[];
  variables: Record<string, string>;
  hiddenComponentIds: Record<string, boolean>;

  init: (startPageId: string | null) => void;
  goToPage: (pageId: string) => void;
  goBack: () => boolean;
  setVariable: (key: string, value: string) => void;
  clearVariables: () => void;
  toggleHidden: (componentId: string) => void;
  isHidden: (componentId: string) => boolean;
  reset: () => void;
}

const INITIAL: Pick<
  PreviewStoreState,
  'activePageId' | 'history' | 'variables' | 'hiddenComponentIds'
> = {
  activePageId: null,
  history: [],
  variables: {},
  hiddenComponentIds: {},
};

export const usePreviewStore = create<PreviewStoreState>((set, get) => ({
  ...INITIAL,

  init: startPageId => {
    set({
      activePageId: startPageId,
      history: [],
      variables: {},
      hiddenComponentIds: {},
    });
  },

  goToPage: pageId => {
    const { activePageId, history } = get();
    if (activePageId === pageId) return;
    set({
      activePageId: pageId,
      history: activePageId ? [...history, activePageId] : history,
    });
  },

  goBack: () => {
    const { history } = get();
    if (history.length === 0) return false;
    const next = [...history];
    const previous = next.pop() ?? null;
    set({ activePageId: previous, history: next });
    return true;
  },

  setVariable: (key, value) => {
    set(state => ({
      variables: { ...state.variables, [key]: value },
    }));
  },

  clearVariables: () => {
    set({ variables: {} });
  },

  toggleHidden: componentId => {
    set(state => {
      const next = { ...state.hiddenComponentIds };
      if (next[componentId]) {
        delete next[componentId];
      } else {
        next[componentId] = true;
      }
      return { hiddenComponentIds: next };
    });
  },

  isHidden: componentId => {
    return Boolean(get().hiddenComponentIds[componentId]);
  },

  reset: () => set({ ...INITIAL }),
}));