import RNFS from 'react-native-fs';
import {
  GithubApiError,
  fileExistsInRepo,
  putFileToRepo,
  putLargeFileToRepo,
  type PutFileResult,
} from '@/api/github';

/**
 * Where uploaded files land inside the project repo.
 * Example: `assets/uploads/hero-1704858123.jpg`
 */
const UPLOAD_DIR = 'assets/uploads';

/**
 * The GitHub Contents API begins to struggle above about 1 MB because
 * the entire payload is base64-encoded JSON. Above this threshold, we
 * switch to the Git Data API (blob → tree → commit → ref).
 */
const LARGE_FILE_THRESHOLD_BYTES = 1024 * 1024; // 1 MB

/**
 * Ceilings on what we will attempt to upload at all. Above these sizes,
 * the UI should tell the user to host the file elsewhere.
 */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // 15 MB

export type UploadKind = 'image' | 'audio';

export interface UploadRequest {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
  /** Local file URI. May include a `file://` scheme. */
  localUri: string;
  /** Original file name; used to pick a stable extension. */
  fileName: string;
  /** MIME type, used to pick an extension when fileName has none. */
  mimeType?: string;
  kind: UploadKind;
}

export interface UploadResult {
  /** The path inside the repo. e.g. `assets/uploads/hero.jpg` */
  repoPath: string;
  /** A URL the runtime can fetch. */
  url: string;
  /** Size in bytes of the uploaded file. */
  size: number;
  /** Which API was used — useful for diagnostics. */
  method: 'contents' | 'git-data';
}

export class AssetUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssetUploadError';
  }
}

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
};

function stripFileScheme(uri: string): string {
  return uri.startsWith('file://') ? uri.replace('file://', '') : uri;
}

function extensionFromName(name: string): string | null {
  const cleaned = name.split('?')[0].split('#')[0];
  const match = cleaned.match(/\.([a-zA-Z0-9]{2,5})$/);
  return match ? match[1].toLowerCase() : null;
}

function pickExtension(
  fileName: string,
  mimeType: string | undefined,
  kind: UploadKind,
): string {
  const fromMime = mimeType ? MIME_EXTENSION[mimeType] : undefined;
  if (fromMime) return fromMime;
  const fromName = extensionFromName(fileName);
  if (fromName) return fromName;
  // Safe fallbacks per kind.
  return kind === 'image' ? 'jpg' : 'mp3';
}

/**
 * Build a safe filename.
 *
 *   - Only ASCII letters, digits, dot, dash, underscore
 *   - Prefix with the component kind and a timestamp to avoid collisions
 *   - The original name is preserved as much as possible so the file is
 *     recognizable on GitHub
 *
 * Example: `hero.png` -> `image-hero-1704858123.png`
 */
function buildFileName(
  originalName: string,
  ext: string,
  kind: UploadKind,
): string {
  const stemRaw = originalName
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  const stem = stemRaw || kind;
  const timestamp = Date.now();
  return `${kind}-${stem}-${timestamp}.${ext}`;
}

async function readFileSizeBytes(localPath: string): Promise<number> {
  const stat = await RNFS.stat(localPath);
  const size = Number(stat.size);
  if (!Number.isFinite(size)) {
    throw new AssetUploadError('Could not determine the file size.');
  }
  return size;
}

async function readFileAsBase64(localPath: string): Promise<string> {
  return RNFS.readFile(localPath, 'base64');
}

/**
 * Upload a local image or audio file to the project's GitHub repo.
 *
 * Behaviour:
 *   - Validates that the file exists and is within the size cap for its
 *     kind (image: 8 MB, audio: 15 MB).
 *   - Picks an extension based on MIME type or filename.
 *   - Names the file as `<kind>-<stem>-<timestamp>.<ext>` to avoid
 *     collisions and keep the repo tidy.
 *   - Uses the Contents API below 1 MB and the Git Data API above it.
 *   - Returns a `PutFileResult` with the URL the runtime will fetch.
 *
 * Throws `AssetUploadError` on any user-facing failure. Network or API
 * errors bubble up as `GithubApiError`.
 */
export async function uploadAsset(
  request: UploadRequest,
): Promise<UploadResult> {
  const {
    token,
    owner,
    repo,
    branch = 'main',
    localUri,
    fileName,
    mimeType,
    kind,
  } = request;

  if (!token || !token.trim()) {
    throw new AssetUploadError(
      'No GitHub token available. Add one in Settings.',
    );
  }
  if (!owner || !repo) {
    throw new AssetUploadError(
      'This project is not linked to a GitHub repo. Set one up in Project Settings.',
    );
  }

  const localPath = stripFileScheme(localUri);

  const exists = await RNFS.exists(localPath);
  if (!exists) {
    throw new AssetUploadError('The file could not be found on the device.');
  }

  const size = await readFileSizeBytes(localPath);

  const cap = kind === 'image' ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
  if (size > cap) {
    const capMb = Math.round(cap / (1024 * 1024));
    const sizeMb = (size / (1024 * 1024)).toFixed(1);
    throw new AssetUploadError(
      `File is too large (${sizeMb} MB). The limit is ${capMb} MB for ${kind}s. Use an external URL for larger files.`,
    );
  }

  const ext = pickExtension(fileName, mimeType, kind);
  const finalName = buildFileName(fileName, ext, kind);
  const repoPath = `${UPLOAD_DIR}/${finalName}`;

  // If the same name somehow already exists (unlikely because of the
  // timestamp suffix, but possible if the user taps Upload twice in the
  // same second), bail out cleanly rather than overwrite silently.
  const collision = await fileExistsInRepo(token, owner, repo, repoPath, branch);
  if (collision) {
    throw new AssetUploadError(
      'A file with this name already exists in the repo. Try again in a moment.',
    );
  }

  const contentBase64 = await readFileAsBase64(localPath);

  let result: PutFileResult;
  let method: 'contents' | 'git-data';

  if (size < LARGE_FILE_THRESHOLD_BYTES) {
    result = await putFileToRepo(
      token,
      owner,
      repo,
      repoPath,
      contentBase64,
      `Upload ${kind}: ${finalName}`,
      branch,
    );
    method = 'contents';
  } else {
    result = await putLargeFileToRepo(
      token,
      owner,
      repo,
      repoPath,
      contentBase64,
      `Upload ${kind}: ${finalName}`,
      branch,
    );
    method = 'git-data';
  }

  return {
    repoPath: result.path,
    url: result.url,
    size,
    method,
  };
}

/**
 * Given a URL, return the file extension or null. Useful for the runtime
 * to display the right icon or for editor UIs to show what kind of asset
 * is referenced.
 */
export function extensionFromUrl(url: string): string | null {
  return extensionFromName(url);
}

/**
 * Format a byte count for display in the editor UI.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Was this error caused by the upload exceeding the size cap?
 * The editor uses this to show a friendlier message that points at the
 * URL field.
 */
export function isOversizeError(err: unknown): boolean {
  return (
    err instanceof AssetUploadError && err.message.includes('too large')
  );
}

/**
 * Was this error caused by a missing or invalid token? The editor uses
 * this to link the user to Settings.
 */
export function isAuthError(err: unknown): boolean {
  return err instanceof GithubApiError && err.status === 401;
}