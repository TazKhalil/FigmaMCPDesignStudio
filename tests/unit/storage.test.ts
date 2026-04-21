import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ProjectState } from '@/features/rf-planner/types';
import { saveProject, loadProject, saveTheme, loadTheme } from '@/features/rf-planner/lib/storage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

const makeProject = (): ProjectState => ({
  name: 'Test Project',
  dateCreated: '2026-01-01T00:00:00.000Z',
  dateModified: '2026-01-01T00:00:00.000Z',
  floorPlanImage: null,
  scale: null,
  walls: [],
  doors: [],
  obstacles: [],
  gateways: [{ id: 'gw1', x: 100, y: 200, label: 'Gateway 1' }],
  sensors: [{ id: 's1', x: 150, y: 250, label: 'Sensor 1', groupCount: 3, assignedGatewayId: 'gw1', rssi: -65 }],
});

describe('saveProject / loadProject', () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  it('round-trips a project with no data loss', () => {
    const project = makeProject();
    saveProject(project);
    const loaded = loadProject();
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe(project.name);
    expect(loaded!.dateCreated).toBe(project.dateCreated);
    expect(loaded!.gateways).toHaveLength(1);
    expect(loaded!.gateways[0].id).toBe('gw1');
    expect(loaded!.sensors).toHaveLength(1);
    expect(loaded!.sensors[0].rssi).toBe(-65);
  });

  it('round-trip is structurally identical', () => {
    const project = makeProject();
    saveProject(project);
    const loaded = loadProject();
    expect(loaded).toStrictEqual(project);
  });

  it('saveProject calls localStorage.setItem', () => {
    const project = makeProject();
    saveProject(project);
    expect(localStorageMock.setItem).toHaveBeenCalledOnce();
  });

  it('loadProject returns null when nothing is saved', () => {
    const result = loadProject();
    expect(result).toBeNull();
  });

  it('loadProject returns null for corrupt JSON', () => {
    localStorageMock.getItem.mockReturnValueOnce('{ not valid json !!!');
    const result = loadProject();
    expect(result).toBeNull();
  });

  it('loadProject returns null for non-object JSON', () => {
    localStorageMock.getItem.mockReturnValueOnce('"just a string"');
    const result = loadProject();
    expect(result).toBeNull();
  });

  it('preserves floorPlanImage data URL round-trip', () => {
    const project = makeProject();
    project.floorPlanImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=';
    saveProject(project);
    const loaded = loadProject();
    expect(loaded!.floorPlanImage).toBe(project.floorPlanImage);
  });
});

describe('saveTheme / loadTheme', () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
  });

  it('saves and loads dark theme', () => {
    saveTheme('dark');
    expect(loadTheme()).toBe('dark');
  });

  it('saves and loads light theme', () => {
    saveTheme('light');
    expect(loadTheme()).toBe('light');
  });

  it('returns null when no theme saved', () => {
    expect(loadTheme()).toBeNull();
  });
});
