# Tasks: RF Coverage Planner

**Feature**: `001-rf-coverage-planner` | **Branch**: `001-rf-coverage-planner` | **Date**: 2026-04-21  
**Input**: `specs/001-rf-coverage-planner/plan.md`, `spec.md`, `data-model.md`, `contracts/`  
**Figma MCP queried**: 2026-04-21 — confirmed prototype source file inventory  
**Prototype source**: `https://www.figma.com/make/ZzjCw7mP1LFPjeKqkD5sog/Perceptiv-Design-Studio`

---

## Format: `[ID] [P?] [Story?] Description — file path`

- **[P]**: Parallelizable (touches different files, no incomplete prerequisites)
- **[US#]**: User story scope (US1=Floor Plan Setup, US2=Facility Drawing, US3=Hardware Placement, US4=Coverage Viz, US5=Auto-Assign, US6=Save/Load/Export)
- Setup and Foundational phases carry no story label
- Every task references prototype source file(s) being ported, refactored, or flagged as new work

---

## Phase 1: Foundation — Project Setup + Style Ports

**Goal**: Vite + React 18 + TypeScript strict project scaffolded in production folder layout; all
prototype style and UI primitive files ported verbatim; test runners wired; project compiles
green with zero code-coverage tasks failing.

**Prototype source files consulted**: `vite.config.ts`, `package.json`, `postcss.config.mjs`,
`src/styles/theme.css`, `src/styles/tailwind.css`, `src/styles/index.css`,
`src/app/components/ui/` (46 files)

- [X] T001 Scaffold Vite 5 + React 18 + TypeScript 5 strict project with production folder layout
  (`src/features/`, `src/stores/`, `src/components/ui/`, `src/assets/`, `src/styles/`,
  `tests/unit/`, `tests/integration/`, `tests/e2e/`) — `vite.config.ts`, `tsconfig.json`,
  `package.json`
  **New work — no prototype equivalent** (prototype has no path-alias config or worker Vite plugin)
  _Acceptance_: `pnpm dev` starts; `pnpm build` succeeds; `tsc --noEmit` passes on an empty `src/main.tsx`

- [X] T002 Configure `vite.config.ts` with `@/` path alias, `?worker` Web Worker support, and
  `vitest` test config — `vite.config.ts`
  **Refactor prototype file `vite.config.ts`** (add worker plugin, path aliases, vitest section)
  _Acceptance_: `import X from '@/stores/...'` resolves; `new Worker(new URL('...worker.ts', import.meta.url))` compiles without error

- [X] T003 [P] Port `src/styles/theme.css` verbatim from prototype `src/styles/theme.css` — `src/styles/theme.css`
  **Port from prototype file `src/styles/theme.css`**
  _Acceptance_: File byte-identical to prototype; all 60+ CSS custom properties present under `:root` and `.dark`

- [X] T004 [P] Port `src/styles/tailwind.css` and `src/styles/index.css` verbatim from prototype — `src/styles/tailwind.css`, `src/styles/index.css`
  **Port from prototype files `src/styles/tailwind.css`, `src/styles/index.css`**
  _Acceptance_: `@import "tailwindcss"` present; body/root reset applied; `fonts.css` omitted (empty in prototype)

- [X] T005 [P] Port all 46 shadcn/ui files verbatim from prototype `src/app/components/ui/` to `src/components/ui/` — `src/components/ui/*.tsx`
  **Port from prototype files `src/app/components/ui/*.tsx`**
  _Acceptance_: All 46 files present; no import paths modified; `pnpm build` shows no errors from ui/ directory

- [X] T006 [P] Configure Vitest + React Testing Library — `package.json`, `vitest.config.ts`
  **New work — no prototype equivalent**
  _Acceptance_: `pnpm test` runs and exits 0 on an empty test suite

- [X] T007 [P] Configure Playwright — `playwright.config.ts`, `package.json`
  **New work — no prototype equivalent**
  _Acceptance_: `pnpm test:e2e` launches browser and completes on an empty spec file

- [X] T008 Export `gateway.png` and `sensor.png` from Figma Make prototype assets;
  add to `src/assets/` — `src/assets/gateway.png`, `src/assets/sensor.png`
  **New work** (prototype uses `figma:asset/c78a731...` and `figma:asset/62e9c528...` URIs — not valid in production Vite build)
  _Acceptance_: Both files present in `src/assets/`; `import gatewayPng from '@/assets/gateway.png'` resolves in a test file

**Checkpoint — Phase 1 complete**: Project compiles; 46 shadcn/ui primitives available; styles ported; Vitest + Playwright wired; assets ready

---

## Phase 2: Foundational — Types + RF Math + Store + Storage

**Purpose**: All shared domain primitives and core business logic in place. No user-story
component work can begin until the store and RF utilities are functional and unit-tested.

**Prototype source files consulted**: `src/app/types.ts`, `src/app/rf-utils.ts`, `src/app/store.tsx`

**⚠️ CRITICAL**: All Phase 3–8 tasks depend on Phase 2 completion.

### TDD — write and red-fail tests first (Principle IV)

- [X] T009 Write `tests/unit/rf-utils.test.ts` covering: `getPixelsPerFoot`, `fspl`,
  `calculateRssi` (known distance, zero walls), RSSI degrades with wall count,
  `autoAssignSensors` assigns to nearest gateway, sensor unassigned when gateway exceeds
  30-sensor capacity, `getRingRadii` returns correct pixel radii at given scale,
  `getGatewayCoveragePolygon` returns 72-point polygon array
  **Port from prototype `src/app/rf-utils.ts`** (extract expected values from prototype function signatures)
  _Acceptance_: All tests `FAIL` (red) before implementation; `pnpm test` exit non-zero

- [X] T010 Write `tests/unit/rf-planner.store.test.ts` covering: `ADD_GATEWAY` and
  `ADD_SENSOR` dispatches; `DELETE_WALL` cascades to doors; `UNDO`/`REDO` restores and
  re-applies state; history capped at 100 steps; `isDark` persisted to localStorage;
  `scaleInputUnit` toggle between `'ft'` and `'m'`
  **Port from prototype `src/app/store.tsx`** (extract action semantics from reducer)
  _Acceptance_: All tests `FAIL` (red) before implementation

- [X] T011 Write `tests/unit/storage.test.ts` covering: `saveProject` → `loadProject`
  round-trip produces bit-identical output; corrupt JSON input returns `null` gracefully
  **New work — no prototype equivalent** (prototype has no `StorageAdapter` abstraction)
  _Acceptance_: All tests `FAIL` (red) before implementation

### Implementation

- [X] T012 Port `src/features/rf-planner/types/index.ts` from prototype `src/app/types.ts`
  **Port from prototype file `src/app/types.ts`** — no type changes; field names confirmed correct
  (`distanceFeet`, not `distanceFt`); add `scaleInputUnit: 'ft' | 'm'` to UI state types
  _Acceptance_: `pnpm build` compiles; all 21 `ProjectAction` types present; RF constants present
  (`COMBINED_GAIN=21.49`, `FSPL_CONSTANT=40.2`, `RSSI_GOOD=-70`, `RSSI_MARGINAL=-80`,
  `MAX_SENSORS_PER_GATEWAY=30`)

- [X] T013 Port `src/features/rf-planner/lib/rf-utils.ts` from prototype `src/app/rf-utils.ts`
  **Port from prototype file `src/app/rf-utils.ts`** — no algorithmic changes; update imports to
  use `@/features/rf-planner/types`
  _Acceptance_: `tests/unit/rf-utils.test.ts` turns green; `pnpm test` passes

- [X] T014 Implement `src/stores/rf-planner.store.ts` — Zustand store with all 21
  `ProjectAction` types (migrated from prototype `src/app/store.tsx`), `scaleInputUnit`
  UI state slice (FR-003), undo/redo with 100-step history, `isDark` persisted to
  `localStorage`, `coveragePolygons` result slice for Web Worker output
  **Refactor prototype file `src/app/store.tsx`** (`useReducer`+Context → Zustand; remove
  synchronous `recalcSensors` call — that moves to worker in Phase 3)
  _Acceptance_: `tests/unit/rf-planner.store.test.ts` turns green; store exports
  `useRFPlannerStore`; `canUndo`/`canRedo` flags computed correctly

- [X] T015 Implement `src/features/rf-planner/lib/storage.ts` — `StorageAdapter` interface
  + localStorage implementation (`saveProject`, `loadProject`, `saveTheme`, `loadTheme`)
  **New work — no prototype equivalent** (prototype calls `localStorage` directly in `store.tsx`)
  _Acceptance_: `tests/unit/storage.test.ts` turns green; save + load round-trip verified

**Checkpoint — Phase 2 complete**: All 3 unit test files green; RF math, store, and storage tested; types locked

---

## Phase 3: User Story 1 — Floor Plan Setup (Priority: P1) 🎯 MVP

**Goal**: Engineer can upload a PNG/JPG/PDF floor plan (or work on blank canvas), calibrate
scale with a ft/m toggle, and have scale persisted. No hardware placement yet.

**Independent Test**: Open blank project → upload PNG → set scale to "50 ft" → save project →
reload → scale preserved and StatusBar shows scale set, no RSSI errors.

**Prototype source files consulted**: `src/app/components/Canvas.tsx` (floor plan image load,
`set-scale` tool mode, `SET_FLOOR_PLAN`/`SET_SCALE` dispatches),
`src/app/components/Toolbar.tsx` (file upload handler, PDF-to-canvas via `pdfjs-dist`)

### Implementation

- [X] T016 [US1] Port `src/features/rf-planner/components/Canvas.tsx` foundation — canvas
  element, zoom/pan local state, `useRFPlannerStore` subscription, `requestAnimationFrame`
  render loop, floor plan background image rendering (`floorPlanImg` state, `SET_FLOOR_PLAN`
  dispatch), empty-state overlay (no floor plan / scale not set)
  **Refactor prototype file `src/app/components/Canvas.tsx`** — replace `useStore()` with
  `useRFPlannerStore()`; replace `figma:asset/` image URIs with `import gatewayPng from
  '@/assets/gateway.png'`; add `role="img"` + `aria-label="RF coverage planning canvas"` to
  `<canvas>`; add empty-state overlay
  _Acceptance_: Canvas renders on screen; floor plan PNG displays as background; `<canvas>`
  passes axe ARIA check; empty-state overlay visible when `project.floorPlan === null`

- [X] T017 [US1] Implement `set-scale` tool mode in `Canvas.tsx` — two-click point selection,
  scale dialog with ft/m unit toggle, metres-to-feet conversion before `SET_SCALE` dispatch
  **Refactor prototype file `src/app/components/Canvas.tsx`** (scale tool exists; add ft/m
  toggle — new work per FR-003 and clarification Q5)
  _Acceptance_: Setting scale with "15 m" input stores `distanceFeet = 49.21` in `ScaleRef`;
  setting with "50 ft" stores `distanceFeet = 50`; StatusBar reflects scale set

- [X] T018 [US1] Port floor plan upload in `src/features/rf-planner/components/Toolbar.tsx`
  foundation — file upload button (PNG/JPG/PDF), `pdfjs-dist` PDF-to-canvas render
  (page 1 only), dispatches `SET_FLOOR_PLAN`
  **Refactor prototype file `src/app/components/Toolbar.tsx`** — replace `useStore()` with
  `useRFPlannerStore()`; add `aria-label` to all icon-only buttons
  _Acceptance_: Uploading a PNG displays it on canvas; uploading a 2-page PDF renders page 1
  only; all toolbar buttons have accessible labels

- [X] T019 [US1] Write integration test — floor plan upload → SET_FLOOR_PLAN → canvas renders
  image; set scale (ft) → SET_SCALE → `project.scale.distanceFeet` correct;
  set scale (m) → metres converted to feet — `tests/integration/placement-to-heatmap.test.ts`
  (stub test, expanded in Phase 5)
  **New work — no prototype equivalent**
  _Acceptance_: Test green; `distanceFeet` matches formula for both unit modes

**Checkpoint — US1 complete**: Floor plan upload, scale calibration (ft + m), and persistence all
functional and tested independently

---

## Phase 4: User Story 2 — Facility Drawing (Priority: P2)

**Goal**: Engineer can draw wall segments with material types, place rectangular obstacles,
edit material via Properties Panel, delete elements, and undo/redo. RSSI values recalculate
after every structural change.

**Independent Test**: Draw 3 walls (drywall/concrete/steel), place 2 obstacles (machinery/racking)
on blank canvas → select each → Properties Panel shows correct material. Undo removes last wall.

**Prototype source files consulted**: `src/app/components/Canvas.tsx` (`draw-wall` mode,
snap-to-vertex, `place-obstacle` mode), `src/app/components/Toolbar.tsx` (material selector),
`src/app/components/PropertiesPanel.tsx` (wall material editor, length display),
`src/app/store.tsx` (`ADD_WALL`, `UPDATE_WALL`, `DELETE_WALL` → cascades doors, `ADD_OBSTACLE`,
`DELETE_OBSTACLE`)

### Implementation

- [X] T020 [US2] Implement `draw-wall` tool mode in `Canvas.tsx` — two-click wall placement,
  snap-to-vertex within 10px, wall rendering with material colour from `WALL_MATERIALS`,
  `ADD_WALL` dispatch on second click
  **Refactor prototype file `src/app/components/Canvas.tsx`** (port existing logic; no
  algorithmic changes)
  _Acceptance_: Clicking two canvas points draws a wall; vertex snap activates within 10px;
  wall colour matches `WALL_MATERIALS[material].color`

- [X] T021 [US2] Implement `place-obstacle` tool mode in `Canvas.tsx` — drag-to-size rectangle,
  `ADD_OBSTACLE` dispatch on mouse-up; obstacle rendered with `OBSTACLE_TYPES[type].color`
  **Refactor prototype file `src/app/components/Canvas.tsx`**
  _Acceptance_: Drag on canvas creates a correctly-sized obstacle rectangle; color matches type

- [X] T022 [US2] Implement element selection and deletion in `Canvas.tsx` — click to select
  wall/obstacle/gateway/sensor (hit-test logic), Delete key dispatches `DELETE_WALL` /
  `DELETE_OBSTACLE` / `DELETE_GATEWAY` / `DELETE_SENSOR`, `DELETE_WALL` cascades to doors
  **Refactor prototype file `src/app/components/Canvas.tsx`**
  _Acceptance_: Selected element highlights; Delete key removes it; `DELETE_WALL` on a wall with
  a door removes the door too (confirmed in prototype `store.tsx`)

- [X] T023 [US2] Port material-type selector in `Toolbar.tsx` — wall material `<Select>` and
  obstacle type `<Select>` update `setWallMaterial` / `setObstacleType` in Zustand store
  **Refactor prototype file `src/app/components/Toolbar.tsx`**
  _Acceptance_: Changing material in toolbar before drawing applies that material to next wall

- [X] T024 [US2] Port `src/features/rf-planner/components/PropertiesPanel.tsx` — selection-
  aware panel showing wall material + computed length in feet, obstacle type; edit dispatches
  `UPDATE_WALL` / `UPDATE_OBSTACLE`; all inputs have associated `<label>` elements
  **Refactor prototype file `src/app/components/PropertiesPanel.tsx`** — replace
  `useStore()` with `useRFPlannerStore()`; add `<label>` associations to all inputs
  _Acceptance_: Selecting a wall shows material and length; changing material updates RSSI
  immediately (via worker); all inputs keyboard-accessible; axe reports no label violations

**Checkpoint — US2 complete**: Wall drawing, obstacle placement, property editing, and undo/redo
all functional with recalculation on every change

---

## Phase 5: User Story 3 — Hardware Placement (Priority: P1) 🎯 MVP

**Goal**: Engineer can place gateways and sensors; each sensor auto-assigns to best gateway
and shows RSSI with colour-coded tier. Coverage halo renders around each gateway.

**Independent Test**: Place 1 gateway + 3 sensors on blank canvas with scale set (no walls) →
all 3 sensors green (good RSSI); move sensor far away → tier changes to marginal/poor.

**Prototype source files consulted**: `src/app/components/Canvas.tsx` (`place-gateway`,
`place-sensor` tool modes, gateway/sensor image render, drag-to-move, `getRingRadii` render),
`src/app/rf-utils.ts` (`autoAssignSensors`, `calculateRssi`, `getGatewayCoveragePolygon`),
`src/app/components/PropertiesPanel.tsx` (gateway capacity display, sensor RSSI colour)

### TDD — integration test

- [X] T025 [US3] Expand `tests/integration/placement-to-heatmap.test.ts` — place 1 gateway +
  3 sensors at known positions with known scale → worker returns RSSI values matching manual
  FSPL formula; all 3 sensors assigned to the gateway; no sensor assigned when gateway
  exceeds 30-sensor capacity
  **Port from prototype `src/app/rf-utils.ts`** (extract expected values from `autoAssignSensors`
  and `calculateRssi` function signatures)
  _Acceptance_: Test green after worker hook implemented in T027

### Implementation

- [X] T026 [US3] Implement `src/features/rf-planner/workers/rf-engine.worker.ts` — handles
  `RECALC` message: runs `autoAssignSensors` then `getGatewayCoveragePolygon` for each
  gateway; posts `RECALC_RESULT` with updated sensors array + polygon array
  **New work — no prototype equivalent** (prototype runs `recalcSensors` synchronously on
  main thread in `src/app/store.tsx`; logic itself is ported from `src/app/rf-utils.ts`)
  Protocol: `contracts/worker-protocol.md`
  _Acceptance_: Worker compiles; posting a `RECALC` message returns `RECALC_RESULT` with
  correct sensor RSSI values matching manual formula

- [X] T027 [US3] Implement `src/features/rf-planner/hooks/useRfEngine.ts` — worker lifecycle
  (init on mount, terminate on unmount), posts `RECALC` after every store project mutation,
  debounce 50ms on mousemove / immediate on click, applies `RECALC_RESULT` to store via
  `setRecalcResult`
  **New work — no prototype equivalent**
  _Acceptance_: After placing a gateway, a `RECALC` is posted within 50ms; `RECALC_RESULT`
  updates `store.coveragePolygons`; integration test T025 turns green

- [X] T028 [US3] Implement `place-gateway` and `place-sensor` tool modes in `Canvas.tsx` —
  click to place; render gateway/sensor images (`gatewayPng`/`sensorPng`); render ring radii
  as dashed concentric circles (`getRingRadii`); connect `useRfEngine` hook; drag-to-move
  dispatches `MOVE_GATEWAY` / `MOVE_SENSOR` and triggers worker
  **Refactor prototype file `src/app/components/Canvas.tsx`** — replace `figma:asset/` with
  real PNG imports; rings rendering logic unchanged; worker trigger via `useRfEngine`
  _Acceptance_: Gateway placed; dashed ring halos visible; sensor placed shows RSSI tier colour;
  moving gateway triggers recalculation via worker

- [X] T029 [US3] Extend `PropertiesPanel.tsx` for hardware — gateway capacity readout
  (`count/MAX_SENSORS_PER_GATEWAY`), sensor RSSI with colour badge (green ≥ -70, yellow
  -70 to -80, red < -80 dBm), assigned gateway label, editable sensor label + group count
  (dispatches `UPDATE_SENSOR`)
  **Refactor prototype file `src/app/components/PropertiesPanel.tsx`**
  _Acceptance_: Selecting a sensor shows RSSI and tier colour; selecting a gateway shows
  current/max capacity; group count edit dispatches UPDATE_SENSOR and triggers recalc

**Checkpoint — US3 complete**: Gateway and sensor placement, auto-assignment, RSSI calculation, and
coverage halos all functional. US1 + US3 together represent the MVP slice.

---

## Phase 6: User Story 4 — Coverage Visualization (Priority: P2)

**Goal**: Per-gateway directional RSSI polygon rendered on canvas with distinct tier colours
(good/marginal/poor). Polygon boundary indented where walls attenuate signal. Status bar
shows aggregate good/marginal/poor sensor counts.

**Independent Test**: Place 1 gateway, scale set, draw 1 concrete wall across the canvas →
polygon boundary visibly closer to gateway on the wall side vs. open side.

**Prototype source files consulted**: `src/app/rf-utils.ts` (`getGatewayCoveragePolygon`,
72-ray raycasting), `src/app/components/Canvas.tsx` (polygon rendering, `getRssiColor` from
`types.ts`), `src/app/App.tsx` (StatusBar counts: good/marginal/poor sensors)

### Implementation

- [X] T030 [US4] Implement coverage polygon rendering in `Canvas.tsx` — draw filled polygon
  per gateway per tier (good: `rgba(34,197,94,0.25)`, marginal: `rgba(245,158,11,0.25)`,
  poor: `rgba(239,68,68,0.2)`) from `store.coveragePolygons` returned by worker
  **Refactor prototype file `src/app/components/Canvas.tsx`** (polygon rendering logic
  unchanged; data now from Zustand store instead of synchronous recalc)
  _Acceptance_: Gateway placed with walls → three coloured polygon regions visible; polygon
  indented correctly on wall side (manual visual inspection + canvas snapshot test)

- [X] T031 [US4] Extract and implement `src/features/rf-planner/components/StatusBar.tsx` —
  displays good/marginal/poor sensor counts, total sensor count, scale set indicator
  **Refactor prototype file `src/app/App.tsx`** (StatusBar is inline in `AppInner`; extract
  to own component and wire to `useRFPlannerStore`)
  _Acceptance_: StatusBar shows correct counts updating in real time as sensors are placed
  and recalc completes; scale indicator shows "Scale: set" / "Scale: not set"

- [X] T032 [US4] Add empty-state for coverage — when `project.scale === null`, suppress
  polygon rendering and show a canvas overlay "Set scale to enable RF calculations"
  **Refactor prototype file `src/app/components/Canvas.tsx`** (new empty state per plan)
  _Acceptance_: No polygons rendered without scale set; overlay visible; polygons appear
  immediately after scale is calibrated

**Checkpoint — US4 complete**: Coverage visualization fully functional; StatusBar aggregate counts live

---

## Phase 7: User Story 5 — Auto-Assign Sensors (Priority: P2)

**Goal**: Sensors automatically assigned to best-RSSI gateway respecting 30-sensor cap.
Reassignment triggers on every structural change. Overflow state indicated in Properties Panel.

**Independent Test**: Place 3 gateways + 20 sensors → all 20 assigned; move sensor to be
closest to a different gateway → sensor reassigns immediately.

**Prototype source files consulted**: `src/app/rf-utils.ts` (`autoAssignSensors` greedy
algorithm — already ported to worker in T026), `src/app/store.tsx` (`REASSIGN_SENSORS`
action, `recalcSensors` call pattern), `src/app/components/PropertiesPanel.tsx` (assigned
gateway label, capacity overflow indicator)

### Implementation

- [X] T033 [US5] Verify `autoAssignSensors` in worker handles capacity overflow correctly —
  sensor assigned to best-RSSI gateway regardless when all gateways at capacity; review
  `src/features/rf-planner/workers/rf-engine.worker.ts`
  **Port from prototype file `src/app/rf-utils.ts`** (`autoAssignSensors` logic; verify
  overflow case against prototype behaviour)
  _Acceptance_: Unit test case (from T009) for >30-sensor capacity overflow passes; sensor
  gets `assignedGatewayId` of best-RSSI gateway with `overCapacity: true` flag in result

- [X] T034 [US5] Add over-capacity indicator in `PropertiesPanel.tsx` and gateway canvas
  render — visual badge when assigned sensor count exceeds `MAX_SENSORS_PER_GATEWAY`
  **New work** (prototype has no overflow indicator; FR-007/FR-008 require visible overflow state)
  _Acceptance_: Gateway with 31+ assigned sensors shows red capacity badge; Properties Panel
  shows "31/30 — Over Capacity" warning; keyboard-accessible (no colour-only indicator)

- [X] T035 [US5] Validate `REASSIGN_SENSORS` action in Zustand store triggers worker `RECALC`
  immediately (not debounced) — verify `useRfEngine.ts` debounce bypass on explicit reassign
  **Refactor prototype file `src/app/store.tsx`** / `src/features/rf-planner/hooks/useRfEngine.ts`
  _Acceptance_: `store.dispatch({ type: 'REASSIGN_SENSORS' })` triggers immediate `RECALC`
  postMessage; integration test verifies new assignment visible in < 100ms

**Checkpoint — US5 complete**: Auto-assignment with capacity enforcement fully functional and tested

---

## Phase 8: User Story 6 — Save, Load, and Export (Priority: P3)

**Goal**: Engineer saves project as JSON, loads it, exports PNG canvas snapshot and CSV BOM.
Save/load round-trip produces bit-identical RSSI values (SC-004).

**Independent Test**: Full plan → Save JSON → reload page → Load JSON → good/marginal/poor
counts identical to pre-save; CSV download has correct row count and headers.

**Prototype source files consulted**: `src/app/components/Toolbar.tsx` (`handleSave`,
`handleLoad`, `handleFloorPlanUpload`), `src/app/components/Canvas.tsx` (`exportPng`,
`exportCsv`), `src/app/store.tsx` (`SET_PROJECT` dispatch on load)

### Implementation

- [X] T036 [US6] Implement Save JSON in `Toolbar.tsx` — serialize `store.project` to JSON
  Blob (schema per `contracts/save-format.md`), trigger download via `<a>` click,
  include project name and `savedAt` timestamp
  **Refactor prototype file `src/app/components/Toolbar.tsx`** (`handleSave` exists; update
  serialization to match `save-format.md` v1.0.0 schema)
  _Acceptance_: Save button downloads `.json`; file contains all entity arrays and `version: "1.0.0"`

- [X] T037 [US6] Implement Load JSON in `Toolbar.tsx` — file picker, `JSON.parse` in
  `try/catch`, dispatch `SET_PROJECT`, immediately trigger `RECALC` via worker hook
  **Refactor prototype file `src/app/components/Toolbar.tsx`** (`handleLoad` exists; wrap
  with proper error handling; trigger recalc on load)
  _Acceptance_: Load button restores all project data; RSSI values identical to saved state
  (SC-004); corrupt JSON shows error toast, does not corrupt store

- [X] T038 [US6] Implement Export PNG in `Canvas.tsx` — `canvas.toDataURL('image/png')`,
  trigger download
  **Port from prototype file `src/app/components/Canvas.tsx`** (`exportPng` exists;
  wire to Toolbar button in production)
  _Acceptance_: Export PNG button downloads PNG of current canvas state including floor plan,
  walls, devices, and coverage polygons

- [X] T039 [US6] Implement Export CSV in `Canvas.tsx` — generate CSV with columns: sensor
  label, assigned gateway label, RSSI (dBm), signal tier (good/marginal/poor), group count;
  include summary block (gateway count, sensor count, coverage %)
  **Port from prototype file `src/app/components/Canvas.tsx`** (`exportCsv` exists; verify
  schema against spec FR-018)
  _Acceptance_: CSV downloads; contains 1 header row + 1 row per sensor; all 5 required
  columns present; summary block at bottom

- [X] T040 [US6] Extend `storage.ts` `StorageAdapter` to auto-save `project` to localStorage
  on every store mutation, and restore on app load
  **New work** (prototype has no auto-save; `handleSave` is manual only)
  _Acceptance_: Refreshing the page restores the last project state; new project clears storage

**Checkpoint — US6 complete**: Full persistence and export workflow functional and round-trip verified

---

## Phase 9: App Shell, Routing, and Project Naming

**Goal**: React Router v6 in place; editable project name works (FR-021); dark mode persists;
error boundaries protect both app and canvas levels.

**Prototype source files consulted**: `src/app/App.tsx` (header layout, `StoreProvider`,
`AppInner`, dark mode toggle), `src/app/store.tsx` (`SET_NAME` action — wired in reducer
but never dispatched in prototype)

- [ ] T041 Implement `src/App.tsx` — `RouterProvider` with `createBrowserRouter` (single `/`
  route, lazy-loads `RFPlannerPage`), Perceptiv header chrome, dark mode toggle button,
  version badge, global `<ErrorBoundary>`
  **Refactor prototype file `src/app/App.tsx`** (split header/routing into App.tsx; canvas
  workspace into RFPlannerPage; React Router is new work)
  _Acceptance_: Navigating to `/` loads RF Planner; `<ErrorBoundary>` catches thrown error
  without crashing full app; lazy chunk in Network tab shows separate bundle

- [ ] T042 Implement `src/features/rf-planner/pages/RFPlannerPage.tsx` — lazy-loaded route
  component composing `Canvas`, `Toolbar`, `PropertiesPanel`, `StatusBar`, `useRfEngine`
  **Refactor prototype file `src/app/App.tsx`** (`AppInner` extracted to this component)
  _Acceptance_: RFPlannerPage renders all 4 sub-components; builds as a separate Vite chunk;
  `<ErrorBoundary>` wraps Canvas specifically

- [ ] T043 Implement editable project name in header — inline click-to-edit `<input>` that
  dispatches `SET_NAME` on blur/Enter; displays project name from `store.project.name`
  **New work** (FR-021; `SET_NAME` action exists in prototype `src/app/store.tsx` but no UI
  calls it — flagged as P6 in Prototype Reconciliation)
  _Acceptance_: Clicking project name in header makes it editable; pressing Enter saves;
  name appears in saved JSON; keyboard-accessible (Tab → Enter pattern)

- [ ] T044 [P] Confirm dark mode toggle wires correctly to Zustand `toggleDark` and
  `StorageAdapter.saveTheme`; verify `dark` class applied to `<html>` on toggle and persisted
  **Refactor prototype file `src/app/App.tsx`** (dark mode toggle exists; wire to Zustand
  instead of local state)
  _Acceptance_: `localStorage.getItem('rf-theme')` = `'dark'` after toggle; reloading page
  restores dark mode; `dark` class on `<html>`

**Checkpoint — Phase 9 complete**: Full app shell, routing, project naming, dark mode all functional

---

## Phase 10: Polish — Accessibility Audit + E2E Tests + Performance

**Goal**: All spec Success Criteria SC-001 through SC-006 verified. WCAG 2.1 AA audit passed.
RF recalculation meets 1-second budget. All five Playwright E2E scenarios passing.

**Prototype source files consulted**: None — all new work

- [ ] T045 Write and pass Playwright E2E: "Create & export" flow — new project → upload PNG
  floor plan → set scale (ft) → draw 2 walls → place 1 gateway → place 3 sensors → verify
  RSSI tier colours in StatusBar → export CSV → verify CSV contains 3 rows with non-null RSSI
  `tests/e2e/rf-planner.spec.ts`
  **New work — no prototype equivalent**
  _Acceptance_: `pnpm test:e2e` passes; CSV file presence and row count verified

- [ ] T046 Write and pass Playwright E2E: "Save & reload" flow — complete small plan → Save
  JSON → reload page → Load JSON → verify good/marginal/poor counts identical to pre-save (SC-004)
  `tests/e2e/rf-planner.spec.ts`
  **New work — no prototype equivalent**
  _Acceptance_: `pnpm test:e2e` passes; RSSI counts unchanged after round-trip

- [ ] T047 [P] Write and pass Playwright E2E: "Undo/redo" flow — place gateway → undo → 0
  gateways in StatusBar → redo → 1 gateway in StatusBar
  `tests/e2e/rf-planner.spec.ts`
  **New work — no prototype equivalent**
  _Acceptance_: `pnpm test:e2e` passes

- [ ] T048 [P] Write and pass Playwright E2E: "Dark mode persistence" flow — toggle dark →
  reload → dark class still on `<html>`
  `tests/e2e/rf-planner.spec.ts`
  **New work — no prototype equivalent**
  _Acceptance_: `pnpm test:e2e` passes; localStorage key persists

- [ ] T049 [P] Write and pass Playwright E2E: "Scale metres" flow — set scale with m toggle →
  enter 15 m → StatusBar shows scale set, no RSSI errors
  `tests/e2e/rf-planner.spec.ts`
  **New work — no prototype equivalent**
  _Acceptance_: `pnpm test:e2e` passes; `project.scale.distanceFeet ≈ 49.21`

- [ ] T050 Run axe-playwright accessibility audit on rendered app — fix any WCAG 2.1 AA
  violations reported (focus rings, ARIA, label associations, colour contrast)
  **New work — no prototype equivalent**
  _Acceptance_: `axe.analyze()` returns 0 critical/serious violations on the main app page

- [ ] T051 [P] Manual keyboard walkthrough (SC-005) — Tab through all toolbar buttons, canvas
  shortcuts (Ctrl+Z, Ctrl+Y, Delete), Properties Panel inputs; verify visible focus rings
  **New work — no prototype equivalent**
  _Acceptance_: All interactive controls reachable and operable by keyboard; no focus traps;
  engineer completes the walkthrough checklist in `quickstart.md`

- [ ] T052 [P] Benchmark RF recalculation — measure worker round-trip time with 20 walls +
  10 gateways + 50 sensors; confirm ≤ 1 000ms (SC-002)
  **New work — no prototype equivalent**
  _Acceptance_: Performance.measure log in worker shows < 1 000ms; screenshot of console output
  committed to `tests/performance/`

- [ ] T053 [P] Cross-browser smoke test — run the "Create & export" E2E scenario in Chrome
  latest and Edge latest (SC-006)
  **New work — no prototype equivalent**
  _Acceptance_: Both browsers complete the scenario without console errors; screenshot artifacts
  committed

**Checkpoint — Phase 10 complete**: All SC-001 through SC-006 verified; WCAG AA passed; production-ready

---

## Dependency Graph

```
Phase 1 (Foundation)
  └─▶ Phase 2 (Types + RF Math + Store + Storage)
        ├─▶ Phase 3 (US1 — Floor Plan Setup)       ← MVP increment begins
        │     └─▶ Phase 4 (US2 — Facility Drawing)
        │           └─▶ Phase 5 (US3 — Hardware Placement) ← MVP completes
        │                 ├─▶ Phase 6 (US4 — Coverage Viz)
        │                 ├─▶ Phase 7 (US5 — Auto-Assign)
        │                 └─▶ Phase 8 (US6 — Save/Load/Export)
        └─▶ Phase 9 (App Shell + Routing)          ← runs concurrently with US4–6
              └─▶ Phase 10 (Polish + E2E)
```

**Independent execution within phases**: Tasks marked `[P]` can run concurrently within
their phase (different files, no shared incomplete prerequisites).

---

## Parallel Execution Examples

### Phase 1
- T003 (theme.css), T004 (tailwind + index), T005 (shadcn/ui), T006 (Vitest), T007 (Playwright)
  all touch different files → run in parallel after T001, T002

### Phase 2
- T009 (rf-utils tests), T010 (store tests), T011 (storage tests) all touch different test
  files → write in parallel; T012 (types), T013 (rf-utils impl), T014 (store impl),
  T015 (storage impl) can start concurrently after their respective test files exist

### Phase 5 (US3)
- T026 (worker impl) and T027 (hook impl) touch different files → T026 then T027
  (hook depends on worker module), then T028 (canvas) and T029 (panel) in parallel

### Phase 10
- T047, T048, T049 (independent E2E scenarios), T050 (axe), T051 (keyboard), T052 (perf), T053 (cross-browser)
  all touch different test blocks → all parallelizable after T045/T046

---

## Implementation Strategy

**MVP Scope** (deliver first): Phases 1 → 2 → 3 (US1) → 5 (US3) + Phase 9  
This gives a working tool where engineers can upload a floor plan, calibrate scale, place
gateways and sensors, see auto-assigned RSSI values and coverage halos, edit project name,
and toggle dark mode. Validates the core prototype-to-production migration end-to-end.

**Incremental delivery order**: US1 → US3 → US2 → US4 → US5 → US6 → Polish

**Phase sizing**: Each phase is scoped to < 2 hours of agent work. Phases 5 and 6 contain the
most novel production work (Web Worker, Zustand migration) and may run long on first pass —
split at T026/T027 boundary if needed.

---

## Task Summary

| Phase | Tasks | User Story | Type |
|-------|-------|-----------|------|
| 1 — Foundation | T001–T008 | — | Setup |
| 2 — Foundational | T009–T015 | — | Foundational (blocking) |
| 3 — US1 Floor Plan Setup | T016–T019 | US1 (P1) | MVP |
| 4 — US2 Facility Drawing | T020–T024 | US2 (P2) | Feature |
| 5 — US3 Hardware Placement | T025–T029 | US3 (P1) | MVP |
| 6 — US4 Coverage Visualization | T030–T032 | US4 (P2) | Feature |
| 7 — US5 Auto-Assign | T033–T035 | US5 (P2) | Feature |
| 8 — US6 Save/Load/Export | T036–T040 | US6 (P3) | Feature |
| 9 — App Shell + Routing | T041–T044 | — | Infrastructure |
| 10 — Polish + E2E | T045–T053 | — | Quality gate |
| **Total** | **53 tasks** | | |

**Tasks by user story**:
- US1 (P1 — Floor Plan Setup): 4 tasks (T016–T019)
- US2 (P2 — Facility Drawing): 5 tasks (T020–T024)
- US3 (P1 — Hardware Placement): 5 tasks (T025–T029)
- US4 (P2 — Coverage Visualization): 3 tasks (T030–T032)
- US5 (P2 — Auto-Assign): 3 tasks (T033–T035)
- US6 (P3 — Save/Load/Export): 5 tasks (T036–T040)

**Parallel opportunities identified**: 14 tasks marked `[P]`

**Format validation**: All 53 tasks follow `- [ ] T### [P?] [US#?] Description — file path` checklist format ✓
