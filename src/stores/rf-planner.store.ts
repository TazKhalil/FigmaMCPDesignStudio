import { create } from 'zustand';
import {
  ToolMode, WallMaterial, ObstacleType, ProjectState, ScaleInputUnit,
  Wall, Door, Obstacle, Gateway, Sensor, ScaleRef, Point, ProjectAction,
} from '@/features/rf-planner/types';
import { autoAssignSensors } from '@/features/rf-planner/lib/rf-utils';

let idCounter = 0;
export function genId(): string { return `obj_${++idCounter}_${Date.now()}`; }

export function defaultProject(): ProjectState {
  return {
    name: 'Untitled Project',
    dateCreated: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    floorPlanImage: null,
    scale: null,
    walls: [],
    doors: [],
    obstacles: [],
    gateways: [],
    sensors: [],
  };
}

function recalcSensors(state: ProjectState): ProjectState {
  const updated = autoAssignSensors(
    state.sensors, state.gateways, state.walls, state.doors, state.obstacles, state.scale
  );
  return { ...state, sensors: updated, dateModified: new Date().toISOString() };
}

function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  let next: ProjectState;
  switch (action.type) {
    case 'SET_PROJECT': return action.project;
    case 'SET_NAME': return { ...state, name: action.name, dateModified: new Date().toISOString() };
    case 'SET_FLOOR_PLAN': return { ...state, floorPlanImage: action.image, dateModified: new Date().toISOString() };
    case 'SET_SCALE':
      next = { ...state, scale: action.scale, dateModified: new Date().toISOString() };
      return recalcSensors(next);
    case 'ADD_WALL':
      next = { ...state, walls: [...state.walls, action.wall], dateModified: new Date().toISOString() };
      return recalcSensors(next);
    case 'UPDATE_WALL':
      next = { ...state, walls: state.walls.map(w => w.id === action.id ? { ...w, ...action.changes } : w), dateModified: new Date().toISOString() };
      return recalcSensors(next);
    case 'DELETE_WALL':
      next = {
        ...state,
        walls: state.walls.filter(w => w.id !== action.id),
        doors: state.doors.filter(d => d.wallId !== action.id),
        dateModified: new Date().toISOString(),
      };
      return recalcSensors(next);
    case 'ADD_DOOR':
      next = { ...state, doors: [...state.doors, action.door], dateModified: new Date().toISOString() };
      return recalcSensors(next);
    case 'UPDATE_DOOR':
      next = { ...state, doors: state.doors.map(d => d.id === action.id ? { ...d, ...action.changes } : d), dateModified: new Date().toISOString() };
      return recalcSensors(next);
    case 'DELETE_DOOR':
      next = { ...state, doors: state.doors.filter(d => d.id !== action.id), dateModified: new Date().toISOString() };
      return recalcSensors(next);
    case 'ADD_OBSTACLE':
      next = { ...state, obstacles: [...state.obstacles, action.obstacle], dateModified: new Date().toISOString() };
      return recalcSensors(next);
    case 'UPDATE_OBSTACLE':
      next = { ...state, obstacles: state.obstacles.map(o => o.id === action.id ? { ...o, ...action.changes } : o), dateModified: new Date().toISOString() };
      return recalcSensors(next);
    case 'DELETE_OBSTACLE':
      next = { ...state, obstacles: state.obstacles.filter(o => o.id !== action.id), dateModified: new Date().toISOString() };
      return recalcSensors(next);
    case 'ADD_GATEWAY':
      next = { ...state, gateways: [...state.gateways, action.gateway], dateModified: new Date().toISOString() };
      return recalcSensors(next);
    case 'UPDATE_GATEWAY':
      next = { ...state, gateways: state.gateways.map(g => g.id === action.id ? { ...g, ...action.changes } : g), dateModified: new Date().toISOString() };
      return recalcSensors(next);
    case 'DELETE_GATEWAY':
      next = { ...state, gateways: state.gateways.filter(g => g.id !== action.id), dateModified: new Date().toISOString() };
      return recalcSensors(next);
    case 'ADD_SENSOR':
      next = { ...state, sensors: [...state.sensors, action.sensor], dateModified: new Date().toISOString() };
      return recalcSensors(next);
    case 'UPDATE_SENSOR':
      next = { ...state, sensors: state.sensors.map(s => s.id === action.id ? { ...s, ...action.changes } : s), dateModified: new Date().toISOString() };
      return recalcSensors(next);
    case 'DELETE_SENSOR':
      next = { ...state, sensors: state.sensors.filter(s => s.id !== action.id), dateModified: new Date().toISOString() };
      return recalcSensors(next);
    case 'REASSIGN_SENSORS':
      return recalcSensors(state);
    default: return state;
  }
}

export interface RFPlannerState {
  // Project data
  project: ProjectState;
  dispatch: (action: ProjectAction) => void;

  // Tool UI state
  tool: ToolMode;
  setTool: (t: ToolMode) => void;
  wallMaterial: WallMaterial;
  setWallMaterial: (m: WallMaterial) => void;
  obstacleType: ObstacleType;
  setObstacleType: (t: ObstacleType) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;

  // Scale unit UI state (FR-003)
  scaleInputUnit: ScaleInputUnit;
  setScaleInputUnit: (unit: ScaleInputUnit) => void;

  // Theme
  isDark: boolean;
  toggleDark: () => void;

  // Undo/redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Internal undo/redo history (not exposed as reactive — managed imperatively)
  _history: ProjectState[];
  _future: ProjectState[];

  // Coverage polygons — populated by RF engine worker (T026/T027)
  coveragePolygons: {
    gatewayId: string;
    good: Point[];
    marginal: Point[];
    ringRadii: { goodRadius: number; marginalRadius: number };
  }[];
  setCoveragePolygons: (polygons: RFPlannerState['coveragePolygons']) => void;

  /** Apply worker RECALC_RESULT: update sensor RSSI/assignment + coverage polygons (no history entry). */
  setRecalcResult: (
    sensors: { id: string; assignedGatewayId: string | null; rssi: number | null; overCapacity: boolean }[],
    polygons: RFPlannerState['coveragePolygons'],
  ) => void;
}

const HISTORY_LIMIT = 100;

export const useRFPlannerStore = create<RFPlannerState>((set, get) => ({
  project: defaultProject(),
  _history: [],
  _future: [],
  coveragePolygons: [],

  dispatch(action: ProjectAction) {
    const { project, _history } = get();
    const newHistory = [..._history, project];
    if (newHistory.length > HISTORY_LIMIT) newHistory.shift();
    const nextProject = projectReducer(project, action);
    set({
      project: nextProject,
      _history: newHistory,
      _future: [],
      canUndo: true,
      canRedo: false,
    });
  },

  tool: 'select',
  setTool: (t) => set({ tool: t }),

  wallMaterial: 'drywall',
  setWallMaterial: (m) => set({ wallMaterial: m }),

  obstacleType: 'machinery',
  setObstacleType: (t) => set({ obstacleType: t }),

  selectedId: null,
  setSelectedId: (id) => set({ selectedId: id }),

  scaleInputUnit: 'ft',
  setScaleInputUnit: (unit) => set({ scaleInputUnit: unit }),

  isDark: typeof localStorage !== 'undefined' ? localStorage.getItem('rf-theme') === 'dark' : false,
  toggleDark() {
    const next = !get().isDark;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('rf-theme', next ? 'dark' : 'light');
    }
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', next);
    }
    set({ isDark: next });
  },

  canUndo: false,
  canRedo: false,

  undo() {
    const { _history, project, _future } = get();
    if (_history.length === 0) return;
    const prev = _history[_history.length - 1];
    const newHistory = _history.slice(0, -1);
    const newFuture = [project, ..._future];
    set({
      project: prev,
      _history: newHistory,
      _future: newFuture,
      canUndo: newHistory.length > 0,
      canRedo: true,
    });
  },

  redo() {
    const { _future, project, _history } = get();
    if (_future.length === 0) return;
    const next = _future[0];
    const newFuture = _future.slice(1);
    const newHistory = [..._history, project];
    set({
      project: next,
      _history: newHistory,
      _future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
    });
  },

  setCoveragePolygons: (polygons) => set({ coveragePolygons: polygons }),

  setRecalcResult(sensorResults, polygons) {
    const { project } = get();
    const updatedSensors = project.sensors.map(s => {
      const r = sensorResults.find(sr => sr.id === s.id);
      return r ? { ...s, assignedGatewayId: r.assignedGatewayId, rssi: r.rssi, overCapacity: r.overCapacity } : s;
    });
    set({
      project: { ...project, sensors: updatedSensors },
      coveragePolygons: polygons,
    });
    // NOTE: intentionally not added to undo history — worker result is derived data
  },
}));

// Re-export types used by consumers
export type {
  ToolMode, WallMaterial, ObstacleType, ProjectState, ScaleInputUnit,
  Wall, Door, Obstacle, Gateway, Sensor, ScaleRef, Point, ProjectAction,
};
