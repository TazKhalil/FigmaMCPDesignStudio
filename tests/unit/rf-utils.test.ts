import { describe, it, expect } from 'vitest';
import {
  getPixelsPerFoot,
  calculateRssi,
  getRingRadii,
  autoAssignSensors,
  getGatewayCoveragePolygon,
} from '@/features/rf-planner/lib/rf-utils';
import type { ScaleRef, Wall, Gateway, Sensor } from '@/features/rf-planner/types';
import {
  COMBINED_GAIN,
  FSPL_CONSTANT,
  RSSI_GOOD,
  RSSI_MARGINAL,
  MAX_SENSORS_PER_GATEWAY,
} from '@/features/rf-planner/types';

// --- Shared fixtures ---
const scale100: ScaleRef = {
  p1: { x: 0, y: 0 },
  p2: { x: 100, y: 0 },
  distanceFeet: 100,
}; // 1 px = 1 ft

const noWalls: Wall[] = [];
const noDoors: never[] = [];
const noObstacles: never[] = [];

// --- getPixelsPerFoot ---
describe('getPixelsPerFoot', () => {
  it('returns 1 when 100px = 100ft', () => {
    expect(getPixelsPerFoot(scale100)).toBeCloseTo(1, 5);
  });

  it('returns 2 when 200px = 100ft', () => {
    const s: ScaleRef = { p1: { x: 0, y: 0 }, p2: { x: 200, y: 0 }, distanceFeet: 100 };
    expect(getPixelsPerFoot(s)).toBeCloseTo(2, 5);
  });

  it('handles diagonal scale line correctly', () => {
    // 3-4-5 right triangle: pixel dist = 50, distanceFeet = 50 → 1 ppf
    const s: ScaleRef = { p1: { x: 0, y: 0 }, p2: { x: 30, y: 40 }, distanceFeet: 50 };
    expect(getPixelsPerFoot(s)).toBeCloseTo(1, 5);
  });
});

// --- calculateRssi ---
describe('calculateRssi', () => {
  it('computes RSSI at exactly 1 meter with no walls', () => {
    // 1 ft = 0.3048 m, so for 1 m we need 1/0.3048 ft
    // With scale100 (1px=1ft), 1m distance = 1/0.3048 px ≈ 3.2808 px
    const FT_TO_M = 0.3048;
    const distFt = 1 / FT_TO_M;
    const sensorPos = { x: 0, y: 0 };
    const gatewayPos = { x: distFt, y: 0 };
    const rssi = calculateRssi(sensorPos, gatewayPos, noWalls, noDoors, noObstacles, scale100);
    // FSPL(1m) = 40.2 + 20*log10(1) = 40.2
    const expected = COMBINED_GAIN - (FSPL_CONSTANT + 20 * Math.log10(1));
    expect(rssi).toBeCloseTo(expected, 2);
  });

  it('RSSI degrades as distance increases', () => {
    const rssi10 = calculateRssi({ x: 0, y: 0 }, { x: 10, y: 0 }, noWalls, noDoors, noObstacles, scale100);
    const rssi100 = calculateRssi({ x: 0, y: 0 }, { x: 100, y: 0 }, noWalls, noDoors, noObstacles, scale100);
    expect(rssi10).toBeGreaterThan(rssi100);
  });

  it('wall attenuation reduces RSSI', () => {
    const gw = { x: 100, y: 0 };
    const sensor = { x: 0, y: 0 };
    const wall: Wall = {
      id: 'w1', start: { x: 50, y: -10 }, end: { x: 50, y: 10 }, material: 'drywall',
    };
    const rssiNoWall = calculateRssi(sensor, gw, noWalls, noDoors, noObstacles, scale100);
    const rssiWall = calculateRssi(sensor, gw, [wall], noDoors, noObstacles, scale100);
    expect(rssiWall).toBeLessThan(rssiNoWall);
    expect(rssiNoWall - rssiWall).toBeCloseTo(3, 1); // drywall = 3 dB
  });

  it('concrete wall attenuates more than drywall', () => {
    const gw = { x: 100, y: 0 };
    const sensor = { x: 0, y: 0 };
    const drywall: Wall = { id: 'w1', start: { x: 50, y: -10 }, end: { x: 50, y: 10 }, material: 'drywall' };
    const concrete: Wall = { id: 'w2', start: { x: 50, y: -10 }, end: { x: 50, y: 10 }, material: 'concrete' };
    const rssiDrywall = calculateRssi(sensor, gw, [drywall], noDoors, noObstacles, scale100);
    const rssiConcrete = calculateRssi(sensor, gw, [concrete], noDoors, noObstacles, scale100);
    expect(rssiConcrete).toBeLessThan(rssiDrywall);
  });
});

// --- getRingRadii ---
describe('getRingRadii', () => {
  it('returns positive pixel values for all three tiers', () => {
    const radii = getRingRadii(scale100);
    expect(radii.good).toBeGreaterThan(0);
    expect(radii.marginal).toBeGreaterThan(0);
    expect(radii.poor).toBeGreaterThan(0);
  });

  it('good radius < marginal radius < poor radius', () => {
    const radii = getRingRadii(scale100);
    expect(radii.good).toBeLessThan(radii.marginal);
    expect(radii.marginal).toBeLessThan(radii.poor);
  });

  it('radii scale proportionally with ppf', () => {
    const scale200: ScaleRef = { p1: { x: 0, y: 0 }, p2: { x: 200, y: 0 }, distanceFeet: 100 };
    const r1 = getRingRadii(scale100);
    const r2 = getRingRadii(scale200);
    expect(r2.good / r1.good).toBeCloseTo(2, 2);
    expect(r2.marginal / r1.marginal).toBeCloseTo(2, 2);
  });
});

// --- autoAssignSensors ---
describe('autoAssignSensors', () => {
  const makeGateway = (id: string, x: number, y: number): Gateway => ({ id, x, y, label: id });
  const makeSensor = (id: string, x: number, y: number, groupCount = 1): Sensor => ({
    id, x, y, label: id, groupCount, assignedGatewayId: null, rssi: null,
  });

  it('assigns sensor to nearest gateway (no walls)', () => {
    const gw1 = makeGateway('gw1', 10, 0);
    const gw2 = makeGateway('gw2', 200, 0);
    const sensor = makeSensor('s1', 20, 0);
    const result = autoAssignSensors([sensor], [gw1, gw2], noWalls, noDoors, noObstacles, scale100);
    expect(result[0].assignedGatewayId).toBe('gw1');
    expect(result[0].rssi).not.toBeNull();
  });

  it('returns unassigned sensors when no gateways exist', () => {
    const sensor = makeSensor('s1', 50, 0);
    const result = autoAssignSensors([sensor], [], noWalls, noDoors, noObstacles, scale100);
    expect(result[0].assignedGatewayId).toBeNull();
    expect(result[0].rssi).toBeNull();
  });

  it('returns unassigned when scale is null', () => {
    const gw = makeGateway('gw1', 10, 0);
    const sensor = makeSensor('s1', 20, 0);
    const result = autoAssignSensors([sensor], [gw], noWalls, noDoors, noObstacles, null);
    expect(result[0].assignedGatewayId).toBeNull();
  });

  it('respects MAX_SENSORS_PER_GATEWAY capacity (30)', () => {
    // Create one gateway and 31 sensors with groupCount=1 each
    const gw = makeGateway('gw1', 0, 0);
    const sensors: Sensor[] = Array.from({ length: MAX_SENSORS_PER_GATEWAY + 1 }, (_, i) =>
      makeSensor(`s${i}`, i + 1, 0)
    );
    const result = autoAssignSensors(sensors, [gw], noWalls, noDoors, noObstacles, scale100);
    // The 31st sensor (worst RSSI = farthest) should still be assigned because the prototype
    // assigns overflow sensors to best gateway anyway
    const assigned = result.filter(s => s.assignedGatewayId === 'gw1');
    expect(assigned.length).toBe(MAX_SENSORS_PER_GATEWAY + 1);
  });

  it('overflow sensor has overCapacity: true (T033)', () => {
    const gw = makeGateway('gw1', 0, 0);
    // Create exactly MAX+1 sensors; the last one (farthest/worst RSSI) will overflow
    const sensors: Sensor[] = Array.from({ length: MAX_SENSORS_PER_GATEWAY + 1 }, (_, i) =>
      makeSensor(`s${i}`, i + 1, 0)
    );
    const result = autoAssignSensors(sensors, [gw], noWalls, noDoors, noObstacles, scale100);
    const overCapacitySensors = result.filter(s => s.overCapacity === true);
    expect(overCapacitySensors).toHaveLength(1);
  });

  it('sensors within capacity have overCapacity: false (T033)', () => {
    const gw = makeGateway('gw1', 0, 0);
    const sensors = [makeSensor('s1', 10, 0), makeSensor('s2', 20, 0)];
    const result = autoAssignSensors(sensors, [gw], noWalls, noDoors, noObstacles, scale100);
    result.forEach(s => expect(s.overCapacity).toBe(false));
  });

  it('assigns each sensor with an RSSI value', () => {
    const gw = makeGateway('gw1', 0, 0);
    const sensors = [makeSensor('s1', 50, 0), makeSensor('s2', 100, 0)];
    const result = autoAssignSensors(sensors, [gw], noWalls, noDoors, noObstacles, scale100);
    result.forEach(s => expect(s.rssi).not.toBeNull());
  });
});

// --- getGatewayCoveragePolygon ---
describe('getGatewayCoveragePolygon', () => {
  const gw: Gateway = { id: 'gw1', x: 100, y: 100, label: 'GW1' };

  it('returns an array of 72 points', () => {
    const polygon = getGatewayCoveragePolygon(gw, noWalls, noDoors, noObstacles, scale100, RSSI_GOOD);
    expect(polygon).toHaveLength(72);
  });

  it('each point has x and y properties', () => {
    const polygon = getGatewayCoveragePolygon(gw, noWalls, noDoors, noObstacles, scale100, RSSI_GOOD);
    polygon.forEach(pt => {
      expect(typeof pt.x).toBe('number');
      expect(typeof pt.y).toBe('number');
    });
  });

  it('marginal threshold produces a larger polygon than good threshold', () => {
    const pgood = getGatewayCoveragePolygon(gw, noWalls, noDoors, noObstacles, scale100, RSSI_GOOD);
    const pmarginal = getGatewayCoveragePolygon(gw, noWalls, noDoors, noObstacles, scale100, RSSI_MARGINAL);
    // Average distance from center should be larger for marginal
    const avgDist = (pts: { x: number; y: number }[]) =>
      pts.reduce((sum, p) => sum + Math.sqrt((p.x - gw.x) ** 2 + (p.y - gw.y) ** 2), 0) / pts.length;
    expect(avgDist(pmarginal)).toBeGreaterThan(avgDist(pgood));
  });

  it('polygon points are all positive numbers (valid coordinates)', () => {
    const polygon = getGatewayCoveragePolygon(gw, noWalls, noDoors, noObstacles, scale100, RSSI_GOOD);
    polygon.forEach(pt => {
      expect(isFinite(pt.x)).toBe(true);
      expect(isFinite(pt.y)).toBe(true);
    });
  });
});
