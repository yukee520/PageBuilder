import type { InteractionAction } from '@/types/action';
import type { ComponentType, PageComponent } from '@/types/component';
import type { Page, Project } from '@/types/project';
import { PROJECT_FILE_VERSION } from '@/types/project';
import {
  generateActionId,
  generateComponentId,
  generatePageId,
  generateProjectId,
  generateVariableKey,
} from '@/utils/id';
import { sanitizePackageName, sanitizeRepoName } from '@/utils/format';

export function createEmptyPage(title: string): Page {
  return {
    id: generatePageId(),
    title,
    components: [],
  };
}

export function createProject(name: string): Project {
  const now = Date.now();
  const firstPage = createEmptyPage('Home');
  const packageBase = sanitizeRepoName(name).replace(/-/g, '');
  return {
    id: generateProjectId(),
    name,
    packageName: sanitizePackageName(`com.pagebuilder.${packageBase || 'app'}`),
    version: '1.0.0',
    startPageId: firstPage.id,
    pages: [firstPage],
    createdAt: now,
    updatedAt: now,
  };
}

export function createComponent(
  type: ComponentType,
  overrideId?: string,
): PageComponent {
  const id = overrideId ?? generateComponentId();
  const base = { id, actions: [] as InteractionAction[], visible: true };

  switch (type) {
    case 'text':
      return {
        ...base,
        type: 'text',
        content: 'Hello world',
        fontSize: 'medium',
        align: 'left',
        bold: false,
        color: null,
      };
    case 'image':
      return {
        ...base,
        type: 'image',
        uri: '',
        size: 'full',
        rounded: true,
      };
    case 'video':
      return {
        ...base,
        type: 'video',
        url: '',
        autoPlay: false,
      };
    case 'button':
      return {
        ...base,
        type: 'button',
        label: 'Tap me',
        size: 'medium',
        align: 'center',
        variant: 'primary',
      };
    case 'spacer':
      return {
        ...base,
        type: 'spacer',
        size: 'medium',
      };
    case 'divider':
      return {
        ...base,
        type: 'divider',
        thickness: 'thin',
      };
    case 'row':
      return {
        ...base,
        type: 'row',
        children: [],
        gap: 'medium',
      };
    case 'input':
      return {
        ...base,
        type: 'input',
        placeholder: 'Enter text',
        variableKey: generateVariableKey(),
      };
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unsupported component type: ${String(_exhaustive)}`);
    }
  }
}

export function createAction(type: InteractionAction['type']): InteractionAction {
  const id = generateActionId();

  switch (type) {
    case 'navigate':
      return { id, type: 'navigate', pageId: '' };
    case 'openUrl':
      return { id, type: 'openUrl', url: 'https://' };
    case 'showAlert':
      return { id, type: 'showAlert', title: 'Notice', message: '' };
    case 'playVideo':
      return { id, type: 'playVideo', url: '' };
    case 'toggleVisibility':
      return { id, type: 'toggleVisibility', targetComponentId: '' };
    case 'setVariable':
      return { id, type: 'setVariable', key: generateVariableKey(), value: '' };
    case 'goBack':
      return { id, type: 'goBack' };
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unsupported action type: ${String(_exhaustive)}`);
    }
  }
}

export function createEnvelope(project: Project): {
  version: number;
  project: Project;
} {
  return { version: PROJECT_FILE_VERSION, project };
}