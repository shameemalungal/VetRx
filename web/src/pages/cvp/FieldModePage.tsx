import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { cvpService } from '../../services/cvpService';
import type { Visit, VisitStatus } from '../../types/cvp';
import {
  Compass,
  MapPin,
  Phone,
  Navigation,
  CheckCircle2,
  Clock,
  Play,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  Calendar,
  Stethoscope,
  Eye,
  ShieldCheck,
  Wifi,
  WifiOff,
  Briefcase,
} from 'lucide-react';
import './Cvp.css';

export const FieldModePage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedVisitId, setSelectedVisitId] = useState<string | number | null>(null);
  const [isRecordingArrival, setIsRecordingArrival] = useState(false);
  const [isStartingVisit, setIsStartingVisit] = useState(false);
  const [gpsStatusMessage, setGpsStatusMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize / sync today's visits on mount
  useEffect(() => {
    cvpService.getTodayVisits().catch((err) => {
      console.warn('Failed to load today visits:', err);
    });
  }, []);

  // Fetch all today's visits live from Dexie (read-only query)
  const visits: Visit[] = useLiveQuery(async () => {
    const all = await db.visits.toArray();
    return all.filter((v) => v.status !== 'CANCELLED' && v.status !== 'POSTPONED');
  }) || [];

  // Sort visits: Emergency first, then sequence order, then created
  const sortedVisits = [...visits].sort((a, b) => {
    if (a.priority === 'EMERGENCY' && b.priority !== 'EMERGENCY') return -1;
    if (b.priority === 'EMERGENCY' && a.priority !== 'EMERGENCY') return 1;
    return (a.sequenceOrder || 0) - (b.sequenceOrder || 0);
  });

  // Current active or next visit
  // Default to first visit that is not COMPLETED or CANCELLED
  const currentVisit =
    sortedVisits.find((v) => String(v.id) === String(selectedVisitId)) ||
    sortedVisits.find((v) => v.status === 'IN_PROGRESS' || v.status === 'ARRIVED') ||
    sortedVisits.find((v) => v.status !== 'COMPLETED' && v.status !== 'CANCELLED') ||
    sortedVisits[0] ||
    null;

  // Arrival Handler (CVP-20)
  const handleRecordArrival = async () => {
    if (!currentVisit?.id) return;
    setIsRecordingArrival(true);
    setGpsStatusMessage('Capturing location…');

    let locationData: { latitude?: number; longitude?: number; accuracy?: number } | undefined = undefined;

    if ('geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 30000,
          });
        });
        locationData = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setGpsStatusMessage(`GPS verified (±${Math.round(pos.coords.accuracy)}m)`);
      } catch (err: any) {
        // Geolocation failure is non-blocking
        console.warn('Geolocation capture failed or denied:', err);
        setGpsStatusMessage('Location permission bypassed. Arrival recorded.');
      }
    } else {
      setGpsStatusMessage('Device GPS unavailable. Arrival recorded.');
    }

    try {
      await cvpService.recordArrival(currentVisit.id, locationData);
    } catch (err) {
      console.error('Failed to record arrival:', err);
    } finally {
      setIsRecordingArrival(false);
    }
  };

  // Start Visit Handler (CVP-22)
  const handleStartVisit = async () => {
    if (!currentVisit?.id) return;
    setIsStartingVisit(true);
    try {
      await cvpService.startVisit(currentVisit.id);
      navigate(`/calls/visits/${currentVisit.id}`);
    } catch (err) {
      console.error('Failed to start visit:', err);
      setIsStartingVisit(false);
    }
  };

  // Open external Google Maps navigation handoff
  const handleOpenMaps = () => {
    if (!currentVisit) return;
    let mapUrl = '';
    if (currentVisit.latitude && currentVisit.longitude) {
      mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${currentVisit.latitude},${currentVisit.longitude}`;
    } else {
      mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(currentVisit.address)}`;
    }
    window.open(mapUrl, '_blank', 'noopener,noreferrer');
  };

  // Format status badge
  const renderStatusBadge = (status: VisitStatus) => {
    switch (status) {
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            IN PROGRESS
          </span>
        );
      case 'ARRIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <MapPin className="w-3.5 h-3.5 text-amber-600" />
            ARRIVED
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            COMPLETED
          </span>
        );
      case 'POSTPONED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
            <Clock className="w-3.5 h-3.5 text-purple-600" />
            POSTPONED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            SCHEDULED
          </span>
        );
    }
  };

  return (
    <div className="cvp-container max-w-3xl mx-auto px-3 sm:px-6 py-4 pb-28 font-sans text-slate-800">
      {/* Header Context Bar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700">
            <Compass className="w-4 h-4" />
            <span>Active Field Execution Mode</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Traveling & Stop Execution
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Online / Offline Sync State Indicator */}
          <div
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border ${
              isOnline
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
            title={isOnline ? 'Online — Authoritative Server Sync' : 'Offline — Connection to server required to commit records'}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden xs:inline">{isOnline ? 'Connected' : 'Offline'}</span>
          </div>

          <button
            type="button"
            onClick={() => navigate('/calls/today')}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-sm transition-all"
          >
            Dashboard
          </button>

          <button
            type="button"
            onClick={() => navigate('/inventory/bag')}
            className="px-3 py-1.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-xs font-bold text-teal-800 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            id="field-mode-btn-bag"
            title="Inspect field kit stock"
          >
            <Briefcase className="w-3.5 h-3.5 text-teal-700" />
            <span className="hidden sm:inline">Field Kits</span>
          </button>
        </div>
      </div>

      {/* Main Focus Card: Active / Next Visit */}
      {currentVisit ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden mb-6 transition-all">
          {/* Priority Header Strip */}
          <div
            className={`px-4 py-2.5 flex items-center justify-between text-xs font-extrabold ${
              currentVisit.priority === 'EMERGENCY'
                ? 'bg-red-600 text-white'
                : currentVisit.priority === 'URGENT'
                ? 'bg-amber-500 text-white'
                : 'bg-teal-700 text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              {currentVisit.priority === 'EMERGENCY' && <AlertTriangle className="w-4 h-4" />}
              <span>
                {currentVisit.priority === 'EMERGENCY'
                  ? 'EMERGENCY STOP'
                  : currentVisit.priority === 'URGENT'
                  ? 'URGENT STOP'
                  : 'SCHEDULED VISIT'}
              </span>
              {currentVisit.sequenceOrder != null && currentVisit.sequenceOrder > 0 && (
                <span className="bg-white/20 px-2 py-0.5 rounded-md text-[11px]">
                  Stop #{currentVisit.sequenceOrder}
                </span>
              )}
            </div>
            <div>{renderStatusBadge(currentVisit.status)}</div>
          </div>

          <div className="p-4 sm:p-6 space-y-5">
            {/* Owner & Contact */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <div className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                  Client & Location
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                  {currentVisit.ownerName || 'Unnamed Client'}
                </h2>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1 font-medium">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="break-words">{currentVisit.address}</span>
                </div>
              </div>

              {/* Action Dialer */}
              {currentVisit.ownerPhone && (
                <a
                  href={`tel:${currentVisit.ownerPhone}`}
                  className="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs border border-teal-200 shadow-sm transition-all min-h-[44px]"
                  aria-label={`Call client ${currentVisit.ownerPhone}`}
                >
                  <Phone className="w-4 h-4 text-teal-600" />
                  <span>Call {currentVisit.ownerPhone}</span>
                </a>
              )}
            </div>

            {/* Animals & Cases on this physical visit */}
            <div>
              <div className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-2">
                Patients / Animals at this Stop ({(currentVisit.cases || []).length || 1})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(currentVisit.cases && currentVisit.cases.length > 0 ? currentVisit.cases : [
                  {
                    chiefComplaint: currentVisit.notes || 'Routine checkup / consultation',
                    species: 'Bovine',
                    procedureCategory: 'GENERAL',
                  },
                ]).map((c, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-2.5"
                  >
                    <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 font-black text-xs">
                      #{idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 truncate">
                        {c.species || 'Animal'}
                        {c.patientId ? ` (ID: ${c.patientId})` : ''}
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium line-clamp-2 mt-0.5">
                        {c.chiefComplaint}
                      </div>
                      {c.procedureCategory && (
                        <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                          {c.procedureCategory}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* GPS verification banner if arrived */}
            {currentVisit.arrivalLatitude && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Arrival recorded at GPS ({currentVisit.arrivalLatitude.toFixed(4)},{' '}
                  {currentVisit.arrivalLongitude?.toFixed(4)})
                </span>
              </div>
            )}

            {/* GPS status / feedback message */}
            {gpsStatusMessage && (
              <div className="text-xs text-slate-500 font-medium italic animate-fade-in">
                {gpsStatusMessage}
              </div>
            )}

            {/* Action Bar (State-dependent) */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              {/* Navigation Button */}
              <button
                type="button"
                onClick={handleOpenMaps}
                className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 min-h-[44px]"
              >
                <Navigation className="w-4 h-4 text-teal-700" />
                <span>Launch Navigation</span>
              </button>

              {/* View Details Button */}
              <button
                type="button"
                onClick={() => navigate(`/calls/visits/${currentVisit.id}`)}
                className="py-3 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
              >
                <Eye className="w-4 h-4 text-slate-500" />
                <span>View Details</span>
              </button>

              {/* State Transition Actions */}
              {currentVisit.status !== 'ARRIVED' &&
                currentVisit.status !== 'IN_PROGRESS' &&
                currentVisit.status !== 'COMPLETED' && (
                  <button
                    type="button"
                    disabled={isRecordingArrival}
                    onClick={handleRecordArrival}
                    className="flex-1 py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black text-xs shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    {isRecordingArrival ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Recording Arrival…</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-4 h-4" />
                        <span>Record Arrival</span>
                      </>
                    )}
                  </button>
                )}

              {currentVisit.status === 'ARRIVED' && (
                <button
                  type="button"
                  disabled={isStartingVisit}
                  onClick={handleStartVisit}
                  className="flex-1 py-3 px-4 rounded-2xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-black text-xs shadow-md shadow-teal-700/20 transition-all flex items-center justify-center gap-2 min-h-[44px]"
                >
                  {isStartingVisit ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Starting Visit…</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Start Visit</span>
                    </>
                  )}
                </button>
              )}

              {currentVisit.status === 'IN_PROGRESS' && (
                <button
                  type="button"
                  onClick={() => navigate(`/calls/visits/${currentVisit.id}`)}
                  className="flex-1 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 min-h-[44px] animate-pulse"
                >
                  <Stethoscope className="w-4 h-4" />
                  <span>Active Consultation Room</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center shadow-sm mb-6">
          <CheckCircle2 className="w-12 h-12 text-teal-600 mx-auto mb-3" />
          <h2 className="text-lg font-black text-slate-800">No Pending Field Stops</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            All calls for today have been attended or none are currently scheduled.
          </p>
          <button
            type="button"
            onClick={() => navigate('/calls')}
            className="mt-4 px-4 py-2 rounded-xl bg-teal-700 text-white font-bold text-xs"
          >
            Review All Calls
          </button>
        </div>
      )}

      {/* Stop Switcher / Full Daily Route List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-teal-700" />
            Today&apos;s Field Itinerary ({sortedVisits.length} Stops)
          </h3>
          <button
            type="button"
            onClick={() => navigate('/calls/plan')}
            className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
          >
            <span>Edit Route Plan</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          {sortedVisits.map((v, index) => {
            const isSelected = String(v.id) === String(currentVisit?.id);
            return (
              <div
                key={v.id || index}
                onClick={() => setSelectedVisitId(v.id!)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-teal-50/80 border-teal-300 shadow-sm'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                      v.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : isSelected
                        ? 'bg-teal-700 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {v.status === 'COMPLETED' ? '✓' : index + 1}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {v.ownerName || 'Client'}
                      </span>
                      {v.priority === 'EMERGENCY' && (
                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-red-100 text-red-700">
                          EMERGENCY
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {v.address}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {renderStatusBadge(v.status)}
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
