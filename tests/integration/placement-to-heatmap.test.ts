/**
 * Integration tests: Floor Plan Setup (US1)
 * Stub — expanded fully in Phase 5 (US3 hardware placement + worker).
 *
 * These tests exercise the Zustand store + RF math contracts end-to-end
 * without rendering Canvas (that comes in Phase 5 component tests).
 *
 * Prototype source: src/app/store.tsx (SET_FLOOR_PLAN, SET_SCALE dispatches)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useRFPlannerStore } from '@/stores/rf-planner.store';

const FT_PER_METRE = 1 / 0.3048; // ≈ 3.28084

beforeEach(() => {
  useRFPlannerStore.setState({
    project: {
      name: 'Test Project',
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

describe('US1 — Floor Plan Setup', () => {
  describe('SET_FLOOR_PLAN', () => {
    it('stores floor plan data URL in project state', () => {
      const fakeDataUrl = 'data:image/png;base64,abc123';
      useRFPlannerStore.getState().dispatch({ type: 'SET_FLOOR_PLAN', image: fakeDataUrl });
      expect(useRFPlannerStore.getState().project.floorPlanImage).toBe(fakeDataUrl);
    });

    it('clears floor plan when dispatched with null', () => {
      useRFPlannerStore.getState().dispatch({ type: 'SET_FLOOR_PLAN', image: 'data:image/png;base64,abc' });
      useRFPlannerStore.getState().dispatch({ type: 'SET_FLOOR_PLAN', image: null });
      expect(useRFPlannerStore.getState().project.floorPlanImage).toBeNull();
    });
  });

  describe('SET_SCALE — feet input (FR-003)', () => {
    it('stores distanceFeet exactly for ft input', () => {
      useRFPlannerStore.getState().dispatch({
        type: 'SET_SCALE',
        scale: { p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 }, distanceFeet: 50 },
      });
      expect(useRFPlannerStore.getState().project.scale?.distanceFeet).toBe(50);
    });

    it('stores scale reference points correctly', () => {
      const p1 = { x: 10, y: 20 };
      const p2 = { x: 110, y: 20 };
      useRFPlannerStore.getState().dispatch({
        type: 'SET_SCALE',
        scale: { p1, p2, distanceFeet: 50 },
      });
      const scale = useRFPlannerStore.getState().project.scale!;
      expect(scale.p1).toEqual(p1);
      expect(scale.p2).toEqual(p2);
    });
  });

  describe('SET_SCALE — metres input conversion (FR-003, T017)', () => {
    it('converts 15 m to distanceFeet ≈ 49.21', () => {
      // Canvas.tsx handleScaleSubmit converts: distanceFeet = inputMetres / 0.3048
      const inputMetres = 15;
      const distanceFeet = inputMetres / 0.3048;

      useRFPlannerStore.getState().dispatch({
        type: 'SET_SCALE',
        scale: { p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 }, distanceFeet },
      });

      expect(useRFPlannerStore.getState().project.scale?.distanceFeet).toBeCloseTo(49.21, 1);
    });

    it('converts 1 m to distanceFeet ≈ 3.281', () => {
      const distanceFeet = 1 / 0.3048;
      useRFPlannerStore.getState().dispatch({
        type: 'SET_SCALE',
        scale: { p1: { x: 0, y: 0 }, p2: { x: 10, y: 0 }, distanceFeet },
      });
      expect(useRFPlannerStore.getState().project.scale?.distanceFeet).toBeCloseTo(3.281, 2);
    });

    it('metres-to-feet formula: 1 metre = 1 / 0.3048 feet', () => {
      expect(FT_PER_METRE).toBeCloseTo(3.28084, 4);
    });
  });

  describe('Scale persistence', () => {
    it('scale survives undo/redo cycle', () => {
      useRFPlannerStore.getState().dispatch({
        type: 'SET_SCALE',
        scale: { p1: { x: 0, y: 0 }, p2: { x: 100, y: 0 }, distanceFeet: 50 },
      });
      const scaleBefore = useRFPlannerStore.getState().project.scale;

      useRFPlannerStore.getState().undo();
      expect(useRFPlannerStore.getState().project.scale).toBeNull();

      useRFPlannerStore.getState().redo();
      expect(useRFPlannerStore.getState().project.scale).toEqual(scaleBefore);
    });
  });
});
