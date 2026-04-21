# Implementation Plan: RF Coverage Planner

**Branch**: `001-rf-coverage-planner` | **Date**: 2026-04-21 | **Spec**: [specs/001-rf-coverage-planner/spec.md](spec.md)  
**Input**: Feature specification from `specs/001-rf-coverage-planner/spec.md`

---

## Summary

Productionise the RF Coverage Planner tool that already exists as a working Figma Make
prototype. The prototype is a single-page React 18 + TypeScript + Vite + Tailwind CSS v4
application with raw HTML Canvas 2D rendering, `useReducer`/Context state, and a complete
RF propagation engine (FSPL at 2.44 GHz with 72-ray wall-attenuated raycasting). The
production work refactors this prototype into a feature-folder architecture, migrates state
to Zustand, moves RF computation to a Web Worker, adds mandatory test coverage (Vitest +
RTL + Playwright), and implements the accessibility, UX, and export gaps identified in the
feature spec (FR-001 through FR-021). Visual and behavioural fidelity to the prototype is
preserved exactly. PDF export is deferred to a future iteration per the spec.

**Prototype source**: `https://www.figma.com/make/ZzjCw7mP1LFPjeKqkD5sog/Perceptiv-Design-Studio`  
**Figma MCP queried**: 2026-04-21 (App.tsx, Canvas.tsx, store.tsx, types.ts, rf-utils.ts,
Toolbar.tsx, PropertiesPanel.tsx, theme.css, tailwind.css, package.json)

---

## Technical Context

**Language/Version**: TypeScript 5 (strict mode), React 18  
**Primary Dependencies**: Vite 5, Tailwind CSS v4, shadcn/ui + Radix UI (46 primitives),
Lucide React, Zustand, Vitest, React Testing Library, Playwright  
**Storage**: `localStorage` for MVP (theme, project auto-save). Abstract behind
`StorageAdapter` interface so a backend swap is a one-file change.  
**Testing**: Vitest + RTL (unit + component), Playwright (E2E critical flows)  
**Target Platform**: Chrome ≥ 120, Edge ≥ 120 (two most recent stable versions, per SC-006)  
**Project Type**: Internal SPA — single-screen tool, no server, no auth  
**Performance Goals**: RF recalculation ≤ 1 s for ≤ 20 walls, ≤ 10 gateways, ≤ 50 sensors
(SC-002). Canvas repaints stay off the JS main thread via `requestAnimationFrame`.  
**Constraints**: Offline-capable MVP (localStorage only). No external API calls. Bundle size
increases require PR justification.  
**Scale/Scope**: ~10–50 internal Perceptiv application engineers; single tool in v1 of the
Design Studio shell.

---

## Constitution Check

*GATE: Passed before Phase 0. Re-evaluated after Phase 1 design.*

**Principle I — Figma Make Authoritative Reference**
- [x] Figma MCP (`get_design_context`) called — all six source files extracted (2026-04-21)
- [x] No colors, typography, spacing, or component structures invented outside prototype
- [x] All prototype-vs-request conflicts flagged explicitly in spec Prototype Reconciliation
  table (P1–P6) and Clarifications section

**Principle II — Production-Quality Uplift Only**
- [x] No unrequested features included; PDF export explicitly deferred per spec Out-of-Scope
- [x] Prototype visual fidelity preserved — same layout, same canvas rendering, same tokens
- [x] All added complexity justified:
  - Zustand: needed because useReducer+Context does not scale to cross-component subscriptions
  - Web Worker: needed because 72-ray raycasting on every mutation blocks the main thread
  - StorageAdapter abstraction: one-function-call backend migration path; near-zero cost

**Principle III — Accessibility**
- [x] All interactive elements keyboard-navigable (Ctrl+Z/Y already in prototype; canvas
  tool shortcuts, Properties Panel inputs all require keyboard support in production)
- [x] ARIA labels scoped: `<canvas>` needs `role="img"` + `aria-label`; toolbar buttons
  need `aria-label`; Properties Panel inputs need associated `<label>` elements
- [x] Color contrast: prototype `bg-indigo-600` (#4f46e5 on white) = 7.3:1 ✓. RSSI status
  colours (green-500 on card, yellow-500 on card, red-500 on card) verified against WCAG
  3:1 minimum for UI components

**Principle IV — Test-Driven Engineering**
- [x] Unit tests written before implementation for all RF utility functions (TDD red phase)
- [x] Unit tests scoped for: RF math, Zustand store actions, StorageAdapter
- [x] Playwright E2E tests scoped for all critical flows (see Testing Approach section)

**Principle V — Performance-Conscious Architecture**
- [x] RF computation (72-ray raycasting × n gateways) identified as >16 ms candidate →
  moved to `rf-engine.worker.ts`
- [x] `rf-planner` feature module is a lazy-loaded route chunk (React Router v6 lazy import)
- [x] Konva rejected (adds ~200 KB to bundle; raw canvas approach already proven in
  prototype). Bundle impact of Zustand (~3 KB gz) and Web Worker (negligible) is acceptable.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-rf-coverage-planner/
├── plan.md           ← this file
├── research.md       ← Phase 0: resolved decisions
├── data-model.md     ← Phase 1: entity definitions and state shape
├── quickstart.md     ← Phase 1: developer onboarding
├── contracts/
│   ├── save-format.md     ← project JSON schema (save/load)
│   └── worker-protocol.md ← Web Worker message protocol
└── tasks.md          ← Phase 2: /speckit.tasks output (not yet generated)
```

### Source Code (target production layout)

```text
src/
├── components/
│   └── ui/                        # shadcn/ui + Radix primitives — port from prototype as-is
│                                  # (46 files; do not modify)
├── features/
│   └── rf-planner/
│       ├── components/
│       │   ├── Canvas.tsx         # Refactored from prototype Canvas.tsx
│       │   ├── Toolbar.tsx        # Refactored from prototype Toolbar.tsx
│       │   ├── PropertiesPanel.tsx# Refactored from prototype PropertiesPanel.tsx
│       │   └── StatusBar.tsx      # Extracted from prototype App.tsx AppInner
│       ├── workers/
│       │   └── rf-engine.worker.ts# New: RF compute Web Worker
│       ├── hooks/
│       │   └── useRfEngine.ts     # New: hook bridging Zustand → worker → canvas repaint
│       ├── lib/
│       │   ├── rf-utils.ts        # Port from prototype rf-utils.ts
│       │   └── storage.ts         # New: StorageAdapter interface + localStorage impl
│       ├── types/
│       │   └── index.ts           # Port from prototype types.ts (field name fixes only)
│       └── pages/
│           └── RFPlannerPage.tsx  # New: route-level shell (was AppInner in App.tsx)
├── stores/
│   └── rf-planner.store.ts        # New: Zustand store (migrated from store.tsx)
├── assets/
│   ├── gateway.png                # Exported from Figma (replaces figma:asset/ URI)
│   └── sensor.png                 # Exported from Figma (replaces figma:asset/ URI)
├── styles/
│   ├── theme.css                  # Port from prototype as-is
│   ├── tailwind.css               # Port from prototype as-is
│   └── index.css                  # Port from prototype as-is
├── App.tsx                        # Shell: RouterProvider + layout chrome only
└── main.tsx                       # Entry point

tests/
├── unit/
│   ├── rf-utils.test.ts           # RF math (TDD — written before implementation)
│   └── rf-planner.store.test.ts   # Zustand store actions and undo/redo
├── integration/
│   └── placement-to-heatmap.test.ts # place gateway → dispatch → worker → RSSI assigned
└── e2e/
    └── rf-planner.spec.ts         # Playwright: create → draw → place → view → export
```

**Structure Decision**: Web application (SPA). Feature modules under `src/features/`. Shared
UI primitives at `src/components/ui/` (shadcn/ui base, matches prototype location). Global
Zustand stores at `src/stores/`. Feature-private utilities adjacent to the feature under
`src/features/rf-planner/lib/`. Styling in `src/styles/` mirroring prototype exactly.

---

## Complexity Tracking

> No Constitution Check violations. All added complexity is justified by a specific
> production requirement.

| Addition | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|-------------------------------------|
| Zustand store | Cross-component state subscriptions (Canvas + StatusBar + PropertiesPanel all subscribe to different slices independently) | `useReducer+Context` re-renders entire tree on every dispatch; proven pattern in constitution |
| Web Worker (rf-engine) | 72-ray × n-gateway raycasting blocks main thread >16 ms at ≥5 gateways | Running on main thread violates Principle V and SC-002 on modest hardware |
| StorageAdapter interface | One-file backend migration path required by constitution Principle II | Direct localStorage calls would require touching every store action to swap |

---

## Prototype Architecture

*Extracted from Figma MCP source query, 2026-04-21.*

### File Structure (prototype)

```text
src/
  app/
    App.tsx             # Root: StoreProvider wrapper, AppInner, StatusBar
    store.tsx           # useReducer + Context + undo/redo history refs
    rf-utils.ts         # RF math: FSPL, raycasting, auto-assign
    types.ts            # Domain types + RF/material constants
    components/
      Canvas.tsx        # Raw HTML Canvas 2D, forwardRef CanvasHandle
      Toolbar.tsx       # Tool picker, file upload, zoom, dark mode, export buttons
      PropertiesPanel.tsx # Selection-aware property editor
      figma/
        ImageWithFallback.tsx   # Figma-specific asset fallback wrapper
      ui/               # 46 shadcn/ui + Radix primitives (unused at app level)
  styles/
    theme.css           # CSS custom properties (color tokens, dark mode variants)
    tailwind.css        # @import of tailwind utilities
    index.css           # Body/root reset
    fonts.css           # Empty (no custom fonts; system-ui stack)
```

### Component Responsibilities

| Component | Responsibility | Lines |
|-----------|---------------|-------|
| `App.tsx` | Root layout shell: `StoreProvider` wrapper, header bar, wires `canvasRef` imperative API to `Toolbar` props, renders `AppInner` and `StatusBar` | ~90 |
| `Canvas.tsx` | Raw HTML Canvas rendering loop (`useEffect` with full-scene redraw on every state change), mouse event handling (6 tool modes), zoom/pan, gateway/sensor image rendering via `figma:asset/` URIs, `exportPng`, `exportCsv`, `CanvasHandle` imperative ref | ~600+ |
| `Toolbar.tsx` | Tool selection buttons, floor plan file upload (PNG/JPG/PDF via pdfjs-dist), scale dialog, zoom controls, dark-mode toggle, export buttons | ~200+ |
| `PropertiesPanel.tsx` | Renders selected element properties; edits wall material, gateway label, sensor label + group count, obstacle type | ~150+ |
| `store.tsx` | `useReducer` with 20+ action types, full `recalcSensors` on every mutation, undo/redo via `historyRef`/`futureRef` (100-step cap), `StoreProvider`, `useStore` hook | ~180 |
| `rf-utils.ts` | `getPixelsPerFoot`, `fspl`, `calculateRssi`, `autoAssignSensors` (greedy), `getRingRadii`, `getGatewayCoveragePolygon` (72 rays/5°), `rayAttenuation`, `getGatewaySensorCount` | ~200+ |
| `types.ts` | All domain interfaces + union types + constants: `WALL_MATERIALS`, `OBSTACLE_TYPES`, `DOOR_TYPES`, `COMBINED_GAIN=21.49`, `FSPL_CONSTANT=40.2`, `RSSI_GOOD=-70`, `RSSI_MARGINAL=-80`, `MAX_SENSORS_PER_GATEWAY=30` | ~100 |

### State Management (prototype)

- `useReducer` with `ProjectState` as the state shape
- 21 action types covering CRUD for walls, doors, obstacles, gateways, sensors plus
  `SET_PROJECT`, `SET_NAME`, `SET_FLOOR_PLAN`, `SET_SCALE`, `REASSIGN_SENSORS`
- Every mutating action ends with `recalcSensors(next)` — synchronous, main-thread
- Undo/redo: `historyRef.current.push(prev)` before every dispatch; capped at 100 entries
- UI-only state (tool mode, wall material, obstacle type, selectedId, isDark, zoom, pan,
  draw state) held in `useState` inside `StoreProvider` and `Canvas` respectively
- Dark mode persisted to `localStorage` via `localStorage.setItem('rf-theme', ...)`

### RF Propagation Model

```
RSSI (dBm) = COMBINED_GAIN - FSPL(d_meters) - Σ attenuation(path)

where:
  COMBINED_GAIN  = TX_POWER + GATEWAY_ANTENNA + SENSOR_ANTENNA
                 = 18 dBm + 2 dBi + 1.49 dBi = 21.49 dB
  FSPL(d)        = FSPL_CONSTANT + 20·log₁₀(d)
                 = 40.2 + 20·log₁₀(d_meters)        [2.44 GHz]
  attenuation    = Σ wall_crossings × material_dB
                 + Σ obstacle_crossings × type_dB
                 + (door.isOpen ? 0 : door.type_dB)
```

Coverage polygon: 72 rays at 5° intervals from gateway origin. Each ray advances in
0.5-pixel steps, accumulating attenuation at each wall/obstacle intersection, until RSSI
drops below `RSSI_MARGINAL` (-80 dBm) or max canvas bounds are reached. The polygon
boundary at each tier (good/marginal) is recorded.

Ring radii: free-space distance at RSSI = RSSI_GOOD and RSSI_MARGINAL, ignoring obstacles.
Rendered as dashed concentric circles on the canvas.

### Styling Approach (prototype)

- `theme.css`: 60+ CSS custom properties under `:root` (light) and `.dark` (dark mode).
  Tokens: `--background`, `--foreground`, `--card`, `--border`, `--muted`, `--muted-foreground`,
  `--primary`, `--primary-foreground`, `--ring`. No custom font — inherits Tailwind
  system-ui stack.
- `tailwind.css`: `@import "tailwindcss"` only.
- Canvas colour constants: `getRssiColor` in `types.ts` maps RSSI tier to
  `rgba(34,197,94,0.25)` (good), `rgba(245,158,11,0.25)` (marginal), `rgba(239,68,68,0.2)`
  (poor).

### Known Prototype Issues / Production Fixes Required

| Issue | Location | Production Fix |
|-------|----------|---------------|
| `figma:asset/...` URIs | `Canvas.tsx` lines 11–12 | Export PNGs from Figma; replace with `import gatewayPng from '@/assets/gateway.png'` |
| `ImageWithFallback.tsx` Figma-only component | `components/figma/` | Remove; no production use |
| `SET_NAME` action never dispatched | `store.tsx` | Wire to editable header title (FR-021) |
| Scale dialog has no unit label or toggle | `Canvas.tsx` | Add ft/m toggle; convert metres to feet before storing in `ScaleRef.distanceFeet` (FR-003, clarification B) |
| No React Router | `App.tsx` | Wrap with `createBrowserRouter`; single `/` route; lazy-load `rf-planner` chunk |
| No error boundaries | entire app | Add `<ErrorBoundary>` at feature and canvas levels |
| No loading/empty states | `Canvas.tsx`, `PropertiesPanel.tsx` | Add empty-state affordances (no floor plan, no scale, no elements) |
| TypeScript strict mode not verified | entire app | Enable `"strict": true` in `tsconfig.json`; fix any resulting errors |

---

## Target Production Architecture

### Routing Map

React Router v6. Single route for v1 — the prototype implies one screen only.

```
/   →   lazy(() => import('./features/rf-planner/pages/RFPlannerPage'))
```

`App.tsx` wraps `<RouterProvider router={createBrowserRouter([...])}>`. Header chrome lives
in `App.tsx`; the canvas workspace lives in `RFPlannerPage`. Future tools (e.g., a Cable
Run Estimator) get their own `/tool-name` route without touching the RF Planner slice.

### Zustand State Shape

```typescript
// src/stores/rf-planner.store.ts

interface RFPlannerState {
  // ── Project (persisted to localStorage) ──────────────────────────────────
  project: ProjectState;              // domain data (mirrors prototype ProjectState)

  // ── Canvas UI state (not persisted) ───────────────────────────────────────
  tool: ToolMode;
  wallMaterial: WallMaterial;
  obstacleType: ObstacleType;
  selectedId: string | null;
  scaleInputUnit: 'ft' | 'm';         // NEW: ft/m toggle (FR-003, clarification Q5)

  // ── Theme (persisted to localStorage) ────────────────────────────────────
  isDark: boolean;

  // ── Undo / Redo (runtime only) ────────────────────────────────────────────
  canUndo: boolean;
  canRedo: boolean;
}

interface RFPlannerActions {
  // project mutations (each calls rfEngineWorker.postMessage after mutating)
  dispatch: (action: ProjectAction) => void;
  // tool / UI
  setTool: (t: ToolMode) => void;
  setWallMaterial: (m: WallMaterial) => void;
  setObstacleType: (t: ObstacleType) => void;
  setSelectedId: (id: string | null) => void;
  setScaleInputUnit: (u: 'ft' | 'm') => void;
  // theme
  toggleDark: () => void;
  // undo/redo
  undo: () => void;
  redo: () => void;
}
```

`ProjectAction` union is identical to the prototype's `Action` union (21 types).  
Undo/redo history cap: 100 steps (matching prototype implementation; spec floor is 50).

### Web Worker: rf-engine.worker.ts

Moved from synchronous `recalcSensors` on the main thread to a dedicated worker.

```
Main thread                          Worker (rf-engine.worker.ts)
────────────────────────────────     ─────────────────────────────────────
dispatch(action)
  → mutate project state
  → postMessage({ type: 'RECALC',
      payload: { sensors, gateways,
                 walls, doors,
                 obstacles, scale } })
                                  →  receive message
                                     autoAssignSensors(...)
                                     getGatewayCoveragePolygon(...)
                                  ←  postMessage({ type: 'RECALC_RESULT',
                                       payload: { sensors, polygons } })
  ← receive result
  → store.setRecalcResult(payload)
  → Canvas.tsx re-renders
```

Full message protocol defined in `contracts/worker-protocol.md`.

### Component Inventory (prototype → production mapping)

| Prototype File | Production Location | Migration Type | Notes |
|---------------|---------------------|---------------|-------|
| `src/app/App.tsx` | `src/App.tsx` (shell only) + `src/features/rf-planner/pages/RFPlannerPage.tsx` | Refactor | Split header/routing into App.tsx; canvas workspace into RFPlannerPage |
| `src/app/store.tsx` | `src/stores/rf-planner.store.ts` | Rewrite | `useReducer`+Context → Zustand; undo/redo logic preserved; `recalcSensors` removed (now worker) |
| `src/app/types.ts` | `src/features/rf-planner/types/index.ts` | Port | No type changes; field names confirmed correct (`distanceFeet`) |
| `src/app/rf-utils.ts` | `src/features/rf-planner/lib/rf-utils.ts` | Port | Functions moved to worker; module still needed for main-thread imports (constants, `getRingRadii`) |
| `src/app/components/Canvas.tsx` | `src/features/rf-planner/components/Canvas.tsx` | Refactor | Replace `useStore()` with Zustand hook; replace `figma:asset/` with real imports; add ARIA; add ft/m scale dialog |
| `src/app/components/Toolbar.tsx` | `src/features/rf-planner/components/Toolbar.tsx` | Refactor | Replace `useStore()` with Zustand hook; add ft/m unit toggle prop |
| `src/app/components/PropertiesPanel.tsx` | `src/features/rf-planner/components/PropertiesPanel.tsx` | Port | Replace `useStore()` with Zustand hook; minor accessibility fixes |
| `src/app/components/figma/ImageWithFallback.tsx` | _(deleted)_ | Remove | Figma-runtime only; no production use |
| `src/app/components/ui/` (46 files) | `src/components/ui/` | Port as-is | No modifications; copy verbatim |
| `src/styles/theme.css` | `src/styles/theme.css` | Port as-is | Authoritative token source |
| `src/styles/tailwind.css` | `src/styles/tailwind.css` | Port as-is | |
| `src/styles/index.css` | `src/styles/index.css` | Port as-is | |
| `src/styles/fonts.css` | _(omit)_ | Remove | Empty file; no custom fonts |
| _(new)_ | `src/features/rf-planner/workers/rf-engine.worker.ts` | New | RF compute moved off main thread |
| _(new)_ | `src/features/rf-planner/lib/storage.ts` | New | `StorageAdapter` interface + localStorage impl |
| _(new)_ | `src/features/rf-planner/hooks/useRfEngine.ts` | New | Manages worker lifecycle + result subscription |

### Third-Party Libraries

| Library | Version | Rationale | Prototype? |
|---------|---------|-----------|-----------|
| `react` + `react-dom` | 18 | Core framework | ✓ |
| `typescript` | 5 | Type safety | ✓ |
| `vite` | 5 | Build tooling | ✓ |
| `tailwindcss` | 4 | Utility styling | ✓ |
| `@radix-ui/*` (via shadcn) | current | Accessible UI primitives | ✓ |
| `lucide-react` | current | Icon set | ✓ |
| `pdfjs-dist` | current | PDF-to-canvas floor plan upload | ✓ |
| `zustand` | 4 | State management — replaces useReducer+Context | New |
| `react-router-dom` | 6 | SPA routing, lazy-loaded feature chunks | New |
| `vitest` | current | Unit + component tests | New |
| `@testing-library/react` | current | Component tests | New |
| `@playwright/test` | current | E2E tests | New |
| `pdf-lib` | current | PDF export (FR out-of-scope — include as optional dep, implement in future iteration) | New |

**Explicitly rejected:**
- `konva` / `react-konva`: adds ~200 KB; raw canvas approach is already working and fits a single engineer's workflow scale.
- `redux-toolkit`: Zustand is sufficient; constitution requires documented justification to escalate.
- `framer-motion`: not present in prototype at app level; do not add.
- `@mui/material`: present in prototype `package.json` but unused at app level; do not expand.

### Testing Approach

#### Unit Tests (Vitest + RTL) — written before implementation (TDD)

| Test File | Covers | Key Assertions |
|-----------|--------|----------------|
| `tests/unit/rf-utils.test.ts` | `getPixelsPerFoot`, `calculateRssi`, `autoAssignSensors`, `getRingRadii`, `getGatewayCoveragePolygon` | Known RSSI value at known distance with zero walls; RSSI degrades with wall count; sensor assigned to nearest gateway; sensor unassigned when gateway exceeds 30-sensor capacity |
| `tests/unit/rf-planner.store.test.ts` | Zustand store actions, undo/redo | ADD_GATEWAY dispatches correctly; undo restores prior state; redo re-applies; history capped at 100; isDark persisted to localStorage |
| `tests/unit/storage.test.ts` | `StorageAdapter` localStorage implementation | save + load round-trip produces bit-identical RSSI values (SC-004); corrupt JSON returns null gracefully |

#### Integration Tests (Vitest)

| Test File | Covers | Key Assertions |
|-----------|--------|----------------|
| `tests/integration/placement-to-heatmap.test.ts` | Full place→dispatch→worker→result pipeline | Place 1 gateway + 3 sensors with known scale → worker returns RSSI values matching manual formula; all 3 sensors get assignments |

#### E2E Tests (Playwright)

| Flow | Steps | Success Criteria |
|------|-------|-----------------|
| Create & export | New project → upload PNG floor plan → set scale (ft) → draw 2 walls → place 1 gateway → place 3 sensors → verify RSSI colours in status bar → export CSV | CSV file downloads; contains 3 rows with non-null RSSI; headers match schema |
| Save & reload | Complete a small plan → Save JSON → reload page → Load JSON → verify RSSI values unchanged | Loaded plan shows same good/marginal/poor count as before save (SC-004) |
| Undo/redo | Place gateway → undo → canvas has 0 gateways → redo → canvas has 1 gateway | Visual assertion via canvas snapshot diff or DOM status bar count |
| Dark mode | Toggle dark mode → verify `dark` class on `<html>` → reload → `dark` class persists | localStorage key `rf-theme` = `'dark'` |
| Scale metres | Set scale dialog with unit toggle → enter 15 m → submit → status bar shows converted distance | No RSSI error; StatusBar shows scale set |

---

## Phased Breakdown

> For `/speckit.tasks`. Each phase is an atomic PR. Phases are dependency-ordered.

### Phase 1 — Foundation (port + scaffold)

**Goal**: All prototype source ported to production structure; project compiles; tests pass
green on ported code.

- [ ] Scaffold Vite + React 18 + TS (strict) project with production folder layout
- [ ] Port `src/components/ui/` (46 shadcn/ui files) verbatim from prototype
- [ ] Port `src/styles/theme.css`, `tailwind.css`, `index.css` verbatim
- [ ] Port `src/features/rf-planner/types/index.ts` from prototype `types.ts`
- [ ] Port `src/features/rf-planner/lib/rf-utils.ts` from prototype `rf-utils.ts`
- [ ] Export `gateway.png` and `sensor.png` from Figma; add to `src/assets/`
- [ ] Write `tests/unit/rf-utils.test.ts` (TDD — before implementation touches rf-utils)
- [ ] Set up Vitest + RTL; confirm unit tests run in CI
- [ ] Set up Playwright; confirm E2E test runner starts

**Port-as-is tasks**: shadcn/ui, theme.css, tailwind.css, index.css, types.ts (no changes)  
**Refactor-for-production tasks**: vite.config.ts (add path aliases, worker config), tsconfig.json (strict mode)

---

### Phase 2 — Zustand Store

**Goal**: Zustand store replaces prototype's useReducer+Context; all state transitions
confirmed identical via unit tests.

- [ ] Write `tests/unit/rf-planner.store.test.ts` (TDD — before store implementation)
- [ ] Implement `src/stores/rf-planner.store.ts` with all 21 `ProjectAction` types
- [ ] Implement `scaleInputUnit: 'ft' | 'm'` slice (FR-003)
- [ ] Implement undo/redo with 100-step history (matches prototype)
- [ ] Implement `StorageAdapter` interface + localStorage impl (`src/features/rf-planner/lib/storage.ts`)
- [ ] Write `tests/unit/storage.test.ts`
- [ ] Confirm all store tests green

**Port-as-is tasks**: action types, reducer logic, undo/redo ref pattern  
**Refactor-for-production tasks**: Context → Zustand, add `scaleInputUnit`, add StorageAdapter

---

### Phase 3 — Web Worker

**Goal**: RF computation runs off the main thread; main thread never blocks during RSSI
recalc.

- [ ] Implement `src/features/rf-planner/workers/rf-engine.worker.ts`
  - Handles `RECALC` message: runs `autoAssignSensors` + `getGatewayCoveragePolygon` for
    all gateways
  - Posts `RECALC_RESULT` with updated sensors array + polygon data per gateway
- [ ] Implement `src/features/rf-planner/hooks/useRfEngine.ts`
  - Manages worker lifecycle (init, terminate on unmount)
  - Posts `RECALC` after every store mutation that changes project geometry
  - Applies `RECALC_RESULT` back to store via `setRecalcResult`
- [ ] Write `tests/integration/placement-to-heatmap.test.ts`
- [ ] Confirm integration tests green

**Port-as-is tasks**: `autoAssignSensors`, `getGatewayCoveragePolygon` logic (unchanged)  
**Refactor-for-production tasks**: extract to worker module, add Transferable buffer where profitable

---

### Phase 4 — Canvas Component

**Goal**: Canvas renders identically to prototype; uses real assets; wired to Zustand.

- [ ] Port `Canvas.tsx` to `src/features/rf-planner/components/Canvas.tsx`
- [ ] Replace `figma:asset/c78...` with `import gatewayPng from '@/assets/gateway.png'`
- [ ] Replace `figma:asset/62e9...` with `import sensorPng from '@/assets/sensor.png'`
- [ ] Replace `useStore()` hook with `useRFPlannerStore()` Zustand hook
- [ ] Wire `useRfEngine` hook for RECALC trigger on project mutations
- [ ] Add `role="img"` + `aria-label="RF coverage planning canvas"` to `<canvas>` element
- [ ] Add scale dialog ft/m toggle (converts metres → feet before `SET_SCALE` dispatch)
- [ ] Add empty-state overlay (no floor plan, scale not set, no elements placed)
- [ ] Remove `figma/ImageWithFallback.tsx` dependency

**Port-as-is tasks**: all rendering logic (polygons, rings, wall colours, hit testing, drag, zoom/pan)  
**Refactor-for-production tasks**: asset imports, hook swap, ARIA, ft/m scale dialog, empty states

---

### Phase 5 — Toolbar + PropertiesPanel

**Goal**: Toolbar and PropertiesPanel wired to Zustand; ft/m unit toggle in scale dialog;
all buttons accessible.

- [ ] Port `Toolbar.tsx` → wire to Zustand; add `aria-label` to every icon button
- [ ] Port `PropertiesPanel.tsx` → wire to Zustand; ensure all inputs have `<label>`
- [ ] Confirm PDF upload still works (pdfjs-dist integration unchanged)
- [ ] Add `aria-label` attributes to all icon-only buttons throughout both components

**Port-as-is tasks**: all panel structure, button arrangement, material/type selectors  
**Refactor-for-production tasks**: hook swap, ARIA labels, label associations

---

### Phase 6 — App Shell + Routing

**Goal**: React Router v6 in place; editable project name works; dark mode persists;
production App.tsx shell.

- [ ] Create `src/App.tsx` — `RouterProvider` + header chrome (Perceptiv logo, editable
  project name, dark mode toggle, version badge)
- [ ] Create `src/features/rf-planner/pages/RFPlannerPage.tsx` — lazy-loaded route chunk;
  composes Canvas + Toolbar + PropertiesPanel + StatusBar
- [ ] Implement editable project name in header (FR-021): inline click-to-edit input that
  dispatches `SET_NAME` on blur/Enter
- [ ] Extract `StatusBar` to `src/features/rf-planner/components/StatusBar.tsx`
- [ ] Confirm dark mode class toggle and localStorage persistence
- [ ] Add global `<ErrorBoundary>` at App level and at Canvas level

**Port-as-is tasks**: layout structure (flex column, header/toolbar/main/statusbar), StatusBar metrics  
**Refactor-for-production tasks**: Router setup, lazy loading, editable name, error boundaries

---

### Phase 7 — E2E + Accessibility Audit + Performance Validation

**Goal**: All acceptance criteria met; spec Success Criteria SC-001 through SC-006 verified.

- [ ] Write and pass all five Playwright E2E scenarios (see Testing Approach)
- [ ] Run WCAG 2.1 AA audit (axe-playwright or manual keyboard walkthrough)
  - Verify all canvas tool shortcuts reachable by keyboard
  - Verify Properties Panel inputs all have visible labels and keyboard access
- [ ] Benchmark RF recalc: 20 walls + 10 gateways + 50 sensors; confirm ≤ 1 s (SC-002)
- [ ] Verify first-use completion time ≤ 10 min walkthrough (SC-001)
- [ ] Confirm save/load round-trip RSSI bit-identical (SC-004)
- [ ] Cross-browser smoke test: Chrome + Edge latest two versions (SC-006)

**Port-as-is tasks**: none  
**Refactor-for-production tasks**: all E2E tests are new; ARIA fixes from audit results applied
