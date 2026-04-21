export type ToolMode = 'select' | 'draw-wall' | 'place-obstacle' | 'place-gateway' | 'place-sensor' | 'set-scale';

export type WallMaterial = 'drywall' | 'glass' | 'brick' | 'concrete' | 'steel';
export type ObstacleType = 'machinery' | 'racking' | 'open-area';
export type DoorType = 'interior' | 'steel-fire';

export interface Point { x: number; y: number; }

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  material: WallMaterial;
}

export interface Door {
  id: string;
  wallId: string;
  position: number; // 0-1 along wall
  type: DoorType;
  isOpen: boolean;
}

export interface Obstacle {
  id: string;
  x: number; y: number;
  width: number; height: number;
  type: ObstacleType;
}

export interface Gateway {
  id: string;
  x: number; y: number;
  label: string;
}

export interface Sensor {
  id: string;
  x: number; y: number;
  label: string;
  groupCount: number;
  assignedGatewayId: string | null;
  rssi: number | null;
  /** True when the sensor was assigned to a gateway that has already exceeded MAX_SENSORS_PER_GATEWAY capacity. */
  overCapacity?: boolean;
}

export interface ScaleRef {
  p1: Point;
  p2: Point;
  distanceFeet: number;
}

export interface ProjectState {
  name: string;
  dateCreated: string;
  dateModified: string;
  floorPlanImage: string | null;
  scale: ScaleRef | null;
  walls: Wall[];
  doors: Door[];
  obstacles: Obstacle[];
  gateways: Gateway[];
  sensors: Sensor[];
}

export const WALL_MATERIALS: Record<WallMaterial, { attenuation: number; color: string; label: string }> = {
  drywall: { attenuation: 3, color: '#9ca3af', label: 'Drywall' },
  glass: { attenuation: 2, color: '#60a5fa', label: 'Glass' },
  brick: { attenuation: 6, color: '#c2703e', label: 'Brick' },
  concrete: { attenuation: 10, color: '#4b5563', label: 'Concrete' },
  steel: { attenuation: 12, color: '#1f2937', label: 'Steel' },
};

export const OBSTACLE_TYPES: Record<ObstacleType, { attenuation: number; color: string; label: string }> = {
  machinery: { attenuation: 6, color: 'rgba(239,68,68,0.25)', label: 'Machinery' },
  racking: { attenuation: 3, color: 'rgba(245,158,11,0.25)', label: 'Racking / Shelving' },
  'open-area': { attenuation: 0, color: 'rgba(34,197,94,0.15)', label: 'Open Area' },
};

export const DOOR_TYPES: Record<DoorType, { closedAttenuation: number; label: string }> = {
  interior: { closedAttenuation: 2, label: 'Interior' },
  'steel-fire': { closedAttenuation: 5, label: 'Steel Fire Door' },
};

// RF Constants
export const SENSOR_TX = 18; // dBm
export const SENSOR_ANTENNA = 1.49; // dBi
export const GATEWAY_ANTENNA = 2; // dBi
export const COMBINED_GAIN = SENSOR_TX + SENSOR_ANTENNA + GATEWAY_ANTENNA; // 21.49
export const FSPL_CONSTANT = 40.2; // at 2.44 GHz, FSPL(d) = 40.2 + 20*log10(d_meters)
export const MAX_SENSORS_PER_GATEWAY = 30;

export const RSSI_GOOD = -70;
export const RSSI_MARGINAL = -80;

export function getRssiTier(rssi: number): 'good' | 'marginal' | 'poor' {
  if (rssi >= RSSI_GOOD) return 'good';
  if (rssi >= RSSI_MARGINAL) return 'marginal';
  return 'poor';
}

export function getRssiColor(rssi: number): string {
  const tier = getRssiTier(rssi);
  if (tier === 'good') return '#22c55e';
  if (tier === 'marginal') return '#eab308';
  return '#ef4444';
}

// UI state types
export type ScaleInputUnit = 'ft' | 'm';

export type ProjectAction =
  | { type: 'SET_PROJECT'; project: ProjectState }
  | { type: 'SET_NAME'; name: string }
  | { type: 'SET_FLOOR_PLAN'; image: string | null }
  | { type: 'SET_SCALE'; scale: ScaleRef }
  | { type: 'ADD_WALL'; wall: Wall }
  | { type: 'UPDATE_WALL'; id: string; changes: Partial<Wall> }
  | { type: 'DELETE_WALL'; id: string }
  | { type: 'ADD_DOOR'; door: Door }
  | { type: 'UPDATE_DOOR'; id: string; changes: Partial<Door> }
  | { type: 'DELETE_DOOR'; id: string }
  | { type: 'ADD_OBSTACLE'; obstacle: Obstacle }
  | { type: 'UPDATE_OBSTACLE'; id: string; changes: Partial<Obstacle> }
  | { type: 'DELETE_OBSTACLE'; id: string }
  | { type: 'ADD_GATEWAY'; gateway: Gateway }
  | { type: 'UPDATE_GATEWAY'; id: string; changes: Partial<Gateway> }
  | { type: 'DELETE_GATEWAY'; id: string }
  | { type: 'ADD_SENSOR'; sensor: Sensor }
  | { type: 'UPDATE_SENSOR'; id: string; changes: Partial<Sensor> }
  | { type: 'DELETE_SENSOR'; id: string }
  | { type: 'REASSIGN_SENSORS' };
