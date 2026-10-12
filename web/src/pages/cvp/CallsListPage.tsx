import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { useAuth } from '../../context/AuthContext';
import { cvpService } from '../../services/cvpService';
import type { Call, CallPriority, VisitFlexibility } from '../../types/cvp';
import { CallCard } from '../../components/cvp/CallCard';
import { PostponeModal } from '../../components/cvp/PostponeModal';
import { QuickActionLauncher } from '../../components/cvp/QuickActionLauncher';
import { CvpGlobalSearchModal } from '../../components/cvp/CvpGlobalSearchModal';
import {
  Search,
  Plus,
  PhoneCall,
  PhoneForwarded,
  Smartphone,
  Calendar,
  Filter,
  CheckCircle2,
  CalendarClock,
  Clock,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import './Cvp.css';

export const CallsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { practice } = useAuth();
  const practiceId = practice?.id || 'demo-practice-id';

  const tabParam = (searchParams.get('tab') as 'today' | 'upcoming' | 'postponed' | 'all') || 'today';
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'postponed' | 'all'>(tabParam);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Modals & drawers
  const [postponeModalCall, setPostponeModalCall] = useState<Call | null>(null);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);

  // New call intake form state
  const [intakeData, setIntakeData] = useState({
    callerPhone: '',
    tempOwnerName: '',
    tempPatientName: '',
    species: 'Cattle',
    symptoms: '',
    tentativeAssessment: '',
    priority: 'URGENT' as CallPriority,
    flexibility: 'MUST_ATTEND_TODAY' as VisitFlexibility,
    preferredDate: new Date().toISOString().split('T')[0],
    locationAddress: '',
  });
  const [intakeSubmitting, setIntakeSubmitting] = useState(false);

  // Sync tab with URL
  const handleTabChange = (tab: 'today' | 'upcoming' | 'postponed' | 'all') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    if (searchParams.get('action') === 'new-call') {
      setIsIntakeOpen(true);
    }
  }, [searchParams]);

  // Dexie live query
  const allCalls: Call[] = useLiveQuery(
    async () => {
      return (await db.calls.reverse().sortBy('createdAt')) as Call[];
    },
    [practiceId]
  ) || [];

  const todayStr = new Date().toISOString().split('T')[0];

  // Tab counts
  const todayCount = allCalls.filter(
    (c: Call) => Boolean((c.preferredDate === todayStr || (!c.preferredDate && c.status === 'LOGGED')) && c.status !== 'CANCELLED')
  ).length;

  const upcomingCount = allCalls.filter(
    (c: Call) => Boolean(c.status === 'LOGGED' && c.preferredDate && c.preferredDate > todayStr)
  ).length;

  const postponedCount = allCalls.filter(
    (c: Call) => Boolean(c.status === 'SCHEDULED' && c.preferredDate && c.preferredDate > todayStr)
  ).length;

  const allCount = allCalls.length;

  // Filtered list
  const filteredCalls = allCalls.filter((call: Call) => {
    // 1. Tab filter
    if (activeTab === 'today') {
      const isToday = (call.preferredDate === todayStr || (!call.preferredDate && call.status === 'LOGGED')) && call.status !== 'CANCELLED';
      if (!isToday) return false;
    } else if (activeTab === 'upcoming') {
      if (!(call.status === 'LOGGED' && call.preferredDate && call.preferredDate > todayStr)) return false;
    } else if (activeTab === 'postponed') {
      if (!(call.status === 'SCHEDULED' && call.preferredDate && call.preferredDate > todayStr)) return false;
    }

    // 2. Priority filter
    if (priorityFilter !== 'ALL' && call.priority !== priorityFilter) {
      return false;
    }

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchOwner = (call.tempOwnerName || '').toLowerCase().includes(q);
      const matchPhone = (call.callerPhone || '').toLowerCase().includes(q);
      const matchPatient = (call.tempPatientName || '').toLowerCase().includes(q);
      const matchAddress = (call.locationAddress || '').toLowerCase().includes(q);
      const matchSymptoms = (call.symptoms || '').toLowerCase().includes(q);
      if (!matchOwner && !matchPhone && !matchPatient && !matchAddress && !matchSymptoms) {
        return false;
      }
    }

    return true;
  });

  const handlePostponeConfirm = async (callId: string, postponeDate: string, reason: string) => {
    await cvpService.postponeCall(callId, postponeDate, reason);
    setPostponeModalCall(null);
  };

  const handleCreateCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intakeData.callerPhone && !intakeData.tempOwnerName) {
      alert('Please enter either caller phone or owner name.');
      return;
    }

    try {
      setIntakeSubmitting(true);
      await cvpService.createCall({
        ...intakeData,
        status: 'LOGGED',
      });
      setIsIntakeOpen(false);
      // Reset intake form
      setIntakeData({
        callerPhone: '',
        tempOwnerName: '',
        tempPatientName: '',
        species: 'Cattle',
        symptoms: '',
        tentativeAssessment: '',
        priority: 'URGENT',
        flexibility: 'MUST_ATTEND_TODAY',
        preferredDate: new Date().toISOString().split('T')[0],
        locationAddress: '',
      });
    } catch (err) {
      console.error('Failed to log call:', err);
      alert('Failed to register call. Please try again.');
    } finally {
      setIntakeSubmitting(false);
    }
  };

  return (
    <div className="cvp-container max-w-5xl mx-auto px-3 sm:px-6 py-4 pb-28 font-sans text-slate-800">
      {/* Top Header */}
      <div className="cvp-header-section flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700">
            <PhoneCall className="w-4 h-4 shrink-0" />
            <span className="truncate">Call &amp; Visit Queue (CVP-02)</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1 break-words">
            Incoming Calls &amp; Cases
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5 break-words">
            Triage, contact farmers, and manage scheduled visit requests
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="cvp-btn-icon"
            title="Search"
            aria-label="Global search"
          >
            <Search className="w-4 h-4 text-slate-500" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/calls/register')}
            className="btn-cvp-primary"
            id="btn-log-new-call"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Log New Call</span>
          </button>
        </div>
      </div>

      {/* Android Call Capture Quick Action Strip */}
      <div className="cvp-android-strip mb-4 p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="p-2.5 rounded-xl bg-teal-50 text-teal-700 shrink-0 border border-teal-100 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-teal-700" />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 truncate">
              Received a client call?
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              Capture phone from dialer or log triage during/after call
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => navigate('/calls/register?mode=during')}
            className="cvp-chip-btn during"
            id="btn-register-during-call"
          >
            <PhoneCall className="w-3.5 h-3.5 text-teal-700" />
            <span>During Call</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/calls/register?mode=after')}
            className="cvp-chip-btn after"
            id="btn-register-after-call"
          >
            <PhoneForwarded className="w-3.5 h-3.5 text-slate-600" />
            <span>After Call</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="cvp-tabs-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'today'}
          onClick={() => handleTabChange('today')}
          className={`cvp-tab-btn ${activeTab === 'today' ? 'active' : ''}`}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Today</span>
          <span className="cvp-tab-count">
            {todayCount}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'upcoming'}
          onClick={() => handleTabChange('upcoming')}
          className={`cvp-tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>Upcoming</span>
          <span className="cvp-tab-count">
            {upcomingCount}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'postponed'}
          onClick={() => handleTabChange('postponed')}
          className={`cvp-tab-btn ${activeTab === 'postponed' ? 'active' : ''}`}
        >
          <CalendarClock className="w-3.5 h-3.5 shrink-0" />
          <span>Postponed</span>
          <span className="cvp-tab-count">
            {postponedCount}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'all'}
          onClick={() => handleTabChange('all')}
          className={`cvp-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
          <span>All Records</span>
          <span className="cvp-tab-count">
            {allCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/calls/follow-ups')}
          className="cvp-tab-btn"
          title="Open Follow-up & Recurrence Hub"
          style={{ background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
          <span>Follow-ups</span>
          <span className="cvp-badge-phase">Phase 8</span>
        </button>
      </div>

      {/* Filter and Inline Search Control */}
      <div className="cvp-filter-controls-row">
        <div className="cvp-search-wrapper">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter by owner, phone, animal, village..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="cvp-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="cvp-search-clear"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Priority Filter Chips */}
        <div className="cvp-priority-filters">
          <span className="cvp-filter-label">
            <Filter className="w-3 h-3 text-slate-400" />
            Priority:
          </span>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'EMERGENCY', label: 'Emergency' },
            { id: 'URGENT', label: 'Urgent' },
            { id: 'COULD_NOT_ASSESS', label: 'Unassessed' },
            { id: 'PLANNED', label: 'Planned' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPriorityFilter(item.id)}
              className={`cvp-filter-chip ${item.id.toLowerCase()} ${priorityFilter === item.id ? 'active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* List of Call Cards */}
      <div className="space-y-3">
        {filteredCalls.map((call: Call) => (
          <CallCard
            key={call.id}
            call={call}
            onPostpone={(c: Call) => setPostponeModalCall(c)}
            onSelect={(_c: Call) => {
              // Open detailed modal or highlight
            }}
          />
        ))}

        {/* Empty state for the active tab */}
        {filteredCalls.length === 0 && (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {searchQuery || priorityFilter !== 'ALL'
                ? 'No matching calls match your search criteria'
                : activeTab === 'today'
                ? 'No calls scheduled for today'
                : activeTab === 'upcoming'
                ? 'No upcoming visits logged'
                : activeTab === 'postponed'
                ? 'No postponed calls pending'
                : 'No calls registered yet'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
              {searchQuery || priorityFilter !== 'ALL'
                ? 'Try clearing the search query or changing priority filters to see all queued calls.'
                : 'Click below to quickly register an incoming farmer call.'}
            </p>
            <button
              type="button"
              onClick={() => setIsIntakeOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 text-white rounded-xl text-xs font-bold hover:bg-teal-800 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Log New Call</span>
            </button>
          </div>
        )}
      </div>

      {/* Quick Intake Drawer / Dialog */}
      {isIntakeOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
          <div
            className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
            role="dialog"
            aria-modal="true"
            aria-labelledby="intake-title"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-teal-800">
                <PhoneCall className="w-5 h-5 text-teal-600" />
                <div>
                  <h2 id="intake-title" className="text-base font-bold text-slate-900">
                    Register Call Intake
                  </h2>
                  <p className="text-[11px] text-slate-500">Record farmer complaint & symptoms</p>
                </div>
              </div>
              <button
                onClick={() => setIsIntakeOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCall} className="mt-4 space-y-3.5">
              {/* Caller Phone & Owner Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Caller Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9822012345"
                    value={intakeData.callerPhone}
                    onChange={(e) => setIntakeData({ ...intakeData, callerPhone: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Farmer / Owner Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Patil"
                    value={intakeData.tempOwnerName}
                    onChange={(e) => setIntakeData({ ...intakeData, tempOwnerName: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium"
                  />
                </div>
              </div>

              {/* Animal & Species */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Animal / Tag / Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lakshmi / Cow #4"
                    value={intakeData.tempPatientName}
                    onChange={(e) => setIntakeData({ ...intakeData, tempPatientName: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Species
                  </label>
                  <select
                    value={intakeData.species}
                    onChange={(e) => setIntakeData({ ...intakeData, species: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium"
                  >
                    <option value="Cattle">Cattle</option>
                    <option value="Buffalo">Buffalo</option>
                    <option value="Canine">Dog (Canine)</option>
                    <option value="Feline">Cat (Feline)</option>
                    <option value="Caprine">Goat (Caprine)</option>
                    <option value="Ovine">Sheep (Ovine)</option>
                    <option value="Equine">Horse (Equine)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Location Address */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Location / Village / Farm Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Near Old Milk Dairy, Shindewadi"
                  value={intakeData.locationAddress}
                  onChange={(e) => setIntakeData({ ...intakeData, locationAddress: e.target.value })}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              {/* Symptoms reported by farmer (NO AI DIAGNOSIS) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Reported Symptoms by Caller *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Not eating since morning, heavy breathing, high fever suspected by owner"
                  value={intakeData.symptoms}
                  onChange={(e) => setIntakeData({ ...intakeData, symptoms: e.target.value })}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Veterinarian assessment will be recorded during or after physical examination.
                </p>
              </div>

              {/* Tentative Clinical Assessment */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Tentative Vet Assessment (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Suspected Ruminal Acidosis / Dystocia"
                  value={intakeData.tentativeAssessment}
                  onChange={(e) => setIntakeData({ ...intakeData, tentativeAssessment: e.target.value })}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              {/* Priority & Flexibility */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Priority
                  </label>
                  <select
                    value={intakeData.priority}
                    onChange={(e) => setIntakeData({ ...intakeData, priority: e.target.value as CallPriority })}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-bold text-slate-700"
                  >
                    <option value="EMERGENCY">EMERGENCY (Immediate)</option>
                    <option value="URGENT">URGENT (Today)</option>
                    <option value="COULD_NOT_ASSESS">COULD NOT ASSESS (Triage on arrival)</option>
                    <option value="PLANNED">PLANNED (Routine)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Flexibility
                  </label>
                  <select
                    value={intakeData.flexibility}
                    onChange={(e) => setIntakeData({ ...intakeData, flexibility: e.target.value as VisitFlexibility })}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium"
                  >
                    <option value="MUST_ATTEND_TODAY">MUST ATTEND TODAY</option>
                    <option value="PREFERRED_TODAY">PREFERRED TODAY</option>
                    <option value="CAN_POSTPONE_TODAY">CAN POSTPONE TODAY</option>
                    <option value="SPECIFIC_DATE">SPECIFIC DATE</option>
                  </select>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Preferred Attendance Date
                </label>
                <input
                  type="date"
                  value={intakeData.preferredDate}
                  onChange={(e) => setIntakeData({ ...intakeData, preferredDate: e.target.value })}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none font-medium"
                />
              </div>

              {/* Submit / Cancel */}
              <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsIntakeOpen(false)}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={intakeSubmitting}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-xl shadow-md shadow-teal-700/20 transition-all"
                >
                  {intakeSubmitting ? 'Saving Call...' : 'Save & Queue Call'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Postpone Modal */}
      <PostponeModal
        call={postponeModalCall}
        isOpen={Boolean(postponeModalCall)}
        onClose={() => setPostponeModalCall(null)}
        onConfirm={handlePostponeConfirm}
      />

      {/* Quick Action launcher */}
      <QuickActionLauncher
        isOpen={isQuickActionsOpen}
        onClose={() => setIsQuickActionsOpen(false)}
        onOpenIntake={() => setIsIntakeOpen(true)}
      />

      {/* Global Search Modal */}
      <CvpGlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectCall={(call) => {
          setSearchQuery(call.tempOwnerName || call.callerPhone || '');
        }}
      />
    </div>
  );
};
