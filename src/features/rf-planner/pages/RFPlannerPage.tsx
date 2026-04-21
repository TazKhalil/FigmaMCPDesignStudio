import React, { useRef } from 'react';
import { Canvas, CanvasHandle } from '../components/Canvas';
import { Toolbar } from '../components/Toolbar';
import { PropertiesPanel } from '../components/PropertiesPanel';
import { StatusBar } from '../components/StatusBar';
import { useRFPlannerStore } from '@/stores/rf-planner.store';
import { useRfEngine } from '../hooks/useRfEngine';

/**
 * Route-level shell for the RF Coverage Planner.
 * Extracted from prototype src/app/App.tsx AppInner.
 * PropertiesPanel (Phase 4) and StatusBar (Phase 6) will be wired here.
 */
export default function RFPlannerPage() {
  const canvasRef = useRef<CanvasHandle>(null);
  const { project, isDark } = useRFPlannerStore();

  // Start the RF engine worker — subscribes to store and keeps coveragePolygons up to date
  useRfEngine();

  // Apply dark class to document root to drive Tailwind dark: variants
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

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
          <span className="text-[15px] tracking-tight">Perceptiv RF Coverage Planner</span>
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
      <div className="flex flex-1 overflow-hidden">
        <Canvas ref={canvasRef} />
        <PropertiesPanel />
      </div>

      {/* StatusBar */}
      <StatusBar projectName={project.name} />
    </div>
  );
}
