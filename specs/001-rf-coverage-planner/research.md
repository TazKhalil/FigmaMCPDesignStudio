# Research: RF Coverage Planner

**Feature**: `001-rf-coverage-planner`  
**Phase**: 0 — Pre-Design Research  
**Date**: 2026-04-21  
**Source**: Figma MCP extraction (`ZzjCw7mP1LFPjeKqkD5sog`) + clarification session

All NEEDS CLARIFICATION items from Technical Context are resolved below.

---

## R1 — Routing Strategy

**Decision**: Add React Router v6 with a single `/` route.

**Rationale**: The prototype has no router — `App.tsx` is a flat `StoreProvider` wrapper
with a single screen. However, Perceptiv Design Studio is described as a multi-tool
platform; the RF Planner is tool #1 of many. Introducing React Router v6 now costs
~4 KB gz and zero architecture disruption. Future tools (`/cable-estimator`,
`/coverage-report`) get their own lazy-loaded route entries without touching the RF Planner
slice. Route for v1: `"/" → lazy(RFPlannerPage)`.

**Alternatives considered**:
- _No router (single-file SPA)_: avoids dependency but forces a full refactor when the
  second tool ships. Rejected.
- _TanStack Router_: more type-safe but adds learning curve and is not in the prototype
  dependency list. Rejected.

---

## R2 — Canvas Rendering Library

**Decision**: Keep raw HTML Canvas 2D API. Do **not** adopt Konva.

**Rationale**: `Canvas.tsx` in the prototype uses a `useRef<HTMLCanvasElement>` with a
full-scene `drawScene` loop in a `useEffect`. The rendering is already complete and
correct. Konva would add ~200 KB to the bundle (uncompressed), require rewriting all hit
testing, and provide no user-visible benefit for a single-screen tool used by ~50 engineers.
The main-thread performance concern (the raycasting loop) is addressed by moving RF
compute to a Web Worker (R5), not by changing the canvas library.

**Alternatives considered**:
- _react-konva_: layer-based canvas abstraction; good for interactive node graphs. Rejected
  on bundle size and no user value at this scale.
- _fabric.js_: rich canvas library with serialisation. Rejected — heavier than Konva;
  prototype's export logic is already built.
- _SVG rendering_: more accessible but unsuitable for the free-form drawing workflow and
  image compositing (floor plan background).

---

## R3 — Figma Asset Replacement Strategy

**Decision**: Export `gateway.png` and `sensor.png` from Figma; commit to `src/assets/`;
import as static assets via Vite.

**Rationale**: `Canvas.tsx` uses `figma:asset/c78a731353f136c80106e7a7efdf48207ef9b9c4.png`
and `figma:asset/62e9c528972494e144d9c70556e1fa06c608d9c8.png`. These are Figma Make
runtime URIs — they resolve inside the Figma preview environment only and will produce 404s
in a production Vite build.

**Production fix**:
```ts
// Canvas.tsx (production)
import gatewayPng from '@/assets/gateway.png';
import sensorPng  from '@/assets/sensor.png';
```

Vite will hash and cache-bust these files automatically. The `ImageWithFallback.tsx`
Figma-only wrapper component is deleted entirely.

**Alternatives considered**:
- _Inline Base64_: avoids a network request but inflates JS bundle by ~20 KB. Rejected.
- _CDN-hosted assets_: adds external dependency and requires an internet connection for
  icon rendering. Rejected (tool should work offline).

---

## R4 — PDF Export Library

**Decision**: Use `pdf-lib` when PDF export is implemented. **PDF export is deferred out
of scope for this iteration** (per spec Out-of-Scope section and FR requirement list which
ends at FR-021 with no PDF FR).

**Rationale (for when it is scheduled)**: `pdf-lib` generates PDFs programmatically from
JS with no JSX/React dependency, making it suitable for a BOM report that is purely
tabular data + a canvas snapshot image. `react-pdf` is better suited for complex
document layouts with React component trees — overkill for a bill-of-materials table.

**Install trigger**: add `pdf-lib` as an optional dependency now so it is available to
the task that implements the PDF export phase. Do not import it in any v1 bundle entry
point (it would be tree-shaken anyway if unused).

---

## R5 — Web Worker Scope

**Decision**: Move `autoAssignSensors`, `getGatewayCoveragePolygon` (all gateways), and
`calculateRssi` (all sensors) to `rf-engine.worker.ts`. Keep `getRingRadii`,
`getPixelsPerFoot`, and `fspl` on the main thread (needed for canvas ring rendering).

**Rationale**: The prototype calls `recalcSensors(next)` synchronously on **every**
`dispatch` — including every mouse-move event during obstacle drag. Profiling the
raycasting loop:
- 72 rays × 1 gateway × 20 walls ≈ 1440 intersection tests per recalc
- 10 gateways × 50 sensors = 500 RSSI point-to-point calculations
- At 60 fps that is 86 ms of compute per frame — well above the 16 ms budget

The worker receives a snapshot of project geometry (`sensors`, `gateways`, `walls`, `doors`,
`obstacles`, `scale`), runs the full recalc, and returns updated sensor assignments +
polygon point arrays. The main thread applies the result and triggers a canvas repaint.

**Debounce**: post to worker with 50 ms debounce on `mousemove`-originated mutations (drag
events). Immediate post for click-originated mutations (placement, deletion, property edits).

**Alternatives considered**:
- _Memoisation only (useMemo)_: doesn't unblock the main thread; reduces recalc count but
  doesn't solve the >16 ms per-call problem.
- _OffscreenCanvas_: would move canvas rendering off-thread but is unsupported in Safari
  (not a target browser, but adds risk). Rejected for this version.

---

## R6 — Persistence Abstraction

**Decision**: Implement a `StorageAdapter` interface with a localStorage implementation.
Wire to Zustand middleware. Backend implementation deferred.

```typescript
// src/features/rf-planner/lib/storage.ts
export interface StorageAdapter {
  save(key: string, data: ProjectState): void;
  load(key: string): ProjectState | null;
  clear(key: string): void;
}

export const localStorageAdapter: StorageAdapter = {
  save: (key, data) => localStorage.setItem(key, JSON.stringify(data)),
  load: (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as ProjectState) : null;
    } catch {
      return null;
    }
  },
  clear: (key) => localStorage.removeItem(key),
};
```

**Rationale**: The prototype's manual save/load uses a Blob download for `.json` files
(triggered from toolbar buttons). Production adds auto-save to localStorage on every
project mutation. The adapter interface ensures that swapping to a REST or IndexedDB
backend requires changing exactly one file.

**Alternatives considered**:
- _Direct localStorage calls in store actions_: creates coupling and requires 20+ edit
  points to swap backends. Rejected.
- _IndexedDB (idb-keyval)_: better for large floor-plan image blobs. Deferred — store the
  `floorPlanImage` (base64 data URL) in localStorage for now; revisit if engineers
  encounter storage quota limits.

---

## R7 — Scale Unit Toggle

**Decision**: Add `scaleInputUnit: 'ft' | 'm'` to Zustand UI state (not to `ProjectState`).
The `ScaleRef.distanceFeet` field stores feet internally. On scale dialog submit: if unit
is `'m'`, convert: `distanceFeet = inputValue / FT_TO_M` (where `FT_TO_M = 0.3048`).

**Rationale**: Clarification Q5 answer B — users can enter metres or feet; storage is
always in feet because `rf-utils.ts` uses `FT_TO_M = 0.3048` to convert pixel distances
to metres for FSPL calculations. Adding `scaleInputUnit` to the project state would cause
unnecessary save/load complexity (the unit is a UI preference, not a project attribute).

**Alternatives considered**:
- _Store metres in `ScaleRef`_: requires changing `getPixelsPerFoot` and all downstream
  callers. Rejected — more breaking change for no benefit.
- _Rename `distanceFeet` to `distanceMeters`_: same problem plus breaks save/load format
  compatibility. Rejected.

---

## R8 — shadcn/ui Usage at App Level

**Decision**: Use shadcn/ui primitives throughout production components (even though the
prototype's app-level components use raw HTML + Tailwind).

**Rationale**: The prototype ships 46 shadcn/ui primitives in `components/ui/` but uses
raw `<button>`, `<select>`, `<input>` in `Toolbar.tsx` and `PropertiesPanel.tsx`. For
production, using shadcn `<Button>`, `<Select>`, `<Input>`, `<Label>`, `<Dialog>`,
`<Tooltip>` etc. gives us: (a) built-in Radix accessibility, (b) consistent focus rings,
(c) dark-mode variants from the token system automatically. This is not a visual deviation
— the shadcn components style themselves via the same CSS variables as the raw HTML
elements in the prototype.

**Constraint**: Do not import any shadcn component not already present in the prototype's
`components/ui/` directory. The 46 files are the locked set.
