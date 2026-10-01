import { create } from 'zustand';
import type { InteractionAction } from '@/types/action';
import type { ComponentType, PageComponent } from '@/types/component';
import type { Page, PageType, Project } from '@/types/project';
import { createAction, createComponent, createEmptyPage } from '@/utils/factory';
import { generatePageId } from '@/utils/id';

export interface ProjectStoreState {
  project: Project | null;
  activePageId: string | null;
  dirty: boolean;

  setProject: (project: Project | null) => void;
  setActivePage: (pageId: string) => void;

  renameProject: (name: string) => void;
  setStartPage: (pageId: string) => void;
  setPackageName: (packageName: string) => void;
  setVersion: (version: string) => void;

  addPage: (title?: string, type?: PageType) => string;
  removePage: (pageId: string) => void;
  renamePage: (pageId: string, title: string) => void;
  movePage: (pageId: string, direction: 'up' | 'down') => void;
  setPageType: (pageId: string, type: PageType) => void;

  addComponent: (pageId: string, type: ComponentType) => string | null;
  updateComponent: (
    pageId: string,
    componentId: string,
    patch: Partial<PageComponent>,
  ) => void;
  removeComponent: (pageId: string, componentId: string) => void;
  moveComponent: (
    pageId: string,
    componentId: string,
    direction: 'up' | 'down',
  ) => void;
  reorderComponents: (pageId: string, orderedIds: string[]) => void;
  toggleComponentVisibility: (pageId: string, componentId: string) => void;

  addAction: (
    pageId: string,
    componentId: string,
    type: InteractionAction['type'],
  ) => string | null;
  updateAction: (
    pageId: string,
    componentId: string,
    actionId: string,
    patch: Partial<InteractionAction>,
  ) => void;
  removeAction: (
    pageId: string,
    componentId: string,
    actionId: string,
  ) => void;
  moveAction: (
    pageId: string,
    componentId: string,
    actionId: string,
    direction: 'up' | 'down',
  ) => void;

  markClean: () => void;
}

function mapPages(
  project: Project,
  pageId: string,
  updater: (page: Page) => Page,
): Project {
  return {
    ...project,
    pages: project.pages.map(p => (p.id === pageId ? updater(p) : p)),
  };
}

function mapComponents(
  page: Page,
  componentId: string,
  updater: (component: PageComponent) => PageComponent,
): Page {
  return {
    ...page,
    components: page.components.map(c =>
      c.id === componentId ? updater(c) : c,
    ),
  };
}

function touch(project: Project): Project {
  return { ...project, updatedAt: Date.now() };
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  project: null,
  activePageId: null,
  dirty: false,

  setProject: project => {
    const active = project
      ? project.pages.find(p => p.id === project.startPageId)?.id ??
        project.pages[0]?.id ??
        null
      : null;
    set({ project, activePageId: active, dirty: false });
  },

  setActivePage: pageId => set({ activePageId: pageId }),

  renameProject: name => {
    const { project } = get();
    if (!project) return;
    set({ project: touch({ ...project, name }), dirty: true });
  },

  setStartPage: pageId => {
    const { project } = get();
    if (!project) return;
    set({ project: touch({ ...project, startPageId: pageId }), dirty: true });
  },

  setPackageName: packageName => {
    const { project } = get();
    if (!project) return;
    set({ project: touch({ ...project, packageName }), dirty: true });
  },

  setVersion: version => {
    const { project } = get();
    if (!project) return;
    set({ project: touch({ ...project, version }), dirty: true });
  },

  addPage: (title?: string, type?: PageType) => {
    const { project } = get();
    if (!project) return '';
    const pageNumber = project.pages.length + 1;
    const pageType: PageType = type ?? 'main';
    const newPage = createEmptyPage(title ?? `Page ${pageNumber}`, pageType);
    set({
      project: touch({
        ...project,
        pages: [...project.pages, newPage],
      }),
      activePageId: newPage.id,
      dirty: true,
    });
    return newPage.id;
  },

  removePage: pageId => {
    const { project, activePageId } = get();
    if (!project) return;
    if (project.pages.length <= 1) return;
    const pages = project.pages.filter(p => p.id !== pageId);
    const nextStart =
      project.startPageId === pageId ? pages[0].id : project.startPageId;
    const nextActive = activePageId === pageId ? pages[0].id : activePageId;
    set({
      project: touch({ ...project, pages, startPageId: nextStart }),
      activePageId: nextActive,
      dirty: true,
    });
  },

  renamePage: (pageId, title) => {
    const { project } = get();
    if (!project) return;
    set({
      project: touch(mapPages(project, pageId, p => ({ ...p, title }))),
      dirty: true,
    });
  },

  movePage: (pageId, direction) => {
    const { project } = get();
    if (!project) return;
    const index = project.pages.findIndex(p => p.id === pageId);
    if (index < 0) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= project.pages.length) return;
    const pages = [...project.pages];
    const [moved] = pages.splice(index, 1);
    pages.splice(target, 0, moved);
    set({ project: touch({ ...project, pages }), dirty: true });
  },

  setPageType: (pageId, type) => {
    const { project } = get();
    if (!project) return;
    set({
      project: touch(mapPages(project, pageId, p => ({ ...p, type }))),
      dirty: true,
    });
  },

  addComponent: (pageId, type) => {
    const { project } = get();
    if (!project) return null;
    const page = project.pages.find(p => p.id === pageId);
    const component = createComponent(type, page?.components ?? []);
    set({
      project: touch(
        mapPages(project, pageId, page => ({
          ...page,
          components: [...page.components, component],
        })),
      ),
      dirty: true,
    });
    return component.id;
  },

  updateComponent: (pageId, componentId, patch) => {
    const { project } = get();
    if (!project) return;
    set({
      project: touch(
        mapPages(project, pageId, page =>
          mapComponents(page, componentId, c => ({
            ...c,
            ...patch,
          })) as Page,
        ),
      ),
      dirty: true,
    });
  },

  removeComponent: (pageId, componentId) => {
    const { project } = get();
    if (!project) return;
    set({
      project: touch(
        mapPages(project, pageId, page => ({
          ...page,
          components: page.components.filter(c => c.id !== componentId),
        })),
      ),
      dirty: true,
    });
  },

  moveComponent: (pageId, componentId, direction) => {
    const { project } = get();
    if (!project) return;
    set({
      project: touch(
        mapPages(project, pageId, page => {
          const index = page.components.findIndex(c => c.id === componentId);
          if (index < 0) return page;
          const target = direction === 'up' ? index - 1 : index + 1;
          if (target < 0 || target >= page.components.length) return page;
          const components = [...page.components];
          const [moved] = components.splice(index, 1);
          components.splice(target, 0, moved);
          return { ...page, components };
        }),
      ),
      dirty: true,
    });
  },

  reorderComponents: (pageId, orderedIds) => {
    const { project } = get();
    if (!project) return;
    set({
      project: touch(
        mapPages(project, pageId, page => {
          const lookup = new Map(page.components.map(c => [c.id, c]));
          const reordered: PageComponent[] = [];
          for (const id of orderedIds) {
            const found = lookup.get(id);
            if (found) {
              reordered.push(found);
              lookup.delete(id);
            }
          }
          for (const remaining of lookup.values()) {
            reordered.push(remaining);
          }
          return { ...page, components: reordered };
        }),
      ),
      dirty: true,
    });
  },

  toggleComponentVisibility: (pageId, componentId) => {
    const { project } = get();
    if (!project) return;
    set({
      project: touch(
        mapPages(project, pageId, page =>
          mapComponents(page, componentId, c => ({
            ...c,
            visible: !c.visible,
          })) as Page,
        ),
      ),
      dirty: true,
    });
  },

  addAction: (pageId, componentId, type) => {
    const { project } = get();
    if (!project) return null;
    const action = createAction(type);
    set({
      project: touch(
        mapPages(project, pageId, page =>
          mapComponents(page, componentId, c => ({
            ...c,
            actions: [...c.actions, action],
          })) as Page,
        ),
      ),
      dirty: true,
    });
    return action.id;
  },

  updateAction: (pageId, componentId, actionId, patch) => {
    const { project } = get();
    if (!project) return;
    set({
      project: touch(
        mapPages(project, pageId, page =>
          mapComponents(page, componentId, c => ({
            ...c,
            actions: c.actions.map(a =>
              a.id === actionId ? ({ ...a, ...patch } as InteractionAction) : a,
            ),
          })) as Page,
        ),
      ),
      dirty: true,
    });
  },

  removeAction: (pageId, componentId, actionId) => {
    const { project } = get();
    if (!project) return;
    set({
      project: touch(
        mapPages(project, pageId, page =>
          mapComponents(page, componentId, c => ({
            ...c,
            actions: c.actions.filter(a => a.id !== actionId),
          })) as Page,
        ),
      ),
      dirty: true,
    });
  },

  moveAction: (pageId, componentId, actionId, direction) => {
    const { project } = get();
    if (!project) return;
    set({
      project: touch(
        mapPages(project, pageId, page =>
          mapComponents(page, componentId, c => {
            const index = c.actions.findIndex(a => a.id === actionId);
            if (index < 0) return c;
            const target = direction === 'up' ? index - 1 : index + 1;
            if (target < 0 || target >= c.actions.length) return c;
            const actions = [...c.actions];
            const [moved] = actions.splice(index, 1);
            actions.splice(target, 0, moved);
            return { ...c, actions };
          }) as Page,
        ),
      ),
      dirty: true,
    });
  },

  markClean: () => set({ dirty: false }),
}));

export { generatePageId };