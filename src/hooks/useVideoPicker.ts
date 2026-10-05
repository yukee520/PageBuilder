import { useCallback, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import {
  launchImageLibrary,
  type Asset,
  type ImageLibraryOptions,
} from 'react-native-image-picker';
import RNFS from 'react-native-fs';

/**
 * Maximum size (bytes) for a locally-picked video.
 *
 * Videos are bundled into the generated APK by reading the whole file as
 * base64. A ~15 MB source becomes ~20 MB of base64 JS string, which is
 * about the ceiling we can push through the Git Data API without
 * risking an OOM in PageBuilder itself.
 *
 * Larger videos must be uploaded to GitHub (or any host) and referenced
 * by URL.
 */
export const MAX_LOCAL_VIDEO_BYTES = 15 * 1024 * 1024; // 15 MB

export interface PickedVideo {
  uri: string;
  fileName: string;
  type: string;
  size: number;
}

export interface UseVideoPickerResult {
  picking: boolean;
  pick: () => Promise<PickedVideo | null>;
}

async function ensureAndroidPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const version = Platform.Version;
  if (typeof version === 'number' && version >= 33) return true;
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: 'Storage permission',
        message: 'We need access to your videos to add them to your app.',
        buttonPositive: 'Allow',
        buttonNegative: 'Cancel',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function safeFileName(name: string | undefined, fallbackExt: string): string {
  const base = (name ?? `video_${Date.now()}.${fallbackExt}`).replace(
    /[^a-zA-Z0-9._-]/g,
    '_',
  );
  return base;
}

function guessExtFromType(type: string | undefined): string {
  if (!type) return 'mp4';
  if (type.includes('quicktime')) return 'mov';
  if (type.includes('webm')) return 'webm';
  if (type.includes('matroska')) return 'mkv';
  if (type.includes('3gpp')) return '3gp';
  return 'mp4';
}

function stripFileScheme(uri: string): string {
  return uri.startsWith('file://') ? uri.replace('file://', '') : uri;
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showTooLargeAlert(sizeBytes: number): void {
  Alert.alert(
    'Video too large',
    `This video is ${formatMb(
      sizeBytes,
    )}. Videos bundled into your app must be under ${formatMb(
      MAX_LOCAL_VIDEO_BYTES,
    )}.\n\nFor longer videos, upload the file to GitHub (or any host) and paste the URL into the Video URL field instead.`,
    [{ text: 'Got it' }],
  );
}

export function useVideoPicker(): UseVideoPickerResult {
  const [picking, setPicking] = useState<boolean>(false);

  const pick = useCallback(async (): Promise<PickedVideo | null> => {
    setPicking(true);
    try {
      const granted = await ensureAndroidPermission();
      if (!granted) {
        Alert.alert(
          'Permission denied',
          'Storage permission is required to pick videos.',
        );
        return null;
      }

      const options: ImageLibraryOptions = {
        mediaType: 'video',
        selectionLimit: 1,
        includeBase64: false,
      };

      const response = await launchImageLibrary(options);

      if (response.didCancel) return null;

      if (response.errorCode) {
        Alert.alert(
          'Could not open gallery',
          response.errorMessage ?? 'Please try again.',
        );
        return null;
      }

      const asset: Asset | undefined = response.assets?.[0];
      if (!asset || !asset.uri) {
        Alert.alert('No video selected', 'Please pick a video.');
        return null;
      }

      // ── Size gate #1: trust asset.fileSize when the picker supplies it.
      if (typeof asset.fileSize === 'number' && asset.fileSize > 0) {
        if (asset.fileSize > MAX_LOCAL_VIDEO_BYTES) {
          showTooLargeAlert(asset.fileSize);
          return null;
        }
      }

      const sourcePath = stripFileScheme(asset.uri);

      // ── Size gate #2: some Android providers omit fileSize entirely.
      // Stat the source file before we copy, so we never even make a
      // local copy of an oversized video.
      let actualSize = asset.fileSize ?? 0;
      if (actualSize === 0) {
        try {
          const stat = await RNFS.stat(sourcePath);
          actualSize = Number(stat.size) || 0;
        } catch {
          // If we can't stat it, fall through — the copy will fail with a
          // clear error if the file is truly inaccessible.
        }
        if (actualSize > MAX_LOCAL_VIDEO_BYTES) {
          showTooLargeAlert(actualSize);
          return null;
        }
      }

      const ext = guessExtFromType(asset.type);
      const fileName = safeFileName(asset.fileName ?? undefined, ext);
      const dir = `${RNFS.DocumentDirectoryPath}/videos`;
      const destPath = `${dir}/${Date.now()}_${fileName}`;

      const dirExists = await RNFS.exists(dir);
      if (!dirExists) {
        await RNFS.mkdir(dir);
      }

      await RNFS.copyFile(sourcePath, destPath);

      return {
        uri: `file://${destPath}`,
        fileName,
        type: asset.type ?? `video/${ext}`,
        size: actualSize,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error picking video.';
      Alert.alert('Video picker failed', message);
      return null;
    } finally {
      setPicking(false);
    }
  }, []);

  return { picking, pick };
}