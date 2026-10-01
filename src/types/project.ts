import type { PageComponent } from '@/types/component';

export type PageType = 'onboarding' | 'main';

export interface Page {
  id: string;
  title: string;
  components: PageComponent[];
  type: PageType;
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

export const PROJECT_FILE_VERSION = 2;

export interface ProjectFileEnvelope {
  version: number;
  project: Project;
}

export interface OnboardingProgress {
  onboardingCompleted: boolean;
  lastOnboardingPageId: string | null;
  completedAt: number | null;
}

export const DEFAULT_ONBOARDING_PROGRESS: OnboardingProgress = {
  onboardingCompleted: false,
  lastOnboardingPageId: null,
  completedAt: null,
};