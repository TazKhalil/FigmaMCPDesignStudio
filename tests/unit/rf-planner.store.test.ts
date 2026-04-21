import { describe, it, expect, beforeEach, vi } from 'vitest';

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

import { useRFPlannerStore } from '@/stores/rf-planner.store';

describe('useRFPlannerStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    // Reset store to initial state, clearing history too
    useRFPlannerStore.setState({
      project: {
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
      },
      _history: [],
      _future: [],
      canUndo: false,
      canRedo: false,
    });
  });

  describe('ADD_GATEWAY', () => {
    it('adds a gateway to the project', () => {
      const { dispatch, project } = useRFPlannerStore.getState();
      expect(project.gateways).toHaveLength(0);
      dispatch({ type: 'ADD_GATEWAY', gateway: { id: 'gw1', x: 100, y: 100, label: 'GW1' } });
      expect(useRFPlannerStore.getState().project.gateways).toHaveLength(1);
    });

    it('gateway has correct fields', () => {
      const { dispatch } = useRFPlannerStore.getState();
      dispatch({ type: 'ADD_GATEWAY', gateway: { id: 'gw1', x: 50, y: 75, label: 'Alpha' } });
      const gw = useRFPlannerStore.getState().project.gateways[0];
      expect(gw.id).toBe('gw1');
      expect(gw.x).toBe(50);
      expect(gw.y).toBe(75);
      expect(gw.label).toBe('Alpha');
    });
  });

  describe('ADD_SENSOR', () => {
    it('adds a sensor to the project', () => {
      const { dispatch } = useRFPlannerStore.getState();
      dispatch({ type: 'ADD_SENSOR', sensor: { id: 's1', x: 200, y: 200, label: 'S1', groupCount: 1, assignedGatewayId: null, rssi: null } });
      expect(useRFPlannerStore.getState().project.sensors).toHaveLength(1);
    });
  });

  describe('DELETE_WALL cascades to doors', () => {
    it('deletes associated doors when wall is deleted', () => {
      const { dispatch } = useRFPlannerStore.getState();
      dispatch({ type: 'ADD_WALL', wall: { id: 'w1', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, material: 'drywall' } });
      dispatch({ type: 'ADD_DOOR', door: { id: 'd1', wallId: 'w1', position: 0.5, type: 'interior', isOpen: false } });
      expect(useRFPlannerStore.getState().project.doors).toHaveLength(1);
      dispatch({ type: 'DELETE_WALL', id: 'w1' });
      expect(useRFPlannerStore.getState().project.walls).toHaveLength(0);
      expect(useRFPlannerStore.getState().project.doors).toHaveLength(0);
    });
  });

  describe('UNDO / REDO', () => {
    it('undo restores previous state', () => {
      const { dispatch, undo } = useRFPlannerStore.getState();
      dispatch({ type: 'ADD_GATEWAY', gateway: { id: 'gw1', x: 10, y: 10, label: 'G1' } });
      expect(useRFPlannerStore.getState().project.gateways).toHaveLength(1);
      undo();
      expect(useRFPlannerStore.getState().project.gateways).toHaveLength(0);
    });

    it('redo re-applies undone action', () => {
      const { dispatch, undo, redo } = useRFPlannerStore.getState();
      dispatch({ type: 'ADD_GATEWAY', gateway: { id: 'gw1', x: 10, y: 10, label: 'G1' } });
      undo();
      expect(useRFPlannerStore.getState().project.gateways).toHaveLength(0);
      redo();
      expect(useRFPlannerStore.getState().project.gateways).toHaveLength(1);
    });

    it('canUndo is false initially', () => {
      expect(useRFPlannerStore.getState().canUndo).toBe(false);
    });

    it('canUndo is true after a dispatch', () => {
      const { dispatch } = useRFPlannerStore.getState();
      dispatch({ type: 'ADD_GATEWAY', gateway: { id: 'gw1', x: 10, y: 10, label: 'G1' } });
      expect(useRFPlannerStore.getState().canUndo).toBe(true);
    });

    it('canRedo is false initially', () => {
      expect(useRFPlannerStore.getState().canRedo).toBe(false);
    });

    it('canRedo becomes true after undo', () => {
      const { dispatch, undo } = useRFPlannerStore.getState();
      dispatch({ type: 'ADD_GATEWAY', gateway: { id: 'gw1', x: 10, y: 10, label: 'G1' } });
      undo();
      expect(useRFPlannerStore.getState().canRedo).toBe(true);
    });

    it('history is capped at 100 steps', () => {
      const { dispatch } = useRFPlannerStore.getState();
      // Dispatch 110 actions
      for (let i = 0; i < 110; i++) {
        dispatch({ type: 'SET_NAME', name: `Project ${i}` });
      }
      // We can only undo 100 steps
      let undoCount = 0;
      while (useRFPlannerStore.getState().canUndo) {
        useRFPlannerStore.getState().undo();
        undoCount++;
        if (undoCount > 110) break; // safety
      }
      expect(undoCount).toBeLessThanOrEqual(100);
    });
  });

  describe('isDark persisted to localStorage', () => {
    it('toggleDark writes to localStorage', () => {
      const { toggleDark } = useRFPlannerStore.getState();
      toggleDark();
      expect(localStorageMock.setItem).toHaveBeenCalledWith('rf-theme', expect.any(String));
    });

    it('isDark state changes on toggle', () => {
      const initialDark = useRFPlannerStore.getState().isDark;
      useRFPlannerStore.getState().toggleDark();
      expect(useRFPlannerStore.getState().isDark).toBe(!initialDark);
    });
  });

  describe('scaleInputUnit', () => {
    it('defaults to ft', () => {
      expect(useRFPlannerStore.getState().scaleInputUnit).toBe('ft');
    });

    it('toggles to m', () => {
      const { setScaleInputUnit } = useRFPlannerStore.getState();
      setScaleInputUnit('m');
      expect(useRFPlannerStore.getState().scaleInputUnit).toBe('m');
    });

    it('toggles back to ft', () => {
      const { setScaleInputUnit } = useRFPlannerStore.getState();
      setScaleInputUnit('m');
      setScaleInputUnit('ft');
      expect(useRFPlannerStore.getState().scaleInputUnit).toBe('ft');
    });
  });

  describe('resetProject (T040)', () => {
    it('clears all gateways and sensors', () => {
      useRFPlannerStore.getState().dispatch({ type: 'ADD_GATEWAY', gateway: { id: 'gw1', x: 0, y: 0, label: 'GW' } });
      useRFPlannerStore.getState().resetProject();
      const { project } = useRFPlannerStore.getState();
      expect(project.gateways).toHaveLength(0);
      expect(project.sensors).toHaveLength(0);
    });

    it('resets project name to Untitled Project', () => {
      useRFPlannerStore.getState().dispatch({ type: 'SET_NAME', name: 'My Plan' });
      useRFPlannerStore.getState().resetProject();
      expect(useRFPlannerStore.getState().project.name).toBe('Untitled Project');
    });

    it('resets undo/redo history', () => {
      useRFPlannerStore.getState().dispatch({ type: 'ADD_GATEWAY', gateway: { id: 'gw1', x: 0, y: 0, label: 'GW' } });
      expect(useRFPlannerStore.getState().canUndo).toBe(true);
      useRFPlannerStore.getState().resetProject();
      expect(useRFPlannerStore.getState().canUndo).toBe(false);
      expect(useRFPlannerStore.getState().canRedo).toBe(false);
    });

    it('clears coveragePolygons', () => {
      useRFPlannerStore.setState({ coveragePolygons: [{ gatewayId: 'gw1', good: [], marginal: [], ringRadii: { goodRadius: 10, marginalRadius: 20 } }] });
      useRFPlannerStore.getState().resetProject();
      expect(useRFPlannerStore.getState().coveragePolygons).toHaveLength(0);
    });
  });

  describe('SET_NAME (T043)', () => {
    it('updates the project name', () => {
      useRFPlannerStore.getState().dispatch({ type: 'SET_NAME', name: 'Warehouse Plan A' });
      expect(useRFPlannerStore.getState().project.name).toBe('Warehouse Plan A');
    });

    it('updates dateModified on rename', () => {
      const before = useRFPlannerStore.getState().project.dateModified;
      const t = Date.now();
      while (Date.now() - t < 2) { /* spin */ }
      useRFPlannerStore.getState().dispatch({ type: 'SET_NAME', name: 'New Name' });
      const after = useRFPlannerStore.getState().project.dateModified;
      expect(after).not.toBe(before);
    });

    it('name persists in saved JSON round-trip (T043 + T036)', () => {
      useRFPlannerStore.getState().dispatch({ type: 'SET_NAME', name: 'Round-Trip Name' });
      const { project } = useRFPlannerStore.getState();
      // Simulate the save payload including version
      const payload = { version: '1.0.0', ...project };
      const json = JSON.stringify(payload);
      const parsed = JSON.parse(json);
      expect(parsed.name).toBe('Round-Trip Name');
      expect(parsed.version).toBe('1.0.0');
    });
  });
});
