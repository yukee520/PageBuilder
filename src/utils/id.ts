const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomChar(): string {
  return ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
}

export function generateId(prefix?: string): string {
  const time = Date.now().toString(36);
  const rand = Array.from({ length: 6 }, randomChar).join('');
  const base = `${time}${rand}`;
  return prefix ? `${prefix}_${base}` : base;
}

export function generateProjectId(): string {
  return generateId('prj');
}

export function generatePageId(): string {
  return generateId('pg');
}

export function generateComponentId(): string {
  return generateId('cmp');
}

export function generateActionId(): string {
  return generateId('act');
}

export function generateVariableKey(): string {
  return generateId('var');
}