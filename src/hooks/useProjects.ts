import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import type { Project, ProjectIndex, ProjectMeta } from '@/types/project';
import { PROJECT_FILE_VERSION } from '@/types/project';
import { toProjectMeta } from '@/utils/format';
import { migrateProject } from '@/utils/migrate';
import { createProject, type CreateProjectOptions } from '@/utils/factory';

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

/**
 * Read the project index from AsyncStorage.
 *
 * Two distinct outcomes:
 *   - Nothing stored yet → return an empty index. This is a normal
 *     first-launch state.
 *   - Something is stored but corrupt or unreadable → throw. Callers
 *     must NOT treat this as "empty", because writing an empty index
 *     back would wipe every existing project entry.
 */
async function readIndex(): Promise<ProjectIndex> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return { projects: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      'Project index could not be parsed. Data may be corrupt.',
    );
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as ProjectIndex).projects)
  ) {
    throw new Error('Project index has an unexpected shape.');
  }

  return parsed as ProjectIndex;
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

/**
 * Create a new project file from scratch and write it to disk.
 *
 * This is the entry point used by the Create Project screen. It combines
 * three steps that always happen together:
 *   1. Build the in-memory `Project` object (with derived package and
 *      repo name).
 *   2. Write it to `DocumentDirectoryPath/projects/<id>.json`.
 *   3. Update the AsyncStorage project index.
 *
 * The caller is free to modify the returned project afterwards — for
 * example, to attach a GitHub repo (`repoOwner` / `repoUrl`) once it has
 * been created on the remote. Just call `saveProjectFile` again with the
 * updated object.
 *
 * Throws if the file system or AsyncStorage write fails.
 */
export async function createProjectRecord(
  name: string,
  options?: CreateProjectOptions,
): Promise<Project> {
  const project = createProject(name, options);
  await saveProjectFile(project);
  return project;
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