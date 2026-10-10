import { useCallback, useRef, useState } from 'react';
import {
  AssetUploadError,
  isAuthError,
  isOversizeError,
  uploadAsset,
  type UploadKind,
  type UploadResult,
} from '@/services/assetUploader';
import type { Project } from '@/types/project';

export type UploadPhase =
  | { kind: 'idle' }
  | { kind: 'uploading'; fileName: string; assetKind: UploadKind }
  | { kind: 'done'; result: UploadResult; fileName: string }
  | {
      kind: 'error';
      message: string;
      assetKind: UploadKind;
      fileName: string;
    };

export interface UploadContext {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
}

export interface UseAssetUploadResult {
  phase: UploadPhase;
  uploading: boolean;
  upload: (params: {
    localUri: string;
    fileName: string;
    mimeType?: string;
    kind: UploadKind;
  }) => Promise<UploadResult | null>;
  reset: () => void;
}

export function buildUploadContext(
  project: Project | null,
  token: string | null | undefined,
): UploadContext | null {
  if (!project) return null;
  if (!token || !token.trim()) return null;
  if (!project.repoOwner || !project.repoName) return null;
  return {
    token,
    owner: project.repoOwner,
    repo: project.repoName,
  };
}

export function useAssetUpload(
  context: UploadContext | null,
): UseAssetUploadResult {
  const [phase, setPhase] = useState<UploadPhase>({ kind: 'idle' });
  const uploadingRef = useRef<boolean>(false);

  const reset = useCallback((): void => {
    uploadingRef.current = false;
    setPhase({ kind: 'idle' });
  }, []);

  const upload = useCallback(
    async (params: {
      localUri: string;
      fileName: string;
      mimeType?: string;
      kind: UploadKind;
    }): Promise<UploadResult | null> => {
      if (uploadingRef.current) {
        return null;
      }

      if (!context) {
        setPhase({
          kind: 'error',
          message:
            'This project is not linked to a GitHub repo, or no token is set. Configure one in Project Settings.',
          assetKind: params.kind,
          fileName: params.fileName,
        });
        return null;
      }

      uploadingRef.current = true;
      setPhase({
        kind: 'uploading',
        fileName: params.fileName,
        assetKind: params.kind,
      });

      try {
        const result = await uploadAsset({
          token: context.token,
          owner: context.owner,
          repo: context.repo,
          branch: context.branch,
          localUri: params.localUri,
          fileName: params.fileName,
          mimeType: params.mimeType,
          kind: params.kind,
        });

        setPhase({
          kind: 'done',
          result,
          fileName: params.fileName,
        });
        uploadingRef.current = false;
        return result;
      } catch (err) {
        const message = humanizeError(err);
        setPhase({
          kind: 'error',
          message,
          assetKind: params.kind,
          fileName: params.fileName,
        });
        uploadingRef.current = false;
        return null;
      }
    },
    [context],
  );

  return {
    phase,
    uploading: phase.kind === 'uploading',
    upload,
    reset,
  };
}

function humanizeError(err: unknown): string {
  if (err instanceof AssetUploadError) {
    if (isOversizeError(err)) {
      return err.message;
    }
    return err.message;
  }
  if (isAuthError(err)) {
    return 'GitHub rejected the request. Check your token in Settings.';
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Upload failed. Please try again.';
}