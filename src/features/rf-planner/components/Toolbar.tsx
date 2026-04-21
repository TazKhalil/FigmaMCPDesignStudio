import React, { useRef } from 'react';
import {
  MousePointer2, Pen, Square, Radio, Disc, Ruler,
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Save, FolderOpen,
  Download, Sun, Moon, FileText, Image as ImageIcon,
} from 'lucide-react';
import { useRFPlannerStore } from '@/stores/rf-planner.store';
import { ToolMode, WallMaterial, ObstacleType, WALL_MATERIALS, OBSTACLE_TYPES } from '@/features/rf-planner/types';

interface ToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onExportPng: () => void;
  onExportCsv: () => void;
}

export function Toolbar({
  zoom, onZoomIn, onZoomOut, onFitToScreen, onExportPng, onExportCsv,
}: ToolbarProps) {
  const {
    tool, setTool, wallMaterial, setWallMaterial,
    obstacleType, setObstacleType,
    isDark, toggleDark, undo, redo, canUndo, canRedo,
    project, dispatch, setSelectedId,
  } = useRFPlannerStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadInputRef = useRef<HTMLInputElement>(null);

  const tools: { mode: ToolMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'select', icon: <MousePointer2 size={18} />, label: 'Select' },
    { mode: 'set-scale', icon: <Ruler size={18} />, label: 'Set Scale' },
    { mode: 'draw-wall', icon: <Pen size={18} />, label: 'Draw Wall' },
    { mode: 'place-obstacle', icon: <Square size={18} />, label: 'Obstacle' },
    { mode: 'place-gateway', icon: <Radio size={18} />, label: 'Gateway' },
    { mode: 'place-sensor', icon: <Disc size={18} />, label: 'Sensor' },
  ];

  const handleFloorPlanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
      try {
        // Use pdfjs-dist npm package (lazy-loaded to keep initial bundle small)
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).href;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const scale = 2;
        const viewport = page.getViewport({ scale });
        const offscreen = document.createElement('canvas');
        offscreen.width = viewport.width;
        offscreen.height = viewport.height;
        const ctx = offscreen.getContext('2d')!;
        await page.render({ canvas: offscreen, canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;
        const dataUrl = offscreen.toDataURL('image/png');
        dispatch({ type: 'SET_FLOOR_PLAN', image: dataUrl });
      } catch (err) {
        console.error('PDF rendering failed:', err);
        alert('Failed to render PDF. Please try an image file instead (PNG, JPG).');
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => dispatch({ type: 'SET_FLOOR_PLAN', image: reader.result as string });
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleSave = () => {
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const proj = JSON.parse(reader.result as string);
        dispatch({ type: 'SET_PROJECT', project: proj });
        setSelectedId(null);
      } catch {
        alert('Invalid project file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const btnClass = (active: boolean) =>
    `flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer text-[13px] ${
      active
        ? 'bg-blue-600 text-white'
        : 'hover:bg-black/5 dark:hover:bg-white/10 text-foreground'
    }`;

  const iconBtn =
    'p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-foreground cursor-pointer transition-colors';

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-card shrink-0 flex-wrap">
      {/* File ops */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,application/pdf"
        className="hidden"
        onChange={handleFloorPlanUpload}
        aria-hidden="true"
      />
      <input
        ref={loadInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleLoad}
        aria-hidden="true"
      />
      <button
        className={iconBtn}
        onClick={() => fileInputRef.current?.click()}
        aria-label="Upload floor plan (PNG, JPG, or PDF)"
        title="Upload Floor Plan"
      >
        <ImageIcon size={18} />
      </button>
      <button
        className={iconBtn}
        onClick={handleSave}
        aria-label="Save project as JSON"
        title="Save Project"
      >
        <Save size={18} />
      </button>
      <button
        className={iconBtn}
        onClick={() => loadInputRef.current?.click()}
        aria-label="Load project from JSON file"
        title="Load Project"
      >
        <FolderOpen size={18} />
      </button>

      <div className="w-px h-6 bg-border mx-1" aria-hidden="true" />

      {/* Undo / Redo */}
      <button
        className={iconBtn}
        onClick={undo}
        disabled={!canUndo}
        aria-label="Undo last action (Ctrl+Z)"
        title="Undo (Ctrl+Z)"
        style={{ opacity: canUndo ? 1 : 0.4 }}
      >
        <Undo2 size={18} />
      </button>
      <button
        className={iconBtn}
        onClick={redo}
        disabled={!canRedo}
        aria-label="Redo last undone action (Ctrl+Y)"
        title="Redo (Ctrl+Y)"
        style={{ opacity: canRedo ? 1 : 0.4 }}
      >
        <Redo2 size={18} />
      </button>

      <div className="w-px h-6 bg-border mx-1" aria-hidden="true" />

      {/* Tool picker */}
      {tools.map(t => (
        <button
          key={t.mode}
          className={btnClass(tool === t.mode)}
          onClick={() => setTool(t.mode)}
          aria-label={t.label}
          aria-pressed={tool === t.mode}
          title={t.label}
        >
          {t.icon}
          <span className="hidden lg:inline">{t.label}</span>
        </button>
      ))}

      {/* Sub-palettes */}
      {tool === 'draw-wall' && (
        <select
          value={wallMaterial}
          onChange={e => setWallMaterial(e.target.value as WallMaterial)}
          aria-label="Wall material"
          className="ml-2 px-2 py-1 rounded border border-border bg-card text-foreground text-[13px]"
        >
          {Object.entries(WALL_MATERIALS).map(([k, v]) => (
            <option key={k} value={k}>{v.label} ({v.attenuation} dB)</option>
          ))}
        </select>
      )}
      {tool === 'place-obstacle' && (
        <select
          value={obstacleType}
          onChange={e => setObstacleType(e.target.value as ObstacleType)}
          aria-label="Obstacle type"
          className="ml-2 px-2 py-1 rounded border border-border bg-card text-foreground text-[13px]"
        >
          {Object.entries(OBSTACLE_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v.label} ({v.attenuation} dB)</option>
          ))}
        </select>
      )}

      <div className="flex-1" />

      {/* Zoom */}
      <button
        className={iconBtn}
        onClick={onZoomOut}
        aria-label="Zoom out"
        title="Zoom Out"
      >
        <ZoomOut size={18} />
      </button>
      <span className="text-[12px] text-muted-foreground w-12 text-center" aria-live="polite" aria-label={`Zoom ${Math.round(zoom * 100)}%`}>
        {Math.round(zoom * 100)}%
      </span>
      <button
        className={iconBtn}
        onClick={onZoomIn}
        aria-label="Zoom in"
        title="Zoom In"
      >
        <ZoomIn size={18} />
      </button>
      <button
        className={iconBtn}
        onClick={onFitToScreen}
        aria-label="Fit canvas to screen"
        title="Fit to Screen"
      >
        <Maximize size={18} />
      </button>

      <div className="w-px h-6 bg-border mx-1" aria-hidden="true" />

      {/* Export */}
      <button
        className={iconBtn}
        onClick={onExportPng}
        aria-label="Export canvas as PNG image"
        title="Export PNG"
      >
        <Download size={18} />
      </button>
      <button
        className={iconBtn}
        onClick={onExportCsv}
        aria-label="Export bill of materials as CSV"
        title="Export BOM CSV"
      >
        <FileText size={18} />
      </button>

      <div className="w-px h-6 bg-border mx-1" aria-hidden="true" />

      {/* Theme */}
      <button
        className={iconBtn}
        onClick={toggleDark}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        title="Toggle Theme"
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  );
}
