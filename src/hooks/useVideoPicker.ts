import { useCallback, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import {
  launchImageLibrary,
  type Asset,
  type ImageLibraryOptions,
} from 'react-native-image-picker';
import RNFS from 'react-native-fs';

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

      const ext = guessExtFromType(asset.type);
      const fileName = safeFileName(asset.fileName ?? undefined, ext);
      const dir = `${RNFS.DocumentDirectoryPath}/videos`;
      const destPath = `${dir}/${Date.now()}_${fileName}`;

      const dirExists = await RNFS.exists(dir);
      if (!dirExists) {
        await RNFS.mkdir(dir);
      }

      const sourceUri = asset.uri.startsWith('file://')
        ? asset.uri.replace('file://', '')
        : asset.uri;

      await RNFS.copyFile(sourceUri, destPath);

      return {
        uri: `file://${destPath}`,
        fileName,
        type: asset.type ?? `video/${ext}`,
        size: asset.fileSize ?? 0,
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