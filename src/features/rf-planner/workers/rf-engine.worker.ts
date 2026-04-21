/**
 * RF Engine Web Worker — T026
 *
 * Handles RECALC messages from the main thread.
 * Performs sensor auto-assignment + coverage polygon calculation off the main thread.
 * Posts RECALC_RESULT (or RECALC_ERROR) back to the main thread.
 *
 * Ordering guarantee: only the most recently posted RECALC is honoured.
 * If a newer RECALC arrives before the previous one completes, the previous result
 * is discarded (main thread matches by requestId).
 *
 * Prototype source: src/app/rf-utils.ts
 */

import {
  autoAssignSensors,
  getGatewayCoveragePolygon,
  getRingRadii,
} from '@/features/rf-planner/lib/rf-utils';
import { RSSI_GOOD, RSSI_MARGINAL } from '@/features/rf-planner/types';
import type {
  Wall,
  Door,
  Obstacle,
  ScaleRef,
  Sensor,
  Gateway,
} from '@/features/rf-planner/types';

// ─── Message Interfaces (mirroring worker-protocol.md) ───────────────────────

interface RecalcPayload {
  sensors:   Sensor[];
  gateways:  Gateway[];
  walls:     Wall[];
  doors:     Door[];
  obstacles: Obstacle[];
  scale:     ScaleRef | null;
}

interface RecalcMessage {
  type: 'RECALC';
  requestId: string;
  payload: RecalcPayload;
}

// ─── Worker Entry Point ───────────────────────────────────────────────────────

self.addEventListener('message', (e: MessageEvent<RecalcMessage>) => {
  if (e.data.type !== 'RECALC') return;

  const { requestId, payload } = e.data;
  const { sensors, gateways, walls, doors, obstacles, scale } = payload;

  try {
    // 1. Auto-assign sensors → updated sensor list with RSSI + gatewayId
    const updatedSensors = autoAssignSensors(sensors, gateways, walls, doors, obstacles, scale);

    // 2. Build coverage polygons for each gateway (only if scale is set)
    const polygons = scale
      ? gateways.map(gw => {
          const good     = getGatewayCoveragePolygon(gw, walls, doors, obstacles, scale, RSSI_GOOD);
          const marginal = getGatewayCoveragePolygon(gw, walls, doors, obstacles, scale, RSSI_MARGINAL);
          const radii    = getRingRadii(scale);
          return {
            gatewayId:  gw.id,
            good,
            marginal,
            ringRadii: {
              goodRadius:     radii.good,
              marginalRadius: radii.marginal,
            },
          };
        })
      : [];

    // 3. Post RECALC_RESULT
    self.postMessage({
      type: 'RECALC_RESULT',
      requestId,
      payload: {
        sensors: updatedSensors.map(s => ({
          id:                s.id,
          assignedGatewayId: s.assignedGatewayId,
          rssi:              s.rssi,
        })),
        polygons,
      },
    });
  } catch (err) {
    self.postMessage({
      type: 'RECALC_ERROR',
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
