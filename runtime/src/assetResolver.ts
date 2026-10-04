import RNFS from 'react-native-fs';

const ASSET_DIR_IN_APK = 'user-assets';
const ASSET_CACHE_DIR = `${RNFS.DocumentDirectoryPath}/asset-cache`;

const resolvedCache: Record<string, string> = {};
let prepPromise: Promise<void> | null = null;

export interface AssetDebugInfo {
  attempted: boolean;
  cacheDir: string;
  cacheDirExists: boolean;
  filesFound: number;
  fileNames: string[];
  filesCopied: number;
  errors: string[];
}

const debugInfo: AssetDebugInfo = {
  attempted: false,
  cacheDir: ASSET_CACHE_DIR,
  cacheDirExists: false,
  filesFound: 0,
  fileNames: [],
  filesCopied: 0,
  errors: [],
};

export function getAssetDebugInfo(): AssetDebugInfo {
  return { ...debugInfo, fileNames: [...debugInfo.fileNames], errors: [...debugInfo.errors] };
}

export function prepareAssetCache(): Promise<void> {
  if (prepPromise) return prepPromise;

  debugInfo.attempted = true;

  prepPromise = (async () => {
    try {
      const cacheExists = await RNFS.exists(ASSET_CACHE_DIR);
      debugInfo.cacheDirExists = cacheExists;

      if (!cacheExists) {
        try {
          await RNFS.mkdir(ASSET_CACHE_DIR);
          debugInfo.cacheDirExists = true;
        } catch (e) {
          debugInfo.errors.push(
            `mkdir failed: ${e instanceof Error ? e.message : String(e)}`,
          );
          return;
        }
      }

      let assetList: Awaited<ReturnType<typeof RNFS.readDirAssets>> = [];
      try {
        assetList = await RNFS.readDirAssets(ASSET_DIR_IN_APK);
      } catch (e) {
        debugInfo.errors.push(
          `readDirAssets failed: ${e instanceof Error ? e.message : String(e)}`,
        );
        return;
      }

      debugInfo.filesFound = assetList.length;
      debugInfo.fileNames = assetList.map(f => f.name);

      for (const item of assetList) {
        if (!item.isFile()) continue;

        const dest = `${ASSET_CACHE_DIR}/${item.name}`;
        const destExists = await RNFS.exists(dest);
        if (destExists) {
          debugInfo.filesCopied += 1;
          continue;
        }

        try {
          const base64 = await RNFS.readFileAssets(
            `${ASSET_DIR_IN_APK}/${item.name}`,
            'base64',
          );
          await RNFS.writeFile(dest, base64, 'base64');
          debugInfo.filesCopied += 1;
        } catch (e) {
          debugInfo.errors.push(
            `copy ${item.name} failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    } catch (e) {
      debugInfo.errors.push(
        `outer failed: ${e instanceof Error ? e.message : String(e)}`,
      );
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