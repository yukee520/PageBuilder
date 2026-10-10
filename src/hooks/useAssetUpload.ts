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
  | { kind: 'uploading'; fileName: string; kind: UploadKind }
  | { kind: 'done'; result: UploadResult; fileName: string }
  | { kind: 'error'; message: string; kind: UploadKind; fileName: string };

export interface UploadContext {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
}

export interface UseAssetUploadResult {
  /** Current status of the hook. */
  phase: UploadPhase;
  /** True while a file is being uploaded. */
  uploading: boolean;
  /**
   * Upload a local file to the repo.
   *
   * Returns the result on success, or `null` on failure (with the error
   * message stored in `phase`).
   */
  upload: (params: {
    localUri: string;
    fileName: string;
    mimeType?: string;
    kind: UploadKind;
  }) => Promise<UploadResult | null>;
  /** Clear the phase back to idle — call after a success or error toast. */
  reset: () => void;
}

/**
 * Build the upload context from a project + a token.
 *
 * Returns null if the project isn't linked to a repo, or if no token is
 * available. Callers use this to decide whether to show the "Upload to
 * repo" button at all.
 */
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

/**
 * React hook for uploading assets to the project's GitHub repo.
 *
 * The hook is deliberately narrow: it holds a single-file upload state
 * machine. Concurrent uploads aren't supported — the editor UIs are
 * single-file anyway, and this avoids a queueing layer.
 *
 * Usage:
 *   const { uploading, upload, phase } = useAssetUpload(context);
 *   ...
 *   const result = await upload({ localUri, fileName, mimeType, kind: 'image' });
 *   if (result) setComponentUri(result.url);
 */
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
          kind: params.kind,
          fileName: params.fileName,
        });
        return null;
      }

      uploadingRef.current = true;
      setPhase({
        kind: 'uploading',
        fileName: params.fileName,
        kind: params.kind,
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
          kind: params.kind,
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

/**
 * Turn an unknown error into a message suitable for display.
 * Uses the type guards from `assetUploader` to distinguish "user problem"
 * from "GitHub problem".
 */
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