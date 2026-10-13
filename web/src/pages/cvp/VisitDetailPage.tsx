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
  TreatmentPackage,
  Prescription,
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
  Package,
  FileText,
  Sparkles,
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

  // Load treatment packages from database
  const treatmentPackages: TreatmentPackage[] = useLiveQuery(async () => {
    return await db.treatmentPackages.toArray();
  }) || [];

  // Load linked prescriptions originating from or associated with this visit
  const linkedPrescriptions: Prescription[] = useLiveQuery(async () => {
    if (!id) return [];
    const allRx = await db.prescriptions.toArray();
    const caseRxIds = (visit?.cases || []).map((c) => String(c.prescriptionId)).filter(Boolean);
    return allRx.filter((rx) => String(rx.visitId) === String(id) || caseRxIds.includes(String(rx.id)));
  }, [id, visit?.cases]) || [];

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
  const [isApplyPackageModalOpen, setIsApplyPackageModalOpen] = useState(false);
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
  const [selectedMedRecord, setSelectedMedRecord] = useState<Medicine | null>(null);
  const [isMedDropdownOpen, setIsMedDropdownOpen] = useState(false);
  const [medQty, setMedQty] = useState(1);
  const [medUnit, setMedUnit] = useState('ml');
  const [medRoute, setMedRoute] = useState('IM');
  const [medBatch, setMedBatch] = useState('');
  const [medInstructions, setMedInstructions] = useState('');
  const [isSubmittingMed, setIsSubmittingMed] = useState(false);

  // Treatment package application state
  const [pkgSelectedId, setPkgSelectedId] = useState<number | null>(null);
  const [pkgPatientName, setPkgPatientName] = useState<string>('');
  const [pkgKitId, setPkgKitId] = useState<string>('');
  const [pkgItemsList, setPkgItemsList] = useState<Array<{
    id?: number;
    checked: boolean;
    medicineId?: number;
    medicineName: string;
    presentation: string;
    strength?: string;
    quantity: number;
    unit: string;
    route: string;
    batchNumber: string;
    instructions?: string;
  }>>([]);
  const [isSubmittingPkg, setIsSubmittingPkg] = useState(false);

  // Completion review form state
  const [completionNotes, setCompletionNotes] = useState('');
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

  // Arrival & start loading states
  const [isRecordingArrival, setIsRecordingArrival] = useState(false);
  const [isStartingVisit, setIsStartingVisit] = useState(false);
  const [isResumingVisit, setIsResumingVisit] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);

  // Populate items when treatment package selection changes
  useEffect(() => {
    if (!pkgSelectedId) {
      setPkgItemsList([]);
      return;
    }
    void (async () => {
      try {
        const items = await db.treatmentPackageItems
          .where('packageId')
          .equals(pkgSelectedId)
          .sortBy('sortOrder');
        setPkgItemsList(
          items.map((p) => ({
            id: p.id,
            checked: true,
            medicineId: p.medicineId,
            medicineName: p.brandName,
            presentation: p.presentation || 'Injection',
            strength: p.strengthVolume || p.strength,
            quantity: p.quantity || 1,
            unit: p.unit || 'dose',
            route: p.route || 'IM',
            batchNumber: '',
            instructions: p.directions || '',
          }))
        );
      } catch (err) {
        console.error('Error loading package items:', err);
      }
    })();
  }, [pkgSelectedId]);

  // Set default patient when modal opens
  useEffect(() => {
    if (visit?.cases && visit.cases.length > 0) {
      const firstPatient = visit.cases[0].species || 'Patient #1';
      setProcPatientName(firstPatient);
      setMedPatientName(firstPatient);
      setPkgPatientName(firstPatient);
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
      setSelectedMedRecord(null);
      setIsMedDropdownOpen(false);
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

  // Apply Treatment Package to Administered Medicines Handler
  const handleApplyPackageMedicines = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visit?.id) return;
    const itemsToAdminister = pkgItemsList.filter((i) => i.checked);
    if (itemsToAdminister.length === 0) {
      alert('Please select at least one medicine from the package that was actually administered.');
      return;
    }

    setIsSubmittingPkg(true);
    const chosenKit = fieldKits.find((k) => k.id === (pkgKitId || selectedKitId));

    try {
      for (const itm of itemsToAdminister) {
        const idempotencyKey = `pkg_use_${visit.id}_${itm.medicineId || itm.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await cvpService.recordMedicineUsage(visit.id, {
          patientName: pkgPatientName || medPatientName,
          medicineId: itm.medicineId || 0,
          medicineName: itm.medicineName,
          quantityUsed: Number(itm.quantity) || 1,
          unit: itm.unit,
          route: itm.route,
          batchNumber: itm.batchNumber.trim() || undefined,
          instructions: itm.instructions?.trim() || undefined,
          locationId: pkgKitId || selectedKitId || undefined,
          locationName: chosenKit?.name || undefined,
          idempotencyKey,
        });
      }

      // Increment package usage count in treatmentPackages without modifying the package template!
      if (pkgSelectedId) {
        const pkg = await db.treatmentPackages.get(pkgSelectedId);
        if (pkg?.id) {
          await db.treatmentPackages.update(pkg.id, {
            usageCount: (pkg.usageCount || 0) + 1,
            lastUsedAt: new Date(),
          });
        }
      }

      setIsApplyPackageModalOpen(false);
      setPkgSelectedId(null);
      setPkgItemsList([]);
    } catch (err) {
      console.error('Failed to apply package medicines:', err);
      alert('Failed to record medicines administered from package.');
    } finally {
      setIsSubmittingPkg(false);
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
              Visit Details
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
                  <span>Record Arrival</span>
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
                  <span>Start Active Visit</span>
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
              <span>Review & Finalize Visit</span>
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
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Pill className="w-4 h-4 text-teal-700" />
                Actual Medicine Administered ({(visit.medicineUsages || []).length})
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsApplyPackageModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs shadow-sm transition-all"
                  title="Apply planned medicines from a saved treatment package"
                >
                  <Package className="w-3.5 h-3.5 text-amber-700" />
                  <span>Apply Package</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMedId(null);
                    setSelectedMedRecord(null);
                    setMedSearch('');
                    setIsMedicineModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Record Medicine</span>
                </button>
              </div>
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
              Visit Status Timeline
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

          {/* Linked ePrescriptions Card */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-700" />
                Linked ePrescriptions ({linkedPrescriptions.length})
              </h2>
              <button
                type="button"
                onClick={() => {
                  const firstPatId = visit.cases?.[0]?.patientId || '';
                  const ownerId = visit.ownerId || '';
                  navigate(`/prescriptions/new?visitId=${visit.id}&ownerId=${ownerId}&patientId=${firstPatId}`);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 font-bold text-[11px] border border-teal-200 transition-colors"
                title="Create new ePrescription linked to this visit"
              >
                <Plus className="w-3 h-3 text-teal-700" />
                <span>New Rx</span>
              </button>
            </div>

            {linkedPrescriptions.length > 0 ? (
              <div className="space-y-2">
                {linkedPrescriptions.map((rx) => {
                  const rxDate = new Date(rx.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                  return (
                    <div
                      key={rx.id}
                      className="p-3 rounded-2xl bg-teal-50/50 border border-teal-200/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 font-mono text-xs">{rx.rxNumber}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rx.status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : rx.status === 'Pending Approval'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-800'
                          }`}>
                            {rx.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Created: {rxDate}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => navigate(`/prescriptions/${rx.id}?fromVisit=${visit.id}`)}
                          className="px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 font-bold text-[11px] text-slate-700 shadow-sm"
                        >
                          View
                        </button>
                        {(rx.status === 'Draft' || rx.status === 'Changes Requested') && (
                          <button
                            type="button"
                            onClick={() => navigate(`/prescriptions/${rx.id}/edit?visitId=${visit.id}`)}
                            className="px-2.5 py-1 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-[11px] shadow-sm"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-500">
                No ePrescription created yet for this visit.
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
                onClick={() => {
                  const firstPatId = visit.cases?.[0]?.patientId || '';
                  const ownerId = visit.ownerId || '';
                  navigate(`/prescriptions/new?visitId=${visit.id}&ownerId=${ownerId}&patientId=${firstPatId}`);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-teal-50 border border-teal-200 text-teal-900 font-bold flex items-center justify-between shadow-sm"
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                  <span>{linkedPrescriptions.length > 0 ? 'Create Additional ePrescription' : 'Create ePrescription'}</span>
                </span>
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

              {/* Medicine Name using Canonical Medicine Catalogue */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Medicine Name (from Formulary Catalogue) *
                </label>
                {selectedMedRecord ? (
                  <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <Pill className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                        <span className="truncate">{selectedMedRecord.brandName}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 truncate mt-0.5">
                        {selectedMedRecord.genericName || selectedMedRecord.presentation} • {selectedMedRecord.strengthVolume || selectedMedRecord.strength || selectedMedRecord.packSize || 'Standard pack'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMedRecord(null);
                        setSelectedMedId(null);
                        setMedSearch('');
                        setIsMedDropdownOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-[11px] shrink-0"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Search medicine brand or generic name..."
                      value={medSearch}
                      onFocus={() => setIsMedDropdownOpen(true)}
                      onChange={(e) => {
                        setMedSearch(e.target.value);
                        setIsMedDropdownOpen(true);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
                    />

                    {isMedDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl max-h-56 overflow-y-auto z-50 divide-y divide-slate-100">
                        {medicines
                          .filter((m) => {
                            if (!medSearch.trim()) return true;
                            const q = medSearch.toLowerCase();
                            return (
                              (m.brandName || '').toLowerCase().includes(q) ||
                              (m.genericName || '').toLowerCase().includes(q)
                            );
                          })
                          .slice(0, 25)
                          .map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setSelectedMedId(m.id || 0);
                                setSelectedMedRecord(m);
                                setMedSearch(m.brandName);
                                if (m.defaultUnit) setMedUnit(m.defaultUnit);
                                if (m.defaultRoute) setMedRoute(m.defaultRoute);
                                setIsMedDropdownOpen(false);
                              }}
                              className="w-full text-left p-2.5 hover:bg-teal-50/70 transition-colors flex items-start justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-slate-900 text-xs truncate">
                                  {m.brandName}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate">
                                  {m.genericName || 'No generic name'}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                  {m.presentation}
                                </span>
                                {(m.strengthVolume || m.strength) && (
                                  <div className="text-[10px] text-teal-700 font-bold mt-0.5">
                                    {m.strengthVolume || m.strength}
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}

                        {medicines.filter((m) => {
                          if (!medSearch.trim()) return true;
                          const q = medSearch.toLowerCase();
                          return (
                            (m.brandName || '').toLowerCase().includes(q) ||
                            (m.genericName || '').toLowerCase().includes(q)
                          );
                        }).length === 0 && (
                          <div className="p-3 text-center text-xs text-slate-500">
                            No catalogue medicine matches &quot;{medSearch}&quot;.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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

      {/* ── Modal: Apply Treatment Package in Actual Medicine Administered ── */}
      {isApplyPackageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-700" />
                Apply Treatment Package
              </h3>
              <button
                type="button"
                onClick={() => setIsApplyPackageModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyPackageMedicines} className="mt-4 space-y-4 text-xs">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl text-[11px] text-amber-900 leading-relaxed">
                <div className="font-bold mb-0.5 flex items-center gap-1.5 text-amber-950">
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                  Clinical Usage Checklist
                </div>
                Selecting a package loads its planned pharmacotherapy. Review the list and select <strong>ONLY</strong> the medicines actually administered. Unselected items will not be recorded or deducted from inventory. The master package template will not be altered.
              </div>

              {/* Target Animal */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Animal / Patient *</label>
                <select
                  value={pkgPatientName}
                  onChange={(e) => setPkgPatientName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
                >
                  {cases.map((c, i) => (
                    <option key={i} value={c.species || `Animal #${i + 1}`}>
                      {c.species || `Animal #${i + 1}`} {c.patientId ? `(ID: ${c.patientId})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Field Kit / Vehicle Selector */}
              {fieldKits.length > 0 && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Deduct From Field Kit / Vehicle *
                  </label>
                  <select
                    value={pkgKitId || selectedKitId}
                    onChange={(e) => setPkgKitId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
                  >
                    {fieldKits.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name} {k.vehicleNumber ? `(Reg: ${k.vehicleNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Select Package */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Treatment Package *</label>
                <select
                  required
                  value={pkgSelectedId || ''}
                  onChange={(e) => setPkgSelectedId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none text-slate-900"
                >
                  <option value="">-- Choose a Saved Treatment Package --</option>
                  {treatmentPackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} ({pkg.species || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Package Included Items Checklist */}
              {pkgItemsList.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-800 uppercase tracking-wider text-[11px]">
                      Package Medicines ({pkgItemsList.filter((i) => i.checked).length} of {pkgItemsList.length} Selected)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const allChecked = pkgItemsList.every((i) => i.checked);
                        setPkgItemsList((prev) => prev.map((i) => ({ ...i, checked: !allChecked })));
                      }}
                      className="text-[11px] font-bold text-teal-700 hover:text-teal-900"
                    >
                      {pkgItemsList.every((i) => i.checked) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {pkgItemsList.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-2xl border transition-all ${
                          item.checked
                            ? 'bg-teal-50/40 border-teal-200'
                            : 'bg-slate-50/70 border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setPkgItemsList((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, checked } : it))
                              );
                            }}
                            className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-600 w-4 h-4 cursor-pointer"
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-black text-slate-900 text-xs truncate">
                                {item.medicineName}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                                {item.presentation}
                              </span>
                            </div>

                            {item.checked && (
                              <div className="mt-2 grid grid-cols-3 gap-2">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-600 block">Dose Qty</label>
                                  <input
                                    type="number"
                                    min="0.1"
                                    step="any"
                                    required
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const quantity = Number(e.target.value);
                                      setPkgItemsList((prev) =>
                                        prev.map((it, i) => (i === idx ? { ...it, quantity } : it))
                                      );
                                    }}
                                    className="w-full p-1.5 rounded-lg border border-slate-300 bg-white font-medium text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-600 block">Unit</label>
                                  <input
                                    type="text"
                                    value={item.unit}
                                    onChange={(e) => {
                                      const unit = e.target.value;
                                      setPkgItemsList((prev) =>
                                        prev.map((it, i) => (i === idx ? { ...it, unit } : it))
                                      );
                                    }}
                                    className="w-full p-1.5 rounded-lg border border-slate-300 bg-white font-medium text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-600 block">Route</label>
                                  <select
                                    value={item.route}
                                    onChange={(e) => {
                                      const route = e.target.value;
                                      setPkgItemsList((prev) =>
                                        prev.map((it, i) => (i === idx ? { ...it, route } : it))
                                      );
                                    }}
                                    className="w-full p-1.5 rounded-lg border border-slate-300 bg-white font-medium text-xs focus:outline-none focus:ring-1 focus:ring-teal-600"
                                  >
                                    {ADMINISTRATION_ROUTES.map((r) => (
                                      <option key={r} value={r}>
                                        {r}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsApplyPackageModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPkg || pkgItemsList.filter((i) => i.checked).length === 0}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black shadow-md shadow-amber-600/20"
                >
                  {isSubmittingPkg
                    ? 'Recording…'
                    : `Confirm Administered (${pkgItemsList.filter((i) => i.checked).length})`}
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
                Visit Completion Review
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
