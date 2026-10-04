import RNFS from 'react-native-fs';

const ASSET_DIR_APK = 'user-assets';
const ASSET_CACHE_DIR = `${RNFS.DocumentDirectoryPath}/asset-cache`;

const resolvedCache: Record<string, string> = {};

export async function prepareAssetCache(): Promise<void> {
  try {
    const exists = await RNFS.exists(ASSET_CACHE_DIR);
    if (!exists) {
      await RNFS.mkdir(ASSET_CACHE_DIR);
    }

    const copyIfNeeded = async (filename: string): Promise<void> => {
      const dest = `${ASSET_CACHE_DIR}/${filename}`;
      const destExists = await RNFS.exists(dest);
      if (destExists) return;
      const src = `assets/${ASSET_DIR_APK}/${filename}`;
      try {
        const content = await RNFS.readFileAssets(src, 'base64');
        await RNFS.writeFile(dest, content, 'base64');
      } catch {
        // skip missing assets
      }
    };

    const list = await RNFS.readDirAssets(ASSET_DIR_APK);
    for (const item of list) {
      if (item.isFile()) {
        await copyIfNeeded(item.name);
      }
    }
  } catch {
    // best-effort
  }
}

export function resolveRuntimeUri(uri: string): string {
  if (!uri.startsWith('asset://')) return uri;
  const filename = uri.substring('asset://'.length);
  if (resolvedCache[filename]) return resolvedCache[filename];
  const dest = `file://${ASSET_CACHE_DIR}/${filename}`;
  resolvedCache[filename] = dest;
  return dest;
}