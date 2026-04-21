/**
 * StatusBar — T031
 *
 * Displays aggregate project status at the bottom of the RF Planner page.
 * Shows current tool mode, gateway count, sensor point count, good/marginal/poor
 * RSSI tier counts, scale calibration status, and project name.
 *
 * Extracted from RFPlannerPage.tsx inline StatusBar per the Phase 6 task plan.
 * Prototype source: src/app/App.tsx (StatusBar block in AppInner).
 */

import React from 'react';
import { useRFPlannerStore } from '@/stores/rf-planner.store';

interface StatusBarProps {
  projectName: string;
}

export function StatusBar({ projectName }: StatusBarProps) {
  const { project, tool } = useRFPlannerStore();

  const totalSensors = project.sensors.reduce((a, b) => a + b.groupCount, 0);
  const good      = project.sensors.filter(s => s.rssi !== null && s.rssi >= -70).length;
  const marginal  = project.sensors.filter(s => s.rssi !== null && s.rssi < -70 && s.rssi >= -80).length;
  const poor      = project.sensors.filter(s => s.rssi !== null && s.rssi < -80).length;

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
          <span className="text-green-500" aria-label={`${good} good signal sensors`}>{good} Good</span>
          <span className="text-yellow-500" aria-label={`${marginal} marginal signal sensors`}>{marginal} Marginal</span>
          <span className="text-red-500" aria-label={`${poor} poor signal sensors`}>{poor} Poor</span>
        </>
      )}

      <span>
        Scale:{' '}
        {project.scale
          ? <span className="text-green-500">set ({project.scale.distanceFeet.toFixed(1)} ft ref)</span>
          : <span className="text-amber-500">not set</span>
        }
      </span>

      <div className="flex-1" />
      <span>{projectName}</span>
    </div>
  );
}
