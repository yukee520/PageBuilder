import RNFS from 'react-native-fs';

const ASSET_DIR_IN_APK = 'user-assets';
const ASSET_CACHE_DIR = `${RNFS.DocumentDirectoryPath}/asset-cache`;

const resolvedCache: Record<string, string> = {};
let prepPromise: Promise<void> | null = null;

export function prepareAssetCache(): Promise<void> {
  if (prepPromise) return prepPromise;

  prepPromise = (async () => {
    try {
      const cacheExists = await RNFS.exists(ASSET_CACHE_DIR);
      if (!cacheExists) {
        await RNFS.mkdir(ASSET_CACHE_DIR);
      }

      let assetList: Awaited<ReturnType<typeof RNFS.readDirAssets>> = [];
      try {
        assetList = await RNFS.readDirAssets(ASSET_DIR_IN_APK);
      } catch {
        assetList = [];
      }

      for (const item of assetList) {
        if (!item.isFile()) continue;

        const dest = `${ASSET_CACHE_DIR}/${item.name}`;
        const destExists = await RNFS.exists(dest);
        if (destExists) continue;

        try {
          const base64 = await RNFS.readFileAssets(
            `${ASSET_DIR_IN_APK}/${item.name}`,
            'base64',
          );
          await RNFS.writeFile(dest, base64, 'base64');
        } catch {
          // skip individual file failures
        }
      }
    } catch {
      // best-effort; runtime will fall back to missing images
    }
  })();

  return prepPromise;
}

export function resolveRuntimeUri(uri: string): string {
  if (!uri) return uri;
  if (!uri.startsWith('asset://')) return uri;

  const filename = uri.substring('asset://'.length);
  if (!filename) return '';

  if (resolvedCache[filename]) {
    return resolvedCache[filename];
  }

  const resolved = `file://${ASSET_CACHE_DIR}/${filename}`;
  resolvedCache[filename] = resolved;
  return resolved;
}

export function getAssetCacheDir(): string {
  return ASSET_CACHE_DIR;
}