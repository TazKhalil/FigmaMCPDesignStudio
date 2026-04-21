import React from 'react';
import { Trash2 } from 'lucide-react';
import { useRFPlannerStore } from '@/stores/rf-planner.store';
import {
  WALL_MATERIALS, OBSTACLE_TYPES,
  WallMaterial, ObstacleType,
  getRssiTier, getRssiColor, MAX_SENSORS_PER_GATEWAY,
} from '@/features/rf-planner/types';
import { getPixelsPerFoot, getGatewaySensorCount } from '@/features/rf-planner/lib/rf-utils';

/**
 * Selection-aware properties panel.
 * Ported from prototype src/app/components/PropertiesPanel.tsx
 * Changes vs prototype:
 *   - useStore() → useRFPlannerStore()
 *   - All <label> elements now have htmlFor + matching id on their input
 *   - Delete button has aria-label
 */
export function PropertiesPanel() {
  const { project, dispatch, selectedId, setSelectedId } = useRFPlannerStore();

  if (!selectedId) {
    return (
      <div className="w-64 border-l border-border bg-card p-4 text-muted-foreground text-[13px] shrink-0 overflow-y-auto">
        Select an object to view its properties
      </div>
    );
  }

  const wall = project.walls.find(w => w.id === selectedId);
  const obstacle = project.obstacles.find(o => o.id === selectedId);
  const gateway = project.gateways.find(g => g.id === selectedId);
  const sensor = project.sensors.find(s => s.id === selectedId);

  const handleDelete = () => {
    if (wall) dispatch({ type: 'DELETE_WALL', id: wall.id });
    else if (obstacle) dispatch({ type: 'DELETE_OBSTACLE', id: obstacle.id });
    else if (gateway) dispatch({ type: 'DELETE_GATEWAY', id: gateway.id });
    else if (sensor) dispatch({ type: 'DELETE_SENSOR', id: sensor.id });
    setSelectedId(null);
  };

  const sectionClass = 'text-[13px] space-y-3';
  const labelClass = 'block text-[11px] text-muted-foreground mb-1';
  const inputClass = 'w-full px-2 py-1 rounded border border-border bg-background text-foreground text-[13px]';

  const wallLength = () => {
    if (!wall || !project.scale) return 'N/A';
    const ppf = getPixelsPerFoot(project.scale);
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    return (Math.sqrt(dx * dx + dy * dy) / ppf).toFixed(1) + ' ft';
  };

  return (
    <div className="w-64 border-l border-border bg-card p-4 shrink-0 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px]">Properties</h3>
        <button
          onClick={handleDelete}
          className="p-1 rounded hover:bg-destructive/10 text-destructive cursor-pointer"
          aria-label="Delete selected element"
          title="Delete (Del)"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Wall properties */}
      {wall && (
        <div className={sectionClass}>
          <div>
            <label htmlFor="wall-material" className={labelClass}>Material</label>
            <select
              id="wall-material"
              className={inputClass}
              value={wall.material}
              onChange={e =>
                dispatch({ type: 'UPDATE_WALL', id: wall.id, changes: { material: e.target.value as WallMaterial } })
              }
            >
              {Object.entries(WALL_MATERIALS).map(([k, v]) => (
                <option key={k} value={k}>{v.label} ({v.attenuation} dB)</option>
              ))}
            </select>
          </div>
          <div>
            <span className={labelClass} aria-hidden="true">Length</span>
            <div className="text-foreground" aria-label={`Wall length: ${wallLength()}`}>
              {wallLength()}
            </div>
          </div>
        </div>
      )}

      {/* Obstacle properties */}
      {obstacle && (
        <div className={sectionClass}>
          <div>
            <label htmlFor="obstacle-type" className={labelClass}>Type</label>
            <select
              id="obstacle-type"
              className={inputClass}
              value={obstacle.type}
              onChange={e =>
                dispatch({ type: 'UPDATE_OBSTACLE', id: obstacle.id, changes: { type: e.target.value as ObstacleType } })
              }
            >
              {Object.entries(OBSTACLE_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v.label} ({v.attenuation} dB)</option>
              ))}
            </select>
          </div>
          {project.scale && (
            <div>
              <span className={labelClass} aria-hidden="true">Dimensions</span>
              <div className="text-foreground text-[13px]" aria-label={`Dimensions: ${(obstacle.width / getPixelsPerFoot(project.scale)).toFixed(1)} by ${(obstacle.height / getPixelsPerFoot(project.scale)).toFixed(1)} feet`}>
                {(obstacle.width / getPixelsPerFoot(project.scale)).toFixed(1)} ×{' '}
                {(obstacle.height / getPixelsPerFoot(project.scale)).toFixed(1)} ft
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gateway properties */}
      {gateway && (
        <div className={sectionClass}>
          <div>
            <label htmlFor="gateway-label" className={labelClass}>Label</label>
            <input
              id="gateway-label"
              className={inputClass}
              value={gateway.label}
              onChange={e =>
                dispatch({ type: 'UPDATE_GATEWAY', id: gateway.id, changes: { label: e.target.value } })
              }
            />
          </div>
          <div>
            <span className={labelClass} aria-hidden="true">Sensors</span>
            {(() => {
              const count = getGatewaySensorCount(gateway.id, project.sensors);
              const atCapacity = count >= MAX_SENSORS_PER_GATEWAY;
              const overCapacity = count > MAX_SENSORS_PER_GATEWAY;
              return (
                <div
                  className={overCapacity ? 'text-red-500' : atCapacity ? 'text-amber-500' : 'text-foreground'}
                  aria-label={`${count} of ${MAX_SENSORS_PER_GATEWAY} sensors${overCapacity ? ' — over capacity' : atCapacity ? ' — at capacity' : ''}`}
                >
                  {count}/{MAX_SENSORS_PER_GATEWAY}
                  {overCapacity && (
                    <span className="ml-1 text-[11px] font-semibold" role="alert">— Over Capacity</span>
                  )}
                  {atCapacity && !overCapacity && (
                    <span className="ml-1 text-[11px]">(at capacity)</span>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Sensor properties */}
      {sensor && (
        <div className={sectionClass}>
          <div>
            <label htmlFor="sensor-label" className={labelClass}>Label</label>
            <input
              id="sensor-label"
              className={inputClass}
              value={sensor.label}
              onChange={e =>
                dispatch({ type: 'UPDATE_SENSOR', id: sensor.id, changes: { label: e.target.value } })
              }
            />
          </div>
          <div>
            <label htmlFor="sensor-group-count" className={labelClass}>Group Count</label>
            <input
              id="sensor-group-count"
              type="number"
              min={1}
              max={30}
              className={inputClass}
              value={sensor.groupCount}
              onChange={e =>
                dispatch({
                  type: 'UPDATE_SENSOR',
                  id: sensor.id,
                  changes: { groupCount: Math.max(1, parseInt(e.target.value) || 1) },
                })
              }
            />
          </div>
          <div>
            <span className={labelClass} aria-hidden="true">Assigned Gateway</span>
            <div className="text-foreground">
              {sensor.assignedGatewayId
                ? project.gateways.find(g => g.id === sensor.assignedGatewayId)?.label ?? 'Unknown'
                : 'None'}
            </div>
          </div>
          <div>
            <span className={labelClass} aria-hidden="true">Estimated RSSI</span>
            {sensor.rssi !== null ? (
              <div
                style={{ color: getRssiColor(sensor.rssi) }}
                aria-label={`RSSI: ${sensor.rssi.toFixed(1)} dBm, tier: ${getRssiTier(sensor.rssi)}`}
              >
                {sensor.rssi.toFixed(1)} dBm
                <span className="ml-1 text-[11px] opacity-80">({getRssiTier(sensor.rssi)})</span>
              </div>
            ) : (
              <div className="text-muted-foreground">N/A</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
