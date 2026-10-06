#!/usr/bin/env node

/* eslint-disable */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'src', 'services', 'runtimeSource.ts');

const FILES_TO_EMBED = [
  { sourcePath: 'runtime/App.tsx', targetPath: 'runtime/App.tsx' },
  {
    sourcePath: 'runtime/src/RuntimeRenderer.tsx',
    targetPath: 'runtime/src/RuntimeRenderer.tsx',
  },
  {
    sourcePath: 'runtime/src/RuntimeActionHandler.ts',
    targetPath: 'runtime/src/RuntimeActionHandler.ts',
  },
  {
    sourcePath: 'runtime/src/onboardingStorage.ts',
    targetPath: 'runtime/src/onboardingStorage.ts',
  },
  {
    sourcePath: 'runtime/src/MusicPlayer.tsx',
    targetPath: 'runtime/src/MusicPlayer.tsx',
  },
  {
    sourcePath: 'runtime/src/BgmPlayer.tsx',
    targetPath: 'runtime/src/BgmPlayer.tsx',
  },
  {
    sourcePath: 'runtime/src/audioBus.ts',
    targetPath: 'runtime/src/audioBus.ts',
  },
  {
    sourcePath: 'runtime/src/runtimeSettings.ts',
    targetPath: 'runtime/src/runtimeSettings.ts',
  },
  {
    sourcePath: 'runtime/src/RuntimeSettingsSheet.tsx',
    targetPath: 'runtime/src/RuntimeSettingsSheet.tsx',
  },
  {
    sourcePath: 'runtime/src/RuntimeSettingsButton.tsx',
    targetPath: 'runtime/src/RuntimeSettingsButton.tsx',
  },
  {
    sourcePath: 'runtime/src/assetResolver.ts',
    targetPath: 'runtime/src/assetResolver.ts',
  },
  { sourcePath: 'src/types/action.ts', targetPath: 'src/types/action.ts' },
  {
    sourcePath: 'src/types/component.ts',
    targetPath: 'src/types/component.ts',
  },
  { sourcePath: 'src/types/project.ts', targetPath: 'src/types/project.ts' },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readFileSafe(p) {
  if (!fs.existsSync(p)) {
    throw new Error(`Missing runtime source: ${p}`);
  }
  return fs.readFileSync(p, 'utf8');
}

function main() {
  const entries = [];

  for (const file of FILES_TO_EMBED) {
    const fullPath = path.join(ROOT, file.sourcePath);
    const content = readFileSafe(fullPath);
    const base64 = Buffer.from(content, 'utf8').toString('base64');
    entries.push({
      path: file.targetPath,
      base64,
      length: content.length,
    });
  }

  const now = new Date().toISOString();

  const lines = [];
  lines.push('// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.');
  lines.push('// Run `node scripts/embed-runtime.js` to regenerate.');
  lines.push(`// Generated at: ${now}`);
  lines.push('');
  lines.push('export interface RuntimeFile {');
  lines.push('  path: string;');
  lines.push('  base64: string;');
  lines.push('}');
  lines.push('');
  lines.push('export const RUNTIME_FILES: RuntimeFile[] = [');

  for (const entry of entries) {
    lines.push('  {');
    lines.push(`    path: ${JSON.stringify(entry.path)},`);
    lines.push(`    base64:`);
    lines.push(`      '${entry.base64}',`);
    lines.push('  },');
  }

  lines.push('];');
  lines.push('');
  lines.push(
    'export function getRuntimeFile(path: string): RuntimeFile | null {',
  );
  lines.push('  return RUNTIME_FILES.find(f => f.path === path) ?? null;');
  lines.push('}');
  lines.push('');
  lines.push('export function getRuntimeFileCount(): number {');
  lines.push('  return RUNTIME_FILES.length;');
  lines.push('}');
  lines.push('');

  ensureDir(path.dirname(OUT_FILE));
  fs.writeFileSync(OUT_FILE, lines.join('\n'), 'utf8');

  console.log(`Wrote ${OUT_FILE}`);
  console.log(`Embedded ${entries.length} files:`);
  for (const entry of entries) {
    console.log(`  - ${entry.path} (${entry.length} bytes)`);
  }
}

main();