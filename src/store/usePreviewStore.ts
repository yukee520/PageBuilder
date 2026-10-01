import { create } from 'zustand';
import type { OnboardingProgress, Page, Project } from '@/types/project';
import { DEFAULT_ONBOARDING_PROGRESS } from '@/types/project';

export interface PreviewStoreState {
  activePageId: string | null;
  history: string[];
  variables: Record<string, string>;
  hiddenComponentIds: Record<string, boolean>;
  onboardingProgress: OnboardingProgress;

  init: (
    project: Project,
    forcedStartPageId?: string | null,
    startFromScratch?: boolean,
  ) => void;
  goToPage: (pageId: string) => void;
  goBack: () => boolean;
  setVariable: (key: string, value: string) => void;
  clearVariables: () => void;
  toggleHidden: (componentId: string) => void;
  isHidden: (componentId: string) => boolean;

  advanceOnboarding: (project: Project) => void;
  completeOnboarding: (project: Project) => void;
  setOnboardingProgress: (progress: OnboardingProgress) => void;

  reset: () => void;
}

const INITIAL = {
  activePageId: null,
  history: [] as string[],
  variables: {} as Record<string, string>,
  hiddenComponentIds: {} as Record<string, boolean>,
  onboardingProgress: DEFAULT_ONBOARDING_PROGRESS,
};

function getOnboardingPages(project: Project): Page[] {
  return project.pages.filter(p => p.type === 'onboarding');
}

function getStartPageId(project: Project): string | null {
  const startPage = project.pages.find(p => p.id === project.startPageId);
  if (startPage && startPage.type === 'main') return startPage.id;
  const firstMain = project.pages.find(p => p.type === 'main');
  if (firstMain) return firstMain.id;
  return project.pages[0]?.id ?? null;
}

function resolveInitialPage(
  project: Project,
  progress: OnboardingProgress,
): string | null {
  if (progress.onboardingCompleted) {
    return getStartPageId(project);
  }

  const onboardingPages = getOnboardingPages(project);
  if (onboardingPages.length === 0) {
    return getStartPageId(project);
  }

  if (progress.lastOnboardingPageId) {
    const idx = onboardingPages.findIndex(
      p => p.id === progress.lastOnboardingPageId,
    );
    if (idx >= 0) return onboardingPages[idx].id;
  }

  return onboardingPages[0].id;
}

export const usePreviewStore = create<PreviewStoreState>((set, get) => ({
  ...INITIAL,

  init: (project, forcedStartPageId, startFromScratch = false) => {
    const progress = startFromScratch
      ? DEFAULT_ONBOARDING_PROGRESS
      : get().onboardingProgress;

    const initial = forcedStartPageId
      ? forcedStartPageId
      : resolveInitialPage(project, progress);

    set({
      activePageId: initial,
      history: [],
      variables: startFromScratch ? {} : get().variables,
      hiddenComponentIds: startFromScratch ? {} : get().hiddenComponentIds,
      onboardingProgress: progress,
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

  advanceOnboarding: project => {
    const { activePageId, onboardingProgress } = get();
    const onboardingPages = getOnboardingPages(project);
    if (onboardingPages.length === 0) {
      const start = getStartPageId(project);
      set({
        activePageId: start,
        history: activePageId ? [activePageId] : [],
      });
      return;
    }

    const currentIndex = onboardingPages.findIndex(p => p.id === activePageId);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= onboardingPages.length) {
      const start = getStartPageId(project);
      set({
        activePageId: start,
        history: activePageId ? [activePageId] : [],
        onboardingProgress: {
          onboardingCompleted: true,
          lastOnboardingPageId: null,
          completedAt: Date.now(),
        },
      });
      return;
    }

    const nextPage = onboardingPages[nextIndex];
    set({
      activePageId: nextPage.id,
      history: activePageId ? [...get().history, activePageId] : [],
      onboardingProgress: {
        ...onboardingProgress,
        lastOnboardingPageId: nextPage.id,
      },
    });
  },

  completeOnboarding: project => {
    const { activePageId } = get();
    const start = getStartPageId(project);
    set({
      activePageId: start,
      history: activePageId ? [activePageId] : [],
      onboardingProgress: {
        onboardingCompleted: true,
        lastOnboardingPageId: null,
        completedAt: Date.now(),
      },
    });
  },

  setOnboardingProgress: progress => {
    set({ onboardingProgress: progress });
  },

  reset: () => set({ ...INITIAL }),
}));