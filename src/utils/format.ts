import type { PageComponent } from '@/types/component';
import type { Project, ProjectMeta } from '@/types/project';
import { COMPONENT_TYPE_LABELS, SIZE_PRESET_LABELS } from '@/types/component';

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function describeComponent(component: PageComponent): string {
  const label = COMPONENT_TYPE_LABELS[component.type];

  switch (component.type) {
    case 'text':
      return `${label} · ${truncate(component.content || '(empty)', 40)}`;
    case 'image':
      return `${label} · ${component.uri ? 'Image set' : 'No image'}`;
    case 'video':
      return `${label} · ${component.url ? truncate(component.url, 40) : 'No URL'}`;
    case 'button':
      return `${label} · ${truncate(component.label || '(empty)', 40)}`;
    case 'spacer':
      return `${label} · ${SIZE_PRESET_LABELS[component.size]}`;
    case 'divider':
      return `${label} · ${component.thickness}`;
    case 'row':
      return `${label} · ${component.children.length} item${component.children.length === 1 ? '' : 's'}`;
    case 'input':
      return `${label} · ${truncate(component.placeholder || '(empty)', 40)}`;
    default: {
      const _exhaustive: never = component;
      return String(_exhaustive);
    }
  }
}

export function countComponents(project: Project): number {
  let count = 0;
  for (const page of project.pages) {
    for (const c of page.components) {
      count += 1;
      if (c.type === 'row') count += c.children.length;
    }
  }
  return count;
}

export function toProjectMeta(project: Project): ProjectMeta {
  return {
    id: project.id,
    name: project.name,
    pageCount: project.pages.length,
    componentCount: countComponents(project),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export function sanitizeRepoName(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9-_.]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
  return cleaned || 'my-app';
}

export function sanitizePackageName(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return cleaned || 'com.example.myapp';
}