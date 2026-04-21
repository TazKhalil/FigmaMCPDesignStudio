import React, { useRef, useState, useCallback } from 'react';
import { Canvas, CanvasHandle } from '../components/Canvas';
import { Toolbar } from '../components/Toolbar';
import { PropertiesPanel } from '../components/PropertiesPanel';
import { StatusBar } from '../components/StatusBar';
import { useRFPlannerStore } from '@/stores/rf-planner.store';
import { useRfEngine } from '../hooks/useRfEngine';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/**
 * Route-level shell for the RF Coverage Planner.
 * Extracted from prototype src/app/App.tsx AppInner.
 */
export default function RFPlannerPage() {
  const canvasRef = useRef<CanvasHandle>(null);
  const { project, isDark, dispatch } = useRFPlannerStore();

  // Start the RF engine worker — subscribes to store and keeps coveragePolygons up to date
  useRfEngine();

  // Apply dark class to document root to drive Tailwind dark: variants
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // T043: editable project name state
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const startEdit = useCallback(() => {
    setNameInput(project.name);
    setEditingName(true);
  }, [project.name]);

  const commitName = useCallback(() => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== project.name) {
      dispatch({ type: 'SET_NAME', name: trimmed });
    }
    setEditingName(false);
  }, [nameInput, project.name, dispatch]);

  const handleNameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.currentTarget.blur(); }
    if (e.key === 'Escape') { setEditingName(false); }
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 py-2 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center text-white text-[11px]"
            aria-hidden="true"
          >
            P
          </div>
          <span className="text-[13px] text-muted-foreground tracking-tight select-none">Perceptiv</span>
          <span className="text-muted-foreground select-none" aria-hidden="true">/</span>
          {/* T043: click-to-edit project name */}
          {editingName ? (
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={handleNameKeyDown}
              aria-label="Project name"
              autoFocus
              className="text-[15px] tracking-tight bg-transparent border-b border-indigo-500 outline-none text-foreground min-w-0 w-48"
            />
          ) : (
            <button
              onClick={startEdit}
              aria-label={`Project name: ${project.name}. Click to rename.`}
              title="Click to rename project"
              className="text-[15px] tracking-tight text-foreground hover:text-indigo-500 transition-colors bg-transparent border-none cursor-pointer p-0"
            >
              {project.name}
            </button>
          )}
        </div>
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground">v1.0</span>
      </div>

      {/* Toolbar */}
      <Toolbar
        zoom={canvasRef.current?.getZoom?.() ?? 1}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onFitToScreen={() => canvasRef.current?.fitToScreen()}
        onExportPng={() => canvasRef.current?.exportPng()}
        onExportCsv={() => canvasRef.current?.exportCsv()}
      />

      {/* Main area */}
      {/* T042: ErrorBoundary wraps Canvas specifically so a canvas crash doesn't kill the full UI */}
      <div className="flex flex-1 overflow-hidden">
        <ErrorBoundary label="Canvas">
          <Canvas ref={canvasRef} />
        </ErrorBoundary>
        <PropertiesPanel />
      </div>

      {/* StatusBar */}
      <StatusBar projectName={project.name} />
    </div>
  );
}
