# Contract: Project Save Format

**Feature**: `001-rf-coverage-planner`  
**Version**: 1.0.0  
**Date**: 2026-04-21

The `.json` save file is the serialised form of `ProjectState`. Saving and loading this
file is the primary project persistence mechanism (FR-015, FR-016).

---

## File Format

- **Encoding**: UTF-8
- **Extension**: `.json`
- **Default filename**: `{project.name}_project.json`
- **MIME type**: `application/json`

---

## Schema

```jsonc
{
  "name": "string",               // project name; default "Untitled Project"
  "dateCreated": "string",        // ISO 8601 (e.g. "2026-04-21T14:30:00.000Z")
  "dateModified": "string",       // ISO 8601
  "floorPlanImage": "string|null",// base64 data URL ("data:image/png;base64,...") or null
  "scale": {                      // null if scale not yet set
    "p1": { "x": "number", "y": "number" },
    "p2": { "x": "number", "y": "number" },
    "distanceFeet": "number"      // ALWAYS feet; metres are converted on input
  },
  "walls": [
    {
      "id": "string",
      "start": { "x": "number", "y": "number" },
      "end":   { "x": "number", "y": "number" },
      "material": "drywall|glass|brick|concrete|steel"
    }
  ],
  "doors": [
    {
      "id": "string",
      "wallId": "string",
      "position": "number",       // 0.0–1.0 along parent wall
      "type": "interior|steel-fire",
      "isOpen": "boolean"
    }
  ],
  "obstacles": [
    {
      "id": "string",
      "x": "number", "y": "number",
      "width": "number", "height": "number",
      "type": "machinery|racking|open-area"
    }
  ],
  "gateways": [
    {
      "id": "string",
      "x": "number", "y": "number",
      "label": "string"
    }
  ],
  "sensors": [
    {
      "id": "string",
      "x": "number", "y": "number",
      "label": "string",
      "groupCount": "number",           // integer >= 1
      "assignedGatewayId": "string|null",
      "rssi": "number|null"             // dBm; re-computed on load, stored for display continuity
    }
  ]
}
```

---

## Load Behaviour

1. Parse JSON; validate required top-level keys exist (`name`, `dateCreated`, `walls`,
   `gateways`, `sensors`). On parse failure: show error toast; do not replace current state.
2. Dispatch `SET_PROJECT` with the loaded `ProjectState`.
3. Trigger immediate `REASSIGN_SENSORS` — this re-runs `autoAssignSensors` + `calculateRssi`
   via the Web Worker to produce current results. The `rssi` values stored in the file are
   used only for display until the worker result returns.
4. Success criterion (SC-004): RSSI values produced by the worker after load MUST be
   bit-identical to those visible before save (same geometry, same RF constants).

---

## Compatibility Notes

- `floorPlanImage` as a base64 data URL can be 1–5 MB for a typical floor plan scan.
  localStorage quota is typically 5–10 MB per origin; this is sufficient for MVP but should
  be monitored. A future iteration may move the image to IndexedDB.
- `doors` array may be empty for v1 (door placement UI is out of scope). The schema
  supports doors for forward compatibility.
- The `rssi` and `assignedGatewayId` fields on sensors are computed on every load. They
  are stored in the file for convenience (immediate display) but must not be treated as
  authoritative — always re-compute after load.
