import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { cvpService } from '../../services/cvpService';
import { inventoryApi, type StockLocation } from '../../services/inventoryApi';
import type {
  Visit,
  VisitStatus,
  Medicine,
} from '../../types';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Navigation,
  Clock,
  Play,
  CheckCircle2,
  Plus,
  Stethoscope,
  Pill,
  Check,
  RefreshCw,
  X,
  History,
  ShieldCheck,
  ChevronRight,
  User,
  Calendar,
} from 'lucide-react';
import { CreateFollowUpModal } from '../../components/cvp/CreateFollowUpModal';
import type { FollowUp } from '../../types/cvp';
import './Cvp.css';

const PROCEDURE_CATEGORIES = [
  'GENERAL',
  'VACCINATION',
  'SURGICAL',
  'OBSTETRIC_REPRODUCTIVE',
  'DIAGNOSTIC',
  'WOUND_CARE',
  'DENTAL',
  'EMERGENCY',
];

const ADMINISTRATION_ROUTES = [
  'IM',
  'IV',
  'SC',
  'Oral',
  'Topical',
  'Intramammary',
  'Eye/Ear Drops',
  'Inhalation',
];

export const VisitDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Load visit and child collections live from Dexie
  const visit: Visit | null = useLiveQuery(
    async () => {
      if (!id) return null;
      return await cvpService.getVisitById(id);
    },
    [id]
  ) || null;

  // Load medicines catalog for autocomplete
  const medicines: Medicine[] = useLiveQuery(async () => {
    return await db.medicines.toArray();
  }) || [];

  // Load linked follow-ups originating from this visit (Phase 8)
  const linkedFollowUps: FollowUp[] = useLiveQuery(async () => {
    if (!id) return [];
    const all = (await db.followUps.toArray()) as FollowUp[];
    return all.filter((f) => String(f.originVisitId) === String(id));
  }, [id]) || [];

  // Multiple Field Kits & Vehicles support (Phase 7)
  const [fieldKits, setFieldKits] = useState<StockLocation[]>([]);
  const [selectedKitId, setSelectedKitId] = useState<string>('');

  useEffect(() => {
    async function loadKits() {
      try {
        const locs = await inventoryApi.getLocations();
        const kits = (locs || []).filter((l) => l.name !== 'Store Stock');
        setFieldKits(kits);
        if (kits.length > 0) {
          setSelectedKitId(kits[0].id);
        }
      } catch {
        // Fallback gracefully offline
      }
    }
    void loadKits();
  }, []);

  // Modals state
  const [isProcedureModalOpen, setIsProcedureModalOpen] = useState(false);
  const [isMedicineModalOpen, setIsMedicineModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);

  // Procedure form state
  const [procPatientName, setProcPatientName] = useState('');
  const [procCategory, setProcCategory] = useState('GENERAL');
  const [procName, setProcName] = useState('');
  const [procFee, setProcFee] = useState(0);
  const [procNotes, setProcNotes] = useState('');
  const [isSubmittingProc, setIsSubmittingProc] = useState(false);

  // Medicine usage form state
  const [medPatientName, setMedPatientName] = useState('');
  const [medSearch, setMedSearch] = useState('');
  const [selectedMedId, setSelectedMedId] = useState<number | string | null>(null);
  const [medQty, setMedQty] = useState(1);
  const [medUnit, setMedUnit] = useState('ml');
  const [medRoute, setMedRoute] = useState('IM');
  const [medBatch, setMedBatch] = useState('');
  const [medInstructions, setMedInstructions] = useState('');
  const [isSubmittingMed, setIsSubmittingMed] = useState(false);

  // Completion review form state
  const [completionNotes, setCompletionNotes] = useState('');
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

  // Arrival & start loading states
  const [isRecordingArrival, setIsRecordingArrival] = useState(false);
  const [isStartingVisit, setIsStartingVisit] = useState(false);
  const [isResumingVisit, setIsResumingVisit] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);

  // Set default patient when modal opens
  useEffect(() => {
    if (visit?.cases && visit.cases.length > 0) {
      const firstPatient = visit.cases[0].species || 'Patient #1';
      setProcPatientName(firstPatient);
      setMedPatientName(firstPatient);
    }
  }, [visit?.id]);

  if (!visit) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-teal-700 mb-3" />
        <p className="text-sm font-semibold">Loading Visit Record #{id}…</p>
        <button
          type="button"
          onClick={() => navigate('/calls/field')}
          className="mt-4 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
        >
          Return to Field Mode
        </button>
      </div>
    );
  }

  // Arrival Handler (CVP-20)
  const handleRecordArrival = async () => {
    if (!visit.id) return;
    setIsRecordingArrival(true);
    setGpsMessage('Capturing GPS…');

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
        setGpsMessage(`Location saved (±${Math.round(pos.coords.accuracy)}m)`);
      } catch (err) {
        console.warn('Geolocation capture failed or denied:', err);
        setGpsMessage('Arrival recorded without GPS coordinates.');
      }
    }

    try {
      await cvpService.recordArrival(visit.id, locationData);
    } catch (err) {
      console.error('Failed to record arrival:', err);
    } finally {
      setIsRecordingArrival(false);
    }
  };

  // Start Visit Handler (CVP-22)
  const handleStartVisit = async () => {
    if (!visit.id) return;
    setIsStartingVisit(true);
    try {
      await cvpService.startVisit(visit.id);
    } catch (err) {
      console.error('Failed to start visit:', err);
    } finally {
      setIsStartingVisit(false);
    }
  };

  // Resume Visit Handler
  const handleResumeVisit = async () => {
    if (!visit.id) return;
    setIsResumingVisit(true);
    try {
      await cvpService.resumeVisit(visit.id);
    } catch (err) {
      console.error('Failed to resume visit:', err);
    } finally {
      setIsResumingVisit(false);
    }
  };

  // Record Procedure Handler (CVP-23)
  const handleSaveProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visit.id || !procName.trim()) return;

    setIsSubmittingProc(true);
    try {
      await cvpService.recordProcedure(visit.id, {
        patientName: procPatientName,
        procedureCategory: procCategory,
        procedureName: procName.trim(),
        standardFee: Number(procFee) || 0,
        notes: procNotes.trim() || undefined,
      });
      setProcName('');
      setProcNotes('');
      setProcFee(0);
      setIsProcedureModalOpen(false);
    } catch (err) {
      console.error('Failed to record procedure:', err);
    } finally {
      setIsSubmittingProc(false);
    }
  };

  // Record Medicine Usage Handler (CVP-24)
  const handleSaveMedicineUsage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visit.id || !medSearch.trim()) return;

    setIsSubmittingMed(true);
    const idempotencyKey = `use_${visit.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const chosenKit = fieldKits.find((k) => k.id === selectedKitId);

    try {
      await cvpService.recordMedicineUsage(visit.id, {
        patientName: medPatientName,
        medicineId: selectedMedId || 0,
        medicineName: medSearch.trim(),
        quantityUsed: Number(medQty) || 1,
        unit: medUnit,
        route: medRoute,
        batchNumber: medBatch.trim() || undefined,
        instructions: medInstructions.trim() || undefined,
        locationId: selectedKitId || undefined,
        locationName: chosenKit?.name || undefined,
        idempotencyKey,
      });
      setMedSearch('');
      setSelectedMedId(null);
      setMedQty(1);
      setMedBatch('');
      setMedInstructions('');
      setIsMedicineModalOpen(false);
    } catch (err) {
      console.error('Failed to record medicine usage:', err);
    } finally {
      setIsSubmittingMed(false);
    }
  };

  // Complete Visit Handler (CVP-25)
  const handleFinalizeVisit = async () => {
    if (!visit.id) return;
    setIsSubmittingCompletion(true);
    try {
      await cvpService.completeVisit(visit.id, {
        completionNotes: completionNotes.trim() || undefined,
      });
      setIsCompleteModalOpen(false);
    } catch (err) {
      console.error('Failed to complete visit:', err);
    } finally {
      setIsSubmittingCompletion(false);
    }
  };

  // External Navigation Launcher
  const handleOpenMaps = () => {
    let mapUrl = '';
    if (visit.latitude && visit.longitude) {
      mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${visit.latitude},${visit.longitude}`;
    } else {
      mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(visit.address)}`;
    }
    window.open(mapUrl, '_blank', 'noopener,noreferrer');
  };

  const renderStatusBadge = (status: VisitStatus) => {
    switch (status) {
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            IN PROGRESS
          </span>
        );
      case 'ARRIVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <MapPin className="w-3.5 h-3.5 text-amber-600" />
            ARRIVED
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            COMPLETED
          </span>
        );
      case 'POSTPONED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
            <Clock className="w-3.5 h-3.5 text-purple-600" />
            POSTPONED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            SCHEDULED
          </span>
        );
    }
  };

  const cases = visit.cases && visit.cases.length > 0 ? visit.cases : [
    {
      chiefComplaint: visit.notes || 'Routine consultation',
      species: 'Bovine',
      procedureCategory: 'GENERAL',
    },
  ];

  return (
    <div className="cvp-container max-w-4xl mx-auto px-3 sm:px-6 py-4 pb-28 font-sans text-slate-800">
      {/* Back button & Title Strip */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate('/calls/field')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-teal-700 transition-colors p-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Field Mode</span>
        </button>

        <div className="flex items-center gap-2">
          {renderStatusBadge(visit.status)}
          {visit.priority === 'EMERGENCY' && (
            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-red-600 text-white">
              EMERGENCY
            </span>
          )}
        </div>
      </div>

      {/* Main Header Card (CVP-21 Consolidated View) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 mb-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="text-xs uppercase font-extrabold tracking-wider text-teal-700">
              Visit Details (CVP-21)
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
              {visit.ownerName || 'Client'}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1 font-medium">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="break-words">{visit.address}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start">
            {visit.ownerPhone && (
              <a
                href={`tel:${visit.ownerPhone}`}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs border border-teal-200 transition-all min-h-[44px]"
              >
                <Phone className="w-4 h-4 text-teal-600" />
                <span>Call Client</span>
              </a>
            )}
            <button
              type="button"
              onClick={handleOpenMaps}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs transition-all min-h-[44px]"
            >
              <Navigation className="w-4 h-4 text-teal-700" />
              <span>Map</span>
            </button>
          </div>
        </div>

        {/* GPS arrival verification pill */}
        {visit.arrivalLatitude && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Arrival verified with GPS ({visit.arrivalLatitude.toFixed(4)}, {visit.arrivalLongitude?.toFixed(4)})
            </span>
          </div>
        )}

        {gpsMessage && (
          <div className="text-xs text-slate-500 italic font-medium">{gpsMessage}</div>
        )}

        {/* Primary Action Button Bar */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {visit.status !== 'ARRIVED' && visit.status !== 'IN_PROGRESS' && visit.status !== 'COMPLETED' && (
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
                  <span>Record Arrival (CVP-20)</span>
                </>
              )}
            </button>
          )}

          {visit.status === 'ARRIVED' && (
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
                  <span>Start Active Visit (CVP-22)</span>
                </>
              )}
            </button>
          )}

          {visit.status === 'IN_PROGRESS' && (
            <button
              type="button"
              onClick={() => setIsCompleteModalOpen(true)}
              className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 min-h-[44px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Review & Finalize Visit (CVP-25)</span>
            </button>
          )}

          {visit.status === 'COMPLETED' && (
            <button
              type="button"
              disabled={isResumingVisit}
              onClick={handleResumeVisit}
              className="flex-1 py-2.5 px-4 rounded-2xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all flex items-center justify-center gap-2 min-h-[44px]"
            >
              {isResumingVisit ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Resuming…</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 text-teal-700" />
                  <span>Resume / Reopen Visit</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Grid: Left Column = Clinical Actions, Right Column = Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column (2 spans): Cases, Procedures, Medicines */}
        <div className="lg:col-span-2 space-y-5">
          {/* 1. Associated Cases / Animals (Multi-Animal Support) */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4 text-teal-700" />
                Animals at this Location ({cases.length})
              </h2>
            </div>

            <div className="space-y-2.5">
              {cases.map((c, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 font-black text-xs">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-slate-900">
                        {c.species || 'Animal'}
                        {c.patientId ? ` (ID: ${c.patientId})` : ''}
                      </span>
                      {c.procedureCategory && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                          {c.procedureCategory}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 font-medium">{c.chiefComplaint}</p>
                    {c.notes && <p className="text-[11px] text-slate-500 italic mt-0.5">{c.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 2. Procedures Performed (CVP-23) */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-teal-700" />
                Procedures Performed ({(visit.procedures || []).length})
              </h2>
              <button
                type="button"
                onClick={() => setIsProcedureModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Procedure</span>
              </button>
            </div>

            {visit.procedures && visit.procedures.length > 0 ? (
              <div className="space-y-2">
                {visit.procedures.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900">{p.procedureName}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 font-semibold">
                          {p.procedureCategory}
                        </span>
                        {p.patientName && <span>For: {p.patientName}</span>}
                      </div>
                      {p.notes && <div className="text-[11px] text-slate-600 italic mt-1">{p.notes}</div>}
                    </div>

                    {p.standardFee ? (
                      <span className="font-black text-slate-900 text-xs shrink-0">
                        ₹{p.standardFee}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
                No procedures recorded yet. Tap &quot;Record Procedure&quot; to log clinical interventions.
              </div>
            )}
          </section>

          {/* 3. Actual Medicine Usage (CVP-24) */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Pill className="w-4 h-4 text-teal-700" />
                Actual Medicine Administered ({(visit.medicineUsages || []).length})
              </h2>
              <button
                type="button"
                onClick={() => setIsMedicineModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Medicine</span>
              </button>
            </div>

            {visit.medicineUsages && visit.medicineUsages.length > 0 ? (
              <div className="space-y-2">
                {visit.medicineUsages.map((m, idx) => (
                  <div
                    key={m.id || idx}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900">{m.medicineName}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                          {m.quantityUsed} {m.unit || 'dose'}
                        </span>
                        <span>Route: {m.route || 'Oral'}</span>
                        {m.batchNumber && <span>Batch: {m.batchNumber}</span>}
                      </div>
                      {m.instructions && (
                        <div className="text-[11px] text-slate-600 italic mt-1">{m.instructions}</div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {m.isStockDeducted ? (
                        <span className="font-bold text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Bag Stock Deducted
                        </span>
                      ) : (
                        <span className="font-bold text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Stock Movement Pending
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
                No medicine usage logged. Tap &quot;Record Medicine&quot; to register doses and track usage.
              </div>
            )}
          </section>
        </div>

        {/* Right Column (1 span): Timeline (CVP-45) */}
        <div className="space-y-5">
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2 mb-4">
              <History className="w-4 h-4 text-teal-700" />
              Visit Status Timeline (CVP-45)
            </h2>

            {visit.timelineEvents && visit.timelineEvents.length > 0 ? (
              <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {visit.timelineEvents.map((ev, idx) => {
                  const evDate = new Date(ev.occurredAt);
                  const timeStr = evDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div key={ev.id || idx} className="relative text-xs">
                      {/* Timeline Dot */}
                      <span className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-teal-700 ring-4 ring-teal-50" />
                      <div className="font-black text-slate-900">{ev.title}</div>
                      <div className="text-[10px] text-slate-400 font-semibold">{timeStr}</div>
                      {ev.description && (
                        <p className="text-[11px] text-slate-600 mt-0.5 break-words">{ev.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-slate-500 italic text-center py-4">
                No timeline milestones recorded yet.
              </div>
            )}
          </section>

          {/* Quick Links: Prescription / Invoice */}
          <section className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-3xl border border-teal-200 p-4 text-xs space-y-3">
            <div className="font-black text-teal-900 uppercase tracking-wider text-[11px]">
              Clinical Workflows
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Generate structured Rx or instant receipts for this visit without duplicate entry.
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => navigate('/prescriptions/new')}
                className="w-full py-2 px-3 rounded-xl bg-white hover:bg-teal-50 border border-teal-200 text-teal-900 font-bold flex items-center justify-between"
              >
                <span>Create Prescription</span>
                <ChevronRight className="w-4 h-4 text-teal-600" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/invoices/new')}
                className="w-full py-2 px-3 rounded-xl bg-white hover:bg-teal-50 border border-teal-200 text-teal-900 font-bold flex items-center justify-between"
              >
                <span>Generate Invoice</span>
                <ChevronRight className="w-4 h-4 text-teal-600" />
              </button>
              <button
                type="button"
                onClick={() => setIsFollowUpModalOpen(true)}
                className="w-full py-2 px-3 rounded-xl bg-white hover:bg-teal-50 border border-teal-200 text-teal-900 font-bold flex items-center justify-between"
              >
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                  <span>Schedule Follow-up</span>
                </span>
                <ChevronRight className="w-4 h-4 text-teal-600" />
              </button>
            </div>

            {/* Linked Follow-ups */}
            {linkedFollowUps.length > 0 && (
              <div className="pt-2 border-t border-teal-200/60 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                  Scheduled Follow-ups ({linkedFollowUps.length})
                </div>
                {linkedFollowUps.map((f) => (
                  <div
                    key={f.id}
                    className="p-2 rounded-xl bg-white/80 border border-teal-100 flex items-center justify-between text-[11px]"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block truncate">{f.reason}</span>
                      <span className="text-slate-500">{f.recommendedDate}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      f.status === 'COMPLETED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : f.status === 'SCHEDULED'
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {f.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── Modal: Record Procedure (CVP-23) ─────────────────────────────────── */}
      {isProcedureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-teal-700" />
                Record Procedure Performed
              </h3>
              <button
                type="button"
                onClick={() => setIsProcedureModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProcedure} className="mt-4 space-y-3.5 text-xs">
              {/* Patient Selection */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Animal / Patient</label>
                <select
                  value={procPatientName}
                  onChange={(e) => setProcPatientName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
                >
                  {cases.map((c, i) => (
                    <option key={i} value={c.species || `Animal #${i + 1}`}>
                      {c.species || `Animal #${i + 1}`} ({c.chiefComplaint || 'Consultation'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Procedure Category */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Category</label>
                <select
                  value={procCategory}
                  onChange={(e) => setProcCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
                >
                  {PROCEDURE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Procedure Name */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Procedure Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Artificial Insemination, Wound Dressing, Deworming"
                  value={procName}
                  onChange={(e) => setProcName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>

              {/* Fee */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Standard Fee (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={procFee}
                  onChange={(e) => setProcFee(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Clinical Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Observations, dosage notes, or complications..."
                  value={procNotes}
                  onChange={(e) => setProcNotes(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProcedureModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingProc}
                  className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-black shadow-md shadow-teal-700/20"
                >
                  {isSubmittingProc ? 'Saving…' : 'Record Procedure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Record Actual Medicine Usage (CVP-24) ────────────────────── */}
      {isMedicineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Pill className="w-4 h-4 text-teal-700" />
                Record Medicine Administered
              </h3>
              <button
                type="button"
                onClick={() => setIsMedicineModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMedicineUsage} className="mt-4 space-y-3.5 text-xs">
              {/* Target Animal */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Animal / Patient</label>
                <select
                  value={medPatientName}
                  onChange={(e) => setMedPatientName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
                >
                  {cases.map((c, i) => (
                    <option key={i} value={c.species || `Animal #${i + 1}`}>
                      {c.species || `Animal #${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Medicine Name with Suggestion / Search */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Medicine Name *</label>
                <input
                  type="text"
                  required
                  list="medicine-catalog-list"
                  placeholder="e.g. Oxytetracycline 20%, Meloxicam 5mg/ml"
                  value={medSearch}
                  onChange={(e) => {
                    setMedSearch(e.target.value);
                    const match = medicines.find(
                      (m) => m.brandName.toLowerCase() === e.target.value.toLowerCase()
                    );
                    if (match) {
                      setSelectedMedId(match.id || 0);
                      if (match.defaultUnit) setMedUnit(match.defaultUnit);
                    }
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
                <datalist id="medicine-catalog-list">
                  {medicines.map((m) => (
                    <option key={m.id} value={m.brandName}>
                      {m.presentation} — {m.genericName || ''}
                    </option>
                  ))}
                </datalist>
              </div>

              {/* Source Field Kit / Vehicle Selector (CVP-28 & Multi-Kit) */}
              {fieldKits.length > 0 && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Deduct From Field Kit / Vehicle *
                  </label>
                  <select
                    value={selectedKitId}
                    onChange={(e) => setSelectedKitId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
                    id="med-select-kit"
                  >
                    {fieldKits.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name} {k.vehicleNumber ? `(Reg: ${k.vehicleNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quantity & Unit */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Quantity Used *</label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    required
                    value={medQty}
                    onChange={(e) => setMedQty(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Unit</label>
                  <input
                    type="text"
                    value={medUnit}
                    onChange={(e) => setMedUnit(e.target.value)}
                    placeholder="ml, vial, tablet"
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Route & Batch */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Route</label>
                  <select
                    value={medRoute}
                    onChange={(e) => setMedRoute(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  >
                    {ADMINISTRATION_ROUTES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Batch Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. B2401"
                    value={medBatch}
                    onChange={(e) => setMedBatch(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Usage Notes / Dosage</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Deep IM, repeat after 48h if required"
                  value={medInstructions}
                  onChange={(e) => setMedInstructions(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMedicineModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMed}
                  className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-black shadow-md shadow-teal-700/20"
                >
                  {isSubmittingMed ? 'Recording…' : 'Record Medicine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Visit Completion Review (CVP-25) ─────────────────────────── */}
      {isCompleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Visit Completion Review (CVP-25)
              </h3>
              <button
                type="button"
                onClick={() => setIsCompleteModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Highlights */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-500">Animals</div>
                <div className="text-lg font-black text-slate-900">{cases.length}</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-500">Procedures</div>
                <div className="text-lg font-black text-slate-900">
                  {(visit.procedures || []).length}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-500">Medicines</div>
                <div className="text-lg font-black text-slate-900">
                  {(visit.medicineUsages || []).length}
                </div>
              </div>
            </div>

            {/* Checklist items */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-700">Client Contact & Location</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Verified
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-700">Clinical Procedures Logged</span>
                <span className="text-slate-800 font-bold">
                  {(visit.procedures || []).length} Recorded
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-700">Medicine Administered / Dispensed</span>
                <span className="text-slate-800 font-bold">
                  {(visit.medicineUsages || []).length} Logged
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-semibold text-slate-700">Field Stock Deduction (Practice Bag)</span>
                {(() => {
                  const usages = visit.medicineUsages || [];
                  if (usages.length === 0) {
                    return <span className="text-slate-500 font-medium">None required</span>;
                  }
                  const deducted = usages.filter((u) => u.isStockDeducted).length;
                  const pending = usages.length - deducted;
                  if (pending === 0) {
                    return (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> All {deducted} Deducted
                      </span>
                    );
                  }
                  return (
                    <span className="text-amber-700 font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {pending} Movement(s) Pending
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Final Advice & Completion Notes */}
            <div>
              <label className="font-bold text-slate-700 block mb-1 text-xs">
                Final Advice & Discharge Notes
              </label>
              <textarea
                rows={3}
                placeholder="Follow-up instructions, post-treatment advice for farmer/owner..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCompleteModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-bold"
              >
                Continue Working
              </button>
              <button
                type="button"
                disabled={isSubmittingCompletion}
                onClick={handleFinalizeVisit}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
              >
                {isSubmittingCompletion ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Finalizing…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Finalize Visit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Create Clinical Follow-up (Phase 8) ────────────────────── */}
      {isFollowUpModalOpen && (
        <CreateFollowUpModal
          isOpen={isFollowUpModalOpen}
          onClose={() => setIsFollowUpModalOpen(false)}
          practiceId={visit.practiceId || 'default-practice'}
          defaultOwnerId={visit.ownerId}
          defaultOwnerName={visit.ownerName}
          defaultOwnerPhone={visit.ownerPhone}
          defaultPatientId={cases[0]?.patientId}
          defaultPatientName={cases[0]?.patientName}
          defaultSpecies={cases[0]?.species}
          originVisitId={visit.id}
        />
      )}
    </div>
  );
};
