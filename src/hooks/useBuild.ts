import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BuildConfig,
  BuildResult,
  BuildState,
} from '@/types/build';
import {
  createRepoFromTemplate,
  findLatestApkUrl,
  getFileContent,
  getWorkflowRun,
  GithubApiError,
  listWorkflowRuns,
  putFilesInOneCommit,
  repoExists,
  validateToken,
  waitForRepoReady,
  type CommitAction,
} from '@/api/github';
import { RUNTIME_FILES } from '@/services/runtimeSource';
import { bundleLocalAssets } from '@/services/assetBundler';
import type { Project } from '@/types/project';

const POLL_INTERVAL_MS = 10000;
const POLL_TIMEOUT_MS = 25 * 60 * 1000;

const TEMPLATE_PACKAGE = 'com.rntest';
const TEMPLATE_PACKAGE_PATH = `android/app/src/main/java/${TEMPLATE_PACKAGE.replace(
  /\./g,
  '/',
)}`;

export interface BuildFiles {
  project: Project;
  projectName: string;
  projectPackageName: string;
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

const GENERATED_BUILD_WORKFLOW = `name: Build APK

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    name: Build APK
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Setup JDK 17
        uses: actions/setup-java@v5
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Install dependencies
        run: npm ci --legacy-peer-deps && npm install react-native-sound@0.13.0 --legacy-peer-deps --no-save

      - name: Unpack bundled assets
        run: |
          ASSETS_SRC="assets/user-assets"
          ASSETS_DST="android/app/src/main/assets/user-assets"
          if [ -d "$ASSETS_SRC" ]; then
            mkdir -p "$ASSETS_DST"
            cp -R "$ASSETS_SRC"/. "$ASSETS_DST"/
            echo "Copied bundled assets:"
            ls -la "$ASSETS_DST" | head -20
          else
            echo "No bundled assets found (skipping)"
          fi

      - name: Build Release APK
        working-directory: android
        run: |
          chmod +x gradlew
          ./gradlew assembleRelease --no-daemon --stacktrace

      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: app-release-apk
          path: android/app/build/outputs/apk/release/app-release.apk
          retention-days: 30

      - name: Show APK info
        run: |
          ls -lh android/app/build/outputs/apk/release/
          echo "Release APK built successfully"
`;

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

function safeAppSlug(name: string): string {
  const slug = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
  return slug.length > 0 ? slug : 'App';
}

function sanitizePackageName(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return cleaned || 'com.pagebuilder.app';
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function replacePackageInKotlin(
  source: string,
  newPackage: string,
  appName?: string,
): string {
  let result = source.replace(/^package\s+[\w.]+/m, `package ${newPackage}`);
  if (appName) {
    result = result.replace(
      /getMainComponentName\(\):\s*String\s*=\s*"[^"]*"/,
      `getMainComponentName(): String = "${appName}"`,
    );
  }
  return result;
}

function replacePackageInGradle(source: string, newPackage: string): string {
  let result = source.replace(
    /namespace\s+"[^"]+"/,
    `namespace "${newPackage}"`,
  );
  result = result.replace(
    /applicationId\s+"[^"]+"/,
    `applicationId "${newPackage}"`,
  );
  return result;
}

async function readOnce(
  token: string,
  owner: string,
  repo: string,
  path: string,
): Promise<string | null> {
  try {
    const content = await getFileContent(token, owner, repo, path, 'main');
    if (content && content.length > 0) return content;
    return null;
  } catch {
    return null;
  }
}

async function readFromCandidates(
  token: string,
  owner: string,
  repo: string,
  candidates: string[],
  attempts: number = 3,
  delayMs: number = 2000,
): Promise<{ path: string; content: string } | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    for (const path of candidates) {
      const content = await readOnce(token, owner, repo, path);
      if (content) return { path, content };
    }
    await new Promise<void>(resolve => {
      setTimeout(resolve, delayMs);
    });
  }
  return null;
}

async function buildCommitActions(
  token: string,
  owner: string,
  repo: string,
  files: BuildFiles,
): Promise<CommitAction[]> {
  const actions: CommitAction[] = [];

  const appName = files.projectName;
  const appSlug = safeAppSlug(appName);
  const newPackage = sanitizePackageName(files.projectPackageName);
  const newPackagePath = `android/app/src/main/java/${newPackage.replace(
    /\./g,
    '/',
  )}`;

  const templateMainActivity = `${TEMPLATE_PACKAGE_PATH}/MainActivity.kt`;
  const templateMainApplication = `${TEMPLATE_PACKAGE_PATH}/MainApplication.kt`;
  const newMainActivity = `${newPackagePath}/MainActivity.kt`;
  const newMainApplication = `${newPackagePath}/MainApplication.kt`;

  const bundled = await bundleLocalAssets(files.project);

  for (const assetAction of bundled.actions) {
    actions.push(assetAction);
  }

  actions.push({
    path: 'App.tsx',
    contentBase64: toBase64("export { default } from './runtime/App';\n"),
    message: 'entry point',
  });

  actions.push({
    path: 'app.json',
    contentBase64: toBase64(
      JSON.stringify({ name: appSlug, displayName: appName }, null, 2),
    ),
    message: 'app name',
  });

  actions.push({
    path: 'index.js',
    contentBase64: toBase64(
      "import {AppRegistry} from 'react-native';\n" +
        "import App from './App';\n" +
        "import {name as appName} from './app.json';\n" +
        '\n' +
        'AppRegistry.registerComponent(appName, () => App);\n',
    ),
    message: 'js entry',
  });

  const stringsXml =
    '<?xml version="1.0" encoding="utf-8"?>\n' +
    '<resources>\n' +
    `    <string name="app_name">${xmlEscape(appName)}</string>\n` +
    '</resources>\n';
  actions.push({
    path: 'android/app/src/main/res/values/strings.xml',
    contentBase64: toBase64(stringsXml),
    message: 'launcher name',
  });

  actions.push({
    path: 'project.json',
    contentBase64: toBase64(bundled.updatedProjectJson),
    message: 'project data',
  });

  actions.push({
    path: '.github/workflows/build-apk.yml',
    contentBase64: toBase64(GENERATED_BUILD_WORKFLOW),
    message: 'build workflow',
  });

  for (const runtimeFile of RUNTIME_FILES) {
    actions.push({
      path: runtimeFile.path,
      contentBase64: runtimeFile.base64,
      message: `runtime ${runtimeFile.path}`,
    });
  }

  const mainActivityCandidates =
    newMainActivity === templateMainActivity
      ? [templateMainActivity]
      : [newMainActivity, templateMainActivity];

  const mainApplicationCandidates =
    newMainApplication === templateMainApplication
      ? [templateMainApplication]
      : [newMainApplication, templateMainApplication];

  const foundMainActivity = await readFromCandidates(
    token,
    owner,
    repo,
    mainActivityCandidates,
  );
  const foundMainApplication = await readFromCandidates(
    token,
    owner,
    repo,
    mainApplicationCandidates,
  );

  if (!foundMainActivity || !foundMainApplication) {
    throw new Error(
      'Could not find MainActivity.kt or MainApplication.kt in the repository. ' +
        'Delete the repository on GitHub and try building again with a new name.',
    );
  }

  const patchedMainActivity = replacePackageInKotlin(
    foundMainActivity.content,
    newPackage,
    appSlug,
  );
  const patchedMainApplication = replacePackageInKotlin(
    foundMainApplication.content,
    newPackage,
  );

  if (foundMainActivity.path !== newMainActivity) {
    actions.push({
      path: newMainActivity,
      contentBase64: toBase64(patchedMainActivity),
      message: 'MainActivity at new package',
    });
    actions.push({ path: foundMainActivity.path, delete: true });
  } else if (patchedMainActivity !== foundMainActivity.content) {
    actions.push({
      path: foundMainActivity.path,
      contentBase64: toBase64(patchedMainActivity),
      message: 'MainActivity app name',
    });
  }

  if (foundMainApplication.path !== newMainApplication) {
    actions.push({
      path: newMainApplication,
      contentBase64: toBase64(patchedMainApplication),
      message: 'MainApplication at new package',
    });
    actions.push({ path: foundMainApplication.path, delete: true });
  } else if (patchedMainApplication !== foundMainApplication.content) {
    actions.push({
      path: foundMainApplication.path,
      contentBase64: toBase64(patchedMainApplication),
      message: 'MainApplication package',
    });
  }

  const gradlePath = 'android/app/build.gradle';
  const gradleContent = await readOnce(token, owner, repo, gradlePath);
  if (!gradleContent) {
    throw new Error(
      'Could not read android/app/build.gradle. Delete the repository on GitHub and try again.',
    );
  }

  const patchedGradle = replacePackageInGradle(gradleContent, newPackage);
  if (patchedGradle !== gradleContent) {
    actions.push({
      path: gradlePath,
      contentBase64: toBase64(patchedGradle),
      message: 'build.gradle package',
    });
  }

  return actions;
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
                : 'Build completed. Open the run on GitHub to download the APK artifact.',
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

        const projectJsonPreview = JSON.stringify(
          { version: 2, project: files.project },
          null,
          2,
        );
        validateProjectJson(projectJsonPreview);

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
            message: `Creating repository "${config.repoName}"`,
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
        }

        update({
          phase: 'creating-repo',
          message: 'Waiting for repository to be ready',
          progress: 28,
        });

        await waitForRepoReady(
          config.token,
          owner,
          config.repoName,
          'main',
          30,
          2000,
        );

        update({
          phase: 'pushing-files',
          message: 'Bundling local images and videos',
          progress: 32,
        });

        const actions = await buildCommitActions(
          config.token,
          owner,
          config.repoName,
          files,
        );

        update({
          phase: 'pushing-files',
          message: 'Uploading project files',
          progress: 45,
        });

        await putFilesInOneCommit(
          config.token,
          owner,
          config.repoName,
          'main',
          actions,
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