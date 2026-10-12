import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { useAuth } from '../../context/AuthContext';
import { cvpService } from '../../services/cvpService';
import type { Call, CapacitySummary } from '../../types/cvp';
import { CapacityWidget } from '../../components/cvp/CapacityWidget';
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
} from 'lucide-react';
import './Cvp.css';

export const TodayDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { practice } = useAuth();
  const practiceId = practice?.id || 'demo-practice-id';

  // Live query calls from Dexie for real-time reactivity
  const allCalls: Call[] = useLiveQuery(
    async () => {
      return (await db.calls.toArray()) as Call[];
    },
    [practiceId]
  ) || [];

  const [capacity, setCapacity] = useState<CapacitySummary | null>(null);
  const [postponeModalCall, setPostponeModalCall] = useState<Call | null>(null);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Group calls for today
  const todayStr = new Date().toISOString().split('T')[0];

  const todayCalls = allCalls.filter(
    (c: Call) => Boolean((c.preferredDate === todayStr || (!c.preferredDate && c.status === 'LOGGED')) && c.status !== 'CANCELLED')
  );

  const postponedCalls = allCalls.filter(
    (c: Call) => Boolean(c.status === 'SCHEDULED' && c.preferredDate && c.preferredDate > todayStr)
  );

  const upcomingCalls = allCalls.filter(
    (c: Call) => Boolean(c.status === 'LOGGED' && c.preferredDate && c.preferredDate > todayStr)
  );

  // Today triage buckets
  const emergencyCalls = todayCalls.filter((c: Call) => c.priority === 'EMERGENCY');
  const urgentCalls = todayCalls.filter((c: Call) => c.priority === 'URGENT');
  const couldNotAssessCalls = todayCalls.filter((c: Call) => c.priority === 'COULD_NOT_ASSESS');
  const plannedCalls = todayCalls.filter((c: Call) => c.priority === 'PLANNED');

  useEffect(() => {
    async function loadCapacity() {
      const cap = await cvpService.getTodayCapacitySummary();
      setCapacity(cap);
    }
    loadCapacity();
  }, [allCalls.length]);

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
    <div className="cvp-container max-w-5xl mx-auto px-3 sm:px-6 py-4 pb-24 font-sans text-slate-800">
      {/* Top Header / Context Bar */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700">
            <Compass className="w-4 h-4" />
            <span>Field & Call Planner (CVP-01)</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Today&apos;s Field Dashboard
          </h1>
          <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{formattedDate}</span>
            <span>•</span>
            <span className="font-semibold text-slate-700">{todayCalls.length} calls queued today</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Global Search trigger (CVP-43) */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition-all flex items-center gap-1.5 text-xs font-semibold"
            title="Global Search (CVP-43)"
            aria-label="Search calls, owners, and locations"
          >
            <Search className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Search</span>
          </button>

          {/* Quick Action launcher (CVP-42) */}
          <button
            type="button"
            onClick={() => setIsQuickActionsOpen(true)}
            className="p-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white shadow-md shadow-teal-700/20 transition-all flex items-center gap-1.5 text-xs font-bold"
            title="Quick Action Menu (CVP-42)"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Quick Action</span>
          </button>
        </div>
      </div>

      {/* Emergency Triage Alert Banner (if any emergency calls exist) */}
      {emergencyCalls.length > 0 && (
        <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-lg shadow-red-600/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs uppercase font-extrabold tracking-wider text-red-100">
                CRITICAL TRIAGE REQUIRED
              </div>
              <div className="text-sm font-bold">
                {emergencyCalls.length} Emergency Call{emergencyCalls.length > 1 ? 's' : ''} Pending Attendance!
              </div>
              <div className="text-xs text-red-100 mt-0.5">
                Immediate clinical attention required. Review priority queue below.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('emergency-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="self-start sm:self-center px-3.5 py-1.5 rounded-xl bg-white text-red-700 font-bold text-xs hover:bg-red-50 transition-colors shadow-sm"
          >
            View Emergency Calls
          </button>
        </div>
      )}

      {/* Primary Workload & Route Planning Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Workload Capacity Widget */}
        <div className="md:col-span-2">
          {capacity && <CapacityWidget summary={capacity} />}
        </div>

        {/* Plan My Day Action Banner */}
        <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-500 via-teal-600 to-teal-800 p-5 text-white shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-teal-200">
                Daily Route
              </span>
              <Navigation className="w-5 h-5 text-teal-200" />
            </div>
            <h2 className="text-lg font-bold text-white leading-tight">
              Optimize & Dispatch Route
            </h2>
            <p className="text-xs text-teal-100 mt-1 leading-relaxed">
              Sequence {todayCalls.length} visits to minimize driving time and maintain emergency buffer windows.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-teal-400/30 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => navigate('/calls/field')}
              className="flex-1 py-2.5 px-3 rounded-xl bg-white hover:bg-teal-50 text-teal-900 font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              <Compass className="w-4 h-4 text-teal-700" />
              <span>Field Mode (CVP-19)</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/calls/plan')}
              className="flex-1 py-2.5 px-3 rounded-xl bg-teal-800/80 hover:bg-teal-800 text-white font-bold text-xs border border-teal-400/40 shadow-sm transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
            >
              <span>Plan Day</span>
              <ArrowRight className="w-4 h-4 text-teal-200" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Work Queue Sections */}
      <div className="space-y-6">
        {/* 1. Emergency Queue */}
        {emergencyCalls.length > 0 && (
          <section id="emergency-section">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                <h2 className="text-sm font-black uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  Emergency Calls ({emergencyCalls.length})
                </h2>
              </div>
              <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
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
                <h2 className="text-sm font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Urgent Calls ({urgentCalls.length})
                </h2>
              </div>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
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

        {/* 3. Could Not Assess Queue */}
        {couldNotAssessCalls.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <h2 className="text-sm font-black uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                  <HelpCircleIcon className="w-4 h-4 text-blue-600" />
                  Could Not Assess Phone Triage ({couldNotAssessCalls.length})
                </h2>
              </div>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                On-site evaluation needed
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

        {/* 4. Planned Routine Queue */}
        {plannedCalls.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                <h2 className="text-sm font-black uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  Planned Visits ({plannedCalls.length})
                </h2>
              </div>
              <span className="text-[11px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
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

        {/* Empty State if no calls today */}
        {todayCalls.length === 0 && (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No calls scheduled for today</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
              Your field schedule is currently clear. Use Quick Actions to register a new incoming farmer call.
            </p>
            <button
              type="button"
              onClick={() => setIsQuickActionsOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 text-white rounded-xl text-xs font-bold hover:bg-teal-800 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Register Call</span>
            </button>
          </div>
        )}

        {/* 5. Postponed Work Section (Prominent) */}
        {postponedCalls.length > 0 && (
          <section className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-amber-600" />
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">
                  Rescheduled / Postponed Work ({postponedCalls.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/calls?tab=postponed')}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
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
          <section className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">
                  Upcoming Visits Preview ({upcomingCalls.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/calls?tab=upcoming')}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
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

      {/* Floating Bottom Action on Mobile */}
      <div className="fixed bottom-16 sm:bottom-6 left-0 right-0 p-3 flex justify-center pointer-events-none z-30">
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md rounded-2xl p-1.5 shadow-2xl flex items-center gap-2 border border-slate-700/50">
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
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white text-xs font-semibold transition-colors"
          >
            <ListFilter className="w-4 h-4" />
            <span>Calls Queue ({allCalls.length})</span>
          </button>
        </div>
      </div>

      {/* Modals */}
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

function HelpCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}
