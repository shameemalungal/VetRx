// ==============================================================================
// VetRx Call & Visit Planner (CVP) — Call Registration Page
// Canonical Implementation for:
// - CVP-03: Register Call After Call
// - CVP-04: Register Call During Call (Fast Intake)
// - CVP-05: Owner Selection
// - CVP-06: New Owner
// - CVP-07: Patient Selection
// - CVP-08: Quick New Patient
// - CVP-09: Call Details
// - CVP-10: Location Selection
// - CVP-11: New Call Summary
// - CVP-44: Call Details Extended
// - CVP-46: Search Owner Match After Phone Call
// - CVP-47: Location Match
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cvpService } from '../../services/cvpService';
import type { Call, CallPriority, VisitFlexibility, OwnerLocation } from '../../types/cvp';
import { OwnerMatchCard } from '../../components/cvp/OwnerMatchCard';
import { QuickNewOwnerModal } from '../../components/cvp/QuickNewOwnerModal';
import { QuickNewPatientModal } from '../../components/cvp/QuickNewPatientModal';
import { LocationPicker } from '../../components/cvp/LocationPicker';
import { CallSummaryView } from '../../components/cvp/CallSummaryView';
import { extractPhoneNumber, normalizePhoneNumber } from '../../utils/phoneUtils';
import {
  PhoneCall,
  PhoneForwarded,
  ArrowLeft,
  UserPlus,
  PawPrint,
  CheckCircle2,
  AlertCircle,
  Navigation,
  Check,
  ChevronRight,
  Clipboard,
  Smartphone,
  ShieldCheck,
  Link2,
  Search,
  X,
} from 'lucide-react';
import './Cvp.css';

const COMMON_SYMPTOM_TAGS = [
  'Dystocia / Calving Stalled',
  'Acute Mastitis / Swollen Quarter',
  'Bloat / Tympanites',
  'High Fever / Off Feed',
  'Downer Cow / Milk Fever',
  'Wound / Trauma',
  'Anorexia / Dullness',
  'Artificial Insemination (AI)',
  'Deworming & Vaccination',
  'Routine Health Check',
];

const SPECIES_PILLS = ['Bovine', 'Caprine', 'Canine', 'Feline', 'Equine', 'Avian'];

export const CallRegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { practice } = useAuth();
  const practiceId = practice?.id || 'demo-practice-id';

  // Mode: 'during' (CVP-04: single screen rapid triage) vs 'after' (CVP-03: guided stepper)
  const [mode, setMode] = useState<'during' | 'after'>(
    searchParams.get('mode') === 'during' ? 'during' : 'after'
  );

  // Stepper state for 'after' mode: 1 = Owner, 2 = Patient, 3 = Clinical, 4 = Location, 5 = Summary
  const [step, setStep] = useState<number>(1);

  // Modals state
  const [isNewOwnerOpen, setIsNewOwnerOpen] = useState(false);
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);

  // Link alternate phone state (Stage 1.3)
  const [isLinkPhoneModalOpen, setIsLinkPhoneModalOpen] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkSearchResults, setLinkSearchResults] = useState<Array<{ owner: any; patients: any[]; locations: OwnerLocation[] }>>([]);
  const [linkSelectedMatch, setLinkSelectedMatch] = useState<{ owner: any; patients: any[]; locations: OwnerLocation[] } | null>(null);
  const [isLinkingPhone, setIsLinkingPhone] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Android Call Capture & Intake Origin state
  const [callSource, setCallSource] = useState<'MANUAL' | 'ANDROID_SHARE' | 'CLIPBOARD_IMPORT'>('MANUAL');
  const [pasteNotification, setPasteNotification] = useState<string | null>(null);

  // Form State
  const [callerPhone, setCallerPhone] = useState(searchParams.get('phone') || '');
  const [selectedOwner, setSelectedOwner] = useState<any | null>(null);
  const [tempOwnerName, setTempOwnerName] = useState('');
  
  // Matched owners from search
  const [matchedOwners, setMatchedOwners] = useState<Array<{
    owner: any;
    patients: any[];
    locations: OwnerLocation[];
  }>>([]);
  const [isSearchingOwners, setIsSearchingOwners] = useState(false);

  // Patients state
  const [ownerPatients, setOwnerPatients] = useState<any[]>([]);
  const [selectedPatientIds, setSelectedPatientIds] = useState<number[]>([]);
  const [tempPatientName, setTempPatientName] = useState('');
  const [species, setSpecies] = useState('Bovine');
  const [animalCount, setAnimalCount] = useState(1);

  // Clinical Details (CVP-09 & CVP-44)
  const [symptoms, setSymptoms] = useState('');
  const [tentativeAssessment, setTentativeAssessment] = useState('');
  const [plannedProcedure, setPlannedProcedure] = useState('');
  const [priority, setPriority] = useState<CallPriority>('URGENT');
  const [flexibility, setFlexibility] = useState<VisitFlexibility>('MUST_ATTEND_TODAY');
  const [preferredDate, setPreferredDate] = useState(new Date().toISOString().split('T')[0]);
  const [preferredTimeWindow, setPreferredTimeWindow] = useState('MORNING');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Location state (CVP-10 & CVP-47)
  const [savedLocations, setSavedLocations] = useState<OwnerLocation[]>([]);
  const [locationAddress, setLocationAddress] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [selectedLocationId, setSelectedLocationId] = useState<number | string | undefined>();

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Read Android Web Share Target or initial params on mount ──────
  useEffect(() => {
    const rawPhone = searchParams.get('phone');
    const sharedText = searchParams.get('shared_text') || searchParams.get('text');

    if (rawPhone) {
      const normalized = normalizePhoneNumber(rawPhone);
      setCallerPhone(normalized);
      setCallSource('ANDROID_SHARE');
      setPasteNotification(`Captured phone ${normalized} from Android incoming call share`);
    } else if (sharedText) {
      const extracted = extractPhoneNumber(sharedText);
      if (extracted) {
        setCallerPhone(extracted);
        setCallSource('ANDROID_SHARE');
        setPasteNotification(`Extracted ${extracted} from shared text`);
      }
    }
  }, [searchParams]);

  // 1-tap clipboard import from phone dialer
  const handlePasteFromDialer = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        setPasteNotification('Clipboard access not supported in this browser. Please type or paste manually.');
        return;
      }
      const clipText = await navigator.clipboard.readText();
      const extracted = extractPhoneNumber(clipText);
      if (extracted) {
        setCallerPhone(extracted);
        setCallSource('CLIPBOARD_IMPORT');
        setPasteNotification(`Imported ${extracted} from dialer clipboard`);
      } else if (clipText.trim()) {
        const normalized = normalizePhoneNumber(clipText.trim());
        setCallerPhone(normalized);
        setCallSource('CLIPBOARD_IMPORT');
        setPasteNotification(`Pasted text from clipboard: ${normalized}`);
      } else {
        setPasteNotification('Clipboard is empty. Copy a number from your phone dialer and tap again.');
      }
    } catch {
      setPasteNotification('Clipboard permission prompt dismissed. Please enter phone number manually.');
    }
  };

  // ── Auto-match owners when phone changes (CVP-46) ───────────────────
  useEffect(() => {
    async function matchOwners() {
      const cleaned = callerPhone.trim();
      if (cleaned.length >= 3) {
        setIsSearchingOwners(true);
        try {
          const results = await cvpService.findMatchingOwners(cleaned);
          setMatchedOwners(results);
          if (results.length === 1 && !selectedOwner) {
            // Auto-attach if single exact match
            handleSelectOwner(results[0]);
          }
        } catch (err) {
          console.error('Owner match search error:', err);
        } finally {
          setIsSearchingOwners(false);
        }
      } else {
        setMatchedOwners([]);
      }
    }
    const timer = setTimeout(matchOwners, 300);
    return () => clearTimeout(timer);
  }, [callerPhone]);

  // Search clients for linking alternate phone (Stage 1.3)
  useEffect(() => {
    if (!isLinkPhoneModalOpen) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const query = linkSearchQuery.trim();
        const results = await cvpService.findMatchingOwners(query || callerPhone || 'a');
        if (active) setLinkSearchResults(results);
      } catch (err) {
        console.warn('Error searching owners for phone linking:', err);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isLinkPhoneModalOpen, linkSearchQuery, callerPhone]);

  // Load patients and locations when owner selected
  const handleSelectOwner = (matchItem: { owner: any; patients: any[]; locations: OwnerLocation[] }) => {
    setSelectedOwner(matchItem.owner);
    setTempOwnerName(matchItem.owner.name);
    setOwnerPatients(matchItem.patients || []);
    setSavedLocations(matchItem.locations || []);

    // Auto-select primary patient if only one exists
    if (matchItem.patients?.length === 1) {
      setSelectedPatientIds([matchItem.patients[0].id]);
      setSpecies(matchItem.patients[0].species || 'Bovine');
    }

    // Auto-prefill default location
    const defaultLoc = matchItem.locations?.find((l) => l.isDefault) || matchItem.locations?.[0];
    if (defaultLoc) {
      setLocationAddress(defaultLoc.address);
      setLatitude(defaultLoc.latitude);
      setLongitude(defaultLoc.longitude);
      setSelectedLocationId(defaultLoc.id);
    } else if (matchItem.owner.address) {
      setLocationAddress(matchItem.owner.address);
    }
  };

  // Toggle patient selection (supports multiple animals for 1 visit!)
  const togglePatient = (patientId: number, patientSpecies?: string) => {
    setSelectedPatientIds((prev) => {
      const exists = prev.includes(patientId);
      if (exists) {
        const next = prev.filter((id) => id !== patientId);
        setAnimalCount(Math.max(1, next.length));
        return next;
      } else {
        const next = [...prev, patientId];
        setAnimalCount(next.length);
        if (patientSpecies) setSpecies(patientSpecies);
        return next;
      }
    });
  };

  // Handle symptom tag click
  const addSymptomTag = (tag: string) => {
    if (!symptoms) {
      setSymptoms(tag);
    } else if (!symptoms.includes(tag)) {
      setSymptoms(`${symptoms}, ${tag}`);
    }
  };

  // Construct draft call record
  const getDraftCall = (): Partial<Call> => {
    const selectedPatientsList = ownerPatients
      .filter((p) => selectedPatientIds.includes(p.id))
      .map((p) => ({ id: p.id, name: p.name, species: p.species }));

    return {
      practiceId,
      callerPhone: callerPhone.trim(),
      ownerId: selectedOwner?.id,
      ownerName: selectedOwner?.name,
      tempOwnerName: selectedOwner?.name || tempOwnerName.trim() || 'Direct Caller',
      patientIds: selectedPatientIds,
      selectedPatients: selectedPatientsList,
      tempPatientName: tempPatientName.trim() || undefined,
      species: species,
      animalCount: Math.max(1, selectedPatientIds.length || animalCount),
      symptoms: symptoms.trim() || 'General assessment requested',
      tentativeAssessment: tentativeAssessment.trim() || undefined,
      plannedProcedure: plannedProcedure.trim() || undefined,
      priority,
      flexibility,
      preferredDate,
      preferredTimeWindow,
      specialInstructions: specialInstructions.trim() || undefined,
      locationAddress: locationAddress.trim() || undefined,
      locationId: selectedLocationId,
      latitude,
      longitude,
      status: 'LOGGED',
    };
  };

  // Final Call Save (both during and after modes)
  const handleSaveCall = async () => {
    // Basic validation: phone OR owner name required
    if (!callerPhone.trim() && !tempOwnerName.trim() && !selectedOwner?.name) {
      setErrorMessage('Please enter either a caller phone number or owner name.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const draft = getDraftCall();
      await cvpService.createCall(draft as any);

      setSaveSuccess(true);
      setTimeout(() => {
        navigate('/calls');
      }, 1000);
    } catch (err: any) {
      console.error('Failed to save call:', err);
      setErrorMessage(err?.message || 'Could not save call. Entered details remain preserved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="cvp-container max-w-3xl mx-auto px-3 sm:px-6 py-4 pb-28 font-sans text-slate-800 animate-fade-in">
      {/* Top Header & Navigation */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate('/calls')}
          className="btn-back"
          id="btn-back-to-calls"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Calls</span>
        </button>

        {/* Mode Switcher: During Call (Speed) vs After Call (Guided) */}
        <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('during')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              mode === 'during'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>During Call</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('after')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              mode === 'after'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PhoneForwarded className="w-3.5 h-3.5" />
            <span>After Call</span>
          </button>
        </div>
      </div>

      {/* Save Success Banner */}
      {saveSuccess && (
        <div className="mb-4 p-4 rounded-2xl bg-emerald-600 text-white shadow-lg flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <div>
            <div className="font-extrabold text-sm">Call Logged Successfully!</div>
            <div className="text-xs text-emerald-100">
              Saved locally to your practice queue and synced. Redirecting to calls list...
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Android Call-Capture Lifecycle & Privacy Banner */}
      <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-teal-50 via-slate-50 to-indigo-50 border border-teal-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start gap-2.5">
            <span className="p-2 rounded-xl bg-teal-600 text-white shrink-0 mt-0.5">
              <Smartphone className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-slate-900">
                  Android Call Intake
                </span>
                <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 text-[10px] font-black tracking-wide uppercase">
                  {callSource === 'ANDROID_SHARE'
                    ? 'Android Share Target'
                    : callSource === 'CLIPBOARD_IMPORT'
                    ? 'Dialer Paste'
                    : 'Manual Intake'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                  Intake Stage: Draft Event (Not confirmed visit)
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                Privacy-first telephony integration. Phone events remain draft call intakes until registered and explicitly scheduled into a visit.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={handlePasteFromDialer}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-teal-50 text-teal-800 text-xs font-bold border border-teal-300 shadow-xs transition-all active:scale-95"
              id="android-btn-paste-dialer-top"
              title="Paste copied caller number from Android dialer"
            >
              <Clipboard className="w-3.5 h-3.5 text-teal-700" />
              <span>Paste from Dialer</span>
            </button>
          </div>
        </div>

        {pasteNotification && (
          <div className="mt-2.5 pt-2 border-t border-teal-200/60 flex items-center justify-between text-[11px] text-teal-900 font-semibold bg-white/70 px-2.5 py-1 rounded-lg">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>{pasteNotification}</span>
            </span>
            <button
              type="button"
              onClick={() => setPasteNotification(null)}
              className="text-slate-400 hover:text-slate-700 font-black ml-2 px-1"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* MODE 1: DURING CALL FAST INTAKE                                     */}
      {/* =================================================================== */}
      {mode === 'during' && (
        <div className="space-y-4 pb-36 md:pb-24">
          <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-xs font-black uppercase tracking-wider text-teal-700">
                Rapid Clinical Intake Pad
              </span>
              <h2 className="text-lg font-black text-slate-900 leading-tight">
                Active Call Intake
              </h2>
              <p className="text-xs text-slate-500">
                Quickly capture key caller and triage facts with zero mandatory friction.
              </p>
            </div>

            {/* Caller Phone */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                <span>Caller Phone Number</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePasteFromDialer}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-bold border border-teal-200 transition-all"
                    id="btn-paste-during"
                  >
                    <Clipboard className="w-3 h-3 text-teal-700" />
                    <span>Paste Dialer</span>
                  </button>
                  {isSearchingOwners && <span className="text-[11px] text-teal-600 lowercase font-medium animate-pulse">searching client directory...</span>}
                </div>
              </div>
              <div className="relative">
                <PhoneCall className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  value={callerPhone}
                  onChange={(e) => setCallerPhone(e.target.value)}
                  placeholder="e.g. +91 98450 11223"
                  className="w-full pl-10 pr-3.5 py-2.5 text-base sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-bold text-slate-900"
                  autoFocus
                />
              </div>
            </div>

            {/* Auto Match Prompt (CVP-46) */}
            {matchedOwners.length > 0 && !selectedOwner && (
              <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200 space-y-2">
                <div className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-teal-700 stroke-[3]" />
                  <span>Found {matchedOwners.length} matching client(s) on file</span>
                </div>
                <div className="space-y-2">
                  {matchedOwners.map((m) => (
                    <OwnerMatchCard
                      key={m.owner.id}
                      owner={m.owner}
                      patients={m.patients}
                      locations={m.locations}
                      isSelected={selectedOwner?.id === m.owner.id}
                      onSelect={() => handleSelectOwner(m)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Client / Owner Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Owner / Farmer Name
                </label>
                <input
                  type="text"
                  value={selectedOwner?.name || tempOwnerName}
                  onChange={(e) => {
                    setTempOwnerName(e.target.value);
                    if (selectedOwner) setSelectedOwner(null);
                  }}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Animal / Tag Description
                </label>
                <input
                  type="text"
                  value={tempPatientName}
                  onChange={(e) => setTempPatientName(e.target.value)}
                  placeholder="e.g. Jersey Cow #4, Black Dog"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium"
                />
              </div>
            </div>

            {/* Species Quick Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Species
              </label>
              <div className="flex flex-wrap gap-1.5">
                {SPECIES_PILLS.map((sp) => (
                  <button
                    type="button"
                    key={sp}
                    onClick={() => setSpecies(sp)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                      species === sp
                        ? 'bg-teal-700 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {sp}
                  </button>
                ))}
              </div>
            </div>

            {/* Triage Priority Selector */}
            <div>
              <label className="cvp-form-field-label">
                Clinical Priority Triage
              </label>
              <div className="cvp-priority-grid">
                <button
                  type="button"
                  onClick={() => setPriority('EMERGENCY')}
                  className={`cvp-priority-card-btn emergency ${priority === 'EMERGENCY' ? 'selected' : ''}`}
                >
                  <span>🚨</span>
                  <span>Emergency</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPriority('URGENT')}
                  className={`cvp-priority-card-btn urgent ${priority === 'URGENT' ? 'selected' : ''}`}
                >
                  <span>⚡</span>
                  <span>Urgent</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPriority('COULD_NOT_ASSESS')}
                  className={`cvp-priority-card-btn unassessed ${priority === 'COULD_NOT_ASSESS' ? 'selected' : ''}`}
                >
                  <span>❓</span>
                  <span>Unassessed</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPriority('PLANNED')}
                  className={`cvp-priority-card-btn planned ${priority === 'PLANNED' ? 'selected' : ''}`}
                >
                  <span>📅</span>
                  <span>Planned</span>
                </button>
              </div>
            </div>

            {/* Symptoms & Quick Tags */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Reported Symptoms / Complaints
                </label>
                <span className="text-[11px] text-slate-400">Tap common tags or type</span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_SYMPTOM_TAGS.slice(0, 6).map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => addSymptomTag(tag)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-600 text-[11px] font-semibold transition-all"
                  >
                    + {tag}
                  </button>
                ))}
              </div>

              <textarea
                rows={2}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="e.g. Cow down since 4 hours after calving, labored breathing"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium resize-none"
              />
            </div>

            {/* Location (CVP-10) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Farm / Visit Location
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  placeholder="e.g. Near Milk Chilling Center, Survey 42"
                  className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition((pos) => {
                        setLatitude(pos.coords.latitude);
                        setLongitude(pos.coords.longitude);
                      });
                    }
                  }}
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-800 transition-all shrink-0"
                  title="Capture GPS"
                >
                  <Navigation className="w-4 h-4 text-teal-700" />
                </button>
              </div>
            </div>
          </div>

          {/* Sticky Bottom Quick Save (Positions cleanly above mobile bottom nav) */}
          <div
            className="fixed bottom-quick-save left-0 right-0 p-3 sm:p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl z-40"
            style={{
              zIndex: 90,
            }}
          >
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setMode('after')}
                className="min-h-[44px] px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all"
              >
                Switch to Guided View
              </button>

              <button
                type="button"
                onClick={handleSaveCall}
                disabled={isSubmitting}
                className="min-h-[44px] px-6 py-2.5 rounded-2xl bg-teal-700 hover:bg-teal-800 active:scale-95 text-white text-sm font-black shadow-lg shadow-teal-700/25 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>Quick Save Call</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODE 2: AFTER CALL GUIDED INTAKE (CVP-03)                            */}
      {/* =================================================================== */}
      {mode === 'after' && (
        <div className="space-y-4">
          {/* Stepper Progress Bar */}
          <div className="cvp-stepper-container" role="tablist">
            {[
              { num: 1, label: 'Client' },
              { num: 2, label: 'Animals' },
              { num: 3, label: 'Triage' },
              { num: 4, label: 'Location' },
              { num: 5, label: 'Review' },
            ].map((st) => (
              <button
                type="button"
                key={st.num}
                role="tab"
                aria-selected={step === st.num}
                onClick={() => setStep(st.num)}
                className={`cvp-step-btn ${
                  step === st.num
                    ? 'active'
                    : step > st.num
                    ? 'completed'
                    : ''
                }`}
              >
                <span className="cvp-step-badge">
                  {st.num}
                </span>
                <span>{st.label}</span>
              </button>
            ))}
          </div>

          {/* STEP 1: CLIENT & OWNER MATCH (CVP-03, CVP-05, CVP-46) */}
          {step === 1 && (
            <div className="cvp-card-container animate-fade-in">
              <div className="cvp-card-header">
                <span className="cvp-card-step-tag">
                  Step 1 of 5
                </span>
                <h2 className="cvp-card-title">
                  Caller & Owner Matching
                </h2>
                <p className="cvp-card-subtitle">
                  Match caller phone against existing client records or register new owner.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  <span>Caller Phone Number <span className="text-red-500">*</span></span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePasteFromDialer}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold border border-teal-200 transition-all"
                      id="btn-paste-after"
                    >
                      <Clipboard className="w-3 h-3 text-teal-700" />
                      <span>Paste Dialer</span>
                    </button>
                    {isSearchingOwners && <span className="text-xs text-teal-600 lowercase font-medium animate-pulse">searching client directory...</span>}
                  </div>
                </div>
                <div className="relative">
                  <PhoneCall className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    value={callerPhone}
                    onChange={(e) => setCallerPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="cvp-form-control"
                    style={{ paddingLeft: '40px' }}
                    autoFocus
                  />
                </div>
              </div>

              {/* Matched Owners */}
              {matchedOwners.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Matching Clients ({matchedOwners.length})
                  </div>
                  <div className="space-y-2">
                    {matchedOwners.map((m) => (
                      <OwnerMatchCard
                        key={m.owner.id}
                        owner={m.owner}
                        patients={m.patients}
                        locations={m.locations}
                        isSelected={selectedOwner?.id === m.owner.id}
                        onSelect={() => handleSelectOwner(m)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Optional Temporary Farmer Name */}
              {!selectedOwner && (
                <div>
                  <label className="cvp-form-field-label">
                    Or Temporary Caller / Farmer Name
                  </label>
                  <input
                    type="text"
                    value={tempOwnerName}
                    onChange={(e) => setTempOwnerName(e.target.value)}
                    placeholder="e.g. Ramesh Patil (unregistered caller)"
                    className="cvp-form-control"
                  />
                </div>
              )}

              {/* Actions for New Owner or Temp Name */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsNewOwnerOpen(true)}
                    className="btn-cvp-secondary w-full sm:w-auto"
                  >
                    <UserPlus className="w-4 h-4 text-teal-700" />
                    <span>+ Quick New Owner</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLinkSearchQuery('');
                      setLinkSelectedMatch(null);
                      setLinkError(null);
                      setIsLinkPhoneModalOpen(true);
                    }}
                    className="btn-cvp-secondary w-full sm:w-auto text-teal-700 border-teal-300 hover:bg-teal-50"
                    title="Link this phone number as an alternate contact to an existing client"
                  >
                    <Link2 className="w-4 h-4 text-teal-700" />
                    <span>Link to Existing Client</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-cvp-primary w-full sm:w-auto"
                >
                  <span>Next: Animals</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ANIMAL & PATIENT SELECTION */}
          {step === 2 && (
            <div className="cvp-card-container animate-fade-in">
              <div className="cvp-card-header">
                <span className="cvp-card-step-tag">
                  Step 2 of 5
                </span>
                <h2 className="cvp-card-title">
                  Select Animals & Caseload
                </h2>
                <p className="cvp-card-subtitle">
                  Select animals to attend on this visit (multi-select for farm trips).
                </p>
              </div>

              {/* Registered Patients under this owner */}
              {ownerPatients.length > 0 ? (
                <div>
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Registered Animals for {selectedOwner?.name}
                  </div>
                  <div className="cvp-animal-grid">
                    {ownerPatients.map((p) => {
                      const isSelected = selectedPatientIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => togglePatient(p.id, p.species)}
                          className={`cvp-animal-card ${isSelected ? 'selected' : ''}`}
                        >
                          <div>
                            <div className="cvp-animal-name">
                              🐾 {p.name}
                            </div>
                            <div className="cvp-animal-meta">
                              {p.species} {p.breed ? `• ${p.breed}` : ''}
                            </div>
                          </div>

                          <div className="cvp-animal-check">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <p className="text-xs text-slate-500 mb-2">
                    No registered animals linked to this client yet.
                  </p>
                </div>
              )}

              {/* Quick Add Patient button */}
              {selectedOwner && (
                <div>
                  <button
                    type="button"
                    onClick={() => setIsNewPatientOpen(true)}
                    className="btn-cvp-secondary"
                  >
                    <PawPrint className="w-4 h-4 text-teal-700" />
                    <span>+ Quick New Animal</span>
                  </button>
                </div>
              )}

              {/* Unregistered / Temporary animal description */}
              <div>
                <label className="cvp-form-field-label">
                  Or Temporary Animal / Herd Description
                </label>
                <input
                  type="text"
                  value={tempPatientName}
                  onChange={(e) => setTempPatientName(e.target.value)}
                  placeholder="e.g. Jersey Cow #3 + 1 calf, or 5 Sheep"
                  className="cvp-form-control"
                />
              </div>

              {/* Species & Head count aligned responsively */}
              <div className="cvp-species-headcount-grid">
                <div>
                  <label className="cvp-form-field-label">
                    Primary Species
                  </label>
                  <select
                    value={species}
                    onChange={(e) => setSpecies(e.target.value)}
                    className="cvp-form-control"
                  >
                    {SPECIES_PILLS.map((sp) => (
                      <option key={sp} value={sp}>
                        {sp}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="cvp-form-field-label">
                    Animal Head Count
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={animalCount}
                    onChange={(e) => setAnimalCount(parseInt(e.target.value, 10) || 1)}
                    className="cvp-form-control"
                  />
                </div>
              </div>

              {/* Navigation Footer */}
              <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-cvp-secondary"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn-cvp-primary"
                >
                  <span>Next: Clinical Triage</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CLINICAL DETAILS & TRIAGE */}
          {step === 3 && (
            <div className="cvp-card-container animate-fade-in">
              <div className="cvp-card-header">
                <span className="cvp-card-step-tag">
                  Step 3 of 5
                </span>
                <h2 className="cvp-card-title">
                  Clinical Triage
                </h2>
                <p className="cvp-card-subtitle">
                  Capture symptoms, veterinarian tentative assessment, priority, and procedures.
                </p>
              </div>

              {/* Priority Selector */}
              <div>
                <label className="cvp-form-field-label">
                  Priority Level <span className="text-red-500">*</span>
                </label>
                <div className="cvp-priority-grid">
                  <button
                    type="button"
                    onClick={() => setPriority('EMERGENCY')}
                    className={`cvp-priority-card-btn emergency ${priority === 'EMERGENCY' ? 'selected' : ''}`}
                  >
                    <span>🚨</span>
                    <span>Emergency</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('URGENT')}
                    className={`cvp-priority-card-btn urgent ${priority === 'URGENT' ? 'selected' : ''}`}
                  >
                    <span>⚡</span>
                    <span>Urgent</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('COULD_NOT_ASSESS')}
                    className={`cvp-priority-card-btn unassessed ${priority === 'COULD_NOT_ASSESS' ? 'selected' : ''}`}
                  >
                    <span>❓</span>
                    <span>Unassessed</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPriority('PLANNED')}
                    className={`cvp-priority-card-btn planned ${priority === 'PLANNED' ? 'selected' : ''}`}
                  >
                    <span>📅</span>
                    <span>Planned</span>
                  </button>
                </div>
              </div>

              {/* Flexibility Selector */}
              <div>
                <label className="cvp-form-field-label">
                  Schedule Flexibility
                </label>
                <div className="cvp-flexibility-grid">
                  {[
                    { id: 'MUST_ATTEND_TODAY', label: 'Must Attend Today' },
                    { id: 'CAN_POSTPONE_TODAY', label: 'Can Postpone' },
                    { id: 'PREFERRED_TODAY', label: 'Preferred Today' },
                    { id: 'SPECIFIC_DATE', label: 'Specific Date' },
                  ].map((fl) => (
                    <button
                      type="button"
                      key={fl.id}
                      onClick={() => setFlexibility(fl.id as VisitFlexibility)}
                      className={`cvp-flex-btn ${flexibility === fl.id ? 'selected' : ''}`}
                    >
                      {fl.label}
                    </button>
                  ))}
                </div>
                {flexibility === 'SPECIFIC_DATE' && (
                  <div className="mt-2.5">
                    <label className="cvp-form-field-label">
                      Scheduled Visit Date
                    </label>
                    <input
                      type="date"
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      className="cvp-form-control"
                    />
                  </div>
                )}
              </div>

              {/* Symptoms */}
              <div>
                <label className="cvp-form-field-label">
                  Reported Symptoms <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_SYMPTOM_TAGS.map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => addSymptomTag(tag)}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-600 text-[11px] font-semibold transition-all"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  required
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="Describe owner's report in farmer's words..."
                  className="cvp-form-control"
                  style={{ resize: 'none' }}
                />
              </div>

              {/* Tentative Doctor Assessment */}
              <div>
                <label className="cvp-form-field-label">
                  Doctor&apos;s Tentative Assessment
                </label>
                <input
                  type="text"
                  value={tentativeAssessment}
                  onChange={(e) => setTentativeAssessment(e.target.value)}
                  placeholder="e.g. Dystocia / Suspected uterine torsion or Post-parturient paresis"
                  className="cvp-form-control"
                />
              </div>

              {/* Planned Procedure */}
              <div>
                <label className="cvp-form-field-label">
                  Planned Clinical Procedure
                </label>
                <input
                  type="text"
                  value={plannedProcedure}
                  onChange={(e) => setPlannedProcedure(e.target.value)}
                  placeholder="e.g. Obstetrical intervention, IV Calcium, Wound suture"
                  className="cvp-form-control"
                />
              </div>

              {/* Extended Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="cvp-form-field-label">
                    Preferred Time Window
                  </label>
                  <select
                    value={preferredTimeWindow}
                    onChange={(e) => setPreferredTimeWindow(e.target.value)}
                    className="cvp-form-control"
                  >
                    <option value="MORNING">Morning (8:00 AM - 12:00 PM)</option>
                    <option value="AFTERNOON">Afternoon (12:00 PM - 4:00 PM)</option>
                    <option value="EVENING">Evening (4:00 PM - 8:00 PM)</option>
                    <option value="ANYTIME">Anytime Today</option>
                  </select>
                </div>

                <div>
                  <label className="cvp-form-field-label">
                    Farm Access & Gate Notes
                  </label>
                  <input
                    type="text"
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="e.g. Keep cow tethered in crush, gate code 1234"
                    className="cvp-form-control"
                  />
                </div>
              </div>

              {/* Navigation Footer */}
              <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-cvp-secondary"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="btn-cvp-primary"
                >
                  <span>Next: Farm Location</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: LOCATION SELECTION */}
          {step === 4 && (
            <div className="cvp-card-container animate-fade-in">
              <div className="cvp-card-header">
                <span className="cvp-card-step-tag">
                  Step 4 of 5
                </span>
                <h2 className="cvp-card-title">
                  Visit Location
                </h2>
                <p className="cvp-card-subtitle">
                  Select previously saved farm location or capture current GPS coordinates.
                </p>
              </div>

              <LocationPicker
                savedLocations={savedLocations}
                address={locationAddress}
                latitude={latitude}
                longitude={longitude}
                locationId={selectedLocationId}
                onChange={(loc) => {
                  setLocationAddress(loc.locationAddress);
                  setLatitude(loc.latitude);
                  setLongitude(loc.longitude);
                  setSelectedLocationId(loc.locationId);
                }}
              />

              {/* Navigation Footer */}
              <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn-cvp-secondary"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="btn-cvp-primary"
                >
                  <span>Review Call Summary</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: INTAKE SUMMARY & CONFIRMATION */}
          {step === 5 && (
            <div className="cvp-card-container animate-fade-in">
              <div className="cvp-card-header">
                <span className="cvp-card-step-tag">
                  Step 5 of 5
                </span>
                <h2 className="cvp-card-title">
                  Review & Confirm
                </h2>
                <p className="cvp-card-subtitle">
                  Verify triage priority and visit location before adding to today&apos;s caseload.
                </p>
              </div>

              <CallSummaryView
                call={getDraftCall()}
                selectedPatients={ownerPatients
                  .filter((p) => selectedPatientIds.includes(p.id))
                  .map((p) => ({ id: p.id, name: p.name, species: p.species }))}
                isSubmitting={isSubmitting}
                onEdit={() => setStep(3)}
                onConfirm={handleSaveCall}
              />
            </div>
          )}
        </div>
      )}

      {/* Quick New Owner Modal (CVP-06) */}
      <QuickNewOwnerModal
        isOpen={isNewOwnerOpen}
        initialPhone={callerPhone}
        onClose={() => setIsNewOwnerOpen(false)}
        onCreated={(owner) => {
          setSelectedOwner(owner);
          setTempOwnerName(owner.name);
          setCallerPhone(owner.phone);
          if (owner.address) setLocationAddress(owner.address);
        }}
      />

      {/* Quick New Patient Modal (CVP-08) */}
      {selectedOwner && (
        <QuickNewPatientModal
          isOpen={isNewPatientOpen}
          ownerId={selectedOwner.id}
          ownerName={selectedOwner.name}
          onClose={() => setIsNewPatientOpen(false)}
          onCreated={(patient) => {
            setOwnerPatients((prev) => [...prev, patient]);
            setSelectedPatientIds((prev) => [...prev, patient.id]);
            setSpecies(patient.species);
          }}
        />
      )}

      {/* Link Alternate Phone Modal (Stage 1.3) */}
      {isLinkPhoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-teal-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-teal-300" />
                <h3 className="text-sm font-black uppercase tracking-wider">Link Phone to Existing Client</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsLinkPhoneModalOpen(false);
                  setLinkError(null);
                  setLinkSelectedMatch(null);
                }}
                className="p-1 rounded-full text-teal-200 hover:text-white hover:bg-teal-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              <p className="text-xs text-slate-600">
                Link caller number <strong className="text-slate-900 font-mono">{callerPhone || '(No number entered)'}</strong> as an alternate phone to an existing registered client.
              </p>

              {linkError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{linkError}</span>
                </div>
              )}

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={linkSearchQuery}
                  onChange={(e) => setLinkSearchQuery(e.target.value)}
                  placeholder="Search client by name, phone or village..."
                  className="cvp-form-control text-xs"
                  style={{ paddingLeft: '36px' }}
                  autoFocus
                />
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {linkSearchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No clients found. Type a name or search term above.
                  </div>
                ) : (
                  linkSearchResults.map((m) => {
                    const isSelected = linkSelectedMatch?.owner.id === m.owner.id;
                    return (
                      <div
                        key={m.owner.id}
                        onClick={() => {
                          setLinkSelectedMatch(m);
                          setLinkError(null);
                        }}
                        className={`p-3 rounded-2xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-teal-50 border-teal-500 shadow-sm ring-2 ring-teal-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{m.owner.name}</span>
                          <span className="font-mono text-[11px] text-slate-500">{m.owner.phone}</span>
                        </div>
                        {m.owner.address && (
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">{m.owner.address}</div>
                        )}
                        <div className="text-[10px] text-teal-700 font-medium mt-1">
                          {m.patients.length} animal(s): {m.patients.map((p: any) => p.name || p.species).join(', ') || 'None'}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsLinkPhoneModalOpen(false);
                  setLinkError(null);
                  setLinkSelectedMatch(null);
                }}
                className="btn-cvp-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!linkSelectedMatch || !callerPhone.trim() || isLinkingPhone}
                onClick={async () => {
                  if (!linkSelectedMatch || !callerPhone.trim()) return;
                  setIsLinkingPhone(true);
                  setLinkError(null);
                  try {
                    const res = await cvpService.linkAlternatePhoneToOwner(linkSelectedMatch.owner.id, callerPhone);
                    if (res.success) {
                      handleSelectOwner({
                        owner: res.owner || linkSelectedMatch.owner,
                        patients: linkSelectedMatch.patients,
                        locations: linkSelectedMatch.locations,
                      });
                      setIsLinkPhoneModalOpen(false);
                      setPasteNotification(`Linked ${callerPhone} to ${linkSelectedMatch.owner.name}`);
                    }
                  } catch (err: any) {
                    setLinkError(err.message || 'Failed to link phone');
                  } finally {
                    setIsLinkingPhone(false);
                  }
                }}
                className="btn-cvp-primary"
              >
                {isLinkingPhone ? 'Linking...' : 'Confirm Link & Attach'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
