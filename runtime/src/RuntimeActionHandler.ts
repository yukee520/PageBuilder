import type { InteractionAction } from '../../src/types/action';
import type { Page, Project } from '../../src/types/project';
import type { OnboardingProgress } from './onboardingStorage';

export interface RuntimeState {
  activePageId: string | null;
  history: string[];
  variables: Record<string, string>;
  hiddenComponentIds: Record<string, boolean>;
  onboardingProgress: OnboardingProgress;
}

export interface RuntimeHandlers {
  project: Project;
  state: RuntimeState;
  setState: (updater: (prev: RuntimeState) => RuntimeState) => void;
  onPersistProgress: (progress: OnboardingProgress) => void;
  openUrl: (url: string) => void;
  showAlert: (title: string, message: string) => void;
  playVideo: (url: string) => void;
}

function onboardingPages(project: Project): Page[] {
  return project.pages.filter(p => p.type === 'onboarding');
}

function startPageId(project: Project): string | null {
  const start = project.pages.find(p => p.id === project.startPageId);
  if (start && start.type === 'main') return start.id;
  const firstMain = project.pages.find(p => p.type === 'main');
  if (firstMain) return firstMain.id;
  return project.pages[0]?.id ?? null;
}

export function resolveStartPage(
  project: Project,
  progress: OnboardingProgress,
): string | null {
  if (progress.onboardingCompleted) {
    return startPageId(project);
  }

  const pages = onboardingPages(project);
  if (pages.length === 0) {
    return startPageId(project);
  }

  if (progress.lastOnboardingPageId) {
    const idx = pages.findIndex(p => p.id === progress.lastOnboardingPageId);
    if (idx >= 0) return pages[idx].id;
  }

  return pages[0].id;
}

export function handleAction(
  action: InteractionAction,
  handlers: RuntimeHandlers,
): void {
  const {
    project,
    state,
    setState,
    onPersistProgress,
    openUrl,
    showAlert,
    playVideo,
  } = handlers;

  switch (action.type) {
    case 'navigate': {
      if (!action.pageId) return;
      const targetExists = project.pages.some(p => p.id === action.pageId);
      if (!targetExists) return;
      setState(prev => ({
        ...prev,
        history:
          prev.activePageId && prev.activePageId !== action.pageId
            ? [...prev.history, prev.activePageId]
            : prev.history,
        activePageId: action.pageId,
      }));
      break;
    }

    case 'openUrl':
      if (action.url) openUrl(action.url);
      break;

    case 'showAlert':
      showAlert(action.title || 'Notice', action.message || '');
      break;

    case 'playVideo':
      if (action.url) playVideo(action.url);
      break;

    case 'toggleVisibility':
      if (!action.targetComponentId) return;
      setState(prev => {
        const next = { ...prev.hiddenComponentIds };
        if (next[action.targetComponentId]) {
          delete next[action.targetComponentId];
        } else {
          next[action.targetComponentId] = true;
        }
        return { ...prev, hiddenComponentIds: next };
      });
      break;

    case 'setVariable':
      if (!action.key) return;
      setState(prev => ({
        ...prev,
        variables: { ...prev.variables, [action.key]: action.value },
      }));
      break;

    case 'goBack': {
      if (state.history.length === 0) return;
      setState(prev => {
        const history = [...prev.history];
        const previous = history.pop() ?? null;
        return { ...prev, activePageId: previous, history };
      });
      break;
    }

    case 'nextOnboarding': {
      const pages = onboardingPages(project);
      if (pages.length === 0) {
        const target = startPageId(project);
        const progress: OnboardingProgress = {
          onboardingCompleted: true,
          lastOnboardingPageId: null,
          completedAt: Date.now(),
        };
        setState(prev => ({
          ...prev,
          activePageId: target,
          history: prev.activePageId ? [...prev.history, prev.activePageId] : [],
          onboardingProgress: progress,
        }));
        onPersistProgress(progress);
        return;
      }

      const currentIndex = pages.findIndex(p => p.id === state.activePageId);
      const nextIndex = currentIndex + 1;

      if (nextIndex >= pages.length) {
        const target = startPageId(project);
        const progress: OnboardingProgress = {
          onboardingCompleted: true,
          lastOnboardingPageId: null,
          completedAt: Date.now(),
        };
        setState(prev => ({
          ...prev,
          activePageId: target,
          history: prev.activePageId
            ? [...prev.history, prev.activePageId]
            : [],
          onboardingProgress: progress,
        }));
        onPersistProgress(progress);
        return;
      }

      const nextPage = pages[nextIndex];
      const progress: OnboardingProgress = {
        ...state.onboardingProgress,
        lastOnboardingPageId: nextPage.id,
      };
      setState(prev => ({
        ...prev,
        activePageId: nextPage.id,
        history: prev.activePageId ? [...prev.history, prev.activePageId] : [],
        onboardingProgress: progress,
      }));
      onPersistProgress(progress);
      break;
    }

    case 'completeOnboarding': {
      const target = startPageId(project);
      const progress: OnboardingProgress = {
        onboardingCompleted: true,
        lastOnboardingPageId: null,
        completedAt: Date.now(),
      };
      setState(prev => ({
        ...prev,
        activePageId: target,
        history: prev.activePageId ? [...prev.history, prev.activePageId] : [],
        onboardingProgress: progress,
      }));
      onPersistProgress(progress);
      break;
    }

    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      break;
    }
  }
}