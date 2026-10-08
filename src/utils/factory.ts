import type { InteractionAction } from '@/types/action';
import type {
  ComponentType,
  MusicTrack,
  PageComponent,
} from '@/types/component';
import type { Page, PageType, Project } from '@/types/project';
import { PROJECT_FILE_VERSION } from '@/types/project';
import {
  generateActionId,
  generateComponentId,
  generatePageId,
  generateProjectId,
  generateVariableKey,
} from '@/utils/id';
import {
  derivePackageName,
  deriveRepoName,
  sanitizePackageName,
  sanitizeRepoName,
} from '@/utils/format';
import {
  DEFAULT_COMPONENT_SIZE_FRAC,
  DEFAULT_DROP_POSITION_FRAC,
} from '@/utils/canvas';

const DROP_STEP_FRAC = 0.02;

export function createEmptyPage(
  title: string,
  type: PageType = 'main',
): Page {
  return {
    id: generatePageId(),
    title,
    components: [],
    type,
  };
}

/**
 * Options accepted by `createProject`.
 *
 * - `packageName` — the Android package ID. If omitted, derived from the
 *   project name via `derivePackageName`. Locked to the project name in
 *   the create screen (see Decision 2 in the Phase B plan), so this is
 *   almost always left undefined by callers and computed here.
 * - `repoName` — the GitHub repo name (owner comes from the token at
 *   creation time). If omitted, derived from the project name. The user
 *   can override this in the create form.
 * - `repoPrivate` — whether the created repo should be private. Defaults
 *   to `true` (recommended — anyone can still download the APK from a
 *   GitHub Release, and private repos protect the source and assets).
 */
export interface CreateProjectOptions {
  packageName?: string;
  repoName?: string;
  repoPrivate?: boolean;
}

export function createProject(
  name: string,
  options?: CreateProjectOptions,
): Project {
  const now = Date.now();
  const trimmedName = name.trim() || 'My App';
  const firstPage = createEmptyPage('Home', 'main');

  // Package name: locked to the project name. If a caller passes one
  // explicitly, sanitize it; otherwise derive it fresh.
  const packageName = options?.packageName
    ? sanitizePackageName(options.packageName)
    : derivePackageName(trimmedName);

  // Repo name: user-editable in the create form. If a caller passes one,
  // sanitize it; otherwise derive it from the project name.
  const repoName = options?.repoName
    ? sanitizeRepoName(options.repoName)
    : deriveRepoName(trimmedName);

  const repoPrivate = options?.repoPrivate ?? true;

  return {
    id: generateProjectId(),
    name: trimmedName,
    packageName,
    version: '1.0.0',
    startPageId: firstPage.id,
    pages: [firstPage],
    createdAt: now,
    updatedAt: now,
    // Repo metadata: the *name* is reserved here, but the repo itself is
    // not created until the user (or the build flow) does it. Having the
    // name present lets the Create Project screen preview it and lets
    // the editor banner know a repo is expected.
    repoName,
    repoPrivate,
    // repoOwner and repoUrl are filled in once the repo is actually
    // created. Leaving them undefined is what the editor banner checks.
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
  let y = DEFAULT_DROP_POSITION_FRAC.y;
  let attempts = 0;
  const x = DEFAULT_DROP_POSITION_FRAC.x;

  while (attempts < 30) {
    const overlapping = components.some(
      c => Math.abs(c.x - x) < 0.02 && Math.abs(c.y - y) < 0.02,
    );
    if (!overlapping) break;
    y += DROP_STEP_FRAC;
    if (y + height > 1) {
      y = DEFAULT_DROP_POSITION_FRAC.y;
      break;
    }
    attempts += 1;
  }

  return {
    x: Math.max(0, Math.min(x, 1 - width)),
    y: Math.max(0, Math.min(y, 1 - height)),
  };
}

export function createMusicTrack(overrides?: Partial<MusicTrack>): MusicTrack {
  const id = generateComponentId();
  return {
    id,
    title: overrides?.title ?? 'Untitled track',
    artist: overrides?.artist ?? '',
    url: overrides?.url ?? '',
  };
}

export function createComponent(
  type: ComponentType,
  existingSiblings: PageComponent[] = [],
): PageComponent {
  const id = generateComponentId();
  const size = DEFAULT_COMPONENT_SIZE_FRAC[type] ?? {
    width: 0.6,
    height: 0.06,
  };
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
        backgroundMode: false,
      };
    case 'video':
      return {
        ...base,
        type: 'video',
        url: '',
        autoPlay: false,
        loop: false,
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
    case 'music':
      return {
        ...base,
        type: 'music',
        tracks: [],
        showArtist: true,
        autoplay: false,
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
    case 'nextOnboarding':
      return { id, type: 'nextOnboarding' };
    case 'completeOnboarding':
      return { id, type: 'completeOnboarding' };
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