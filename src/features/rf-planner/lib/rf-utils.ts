import {
  Point, Wall, Door, Obstacle, Gateway, Sensor, ScaleRef,
  WALL_MATERIALS, OBSTACLE_TYPES, DOOR_TYPES,
  COMBINED_GAIN, FSPL_CONSTANT, MAX_SENSORS_PER_GATEWAY,
} from '@/features/rf-planner/types';

const FT_TO_M = 0.3048;

// Get pixels-per-foot from scale reference
export function getPixelsPerFoot(scale: ScaleRef): number {
  const dx = scale.p2.x - scale.p1.x;
  const dy = scale.p2.y - scale.p1.y;
  const pixelDist = Math.sqrt(dx * dx + dy * dy);
  return pixelDist / scale.distanceFeet;
}

// FSPL in dB for distance in meters at 2.44 GHz
function fspl(dMeters: number): number {
  if (dMeters <= 0) return 0;
  return FSPL_CONSTANT + 20 * Math.log10(dMeters);
}

// Check if line segment (p1->p2) intersects line segment (p3->p4)
function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-10) return false;
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / cross;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / cross;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// Check if line segment intersects rectangle
function lineIntersectsRect(p1: Point, p2: Point, rx: number, ry: number, rw: number, rh: number): boolean {
  const corners: Point[] = [
    { x: rx, y: ry }, { x: rx + rw, y: ry },
    { x: rx + rw, y: ry + rh }, { x: rx, y: ry + rh },
  ];
  for (let i = 0; i < 4; i++) {
    if (segmentsIntersect(p1, p2, corners[i], corners[(i + 1) % 4])) return true;
  }
  // Check if line is entirely inside rect
  if (p1.x >= rx && p1.x <= rx + rw && p1.y >= ry && p1.y <= ry + rh) return true;
  return false;
}

// Find parameter t where signal path crosses a wall, to check if a door is at that crossing
function getWallCrossingParam(p1: Point, p2: Point, wallStart: Point, wallEnd: Point): number | null {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = wallEnd.x - wallStart.x, d2y = wallEnd.y - wallStart.y;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-10) return null;
  const t = ((wallStart.x - p1.x) * d2y - (wallStart.y - p1.y) * d2x) / cross;
  const u = ((wallStart.x - p1.x) * d1y - (wallStart.y - p1.y) * d1x) / cross;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return u; // u is position along wall
  return null;
}

// Calculate RSSI from sensor position to gateway position
export function calculateRssi(
  sensorPos: Point,
  gatewayPos: Point,
  walls: Wall[],
  doors: Door[],
  obstacles: Obstacle[],
  scale: ScaleRef
): number {
  const ppf = getPixelsPerFoot(scale);
  const dx = gatewayPos.x - sensorPos.x;
  const dy = gatewayPos.y - sensorPos.y;
  const pixelDist = Math.sqrt(dx * dx + dy * dy);
  const distFeet = pixelDist / ppf;
  const distMeters = distFeet * FT_TO_M;

  let wallLoss = 0;
  for (const wall of walls) {
    const crossParam = getWallCrossingParam(sensorPos, gatewayPos, wall.start, wall.end);
    if (crossParam !== null) {
      // Check if there's a door at this crossing point
      let doorAtCrossing: Door | undefined;
      for (const door of doors) {
        if (door.wallId === wall.id && Math.abs(door.position - crossParam) < 0.1) {
          doorAtCrossing = door;
          break;
        }
      }
      if (doorAtCrossing) {
        if (!doorAtCrossing.isOpen) {
          wallLoss += DOOR_TYPES[doorAtCrossing.type].closedAttenuation;
        }
        // Open door = 0 dB
      } else {
        wallLoss += WALL_MATERIALS[wall.material].attenuation;
      }
    }
  }

  let obstacleLoss = 0;
  for (const obs of obstacles) {
    if (lineIntersectsRect(sensorPos, gatewayPos, obs.x, obs.y, obs.width, obs.height)) {
      obstacleLoss += OBSTACLE_TYPES[obs.type].attenuation;
    }
  }

  const pathLoss = fspl(Math.max(distMeters, 0.1));
  return COMBINED_GAIN - pathLoss - wallLoss - obstacleLoss;
}

// Calculate free-space ring radii in pixels for a gateway
export function getRingRadii(scale: ScaleRef): { good: number; marginal: number; poor: number } {
  const ppf = getPixelsPerFoot(scale);
  const solveRadius = (threshold: number) => {
    const d = Math.pow(10, (COMBINED_GAIN - threshold - FSPL_CONSTANT) / 20);
    const dFeet = d / FT_TO_M;
    return dFeet * ppf;
  };
  return {
    good: solveRadius(-70),
    marginal: solveRadius(-80),
    poor: solveRadius(-95),
  };
}

// Auto-assign sensors to gateways
export function autoAssignSensors(
  sensors: Sensor[],
  gateways: Gateway[],
  walls: Wall[],
  doors: Door[],
  obstacles: Obstacle[],
  scale: ScaleRef | null,
): Sensor[] {
  if (!scale || gateways.length === 0) {
    return sensors.map(s => ({ ...s, assignedGatewayId: null, rssi: null }));
  }

  // Calculate RSSI for each sensor to each gateway
  const sensorGatewayRssi: { sensorIdx: number; gatewayId: string; rssi: number }[] = [];
  for (let si = 0; si < sensors.length; si++) {
    for (const gw of gateways) {
      const rssi = calculateRssi(sensors[si], gw, walls, doors, obstacles, scale);
      sensorGatewayRssi.push({ sensorIdx: si, gatewayId: gw.id, rssi });
    }
  }

  // Sort by RSSI descending (best signal first)
  sensorGatewayRssi.sort((a, b) => b.rssi - a.rssi);

  const result = sensors.map(s => ({ ...s, assignedGatewayId: null as string | null, rssi: null as number | null }));
  const gatewayLoad: Record<string, number> = {};
  gateways.forEach(g => { gatewayLoad[g.id] = 0; });

  // Greedy assignment: for each sensor, find best gateway with capacity
  for (let si = 0; si < sensors.length; si++) {
    const candidates = sensorGatewayRssi
      .filter(e => e.sensorIdx === si)
      .sort((a, b) => b.rssi - a.rssi);

    let assigned = false;
    for (const c of candidates) {
      if ((gatewayLoad[c.gatewayId] || 0) + sensors[si].groupCount <= MAX_SENSORS_PER_GATEWAY) {
        result[si].assignedGatewayId = c.gatewayId;
        result[si].rssi = c.rssi;
        gatewayLoad[c.gatewayId] = (gatewayLoad[c.gatewayId] || 0) + sensors[si].groupCount;
        assigned = true;
        break;
      }
    }
    if (!assigned && candidates.length > 0) {
      // All at capacity, assign to best anyway and flag
      result[si].assignedGatewayId = candidates[0].gatewayId;
      result[si].rssi = candidates[0].rssi;
    }
  }

  return result;
}

// Get sensor count for a gateway
export function getGatewaySensorCount(gatewayId: string, sensors: Sensor[]): number {
  return sensors
    .filter(s => s.assignedGatewayId === gatewayId)
    .reduce((sum, s) => sum + s.groupCount, 0);
}

// Count how many walls/obstacles a ray from origin at angle crosses, returning cumulative attenuation
function rayAttenuation(
  origin: Point,
  angle: number,
  maxPixelDist: number,
  walls: Wall[],
  doors: Door[],
  obstacles: Obstacle[],
): number {
  const farX = origin.x + Math.cos(angle) * maxPixelDist;
  const farY = origin.y + Math.sin(angle) * maxPixelDist;
  const rayEnd: Point = { x: farX, y: farY };

  let totalAtten = 0;

  for (const wall of walls) {
    const crossParam = getWallCrossingParam(origin, rayEnd, wall.start, wall.end);
    if (crossParam !== null) {
      let doorAtCrossing: Door | undefined;
      for (const door of doors) {
        if (door.wallId === wall.id && Math.abs(door.position - crossParam) < 0.1) {
          doorAtCrossing = door;
          break;
        }
      }
      if (doorAtCrossing) {
        if (!doorAtCrossing.isOpen) {
          totalAtten += DOOR_TYPES[doorAtCrossing.type].closedAttenuation;
        }
      } else {
        totalAtten += WALL_MATERIALS[wall.material].attenuation;
      }
    }
  }

  for (const obs of obstacles) {
    if (lineIntersectsRect(origin, rayEnd, obs.x, obs.y, obs.width, obs.height)) {
      totalAtten += OBSTACLE_TYPES[obs.type].attenuation;
    }
  }

  return totalAtten;
}

// Compute directional coverage polygon for a gateway (72 rays, every 5 degrees)
export function getGatewayCoveragePolygon(
  gw: Gateway,
  walls: Wall[],
  doors: Door[],
  obstacles: Obstacle[],
  scale: ScaleRef,
  rssiThreshold: number,
): Point[] {
  const ppf = getPixelsPerFoot(scale);
  const numRays = 72;
  const points: Point[] = [];

  const maxDistMeters = Math.pow(10, (COMBINED_GAIN - rssiThreshold - FSPL_CONSTANT) / 20);
  const maxDistPixels = (maxDistMeters / FT_TO_M) * ppf;
  const cappedMax = Math.min(maxDistPixels * 1.5, 5000);

  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2;
    const materialAtten = rayAttenuation(gw, angle, cappedMax, walls, doors, obstacles);

    const budget = COMBINED_GAIN - rssiThreshold - materialAtten;
    let effectiveDistPixels: number;
    if (budget <= FSPL_CONSTANT) {
      effectiveDistPixels = 5;
    } else {
      const dMeters = Math.pow(10, (budget - FSPL_CONSTANT) / 20);
      effectiveDistPixels = (dMeters / FT_TO_M) * ppf;
    }
    effectiveDistPixels = Math.min(effectiveDistPixels, cappedMax);

    points.push({
      x: gw.x + Math.cos(angle) * effectiveDistPixels,
      y: gw.y + Math.sin(angle) * effectiveDistPixels,
    });
  }

  return points;
}
