import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import type { Project, ProjectIndex, ProjectMeta } from '@/types/project';
import { PROJECT_FILE_VERSION } from '@/types/project';
import { toProjectMeta } from '@/utils/format';
import { migrateProject } from '@/utils/migrate';

const INDEX_KEY = '@pagebuilder/project-index';
const PROJECTS_DIR = `${RNFS.DocumentDirectoryPath}/projects`;

async function ensureDir(): Promise<void> {
  const exists = await RNFS.exists(PROJECTS_DIR);
  if (!exists) {
    await RNFS.mkdir(PROJECTS_DIR);
  }
}

function projectFilePath(id: string): string {
  return `${PROJECTS_DIR}/${id}.json`;
}

async function readIndex(): Promise<ProjectIndex> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    if (!raw) return { projects: [] };
    const parsed = JSON.parse(raw) as ProjectIndex;
    if (!parsed || !Array.isArray(parsed.projects)) return { projects: [] };
    return parsed;
  } catch {
    return { projects: [] };
  }
}

async function writeIndex(index: ProjectIndex): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

function upsertMeta(index: ProjectIndex, meta: ProjectMeta): ProjectIndex {
  const others = index.projects.filter(p => p.id !== meta.id);
  const projects = [meta, ...others].sort((a, b) => b.updatedAt - a.updatedAt);
  return { projects };
}

export async function loadProjectFile(id: string): Promise<Project> {
  const path = projectFilePath(id);
  const exists = await RNFS.exists(path);
  if (!exists) {
    throw new Error('Project file not found on this device.');
  }
  const raw = await RNFS.readFile(path, 'utf8');
  const parsed = JSON.parse(raw) as { version: number; project: Project };
  if (!parsed || !parsed.project) {
    throw new Error('Project file is corrupted.');
  }

  const migrated = migrateProject(parsed.project);

  if (migrated !== parsed.project) {
    const envelope = { version: PROJECT_FILE_VERSION, project: migrated };
    await RNFS.writeFile(path, JSON.stringify(envelope), 'utf8');
    const index = await readIndex();
    const next = upsertMeta(index, toProjectMeta(migrated));
    await writeIndex(next);
  }

  return migrated;
}

export async function saveProjectFile(project: Project): Promise<void> {
  await ensureDir();
  const envelope = { version: PROJECT_FILE_VERSION, project };
  await RNFS.writeFile(
    projectFilePath(project.id),
    JSON.stringify(envelope),
    'utf8',
  );
  const index = await readIndex();
  const next = upsertMeta(index, toProjectMeta(project));
  await writeIndex(next);
}

export async function deleteProjectFile(id: string): Promise<void> {
  const path = projectFilePath(id);
  const exists = await RNFS.exists(path);
  if (exists) {
    await RNFS.unlink(path);
  }
  const index = await readIndex();
  const next: ProjectIndex = {
    projects: index.projects.filter(p => p.id !== id),
  };
  await writeIndex(next);
}

export async function renameProjectMeta(
  id: string,
  newName: string,
): Promise<void> {
  const index = await readIndex();
  const next: ProjectIndex = {
    projects: index.projects.map(p =>
      p.id === id ? { ...p, name: newName, updatedAt: Date.now() } : p,
    ),
  };
  await writeIndex(next);
}

export interface UseProjectsResult {
  projects: ProjectMeta[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  rename: (id: string, newName: string) => Promise<void>;
}

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await ensureDir();
      const index = await readIndex();
      const sorted = [...index.projects].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      );
      setProjects(sorted);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load projects.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    await load();
  }, [load]);

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await deleteProjectFile(id);
      await load();
    },
    [load],
  );

  const rename = useCallback(
    async (id: string, newName: string): Promise<void> => {
      await renameProjectMeta(id, newName);
      await load();
    },
    [load],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { projects, loading, error, refresh, remove, rename };
}