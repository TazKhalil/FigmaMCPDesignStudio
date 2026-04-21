# Data Model: RF Coverage Planner

**Feature**: `001-rf-coverage-planner`  
**Phase**: 1 — Design  
**Date**: 2026-04-21  
**Source**: Prototype `src/app/types.ts` (verified via Figma MCP, 2026-04-21)

---

## Domain Entities

All entities mirror the prototype's `types.ts` exactly. Fields marked **[NEW]** are
additions for production. No fields are removed; no field names are changed (field names
confirmed consistent across `types.ts`, `rf-utils.ts`, and `App.tsx`).

---

### Point

Primitive 2D coordinate in canvas-pixel space.

```typescript
interface Point {
  x: number;
  y: number;
}
```

---

### ScaleRef

Maps two canvas-pixel points to a real-world distance in feet. Used by `getPixelsPerFoot`
to convert pixel distances to metres for FSPL calculations.

```typescript
interface ScaleRef {
  p1: Point;
  p2: Point;
  distanceFeet: number;    // always stored in feet; UI may accept metres (FR-003)
}
```

**Validation rules**:
- `distanceFeet > 0`
- `p1 ≠ p2` (pixel distance must be non-zero)

**Derived value**:
```
pixelsPerFoot = √((p2.x−p1.x)² + (p2.y−p1.y)²) / distanceFeet
pixelsPerMeter = pixelsPerFoot / 0.3048
```

---

### Wall

A directed line segment on the canvas with a material type that carries an RF attenuation
coefficient (dB loss per crossing).

```typescript
interface Wall {
  id: string;
  start: Point;
  end: Point;
  material: WallMaterial;
}

type WallMaterial = 'drywall' | 'glass' | 'brick' | 'concrete' | 'steel';

const WALL_MATERIALS: Record<WallMaterial, {
  attenuation: number;   // dB loss per crossing at 2.44 GHz
  color: string;         // canvas stroke color (hex)
  label: string;         // display name
}> = {
  drywall:  { attenuation: 3,  color: '#9ca3af', label: 'Drywall'   },
  glass:    { attenuation: 2,  color: '#60a5fa', label: 'Glass'     },
  brick:    { attenuation: 6,  color: '#c2703e', label: 'Brick'     },
  concrete: { attenuation: 10, color: '#4b5563', label: 'Concrete'  },
  steel:    { attenuation: 12, color: '#1f2937', label: 'Steel'     },
};
```

---

### Door

Attached to a parent `Wall` at a parametric position (0–1 along the wall). Attenuation
depends on type and open/closed state. **Door placement UI is out of scope for v1**; the
data model and RF math are already implemented in the prototype.

```typescript
interface Door {
  id: string;
  wallId: string;           // parent wall
  position: number;         // 0.0–1.0 along parent wall
  type: DoorType;
  isOpen: boolean;          // open doors have 0 dB attenuation
}

type DoorType = 'interior' | 'steel-fire';

const DOOR_TYPES: Record<DoorType, {
  closedAttenuation: number;   // dB when door.isOpen === false
  label: string;
}> = {
  interior:   { closedAttenuation: 2,  label: 'Interior Door'    },
  'steel-fire': { closedAttenuation: 8, label: 'Steel Fire Door'  },
};
```

---

### Obstacle

An axis-aligned rectangle representing physical RF-attenuating equipment.

```typescript
interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: ObstacleType;
}

type ObstacleType = 'machinery' | 'racking' | 'open-area';

const OBSTACLE_TYPES: Record<ObstacleType, {
  attenuation: number;   // dB per ray crossing
  color: string;         // canvas fill color (rgba)
  label: string;
}> = {
  machinery:   { attenuation: 6, color: 'rgba(239,68,68,0.25)',   label: 'Machinery'        },
  racking:     { attenuation: 3, color: 'rgba(245,158,11,0.25)',  label: 'Racking / Shelving' },
  'open-area': { attenuation: 0, color: 'rgba(34,197,94,0.15)',   label: 'Open Area'        },
};
```

---

### Gateway

A Perceptiv IoT gateway placed on the canvas as a point device. Acts as the RF hub for
up to `MAX_SENSORS_PER_GATEWAY` sensors.

```typescript
interface Gateway {
  id: string;
  x: number;
  y: number;
  label: string;       // e.g. "GW-1" — auto-generated, user-editable in PropertiesPanel
  // model field deferred (SR-71 vs Universal — out of scope, Prototype Reconciliation P1)
}

const MAX_SENSORS_PER_GATEWAY = 30;   // maximum sensor group-points per gateway
```

---

### Sensor

A Perceptiv vibration sensor (measurement point) placed on the canvas. May represent
multiple physical sensors via `groupCount`. Auto-assigned to nearest gateway with
remaining capacity.

```typescript
interface Sensor {
  id: string;
  x: number;
  y: number;
  label: string;                 // e.g. "S-1" — auto-generated, user-editable
  groupCount: number;            // number of physical sensors at this measurement point
  assignedGatewayId: string | null;  // null if unassigned (no gateways, or capacity exceeded)
  rssi: number | null;           // dBm; null if scale not set or unassigned
}
```

**RSSI tier thresholds** (confirmed in clarification, 2026-04-21):

| Tier | Condition | Canvas color |
|------|-----------|-------------|
| Good | `rssi >= -70` | `rgba(34,197,94,0.25)` |
| Marginal | `-80 <= rssi < -70` | `rgba(245,158,11,0.25)` |
| Poor | `rssi < -80` | `rgba(239,68,68,0.2)` |
| Unassigned | `rssi === null` | no coverage polygon drawn |

---

### ProjectState

Top-level container for all project data. Persisted as JSON (save/load, localStorage
auto-save).

```typescript
interface ProjectState {
  name: string;                  // user-editable (FR-021); default "Untitled Project"
  dateCreated: string;           // ISO 8601
  dateModified: string;          // ISO 8601; updated on every mutation
  floorPlanImage: string | null; // base64 data URL (PNG/JPG) or null
  scale: ScaleRef | null;        // null until user sets scale
  walls: Wall[];
  doors: Door[];
  obstacles: Obstacle[];
  gateways: Gateway[];
  sensors: Sensor[];
}
```

---

## RF Constants (locked)

From `types.ts` — do not change without an explicit spec amendment:

```typescript
const TX_POWER             = 18;      // dBm — gateway transmit power
const GATEWAY_ANTENNA_GAIN = 2;       // dBi
const SENSOR_ANTENNA_GAIN  = 1.49;    // dBi
const COMBINED_GAIN        = 21.49;   // TX_POWER + GATEWAY_ANTENNA_GAIN + SENSOR_ANTENNA_GAIN
const FSPL_CONSTANT        = 40.2;    // dB — FSPL offset at 2.44 GHz (20·log₁₀(4π·f/c), f=2.44GHz)
const RSSI_GOOD            = -70;     // dBm — good/marginal boundary
const RSSI_MARGINAL        = -80;     // dBm — marginal/poor boundary (confirmed Q1, 2026-04-21)
const FT_TO_M              = 0.3048;  // conversion constant used in rf-utils.ts
```

---

## RF Propagation Formula

```
RSSI(dBm) = COMBINED_GAIN − FSPL(d_meters) − Σ attenuation(path)

FSPL(d) = FSPL_CONSTANT + 20·log₁₀(d_meters)
         = 40.2 + 20·log₁₀(d_meters)

attenuation(path) = Σ wall_crossings × WALL_MATERIALS[material].attenuation
                  + Σ obstacle_crossings × OBSTACLE_TYPES[type].attenuation
                  + Σ door_crossings × (door.isOpen ? 0 : DOOR_TYPES[type].closedAttenuation)
```

Where `d_meters = pixel_distance / pixelsPerMeter` and `pixelsPerMeter = pixelsPerFoot / FT_TO_M`.

---

## State Transitions

```
ProjectState
  ├─ SET_NAME         → name updated; dateModified updated
  ├─ SET_FLOOR_PLAN   → floorPlanImage set; dateModified updated
  ├─ SET_SCALE        → scale set; recalcSensors triggered
  ├─ ADD_WALL         → wall appended; recalcSensors
  ├─ UPDATE_WALL      → wall mutated; recalcSensors
  ├─ DELETE_WALL      → wall removed; orphan doors removed; recalcSensors
  ├─ ADD_DOOR         → door appended; recalcSensors
  ├─ UPDATE_DOOR      → door mutated; recalcSensors
  ├─ DELETE_DOOR      → door removed; recalcSensors
  ├─ ADD_OBSTACLE     → obstacle appended; recalcSensors
  ├─ UPDATE_OBSTACLE  → obstacle mutated; recalcSensors
  ├─ DELETE_OBSTACLE  → obstacle removed; recalcSensors
  ├─ ADD_GATEWAY      → gateway appended; recalcSensors
  ├─ UPDATE_GATEWAY   → gateway mutated; recalcSensors
  ├─ DELETE_GATEWAY   → gateway removed; sensors with this assignedGatewayId → reassigned; recalcSensors
  ├─ ADD_SENSOR       → sensor appended; recalcSensors
  ├─ UPDATE_SENSOR    → sensor mutated; recalcSensors
  ├─ DELETE_SENSOR    → sensor removed; recalcSensors
  ├─ REASSIGN_SENSORS → recalcSensors only (no structural change)
  └─ SET_PROJECT      → replace entire state (used by undo/redo)
```

**`recalcSensors`** (production: async via Web Worker):
1. Run `autoAssignSensors` — greedy nearest-gateway assignment respecting
   `MAX_SENSORS_PER_GATEWAY` capacity; updates `assignedGatewayId` on every sensor
2. Run `calculateRssi` for each assigned sensor — updates `rssi`
3. Run `getGatewayCoveragePolygon` for each gateway — returns polygon point arrays for
   canvas rendering (not stored in `ProjectState`; held in a separate `coveragePolygons`
   map in Zustand UI state)

---

## Zustand UI State (not persisted to JSON)

Fields that live in the Zustand store but are NOT part of `ProjectState` save/load:

```typescript
interface RFPlannerUIState {
  tool: ToolMode;                // 'select' | 'draw-wall' | 'place-obstacle' | 'place-gateway' | 'place-sensor' | 'set-scale'
  wallMaterial: WallMaterial;    // selected material for next draw-wall operation
  obstacleType: ObstacleType;    // selected type for next place-obstacle operation
  selectedId: string | null;     // currently selected element ID
  scaleInputUnit: 'ft' | 'm';   // NEW: unit toggle for scale dialog (FR-003)
  isDark: boolean;               // persisted to localStorage['rf-theme'], not to project JSON
  canUndo: boolean;              // derived from history stack length
  canRedo: boolean;              // derived from future stack length
  coveragePolygons: Map<string, GatewayPolygons>;  // gateway ID → polygon data from worker
}

interface GatewayPolygons {
  good: Point[];       // polygon boundary where RSSI >= RSSI_GOOD
  marginal: Point[];   // polygon boundary where RSSI >= RSSI_MARGINAL
}
```

---

## ToolMode State Machine

```
            ┌──────────────────────────────────────┐
            │              'select'                │ ← default
            │  click element → set selectedId      │
            │  drag element → UPDATE_*             │
            └──────┬───────────────────────────────┘
                   │ setTool(...)
       ┌───────────┼───────────┬────────────┬──────────────┐
       ▼           ▼           ▼            ▼              ▼
  'draw-wall'  'place-      'place-      'place-       'set-scale'
   mousedown   obstacle'    gateway'     sensor'        click p1
   → drawStart  mousedown   click        click          click p2
   mouseup     → drawStart  → ADD_GW    → ADD_SENSOR   → dialog
   → ADD_WALL  mouseup      setTool     setTool         → SET_SCALE
               → ADD_OBST   'select'    'select'        setTool
               setTool                                  'select'
               'select'
```

After gateway/sensor placement, tool automatically reverts to `'select'` (matches prototype
behaviour).
