import type { PageComponent } from '@/types/component';

export type PageType = 'onboarding' | 'main';

export interface Page {
  id: string;
  title: string;
  components: PageComponent[];
  type: PageType;
  /**
   * Per-page background music. When `bgmEnabled` is true and `bgmUrl` is set,
   * the runtime starts playing the track when this page becomes active and
   * stops it when the user navigates away.
   *
   * The URL can be:
   *   - A public https:// URL (e.g. https://example.com/song.mp3)
   *   - A GitHub contents API URL for a private repo (the project's
   *     `assetToken` is attached automatically by the runtime)
   */
  bgmEnabled?: boolean;
  bgmUrl?: string;
  bgmLoop?: boolean;
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

  /**
   * GitHub repository where this project's runtime and assets live.
   *
   * These are set at project creation time. `repoName` and `repoOwner` are
   * the two halves of "owner/repo". `repoUrl` is the full https URL for
   * convenience. `repoPrivate` records whether the repo is private — used
   * by the UI to decide whether a token is required for asset access.
   *
   * If `repoName` is undefined, the project has not yet been linked to a
   * GitHub repo. The editor shows a banner prompting the user to create
   * one; the build flow creates it lazily as a fallback.
   */
  repoOwner?: string;
  repoName?: string;
  repoUrl?: string;
  repoPrivate?: boolean;

  /**
   * Optional GitHub repository that hosts this project's private assets,
   * in "owner/repo" form. When set, the runtime can resolve relative asset
   * references against it.
   */
  assetRepo?: string;
  /**
   * Optional GitHub Personal Access Token used to read assets from the
   * private repository above.
   *
   * WARNING: this token is stored in project.json and bundled into the
   * built APK. Anyone with the APK can extract it. Use a fine-grained
   * token scoped to a single repository with read-only Contents access,
   * and set an expiry (90 days recommended). Never grant write access.
   */
  assetToken?: string;
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