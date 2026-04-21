/**
 * useRfEngine — T027
 *
 * Manages the RF engine Web Worker lifecycle and drives recalculation whenever
 * project geometry changes.
 *
 * Design decisions:
 * - Worker is created on mount and terminated on unmount.
 * - The store runs `recalcSensors` synchronously on every dispatch (immediate
 *   feedback on the main thread). The worker additionally computes coverage
 *   polygons (72-ray raycasting) which are expensive to run inline.
 * - On RECALC_RESULT the hook calls `setRecalcResult` to update sensor RSSI
 *   (authoritative values) and coverage polygons in the store — without
 *   touching undo history.
 * - Debounce: 50 ms for drag-derived mutations; immediate for other mutations.
 * - Stale RECALC_RESULT messages are discarded via requestId tracking.
 *
 * Prototype source: src/app/rf-utils.ts (worker caller pattern)
 * Worker protocol:  specs/001-rf-coverage-planner/contracts/worker-protocol.md
 */

import { useEffect, useRef, useCallback } from 'react';
import { useRFPlannerStore } from '@/stores/rf-planner.store';
import type { ProjectState } from '@/features/rf-planner/types';

// ─── Types matching worker-protocol.md ───────────────────────────────────────

interface RecalcResultPayload {
  sensors: { id: string; assignedGatewayId: string | null; rssi: number | null; overCapacity: boolean }[];
  polygons: {
    gatewayId: string;
    good: { x: number; y: number }[];
    marginal: { x: number; y: number }[];
    ringRadii: { goodRadius: number; marginalRadius: number };
  }[];
}

interface RecalcResultMessage {
  type: 'RECALC_RESULT';
  requestId: string;
  payload: RecalcResultPayload;
}

interface RecalcErrorMessage {
  type: 'RECALC_ERROR';
  requestId: string;
  error: string;
}

type WorkerMessage = RecalcResultMessage | RecalcErrorMessage;

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRfEngine(): void {
  const { setRecalcResult } = useRFPlannerStore();

  const workerRef    = useRef<Worker | null>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** requestId of the most recently posted RECALC — used to discard stale results. */
  const latestReqRef = useRef<string>('');

  // ── Worker lifecycle ────────────────────────────────────────────────────────
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/rf-engine.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg.type === 'RECALC_RESULT') {
        // Discard stale results from superseded RECALC messages
        if (msg.requestId !== latestReqRef.current) return;
        setRecalcResult(msg.payload.sensors, msg.payload.polygons);
      }
      // RECALC_ERROR is silently swallowed — the sync store path remains authoritative
    };

    workerRef.current = worker;

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      worker.terminate();
      workerRef.current = null;
    };
  }, [setRecalcResult]);

  // ── Post RECALC ─────────────────────────────────────────────────────────────
  const postRecalc = useCallback((project: ProjectState, immediate: boolean) => {
    const worker = workerRef.current;
    if (!worker) return;

    const doPost = () => {
      const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      latestReqRef.current = requestId;
      worker.postMessage({
        type: 'RECALC',
        requestId,
        payload: {
          sensors:   project.sensors,
          gateways:  project.gateways,
          walls:     project.walls,
          doors:     project.doors,
          obstacles: project.obstacles,
          scale:     project.scale,
        },
      });
    };

    if (immediate) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      doPost();
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(doPost, 50);
    }
  }, []);

  // ── Subscribe to project changes ────────────────────────────────────────────
  useEffect(() => {
    // Fire once immediately for current project state
    postRecalc(useRFPlannerStore.getState().project, true);

    const unsubscribe = useRFPlannerStore.subscribe((state, prevState) => {
      if (state.project !== prevState.project) {
        postRecalc(state.project, true);
      }
    });

    return unsubscribe;
  }, [postRecalc]);
}
