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
    timeout: 30000,
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
        message =
          'GitHub rejected the request. Your token may lack required scopes, or you hit a rate limit.';
      } else if (status === 404) {
        message =
          'Not found on GitHub. The repository or resource may not exist.';
      } else if (status === 422) {
        message =
          'GitHub could not process the request. The repository name may already exist.';
      } else if (status !== null && status >= 500) {
        message = 'GitHub is currently unavailable. Please try again later.';
      } else if (error.code === 'ECONNABORTED') {
        message = 'Request timed out. Please try again.';
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

export interface PutFileParams {
  path: string;
  contentBase64: string;
  message: string;
  sha?: string | null;
}

export async function getFileSha(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch?: string,
): Promise<string | null> {
  const client = createClient(token);
  try {
    const res = await client.get<{ sha: string }>(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      { params: branch ? { ref: branch } : undefined },
    );
    return res.data.sha;
  } catch (err) {
    if (err instanceof GithubApiError && err.status === 404) return null;
    throw err;
  }
}

export async function putFile(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  params: PutFileParams,
): Promise<void> {
  const client = createClient(token);
  const body: Record<string, unknown> = {
    message: params.message,
    content: params.contentBase64,
    branch,
  };
  if (params.sha) body.sha = params.sha;
  await client.put(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(params.path)}`,
    body,
  );
}

export interface CommitFile {
  path: string;
  contentBase64: string;
  message?: string;
}

export async function putMultipleFiles(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  files: CommitFile[],
  defaultMessage: string,
): Promise<void> {
  for (const file of files) {
    const sha = await getFileSha(token, owner, repo, file.path, branch);
    await putFile(token, owner, repo, branch, {
      path: file.path,
      contentBase64: file.contentBase64,
      message: file.message ?? defaultMessage,
      sha,
    });
  }
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
      throw new GithubApiError(
        `Repository "${owner}/${repo}" not found, or the path is empty.`,
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
    if (entry.type === 'file' && isAudioFile(entry.name) && entry.download_url) {
      audioFiles.push({
        name: entry.name,
        title: entry.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
        path: entry.path,
        downloadUrl: entry.download_url,
        size: entry.size,
      });
    }
  }

  return audioFiles.sort((a, b) => a.name.localeCompare(b.name));
}