# Feature Specification: RF Coverage Planner

**Feature Branch**: `001-rf-coverage-planner`
**Created**: 2026-04-21
**Status**: Draft
**Figma Make Prototype**: https://www.figma.com/make/ZzjCw7mP1LFPjeKqkD5sog/Perceptiv-Design-Studio

---

## Clarifications

### Session 2026-04-21

- Q: The original request mentioned "-85 dBm flagged as out-of-range", but the prototype defines `RSSI_MARGINAL = -80` dBm. Which threshold wins? → A: Keep -80 dBm (matches prototype constant; no code change needed)- Q: Canvas.tsx renders both dashed concentric rings and a filled directional polygon per gateway simultaneously. Keep both, or drop one? → A: Keep both (matches prototype exactly — dashed rings + filled attenuated polygon)
- Q: Prototype caps undo at 100 steps (`store.tsx`); spec says "minimum 50". Adopt 100 or keep spec at 50? → A: Keep "minimum 50" as floor (prototype already exceeds it; implementation free to use 100)
- Q: `SET_NAME` action exists in store but nothing calls it — is an editable project name field in scope for v1? → A: In scope — add click-to-edit project name in header (SET_NAME already wired)
- Q: Scale dialog uses `distanceFt` field with no unit label. Lock to feet only, or support metres with a toggle? → A: Support both — add ft/m toggle; store internally as feet (convert on input)
---

## Prototype Reconciliation

This spec was produced by cross-referencing the requested feature list against the actual
source code retrieved from the Figma Make prototype via the Figma MCP. The following
discrepancies are flagged:

| # | Finding | Resolution |
|---|---------|-----------|
| P1 | Prototype implements gateway placement generically — no distinction between SR-71 and Universal Gateway models. `Gateway` type has only `id`, `x`, `y`, `label`. | **New work for production**: add `model: 'sr71' \| 'universal'` field to `Gateway`. Flag for confirmation before building. |
| P2 | Prototype has no PDF export. Export is PNG (canvas snapshot) and BOM CSV only. `Canvas.tsx → exportPng()` and `exportCsv()`. | **New work for production**: PDF report generation. |
| P3 | Coverage visualization is a directional polygon per gateway drawn on the canvas (`getGatewayCoveragePolygon` in `rf-utils.ts`), not a full RSSI heatmap. Individual sensor RSSI is calculated point-to-point (`calculateRssi`). | Polygon rendering is already built. RSSI tier thresholds locked to prototype values: ≥ -70 dBm good, -70 to -80 dBm marginal, < -80 dBm poor (confirmed in clarification, 2026-04-21). |
| P4 | Prototype has `draw-wall` and `place-obstacle` tools but no explicit "draw walls on blank canvas" project creation flow. Project starts as "Untitled Project" with null floor plan. | **Prototype implements this** — blank canvas is the default. No divergence. |
| P5 | Prototype has `DoorType` (`interior`, `steel-fire`) with attenuation constants defined in `types.ts` and door logic in `rf-utils.ts`, but door placement UI is **not implemented** in `Canvas.tsx` or `Toolbar.tsx`. | **New work for production**: door placement tool. Flag for confirmation. |
| P6 | Prototype has no project naming UI — project is always "Untitled Project". `SET_NAME` action exists in store but nothing calls it. | **In scope for v1**: add click-to-edit project name field in header (dispatches `SET_NAME`). Confirmed in clarification, 2026-04-21. |

---

## User Scenarios & Testing

### User Story 1 — Floor Plan Setup (Priority: P1)

An application engineer prepares the planning canvas before any hardware placement. They
either upload a facility floor plan image (PNG, JPG, or PDF) or begin with a blank canvas.
They then calibrate scale by marking two points that correspond to a known real-world
distance, so all subsequent measurements and RF calculations are anchored to physical
reality.

**Why this priority**: Without a calibrated canvas, no RF calculation is meaningful. Every
other user story depends on this being complete.

**Independent Test**: An engineer can open the tool on a blank project, upload a PNG floor
plan, set scale by clicking two endpoints and entering "50 ft", and have the scale
persisted — all without placing any hardware.

Prototype coverage: `Canvas.tsx` handles floor plan image load (`SET_FLOOR_PLAN` action,
`floorPlanImg` state) and scale calibration (`set-scale` tool mode, `SET_SCALE` action,
`ScaleRef` type). `Toolbar.tsx` handles the file upload button (`handleFloorPlanUpload`,
accepting `image/*` and `.pdf`). PDF-to-canvas rendering via `pdfjs-dist` is already
implemented in `Toolbar.tsx`.

**Acceptance Scenarios**:

1. **Given** a new blank project, **When** an engineer uploads a PNG floor plan, **Then**
   the image is displayed on the canvas as the background layer.
2. **Given** a PNG floor plan is loaded, **When** an engineer uploads a PDF instead,
   **Then** the first page of the PDF is rendered to the canvas as the background.
3. **Given** a floor plan is displayed, **When** an engineer selects the Set Scale tool,
   clicks two points on the canvas, and enters a distance of "50", **Then** the project
   stores a `ScaleRef` and all distance/RSSI calculations update to reflect real-world
   scale.
4. **Given** a blank canvas (no floor plan), **When** an engineer sets scale, **Then**
   scale is stored and calculations proceed correctly.
5. **Given** a project with scale set, **When** the engineer saves and reloads the project,
   **Then** scale is preserved and all RSSI values are unchanged.

---

### User Story 2 — Facility Drawing (Priority: P2)

An application engineer draws the interior structure of the facility onto the canvas by
tracing walls and marking obstacles. Each wall is assigned a material type that carries a
known RF signal attenuation value used in propagation calculations.

**Why this priority**: Accurate RF modeling requires the building envelope. Hardware
placement and coverage visualization lose meaning without walls and obstacles.

**Independent Test**: An engineer can draw three walls (drywall, concrete, steel) and
place two machinery obstacles on a blank canvas. Selecting each element shows correct
material/type in the Properties Panel.

Prototype coverage: `Canvas.tsx` handles wall drawing (`draw-wall` mode, start/end point
clicks, snap-to-vertex). `Toolbar.tsx` offers a material selector (`<select>` for
`WallMaterial`). `PropertiesPanel.tsx` shows wall material and computed length in feet.
`WALL_MATERIALS` in `types.ts` defines attenuation (drywall 3 dB, glass 2 dB, brick 6 dB,
concrete 10 dB, steel 12 dB). `OBSTACLE_TYPES` defines machinery (6 dB), racking (3 dB),
open-area (0 dB).

**Door placement** (`DoorType` in `types.ts`, `ADD_DOOR` in store, door-aware attenuation
in `rf-utils.ts`) is modeled in the prototype but the placement UI is **not yet built**.
This is new work for production.

**Acceptance Scenarios**:

1. **Given** the draw-wall tool is active, **When** an engineer clicks two points on the
   canvas, **Then** a wall segment is drawn connecting those points, snapping to nearby
   endpoints within 10 pixels.
2. **Given** a wall is drawn, **When** the engineer changes the material to "Concrete" in
   the Properties Panel, **Then** the wall's attenuation updates to 10 dB and RSSI values
   for affected sensors recalculate immediately.
3. **Given** the place-obstacle tool is active, **When** an engineer drags on the canvas,
   **Then** a rectangular obstacle of the selected type is placed and sized.
4. **Given** any element is selected, **When** the engineer presses Delete or clicks the
   trash icon, **Then** the element is removed and RSSI values recalculate.
5. **Given** walls are drawn, **When** an engineer undoes with Ctrl+Z, **Then** the most
   recent wall is removed and RSSI values recalculate.

---

### User Story 3 — Hardware Placement (Priority: P1)

An application engineer places Perceptiv gateways and sensor measurement points on the
floor plan. Each gateway displays a visual coverage halo indicating its estimated RF
reach. Each sensor automatically receives an estimated RSSI value based on its distance
and the obstructions between it and its assigned gateway.

**Why this priority**: Hardware placement is the primary value action. It must work
correctly even without walls for the most basic use case.

**Independent Test**: An engineer places one gateway and three sensors on a canvas with
scale set but no walls drawn. All three sensors show an RSSI value and are automatically
assigned to the gateway, provided the gateway has capacity (max 30 group-sensors).

Prototype coverage: `Canvas.tsx` handles `place-gateway` and `place-sensor` tool modes.
Gateway and sensor images are loaded from Figma assets (`gatewayImgSrc`, `sensorImgSrc`).
`PropertiesPanel.tsx` shows gateway capacity (`count/MAX_SENSORS_PER_GATEWAY`) and sensor
RSSI with color-coded tier (good / marginal / poor). `rf-utils.ts →
autoAssignSensors()` performs greedy best-RSSI assignment respecting `MAX_SENSORS_PER_GATEWAY
= 30`. `getRingRadii()` computes coverage ring radii in pixels for canvas rendering.
`getGatewayCoveragePolygon()` computes the directional coverage boundary per threshold.

**Acceptance Scenarios**:

1. **Given** the place-gateway tool is active, **When** an engineer clicks the canvas,
   **Then** a gateway is placed at that point with a default label (e.g., "GW-1") and a
   coverage halo rendered around it.
2. **Given** a gateway is placed and scale is set, **When** an engineer places a sensor,
   **Then** the sensor is auto-assigned to the gateway with the best predicted RSSI,
   provided that gateway has remaining capacity.
3. **Given** a sensor is placed, **When** RSSI ≥ -70 dBm, **Then** the sensor indicator
   is green; -70 to -80 dBm is yellow; < -80 dBm is red.
4. **Given** a gateway at capacity (30 group-sensors assigned), **When** a new sensor is
   placed, **Then** the sensor is assigned to the next-best gateway, or the over-capacity
   gateway with a visible overflow indicator.
5. **Given** a placed gateway or sensor, **When** dragged to a new position, **Then**
   RSSI values and assignments for all affected sensors recalculate immediately.
6. **Given** a sensor is selected, **When** the engineer edits the Group Count in
   Properties Panel, **Then** the assignment respects the updated group count against the
   30-sensor capacity limit.

---

### User Story 4 — Coverage Visualization (Priority: P2)

An application engineer views a predictive RF coverage overlay on the floor plan showing
where signal strength is good, marginal, or poor. Coverage boundaries account for walls
and obstacles.

**Why this priority**: The heatmap is the primary output that answers "where do I put
gateways?" Hardware placement without visualization requires guesswork.

**Independent Test**: With one gateway placed, scale set, and at least one wall drawn,
the coverage polygon renders on the canvas in distinct color bands (good / marginal /
poor), with the polygon noticeably indented where the wall crosses the signal path.

Prototype coverage: `rf-utils.ts → getGatewayCoveragePolygon()` ray-casts at 72 angles
(5° increments), computes material attenuation per ray, and returns the boundary polygon
for a given RSSI threshold. `Canvas.tsx` renders this polygon. Individual sensor RSSI
displayed in `PropertiesPanel.tsx` with color coding. Status bar in `App.tsx` shows
aggregate counts: good / marginal / poor sensors.

**A full per-pixel heatmap** (gradient fill across the canvas surface) is **not
implemented** in the prototype — current visualization is polygon-per-gateway. This
difference is **flagged** and the decision on whether to add a raster heatmap is deferred
to the plan phase.

**Acceptance Scenarios**:

1. **Given** a gateway is placed and scale is set, **When** the canvas renders, **Then**
   a coverage polygon per gateway is visible, colored by RSSI tier.
2. **Given** a concrete wall crosses the signal path, **When** the coverage polygon is
   rendered, **Then** the polygon boundary is noticeably closer to the gateway along that
   ray compared to an unobstructed direction.
3. **Given** the status bar, **When** sensors are placed, **Then** it shows the count of
   good, marginal, and poor sensors updated in real time.
4. **Given** scale is not yet set, **When** the canvas renders, **Then** no coverage
   polygon or RSSI values are shown (calculations require scale).

---

### User Story 5 — Auto-Assign Sensors to Gateways (Priority: P2)

The application automatically assigns each placed sensor to the gateway that offers the
best predicted link quality, subject to gateway capacity limits. Engineers can see the
assignment result in the Properties Panel and trigger reassignment after any change.

**Why this priority**: Manual assignment across large deployments is error-prone. Auto-
assignment is the primary differentiator over back-of-envelope planning.

**Independent Test**: With 3 gateways and 20 sensors placed, all sensors are assigned to
gateways. Moving a sensor near a different gateway causes it to reassign automatically.

Prototype coverage: `rf-utils.ts → autoAssignSensors()` implements a greedy algorithm —
sorts all sensor-gateway RSSI pairs descending, assigns each sensor to its best-available
gateway respecting `MAX_SENSORS_PER_GATEWAY = 30`. Assignment recalculates on every state
change (wall, obstacle, gateway, sensor move) via `recalcSensors()` in `store.tsx`.
`REASSIGN_SENSORS` action is available. `PropertiesPanel.tsx` shows assigned gateway
label and current RSSI.

**Acceptance Scenarios**:

1. **Given** multiple gateways are placed, **When** a sensor is placed, **Then** it is
   automatically assigned to the gateway with the best predicted RSSI that still has
   capacity.
2. **Given** a sensor is assigned to Gateway A, **When** the engineer moves the sensor
   closer to Gateway B, **Then** the sensor reassigns to Gateway B if its signal is now
   better.
3. **Given** a gateway reaches capacity (30 group-sensors), **When** a new sensor is
   placed with best RSSI pointing to that gateway, **Then** the sensor is assigned to the
   next-best gateway with available capacity.
4. **Given** all gateways are at capacity, **When** a sensor cannot be accommodated,
   **Then** it is assigned to the best-RSSI gateway regardless and the over-capacity state
   is indicated visibly.

---

### User Story 6 — Save, Load, and Export (Priority: P3)

An application engineer saves a planning session as a JSON file, reloads it for later
editing, exports the floor plan as a PNG image for inclusion in reports, and exports a
bill-of-materials as a CSV for quoting.

**Why this priority**: Session persistence and export enable the workflow to extend beyond
a single sitting and feed downstream quoting/install processes.

**Independent Test**: An engineer completes a plan, saves it as JSON, closes the tab, re-
opens the tool, loads the saved file, and all gateways, sensors, walls, and RSSI values
are identical to where they were left.

Prototype coverage: `Toolbar.tsx → handleSave()` serializes `ProjectState` to JSON and
triggers download. `handleLoad()` reads a `.json` file and dispatches `SET_PROJECT`.
`Canvas.tsx → exportPng()` uses `canvas.toDataURL()`. `Canvas.tsx → exportCsv()`
generates a CSV with gateway/sensor/RSSI rows and a summary block.

**PDF report generation** is **not in the prototype** — it is new work for production.

**Acceptance Scenarios**:

1. **Given** a project with gateways, sensors, and walls, **When** the engineer clicks
   Save, **Then** a `.json` file downloads containing the full `ProjectState`.
2. **Given** a saved `.json` file, **When** the engineer clicks Load and selects it,
   **Then** all project data is restored exactly, including RSSI values and assignments.
3. **Given** a plan is loaded, **When** the engineer exports PNG, **Then** a PNG of the
   current canvas state downloads.
4. **Given** sensors are assigned to gateways, **When** the engineer exports CSV, **Then**
   a CSV downloads with one row per sensor showing gateway, RSSI, signal tier, and group
   count, plus a summary row.

---

### Edge Cases

- What happens when a floor plan image is larger than the canvas viewport? — Canvas
  supports pan (right-click drag) and zoom (scroll or toolbar buttons); the plan is
  accessible at any size.
- What happens when scale is changed after gateways and sensors are already placed? —
  `SET_SCALE` triggers `recalcSensors()` immediately; all RSSI values update.
- What happens when a wall is deleted that a door is placed on? — `DELETE_WALL` cascades
  to remove all doors with matching `wallId` (already implemented in `store.tsx`).
- What happens when a PDF with multiple pages is uploaded? — Only page 1 is rendered
  (already implemented in `Toolbar.tsx`).
- What happens when no gateways are placed but sensors exist? — `autoAssignSensors`
  returns all sensors with `assignedGatewayId: null`, `rssi: null`; Properties Panel shows
  "N/A".
- What happens when the project file loaded is corrupt? — `handleLoad` wraps in
  `try/catch` and shows an alert; partial project state is never committed.

---

## Requirements

### Functional Requirements

- **FR-001**: Users MUST be able to create a new, empty project with a name.
- **FR-002**: Users MUST be able to upload a floor plan (PNG, JPG, or PDF) as the canvas
  background. PDF upload MUST render the first page.
- **FR-003**: Users MUST be able to set a real-world scale reference by selecting two
  points on the canvas and entering the distance. The scale dialog MUST provide a ft/m
  unit toggle. Values entered in metres MUST be converted to feet before storing in
  `ScaleRef.distanceFt` (confirmed in clarification, 2026-04-21).
- **FR-004**: Users MUST be able to draw wall segments on the canvas, assigning one of the
  following material types: drywall (3 dB), glass (2 dB), brick (6 dB), concrete (10 dB),
  steel (12 dB).
- **FR-005**: Users MUST be able to place rectangular obstacles on the canvas, assigning
  type: machinery (6 dB), racking/shelving (3 dB), or open-area (0 dB).
- **FR-006**: Users MUST be able to place gateways on the canvas. Each gateway MUST
  display a coverage halo visualizing estimated RF reach.
- **FR-007**: Users MUST be able to place sensor measurement points on the canvas, each
  with a configurable group count (1–30).
- **FR-008**: The system MUST automatically assign each sensor to the gateway with the
  best predicted RSSI that has remaining capacity (max 30 group-sensors per gateway).
  Reassignment MUST occur after any structural change.
- **FR-009**: The system MUST calculate estimated RSSI per sensor using free-space path
  loss at 2.44 GHz, accounting for all walls, doors, and obstacles between sensor and
  assigned gateway.
- **FR-010**: Coverage visualization MUST render, per gateway, on every state change: (a) a
  filled directional polygon per RSSI tier (≥ -70 dBm good, -70 to -80 dBm marginal,
  < -80 dBm poor) computed via 72-ray raycasting with wall/obstacle attenuation, AND (b)
  two dashed concentric ring outlines marking the free-space good/marginal radius
  boundaries (confirmed in clarification, 2026-04-21).
- **FR-011**: Users MUST be able to select any placed element and view its properties
  (material, length, RSSI, assignment, capacity) in the Properties Panel.
- **FR-012**: Users MUST be able to edit element properties in the Properties Panel
  (material type, gateway label, sensor label, group count).
- **FR-013**: Users MUST be able to delete any placed element. Deleted gateways MUST
  trigger sensor reassignment.
- **FR-014**: Users MUST be able to undo and redo any action (minimum 50 steps).
- **FR-015**: Users MUST be able to save the full project state as a `.json` file.
- **FR-016**: Users MUST be able to load a previously saved `.json` project file.
- **FR-017**: Users MUST be able to export the current canvas as a PNG image.
- **FR-018**: Users MUST be able to export a bill-of-materials as a CSV file listing
  each sensor, its assigned gateway, RSSI, signal tier, and group count.
- **FR-019**: The canvas MUST support pan and zoom (scroll, toolbar zoom buttons, fit-to-
  screen).
- **FR-020**: The tool MUST support light and dark modes, persisted to local storage.
- **FR-021**: Users MUST be able to edit the project name via a click-to-edit field in the application header. The name MUST be persisted in project state via the `SET_NAME` action and included in saved `.json` files.

### Out-of-Scope (this iteration)

- Real-time monitoring of live deployed networks.
- Multi-floor or 3D building planning.
- Outdoor RF propagation.
- Customer-facing access or external authentication.
- PDF report generation (flagged as new work — to be scheduled separately).
- Door placement UI (data model exists; UI is new work — to be scheduled separately).
- Gateway model selection (SR-71 vs. Universal — new work flagged in Prototype
  Reconciliation table).
- Project naming was previously listed here; moved to in-scope per clarification 2026-04-21 (FR-021).

### Key Entities

- **Project** (`ProjectState`): Top-level container. Holds name, dates, floor plan image,
  scale, and all child collections.
- **Wall**: A line segment with start/end points and a material type carrying an RF
  attenuation coefficient.
- **Door**: Attached to a wall at a parametric position; has a type (interior or steel
  fire) and open/closed state affecting attenuation. UI not yet built.
- **Obstacle**: An axis-aligned rectangle with a type carrying an attenuation coefficient.
- **Gateway**: A point placement with a label (and future model field). Capacity: 30 group-
  sensors.
- **Sensor**: A point placement with a label, group count, assigned gateway ID, and
  computed RSSI.
- **ScaleRef**: Two pixel-space points and a real-world distance stored in feet
  (`distanceFt`). The UI accepts input in feet or metres (user-selectable toggle);
  metre values are converted to feet before storage. Used to convert pixel distances
  to metres for FSPL calculations.
  pixel distances to meters for FSPL calculations.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: An application engineer can complete a full plan (upload floor plan, draw
  walls, place 2 gateways and 10 sensors, view coverage, export CSV) within 10 minutes of
  first use.
- **SC-002**: Coverage polygon and RSSI recalculations complete within 1 second of any
  placement or property change on a typical floor plan (≤ 20 walls, ≤ 10 gateways, ≤ 50
  sensors).
- **SC-003**: 100% of placed sensors receive an RSSI value and gateway assignment when
  scale is set, at least one gateway is placed, and gateway capacity is not exceeded.
- **SC-004**: A saved project file, when loaded, produces bit-identical RSSI values and
  assignments to those visible before save.
- **SC-005**: All interactive controls are operable by keyboard alone (WCAG 2.1 AA).
- **SC-006**: The tool renders without errors on the two most recent stable versions of
  Chrome and Edge.

---

## Assumptions

- Users have a stable internet connection during use (CDN-loaded pdfjs is acceptable).
- Floor plan images are single-page; multi-page PDFs use page 1 only.
- All RF calculations assume a single-frequency (2.44 GHz) environment with the RF
  constants already defined in `types.ts`: TX power 18 dBm, sensor antenna 1.49 dBi,
  gateway antenna 2 dBi, FSPL constant 40.2.
- "Group count" represents the number of physical vibration sensors in a group wired to
  one measurement point; this is a Perceptiv-specific concept and requires no
  clarification.
- Local storage is available for theme persistence; no server-side session storage is
  needed.
- There is no user authentication for this internal tool (consistent with out-of-scope
  definition).
- The production build does not need to support Internet Explorer or legacy Edge.
