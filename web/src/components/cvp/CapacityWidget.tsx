// ==============================================================================
// VetRx Call & Visit Planner — CapacityWidget Component (CVP-01)
// Displays daily allocated time, travel time, and capacity warning
// ==============================================================================

import React from 'react';
import type { CapacitySummary } from '../../types';

interface CapacityWidgetProps {
  summary: CapacitySummary;
  onPlanDay?: () => void;
}

export const CapacityWidget: React.FC<CapacityWidgetProps> = ({ summary, onPlanDay }) => {
  const percentUsed = Math.min(
    100,
    Math.round((summary.totalAllocatedMinutes / Math.max(1, summary.workingMinutesAvailable)) * 100)
  );

  const formatHours = (mins: number) => {
    const h = (mins / 60).toFixed(1);
    return `${h}h`;
  };

  return (
    <div className="cvp-capacity-card">
      <div className="cvp-capacity-header">
        <div className="cvp-capacity-title">
          <span>⏱️ Daily Capacity & Workload</span>
          {summary.isOverCapacity && (
            <span
              style={{
                fontSize: '0.6875rem',
                background: '#fef2f2',
                color: '#b91c1c',
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: 800,
                border: '1px solid #fecaca',
              }}
            >
              OVER CAPACITY (+{summary.overCapacityMinutes}m)
            </span>
          )}
        </div>
        <div className="cvp-capacity-metric">
          {formatHours(summary.totalAllocatedMinutes)} / {formatHours(summary.workingMinutesAvailable)}
        </div>
      </div>

      <div className="cvp-progress-track">
        <div
          className={`cvp-progress-fill ${summary.isOverCapacity ? 'over-capacity' : ''}`}
          style={{ width: `${percentUsed}%` }}
        />
      </div>

      <div className="cvp-capacity-footer">
        <span>
          Visits: {formatHours(summary.allocatedVisitMinutes)} • Travel est: {formatHours(summary.allocatedTravelMinutes)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>
            {summary.isOverCapacity
              ? 'Action required: Postpone low-priority cases'
              : `${formatHours(summary.remainingMinutes)} remaining buffer`}
          </span>
          {onPlanDay && (
            <button
              type="button"
              onClick={onPlanDay}
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: '#00685f',
                background: '#f0fdfa',
                border: '1px solid #ccfbf1',
                padding: '2px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Plan Route
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
