// ==============================================================================
// VetRx Call & Visit Planner — Follow-up & Recurrence Dashboard (Phase 8)
// Consolidated Follow-up Management, Recurring Schedules, and Duration Learning
// ==============================================================================

import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { useAuth } from '../../context/AuthContext';
import { followUpService } from '../../services/followUpService';
import type {
  FollowUp,
  RecurringSchedule,
} from '../../types/cvp';
import { FollowUpCard } from '../../components/cvp/FollowUpCard';
import { CreateFollowUpModal } from '../../components/cvp/CreateFollowUpModal';
import { DurationEstimatesModal } from '../../components/cvp/DurationEstimatesModal';
import { FollowUpWhatsAppModal } from '../../components/cvp/FollowUpWhatsAppModal';
import { PostponeModal } from '../../components/cvp/PostponeModal';
import {
  Calendar,
  Clock,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Repeat,
  Plus,
  Search,
  PhoneCall,
  Trash2,
} from 'lucide-react';
import './Cvp.css';

type TabType =
  | 'due_today'
  | 'overdue'
  | 'upcoming'
  | 'recurring'
  | 'postponed'
  | 'awaiting_confirmation'
  | 'completed'
  | 'all';

export const FollowUpsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { practice, user } = useAuth();
  const practiceId = practice?.id || 'demo-practice-id';

  const tabParam = (searchParams.get('tab') as TabType) || 'due_today';
  const [activeTab, setActiveTab] = useState<TabType>(tabParam);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [reasonFilter, setReasonFilter] = useState('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDurationModalOpen, setIsDurationModalOpen] = useState(false);
  const [whatsAppModalFollowUp, setWhatsAppModalFollowUp] = useState<FollowUp | null>(null);
  const [postponeModalFollowUp, setPostponeModalFollowUp] = useState<FollowUp | null>(null);

  // Sync tab with URL
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Live queries from Dexie
  const todayStr = new Date().toISOString().split('T')[0];

  const allFollowUps = useLiveQuery(
    async () => {
      const items = (await db.followUps.toArray()) as FollowUp[];
      return items.filter((f) => !f.practiceId || f.practiceId === practiceId);
    },
    [practiceId]
  ) || [];

  const recurringSchedules = useLiveQuery(
    async () => {
      const items = (await db.recurringSchedules.toArray()) as RecurringSchedule[];
      return items.filter((s) => !s.practiceId || s.practiceId === practiceId);
    },
    [practiceId]
  ) || [];

  // Evaluate dynamic status for counts
  const evaluatedFollowUps = allFollowUps.map((f) => {
    const dyn = followUpService.evaluateDynamicStatus(f, todayStr);
    return dyn !== f.status ? { ...f, status: dyn } : f;
  });

  // Tab counts
  const dueTodayCount = evaluatedFollowUps.filter((f) => f.status === 'DUE').length;
  const overdueCount = evaluatedFollowUps.filter((f) => f.status === 'OVERDUE').length;
  const upcomingCount = evaluatedFollowUps.filter((f) => f.status === 'UPCOMING').length;
  const recurringCount = recurringSchedules.filter((s) => s.status === 'ACTIVE').length;
  const postponedCount = evaluatedFollowUps.filter((f) => f.status === 'POSTPONED').length;
  const awaitingConfCount = evaluatedFollowUps.filter(
    (f) => (f.status === 'DUE' || f.status === 'OVERDUE') && !f.acknowledgedAt
  ).length;
  const completedCount = evaluatedFollowUps.filter((f) => f.status === 'COMPLETED').length;

  // Filter items for current tab
  let filteredItems: FollowUp[] = [];

  if (activeTab === 'due_today') {
    filteredItems = evaluatedFollowUps.filter((f) => f.status === 'DUE');
  } else if (activeTab === 'overdue') {
    filteredItems = evaluatedFollowUps.filter((f) => f.status === 'OVERDUE');
  } else if (activeTab === 'upcoming') {
    filteredItems = evaluatedFollowUps.filter((f) => f.status === 'UPCOMING');
  } else if (activeTab === 'postponed') {
    filteredItems = evaluatedFollowUps.filter((f) => f.status === 'POSTPONED');
  } else if (activeTab === 'awaiting_confirmation') {
    filteredItems = evaluatedFollowUps.filter(
      (f) => (f.status === 'DUE' || f.status === 'OVERDUE') && !f.acknowledgedAt
    );
  } else if (activeTab === 'completed') {
    filteredItems = evaluatedFollowUps.filter((f) => f.status === 'COMPLETED');
  } else if (activeTab === 'all') {
    filteredItems = [...evaluatedFollowUps];
  }

  // Apply search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filteredItems = filteredItems.filter(
      (f) =>
        (f.ownerName && f.ownerName.toLowerCase().includes(q)) ||
        (f.patientName && f.patientName.toLowerCase().includes(q)) ||
        (f.ownerPhone && f.ownerPhone.includes(q)) ||
        (f.notes && f.notes.toLowerCase().includes(q)) ||
        (f.reason && f.reason.toLowerCase().includes(q))
    );
  }

  // Apply Priority Filter
  if (priorityFilter !== 'ALL') {
    filteredItems = filteredItems.filter((f) => f.priority === priorityFilter);
  }

  // Apply Reason Filter
  if (reasonFilter !== 'ALL') {
    filteredItems = filteredItems.filter((f) => f.reason === reasonFilter);
  }

  // Handlers for conversion
  const handleConvertToCall = async (f: FollowUp) => {
    try {
      await followUpService.convertToCall(f.id!);
      navigate('/cvp/calls?tab=today');
    } catch (err) {
      console.error('Failed to convert follow-up to call:', err);
    }
  };

  const handleConvertToVisit = async (f: FollowUp) => {
    try {
      await followUpService.convertToVisit(f.id!);
      navigate('/cvp/plan');
    } catch (err) {
      console.error('Failed to convert follow-up to visit:', err);
    }
  };

  const handleAcknowledge = async (f: FollowUp) => {
    await followUpService.acknowledgeReminder(f.id!, user?.name || 'Doctor');
  };

  const handlePostponeConfirm = async (f: FollowUp, newDate: string, reason: string) => {
    await followUpService.postponeFollowUp(f.id!, newDate, reason);
    setPostponeModalFollowUp(null);
  };

  const handleCancelRecurringSeries = async (scheduleId: string | number) => {
    if (window.confirm('Cancel all future occurrences in this recurring series? Completed visits will remain preserved.')) {
      await followUpService.cancelRecurringSeries(scheduleId);
    }
  };

  return (
    <div className="cvp-container max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-28 sm:pb-12 space-y-4 sm:space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-teal-100 text-teal-800">
              Clinical Follow-ups
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Follow-up &amp; Recurrence Hub
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Follow-ups &amp; Recurring Visits
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage clinical rechecks, vaccination boosters, pregnancy diagnosis schedules, and duration learning.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsDurationModalOpen(true)}
            className="px-3 py-2 rounded-2xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Clock className="w-4 h-4 text-blue-600" />
            <span>Duration Learning</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-2 rounded-2xl bg-teal-700 hover:bg-teal-800 active:scale-95 text-white text-xs font-black shadow-md transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Follow-up</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="cvp-followup-tabs-bar">
        <button
          type="button"
          onClick={() => handleTabChange('due_today')}
          className={`cvp-followup-tab ${activeTab === 'due_today' ? 'active-due' : ''}`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Due Today</span>
          {dueTodayCount > 0 && (
            <span className={`cvp-followup-tab-count ${activeTab !== 'due_today' ? 'cvp-followup-tab-count-due' : ''}`}>
              {dueTodayCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('overdue')}
          className={`cvp-followup-tab ${activeTab === 'overdue' ? 'active-overdue' : ''}`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Overdue</span>
          {overdueCount > 0 && (
            <span className={`cvp-followup-tab-count ${activeTab !== 'overdue' ? 'cvp-followup-tab-count-overdue' : ''}`}>
              {overdueCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('upcoming')}
          className={`cvp-followup-tab ${activeTab === 'upcoming' ? 'active-upcoming' : ''}`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Upcoming</span>
          {upcomingCount > 0 && (
            <span className={`cvp-followup-tab-count ${activeTab !== 'upcoming' ? 'cvp-followup-tab-count-upcoming' : ''}`}>
              {upcomingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('recurring')}
          className={`cvp-followup-tab ${activeTab === 'recurring' ? 'active-recurring' : ''}`}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>Recurring Schedules</span>
          {recurringCount > 0 && (
            <span className={`cvp-followup-tab-count ${activeTab !== 'recurring' ? 'cvp-followup-tab-count-recurring' : ''}`}>
              {recurringCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('awaiting_confirmation')}
          className={`cvp-followup-tab ${activeTab === 'awaiting_confirmation' ? 'active-awaiting' : ''}`}
        >
          <PhoneCall className="w-3.5 h-3.5" />
          <span>Awaiting Client</span>
          {awaitingConfCount > 0 && (
            <span className={`cvp-followup-tab-count ${activeTab !== 'awaiting_confirmation' ? 'cvp-followup-tab-count-awaiting' : ''}`}>
              {awaitingConfCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('postponed')}
          className={`cvp-followup-tab ${activeTab === 'postponed' ? 'active-postponed' : ''}`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Postponed ({postponedCount})</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('completed')}
          className={`cvp-followup-tab ${activeTab === 'completed' ? 'active-completed' : ''}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Completed ({completedCount})</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      {activeTab !== 'recurring' && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by farmer, patient, reason, or notes..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-slate-900 bg-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs p-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
            >
              <option value="ALL">All Priorities</option>
              <option value="EMERGENCY">Emergency</option>
              <option value="URGENT">Urgent</option>
              <option value="PLANNED">Planned</option>
            </select>

            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="text-xs p-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium"
            >
              <option value="ALL">All Reasons</option>
              <option value="POST_TREATMENT_REVIEW">Review</option>
              <option value="RECHECK">Recheck</option>
              <option value="VACCINATION">Vaccine</option>
              <option value="DEWORMING">Deworming</option>
              <option value="PREGNANCY_DIAGNOSIS">PD</option>
              <option value="ARTIFICIAL_INSEMINATION">AI</option>
              <option value="POST_OPERATIVE_REVIEW">Post-Op</option>
            </select>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'recurring' ? (
        /* Recurring Schedules Series List */
        <div className="space-y-3">
          {recurringSchedules.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 p-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <Repeat className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Recurring Schedules Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Set up recurring visit schedules for regular herd checks, scheduled milk recording, or post-op dressing rounds.
              </p>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition-all shadow-sm"
              >
                Create Recurring Schedule
              </button>
            </div>
          ) : (
            recurringSchedules.map((schedule) => (
              <div
                key={schedule.id}
                className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                      🔄 {schedule.frequency} Series
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {schedule.reason}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    <strong className="text-slate-800">{schedule.ownerName}</strong>
                    {schedule.patientName && ` • ${schedule.patientName} (${schedule.species || 'Animal'})`}
                  </p>

                  <div className="text-[11px] text-slate-500 mt-1 space-x-3">
                    <span>Started: <strong>{schedule.startDate}</strong></span>
                    {schedule.endDate && <span>Ends: <strong>{schedule.endDate}</strong></span>}
                    {schedule.maxOccurrences && <span>Limit: <strong>{schedule.maxOccurrences} visits</strong></span>}
                    <span>Generated: <strong>{schedule.generatedOccurrencesCount}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    schedule.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {schedule.status}
                  </span>

                  {schedule.status === 'ACTIVE' && (
                    <button
                      type="button"
                      onClick={() => handleCancelRecurringSeries(schedule.id!)}
                      className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-1"
                      title="Cancel remaining future occurrences"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Cancel Series</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Regular Follow-ups List */
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 p-6">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Follow-ups in This View</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Great job! There are currently no {activeTab.replace('_', ' ')} clinical follow-ups.
              </p>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition-all shadow-sm"
              >
                Create Follow-up
              </button>
            </div>
          ) : (
            filteredItems.map((followUp) => (
              <FollowUpCard
                key={followUp.id}
                followUp={followUp}
                onConvertToCall={handleConvertToCall}
                onConvertToVisit={handleConvertToVisit}
                onWhatsApp={(f) => setWhatsAppModalFollowUp(f)}
                onAcknowledge={handleAcknowledge}
                onPostpone={(f) => setPostponeModalFollowUp(f)}
              />
            ))
          )}
        </div>
      )}

      {/* Modals */}
      <CreateFollowUpModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        practiceId={practiceId}
      />

      <DurationEstimatesModal
        isOpen={isDurationModalOpen}
        onClose={() => setIsDurationModalOpen(false)}
        practiceId={practiceId}
      />

      {whatsAppModalFollowUp && (
        <FollowUpWhatsAppModal
          isOpen={Boolean(whatsAppModalFollowUp)}
          onClose={() => setWhatsAppModalFollowUp(null)}
          followUp={whatsAppModalFollowUp}
          doctorName={user?.name}
          practiceName={practice?.name}
          onAcknowledge={() => handleAcknowledge(whatsAppModalFollowUp)}
        />
      )}

      {postponeModalFollowUp && (
        <PostponeModal
          isOpen={Boolean(postponeModalFollowUp)}
          onClose={() => setPostponeModalFollowUp(null)}
          call={{
            id: postponeModalFollowUp.id,
            callerPhone: postponeModalFollowUp.ownerPhone || '',
            ownerName: postponeModalFollowUp.ownerName,
            species: postponeModalFollowUp.species,
            symptoms: postponeModalFollowUp.reason,
            priority: postponeModalFollowUp.priority,
            flexibility: postponeModalFollowUp.flexibility,
            status: 'SCHEDULED',
            createdAt: postponeModalFollowUp.createdAt,
          }}
          onConfirm={(_callId, newDate, reason) =>
            handlePostponeConfirm(postponeModalFollowUp, newDate, reason)
          }
        />
      )}
    </div>
  );
};
