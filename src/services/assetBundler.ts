import RNFS from 'react-native-fs';
import type { PageComponent, PageComponent as PC } from '@/types/component';
import type { Project } from '@/types/project';
import type { CommitAction } from '@/api/github';

const ASSET_DIR_IN_REPO = 'assets/user-assets';
const ASSET_DIR_IN_APK = 'user-assets';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
  'video/3gpp': '3gp',
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

export interface BundledAssets {
  actions: CommitAction[];
  updatedProjectJson: string;
  fileCount: number;
}

function extensionForFile(uri: string, mimeType?: string): string {
  if (mimeType && MIME_EXTENSIONS[mimeType]) {
    return MIME_EXTENSIONS[mimeType];
  }
  const clean = uri.split('?')[0].split('#')[0];
  const match = clean.match(/\.([a-zA-Z0-9]{2,5})$/);
  if (match) return match[1].toLowerCase();
  return 'bin';
}

function isLocalUri(uri: string): boolean {
  return uri.startsWith('file://') || uri.startsWith('/');
}

function stripFileScheme(uri: string): string {
  return uri.startsWith('file://') ? uri.replace('file://', '') : uri;
}

interface ComponentKey {
  pageId: string;
  componentId: string;
  field: 'uri' | 'url';
}

async function readLocalFileAsBase64(uri: string): Promise<string | null> {
  try {
    const path = stripFileScheme(uri);
    const exists = await RNFS.exists(path);
    if (!exists) return null;
    return await RNFS.readFile(path, 'base64');
  } catch {
    return null;
  }
}

function makeAssetMarker(componentId: string, ext: string): string {
  return `asset://${componentId}.${ext}`;
}

function makeAssetRepoPath(componentId: string, ext: string): string {
  return `${ASSET_DIR_IN_REPO}/${componentId}.${ext}`;
}

export function resolveAssetMarkerToRuntimeUri(marker: string): string {
  if (!marker.startsWith('asset://')) return marker;
  const filename = marker.substring('asset://'.length);
  return `file:///android_asset/${ASSET_DIR_IN_APK}/${filename}`;
}

export async function bundleLocalAssets(
  project: Project,
): Promise<BundledAssets> {
  const actions: CommitAction[] = [];
  let fileCount = 0;

  const projectCopy: Project = JSON.parse(JSON.stringify(project));

  for (const page of projectCopy.pages) {
    for (const component of page.components) {
      await processComponent(component, actions, () => {
        fileCount += 1;
      });
    }
  }

  return {
    actions,
    updatedProjectJson: JSON.stringify(
      { version: 2, project: projectCopy },
      null,
      2,
    ),
    fileCount,
  };
}

async function processComponent(
  component: PageComponent,
  actions: CommitAction[],
  onFileAdded: () => void,
): Promise<void> {
  const c = component as unknown as {
    type: string;
    id: string;
    uri?: string;
    url?: string;
    children?: PC[];
  };

  if (c.type === 'row' && Array.isArray(c.children)) {
    for (const child of c.children) {
      await processComponent(child, actions, onFileAdded);
    }
    return;
  }

  if (c.type === 'image' && c.uri && isLocalUri(c.uri)) {
    const base64 = await readLocalFileAsBase64(c.uri);
    if (!base64) return;
    const ext = extensionForFile(c.uri);
    const marker = makeAssetMarker(c.id, ext);
    const repoPath = makeAssetRepoPath(c.id, ext);
    actions.push({
      path: repoPath,
      contentBase64: base64,
      message: `asset image ${c.id}`,
    });
    (component as unknown as { uri: string }).uri = marker;
    onFileAdded();
    return;
  }

  if (c.type === 'video' && c.url && isLocalUri(c.url)) {
    const base64 = await readLocalFileAsBase64(c.url);
    if (!base64) return;
    const ext = extensionForFile(c.url);
    const marker = makeAssetMarker(c.id, ext);
    const repoPath = makeAssetRepoPath(c.id, ext);
    actions.push({
      path: repoPath,
      contentBase64: base64,
      message: `asset video ${c.id}`,
    });
    (component as unknown as { url: string }).url = marker;
    onFileAdded();
    return;
  }
}

export function getAssetDirInApk(): string {
  return ASSET_DIR_IN_APK;
}