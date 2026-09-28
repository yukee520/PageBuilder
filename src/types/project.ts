import type { PageComponent } from '@/types/component';

export interface Page {
  id: string;
  title: string;
  components: PageComponent[];
}

export interface Project {
  id: string;
  name: string;
  packageName: string;
  version: string;
  startPageId: string | null;
  pages: Page[];
  createdAt: number;
  updatedAt: number;
}

export interface ProjectMeta {
  id: string;
  name: string;
  pageCount: number;
  componentCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectIndex {
  projects: ProjectMeta[];
}

export const PROJECT_FILE_VERSION = 1;

export interface ProjectFileEnvelope {
  version: number;
  project: Project;
}