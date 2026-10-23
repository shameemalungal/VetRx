// ==============================================================================
// VetRx Call & Visit Planner (CVP) — Post-Call Registration Prompt Modal
// Provides native post-call workflow prompt:
// - "Register this call in VetRx?"
// - Shows caller phone, matched owner/client, patient selection, timestamp, duration
// - Actions: Register Call, Record Visit, Schedule Follow-up, Add Clinical Note, Not Now
// ==============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { nativeService, type NativeCallPromptData } from '../../services/nativeService';
import { cvpService } from '../../services/cvpService';
import { formatPhoneForDisplay, normalizePhoneNumber } from '../../utils/phoneUtils';
import {
  PhoneCall,
  PhoneMissed,
  User,
  PawPrint,
  X,
  CheckCircle,
  CalendarPlus,
  FileText,
  Stethoscope,
  ArrowRight,
} from 'lucide-react';
import '../../pages/cvp/Cvp.css';

interface OwnerMatchResult {
  owner: any;
  patients: any[];
  locations: any[];
}

export const PostCallPromptModal: React.FC = () => {
  const navigate = useNavigate();
  const [promptData, setPromptData] = useState<NativeCallPromptData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [matchedOwners, setMatchedOwners] = useState<OwnerMatchResult[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<number | string | null>(null);
  const [isSearchingOwners, setIsSearchingOwners] = useState(false);

  // Keep track of prompted callEventIds to deduplicate
  const promptedEventsRef = useRef<Set<string>>(new Set());

  const handlePromptReceived = useCallback(async (data: NativeCallPromptData) => {
    if (!data || !data.callEventId) return;
    if (promptedEventsRef.current.has(data.callEventId)) return;

    promptedEventsRef.current.add(data.callEventId);
    setPromptData(data);
    setIsOpen(true);

    const rawPhone = data.phoneNumber || '';
    const normalized = normalizePhoneNumber(rawPhone);

    if (normalized && normalized.length >= 4) {
      setIsSearchingOwners(true);
      try {
        const results = await cvpService.findMatchingOwners(normalized);
        setMatchedOwners(results);
        if (results.length > 0) {
          const first = results[0];
          setSelectedOwnerId(first.owner.id);
          if (first.patients && first.patients.length > 0) {
            setSelectedPatientId(first.patients[0].id);
          }
        }
      } catch (err) {
        console.warn('[PostCallPromptModal] Error matching owners:', err);
      } finally {
        setIsSearchingOwners(false);
      }
    }
  }, []);

  // 1. Initial check & listener registration on mount
  useEffect(() => {
    let cleanupListener: (() => void) | undefined;

    const init = async () => {
      // Check if there is already a pending call prompt (e.g. app opened via notification)
      const pending = await nativeService.getPendingCallPrompt();
      if (pending) {
        handlePromptReceived(pending);
      }

      cleanupListener = await nativeService.addCallEndedListener((data) => {
        handlePromptReceived(data);
      });
    };

    void init();

    // Also re-check when app regains focus or visibility
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const pending = await nativeService.getPendingCallPrompt();
        if (pending) {
          handlePromptReceived(pending);
        }
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      cleanupListener?.();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [handlePromptReceived]);

  const handleDismiss = async () => {
    setIsOpen(false);
    setPromptData(null);
    setMatchedOwners([]);
    setSelectedOwnerId(null);
    setSelectedPatientId(null);
    await nativeService.dismissPendingCallPrompt();
  };

  if (!isOpen || !promptData) {
    return null;
  }

  const selectedMatch = matchedOwners.find((m) => m.owner.id === selectedOwnerId) || (matchedOwners.length > 0 ? matchedOwners[0] : null);
  const currentPatients = selectedMatch ? selectedMatch.patients || [] : [];

  const rawPhone = promptData.phoneNumber || '';
  const isMissed = (promptData.durationSeconds || 0) === 0;
  const callDurationText = isMissed
    ? 'Missed Call'
    : `${Math.floor(promptData.durationSeconds / 60)}m ${promptData.durationSeconds % 60}s`;

  const formattedTime = new Date(promptData.timestamp || Date.now()).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Action handlers
  const handleRegisterCall = async () => {
    await handleDismiss();
    const query = new URLSearchParams({
      phone: rawPhone,
      mode: 'after',
      source: 'TELEPHONY_DETECT',
    });
    if (selectedOwnerId) query.set('ownerId', String(selectedOwnerId));
    if (selectedPatientId) query.set('patientId', String(selectedPatientId));
    if (promptData.durationSeconds) query.set('duration', String(promptData.durationSeconds));
    navigate(`/calls/register?${query.toString()}`);
  };

  const handleRecordVisit = async () => {
    await handleDismiss();
    const query = new URLSearchParams({
      phone: rawPhone,
      mode: 'during',
      action: 'visit',
      source: 'TELEPHONY_DETECT',
    });
    if (selectedOwnerId) query.set('ownerId', String(selectedOwnerId));
    if (selectedPatientId) query.set('patientId', String(selectedPatientId));
    navigate(`/calls/register?${query.toString()}`);
  };

  const handleScheduleFollowUp = async () => {
    await handleDismiss();
    const query = new URLSearchParams({
      action: 'new',
      phone: rawPhone,
    });
    if (selectedOwnerId) query.set('ownerId', String(selectedOwnerId));
    if (selectedPatientId) query.set('patientId', String(selectedPatientId));
    navigate(`/follow-ups?${query.toString()}`);
  };

  const handleAddClinicalNote = async () => {
    await handleDismiss();
    if (selectedPatientId) {
      navigate(`/patients/${selectedPatientId}?action=add_note`);
    } else if (selectedOwnerId) {
      navigate(`/patients?ownerId=${selectedOwnerId}`);
    } else {
      navigate('/patients');
    }
  };

  return (
    <div
      className="cvp-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-call-prompt-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="post-call-prompt-modal-card"
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #00685F 0%, #004D46 100%)',
            color: '#ffffff',
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isMissed ? <PhoneMissed size={20} color="#fca5a5" /> : <PhoneCall size={20} color="#6ee7b7" />}
            </div>
            <div>
              <h2
                id="post-call-prompt-title"
                style={{
                  margin: 0,
                  fontSize: '17px',
                  fontWeight: 600,
                  lineHeight: 1.2,
                }}
              >
                Register this call in VetRx?
              </h2>
              <span style={{ fontSize: '12px', opacity: 0.9 }}>
                {isMissed ? 'Missed incoming call' : 'Completed phone call'} • {formattedTime}
              </span>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss call prompt"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              opacity: 0.8,
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Call Metadata Strip */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>
                Caller Number
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                {rawPhone ? formatPhoneForDisplay(rawPhone) : 'Private / Unavailable'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>
                Duration
              </div>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: isMissed ? '#dc2626' : '#059669',
                }}
              >
                {callDurationText}
              </div>
            </div>
          </div>

          {/* Owner Matching Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={14} color="#00685F" />
              Client / Owner
            </label>

            {isSearchingOwners ? (
              <div style={{ fontSize: '13px', color: '#64748b', padding: '6px 0' }}>Matching client in VetRx…</div>
            ) : matchedOwners.length > 1 ? (
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedOwnerId || ''}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedOwnerId(id);
                    const match = matchedOwners.find((m) => String(m.owner.id) === String(id));
                    if (match && match.patients && match.patients.length > 0) {
                      setSelectedPatientId(match.patients[0].id);
                    } else {
                      setSelectedPatientId(null);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    color: '#0f172a',
                    backgroundColor: '#ffffff',
                  }}
                >
                  {matchedOwners.map((m) => (
                    <option key={m.owner.id} value={m.owner.id}>
                      {m.owner.name} ({m.owner.phone || 'No phone'}) — {m.patients?.length || 0} animals
                    </option>
                  ))}
                </select>
              </div>
            ) : matchedOwners.length === 1 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={16} color="#16a34a" />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#166534' }}>
                    {matchedOwners[0].owner.name}
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: '#15803d' }}>
                  {matchedOwners[0].patients?.length || 0} animals registered
                </span>
              </div>
            ) : (
              <div
                style={{
                  fontSize: '13px',
                  color: '#64748b',
                  padding: '8px 12px',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '8px',
                  border: '1px dashed #cbd5e1',
                }}
              >
                Unregistered caller. You can create a client or register as new in the next step.
              </div>
            )}
          </div>

          {/* Associated Patient / Animal Selection */}
          {currentPatients.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PawPrint size={14} color="#00685F" />
                Select Patient / Animal
              </label>
              <select
                value={selectedPatientId || ''}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                }}
              >
                {currentPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.species || 'Animal'}) {p.tagNumber ? `— Tag #${p.tagNumber}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            {/* 1. Register Call */}
            <button
              onClick={handleRegisterCall}
              style={{
                width: '100%',
                padding: '11px 16px',
                borderRadius: '10px',
                backgroundColor: '#00685F',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(0, 104, 95, 0.2)',
              }}
            >
              <PhoneCall size={16} />
              Register Call
              <ArrowRight size={16} style={{ marginLeft: 'auto' }} />
            </button>

            {/* 2. Record Visit */}
            <button
              onClick={handleRecordVisit}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '10px',
                backgroundColor: '#f0fdfa',
                color: '#00685F',
                border: '1px solid #ccfbf1',
                fontWeight: 600,
                fontSize: '13.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Stethoscope size={16} />
              Record Visit
            </button>

            {/* Secondary Action Row: Schedule Follow-up & Add Clinical Note */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                onClick={handleScheduleFollowUp}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#f8fafc',
                  color: '#334155',
                  border: '1px solid #e2e8f0',
                  fontWeight: 500,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <CalendarPlus size={14} color="#00685F" />
                Schedule Follow-up
              </button>

              <button
                onClick={handleAddClinicalNote}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#f8fafc',
                  color: '#334155',
                  border: '1px solid #e2e8f0',
                  fontWeight: 500,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <FileText size={14} color="#00685F" />
                Add Clinical Note
              </button>
            </div>

            {/* 5. Not Now (Dismiss without creating any record) */}
            <button
              onClick={handleDismiss}
              style={{
                width: '100%',
                padding: '9px 16px',
                borderRadius: '10px',
                backgroundColor: 'transparent',
                color: '#64748b',
                border: 'none',
                fontWeight: 500,
                fontSize: '13px',
                cursor: 'pointer',
                textAlign: 'center',
                marginTop: '2px',
              }}
            >
              Not Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
