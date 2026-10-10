import axios, { AxiosInstance, AxiosError } from 'axios';
import type { BuildRun } from '@/types/build';

const GITHUB_API = 'https://api.github.com';

export interface GithubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
  owner: {
    login: string;
  };
}

export interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface GithubRelease {
  id: number;
  tag_name: string;
  html_url: string;
  assets: GithubReleaseAsset[];
}

export interface GithubRun {
  id: number;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: BuildRun['conclusion'];
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface GithubFileEntry {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  download_url: string | null;
}

export class GithubApiError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'GithubApiError';
    this.status = status;
  }
}

function createClient(token: string | null): AxiosInstance {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  if (token && token.trim().length > 0) {
    headers.Authorization = `Bearer ${token}`;
  }

  const client = axios.create({
    baseURL: GITHUB_API,
    timeout: 120000,
    headers,
  });

  client.interceptors.response.use(
    response => response,
    (error: AxiosError) => {
      const status = error.response?.status ?? null;
      let message = 'GitHub request failed. Please check your network.';

      if (status === 401) {
        message =
          'Invalid or expired GitHub token. Please update it in Settings.';
      } else if (status === 403) {
        const rateRemaining =
          error.response?.headers?.['x-ratelimit-remaining'];
        if (rateRemaining === '0') {
          message =
            'GitHub API rate limit reached. Please wait about an hour and try again.';
        } else {
          message =
            'GitHub rejected the request. Your token may lack required scopes (repo, workflow).';
        }
      } else if (status === 404) {
        message =
          'Not found on GitHub. The repository or resource may not exist.';
      } else if (status === 409) {
        message =
          'Repository is empty (no commits yet). Please wait a few seconds and try again.';
      } else if (status === 422) {
        message =
          'GitHub could not process the request. The repository name may already exist, or a file is too large.';
      } else if (status !== null && status >= 500) {
        message = 'GitHub is currently unavailable. Please try again later.';
      } else if (error.code === 'ECONNABORTED') {
        message =
          'Request timed out. The upload may be too large — please retry.';
      }

      return Promise.reject(new GithubApiError(message, status));
    },
  );

  return client;
}

export async function validateToken(token: string): Promise<GithubUser> {
  const client = createClient(token);
  const res = await client.get<GithubUser>('/user');
  return res.data;
}

export async function getRepo(
  token: string,
  owner: string,
  repo: string,
): Promise<GithubRepo> {
  const client = createClient(token);
  const res = await client.get<GithubRepo>(`/repos/${owner}/${repo}`);
  return res.data;
}

export async function repoExists(
  token: string,
  owner: string,
  repo: string,
): Promise<boolean> {
  try {
    await getRepo(token, owner, repo);
    return true;
  } catch (err) {
    if (err instanceof GithubApiError && err.status === 404) return false;
    throw err;
  }
}

export async function createRepoFromTemplate(
  token: string,
  templateOwner: string,
  templateRepo: string,
  newOwner: string,
  newRepoName: string,
  isPrivate: boolean,
  description?: string,
): Promise<GithubRepo> {
  const client = createClient(token);
  const res = await client.post<GithubRepo>(
    `/repos/${templateOwner}/${templateRepo}/generate`,
    {
      owner: newOwner,
      name: newRepoName,
      private: isPrivate,
      description: description ?? 'Built with PageBuilder',
      include_all_branches: false,
    },
  );
  return res.data;
}

export async function deleteRepo(
  token: string,
  owner: string,
  repo: string,
): Promise<void> {
  const client = createClient(token);
  await client.delete(`/repos/${owner}/${repo}`);
}

interface GithubFileContentsResponse {
  content: string;
  encoding: string;
  sha: string;
  path: string;
}

function decodeBase64Utf8(base64: string): string {
  const cleaned = base64.replace(/\s/g, '');
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup: Record<string, number> = {};
  for (let i = 0; i < chars.length; i += 1) {
    lookup[chars[i]] = i;
  }

  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (ch === '=') break;
    const value = lookup[ch];
    if (value === undefined) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const byte1 = bytes[i];
    if (byte1 < 0x80) {
      result += String.fromCharCode(byte1);
      i += 1;
    } else if (byte1 < 0xe0 && i + 1 < bytes.length) {
      const byte2 = bytes[i + 1];
      result += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
      i += 2;
    } else if (i + 2 < bytes.length) {
      const byte2 = bytes[i + 1];
      const byte3 = bytes[i + 2];
      result += String.fromCharCode(
        ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f),
      );
      i += 3;
    } else {
      i += 1;
    }
  }

  return result;
}

export async function getFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch?: string,
): Promise<string | null> {
  const client = createClient(token);
  try {
    const res = await client.get<GithubFileContentsResponse>(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      { params: branch ? { ref: branch } : undefined },
    );
    if (res.data.encoding === 'base64' && typeof res.data.content === 'string') {
      return decodeBase64Utf8(res.data.content);
    }
    return null;
  } catch (err) {
    if (err instanceof GithubApiError && err.status === 404) return null;
    throw err;
  }
}

export interface CommitFile {
  path: string;
  contentBase64: string;
  message?: string;
}

export interface DeleteFile {
  path: string;
  delete: true;
}

export type CommitAction = CommitFile | DeleteFile;

function isDelete(action: CommitAction): action is DeleteFile {
  return 'delete' in action && action.delete === true;
}

interface GitRef {
  ref: string;
  object: { sha: string; type: string; url: string };
}

interface GitCommit {
  sha: string;
  tree: { sha: string };
}

interface GitBlob {
  sha: string;
}

interface GitTree {
  sha: string;
}

interface CreatedTreeEntry {
  path: string;
  mode: '100644';
  type: 'blob';
  sha: string | null;
}

export async function waitForRepoReady(
  token: string,
  owner: string,
  repo: string,
  branch: string = 'main',
  maxAttempts: number = 20,
  delayMs: number = 2000,
): Promise<void> {
  const client = createClient(token);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const res = await client.get<GitRef>(
        `/repos/${owner}/${repo}/git/ref/heads/${branch}`,
      );
      if (res.data?.object?.sha) return;
    } catch {
      // keep waiting
    }
    await new Promise<void>(resolve => {
      setTimeout(resolve, delayMs);
    });
  }
  throw new GithubApiError(
    `Repository "${owner}/${repo}" never became ready on branch "${branch}". Please try again.`,
    null,
  );
}

export async function putFilesInOneCommit(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  actions: CommitAction[],
  commitMessage: string,
): Promise<{ commitSha: string }> {
  const client = createClient(token);

  const refRes = await client.get<GitRef>(
    `/repos/${owner}/${repo}/git/ref/heads/${branch}`,
  );
  const parentCommitSha = refRes.data.object.sha;

  const parentCommitRes = await client.get<GitCommit>(
    `/repos/${owner}/${repo}/git/commits/${parentCommitSha}`,
  );
  const parentTreeSha = parentCommitRes.data.tree.sha;

  const treeEntries: CreatedTreeEntry[] = [];

  for (const action of actions) {
    if (isDelete(action)) {
      treeEntries.push({
        path: action.path,
        mode: '100644',
        type: 'blob',
        sha: null,
      });
      continue;
    }
    const blobRes = await client.post<GitBlob>(
      `/repos/${owner}/${repo}/git/blobs`,
      {
        content: action.contentBase64,
        encoding: 'base64',
      },
    );
    treeEntries.push({
      path: action.path,
      mode: '100644',
      type: 'blob',
      sha: blobRes.data.sha,
    });
  }

  const treeRes = await client.post<GitTree>(
    `/repos/${owner}/${repo}/git/trees`,
    {
      base_tree: parentTreeSha,
      tree: treeEntries,
    },
  );

  const newCommitRes = await client.post<GitCommit>(
    `/repos/${owner}/${repo}/git/commits`,
    {
      message: commitMessage,
      tree: treeRes.data.sha,
      parents: [parentCommitSha],
    },
  );

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await client.patch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
        sha: newCommitRes.data.sha,
        force: true,
      });
      return { commitSha: newCommitRes.data.sha };
    } catch (err) {
      lastError = err;
      await new Promise<void>(resolve => {
        setTimeout(resolve, 3000);
      });
    }
  }

  if (lastError instanceof GithubApiError) throw lastError;
  throw new GithubApiError(
    'Failed to update the branch after several attempts.',
    null,
  );
}

export async function listWorkflowRuns(
  token: string,
  owner: string,
  repo: string,
  options?: { perPage?: number; branch?: string },
): Promise<GithubRun[]> {
  const client = createClient(token);
  const res = await client.get<{ workflow_runs: GithubRun[] }>(
    `/repos/${owner}/${repo}/actions/runs`,
    {
      params: {
        per_page: options?.perPage ?? 5,
        branch: options?.branch,
      },
    },
  );
  return res.data.workflow_runs;
}

export async function getWorkflowRun(
  token: string,
  owner: string,
  repo: string,
  runId: number,
): Promise<GithubRun> {
  const client = createClient(token);
  const res = await client.get<GithubRun>(
    `/repos/${owner}/${repo}/actions/runs/${runId}`,
  );
  return res.data;
}

export async function listReleases(
  token: string,
  owner: string,
  repo: string,
  perPage = 5,
): Promise<GithubRelease[]> {
  const client = createClient(token);
  const res = await client.get<GithubRelease[]>(
    `/repos/${owner}/${repo}/releases`,
    { params: { per_page: perPage } },
  );
  return res.data;
}

export async function findLatestApkUrl(
  token: string,
  owner: string,
  repo: string,
): Promise<string | null> {
  const releases = await listReleases(token, owner, repo, 5);
  for (const release of releases) {
    const apk = release.assets.find(a =>
      a.name.toLowerCase().endsWith('.apk'),
    );
    if (apk) return apk.browser_download_url;
  }
  return null;
}

export async function listRepoContents(
  token: string | null,
  owner: string,
  repo: string,
  path: string = '',
  branch?: string,
): Promise<GithubFileEntry[]> {
  const client = createClient(token);
  const encodedPath = path ? `/${encodeURIComponent(path)}` : '';
  try {
    const res = await client.get<GithubFileEntry[] | GithubFileEntry>(
      `/repos/${owner}/${repo}/contents${encodedPath}`,
      { params: branch ? { ref: branch } : undefined },
    );
    if (Array.isArray(res.data)) return res.data;
    return [res.data];
  } catch (err) {
    if (err instanceof GithubApiError && err.status === 404) {
      const hasToken = Boolean(token && token.trim().length > 0);
      if (!hasToken) {
        throw new GithubApiError(
          `Could not read "${owner}/${repo}". If the repository is private, add a GitHub token in Settings. If it's public, check the owner/repo spelling.`,
          404,
        );
      }
      throw new GithubApiError(
        `Repository "${owner}/${repo}" has no files yet, or it doesn't exist. Upload at least one file (e.g., an MP3) to the root of the repository, then try again.`,
        404,
      );
    }
    throw err;
  }
}

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.flac'];

export function isAudioFile(name: string): boolean {
  const lower = name.toLowerCase();
  return AUDIO_EXTENSIONS.some(ext => lower.endsWith(ext));
}

export interface RepoAudioFile {
  name: string;
  title: string;
  path: string;
  downloadUrl: string;
  size: number;
}

export async function listRepoAudioFiles(
  token: string | null,
  owner: string,
  repo: string,
  branch?: string,
): Promise<RepoAudioFile[]> {
  const entries = await listRepoContents(token, owner, repo, '', branch);
  const audioFiles: RepoAudioFile[] = [];

  for (const entry of entries) {
    if (entry.type !== 'file' || !isAudioFile(entry.name)) continue;

    // Use the GitHub contents API URL instead of `entry.download_url`.
    //
    // `download_url` points at raw.githubusercontent.com, which:
    //   (a) returns 404 for private repos without an Authorization header
    //   (b) cannot carry custom headers from <Image> or <Video> on Android
    //
    // The contents API URL below works with a `Bearer` token header and
    // also works unauthenticated for public repos. The runtime sends
    // `Accept: application/vnd.github.raw` on every request, which makes
    // this endpoint return raw bytes instead of a base64 JSON envelope.
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${entry.path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;

    audioFiles.push({
      name: entry.name,
      title: entry.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      path: entry.path,
      downloadUrl: apiUrl,
      size: entry.size,
    });
  }

  return audioFiles.sort((a, b) => a.name.localeCompare(b.name));
}

// ─────────────────────────────────────────────────────────────────────
//  Upload helpers
// ─────────────────────────────────────────────────────────────────────

export interface PutFileResult {
  /** The path inside the repo where the file was written. */
  path: string;
  /** The commit SHA for the write. */
  commitSha: string;
  /** Contents API URL — what the runtime will fetch. */
  url: string;
}

/**
 * Check whether a file exists at the given path in a repo.
 */
export async function fileExistsInRepo(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string = 'main',
): Promise<boolean> {
  const client = createClient(token);
  try {
    await client.get(
      `/repos/${owner}/${repo}/contents/${path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`,
      { params: { ref: branch } },
    );
    return true;
  } catch (err) {
    if (err instanceof GithubApiError && err.status === 404) return false;
    throw err;
  }
}

/**
 * Upload a small file (< 1 MB) using the Contents API.
 *
 * If the file already exists at the path, the previous SHA is fetched
 * and passed along so GitHub replaces the file instead of 409ing.
 */
export async function putFileToRepo(
  token: string,
  owner: string,
  repo: string,
  path: string,
  contentBase64: string,
  commitMessage: string,
  branch: string = 'main',
): Promise<PutFileResult> {
  const client = createClient(token);
  const encodedPath = path
    .split('/')
    .map(encodeURIComponent)
    .join('/');

  // Look up the current file's SHA (if it exists) so we can update in
  // place rather than fail with a conflict.
  let existingSha: string | null = null;
  try {
    const existing = await client.get<GithubFileContentsResponse>(
      `/repos/${owner}/${repo}/contents/${encodedPath}`,
      { params: { ref: branch } },
    );
    if (existing.data && typeof existing.data.sha === 'string') {
      existingSha = existing.data.sha;
    }
  } catch (err) {
    if (!(err instanceof GithubApiError && err.status === 404)) {
      throw err;
    }
  }

  const body: Record<string, unknown> = {
    message: commitMessage,
    content: contentBase64,
    branch,
  };
  if (existingSha) body.sha = existingSha;

  const res = await client.put<{
    content: { sha: string; path: string };
    commit: { sha: string };
  }>(`/repos/${owner}/${repo}/contents/${encodedPath}`, body);

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

  return {
    path,
    commitSha: res.data.commit.sha,
    url: apiUrl,
  };
}

/**
 * Upload a larger file (1 MB to 15 MB) via the Git Data API.
 *
 * The Contents API chokes on large base64 bodies. This path uses three
 * REST calls (blob → tree → commit) plus a ref update, which is heavier
 * but handles multi-megabyte files reliably.
 */
export async function putLargeFileToRepo(
  token: string,
  owner: string,
  repo: string,
  path: string,
  contentBase64: string,
  commitMessage: string,
  branch: string = 'main',
): Promise<PutFileResult> {
  const client = createClient(token);

  // 1. Current tip of the branch.
  const refRes = await client.get<GitRef>(
    `/repos/${owner}/${repo}/git/ref/heads/${branch}`,
  );
  const parentCommitSha = refRes.data.object.sha;

  // 2. Parent tree to build on.
  const parentCommitRes = await client.get<GitCommit>(
    `/repos/${owner}/${repo}/git/commits/${parentCommitSha}`,
  );
  const parentTreeSha = parentCommitRes.data.tree.sha;

  // 3. Upload the blob.
  const blobRes = await client.post<GitBlob>(
    `/repos/${owner}/${repo}/git/blobs`,
    {
      content: contentBase64,
      encoding: 'base64',
    },
  );

  // 4. New tree with the file.
  const treeRes = await client.post<GitTree>(
    `/repos/${owner}/${repo}/git/trees`,
    {
      base_tree: parentTreeSha,
      tree: [
        {
          path,
          mode: '100644',
          type: 'blob',
          sha: blobRes.data.sha,
        },
      ],
    },
  );

  // 5. New commit.
  const newCommitRes = await client.post<GitCommit>(
    `/repos/${owner}/${repo}/git/commits`,
    {
      message: commitMessage,
      tree: treeRes.data.sha,
      parents: [parentCommitSha],
    },
  );

  // 6. Move the branch ref. Retry a few times in case another write
  //    lands between our ref read and this patch.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await client.patch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
        sha: newCommitRes.data.sha,
        force: true,
      });

      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`;

      return {
        path,
        commitSha: newCommitRes.data.sha,
        url: apiUrl,
      };
    } catch (err) {
      lastError = err;
      await new Promise<void>(resolve => {
        setTimeout(resolve, 3000);
      });
    }
  }

  if (lastError instanceof GithubApiError) throw lastError;
  throw new GithubApiError(
    'Failed to update the branch after several attempts.',
    null,
  );
}