import { useCallback, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import {
  launchImageLibrary,
  type Asset,
  type ImageLibraryOptions,
} from 'react-native-image-picker';
import RNFS from 'react-native-fs';

export interface PickedImage {
  uri: string;
  fileName: string;
  type: string;
  size: number;
}

export interface UseImagePickerResult {
  picking: boolean;
  pick: () => Promise<PickedImage | null>;
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
        message: 'We need access to your photos to add them to your app.',
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
  const base = (name ?? `image_${Date.now()}.${fallbackExt}`).replace(
    /[^a-zA-Z0-9._-]/g,
    '_',
  );
  return base;
}

function guessExtFromType(type: string | undefined): string {
  if (!type) return 'jpg';
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('gif')) return 'gif';
  if (type.includes('heic')) return 'heic';
  return 'jpg';
}

export function useImagePicker(): UseImagePickerResult {
  const [picking, setPicking] = useState<boolean>(false);

  const pick = useCallback(async (): Promise<PickedImage | null> => {
    setPicking(true);
    try {
      const granted = await ensureAndroidPermission();
      if (!granted) {
        Alert.alert(
          'Permission denied',
          'Storage permission is required to pick images.',
        );
        return null;
      }

      const options: ImageLibraryOptions = {
        mediaType: 'photo',
        selectionLimit: 1,
        quality: 0.9,
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
        Alert.alert('No image selected', 'Please pick an image.');
        return null;
      }

      const ext = guessExtFromType(asset.type);
      const fileName = safeFileName(asset.fileName ?? undefined, ext);
      const dir = `${RNFS.DocumentDirectoryPath}/images`;
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
        type: asset.type ?? `image/${ext}`,
        size: asset.fileSize ?? 0,
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error picking image.';
      Alert.alert('Image picker failed', message);
      return null;
    } finally {
      setPicking(false);
    }
  }, []);

  return { picking, pick };
}