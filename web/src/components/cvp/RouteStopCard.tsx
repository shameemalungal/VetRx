// ==============================================================================
// VetRx Call & Visit Planner (CVP) — Route Stop Card (CVP-14, CVP-15)
// Mobile-first stop representation with locks, reordering, and timeline
// ==============================================================================

import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  ChevronUp,
  ChevronDown,
  Clock,
  Navigation,
  MapPin,
  Calendar,
  AlertTriangle,
  PawPrint,
  CheckCircle2,
  Edit2,
  Check,
} from 'lucide-react';
import type { RouteStop } from '../../types/cvp';

interface RouteStopCardProps {
  stop: RouteStop;
  index: number;
  totalStops: number;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onToggleLock?: () => void;
  onPostpone?: () => void;
  onOverrideDuration?: (newDuration: number) => void;
  isConfirmedPlan?: boolean;
}

export const RouteStopCard: React.FC<RouteStopCardProps> = ({
  stop,
  index,
  totalStops,
  onMoveUp,
  onMoveDown,
  onToggleLock,
  onPostpone,
  onOverrideDuration,
  isConfirmedPlan: _isConfirmedPlan,
}) => {
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [customDuration, setCustomDuration] = useState<string>(
    String(stop.durationMinutesOverride || stop.visit?.estimatedDurationMinutes || 30)
  );

  const visit = stop.visit;
  const isEmergency = visit?.priority === 'EMERGENCY';
  const isUrgent = visit?.priority === 'URGENT';
  const isLocked = stop.isLocked ?? false;

  // Format arrival and departure times
  const formatTime = (d?: Date | string | null) => {
    if (!d) return '--:--';
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    return dateObj.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleSaveDuration = () => {
    const parsed = parseInt(customDuration, 10);
    if (!isNaN(parsed) && parsed > 0 && onOverrideDuration) {
      onOverrideDuration(parsed);
    }
    setIsEditingDuration(false);
  };

  // Determine cases information
  const cases = visit?.cases || [];
  const animalCount = cases.length > 0 ? cases.length : 1;
  const patientSummary =
    cases.length > 0
      ? cases.map((c) => `${c.patientName || c.species || 'Animal'} (${c.procedureCategory || 'Case'})`).join(', ')
      : 'General Case';

  return (
    <div
      className={`relative rounded-2xl border transition-all duration-200 overflow-hidden ${
        isEmergency
          ? 'bg-red-50/40 border-red-300 shadow-sm shadow-red-100'
          : isLocked
          ? 'bg-amber-50/30 border-amber-300 shadow-sm'
          : 'bg-white border-slate-200 hover:border-teal-200 shadow-sm'
      }`}
      id={`route-stop-${stop.stopOrder}`}
    >
      {/* Transit Connector Tag from previous stop */}
      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
        <div className="flex items-center gap-1.5">
          <Navigation className="w-3 h-3 text-teal-600" />
          <span>
            Leg travel:{' '}
            <strong className="text-slate-700">
              ~{stop.transitMinutesFromPrevious || 20}m ({stop.distanceKmFromPrevious || 10} km)
            </strong>
          </span>
        </div>

        {stop.isApproximateLocation && (
          <span className="flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded text-[10px] border border-amber-200">
            <MapPin className="w-2.5 h-2.5" />
            Missing GPS (Approx)
          </span>
        )}
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          {/* Left: Stop Number & Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                isEmergency
                  ? 'bg-red-600 text-white'
                  : isLocked
                  ? 'bg-amber-500 text-white'
                  : 'bg-teal-700 text-white'
              }`}
            >
              #{stop.stopOrder}
            </span>

            {isEmergency ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-red-100 text-red-700 border border-red-300 animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                EMERGENCY
              </span>
            ) : isUrgent ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                <Clock className="w-3 h-3" />
                URGENT
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                PLANNED
              </span>
            )}

            {isLocked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <Lock className="w-2.5 h-2.5" />
                LOCKED
              </span>
            )}
          </div>

          {/* Right: Stop Sequence Controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={index === 0}
              onClick={onMoveUp}
              className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-600 transition-colors"
              title="Move Up"
              aria-label={`Move stop ${stop.stopOrder} up`}
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={index === totalStops - 1}
              onClick={onMoveDown}
              className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-600 transition-colors"
              title="Move Down"
              aria-label={`Move stop ${stop.stopOrder} down`}
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToggleLock}
              className={`p-1.5 rounded-lg border transition-all ${
                isLocked
                  ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-sm'
                  : 'border-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
              title={isLocked ? 'Unlock Stop (Allows auto re-ordering)' : 'Lock Stop (Keep in place)'}
              aria-label={isLocked ? 'Unlock stop position' : 'Lock stop position'}
            >
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Client & Visit Info */}
        <div className="mt-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              {visit?.ownerName || 'Client Name'}
            </h3>
            <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
              {visit?.ownerPhone || 'No Phone'}
            </span>
          </div>

          <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-1 font-medium">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{visit?.address || 'Address on file'}</span>
          </p>

          {/* Animal & Case Information */}
          <div className="mt-2 p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-700">
              <PawPrint className="w-3.5 h-3.5 text-teal-700 shrink-0" />
              <span className="font-semibold">
                {animalCount} {animalCount > 1 ? 'Animals' : 'Animal'}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 truncate max-w-[200px]">{patientSummary}</span>
            </div>
          </div>
        </div>

        {/* Timeline: ETA, Duration, ETD */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                ETA
              </span>
              <span className="font-mono font-bold text-slate-800 text-xs">
                {formatTime(stop.estimatedArrival)}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Duration
              </span>
              {isEditingDuration ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                    className="w-14 px-1 py-0.5 text-xs font-mono border rounded border-teal-500 text-slate-800"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveDuration}
                    className="p-1 rounded bg-teal-700 text-white hover:bg-teal-800"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingDuration(true)}
                  className="font-mono font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 group"
                  title="Click to override visit duration"
                >
                  <span>{stop.durationMinutesOverride || visit?.estimatedDurationMinutes || 30}m</span>
                  <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                ETD
              </span>
              <span className="font-mono font-bold text-slate-800 text-xs">
                {formatTime(stop.estimatedDeparture)}
              </span>
            </div>
          </div>

          {/* Postpone button */}
          {onPostpone && (
            <button
              type="button"
              onClick={onPostpone}
              className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition-colors flex items-center gap-1"
            >
              <Calendar className="w-3 h-3" />
              <span>Postpone</span>
            </button>
          )}
        </div>

        {/* Explainability Tag */}
        {stop.suggestedReason && (
          <div className="mt-2 text-[11px] text-slate-500 font-medium bg-slate-100/70 rounded-lg px-2 py-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-teal-600 shrink-0" />
            <span className="truncate">{stop.suggestedReason}</span>
          </div>
        )}
      </div>
    </div>
  );
};
