# Quickstart: RF Coverage Planner

**Feature**: `001-rf-coverage-planner`  
**Branch**: `001-rf-coverage-planner`  
**Date**: 2026-04-21

This guide gets a new engineer up and running on the RF Coverage Planner feature within
15 minutes.

---

## Prerequisites

- Node.js 20 LTS or later
- pnpm 9+ (or npm/yarn — commands below use pnpm)
- Git

---

## 1. Clone and Install

```bash
git clone <repo-url>
cd FigmaMCPDesignStudio
git checkout 001-rf-coverage-planner
pnpm install
```

---

## 2. Run the Development Server

```bash
pnpm dev
```

Open `http://localhost:5173` in Chrome or Edge. The RF Coverage Planner loads immediately
— no server, no auth, no build step needed.

---

## 3. Run Tests

```bash
# Unit + component tests (Vitest)
pnpm test

# Unit tests in watch mode
pnpm test:watch

# E2E tests (Playwright — requires dev server running)
pnpm test:e2e

# All tests in CI mode (no watch, fail-fast)
pnpm test:ci
```

Test files live adjacent to their source:
- `tests/unit/rf-utils.test.ts` — RF math unit tests
- `tests/unit/rf-planner.store.test.ts` — Zustand store tests
- `tests/integration/placement-to-heatmap.test.ts` — full pipeline integration test
- `tests/e2e/rf-planner.spec.ts` — Playwright E2E scenarios

---

## 4. Feature Structure

```text
src/features/rf-planner/
├── components/
│   ├── Canvas.tsx          ← canvas rendering + mouse interactions
│   ├── Toolbar.tsx         ← tool selection, file upload, zoom, export
│   ├── PropertiesPanel.tsx ← selected-element property editor
│   └── StatusBar.tsx       ← sensor count, RSSI summary, scale readout
├── workers/
│   └── rf-engine.worker.ts ← off-thread RF computation
├── hooks/
│   └── useRfEngine.ts      ← worker lifecycle + result subscription
├── lib/
│   ├── rf-utils.ts         ← RF math functions (FSPL, raycasting, assign)
│   └── storage.ts          ← StorageAdapter interface + localStorage impl
├── types/
│   └── index.ts            ← all domain types and RF constants
└── pages/
    └── RFPlannerPage.tsx   ← lazy-loaded route component
```

---

## 5. Key Concepts

### How RF Calculation Works

Every project mutation dispatches a `RECALC` message to the Web Worker. The worker:
1. Runs `autoAssignSensors` — assigns each sensor to the nearest gateway within
   `MAX_SENSORS_PER_GATEWAY = 30` capacity.
2. Runs `calculateRssi` for each assigned sensor — FSPL at 2.44 GHz minus accumulated
   wall/obstacle attenuation along a straight-line ray.
3. Runs `getGatewayCoveragePolygon` for each gateway — 72 rays at 5° intervals to produce
   RSSI tier polygon boundaries.

Results are returned to the main thread via `RECALC_RESULT` and applied to the Zustand
store. The Canvas re-renders via its subscription to the store.

See `specs/001-rf-coverage-planner/data-model.md` for the RF formula.  
See `specs/001-rf-coverage-planner/contracts/worker-protocol.md` for the message protocol.

### State Management

All state lives in a single Zustand store: `useRFPlannerStore` (in `src/stores/rf-planner.store.ts`).

- **Project state** (saved to JSON): `project: ProjectState`
- **UI state** (runtime only): `tool`, `selectedId`, `wallMaterial`, `obstacleType`, `scaleInputUnit`, `coveragePolygons`
- **Theme** (localStorage): `isDark`
- **Undo/Redo**: 100-step history maintained in the store

Dispatch project mutations via `store.dispatch(action)`. Setter helpers exist for UI state.

### Canvas Rendering

`Canvas.tsx` uses a raw HTML `<canvas>` element with a full-scene redraw on every store
change (`useEffect` subscribed to `project` + `coveragePolygons`). Do not break the
render loop into partial updates — the prototype's full-redraw approach is intentional for
correctness.

The canvas uses `zoom` and `panOffset` local state (not in Zustand) to avoid triggering
global re-renders on every scroll/pinch event.

---

## 6. Common Development Tasks

### Add a new tool mode

1. Add the mode string to `ToolMode` in `types/index.ts`
2. Add a tool button to `Toolbar.tsx`
3. Add the mouse handler branch in `Canvas.tsx → handleMouseDown`
4. Add unit test in `rf-planner.store.test.ts` for the new mode dispatch

### Change an RF constant

RF constants (`RSSI_GOOD`, `RSSI_MARGINAL`, `COMBINED_GAIN`, etc.) are in `types/index.ts`.
Changing them requires:
1. Updating the constant
2. Updating all related unit test expected values in `rf-utils.test.ts`
3. A spec amendment if the change affects acceptance criteria (SC-002, SC-003)

### Add a shadcn/ui component

Only the 46 components already in `src/components/ui/` may be used (constitution Principle I).
Do not add new shadcn components without a constitution amendment.

### Modify the save format

Save format changes must be versioned. Update `contracts/save-format.md` and add a
migration function in `storage.ts` for any backward-incompatible field changes.

---

## 7. Keyboard Accessibility Walkthrough (SC-005 / T051)

Manually complete this checklist in Chrome or Edge **without a mouse** after any
significant UI change. Mark each item `[X]` when verified.

### Toolbar controls

- [ ] `Tab` from address bar reaches the **New Project** button (first toolbar button)
- [ ] `Tab` cycles through all toolbar buttons in visual order (left → right, top → bottom)
- [ ] Every toolbar button shows a **visible focus ring** when focused
- [ ] `Enter` / `Space` activates the focused toolbar button
- [ ] **Tool picker** buttons (`Set Scale`, `Draw Wall`, `Gateway`, `Sensor`, etc.) are
  reachable by `Tab` and toggle correctly with `Enter`
- [ ] **Undo** button is reachable; `Ctrl+Z` also triggers undo from anywhere in the page
- [ ] **Redo** button is reachable; `Ctrl+Y` also triggers redo from anywhere in the page
- [ ] **Dark mode toggle** button is reachable and activates with `Enter`

### Project name

- [ ] `Tab` reaches the editable project name button in the header
- [ ] `Enter` on the project name button opens the inline `<input>` for editing
- [ ] `Enter` inside the input commits the name
- [ ] `Escape` inside the input cancels without saving

### Canvas (keyboard shortcuts — no Tab trapping)

- [ ] `Ctrl+Z` undoes the last action (works without focusing the canvas)
- [ ] `Ctrl+Y` redoes the last undone action
- [ ] `Delete` removes the currently selected element (gateway, sensor, or wall)
- [ ] Canvas does **not** trap keyboard focus — `Tab` moves past it to the Properties Panel

### Properties Panel

- [ ] When a gateway is selected, `Tab` reaches all editable fields in the panel
- [ ] Label input accepts keyboard input and saves on blur
- [ ] When a sensor is selected, Group Count input accepts keyboard input

### StatusBar

- [ ] StatusBar text is readable by screen reader (`aria-label` on tier spans)
- [ ] No interactive elements in StatusBar that could trap focus

### Scale dialog (when open)

- [ ] Dialog input (`#scale-distance-input`) is auto-focused when dialog opens
- [ ] `Tab` cycles between unit buttons (Feet / Metres) and action buttons (Cancel / Set Scale)
- [ ] `Enter` on the **Set Scale** button submits the form
- [ ] `Escape` does **not** close the dialog (dialog uses explicit Cancel button)

### No focus traps

- [ ] At no point is keyboard focus trapped in a region with no exit
- [ ] Modals / dialogs that open can be dismissed without a mouse

---

## 8. Prototype Reference

The Figma Make prototype is the authoritative UI reference:  
`https://www.figma.com/make/ZzjCw7mP1LFPjeKqkD5sog/Perceptiv-Design-Studio`

Before writing any UI code, query the Figma MCP to retrieve current source files.
See the constitution at `.specify/memory/constitution.md` — Principle I.

---

## 8. Useful Links

| Document | Path |
|----------|------|
| Feature spec | `specs/001-rf-coverage-planner/spec.md` |
| Implementation plan | `specs/001-rf-coverage-planner/plan.md` |
| Research decisions | `specs/001-rf-coverage-planner/research.md` |
| Data model | `specs/001-rf-coverage-planner/data-model.md` |
| Save format contract | `specs/001-rf-coverage-planner/contracts/save-format.md` |
| Worker protocol | `specs/001-rf-coverage-planner/contracts/worker-protocol.md` |
| Constitution | `.specify/memory/constitution.md` |
