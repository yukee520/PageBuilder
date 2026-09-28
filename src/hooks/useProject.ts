import { useCallback, useEffect, useRef, useState } from 'react';
import type { Project } from '@/types/project';
import { loadProjectFile, saveProjectFile } from '@/hooks/useProjects';

export interface UseProjectResult {
  project: Project | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  reload: () => Promise<void>;
  save: (next: Project) => Promise<void>;
}

const AUTOSAVE_DEBOUNCE_MS = 800;

export function useProject(projectId: string | null): UseProjectResult {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!projectId) {
      setProject(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadProjectFile(projectId);
      setProject(loaded);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load project.';
      setError(message);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const save = useCallback(async (next: Project): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const withTimestamp: Project = { ...next, updatedAt: Date.now() };
    setSaving(true);
    try {
      await saveProjectFile(withTimestamp);
      setProject(withTimestamp);
    } finally {
      setSaving(false);
    }
  }, []);

  const scheduleSave = useCallback((next: Project): void => {
    setProject(next);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      const withTimestamp: Project = { ...next, updatedAt: Date.now() };
      setSaving(true);
      saveProjectFile(withTimestamp)
        .catch(() => {
          setError('Autosave failed. Your changes are still in memory.');
        })
        .finally(() => {
          setSaving(false);
          timerRef.current = null;
        });
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    void load();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [load]);

  return {
    project,
    loading,
    error,
    saving,
    reload: load,
    save: async (next: Project) => {
      await save(next);
    },
  };
}