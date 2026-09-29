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
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEFAULT_COMPONENT_SIZE,
} from '@/utils/canvas';

const DROP_X = 40;
const DROP_Y_START = 40;
const DROP_Y_STEP = 20;

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

function nextZIndex(components: PageComponent[]): number {
  if (components.length === 0) return 1;
  return Math.max(...components.map(c => c.zIndex ?? 0)) + 1;
}

function findDropPosition(
  components: PageComponent[],
  width: number,
  height: number,
): { x: number; y: number } {
  let y = DROP_Y_START;
  let attempts = 0;
  while (attempts < 30) {
    const overlapping = components.some(
      c =>
        Math.abs(c.x - DROP_X) < 8 &&
        Math.abs(c.y - y) < 8,
    );
    if (!overlapping) break;
    y += DROP_Y_STEP;
    if (y + height > CANVAS_HEIGHT - 20) {
      y = DROP_Y_START;
      break;
    }
    attempts += 1;
  }

  const maxX = CANVAS_WIDTH - width;
  const maxY = CANVAS_HEIGHT - height;
  return {
    x: Math.max(0, Math.min(DROP_X, maxX)),
    y: Math.max(0, Math.min(y, maxY)),
  };
}

export function createComponent(
  type: ComponentType,
  existingSiblings: PageComponent[] = [],
): PageComponent {
  const id = generateComponentId();
  const size = DEFAULT_COMPONENT_SIZE[type] ?? { width: 200, height: 40 };
  const { x, y } = findDropPosition(existingSiblings, size.width, size.height);
  const zIndex = nextZIndex(existingSiblings);

  const base = {
    id,
    actions: [] as InteractionAction[],
    visible: true,
    x,
    y,
    width: size.width,
    height: size.height,
    zIndex,
  };

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
        variant: 'primary',
      };
    case 'spacer':
      return {
        ...base,
        type: 'spacer',
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