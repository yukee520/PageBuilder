import { useCallback, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import {
  launchImageLibrary,
  type Asset,
  type ImageLibraryOptions,
} from 'react-native-image-picker';
import DocumentPicker, {
  types as docTypes,
  type DocumentPickerResponse,
} from 'react-native-document-picker';
import RNFS from 'react-native-fs';

export interface PickedAsset {
  /** `file://` URI pointing at a local copy of the file. */
  uri: string;
  /** Original filename as reported by the picker. */
  fileName: string;
  /** MIME type, if the picker provided one. */
  mimeType: string;
  /** File size in bytes. */
  size: number;
}

export interface UseAssetPickerResult {
  picking: boolean;
  pickImage: () => Promise<PickedAsset | null>;
  pickAudio: () => Promise<PickedAsset | null>;
}

/**
 * Some Android providers omit `fileSize`. When that happens we stat the
 * file ourselves so the uploader can enforce the size cap.
 */
async function ensureSize(uri: string, reported: number | undefined): Promise<number> {
  if (typeof reported === 'number' && reported > 0) return reported;
  try {
    const path = uri.startsWith('file://') ? uri.replace('file://', '') : uri;
    const stat = await RNFS.stat(path);
    return Number(stat.size) || 0;
  } catch {
    return 0;
  }
}

async function ensureAndroidStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const version = Platform.Version;
  if (typeof version === 'number' && version >= 33) return true;
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      {
        title: 'Storage permission',
        message: 'We need access to your files to upload assets.',
        buttonPositive: 'Allow',
        buttonNegative: 'Cancel',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function safeFileName(name: string | undefined | null, fallback: string): string {
  const base = (name ?? fallback).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.length > 0 ? base : fallback;
}

function guessImageExt(type: string | undefined): string {
  if (!type) return 'jpg';
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('gif')) return 'gif';
  if (type.includes('heic')) return 'heic';
  if (type.includes('heif')) return 'heif';
  return 'jpg';
}

function guessAudioExt(type: string | undefined, name: string | undefined): string {
  if (type) {
    if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
    if (type.includes('mp4') || type.includes('m4a')) return 'm4a';
    if (type.includes('wav')) return 'wav';
    if (type.includes('ogg')) return 'ogg';
    if (type.includes('aac')) return 'aac';
    if (type.includes('flac')) return 'flac';
  }
  if (name) {
    const match = name.match(/\.([a-zA-Z0-9]{2,5})$/);
    if (match) return match[1].toLowerCase();
  }
  return 'mp3';
}

function responseToPickedAsset(
  uri: string,
  fileName: string,
  mimeType: string,
  size: number,
): PickedAsset {
  return { uri, fileName, mimeType, size };
}

/**
 * Hook for picking image or audio assets from the device.
 *
 * Two methods:
 *   - `pickImage` — uses `react-native-image-picker` with `mediaType: 'photo'`.
 *   - `pickAudio` — uses `react-native-document-picker` filtered to audio MIME types.
 *
 * Both methods return null on cancel or error (after showing an alert).
 * The returned size is always a real number — if the OS provider doesn't
 * report one, the file is stat'ed locally.
 *
 * Note: videos are deliberately NOT supported here. Large videos are
 * impractical to upload to GitHub. The video component editor continues
 * to use its own picker (with a 15 MB cap) or a pasted URL.
 */
export function useAssetPicker(): UseAssetPickerResult {
  const [picking, setPicking] = useState<boolean>(false);

  const pickImage = useCallback(async (): Promise<PickedAsset | null> => {
    setPicking(true);
    try {
      const granted = await ensureAndroidStoragePermission();
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

      const ext = guessImageExt(asset.type);
      const fileName = safeFileName(asset.fileName ?? undefined, `image.${ext}`);
      const mimeType = asset.type ?? `image/${ext}`;
      const size = await ensureSize(asset.uri, asset.fileSize);

      return responseToPickedAsset(asset.uri, fileName, mimeType, size);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error picking image.';
      Alert.alert('Image picker failed', message);
      return null;
    } finally {
      setPicking(false);
    }
  }, []);

  const pickAudio = useCallback(async (): Promise<PickedAsset | null> => {
    setPicking(true);
    try {
      const granted = await ensureAndroidStoragePermission();
      if (!granted) {
        Alert.alert(
          'Permission denied',
          'Storage permission is required to pick audio files.',
        );
        return null;
      }

      let response: DocumentPickerResponse | null = null;
      try {
        response = await DocumentPicker.pickSingle({
          type: [docTypes.audio],
          copyTo: 'cachesDirectory',
        });
      } catch (err) {
        // DocumentPicker throws on cancel.
        if (DocumentPicker.isCancel(err)) return null;
        throw err;
      }

      if (!response || !response.uri) {
        Alert.alert('No file selected', 'Please pick an audio file.');
        return null;
      }

      const fileNameRaw = response.name ?? undefined;
      const mimeType = response.type ?? undefined;
      const ext = guessAudioExt(mimeType, fileNameRaw ?? undefined);
      const fileName = safeFileName(fileNameRaw, `audio.${ext}`);
      const finalMime = mimeType ?? `audio/${ext}`;
      const size = await ensureSize(response.uri, response.size ?? undefined);

      return responseToPickedAsset(
        response.uri,
        fileName,
        finalMime,
        size,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error picking audio.';
      Alert.alert('Audio picker failed', message);
      return null;
    } finally {
      setPicking(false);
    }
  }, []);

  return { picking, pickImage, pickAudio };
}