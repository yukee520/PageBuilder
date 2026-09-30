import type { PageComponent } from '@/types/component';
import type { Page, Project } from '@/types/project';
import { DEFAULT_COMPONENT_SIZE_FRAC } from '@/utils/canvas';

const VERTICAL_GAP_FRAC = 0.015;
const HORIZONTAL_MARGIN_FRAC = 0.05;

interface LegacyBox {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zIndex?: number;
}

function looksLikeFraction(c: PageComponent): boolean {
  const b = c as LegacyBox;
  if (
    typeof b.x !== 'number' ||
    typeof b.y !== 'number' ||
    typeof b.width !== 'number' ||
    typeof b.height !== 'number'
  ) {
    return false;
  }
  return (
    b.x >= -1 &&
    b.x <= 2 &&
    b.y >= -1 &&
    b.y <= 2 &&
    b.width > 0 &&
    b.width <= 2 &&
    b.height > 0 &&
    b.height <= 2
  );
}

function inferDefaultSize(
  c: PageComponent,
): { width: number; height: number } {
  const fallback = DEFAULT_COMPONENT_SIZE_FRAC[c.type] ?? {
    width: 0.6,
    height: 0.06,
  };

  if (c.type === 'divider') {
    const thickness = c.thickness;
    return {
      width: fallback.width,
      height: thickness === 'thick' ? 0.01 : thickness === 'medium' ? 0.007 : 0.004,
    };
  }

  return fallback;
}

function normalizeComponent(
  c: PageComponent,
  yCursor: number,
  z: number,
): { component: PageComponent; nextYCursor: number } {
  const existing = c as LegacyBox;

  if (looksLikeFraction(c)) {
    return {
      component: {
        ...c,
        zIndex: typeof existing.zIndex === 'number' ? existing.zIndex : z,
      } as PageComponent,
      nextYCursor: Math.max(yCursor, (existing.y ?? 0) + (existing.height ?? 0) + VERTICAL_GAP_FRAC),
    };
  }

  const hasVirtualPosition =
    typeof existing.x === 'number' &&
    typeof existing.y === 'number' &&
    typeof existing.width === 'number' &&
    typeof existing.height === 'number' &&
    (existing.x > 2 || existing.y > 2 || existing.width > 2 || existing.height > 2);

  if (hasVirtualPosition) {
    const migrated = {
      ...c,
      x: Math.max(0, Math.min(1, (existing.x as number) / 360)),
      y: Math.max(0, Math.min(1, (existing.y as number) / 800)),
      width: Math.max(0.05, Math.min(1, (existing.width as number) / 360)),
      height: Math.max(0.01, Math.min(1, (existing.height as number) / 800)),
      zIndex: typeof existing.zIndex === 'number' ? existing.zIndex : z,
    } as PageComponent;

    return {
      component: migrated,
      nextYCursor: Math.max(
        yCursor,
        migrated.y + migrated.height + VERTICAL_GAP_FRAC,
      ),
    };
  }

  const { width, height } = inferDefaultSize(c);
  const migrated = {
    ...c,
    x: HORIZONTAL_MARGIN_FRAC,
    y: yCursor,
    width,
    height,
    zIndex: z,
  } as PageComponent;

  return {
    component: migrated,
    nextYCursor: yCursor + height + VERTICAL_GAP_FRAC,
  };
}

function migratePage(page: Page): Page {
  const components = Array.isArray(page.components) ? page.components : [];
  let yCursor = HORIZONTAL_MARGIN_FRAC;
  let z = 1;

  const nextComponents: PageComponent[] = [];

  for (const c of components) {
    const result = normalizeComponent(c, yCursor, z);
    nextComponents.push(result.component);
    yCursor = result.nextYCursor;
    z += 1;
  }

  return {
    ...page,
    components: nextComponents,
  };
}

export function migrateProject(project: Project): Project {
  if (!project || !Array.isArray(project.pages)) return project;

  let changed = false;

  const pages = project.pages.map(page => {
    const original = page.components ?? [];
    const migrated = migratePage(page);
    if (
      migrated.components.length !== original.length ||
      migrated.components.some((c, i) => {
        const o = original[i] as LegacyBox | undefined;
        if (!o) return true;
        return (
          typeof o.x !== 'number' ||
          typeof o.y !== 'number' ||
          typeof o.width !== 'number' ||
          typeof o.height !== 'number' ||
          o.x > 2 ||
          o.y > 2 ||
          o.width > 2 ||
          o.height > 2
        );
      })
    ) {
      changed = true;
    }
    return migrated;
  });

  if (!changed) return project;

  return {
    ...project,
    pages,
  };
}