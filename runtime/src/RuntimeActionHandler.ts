import type { InteractionAction } from '../../src/types/action';
import type { Project } from '../../src/types/project';

export interface RuntimeState {
  activePageId: string | null;
  history: string[];
  variables: Record<string, string>;
  hiddenComponentIds: Record<string, boolean>;
}

export interface RuntimeHandlers {
  project: Project;
  state: RuntimeState;
  setState: (updater: (prev: RuntimeState) => RuntimeState) => void;
  openUrl: (url: string) => void;
  showAlert: (title: string, message: string) => void;
  playVideo: (url: string) => void;
}

export function handleAction(
  action: InteractionAction,
  handlers: RuntimeHandlers,
): void {
  const { project, state, setState, openUrl, showAlert, playVideo } = handlers;

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

    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      break;
    }
  }
}