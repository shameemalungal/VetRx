// ==============================================================================
// VetRx Call & Visit Planner — CaseDetailPage Component
// Comprehensive Review Case, Scheduling, Emergency Dispatch & Lifecycle Management
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Play,
  User,
  Activity,
  ExternalLink,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { cvpService } from '../../services/cvpService';
import type { Call } from '../../types/cvp';
import { ScheduleVisitModal } from '../../components/cvp/ScheduleVisitModal';
import { CloseCallModal } from '../../components/cvp/CloseCallModal';
import { PostponeModal } from '../../components/cvp/PostponeModal';
import { CreateFollowUpModal } from '../../components/cvp/CreateFollowUpModal';
import './Cvp.css';

export const CaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [call, setCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isScheduleOpen, setIsScheduleOpen] = useState<boolean>(false);
  const [isCloseOpen, setIsCloseOpen] = useState<boolean>(false);
  const [isPostponeOpen, setIsPostponeOpen] = useState<boolean>(false);
  const [isFollowUpOpen, setIsFollowUpOpen] = useState<boolean>(false);

  // Notification Banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadCallData(id);
    }
  }, [id]);

  const loadCallData = async (callId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await cvpService.getCallById(callId);
      if (!data) {
        setError('Case record could not be found.');
      } else {
        setCall(data);
      }
    } catch (err: any) {
      console.error('Failed to load call details:', err);
      setError(err?.message || 'Error loading case details.');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const cleanPhone = (phone?: string) => (phone ? phone.replace(/[^0-9+]/g, '') : '');

  const handlePhoneCall = () => {
    const phone = cleanPhone(call?.callerPhone);
    if (phone) window.open(`tel:${phone}`, '_self');
  };

  const handleWhatsApp = () => {
    const phone = cleanPhone(call?.callerPhone);
    if (!phone) return;
    const msg = encodeURIComponent(
      `Hello ${call?.ownerName || 'Sir/Madam'}, this is Dr. from VetRx regarding your call for ${call?.species || 'animal'}.`
    );
    window.open(`https://wa.me/${phone.replace('+', '')}?text=${msg}`, '_blank');
  };

  const handleOpenMap = () => {
    if (!call) return;
    if (call.latitude && call.longitude) {
      window.open(`https://maps.google.com/?q=${call.latitude},${call.longitude}`, '_blank');
    } else if (call.locationAddress) {
      window.open(`https://maps.google.com/?q=${encodeURIComponent(call.locationAddress)}`, '_blank');
    }
  };

  // Schedule Visit Handler
  const handleScheduleConfirm = async (scheduleData: any) => {
    if (!call?.id) return;
    const result = await cvpService.scheduleCall(call.id, scheduleData);
    setCall(result.call);
    showToast('Visit successfully scheduled and linked to this case!');
    await loadCallData(String(call.id));
  };

  // Close Case Handler
  const handleCloseConfirm = async (reason: string, details?: string, notes?: string) => {
    if (!call?.id) return;
    const updated = await cvpService.closeCall(call.id, reason, details, notes);
    setCall(updated);
    showToast('Case closed without visit. Records preserved.');
  };

  // Postpone Call Handler
  const handlePostponeConfirm = async (_callId: string, targetDate: string, reason: string) => {
    if (!call?.id) return;
    await cvpService.postponeCall(call.id, targetDate, reason);
    setIsPostponeOpen(false);
    showToast(`Case postponed to ${targetDate}.`);
    await loadCallData(String(call.id));
  };

  // Emergency 1-Click Dispatch
  const handleEmergencyDispatch = async () => {
    if (!call?.id) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      await cvpService.scheduleCall(call.id, {
        scheduledDate: today,
        priority: 'EMERGENCY',
        flexibility: 'MUST_ATTEND_TODAY',
        preferredTime: 'Immediate Emergency',
        address: call.locationAddress || 'Client Location',
        latitude: call.latitude,
        longitude: call.longitude,
        addToTodayPlan: true,
        cases: [
          {
            chiefComplaint: call.symptoms,
            procedureCategory: 'EMERGENCY',
            species: call.species || 'Bovine',
            patientName: call.tempPatientName || undefined,
            tentativeDiagnosis: call.tentativeAssessment,
          },
        ],
      });
      showToast('Emergency visit created and inserted into Today’s Plan!');
      await loadCallData(String(call.id));
    } catch (err: any) {
      console.error('Emergency dispatch error:', err);
      alert('Could not dispatch emergency visit: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-700 mb-3" />
        <p className="text-sm font-semibold">Loading case records...</p>
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-slate-900 mb-1">Case Not Found</h2>
        <p className="text-xs text-slate-500 mb-4">{error || 'This case does not exist or was deleted.'}</p>
        <button
          type="button"
          onClick={() => navigate('/calls')}
          className="btn-cvp-primary mx-auto"
        >
          Return to Calls Queue
        </button>
      </div>
    );
  }

  const linkedVisit = call.linkedVisit || (call.visits && call.visits.length > 0 ? call.visits[0] : null);

  const priorityBadge =
    call.priority === 'EMERGENCY'
      ? { label: 'CRITICAL EMERGENCY', bg: 'bg-red-600 text-white border-red-700', icon: '🚨' }
      : call.priority === 'URGENT'
      ? { label: 'URGENT', bg: 'bg-amber-700 text-white border-amber-800', icon: '⚡' }
      : call.priority === 'COULD_NOT_ASSESS'
      ? { label: 'UNASSESSED', bg: 'bg-purple-600 text-white border-purple-700', icon: '❓' }
      : { label: 'PLANNED ROUTINE', bg: 'bg-teal-700 text-white border-teal-800', icon: '📅' };

  return (
    <div className="cvp-container max-w-4xl mx-auto px-3 sm:px-6 py-4 pb-28 font-sans text-slate-800 animate-fade-in">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-teal-800 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-slide-in">
          <CheckCircle2 className="w-4 h-4 text-teal-300 stroke-[2.5]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate('/calls')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-teal-800 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Calls</span>
        </button>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-black border flex items-center gap-1.5 ${priorityBadge.bg}`}>
            <span>{priorityBadge.icon}</span>
            <span>{priorityBadge.label}</span>
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {call.status === 'LOGGED'
              ? '📥 Logged'
              : call.status === 'SCHEDULED'
              ? '📅 Visit Scheduled'
              : '✕ Closed'}
          </span>
        </div>
      </div>

      {/* Case Header Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-sm mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-800 border border-teal-100 flex items-center justify-center font-black text-lg shrink-0">
              <User className="w-6 h-6 text-teal-700" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Farmer / Client
              </span>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                {call.ownerName || call.tempOwnerName || 'Direct Caller'}
              </h1>
              <div className="text-xs text-slate-500 font-semibold mt-0.5">
                📞 {call.callerPhone}
              </div>
            </div>
          </div>

          {/* Contact Fast Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePhoneCall}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-sky-50 text-sky-800 hover:bg-sky-100 font-bold text-xs flex items-center gap-1.5 transition-colors border border-sky-200"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call Client</span>
            </button>
            <button
              type="button"
              onClick={handleWhatsApp}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold text-xs flex items-center gap-1.5 transition-colors border border-emerald-200"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Clinical Intake & Symptoms Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Reported Symptoms &amp; Complaints
            </span>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-medium text-slate-800 leading-relaxed">
              {call.symptoms}
            </div>
          </div>

          <div className="space-y-3">
            {call.tentativeAssessment && (
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Tentative Assessment
                </span>
                <p className="text-xs font-bold text-slate-800 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/80 text-amber-900">
                  {call.tentativeAssessment}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Animal / Species</span>
                <span className="font-bold text-slate-800">
                  {call.species || 'Cattle'} {call.animalCount && call.animalCount > 1 ? `(${call.animalCount})` : ''}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Flexibility</span>
                <span className="font-bold text-slate-800">
                  {call.flexibility?.replace(/_/g, ' ') || 'Must Attend Today'}
                </span>
              </div>
            </div>

            {call.plannedProcedure && (
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                  Planned Procedure
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-50 text-teal-800 text-xs font-bold border border-teal-200">
                  💉 {call.plannedProcedure}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Location Section */}
        {call.locationAddress && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 min-w-0">
              <MapPin className="w-4 h-4 text-teal-700 shrink-0" />
              <span className="truncate">{call.locationAddress}</span>
            </div>
            <button
              type="button"
              onClick={handleOpenMap}
              className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 shrink-0"
            >
              <span>View Map</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Operational Next-Action Workflow Section */}
      <div className="mb-4">
        {call.status === 'LOGGED' && (
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 text-white shadow-xl space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-teal-300">
                Next Operational Decision
              </span>
              <h2 className="text-lg font-black mt-0.5">
                Ready to Schedule Field Visit?
              </h2>
              <p className="text-xs text-teal-100/80 leading-relaxed max-w-xl">
                This call is logged in triage. Select an action below to confirm a scheduled visit, dispatch emergency care, or resolve the request.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              {/* Primary Schedule Action */}
              <button
                type="button"
                onClick={() => setIsScheduleOpen(true)}
                className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-teal-500 hover:bg-teal-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-teal-500/25 flex items-center gap-2 transition-all"
              >
                <Calendar className="w-4 h-4 stroke-[2.5]" />
                <span>Schedule Visit</span>
              </button>

              {/* Emergency Fast Path */}
              {(call.priority === 'EMERGENCY' || call.priority === 'URGENT') && (
                <button
                  type="button"
                  onClick={handleEmergencyDispatch}
                  className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-xs sm:text-sm shadow-lg shadow-red-600/30 flex items-center gap-2 transition-all"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Immediate Emergency (Today)</span>
                </button>
              )}

              {/* Postpone */}
              <button
                type="button"
                onClick={() => setIsPostponeOpen(true)}
                className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-colors border border-white/10"
              >
                <Clock className="w-4 h-4" />
                <span>Postpone</span>
              </button>

              {/* Close Without Visit */}
              <button
                type="button"
                onClick={() => setIsCloseOpen(true)}
                className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-colors border border-white/10"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Close Case (No Visit)</span>
              </button>
            </div>
          </div>
        )}

        {/* When Visit is Already Scheduled */}
        {call.status === 'SCHEDULED' && linkedVisit && (
          <div className="p-5 sm:p-6 rounded-3xl bg-white border border-teal-200/80 shadow-md space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider block">
                  Active Operational Link
                </span>
                <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                  Physical Visit Confirmed &amp; Scheduled
                </h2>
                <p className="text-xs text-slate-500">
                  Scheduled for{' '}
                  <span className="font-bold text-slate-800">
                    {typeof linkedVisit.scheduledDate === 'string'
                      ? linkedVisit.scheduledDate.split('T')[0]
                      : new Date(linkedVisit.scheduledDate).toLocaleDateString()}
                  </span>{' '}
                  • Status: <span className="font-bold text-teal-700">{linkedVisit.status}</span>
                </p>
              </div>

              <span className="px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-bold border border-teal-200">
                Visit Linked
              </span>
            </div>

            {/* Field Execution Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => navigate(`/calls/visits/${linkedVisit.id}`)}
                className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-teal-700 hover:bg-teal-800 active:scale-95 text-white font-black text-xs sm:text-sm shadow-md shadow-teal-700/20 flex items-center gap-2 transition-all"
              >
                <Play className="w-4 h-4 stroke-[2.5]" />
                <span>Open in Field Mode</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/calls/plan')}
                className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Activity className="w-4 h-4" />
                <span>View Route Planning</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFollowUpOpen(true)}
                className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Follow-up</span>
              </button>
            </div>
          </div>
        )}

        {/* When Case is Cancelled/Closed */}
        {call.status === 'CANCELLED' && (
          <div className="p-5 rounded-3xl bg-slate-100 border border-slate-200 text-slate-700 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <CheckCircle2 className="w-4 h-4 text-slate-500" />
              <span>Case Closed Without Visit</span>
            </div>
            {call.notes && (
              <p className="text-xs text-slate-600 font-medium">
                Closure Record: {call.notes}
              </p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsScheduleOpen(true)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 text-white font-bold text-xs hover:bg-teal-800 transition-colors"
              >
                Re-open &amp; Schedule Visit
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Case History & Audit Trail */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Case History &amp; Audit Trail
        </h3>
        <div className="space-y-2 text-xs text-slate-600">
          <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
            <span>Call Registered &amp; Logged</span>
            <span className="font-semibold text-slate-800">
              {new Date(call.createdAt).toLocaleString()}
            </span>
          </div>
          {call.updatedAt && (
            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
              <span>Last Status Update</span>
              <span className="font-semibold text-slate-800">
                {new Date(call.updatedAt).toLocaleString()}
              </span>
            </div>
          )}
          {linkedVisit && (
            <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
              <span>Visit Link Established</span>
              <span className="font-semibold text-teal-700 font-mono">
                Visit Status: {linkedVisit.status}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <ScheduleVisitModal
        isOpen={isScheduleOpen}
        call={call}
        onClose={() => setIsScheduleOpen(false)}
        onConfirmSchedule={handleScheduleConfirm}
      />

      <CloseCallModal
        isOpen={isCloseOpen}
        call={call}
        onClose={() => setIsCloseOpen(false)}
        onConfirmClose={handleCloseConfirm}
      />

      <PostponeModal
        isOpen={isPostponeOpen}
        call={call}
        onClose={() => setIsPostponeOpen(false)}
        onConfirm={handlePostponeConfirm}
      />

      <CreateFollowUpModal
        isOpen={isFollowUpOpen}
        practiceId={call.practiceId || 'demo-practice-id'}
        originVisitId={linkedVisit?.id}
        defaultOwnerId={typeof call.ownerId === 'number' ? call.ownerId : undefined}
        defaultOwnerName={call.ownerName || call.tempOwnerName}
        defaultPatientName={call.tempPatientName}
        defaultSpecies={call.species}
        onClose={() => setIsFollowUpOpen(false)}
        onCreated={() => {
          showToast('Follow-up scheduled successfully!');
        }}
      />
    </div>
  );
};
