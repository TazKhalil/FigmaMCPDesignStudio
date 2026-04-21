# Contract: Web Worker Message Protocol

**Feature**: `001-rf-coverage-planner`  
**Worker**: `src/features/rf-planner/workers/rf-engine.worker.ts`  
**Version**: 1.0.0  
**Date**: 2026-04-21

---

## Overview

The RF engine worker handles all computationally expensive RF calculations off the main
thread. The main thread posts a `RECALC` message whenever project geometry changes. The
worker returns a `RECALC_RESULT` message with updated sensor assignments and coverage
polygon data.

---

## Message Types

### Main Thread → Worker

#### `RECALC`

Triggers a full re-assignment and coverage recalculation.

```typescript
interface RecalcMessage {
  type: 'RECALC';
  requestId: string;           // UUID; used to match response to the triggering dispatch
  payload: {
    sensors:   SensorInput[];
    gateways:  GatewayInput[];
    walls:     Wall[];
    doors:     Door[];
    obstacles: Obstacle[];
    scale:     ScaleRef | null;
  };
}

// Minimal input types (only fields needed for RF compute)
interface SensorInput {
  id: string;
  x: number;
  y: number;
  groupCount: number;
}

interface GatewayInput {
  id: string;
  x: number;
  y: number;
}
```

**When to post**:
- After any `ProjectAction` that mutates geometry (all actions except `SET_NAME`,
  `SET_FLOOR_PLAN`)
- With 50 ms debounce for `mousemove`-derived mutations (drag events)
- Immediate (no debounce) for click-derived mutations (placement, deletion, property edits)

---

### Worker → Main Thread

#### `RECALC_RESULT`

Returns updated sensor assignments and coverage polygon data.

```typescript
interface RecalcResultMessage {
  type: 'RECALC_RESULT';
  requestId: string;           // echoed from the triggering RECALC message
  payload: {
    sensors: SensorResult[];
    polygons: GatewayPolygons[];
  };
}

interface SensorResult {
  id: string;
  assignedGatewayId: string | null;
  rssi: number | null;           // dBm
}

interface GatewayPolygons {
  gatewayId: string;
  good:     Point[];             // polygon boundary at RSSI_GOOD (-70 dBm) tier
  marginal: Point[];             // polygon boundary at RSSI_MARGINAL (-80 dBm) tier
  ringRadii: {
    goodRadius:     number;      // pixels — free-space good tier radius
    marginalRadius: number;      // pixels — free-space marginal tier radius
  };
}
```

#### `RECALC_ERROR`

Posted if an unhandled exception occurs inside the worker.

```typescript
interface RecalcErrorMessage {
  type: 'RECALC_ERROR';
  requestId: string;
  error: string;                 // error.message
}
```

---

## Ordering Guarantee

- The worker processes messages **in order**. If a second `RECALC` arrives before the
  first completes, the first is cancelled and the second takes precedence.
- The main thread MUST only apply a `RECALC_RESULT` if its `requestId` matches the most
  recently posted `RECALC`. Stale results from superseded requests are discarded.

---

## Worker Lifecycle

```typescript
// src/features/rf-planner/hooks/useRfEngine.ts (pseudocode)
const worker = new Worker(
  new URL('../workers/rf-engine.worker.ts', import.meta.url),
  { type: 'module' }
);

// On component unmount:
worker.terminate();
```

Vite handles the `new URL(..., import.meta.url)` pattern for bundling Web Workers as
separate chunks. No additional Vite plugin is required.

---

## Null Scale Handling

If `scale === null` in the `RECALC` payload:
- `autoAssignSensors` still runs (greedy assignment by pixel distance)
- `calculateRssi` returns `null` for all sensors (cannot compute without physical scale)
- `getGatewayCoveragePolygon` returns empty polygon arrays
- Worker posts `RECALC_RESULT` normally with all `rssi: null`

---

## Error Boundary

If the worker throws, it posts `RECALC_ERROR`. The main thread catches this and:
1. Logs the error to console
2. Leaves current sensor RSSI values unchanged (stale but visible)
3. Shows a non-blocking toast: "Coverage calculation failed. Try again."
