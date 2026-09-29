import type { PageComponent } from '@/types/component';
import type { Page, Project } from '@/types/project';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEFAULT_COMPONENT_SIZE,
} from '@/utils/canvas';

const VERTICAL_GAP = 12;
const HORIZONTAL_MARGIN = 16;

interface LegacyBox {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zIndex?: number;
}

function hasPosition(c: PageComponent | (PageComponent & LegacyBox)): boolean {
  const candidate = c as LegacyBox;
  return (
    typeof candidate.x === 'number' &&
    typeof candidate.y === 'number' &&
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number'
  );
}

function inferSize(
  c: PageComponent,
): { width: number; height: number } {
  const fallback = DEFAULT_COMPONENT_SIZE[c.type] ?? {
    width: 200,
    height: 40,
  };

  if (c.type === 'divider') {
    const thickness = c.thickness;
    return {
      width: fallback.width,
      height: thickness === 'thick' ? 6 : thickness === 'medium' ? 4 : 2,
    };
  }

  if (c.type === 'spacer') {
    return fallback;
  }

  return fallback;
}

function layoutComponents(components: PageComponent[]): PageComponent[] {
  let yCursor = HORIZONTAL_MARGIN;
  let z = 1;

  return components.map(component => {
    if (hasPosition(component)) {
      const withZ = {
        ...component,
        zIndex:
          typeof (component as LegacyBox).zIndex === 'number'
            ? (component as LegacyBox).zIndex
            : z,
      } as PageComponent;
      z += 1;
      return withZ;
    }

    const { width, height } = inferSize(component);

    const positioned = {
      ...component,
      x: HORIZONTAL_MARGIN,
      y: yCursor,
      width,
      height,
      zIndex: z,
    } as PageComponent;

    yCursor += height + VERTICAL_GAP;
    if (yCursor > CANVAS_HEIGHT - 40) {
      yCursor = HORIZONTAL_MARGIN;
    }

    z += 1;
    return positioned;
  });
}

function migratePage(page: Page): Page {
  const components = Array.isArray(page.components) ? page.components : [];
  return {
    ...page,
    components: layoutComponents(components),
  };
}

export function migrateProject(project: Project): Project {
  if (!project || !Array.isArray(project.pages)) return project;

  let changed = false;

  const pages = project.pages.map(page => {
    const migrated = migratePage(page);
    const sizeChanged = migrated.components.some((c, i) => {
      const original = page.components[i] as LegacyBox | undefined;
      return (
        !original ||
        typeof original.x !== 'number' ||
        typeof original.y !== 'number'
      );
    });
    if (sizeChanged) changed = true;
    return migrated;
  });

  if (!changed) return project;

  return {
    ...project,
    pages,
  };
}

export const CANVAS_DIMENSIONS = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
};