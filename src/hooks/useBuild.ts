import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BuildConfig,
  BuildPhase,
  BuildResult,
  BuildState,
} from '@/types/build';
import {
  createRepoFromTemplate,
  findLatestApkUrl,
  getWorkflowRun,
  GithubApiError,
  listWorkflowRuns,
  putFilesInOneCommit,
  repoExists,
  validateToken,
  type CommitFile,
} from '@/api/github';
import { RUNTIME_FILES } from '@/services/runtimeSource';

const POLL_INTERVAL_MS = 10000;
const POLL_TIMEOUT_MS = 25 * 60 * 1000;
const REPO_INIT_WAIT_MS = 8000;

export interface BuildFiles {
  projectJson: string;
}

export interface StartBuildParams {
  config: BuildConfig;
  files: BuildFiles;
}

export interface UseBuildResult {
  state: BuildState;
  start: (params: StartBuildParams) => Promise<void>;
  reset: () => void;
  cancel: () => void;
}

const initialState: BuildState = {
  phase: 'idle',
  message: 'Ready to build',
  progress: 0,
  run: null,
  result: null,
  error: null,
};

function toBase64(value: string): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const triplet = (b0 << 16) | (b1 << 8) | b2;
    result += chars[(triplet >> 18) & 0x3f];
    result += chars[(triplet >> 12) & 0x3f];
    result += i + 1 < bytes.length ? chars[(triplet >> 6) & 0x3f] : '=';
    result += i + 2 < bytes.length ? chars[triplet & 0x3f] : '=';
  }
  return result;
}

function validateProjectJson(json: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('project.json is not valid JSON. Please try again.');
  }

  const envelope = parsed as { project?: { pages?: unknown[]; name?: string } };
  const project = envelope.project;
  if (!project) {
    throw new Error(
      'project.json has no "project" field. The project may be corrupted.',
    );
  }
  if (!Array.isArray(project.pages) || project.pages.length === 0) {
    throw new Error(
      'project.json has no pages. Add at least one page before building.',
    );
  }
  if (!project.name) {
    throw new Error('project.json has no name.');
  }
}

function buildCommitFiles(files: BuildFiles): CommitFile[] {
  const result: CommitFile[] = [];

  result.push({
    path: 'App.tsx',
    contentBase64: toBase64("export { default } from './runtime/App';\n"),
    message: 'entry point',
  });

  result.push({
    path: 'project.json',
    contentBase64: toBase64(files.projectJson),
    message: 'project data',
  });

  for (const runtimeFile of RUNTIME_FILES) {
    result.push({
      path: runtimeFile.path,
      contentBase64: runtimeFile.base64,
      message: `runtime ${runtimeFile.path}`,
    });
  }

  return result;
}

export function useBuild(): UseBuildResult {
  const [state, setState] = useState<BuildState>(initialState);
  const cancelledRef = useRef<boolean>(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPoll = useCallback((): void => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const cancel = useCallback((): void => {
    cancelledRef.current = true;
    clearPoll();
    setState(prev => ({
      ...prev,
      phase: 'failed',
      error: 'Build cancelled by user.',
      message: 'Cancelled',
    }));
  }, [clearPoll]);

  const reset = useCallback((): void => {
    cancelledRef.current = false;
    clearPoll();
    setState(initialState);
  }, [clearPoll]);

  const update = useCallback((patch: Partial<BuildState>): void => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  const pollRun = useCallback(
    async (
      token: string,
      owner: string,
      repo: string,
      runId: number,
      startedAt: number,
    ): Promise<void> => {
      if (cancelledRef.current) return;

      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        update({
          phase: 'failed',
          error:
            'Build timed out after 25 minutes. Check the repository on GitHub.',
          message: 'Timed out',
        });
        return;
      }

      try {
        const run = await getWorkflowRun(token, owner, repo, runId);

        if (run.status === 'completed') {
          if (run.conclusion === 'success') {
            update({
              phase: 'uploading-release',
              message: 'Fetching download link',
              progress: 95,
            });

            let apkUrl: string | null = null;
            for (let attempt = 0; attempt < 8; attempt += 1) {
              apkUrl = await findLatestApkUrl(token, owner, repo);
              if (apkUrl) break;
              await new Promise<void>(resolve => {
                setTimeout(resolve, 5000);
              });
            }

            const result: BuildResult = {
              success: true,
              runId: run.id,
              runUrl: run.html_url,
              apkUrl,
              repoUrl: `https://github.com/${owner}/${repo}`,
              error: null,
            };

            update({
              phase: 'completed',
              message: apkUrl
                ? 'Build completed. APK is ready to download.'
                : 'Build completed, but the APK is not yet published. Check the run on GitHub.',
              progress: 100,
              run: {
                id: run.id,
                status: run.status,
                conclusion: run.conclusion,
                htmlUrl: run.html_url,
                createdAt: run.created_at,
                updatedAt: run.updated_at,
              },
              result,
            });
            return;
          }

          update({
            phase: 'failed',
            message: 'Build failed',
            error:
              'The GitHub Actions workflow failed. Open the run on GitHub to see details.',
            run: {
              id: run.id,
              status: run.status,
              conclusion: run.conclusion,
              htmlUrl: run.html_url,
              createdAt: run.created_at,
              updatedAt: run.updated_at,
            },
          });
          return;
        }

        update({
          phase: 'building',
          message: 'Building APK on GitHub',
          progress: Math.min(90, 30 + Math.floor(Math.random() * 10)),
          run: {
            id: run.id,
            status: run.status,
            conclusion: run.conclusion,
            htmlUrl: run.html_url,
            createdAt: run.created_at,
            updatedAt: run.updated_at,
          },
        });

        pollTimerRef.current = setTimeout(() => {
          void pollRun(token, owner, repo, runId, startedAt);
        }, POLL_INTERVAL_MS);
      } catch (err) {
        const message =
          err instanceof GithubApiError
            ? err.message
            : 'Failed to check build status.';
        update({ phase: 'failed', error: message, message: 'Error' });
      }
    },
    [update],
  );

  const start = useCallback(
    async (params: StartBuildParams): Promise<void> => {
      cancelledRef.current = false;
      clearPoll();
      const { config, files } = params;

      if (!config.token.trim()) {
        update({
          phase: 'failed',
          error: 'GitHub token is missing. Add it in Settings.',
          message: 'Missing token',
        });
        return;
      }
      if (!config.repoName.trim()) {
        update({
          phase: 'failed',
          error: 'Repository name is required.',
          message: 'Missing repo name',
        });
        return;
      }

      try {
        update({
          phase: 'creating-repo',
          message: 'Validating project',
          progress: 3,
          error: null,
          result: null,
        });

        validateProjectJson(files.projectJson);

        update({
          phase: 'creating-repo',
          message: 'Verifying GitHub account',
          progress: 5,
        });

        const user = await validateToken(config.token);
        const owner = user.login;

        update({
          phase: 'creating-repo',
          message: 'Preparing repository',
          progress: 15,
        });

        const exists = await repoExists(config.token, owner, config.repoName);
        if (!exists) {
          update({
            phase: 'creating-repo',
            message: `Creating repository "${config.repoName}" from template`,
            progress: 20,
          });
          await createRepoFromTemplate(
            config.token,
            config.templateOwner,
            config.templateRepo,
            owner,
            config.repoName,
            config.isPrivate,
          );
          update({
            phase: 'creating-repo',
            message: 'Waiting for repository to initialize',
            progress: 25,
          });
          await new Promise<void>(resolve => {
            setTimeout(resolve, REPO_INIT_WAIT_MS);
          });
        }

        update({
          phase: 'pushing-files',
          message: 'Uploading project + runtime files',
          progress: 35,
        });

        const commitFiles = buildCommitFiles(files);

        await putFilesInOneCommit(
          config.token,
          owner,
          config.repoName,
          'main',
          commitFiles,
          'build: update from PageBuilder',
        );

        update({
          phase: 'triggering-build',
          message: 'Waiting for workflow to start',
          progress: 55,
        });

        const startedAt = Date.now();
        let runId: number | null = null;

        for (let attempt = 0; attempt < 20; attempt += 1) {
          if (cancelledRef.current) return;
          const runs = await listWorkflowRuns(
            config.token,
            owner,
            config.repoName,
            { perPage: 5 },
          );
          const candidate = runs.find(
            r => new Date(r.created_at).getTime() >= startedAt - 15000,
          );
          if (candidate) {
            runId = candidate.id;
            break;
          }
          await new Promise<void>(resolve => {
            setTimeout(resolve, 5000);
          });
        }

        if (runId === null) {
          update({
            phase: 'failed',
            error:
              'Could not find the build run. Open the repository on GitHub → Actions to check.',
            message: 'No run detected',
          });
          return;
        }

        update({
          phase: 'building',
          message: 'Building APK on GitHub',
          progress: 60,
        });

        await pollRun(config.token, owner, config.repoName, runId, startedAt);
      } catch (err) {
        const message =
          err instanceof GithubApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : 'Build failed unexpectedly.';
        update({ phase: 'failed', error: message, message: 'Error' });
      }
    },
    [clearPoll, pollRun, update],
  );

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      clearPoll();
    };
  }, [clearPoll]);

  return { state, start, reset, cancel };
}