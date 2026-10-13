// ==============================================================================
// VetRx Call & Visit Planner (CVP) — Plan Day & Route Preparation Page
// Implements CVP-12, CVP-13, CVP-14, CVP-15, CVP-16, CVP-17, CVP-18, CVP-48, CVP-49
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  ArrowLeft,
  Clock,
  Navigation,
  MapPin,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  SlidersHorizontal,
  Layers,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cvpService } from '../../services/cvpService';
import { CvpRouteEngine, type RouteEngineConfig } from '../../services/cvpRouteEngine';
import { RouteStopCard } from '../../components/cvp/RouteStopCard';
import { OverCapacityModal } from '../../components/cvp/OverCapacityModal';
import { WhatsAppHandoffModal } from '../../components/cvp/WhatsAppHandoffModal';
import { EmergencyInsertionModal } from '../../components/cvp/EmergencyInsertionModal';
import type {
  DailyPlan,
  RouteStop,
  Visit,
  Call,
  RouteCalculationResult,
  EmergencyProposal,
  ProcedureDurationEstimate,
  FollowUp,
} from '../../types/cvp';
import { durationLearningService } from '../../services/durationLearningService';
import { followUpService } from '../../services/followUpService';
import { useLiveQuery } from 'dexie-react-hooks';

export const PlanDayPage: React.FC = () => {
  const navigate = useNavigate();
  const { practice, user } = useAuth();

  const [planDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [_loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [confirmedPlan, setConfirmedPlan] = useState<DailyPlan | null>(null);

  // Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [startLocation, setStartLocation] = useState<string>(
    'VetRx Central Practice Clinic, Main Road'
  );
  const [startLat, setStartLat] = useState<number>(10.8505);
  const [startLon, setStartLon] = useState<number>(76.2711);
  const [startTime, setStartTime] = useState<string>('08:30');
  const [workingHoursTotal, setWorkingHoursTotal] = useState<number>(480); // 8 hrs
  const [breakMinutes, setBreakMinutes] = useState<number>(45);
  const [bufferMinutes, setBufferMinutes] = useState<number>(30);

  // Active planning state
  const [visits, setVisits] = useState<Visit[]>([]);
  const [currentStops, setCurrentStops] = useState<RouteStop[]>([]);
  const [routeMetrics, setRouteMetrics] = useState<RouteCalculationResult | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'route' | 'queue'>('route');

  // Modals state
  const [isOverCapacityModalOpen, setIsOverCapacityModalOpen] = useState<boolean>(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState<boolean>(false);
  const [postponeTargetVisit, setPostponeTargetVisit] = useState<Visit | null>(null);
  const [whatsAppTarget, setWhatsAppTarget] = useState<{
    visit: Visit;
    targetDate: string;
    reason: string;
  } | null>(null);
  const [emergencyProposal, setEmergencyProposal] = useState<EmergencyProposal | null>(null);
  const [durationEstimates, setDurationEstimates] = useState<ProcedureDurationEstimate[]>([]);

  // Query follow-ups due today (Phase 8)
  const dueFollowUps: FollowUp[] = useLiveQuery(async () => {
    const pId = practice?.id || 'demo-practice-id';
    return await followUpService.listFollowUps(pId, { tab: 'due_today' });
  }, [practice?.id]) || [];

  // Notification banners
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Load Today Visits and existing Daily Plan
  useEffect(() => {
    loadPlanningData();
  }, [planDate, practice?.id]);

  const loadPlanningData = async () => {
    try {
      setLoading(true);
      const pId = practice?.id || 'demo-practice-id';
      const ests = await durationLearningService.calculateEstimatesForPractice(pId);
      setDurationEstimates(ests);

      // 1. Load today visits (synthesizing from today calls if not already created)
      const todayVisits = await cvpService.getTodayVisits();
      setVisits(todayVisits);

      // 2. Load existing daily plan if available
      const existingPlan = await cvpService.getDailyPlan(planDate);
      if (existingPlan) {
        setConfirmedPlan(existingPlan.status === 'CONFIRMED' ? existingPlan : null);
        if (existingPlan.startLocationAddress) setStartLocation(existingPlan.startLocationAddress);
        if (existingPlan.startLatitude) setStartLat(existingPlan.startLatitude);
        if (existingPlan.startLongitude) setStartLon(existingPlan.startLongitude);
        if (existingPlan.startTime) setStartTime(existingPlan.startTime);
        if (existingPlan.workingMinutesAvailable) setWorkingHoursTotal(existingPlan.workingMinutesAvailable);
        if (existingPlan.breakMinutes) setBreakMinutes(existingPlan.breakMinutes);
        if (existingPlan.bufferMinutes) setBufferMinutes(existingPlan.bufferMinutes);

        if (existingPlan.stops && existingPlan.stops.length > 0) {
          // Enrich stops with live visit objects
          const visitMap = new Map<number | string, Visit>(todayVisits.map((v) => [v.id!, v]));
          const enriched = existingPlan.stops.map((s: RouteStop) => ({
            ...s,
            visit: visitMap.get(s.visitId) || s.visit,
          }));
          setCurrentStops(enriched);
          const metrics = CvpRouteEngine.recalculateTimeline(enriched, {
            startLocationAddress: existingPlan.startLocationAddress || startLocation,
            startLatitude: existingPlan.startLatitude ?? startLat,
            startLongitude: existingPlan.startLongitude ?? startLon,
            startTime: existingPlan.startTime || startTime,
            workingMinutesAvailable: existingPlan.workingMinutesAvailable || workingHoursTotal,
            breakMinutes: existingPlan.breakMinutes ?? breakMinutes,
            bufferMinutes: existingPlan.bufferMinutes ?? bufferMinutes,
          });
          setRouteMetrics(metrics);
          setLoading(false);
          return;
        }
      }

      // If no saved stops, generate suggested route
      generateRoute(todayVisits);
    } catch (err) {
      console.error('Failed to load daily planning data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEngineConfig = (): RouteEngineConfig => ({
    startLocationAddress: startLocation,
    startLatitude: startLat,
    startLongitude: startLon,
    startTime,
    workingMinutesAvailable: workingHoursTotal,
    breakMinutes,
    bufferMinutes,
    durationEstimates,
  });

  const generateRoute = (visitList: Visit[] = visits, existing: RouteStop[] = currentStops) => {
    const config = getEngineConfig();
    const result = CvpRouteEngine.generateSuggestedRoute(visitList, config, existing);
    setCurrentStops(result.stops);
    setRouteMetrics(result);
  };

  // Re-calculate timeline whenever config changes
  const applySettingsAndRecalculate = () => {
    setIsSettingsOpen(false);
    const config = getEngineConfig();
    const result = CvpRouteEngine.recalculateTimeline(currentStops, config);
    setCurrentStops(result.stops);
    setRouteMetrics(result);
    showToast('Planning settings applied & timeline recalculated');
  };

  // Move Stop Up
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...currentStops];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;

    const config = getEngineConfig();
    const result = CvpRouteEngine.recalculateTimeline(updated, config);
    setCurrentStops(result.stops);
    setRouteMetrics(result);
  };

  // Move Stop Down
  const handleMoveDown = (index: number) => {
    if (index >= currentStops.length - 1) return;
    const updated = [...currentStops];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;

    const config = getEngineConfig();
    const result = CvpRouteEngine.recalculateTimeline(updated, config);
    setCurrentStops(result.stops);
    setRouteMetrics(result);
  };

  // Lock / Unlock Stop
  const handleToggleLock = (stopId: string | number) => {
    const updated = currentStops.map((s) => {
      if (s.id === stopId || s.visitId === stopId) {
        return { ...s, isLocked: !s.isLocked };
      }
      return s;
    });
    setCurrentStops(updated);
    showToast('Stop position lock toggled');
  };

  // Duration override
  const handleOverrideDuration = (stopIndex: number, newMinutes: number) => {
    const updated = [...currentStops];
    updated[stopIndex].durationMinutesOverride = newMinutes;
    const config = getEngineConfig();
    const result = CvpRouteEngine.recalculateTimeline(updated, config);
    setCurrentStops(result.stops);
    setRouteMetrics(result);
    showToast(`Visit duration updated to ${newMinutes}m`);
  };

  // Postpone visit
  const handleConfirmPostpone = async (targetDate: string, reason: string) => {
    if (!postponeTargetVisit) return;
    try {
      await cvpService.postponeVisit(postponeTargetVisit.id!, targetDate, reason);

      // Remove from current stops & recalculate
      const remainingStops = currentStops.filter((s) => s.visitId !== postponeTargetVisit.id);
      const config = getEngineConfig();
      const result = CvpRouteEngine.recalculateTimeline(remainingStops, config);
      setCurrentStops(result.stops);
      setRouteMetrics(result);

      // Refresh visits list
      const updatedVisits = visits.filter((v) => v.id !== postponeTargetVisit.id);
      setVisits(updatedVisits);

      // Close postpone modal and prompt for WhatsApp handoff
      const postponedVisitCopy = postponeTargetVisit;
      setPostponeTargetVisit(null);
      setWhatsAppTarget({
        visit: postponedVisitCopy,
        targetDate,
        reason,
      });

      showToast(`Visit for ${postponedVisitCopy.ownerName} postponed to ${targetDate}`);
    } catch (err) {
      console.error('Failed to postpone visit:', err);
    }
  };

  // Final Plan Confirmation (CVP-48)
  const handleFinalConfirmPlan = async () => {
    try {
      setIsSaving(true);
      const planPayload: DailyPlan = {
        planDate,
        doctorUserId: user?.id,
        doctorName: user?.name || 'Dr. Anand Sharma',
        startLocationAddress: startLocation,
        startLatitude: startLat,
        startLongitude: startLon,
        startTime,
        totalEstimatedKm: routeMetrics?.totalEstimatedKm || 0,
        totalEstimatedTravelMinutes: routeMetrics?.totalEstimatedTravelMinutes || 0,
        totalEstimatedVisitMinutes: routeMetrics?.totalEstimatedVisitMinutes || 0,
        workingMinutesAvailable: workingHoursTotal,
        breakMinutes,
        bufferMinutes,
        isLocked: true,
        status: 'CONFIRMED',
        stops: currentStops,
      };

      const saved = await cvpService.confirmDailyPlan(planPayload);
      setConfirmedPlan(saved);
      setIsConfirmationModalOpen(false);
      showToast('Daily Plan Confirmed and Saved Successfully!');
    } catch (err) {
      console.error('Failed to confirm daily plan:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Simulate / Trigger New Emergency for CVP-49 Testing & Verification
  const handleSimulateEmergency = () => {
    const fakeEmergencyCall: Call = {
      id: `sim-emerg-${Date.now()}`,
      callerPhone: '+91 98470 55112',
      tempOwnerName: 'Kishore Varma',
      locationAddress: 'Varma Dairy Farm, Riverside Sector 4',
      latitude: 10.875,
      longitude: 76.295,
      species: 'Crossbred Jersey Cow',
      animalCount: 1,
      symptoms: 'Acute bloat and respiratory distress after feeding. Animal recumbent.',
      priority: 'EMERGENCY',
      flexibility: 'MUST_ATTEND_TODAY',
      status: 'LOGGED',
      createdAt: new Date(),
    };

    const config = getEngineConfig();
    const proposal = CvpRouteEngine.evaluateEmergencyInsertion(
      fakeEmergencyCall,
      currentStops,
      config
    );
    setEmergencyProposal(proposal);
  };

  // Accept emergency proposal
  const handleAcceptEmergencyProposal = () => {
    if (!emergencyProposal) return;
    setCurrentStops(emergencyProposal.proposedStops);
    const config = getEngineConfig();
    const result = CvpRouteEngine.recalculateTimeline(emergencyProposal.proposedStops, config);
    setRouteMetrics(result);
    setEmergencyProposal(null);
    showToast('Emergency inserted into route sequence!');
  };

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const formatHoursMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20">
      {/* Toast */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-teal-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-bounce border border-teal-700">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate('/calls/today')}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
              title="Back to Today's Dashboard"
              aria-label="Back to Today's Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-teal-700">
                <Compass className="w-3.5 h-3.5" />
                <span>Route Preparation</span>
              </div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                Daily Route & Capacity Planner
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {confirmedPlan ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                <Check className="w-3.5 h-3.5" />
                CONFIRMED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <Clock className="w-3.5 h-3.5" />
                DRAFT
              </span>
            )}

            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1"
              title="Planning Parameters"
              aria-label="Planning parameters and working hours settings"
            >
              <SlidersHorizontal className="w-4 h-4 text-teal-700" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-4 sm:py-5 space-y-4">
        {/* Settings Accordion Drawer (CVP-13 parameters) */}
        {isSettingsOpen && (
          <section
            className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-md space-y-4 animate-fade-in"
            aria-label="Route Planning Configuration"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-teal-700" />
                Doctor Working Capacity & Base Settings
              </h2>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Starting Base Location
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={startLocation}
                    onChange={(e) => setStartLocation(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 font-medium text-slate-800"
                    placeholder="Enter Clinic or Home Address"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Route Departure Time
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 truncate">
                    Working Hours
                  </label>
                  <select
                    value={workingHoursTotal}
                    onChange={(e) => setWorkingHoursTotal(parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 font-medium text-slate-800"
                  >
                    <option value={360}>6 Hours (360m)</option>
                    <option value={420}>7 Hours (420m)</option>
                    <option value={480}>8 Hours (480m)</option>
                    <option value={540}>9 Hours (540m)</option>
                    <option value={600}>10 Hours (600m)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1 truncate">
                    Lunch / Breaks
                  </label>
                  <select
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 font-medium text-slate-800"
                  >
                    <option value={0}>No Break</option>
                    <option value={30}>30 mins</option>
                    <option value={45}>45 mins</option>
                    <option value={60}>60 mins</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1 truncate">
                    Traffic Buffer
                  </label>
                  <select
                    value={bufferMinutes}
                    onChange={(e) => setBufferMinutes(parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 font-medium text-slate-800"
                  >
                    <option value={15}>15 mins</option>
                    <option value={30}>30 mins</option>
                    <option value={45}>45 mins</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={applySettingsAndRecalculate}
                className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-sm transition-all"
              >
                Apply & Recalculate Timeline
              </button>
            </div>
          </section>
        )}

        {/* Due Follow-ups Alert Banner (Phase 8) */}
        {dueFollowUps.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
                <Clock className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-amber-950 truncate">
                  {dueFollowUps.length} Clinical Follow-up(s) Due Today
                </div>
                <div className="text-[11px] text-amber-800/80 truncate">
                  Convert to planned visits or review in Follow-up Hub
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/calls/follow-ups?tab=due_today')}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 flex items-center gap-1 shadow-xs"
            >
              <span>View Follow-ups</span>
              <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>
        )}

        {/* Capacity Overview Bar (CVP-13, CVP-16) */}
        {routeMetrics && (
          <section
            className={`p-4 sm:p-5 rounded-3xl border shadow-sm transition-all ${
              routeMetrics.isOverCapacity
                ? 'bg-red-50/50 border-red-200'
                : 'bg-white border-slate-200'
            }`}
            aria-label="Working Capacity Summary"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Capacity Meter
                </span>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-slate-900 tracking-tight">
                    {formatHoursMins(routeMetrics.totalRequiredMinutes)} Required
                  </h2>
                  <span className="text-xs text-slate-500 font-medium">
                    of {formatHoursMins(routeMetrics.workingMinutesAvailable)} Available
                  </span>
                </div>
              </div>

              {routeMetrics.isOverCapacity ? (
                <button
                  type="button"
                  onClick={() => setIsOverCapacityModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-sm flex items-center gap-1.5 self-start animate-pulse"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>+{formatHoursMins(routeMetrics.overCapacityMinutes)} Over Capacity</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 self-start">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{formatHoursMins(routeMetrics.remainingMinutes)} Remaining Buffer</span>
                </div>
              )}
            </div>

            {/* Visual Capacity Bar */}
            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex">
              <div
                className="bg-teal-600 h-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    (routeMetrics.totalEstimatedVisitMinutes / routeMetrics.workingMinutesAvailable) * 100
                  )}%`,
                }}
                title={`Visit time: ${routeMetrics.totalEstimatedVisitMinutes}m`}
              />
              <div
                className="bg-sky-500 h-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    (routeMetrics.totalEstimatedTravelMinutes / routeMetrics.workingMinutesAvailable) * 100
                  )}%`,
                }}
                title={`Travel time: ${routeMetrics.totalEstimatedTravelMinutes}m`}
              />
              <div
                className="bg-amber-400 h-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    (routeMetrics.bufferMinutes / routeMetrics.workingMinutesAvailable) * 100
                  )}%`,
                }}
                title={`Buffer time: ${routeMetrics.bufferMinutes}m`}
              />
              {routeMetrics.isOverCapacity && (
                <div
                  className="bg-red-600 h-full animate-pulse"
                  style={{ width: '10%' }}
                  title="Over capacity"
                />
              )}
            </div>

            {/* Sub-metrics strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Distance</span>
                <span className="font-mono font-bold text-slate-800">
                  ~{routeMetrics.totalEstimatedKm} km
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Travel Transit</span>
                <span className="font-mono font-bold text-sky-700">
                  ~{formatHoursMins(routeMetrics.totalEstimatedTravelMinutes)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Clinical Time</span>
                <span className="font-mono font-bold text-teal-800">
                  {formatHoursMins(routeMetrics.totalEstimatedVisitMinutes)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Planned Stops</span>
                <span className="font-mono font-bold text-slate-800">
                  {currentStops.length} Destinations
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Action Toolbar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Tabs */}
          <div className="flex items-center p-1 rounded-2xl bg-slate-200/70 border border-slate-300/50">
            <button
              type="button"
              onClick={() => setActiveTab('route')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                activeTab === 'route'
                  ? 'bg-white text-teal-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Navigation className="w-3.5 h-3.5 text-teal-700" />
              <span>Suggested Route ({currentStops.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                activeTab === 'queue'
                  ? 'bg-white text-teal-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-teal-700" />
              <span>Today&apos;s Queue ({visits.length})</span>
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {/* Simulate emergency button for CVP-49 verification */}
            <button
              type="button"
              onClick={handleSimulateEmergency}
              className="px-2.5 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-black transition-all flex items-center gap-1 shadow-xs"
              title="Simulate incoming emergency to test re-routing"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
              <span className="hidden sm:inline">Simulate</span> Emergency
            </button>

            {/* Regenerate Route Button */}
            <button
              type="button"
              onClick={() => generateRoute()}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
              title="Regenerate Route (preserves locked stops)"
            >
              <RefreshCw className="w-3.5 h-3.5 text-teal-700" />
              <span>Regenerate</span>
            </button>

            {/* Field Mode Launcher (CVP-19) */}
            <button
              type="button"
              onClick={() => navigate('/calls/field')}
              className="px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-900 font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs"
              title="Launch Field Execution Mode"
            >
              <Compass className="w-3.5 h-3.5 text-teal-700" />
              <span>Field Mode</span>
            </button>

            {/* Final Confirmation Button (CVP-48) */}
            <button
              type="button"
              onClick={() => setIsConfirmationModalOpen(true)}
              disabled={currentStops.length === 0}
              className="px-4 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-black text-xs shadow-md shadow-teal-700/20 transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Confirm Daily Plan</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Route Stops List (CVP-14, CVP-15) */}
        {activeTab === 'route' && (
          <div className="space-y-3">
            {currentStops.length === 0 ? (
              <div className="p-8 rounded-3xl bg-white border border-dashed border-slate-300 text-center space-y-2">
                <Compass className="w-8 h-8 text-slate-300 mx-auto" />
                <h3 className="text-sm font-black text-slate-700">No Visits in Today&apos;s Route</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  There are no scheduled visits for today yet. Use the Call Intake or Quick Actions to log a call.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/calls/register')}
                  className="mt-2 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-sm"
                >
                  Register New Call
                </button>
              </div>
            ) : (
              currentStops.map((stop, index) => (
                <RouteStopCard
                  key={stop.id || stop.visitId}
                  stop={stop}
                  index={index}
                  totalStops={currentStops.length}
                  onMoveUp={() => handleMoveUp(index)}
                  onMoveDown={() => handleMoveDown(index)}
                  onToggleLock={() => handleToggleLock(stop.id || stop.visitId)}
                  onOverrideDuration={(newDuration) => handleOverrideDuration(index, newDuration)}
                  onPostpone={() => setPostponeTargetVisit(stop.visit || null)}
                  isConfirmedPlan={confirmedPlan != null}
                />
              ))
            )}
          </div>
        )}

        {/* Tab 2: Queue Overview (CVP-12) */}
        {activeTab === 'queue' && (
          <div className="space-y-2.5">
            {visits.map((v) => {
              const isEmerg = v.priority === 'EMERGENCY';
              const isUrg = v.priority === 'URGENT';
              const animalCount = v.cases?.length || 1;

              return (
                <div
                  key={v.id}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-slate-900 truncate">
                        {v.ownerName}
                      </span>
                      {isEmerg ? (
                        <span className="text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
                          EMERGENCY
                        </span>
                      ) : isUrg ? (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                          URGENT
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold bg-teal-50 text-teal-800 px-2 py-0.5 rounded-full border border-teal-100">
                          PLANNED
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 mt-0.5 truncate">{v.address}</p>

                    <div className="flex items-center gap-2 text-[11px] text-slate-600 mt-1 font-medium">
                      <span>{animalCount} Animals</span>
                      <span>•</span>
                      <span>{v.estimatedDurationMinutes || 30} mins est</span>
                      <span>•</span>
                      <span className="text-slate-400">{v.flexibility}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPostponeTargetVisit(v)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold shrink-0"
                  >
                    Postpone
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* CVP-16: Over Capacity Modal */}
      {routeMetrics && (
        <OverCapacityModal
          isOpen={isOverCapacityModalOpen}
          onClose={() => setIsOverCapacityModalOpen(false)}
          availableMinutes={routeMetrics.workingMinutesAvailable}
          requiredMinutes={routeMetrics.totalRequiredMinutes}
          overCapacityMinutes={routeMetrics.overCapacityMinutes}
          postponableCandidates={routeMetrics.postponableCandidates}
          onSelectPostpone={(v) => {
            setIsOverCapacityModalOpen(false);
            setPostponeTargetVisit(v);
          }}
          onAcceptException={() => {
            setIsOverCapacityModalOpen(false);
            showToast('Overtime exception approved by Doctor');
          }}
        />
      )}

      {/* CVP-17: Postpone Modal (Custom inline dialog) */}
      {postponeTargetVisit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                Postpone Visit
              </h2>
              <button
                type="button"
                onClick={() => setPostponeTargetVisit(null)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-600">
                Reschedule visit for{' '}
                <strong className="text-slate-900">{postponeTargetVisit.ownerName}</strong> at{' '}
                {postponeTargetVisit.address}:
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <label className="font-bold text-slate-700 block">Select Target Date:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    handleConfirmPostpone(d.toISOString().split('T')[0], 'Postponed to Tomorrow');
                  }}
                  className="p-2.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-900 font-bold text-center"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 2);
                    handleConfirmPostpone(d.toISOString().split('T')[0], 'Postponed in 2 Days');
                  }}
                  className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold text-center"
                >
                  In 2 Days
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 3);
                    handleConfirmPostpone(d.toISOString().split('T')[0], 'Next Route Window');
                  }}
                  className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold text-center"
                >
                  Next Available Route
                </button>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleConfirmPostpone(e.target.value, 'Doctor Specific Date Selection');
                    }
                  }}
                  className="p-2 rounded-xl border border-slate-300 font-mono text-center"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CVP-18: WhatsApp Notification Modal */}
      {whatsAppTarget && (
        <WhatsAppHandoffModal
          isOpen={true}
          onClose={() => setWhatsAppTarget(null)}
          visit={whatsAppTarget.visit}
          newScheduledDate={whatsAppTarget.targetDate}
          postponementReason={whatsAppTarget.reason}
          doctorName={user?.name || 'Dr. Anand Sharma'}
          practiceName={practice?.name || 'VetRx Practice'}
        />
      )}

      {/* CVP-49: Emergency Insertion Modal */}
      {emergencyProposal && (
        <EmergencyInsertionModal
          isOpen={true}
          onClose={() => setEmergencyProposal(null)}
          proposal={emergencyProposal}
          onAcceptProposal={handleAcceptEmergencyProposal}
          onManualAdjust={() => {
            setCurrentStops(emergencyProposal.proposedStops);
            setEmergencyProposal(null);
            showToast('Emergency placed in timeline. Adjust stops as needed.');
          }}
        />
      )}

      {/* CVP-48: Final Plan Confirmation Dialog */}
      {isConfirmationModalOpen && routeMetrics && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-plan-title"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-teal-200 max-w-lg w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-teal-700">
                    Final Confirmation
                  </div>
                  <h2 id="confirm-plan-title" className="text-base font-black text-slate-900">
                    Confirm Today&apos;s Daily Plan
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmationModalOpen(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Back
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Review your final route before locking. The confirmed plan will guide your field round sequence today.
            </p>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Ordered Stops:</span>
                <strong className="text-slate-800">{currentStops.length} Destinations</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Route Distance:</span>
                <strong className="text-slate-800 font-mono">~{routeMetrics.totalEstimatedKm} km</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Est. Total Travel:</span>
                <strong className="text-slate-800 font-mono">
                  {formatHoursMins(routeMetrics.totalEstimatedTravelMinutes)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Est. Clinical Time:</span>
                <strong className="text-slate-800 font-mono">
                  {formatHoursMins(routeMetrics.totalEstimatedVisitMinutes)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Traffic Buffer:</span>
                <strong className="text-slate-800 font-mono">{routeMetrics.bufferMinutes}m</strong>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-700">Remaining Working Capacity:</span>
                <strong
                  className={`font-mono font-black ${
                    routeMetrics.isOverCapacity ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  {routeMetrics.isOverCapacity
                    ? `Over by ${formatHoursMins(routeMetrics.overCapacityMinutes)}`
                    : formatHoursMins(routeMetrics.remainingMinutes)}
                </strong>
              </div>
            </div>

            {routeMetrics.isOverCapacity && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Notice: This plan currently exceeds standard working capacity. Confirming this will record an intentional doctor overtime exception.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmationModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold"
              >
                Return to Route Adjustments
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleFinalConfirmPlan}
                className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-black shadow-md shadow-teal-700/20 transition-all flex items-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Plan...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm & Lock Plan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
