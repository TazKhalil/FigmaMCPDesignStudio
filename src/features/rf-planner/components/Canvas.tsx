import React, {
  useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle,
} from 'react';
import { useRFPlannerStore, genId } from '@/stores/rf-planner.store';
import {
  Point, WALL_MATERIALS, OBSTACLE_TYPES,
  getRssiColor, getRssiTier, MAX_SENSORS_PER_GATEWAY,
} from '@/features/rf-planner/types';
import {
  getPixelsPerFoot, getGatewaySensorCount, getGatewayCoveragePolygon, getRingRadii,
} from '@/features/rf-planner/lib/rf-utils';
import gatewayImgSrc from '@/assets/gateway.png';
import sensorImgSrc from '@/assets/sensor.png';

export interface CanvasHandle {
  getZoom: () => number;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToScreen: () => void;
  exportPng: () => void;
  exportCsv: () => void;
}

const SNAP_THRESHOLD = 10;

function snap(p: Point, project: { walls: { id: string; start: Point; end: Point }[] }, excludeId?: string): Point {
  let best = p;
  let bestDist = SNAP_THRESHOLD;
  const checkPoint = (cp: Point) => {
    const d = Math.sqrt((p.x - cp.x) ** 2 + (p.y - cp.y) ** 2);
    if (d < bestDist) { bestDist = d; best = cp; }
  };
  for (const w of project.walls) {
    if (w.id === excludeId) continue;
    checkPoint(w.start);
    checkPoint(w.end);
  }
  return best;
}

export const Canvas = forwardRef<CanvasHandle>((_, ref) => {
  const {
    project, dispatch, tool, setTool,
    wallMaterial, obstacleType, selectedId, setSelectedId,
    isDark, scaleInputUnit, setScaleInputUnit,
    undo, redo,
  } = useRFPlannerStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const panOffsetStartRef = useRef<Point>({ x: 0, y: 0 });

  // Drawing state
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [drawEnd, setDrawEnd] = useState<Point | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [draggingWallEndpoint, setDraggingWallEndpoint] = useState<'start' | 'end' | 'whole' | null>(null);
  const [wallDragStart, setWallDragStart] = useState<Point | null>(null);

  // Scale calibration
  const [scaleP1, setScaleP1] = useState<Point | null>(null);
  const [scaleP2, setScaleP2] = useState<Point | null>(null);
  const [showScaleDialog, setShowScaleDialog] = useState(false);
  const [scaleInput, setScaleInput] = useState('');
  // Local dialog unit starts from store preference
  const [dialogUnit, setDialogUnit] = useState<'ft' | 'm'>(scaleInputUnit);

  // Floor plan image
  const [floorPlanImg, setFloorPlanImg] = useState<HTMLImageElement | null>(null);

  // Product images
  const [gwImg, setGwImg] = useState<HTMLImageElement | null>(null);
  const [sensorImg, setSensorImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const gImg = new Image();
    gImg.onload = () => setGwImg(gImg);
    gImg.src = gatewayImgSrc;
    const sImg = new Image();
    sImg.onload = () => setSensorImg(sImg);
    sImg.src = sensorImgSrc;
  }, []);

  useEffect(() => {
    if (project.floorPlanImage) {
      const img = new Image();
      img.onload = () => setFloorPlanImg(img);
      img.src = project.floorPlanImage;
    } else {
      setFloorPlanImg(null);
    }
  }, [project.floorPlanImage]);

  // Sync dialog unit when store preference changes
  useEffect(() => {
    setDialogUnit(scaleInputUnit);
  }, [scaleInputUnit]);

  // Screen → canvas coords
  const screenToCanvas = useCallback((sx: number, sy: number): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: sx, y: sy };
    return {
      x: (sx - rect.left - panOffset.x) / zoom,
      y: (sy - rect.top - panOffset.y) / zoom,
    };
  }, [zoom, panOffset]);

  // Expose zoom + export via handle
  useImperativeHandle(ref, () => ({
    getZoom: () => zoom,
    zoomIn: () => setZoom(z => Math.min(z * 1.25, 10)),
    zoomOut: () => setZoom(z => Math.max(z / 1.25, 0.1)),
    fitToScreen: () => {
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
    },
    exportPng: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `${project.name}_map.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    },
    exportCsv: () => {
      const rows = [['Gateway', 'Gateway Label', 'Sensor Label', 'Sensor Group Count', 'Estimated RSSI (dBm)', 'Signal Tier']];
      for (const s of project.sensors) {
        const gw = project.gateways.find(g => g.id === s.assignedGatewayId);
        rows.push([
          gw?.label || 'N/A',
          gw?.label || 'N/A',
          s.label,
          String(s.groupCount),
          s.rssi !== null ? s.rssi.toFixed(1) : 'N/A',
          s.rssi !== null ? getRssiTier(s.rssi) : 'N/A',
        ]);
      }
      const totalGw = project.gateways.length;
      const totalPoints = project.sensors.length;
      const totalSensors = project.sensors.reduce((a, b) => a + b.groupCount, 0);
      rows.push([]);
      rows.push(['Summary', `Gateways: ${totalGw}`, `Sensor Points: ${totalPoints}`, `Total Sensors: ${totalSensors}`, '', '']);
      const csv = rows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const link = document.createElement('a');
      link.download = `${project.name}_BOM.csv`;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    },
  }), [zoom, project]);

  // Hit testing
  const hitTest = useCallback((p: Point): string | null => {
    const hitRadius = 1 / zoom;
    for (const s of project.sensors) {
      if (Math.sqrt((p.x - s.x) ** 2 + (p.y - s.y) ** 2) < 14 * hitRadius) return s.id;
    }
    for (const g of project.gateways) {
      if (Math.sqrt((p.x - g.x) ** 2 + (p.y - g.y) ** 2) < 18 * hitRadius) return g.id;
    }
    for (const o of project.obstacles) {
      const margin = 4 * hitRadius;
      if (p.x >= o.x - margin && p.x <= o.x + o.width + margin &&
          p.y >= o.y - margin && p.y <= o.y + o.height + margin) return o.id;
    }
    for (const w of project.walls) {
      const dx = w.end.x - w.start.x;
      const dy = w.end.y - w.start.y;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      let t = ((p.x - w.start.x) * dx + (p.y - w.start.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const cx = w.start.x + t * dx;
      const cy = w.start.y + t * dy;
      if (Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2) < 10 * hitRadius) return w.id;
    }
    return null;
  }, [project, zoom]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      panOffsetStartRef.current = { ...panOffset };
      return;
    }

    if (e.button !== 0) return;
    const cp = screenToCanvas(e.clientX, e.clientY);

    if (tool === 'select') {
      const hitId = hitTest(cp);
      setSelectedId(hitId);
      if (hitId) {
        const obj = [...project.gateways, ...project.sensors].find(o => o.id === hitId);
        if (obj) {
          setDraggingId(hitId);
          setDragOffset({ x: cp.x - (obj as { x: number }).x, y: cp.y - (obj as { x: number; y: number }).y });
        }
        const wall = project.walls.find(w => w.id === hitId);
        if (wall) {
          const hitRadiusPx = 1 / zoom;
          const distToStart = Math.sqrt((cp.x - wall.start.x) ** 2 + (cp.y - wall.start.y) ** 2);
          const distToEnd = Math.sqrt((cp.x - wall.end.x) ** 2 + (cp.y - wall.end.y) ** 2);
          const epThreshold = 12 * hitRadiusPx;
          setDraggingId(hitId);
          setWallDragStart(cp);
          if (distToStart < epThreshold) {
            setDraggingWallEndpoint('start');
          } else if (distToEnd < epThreshold) {
            setDraggingWallEndpoint('end');
          } else {
            setDraggingWallEndpoint('whole');
          }
        }
      }
    } else if (tool === 'set-scale') {
      if (!scaleP1) {
        setScaleP1(cp);
      } else {
        setScaleP2(cp);
        setShowScaleDialog(true);
      }
    } else if (tool === 'draw-wall') {
      const snapped = snap(cp, project);
      setDrawStart(snapped);
      setDrawEnd(snapped);
    } else if (tool === 'place-obstacle') {
      setDrawStart(cp);
      setDrawEnd(cp);
    } else if (tool === 'place-gateway') {
      const id = genId();
      const num = project.gateways.length + 1;
      dispatch({ type: 'ADD_GATEWAY', gateway: { id, x: cp.x, y: cp.y, label: `GW-${num}` } });
      setSelectedId(id);
    } else if (tool === 'place-sensor') {
      const id = genId();
      const num = project.sensors.length + 1;
      dispatch({ type: 'ADD_SENSOR', sensor: { id, x: cp.x, y: cp.y, label: `S-${num}`, groupCount: 1, assignedGatewayId: null, rssi: null } });
      setSelectedId(id);
    }
  }, [tool, screenToCanvas, hitTest, panOffset, scaleP1, project, dispatch, setSelectedId, zoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: panOffsetStartRef.current.x + (e.clientX - panStartRef.current.x),
        y: panOffsetStartRef.current.y + (e.clientY - panStartRef.current.y),
      });
      return;
    }
    const cp = screenToCanvas(e.clientX, e.clientY);
    if (drawStart) {
      if (tool === 'draw-wall') {
        setDrawEnd(snap(cp, project));
      } else {
        setDrawEnd(cp);
      }
    }
    if (draggingId) {
      const gw = project.gateways.find(g => g.id === draggingId);
      if (gw) {
        dispatch({ type: 'UPDATE_GATEWAY', id: draggingId, changes: { x: cp.x - dragOffset.x, y: cp.y - dragOffset.y } });
      }
      const s = project.sensors.find(s => s.id === draggingId);
      if (s) {
        dispatch({ type: 'UPDATE_SENSOR', id: draggingId, changes: { x: cp.x - dragOffset.x, y: cp.y - dragOffset.y } });
      }
    }
    if (draggingWallEndpoint) {
      const wall = project.walls.find(w => w.id === draggingId);
      if (wall) {
        const dx = cp.x - wallDragStart!.x;
        const dy = cp.y - wallDragStart!.y;
        if (draggingWallEndpoint === 'start') {
          dispatch({ type: 'UPDATE_WALL', id: draggingId!, changes: { start: { x: wall.start.x + dx, y: wall.start.y + dy } } });
        } else if (draggingWallEndpoint === 'end') {
          dispatch({ type: 'UPDATE_WALL', id: draggingId!, changes: { end: { x: wall.end.x + dx, y: wall.end.y + dy } } });
        } else {
          dispatch({ type: 'UPDATE_WALL', id: draggingId!, changes: { start: { x: wall.start.x + dx, y: wall.start.y + dy }, end: { x: wall.end.x + dx, y: wall.end.y + dy } } });
        }
        setWallDragStart(cp);
      }
    }
  }, [isPanning, drawStart, draggingId, tool, screenToCanvas, project, dispatch, dragOffset, draggingWallEndpoint, wallDragStart]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isPanning) { setIsPanning(false); return; }
    if (drawStart && drawEnd) {
      if (tool === 'draw-wall') {
        const dx = drawEnd.x - drawStart.x;
        const dy = drawEnd.y - drawStart.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) {
          const id = genId();
          dispatch({ type: 'ADD_WALL', wall: { id, start: drawStart, end: drawEnd, material: wallMaterial } });
          setSelectedId(id);
        }
      } else if (tool === 'place-obstacle') {
        const x = Math.min(drawStart.x, drawEnd.x);
        const y = Math.min(drawStart.y, drawEnd.y);
        const w = Math.abs(drawEnd.x - drawStart.x);
        const h = Math.abs(drawEnd.y - drawStart.y);
        if (w > 5 && h > 5) {
          const id = genId();
          dispatch({ type: 'ADD_OBSTACLE', obstacle: { id, x, y, width: w, height: h, type: obstacleType } });
          setSelectedId(id);
        }
      }
    }
    setDrawStart(null);
    setDrawEnd(null);
    setDraggingId(null);
    setDraggingWallEndpoint(null);
    setWallDragStart(null);
  }, [isPanning, drawStart, drawEnd, tool, wallMaterial, obstacleType, dispatch, setSelectedId]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZoom = Math.max(0.1, Math.min(10, zoom * factor));
    setPanOffset({
      x: mx - (mx - panOffset.x) * (newZoom / zoom),
      y: my - (my - panOffset.y) * (newZoom / zoom),
    });
    setZoom(newZoom);
  }, [zoom, panOffset]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTool('select');
        setSelectedId(null);
        setScaleP1(null);
        setScaleP2(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') &&
          !(document.activeElement instanceof HTMLInputElement) &&
          !(document.activeElement instanceof HTMLSelectElement)) {
        if (selectedId) {
          const w = project.walls.find(w => w.id === selectedId);
          if (w) dispatch({ type: 'DELETE_WALL', id: w.id });
          const o = project.obstacles.find(o => o.id === selectedId);
          if (o) dispatch({ type: 'DELETE_OBSTACLE', id: o.id });
          const g = project.gateways.find(g => g.id === selectedId);
          if (g) dispatch({ type: 'DELETE_GATEWAY', id: g.id });
          const s = project.sensors.find(s => s.id === selectedId);
          if (s) dispatch({ type: 'DELETE_SENSOR', id: s.id });
          setSelectedId(null);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, project, dispatch, setSelectedId, setTool, undo, redo]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = isDark ? '#1a1a2e' : '#f0f0f0';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    // Grid
    const gridSize = 50;
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 0.5 / zoom;
    const startX = Math.floor(-panOffset.x / zoom / gridSize) * gridSize;
    const startY = Math.floor(-panOffset.y / zoom / gridSize) * gridSize;
    const endX = startX + w / zoom + gridSize;
    const endY = startY + h / zoom + gridSize;
    for (let x = startX; x < endX; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
    }
    for (let y = startY; y < endY; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
    }

    // Floor plan
    if (floorPlanImg) {
      ctx.save();
      if (isDark) { ctx.filter = 'invert(1) brightness(0.85)'; }
      ctx.globalAlpha = 0.85;
      ctx.drawImage(floorPlanImg, 0, 0);
      ctx.restore();
    }

    // Coverage heatmap (3-zone polygon approach)
    if (project.scale && project.gateways.length > 0) {
      const selectedGw = project.gateways.find(g => g.id === selectedId);
      const gwsToRender = selectedGw ? [selectedGw] : project.gateways;

      const strokePoly = (target: CanvasRenderingContext2D, poly: Point[], color: string, width: number) => {
        if (poly.length < 3) return;
        target.strokeStyle = color;
        target.lineWidth = width;
        target.beginPath();
        target.moveTo(poly[0].x, poly[0].y);
        for (let i = 1; i < poly.length; i++) target.lineTo(poly[i].x, poly[i].y);
        target.closePath();
        target.stroke();
      };

      const offscreen = document.createElement('canvas');
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const oc = offscreen.getContext('2d')!;
      oc.setTransform(dpr, 0, 0, dpr, 0, 0);
      oc.translate(panOffset.x, panOffset.y);
      oc.scale(zoom, zoom);

      for (const gw of gwsToRender) {
        const polyRed = getGatewayCoveragePolygon(gw, project.walls, project.doors, project.obstacles, project.scale, -85);
        const polyYellow = getGatewayCoveragePolygon(gw, project.walls, project.doors, project.obstacles, project.scale, -80);
        const polyGreen = getGatewayCoveragePolygon(gw, project.walls, project.doors, project.obstacles, project.scale, -70);

        const polyRadius = (poly: Point[]) => {
          let maxR = 0;
          for (const p of poly) {
            const r = Math.sqrt((p.x - gw.x) ** 2 + (p.y - gw.y) ** 2);
            if (r > maxR) maxR = r;
          }
          return maxR || 100;
        };

        const redR = polyRadius(polyRed);
        const yellowR = polyRadius(polyYellow);
        const greenR = polyRadius(polyGreen);

        if (polyRed.length >= 3) {
          const grad = oc.createRadialGradient(gw.x, gw.y, 0, gw.x, gw.y, redR);
          grad.addColorStop(0, 'rgba(220, 38, 38, 1)');
          grad.addColorStop(0.5, 'rgba(220, 38, 38, 0.7)');
          grad.addColorStop(1, 'rgba(220, 38, 38, 0.2)');
          oc.fillStyle = grad;
          oc.beginPath();
          oc.moveTo(polyRed[0].x, polyRed[0].y);
          for (let i = 1; i < polyRed.length; i++) oc.lineTo(polyRed[i].x, polyRed[i].y);
          oc.closePath();
          oc.fill();
        }

        if (polyYellow.length >= 3) {
          const grad = oc.createRadialGradient(gw.x, gw.y, 0, gw.x, gw.y, yellowR);
          grad.addColorStop(0, 'rgba(234, 179, 8, 1)');
          grad.addColorStop(0.5, 'rgba(234, 179, 8, 0.7)');
          grad.addColorStop(1, 'rgba(234, 179, 8, 0.2)');
          oc.fillStyle = grad;
          oc.beginPath();
          oc.moveTo(polyYellow[0].x, polyYellow[0].y);
          for (let i = 1; i < polyYellow.length; i++) oc.lineTo(polyYellow[i].x, polyYellow[i].y);
          oc.closePath();
          oc.fill();
        }

        if (polyGreen.length >= 3) {
          const grad = oc.createRadialGradient(gw.x, gw.y, 0, gw.x, gw.y, greenR);
          grad.addColorStop(0, 'rgba(22, 163, 74, 1)');
          grad.addColorStop(0.5, 'rgba(22, 163, 74, 0.7)');
          grad.addColorStop(1, 'rgba(22, 163, 74, 0.2)');
          oc.fillStyle = grad;
          oc.beginPath();
          oc.moveTo(polyGreen[0].x, polyGreen[0].y);
          for (let i = 1; i < polyGreen.length; i++) oc.lineTo(polyGreen[i].x, polyGreen[i].y);
          oc.closePath();
          oc.fill();
        }

        strokePoly(oc, polyYellow, '#000000', 2.5 / zoom);
        strokePoly(oc, polyGreen, '#000000', 2.5 / zoom);
      }

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.8;
      ctx.drawImage(offscreen, 0, 0);
      ctx.restore();
    }

    // Obstacles
    for (const obs of project.obstacles) {
      const cfg = OBSTACLE_TYPES[obs.type];
      ctx.fillStyle = cfg.color;
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
      ctx.setLineDash([]);
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
      ctx.font = `${11 / zoom}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(cfg.label, obs.x + obs.width / 2, obs.y + obs.height / 2 + 4 / zoom);
      if (obs.id === selectedId) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / zoom;
        ctx.strokeRect(obs.x - 2 / zoom, obs.y - 2 / zoom, obs.width + 4 / zoom, obs.height + 4 / zoom);
      }
    }

    // Walls
    for (const wall of project.walls) {
      const cfg = WALL_MATERIALS[wall.material];
      ctx.strokeStyle = isDark ? (cfg.color === '#1f2937' ? '#d1d5db' : cfg.color) : cfg.color;
      ctx.lineWidth = 4 / zoom;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(wall.start.x, wall.start.y);
      ctx.lineTo(wall.end.x, wall.end.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (wall.id === selectedId) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([4 / zoom, 3 / zoom]);
        ctx.beginPath();
        ctx.moveTo(wall.start.x, wall.start.y);
        ctx.lineTo(wall.end.x, wall.end.y);
        ctx.stroke();
        ctx.setLineDash([]);
        for (const ep of [wall.start, wall.end]) {
          ctx.fillStyle = '#3b82f6';
          ctx.beginPath();
          ctx.arc(ep.x, ep.y, 5 / zoom, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Sensor→gateway connection lines
    for (const s of project.sensors) {
      if (s.assignedGatewayId) {
        const gw = project.gateways.find(g => g.id === s.assignedGatewayId);
        if (gw) {
          const color = s.rssi !== null ? getRssiColor(s.rssi) : '#9ca3af';
          ctx.save();
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.7;
          ctx.lineWidth = 3 / zoom;
          ctx.setLineDash([6 / zoom, 4 / zoom]);
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(gw.x, gw.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }
    }

    // Ring radii — dashed concentric circles showing free-space coverage estimate
    // (T028) Drawn before gateway icons so icons appear on top.
    if (project.scale) {
      const radii = getRingRadii(project.scale);
      for (const gw of project.gateways) {
        // Good tier (−70 dBm) — green dashed
        ctx.save();
        ctx.strokeStyle = 'rgba(22, 163, 74, 0.55)';
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([6 / zoom, 5 / zoom]);
        ctx.beginPath();
        ctx.arc(gw.x, gw.y, radii.good, 0, Math.PI * 2);
        ctx.stroke();
        // Marginal tier (−80 dBm) — amber dashed
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.55)';
        ctx.beginPath();
        ctx.arc(gw.x, gw.y, radii.marginal, 0, Math.PI * 2);
        ctx.stroke();
        // Poor tier (−95 dBm) — red dashed
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.40)';
        ctx.setLineDash([4 / zoom, 6 / zoom]);
        ctx.beginPath();
        ctx.arc(gw.x, gw.y, radii.poor, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Gateways
    for (const gw of project.gateways) {
      const gwSize = 36 / zoom;
      if (gwImg) {
        const aspect = gwImg.width / gwImg.height;
        const imgW = gwSize * aspect;
        const imgH = gwSize;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 6 / zoom;
        ctx.shadowOffsetY = 2 / zoom;
        ctx.drawImage(gwImg, gw.x - imgW / 2, gw.y - imgH / 2, imgW, imgH);
        ctx.restore();
      } else {
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.arc(gw.x, gw.y, 14 / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2 / zoom;
        for (let i = 0; i < 3; i++) {
          const r = (20 + i * 8) / zoom;
          ctx.beginPath();
          ctx.arc(gw.x, gw.y - 6 / zoom, r, -Math.PI * 0.8, -Math.PI * 0.2);
          ctx.stroke();
        }
      }
      ctx.fillStyle = isDark ? '#e5e7eb' : '#1f2937';
      ctx.font = `${11 / zoom}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(gw.label, gw.x, gw.y + gwSize / 2 + 4 / zoom);
      const count = getGatewaySensorCount(gw.id, project.sensors);
      const atCapacity = count >= MAX_SENSORS_PER_GATEWAY;
      const badgeText = `${count}/${MAX_SENSORS_PER_GATEWAY}`;
      ctx.fillStyle = atCapacity ? '#ef4444' : '#6366f1';
      ctx.font = `bold ${9 / zoom}px sans-serif`;
      const bw = ctx.measureText(badgeText).width + 8 / zoom;
      ctx.beginPath();
      const bx = gw.x - bw / 2;
      const by = gw.y - gwSize / 2 - 16 / zoom;
      ctx.roundRect(bx, by, bw, 14 / zoom, 4 / zoom);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, gw.x, by + 7 / zoom);
      if (gw.id === selectedId) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / zoom;
        ctx.beginPath();
        ctx.arc(gw.x, gw.y, gwSize / 2 + 4 / zoom, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Sensors
    for (const s of project.sensors) {
      const color = s.rssi !== null ? getRssiColor(s.rssi) : '#9ca3af';
      const sSize = 22 / zoom;
      if (sensorImg) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 4 / zoom;
        ctx.shadowOffsetY = 1 / zoom;
        const aspect = sensorImg.width / sensorImg.height;
        const imgW = sSize * aspect;
        const imgH = sSize;
        ctx.drawImage(sensorImg, s.x - imgW / 2, s.y - imgH / 2, imgW, imgH);
        ctx.restore();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5 / zoom;
        ctx.beginPath();
        ctx.arc(s.x, s.y, sSize / 2 + 2 / zoom, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 7 / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isDark ? '#1a1a2e' : '#ffffff';
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();
      }
      if (s.groupCount > 1) {
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.arc(s.x + 8 / zoom, s.y - 8 / zoom, 7 / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${8 / zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(s.groupCount), s.x + 8 / zoom, s.y - 8 / zoom);
      }
      ctx.fillStyle = isDark ? '#e5e7eb' : '#1f2937';
      ctx.font = `${10 / zoom}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const rssiText = s.rssi !== null ? ` (${s.rssi.toFixed(0)} dBm)` : '';
      ctx.fillText(s.label + rssiText, s.x, s.y + 12 / zoom);
      if (s.id === selectedId) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2 / zoom;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 12 / zoom, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Drawing preview
    if (drawStart && drawEnd) {
      if (tool === 'draw-wall') {
        const cfg = WALL_MATERIALS[wallMaterial];
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = 4 / zoom;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(drawStart.x, drawStart.y);
        ctx.lineTo(drawEnd.x, drawEnd.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (tool === 'place-obstacle') {
        const cfg = OBSTACLE_TYPES[obstacleType];
        ctx.fillStyle = cfg.color;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(
          Math.min(drawStart.x, drawEnd.x), Math.min(drawStart.y, drawEnd.y),
          Math.abs(drawEnd.x - drawStart.x), Math.abs(drawEnd.y - drawStart.y),
        );
        ctx.globalAlpha = 1;
      }
    }

    // Scale reference line (current calibration in progress)
    if (scaleP1 && !showScaleDialog) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.beginPath();
      ctx.moveTo(scaleP1.x, scaleP1.y);
      if (scaleP2) ctx.lineTo(scaleP2.x, scaleP2.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(scaleP1.x, scaleP1.y, 4 / zoom, 0, Math.PI * 2); ctx.fill();
      if (scaleP2) { ctx.beginPath(); ctx.arc(scaleP2.x, scaleP2.y, 4 / zoom, 0, Math.PI * 2); ctx.fill(); }
    }
    // Saved scale reference
    if (project.scale) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(project.scale.p1.x, project.scale.p1.y);
      ctx.lineTo(project.scale.p2.x, project.scale.p2.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#f59e0b';
      ctx.font = `${10 / zoom}px sans-serif`;
      ctx.textAlign = 'center';
      const mx = (project.scale.p1.x + project.scale.p2.x) / 2;
      const my = (project.scale.p1.y + project.scale.p2.y) / 2;
      ctx.fillText(`${project.scale.distanceFeet.toFixed(1)} ft`, mx, my - 8 / zoom);
    }

    ctx.restore();

    // Mini-map
    const mmSize = 140;
    const mmPad = 10;
    const mmX = w - mmSize - mmPad;
    const mmY = h - mmSize - mmPad;
    ctx.fillStyle = isDark ? 'rgba(30,30,50,0.85)' : 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.fillRect(mmX, mmY, mmSize, mmSize);
    ctx.strokeRect(mmX, mmY, mmSize, mmSize);

    let minX = 0, minY = 0, maxX = 800, maxY = 600;
    if (floorPlanImg) { maxX = Math.max(maxX, floorPlanImg.width); maxY = Math.max(maxY, floorPlanImg.height); }
    for (const w2 of project.walls) {
      minX = Math.min(minX, w2.start.x, w2.end.x);
      minY = Math.min(minY, w2.start.y, w2.end.y);
      maxX = Math.max(maxX, w2.start.x, w2.end.x);
      maxY = Math.max(maxY, w2.start.y, w2.end.y);
    }
    for (const g of project.gateways) {
      minX = Math.min(minX, g.x); minY = Math.min(minY, g.y);
      maxX = Math.max(maxX, g.x); maxY = Math.max(maxY, g.y);
    }
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const mmScale = Math.min((mmSize - 10) / rangeX, (mmSize - 10) / rangeY);
    const toMM = (p: Point) => ({
      x: mmX + 5 + (p.x - minX) * mmScale,
      y: mmY + 5 + (p.y - minY) * mmScale,
    });
    ctx.strokeStyle = isDark ? '#aaa' : '#666';
    ctx.lineWidth = 1;
    for (const w2 of project.walls) {
      const a = toMM(w2.start), b = toMM(w2.end);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const g of project.gateways) {
      const p = toMM(g);
      ctx.fillStyle = '#6366f1';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    const vpLeft = -panOffset.x / zoom;
    const vpTop = -panOffset.y / zoom;
    const vpRight = vpLeft + w / zoom;
    const vpBottom = vpTop + h / zoom;
    const tl = toMM({ x: vpLeft, y: vpTop });
    const br = toMM({ x: vpRight, y: vpBottom });
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  }, [project, zoom, panOffset, isDark, floorPlanImg, selectedId, tool, wallMaterial,
      obstacleType, drawStart, drawEnd, scaleP1, scaleP2, showScaleDialog, gwImg, sensorImg]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => { setZoom(z => z); });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Scale submit with ft/m conversion (T017)
  const handleScaleSubmit = () => {
    const inputVal = parseFloat(scaleInput);
    if (inputVal > 0 && scaleP1 && scaleP2) {
      const distanceFeet = dialogUnit === 'm' ? inputVal / 0.3048 : inputVal;
      dispatch({ type: 'SET_SCALE', scale: { p1: scaleP1, p2: scaleP2, distanceFeet } });
      setScaleInputUnit(dialogUnit);
      setTool('select');
    }
    setShowScaleDialog(false);
    setScaleP1(null);
    setScaleP2(null);
    setScaleInput('');
  };

  const isEmpty = !project.floorPlanImage &&
    project.walls.length === 0 &&
    project.gateways.length === 0 &&
    project.sensors.length === 0;

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden"
      style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="RF coverage planning canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        className="block"
      />

      {/* Empty-state overlay */}
      {isEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
          <div className={`flex flex-col items-center gap-3 px-8 py-6 rounded-2xl ${isDark ? 'bg-gray-900/80 text-gray-300' : 'bg-white/80 text-gray-500'}`}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <rect x="4" y="8" width="40" height="32" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M4 20 h40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
              <path d="M4 30 h40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
              <path d="M16 8 v32" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
              <path d="M32 8 v32" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
            </svg>
            <p className="text-[14px] font-medium">Upload a floor plan to get started</p>
            <p className="text-[12px] text-center opacity-70">Use the Upload button in the toolbar,<br />or start drawing on the blank canvas.</p>
          </div>
        </div>
      )}

      {/* Scale-not-set hint (scale calibration needed) */}
      {!project.scale && !isEmpty && (
        <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-[12px] shadow-md pointer-events-none ${isDark ? 'bg-amber-900/80 text-amber-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
          Set scale to enable RF calculations
        </div>
      )}

      {/* RSSI Legend */}
      <div className={`absolute top-3 left-3 rounded-lg px-3 py-2 text-[11px] space-y-1 shadow-md ${isDark ? 'bg-gray-900/90 text-gray-200' : 'bg-white/95 text-gray-700'}`}>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Coverage Heatmap</div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#149632' }} />
          Green Zone (≥ -70 dBm)
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#e6c800' }} />
          Yellow Zone (-70 to -80)
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#dc3232' }} />
          Red Zone (&lt; -80 dBm)
        </div>
        <div className="border-t border-border mt-2 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Sensor Status</div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 border-green-500 inline-block" />
          Covered (≥ -70 dBm)
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 border-yellow-500 inline-block" />
          Marginal (-70 to -80)
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 border-red-500 inline-block" />
          Gap (&lt; -80 dBm)
        </div>
      </div>

      {/* Scale dialog (T017) */}
      {showScaleDialog && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-50">
          <div className={`rounded-xl shadow-xl p-6 w-80 ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
            <h3 className="font-semibold mb-3">Set Scale</h3>
            <p className="text-[13px] text-muted-foreground mb-4">
              Enter the real-world distance between the two points you clicked.
            </p>

            {/* Unit toggle (FR-003) */}
            <div className="flex gap-1 mb-3">
              <label className="sr-only">Unit</label>
              <button
                type="button"
                onClick={() => setDialogUnit('ft')}
                className={`flex-1 py-1.5 rounded-md text-[13px] transition-colors ${dialogUnit === 'ft' ? 'bg-blue-600 text-white' : 'bg-accent text-foreground hover:bg-accent/80'}`}
              >
                Feet (ft)
              </button>
              <button
                type="button"
                onClick={() => setDialogUnit('m')}
                className={`flex-1 py-1.5 rounded-md text-[13px] transition-colors ${dialogUnit === 'm' ? 'bg-blue-600 text-white' : 'bg-accent text-foreground hover:bg-accent/80'}`}
              >
                Metres (m)
              </button>
            </div>

            <label htmlFor="scale-distance-input" className="sr-only">
              Distance in {dialogUnit === 'ft' ? 'feet' : 'metres'}
            </label>
            <input
              id="scale-distance-input"
              type="number"
              min={0.1}
              step={0.1}
              value={scaleInput}
              onChange={e => setScaleInput(e.target.value)}
              placeholder={`Distance in ${dialogUnit === 'ft' ? 'feet' : 'metres'}`}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground mb-4"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleScaleSubmit()}
            />

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowScaleDialog(false);
                  setScaleP1(null);
                  setScaleP2(null);
                  setScaleInput('');
                }}
                className="px-4 py-2 rounded-md text-[13px] hover:bg-accent cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleScaleSubmit}
                className="px-4 py-2 rounded-md bg-blue-600 text-white text-[13px] hover:bg-blue-700 cursor-pointer"
              >
                Set Scale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

Canvas.displayName = 'Canvas';
