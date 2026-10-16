import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { useAuth } from '../../context/AuthContext';
import { cvpService } from '../../services/cvpService';
import type { Call, Visit } from '../../types/cvp';
import { CallCard } from '../../components/cvp/CallCard';
import { PostponeModal } from '../../components/cvp/PostponeModal';
import { QuickActionLauncher } from '../../components/cvp/QuickActionLauncher';
import { CvpGlobalSearchModal } from '../../components/cvp/CvpGlobalSearchModal';
import {
  Calendar,
  AlertTriangle,
  Clock,
  Navigation,
  Search,
  Plus,
  ArrowRight,
  ListFilter,
  CheckCircle2,
  CalendarClock,
  Compass,
  DollarSign,
  Pill,
  PawPrint,
  RefreshCw,
  Wifi,
  WifiOff,
  Activity,
} from 'lucide-react';
import './Cvp.css';

export const TodayDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { practice } = useAuth();
  const practiceId = practice?.id || 'demo-practice-id';

  // ── Reactive Live Queries from Dexie ─────────────────────────
  const allCalls: Call[] = useLiveQuery(
    async () => {
      return (await db.calls.toArray()) as Call[];
    },
    [practiceId]
  ) || [];

  const allVisits: Visit[] = useLiveQuery(
    async () => {
      return (await db.visits.toArray()) as Visit[];
    },
    [practiceId]
  ) || [];

  const allVisitCases = useLiveQuery(async () => db.visitCases.toArray(), []) || [];
  const allMedicineUsages = useLiveQuery(async () => db.visitMedicineUsages.toArray(), []) || [];
  const allInvoices = useLiveQuery(async () => db.invoices.toArray(), [practiceId]) || [];
  const allPrescriptions = useLiveQuery(async () => db.prescriptions.toArray(), [practiceId]) || [];
  const allPrescriptionItems = useLiveQuery(async () => db.prescriptionItems.toArray(), []) || [];
  const allProcedures = useLiveQuery(async () => db.visitProcedures.toArray(), []) || [];

  const [postponeModalCall, setPostponeModalCall] = useState<Call | null>(null);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

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

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // ── 1. Workload Categorization ──────────────────────────────
  const todayCalls = useMemo(() => {
    return allCalls.filter((c: Call) => {
      if (c.status === 'CANCELLED') return false;
      if (c.flexibility === 'MUST_ATTEND_TODAY' || c.priority === 'EMERGENCY') return true;
      if (c.preferredDate) {
        const dStr = typeof c.preferredDate === 'string'
          ? c.preferredDate.split('T')[0]
          : c.preferredDate.toISOString().split('T')[0];
        return dStr === todayStr;
      }
      return c.status === 'LOGGED';
    });
  }, [allCalls, todayStr]);

  const postponedCalls = useMemo(() => {
    return allCalls.filter(
      (c: Call) => Boolean(c.status === 'SCHEDULED' && c.preferredDate && c.preferredDate > todayStr)
    );
  }, [allCalls, todayStr]);

  const upcomingCalls = useMemo(() => {
    return allCalls.filter(
      (c: Call) => Boolean(c.status === 'LOGGED' && c.preferredDate && c.preferredDate > todayStr)
    );
  }, [allCalls, todayStr]);

  // Today triage buckets
  const emergencyCalls = useMemo(() => todayCalls.filter((c: Call) => c.priority === 'EMERGENCY'), [todayCalls]);
  const urgentCalls = useMemo(() => todayCalls.filter((c: Call) => c.priority === 'URGENT'), [todayCalls]);
  const couldNotAssessCalls = useMemo(() => todayCalls.filter((c: Call) => c.priority === 'COULD_NOT_ASSESS'), [todayCalls]);
  const plannedCalls = useMemo(() => todayCalls.filter((c: Call) => c.priority === 'PLANNED'), [todayCalls]);
  const otherAwaitingCalls = useMemo(() => todayCalls.filter((c: Call) => c.priority === 'COULD_NOT_ASSESS' || (c.status === 'LOGGED' && c.priority !== 'EMERGENCY' && c.priority !== 'URGENT')), [todayCalls]);

  // Visits for today
  const todayVisits = useMemo(() => {
    return allVisits.filter((v: Visit) => {
      if (v.status === 'CANCELLED') return false;
      if (v.scheduledDate) {
        const dStr = typeof v.scheduledDate === 'string'
          ? v.scheduledDate.split('T')[0]
          : (v.scheduledDate instanceof Date ? v.scheduledDate.toISOString().split('T')[0] : '');
        if (dStr === todayStr) return true;
      }
      if (v.createdAt) {
        const cStr = typeof v.createdAt === 'string'
          ? v.createdAt.split('T')[0]
          : (v.createdAt instanceof Date ? v.createdAt.toISOString().split('T')[0] : '');
        if (cStr === todayStr) return true;
      }
      return false;
    });
  }, [allVisits, todayStr]);

  const completedVisits = useMemo(() => todayVisits.filter((v: Visit) => v.status === 'COMPLETED'), [todayVisits]);
  const remainingVisits = useMemo(() => todayVisits.filter((v: Visit) => v.status !== 'COMPLETED'), [todayVisits]);
  const activeOrEnRouteVisit = useMemo(() => todayVisits.find((v: Visit) => v.status === 'IN_PROGRESS' || v.status === 'EN_ROUTE'), [todayVisits]);

  // Distinct animals, locations & scheduled stops
  const distinctMetrics = useMemo(() => {
    const animalSet = new Set<string>();
    const locationSet = new Set<string>();

    // From visits
    for (const v of todayVisits) {
      if (v.address) locationSet.add(v.address.trim().toLowerCase());
      else if (v.locationId) locationSet.add(`loc-${v.locationId}`);
      else if (v.ownerName) locationSet.add(`owner-${v.ownerName.trim().toLowerCase()}`);

      // From visit cases
      const casesForVisit = allVisitCases.filter((c) => String(c.visitId) === String(v.id));
      for (const c of casesForVisit) {
        if (c.patientId) animalSet.add(`p-${c.patientId}`);
        else if (c.patientName) animalSet.add(`name-${c.patientName.trim().toLowerCase()}`);
      }
    }

    // From today's calls
    for (const c of todayCalls) {
      if (c.locationAddress) locationSet.add(c.locationAddress.trim().toLowerCase());
      else if (c.tempOwnerName) locationSet.add(`owner-${c.tempOwnerName.trim().toLowerCase()}`);

      if (c.patientIds && c.patientIds.length > 0) {
        for (const pid of c.patientIds) animalSet.add(`p-${pid}`);
      } else if (c.tempPatientName) {
        animalSet.add(`name-${c.tempPatientName.trim().toLowerCase()}`);
      }
    }

    const distinctAnimals = animalSet.size || (todayCalls.length ? todayCalls.length : todayVisits.length);
    const distinctLocations = locationSet.size || (todayCalls.length ? todayCalls.length : todayVisits.length);
    const distinctStops = distinctLocations; // Avoid double-counting multiple animals at the same farm

    return {
      distinctAnimals,
      distinctLocations,
      distinctStops,
      totalCases: todayCalls.length + allVisitCases.filter((c) => todayVisits.some((v) => String(v.id) === String(c.visitId))).length,
    };
  }, [todayVisits, todayCalls, allVisitCases]);

  // ── 2. Time & Capacity Calculations ──────────────────────────
  const timeMetrics = useMemo(() => {
    const availableWorkingMinutes = 480; // 8.0 hours standard working day

    // Elapsed field time from completed visits and active visit
    let elapsedMinutes = 0;
    for (const cv of completedVisits) {
      elapsedMinutes += Number(cv.actualDurationMinutes) || 30;
    }
    if (activeOrEnRouteVisit && activeOrEnRouteVisit.visitStartedAt) {
      const startMs = new Date(activeOrEnRouteVisit.visitStartedAt).getTime();
      const currentMs = Date.now();
      const diffMins = Math.max(0, Math.round((currentMs - startMs) / 60000));
      elapsedMinutes += Math.min(180, diffMins); // cap active duration estimate
    }

    // Remaining visit duration
    let remainingVisitDuration = 0;
    for (const rv of remainingVisits) {
      remainingVisitDuration += Number(rv.estimatedDurationMinutes) || (rv.priority === 'EMERGENCY' ? 45 : 30);
    }
    // If fewer visits than remaining calls, add remaining unvisited calls
    const unvisitedCallsCount = Math.max(0, todayCalls.length - completedVisits.length);
    if (remainingVisits.length === 0 && unvisitedCallsCount > 0) {
      for (const call of todayCalls) {
        remainingVisitDuration += call.priority === 'EMERGENCY' ? 45 : 30;
      }
    }

    // Remaining travel duration
    const remainingStopsCount = Math.max(0, distinctMetrics.distinctStops - completedVisits.length);
    const hasLocationData = distinctMetrics.distinctLocations > 0;
    const transitPerStop = 20; // 20 mins transit average between rural farms
    const remainingTravelDuration = hasLocationData && remainingStopsCount > 0 ? remainingStopsCount * transitPerStop : 0;

    const totalEstimatedRemainingMinutes = remainingVisitDuration + remainingTravelDuration;
    const remainingAvailableMinutes = Math.max(0, availableWorkingMinutes - (elapsedMinutes + totalEstimatedRemainingMinutes));
    const isOverCapacity = (elapsedMinutes + totalEstimatedRemainingMinutes) > availableWorkingMinutes;
    const overCapacityMinutes = isOverCapacity ? (elapsedMinutes + totalEstimatedRemainingMinutes) - availableWorkingMinutes : 0;

    return {
      availableWorkingMinutes,
      elapsedMinutes,
      remainingVisitDuration,
      remainingTravelDuration,
      hasLocationData,
      totalEstimatedRemainingMinutes,
      remainingAvailableMinutes,
      isOverCapacity,
      overCapacityMinutes,
    };
  }, [completedVisits, activeOrEnRouteVisit, remainingVisits, todayCalls, distinctMetrics]);

  // ── 3. Financial Activity (Today) ─────────────────────────────
  const financialMetrics = useMemo(() => {
    const todayInvoicesList = allInvoices.filter((inv) => {
      let dStr = '';
      if (inv.invoiceDate instanceof Date) {
        dStr = inv.invoiceDate.toISOString().split('T')[0];
      } else if (typeof inv.invoiceDate === 'string') {
        dStr = (inv.invoiceDate as string).split('T')[0];
      } else if (inv.createdAt instanceof Date) {
        dStr = inv.createdAt.toISOString().split('T')[0];
      }
      return dStr === todayStr;
    });

    const draftInvoices = todayInvoicesList.filter((inv) => inv.status === 'Draft');
    const finalizedInvoices = todayInvoicesList.filter((inv) => inv.status === 'Issued');

    // grandTotal is stored as integer paisa, so divide by 100 to get ₹
    const totalInvoicedAmount = todayInvoicesList.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0) / 100, 0);
    const finalizedAmount = finalizedInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0) / 100, 0);
    const draftAmount = draftInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0) / 100, 0);

    return {
      totalCount: todayInvoicesList.length,
      draftCount: draftInvoices.length,
      finalizedCount: finalizedInvoices.length,
      totalInvoicedAmount,
      finalizedAmount,
      draftAmount,
    };
  }, [allInvoices, todayStr]);

  // ── 4. Medicines & Consumables (Today) ─────────────────────────
  const medicineMetrics = useMemo(() => {
    // 1. Prescriptions created today
    const todayPrescriptionsList = allPrescriptions.filter((rx) => {
      let dStr = '';
      if (rx.createdAt instanceof Date) {
        dStr = rx.createdAt.toISOString().split('T')[0];
      } else if (typeof rx.createdAt === 'string') {
        dStr = (rx.createdAt as string).split('T')[0];
      }
      return dStr === todayStr;
    });

    const todayPrescribedItems = allPrescriptionItems.filter((pi) =>
      todayPrescriptionsList.some((rx) => rx.id === pi.prescriptionId)
    );

    // 2. Field usages recorded today
    const todayUsagesList = allMedicineUsages.filter((u) => {
      if (u.administeredAt) {
        const dStr = typeof u.administeredAt === 'string'
          ? u.administeredAt.split('T')[0]
          : (u.administeredAt instanceof Date ? u.administeredAt.toISOString().split('T')[0] : '');
        return dStr === todayStr;
      }
      return todayVisits.some((v) => String(v.id) === String(u.visitId));
    });

    const distinctMedicinesUsed = new Set(todayUsagesList.map((u) => u.medicineName.trim().toLowerCase())).size;

    // 3. Consumables used in procedures today
    const todayProceduresList = allProcedures.filter((p) => {
      if (p.performedAt) {
        const dStr = typeof p.performedAt === 'string'
          ? p.performedAt.split('T')[0]
          : (p.performedAt instanceof Date ? p.performedAt.toISOString().split('T')[0] : '');
        return dStr === todayStr;
      }
      return todayVisits.some((v) => String(v.id) === String(p.visitId));
    });

    return {
      prescriptionsCount: todayPrescriptionsList.length,
      prescribedItemsCount: todayPrescribedItems.length,
      usagesCount: todayUsagesList.length,
      distinctMedicinesUsed,
      proceduresCount: todayProceduresList.length,
    };
  }, [allPrescriptions, allPrescriptionItems, allMedicineUsages, allProcedures, todayVisits, todayStr]);

  const handlePostponeConfirm = async (callId: string, postponeDate: string, reason: string) => {
    await cvpService.postponeCall(callId, postponeDate, reason);
    setPostponeModalCall(null);
  };

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="cvp-container max-w-5xl mx-auto px-3 sm:px-6 py-4 pb-28 font-sans text-slate-800">
      {/* ── Top Header / Context Bar ──────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-800">
            <Compass className="w-4 h-4 text-teal-700" />
            <span>Call &amp; Visit Operational Dashboard</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Today&apos;s Field Operations
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-medium mt-1">
            <span className="flex items-center gap-1 text-slate-800 font-semibold">
              <Calendar className="w-3.5 h-3.5 text-teal-700" />
              <span>{formattedDate}</span>
            </span>
            <span>•</span>
            <span className="font-semibold text-slate-700">{todayCalls.length} calls queued today</span>
            <span>•</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
              isOnline ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {isOnline ? <Wifi className="w-3 h-3 text-emerald-600" /> : <WifiOff className="w-3 h-3 text-rose-600" />}
              <span>{isOnline ? 'Online Sync Active' : 'Offline Mode (Local-First)'}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setLastRefreshedAt(new Date());
            }}
            className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-all flex items-center gap-1.5 text-xs font-bold"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-all flex items-center gap-1.5 text-xs font-bold"
            title="Global Search"
            aria-label="Search calls, owners, and locations"
          >
            <Search className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Search</span>
          </button>

          <button
            type="button"
            onClick={() => setIsQuickActionsOpen(true)}
            className="p-2.5 rounded-xl bg-teal-800 hover:bg-teal-900 text-white shadow-md shadow-teal-900/20 transition-all flex items-center gap-1.5 text-xs font-bold"
            title="Quick Action Menu"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Quick Action</span>
          </button>
        </div>
      </div>

      {/* ── Emergency Triage Alert Banner ─────────────────────── */}
      {emergencyCalls.length > 0 && (
        <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-red-700 to-rose-800 text-white shadow-lg shadow-red-700/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 font-bold">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] uppercase font-black tracking-widest text-red-200">
                CRITICAL EMERGENCY TRIAGE
              </div>
              <div className="text-sm font-black text-white">
                {emergencyCalls.length} Emergency Call{emergencyCalls.length > 1 ? 's' : ''} Require Immediate Attendance!
              </div>
              <div className="text-xs text-red-100 mt-0.5">
                Prioritized ahead of routine field route. Tap below to inspect emergency calls.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('emergency-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="self-start sm:self-center px-4 py-2 rounded-xl bg-white text-red-900 font-extrabold text-xs hover:bg-red-50 transition-colors shadow-sm"
          >
            View Emergency Calls
          </button>
        </div>
      )}

      {/* ── SECTION A: TODAY'S WORKLOAD OVERVIEW CARDS ─────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-teal-700" />
            <span>Today&apos;s Workload &amp; Triage Distribution</span>
          </h2>
          <span className="text-[11px] font-bold text-slate-500">
            Updated {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Emergency Card */}
          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-red-800 tracking-wider">Emergency</span>
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            </div>
            <div className="text-2xl font-black text-red-950 mt-1">{emergencyCalls.length}</div>
            <div className="text-[10px] text-red-700 font-medium">Must attend first</div>
          </div>

          {/* Urgent Card */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">Urgent</span>
              <Clock className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-950 mt-1">{urgentCalls.length}</div>
            <div className="text-[10px] text-amber-700 font-medium">Attend today</div>
          </div>

          {/* Planned Visits */}
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-teal-800 tracking-wider">Planned</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            </div>
            <div className="text-2xl font-black text-teal-950 mt-1">{plannedCalls.length}</div>
            <div className="text-[10px] text-teal-700 font-medium">Scheduled visits</div>
          </div>

          {/* Other Awaiting Action */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-blue-800 tracking-wider">Awaiting Triage</span>
              <ListFilter className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-950 mt-1">{otherAwaitingCalls.length}</div>
            <div className="text-[10px] text-blue-700 font-medium">Assess on-site</div>
          </div>

          {/* Postponed Cases */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">Postponed</span>
              <CalendarClock className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">{postponedCalls.length}</div>
            <div className="text-[10px] text-slate-600 font-medium">Requires attention</div>
          </div>

          {/* Distinct Animals & Stops */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider">Stops / Animals</span>
              <PawPrint className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-950 mt-1">
              {distinctMetrics.distinctStops} <span className="text-xs font-bold text-emerald-700">/ {distinctMetrics.distinctAnimals}</span>
            </div>
            <div className="text-[10px] text-emerald-800 font-medium">Distinct locations &amp; animals</div>
          </div>
        </div>

        {/* Visits Progress Strip */}
        <div className="mt-3 p-3 bg-white border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Calls / Cases</span>
              <span className="font-bold text-slate-900 text-sm">{todayCalls.length} calls ({distinctMetrics.totalCases} cases)</span>
            </div>
            <div className="w-[1px] h-6 bg-slate-200 hidden sm:block" />
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Distinct Farms / Locations</span>
              <span className="font-bold text-slate-900 text-sm">{distinctMetrics.distinctLocations} locations ({distinctMetrics.distinctStops} scheduled stops)</span>
            </div>
            <div className="w-[1px] h-6 bg-slate-200 hidden sm:block" />
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Visits Completed</span>
              <span className="font-bold text-emerald-700 text-sm">
                {completedVisits.length} done <span className="text-slate-400 font-normal">({remainingVisits.length} remaining)</span>
              </span>
            </div>
          </div>

          {activeOrEnRouteVisit && (
            <button
              type="button"
              onClick={() => navigate(`/calls/field?visitId=${activeOrEnRouteVisit.id}`)}
              className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-teal-200" />
              <span>Resume Active Visit #{activeOrEnRouteVisit.id}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── SECTION B: TIME AND CAPACITY ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6 items-stretch">
        {/* Capacity Breakdown Card */}
        <div className="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-700" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">Time &amp; Field Capacity Estimate</h3>
              </div>
              {timeMetrics.isOverCapacity ? (
                <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 font-extrabold text-[11px] border border-red-300">
                  OVER CAPACITY (+{(timeMetrics.overCapacityMinutes / 60).toFixed(1)}h)
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-teal-100 text-teal-900 font-extrabold text-[11px] border border-teal-300">
                  SPARE BUFFER ({(timeMetrics.remainingAvailableMinutes / 60).toFixed(1)}h remaining)
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-5">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-1">Working Hours</span>
                <span className="text-base sm:text-lg font-black text-slate-900 whitespace-nowrap leading-tight">
                  {(timeMetrics.availableWorkingMinutes / 60).toFixed(1)} hrs
                </span>
                <span className="text-[11px] text-slate-400 block mt-1 truncate">Daily shift total</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-1">Elapsed Field Time</span>
                <span className="text-base sm:text-lg font-black text-teal-800 whitespace-nowrap leading-tight">
                  {(timeMetrics.elapsedMinutes / 60).toFixed(1)} hrs
                </span>
                <span className="text-[11px] text-slate-400 block mt-1 truncate">{completedVisits.length} visits logged</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-1">Est. Remaining Visits</span>
                <span className="text-base sm:text-lg font-black text-slate-900 whitespace-nowrap leading-tight">
                  {(timeMetrics.remainingVisitDuration / 60).toFixed(1)} hrs
                </span>
                <span className="text-[11px] text-slate-400 block mt-1 truncate">Clinical duration</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider mb-1">Est. Remaining Travel</span>
                <span className="text-base sm:text-lg font-black text-slate-900 whitespace-nowrap leading-tight">
                  {timeMetrics.hasLocationData ? `${(timeMetrics.remainingTravelDuration / 60).toFixed(1)} hrs` : 'N/A'}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1 truncate">
                  {timeMetrics.hasLocationData ? '~20m/stop transit' : 'Location missing'}
                </span>
              </div>
            </div>
          </div>

          {/* Capacity Progress Bar */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
              <span>Total Estimated Load: {((timeMetrics.elapsedMinutes + timeMetrics.totalEstimatedRemainingMinutes) / 60).toFixed(1)}h / {(timeMetrics.availableWorkingMinutes / 60).toFixed(1)}h</span>
              <span className="font-mono">
                {Math.min(100, Math.round(((timeMetrics.elapsedMinutes + timeMetrics.totalEstimatedRemainingMinutes) / timeMetrics.availableWorkingMinutes) * 100))}%
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  timeMetrics.isOverCapacity ? 'bg-red-600' : 'bg-teal-600'
                }`}
                style={{
                  width: `${Math.min(100, Math.round(((timeMetrics.elapsedMinutes + timeMetrics.totalEstimatedRemainingMinutes) / timeMetrics.availableWorkingMinutes) * 100))}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              Calculations combine actual logged durations with standard clinical estimates (45m emergency, 30m routine). Travel is computed per distinct geographic stop.
            </p>
          </div>
        </div>

        {/* Plan My Day Action Banner */}
        <div className="lg:col-span-5 xl:col-span-4 rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-700 via-teal-800 to-teal-950 p-5 sm:p-6 text-white shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-black uppercase tracking-widest text-teal-300">
                Daily Route &amp; Field Dispatch
              </span>
              <Navigation className="w-5 h-5 text-teal-300" />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
              Optimize Field Route
            </h2>
            <p className="text-xs text-teal-100 mt-2 leading-relaxed">
              Sequence {distinctMetrics.distinctStops} distinct stops to minimize transit mileage and preserve emergency clinical buffer.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-teal-900/60 border border-teal-500/30 flex items-center justify-between text-xs">
              <div>
                <span className="text-teal-300 block text-[10px] uppercase font-bold">Planned Stops</span>
                <span className="font-bold text-white text-sm">{distinctMetrics.distinctStops} Client Stops</span>
              </div>
              <div className="text-right">
                <span className="text-teal-300 block text-[10px] uppercase font-bold">Transit Time</span>
                <span className="font-bold text-white text-sm">~{(timeMetrics.remainingTravelDuration / 60).toFixed(1)} hrs</span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-teal-600/40 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/calls/field')}
              className="flex-1 py-2.5 px-3 rounded-xl bg-white hover:bg-teal-50 text-slate-900 font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              <Compass className="w-4 h-4 text-teal-800" />
              <span>Field Mode</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/calls/plan')}
              className="flex-1 py-2.5 px-3 rounded-xl bg-teal-900/90 hover:bg-teal-900 text-white font-bold text-xs border border-teal-500/50 shadow-sm transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              <span>Plan Day</span>
              <ArrowRight className="w-4 h-4 text-teal-300" />
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION C & D: FINANCIALS & MEDICINES ───────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Financial Activity */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-sm">Today&apos;s Financial Activity</h3>
              </div>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                {financialMetrics.totalCount} Invoices Created
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-3">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                <span className="text-emerald-800 block text-[10px] uppercase font-bold">Total Invoiced Amount</span>
                <span className="text-xl font-black text-emerald-950">₹{financialMetrics.totalInvoicedAmount.toLocaleString('en-IN')}</span>
                <span className="text-[10px] text-emerald-700 block mt-0.5">{financialMetrics.finalizedCount} finalized invoices</span>
              </div>
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                <span className="text-amber-800 block text-[10px] uppercase font-bold">Draft Invoices Awaiting Review</span>
                <span className="text-xl font-black text-amber-950">{financialMetrics.draftCount} Drafts</span>
                <span className="text-[10px] text-amber-700 block mt-0.5">₹{financialMetrics.draftAmount.toLocaleString('en-IN')} unfinalized</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              <strong>Integrity Notice:</strong> Draft invoices are awaiting clinical review and are not counted as collected or paid revenue. Practice tenant isolation is strictly respected.
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/invoices')}
              className="text-xs font-bold text-teal-800 hover:text-teal-900 flex items-center gap-1"
            >
              <span>View All Invoices</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Medicines & Consumables */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-indigo-700" />
                <h3 className="font-bold text-slate-900 text-sm">Medicines &amp; Field Usage Today</h3>
              </div>
              <span className="text-xs font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                Clinical Tracking
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-3">
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                <span className="text-indigo-800 block text-[10px] uppercase font-bold">Medicines Prescribed</span>
                <span className="text-xl font-black text-indigo-950">{medicineMetrics.prescribedItemsCount} items</span>
                <span className="text-[10px] text-indigo-700 block mt-0.5">Across {medicineMetrics.prescriptionsCount} take-home Rxs</span>
              </div>
              <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl">
                <span className="text-teal-800 block text-[10px] uppercase font-bold">Actual Field Administrations</span>
                <span className="text-xl font-black text-teal-950">{medicineMetrics.usagesCount} doses</span>
                <span className="text-[10px] text-teal-700 block mt-0.5">{medicineMetrics.distinctMedicinesUsed} distinct medicines used</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              <strong>Clinical vs Inventory Integrity:</strong> Prescribed quantities represent take-home regimens. Actual field usage records on-site administration. Stock is deducted only upon confirmed actual field usage.
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/prescriptions')}
              className="text-xs font-bold text-teal-800 hover:text-teal-900 flex items-center gap-1"
            >
              <span>View Prescriptions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Work Queue Sections ──────────────────────────── */}
      <div className="space-y-6">
        {/* 1. Emergency Queue */}
        {emergencyCalls.length > 0 && (
          <section id="emergency-section">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                <h2 className="text-sm font-black uppercase tracking-wider text-red-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Emergency Calls ({emergencyCalls.length})</span>
                </h2>
              </div>
              <span className="text-[11px] font-bold text-red-800 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                Must attend first
              </span>
            </div>
            <div className="space-y-3">
              {emergencyCalls.map((call: Call) => (
                <CallCard
                  key={call.id}
                  call={call}
                  onPostpone={(c: Call) => setPostponeModalCall(c)}
                  onSelect={(c: Call) => navigate(`/calls?selected=${c.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* 2. Urgent Queue */}
        {urgentCalls.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h2 className="text-sm font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-700" />
                  <span>Urgent Calls ({urgentCalls.length})</span>
                </h2>
              </div>
              <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                Attend today
              </span>
            </div>
            <div className="space-y-3">
              {urgentCalls.map((call: Call) => (
                <CallCard
                  key={call.id}
                  call={call}
                  onPostpone={(c: Call) => setPostponeModalCall(c)}
                  onSelect={(c: Call) => navigate(`/calls?selected=${c.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* 3. Planned Routine Queue */}
        {plannedCalls.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                <h2 className="text-sm font-black uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-700" />
                  <span>Planned Visits ({plannedCalls.length})</span>
                </h2>
              </div>
              <span className="text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                Scheduled Procedures
              </span>
            </div>
            <div className="space-y-3">
              {plannedCalls.map((call: Call) => (
                <CallCard
                  key={call.id}
                  call={call}
                  onPostpone={(c: Call) => setPostponeModalCall(c)}
                  onSelect={(c: Call) => navigate(`/calls?selected=${c.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* 4. Could Not Assess Queue */}
        {couldNotAssessCalls.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <h2 className="text-sm font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                  <ListFilter className="w-4 h-4 text-blue-700" />
                  <span>Awaiting On-Site Assessment ({couldNotAssessCalls.length})</span>
                </h2>
              </div>
              <span className="text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                Evaluate in field
              </span>
            </div>
            <div className="space-y-3">
              {couldNotAssessCalls.map((call: Call) => (
                <CallCard
                  key={call.id}
                  call={call}
                  onPostpone={(c: Call) => setPostponeModalCall(c)}
                  onSelect={(c: Call) => navigate(`/calls?selected=${c.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Empty State if no calls today */}
        {todayCalls.length === 0 && (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No calls scheduled for today</h3>
            <p className="text-xs text-slate-600 max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
              Your field schedule is currently clear. Use Quick Actions or Register Call to log an incoming farmer triage call.
            </p>
            <button
              type="button"
              onClick={() => navigate('/calls/register')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-teal-800 text-white rounded-xl text-xs font-bold hover:bg-teal-900 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Call</span>
            </button>
          </div>
        )}

        {/* 5. Postponed Work Section */}
        {postponedCalls.length > 0 && (
          <section className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-amber-700" />
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                  Rescheduled / Postponed Work ({postponedCalls.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/calls?tab=postponed')}
                className="text-xs font-bold text-teal-800 hover:text-teal-900 flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-3">
              {postponedCalls.slice(0, 2).map((call: Call) => (
                <CallCard
                  key={call.id}
                  call={call}
                  onPostpone={(c: Call) => setPostponeModalCall(c)}
                  onSelect={(c: Call) => navigate(`/calls?selected=${c.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* 6. Upcoming Work (Preview) */}
        {upcomingCalls.length > 0 && (
          <section className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-600" />
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                  Upcoming Visits Preview ({upcomingCalls.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/calls?tab=upcoming')}
                className="text-xs font-bold text-teal-800 hover:text-teal-900 flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-3">
              {upcomingCalls.slice(0, 2).map((call: Call) => (
                <CallCard
                  key={call.id}
                  call={call}
                  onPostpone={(c: Call) => setPostponeModalCall(c)}
                  onSelect={(c: Call) => navigate(`/calls?selected=${c.id}`)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Floating Bottom Action on Mobile ──────────────────── */}
      <div className="fixed bottom-16 sm:bottom-6 left-0 right-0 p-3 flex justify-center pointer-events-none z-30">
        <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md rounded-2xl p-1.5 shadow-2xl flex items-center gap-2 border border-slate-700/60">
          <button
            type="button"
            onClick={() => setIsQuickActionsOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-teal-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Quick Action</span>
          </button>
          <div className="w-[1px] h-5 bg-slate-700" />
          <button
            type="button"
            onClick={() => navigate('/calls')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-200 hover:text-white text-xs font-semibold transition-colors"
          >
            <ListFilter className="w-4 h-4" />
            <span>Open Calls ({allCalls.length})</span>
          </button>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────── */}
      <PostponeModal
        call={postponeModalCall}
        isOpen={Boolean(postponeModalCall)}
        onClose={() => setPostponeModalCall(null)}
        onConfirm={handlePostponeConfirm}
      />

      <QuickActionLauncher
        isOpen={isQuickActionsOpen}
        onClose={() => setIsQuickActionsOpen(false)}
      />

      <CvpGlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectCall={(call) => navigate(`/calls?selected=${call.id}`)}
      />
    </div>
  );
};
