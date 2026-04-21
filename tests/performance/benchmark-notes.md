# RF Recalculation Performance Benchmark (T052)

**SC-002**: Worker round-trip MUST complete in ≤ 1 000 ms for  
20 walls + 10 gateways + 50 sensors.

---

## How to run

1. `npm run dev`
2. Open `http://localhost:5173` in Chrome / Edge DevTools.
3. Load or create a project with ≥ 20 walls, 10 gateways, and 50 sensors.
4. Open the browser console; the worker logs every recalculation:

```
[rf-worker] RECALC #<id> completed in <ms>ms (10 gw, 50 sensors, 20 walls)
```

5. Confirm the reported duration is **< 1 000 ms**.

---

## Implementation

`performance.mark` / `performance.measure` calls added in  
`src/features/rf-planner/workers/rf-engine.worker.ts` at the  
start and end of the RECALC handler (T052).

---

## Baseline result (2026-04-21)

| Scenario | Gateways | Sensors | Walls | Duration |
|----------|----------|---------|-------|----------|
| Typical  | 1        | 3       | 0     | < 5 ms   |

> Full 10 gw / 50 sensor / 20 wall benchmark to be recorded and screenshot
> committed to this directory after manual validation run.
