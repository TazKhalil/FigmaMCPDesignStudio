import React, { useRef } from 'react';
import { Canvas, CanvasHandle } from '../components/Canvas';
import { Toolbar } from '../components/Toolbar';
import { PropertiesPanel } from '../components/PropertiesPanel';
import { useRFPlannerStore } from '@/stores/rf-planner.store';

/**
 * Route-level shell for the RF Coverage Planner.
 * Extracted from prototype src/app/App.tsx AppInner.
 * PropertiesPanel (Phase 4) and StatusBar (Phase 6) will be wired here.
 */
export default function RFPlannerPage() {
  const canvasRef = useRef<CanvasHandle>(null);
  const { project, isDark } = useRFPlannerStore();

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

function StatusBar({ projectName }: { projectName: string }) {
  const { project, tool } = useRFPlannerStore();
  const totalSensors = project.sensors.reduce((a, b) => a + b.groupCount, 0);
  const good = project.sensors.filter(s => s.rssi !== null && s.rssi >= -70).length;
  const marginal = project.sensors.filter(
    s => s.rssi !== null && s.rssi < -70 && s.rssi >= -80
  ).length;
  const poor = project.sensors.filter(s => s.rssi !== null && s.rssi < -80).length;

  return (
    <div
      className="flex items-center gap-4 px-4 py-1 border-t border-border bg-card text-[11px] text-muted-foreground shrink-0"
      role="status"
      aria-live="polite"
      aria-label="Project status"
    >
      <span>Mode: <span className="text-foreground capitalize">{tool.replace('-', ' ')}</span></span>
      <span>Gateways: {project.gateways.length}</span>
      <span>Sensor Points: {project.sensors.length} ({totalSensors} total)</span>
      {project.sensors.length > 0 && (
        <>
          <span className="text-green-500">{good} Good</span>
          <span className="text-yellow-500">{marginal} Marginal</span>
          <span className="text-red-500">{poor} Poor</span>
        </>
      )}
      <span>Scale: {project.scale ? `${project.scale.distanceFeet.toFixed(1)} ft ref` : 'Not set'}</span>
      <div className="flex-1" />
      <span>{projectName}</span>
    </div>
  );
}
