export type BuildPhase =
  | 'idle'
  | 'creating-repo'
  | 'pushing-files'
  | 'triggering-build'
  | 'building'
  | 'uploading-release'
  | 'completed'
  | 'failed';

export interface BuildConfig {
  token: string;
  repoName: string;
  isPrivate: boolean;
  templateOwner: string;
  templateRepo: string;
}

export interface BuildRun {
  id: number;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion:
    | 'success'
    | 'failure'
    | 'cancelled'
    | 'skipped'
    | 'timed_out'
    | 'action_required'
    | null;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface BuildResult {
  success: boolean;
  runId: number | null;
  runUrl: string | null;
  apkUrl: string | null;
  repoUrl: string | null;
  error: string | null;
}

export interface BuildState {
  phase: BuildPhase;
  message: string;
  progress: number;
  run: BuildRun | null;
  result: BuildResult | null;
  error: string | null;
}

export const BUILD_PHASE_LABELS: Record<BuildPhase, string> = {
  idle: 'Ready',
  'creating-repo': 'Creating repository',
  'pushing-files': 'Uploading project files',
  'triggering-build': 'Starting build',
  building: 'Building APK',
  'uploading-release': 'Publishing download link',
  completed: 'Build completed',
  failed: 'Build failed',
};