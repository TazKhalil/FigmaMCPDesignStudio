import type { ProjectState } from '@/features/rf-planner/types';

const PROJECT_KEY = 'rf-planner-project';
const THEME_KEY = 'rf-theme';

export function saveProject(project: ProjectState): void {
  localStorage.setItem(PROJECT_KEY, JSON.stringify(project));
}

export function loadProject(): ProjectState | null {
  try {
    const raw = localStorage.getItem(PROJECT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as ProjectState;
  } catch {
    return null;
  }
}

export function saveTheme(theme: 'dark' | 'light'): void {
  localStorage.setItem(THEME_KEY, theme);
}

export function loadTheme(): 'dark' | 'light' | null {
  const value = localStorage.getItem(THEME_KEY);
  if (value === 'dark' || value === 'light') return value;
  return null;
}
