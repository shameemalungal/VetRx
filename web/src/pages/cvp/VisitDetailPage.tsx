import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { cvpService } from '../../services/cvpService';
import { inventoryApi, type StockLocation } from '../../services/inventoryApi';
import type {
  Visit,
  VisitStatus,
  TreatmentPackage,
  Prescription,
  Invoice,
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
  Receipt,
} from 'lucide-react';
import { CreateFollowUpModal } from '../../components/cvp/CreateFollowUpModal';
import { ChangePriorityModal } from '../../components/cvp/ChangePriorityModal';
import { MedicineSelectorModal, type SelectedMedicineData } from '../../components/common/MedicineSelectorModal';
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

  // Load linked invoices originating from this visit (Stage 5)
  const linkedInvoices: Invoice[] = useLiveQuery(async () => {
    if (!id) return [];
    const allInv = await db.invoices.toArray();
    return allInv.filter((inv) => String((inv as any).visitId) === String(id));
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
  const [isChangePriorityOpen, setIsChangePriorityOpen] = useState(false);

  // Procedure form state
  const [procPatientName, setProcPatientName] = useState('');
  const [procCategory, setProcCategory] = useState('GENERAL');
  const [procName, setProcName] = useState('');
  const [procFee, setProcFee] = useState(0);
  const [procNotes, setProcNotes] = useState('');
  const [isSubmittingProc, setIsSubmittingProc] = useState(false);

  // Medicine usage form state
  const [medPatientName, setMedPatientName] = useState('');

  // Treatment package application state
  const [pkgSelectedId, setPkgSelectedId] = useState<number | string | null>(null);
  const [pkgPatientName, setPkgPatientName] = useState<string>('');
  const [pkgKitId, setPkgKitId] = useState<string>('');
  const [pkgItemsList, setPkgItemsList] = useState<Array<{
    id?: number | string;
    checked: boolean;
    medicineId?: number | string;
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

  const handlePriorityUpdate = async (newPriority: any, reason?: string) => {
    if (!visit?.id) return;
    try {
      await cvpService.updatePriority(visit.id, newPriority, {
        reason,
        isVisit: true,
      });
      setIsChangePriorityOpen(false);
    } catch (err: any) {
      console.error('Failed to update visit priority:', err);
      alert('Could not update priority: ' + err.message);
    }
  };

  const handleUnifiedMedicineSelect = async (medData: SelectedMedicineData) => {
    if (!visit?.id) return;
    const chosenKit = fieldKits.find((k) => k.id === selectedKitId);
    const idempotencyKey = `use_${visit.id}_${medData.brandName}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      const activeCase = visit.cases?.find((c) => c.species === medPatientName || c.patientName === medPatientName) || visit.cases?.[0];
      await cvpService.recordMedicineUsage(visit.id, {
        patientName: medPatientName || activeCase?.species || 'Animal',
        patientId: activeCase?.patientId,
        visitCaseId: activeCase?.id,
        medicineId: medData.medicineId || 0,
        medicineName: medData.brandName,
        quantityUsed: Number(medData.quantity) || 1,
        unit: medData.unit,
        route: medData.route,
        batchNumber: medData.batchNumber?.trim() || undefined,
        instructions: medData.instructions?.trim() || undefined,
        locationId: selectedKitId || undefined,
        locationName: chosenKit?.name || undefined,
        idempotencyKey,
      });
      setIsMedicineModalOpen(false);
    } catch (err) {
      console.error('Failed to record medicine usage:', err);
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
          <button
            type="button"
            onClick={() => setIsChangePriorityOpen(true)}
            className={`px-3 py-1.5 rounded-full text-xs font-black border flex items-center gap-1.5 shadow-sm hover:ring-2 hover:ring-offset-1 transition-all ${
              visit.priority === 'EMERGENCY'
                ? 'bg-red-600 hover:bg-red-700 text-white border-red-700'
                : visit.priority === 'URGENT'
                ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-700'
                : 'bg-teal-700 hover:bg-teal-800 text-white border-teal-800'
            }`}
            title="Click to edit triage priority"
          >
            <span>{visit.priority === 'EMERGENCY' ? '🚨 EMERGENCY' : visit.priority === 'URGENT' ? '⚡ URGENT' : '📅 ROUTINE'}</span>
            <span className="text-[10px] underline ml-1 font-semibold opacity-90">Change</span>
          </button>
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

          {/* Edit Priority Classification Action */}
          <button
            type="button"
            onClick={() => setIsChangePriorityOpen(true)}
            className="py-2.5 px-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
            title="Change Priority Classification"
          >
            <RefreshCw className="w-3.5 h-3.5 text-teal-700" />
            <span>Change Priority</span>
          </button>
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
                        {c.patientName ? `${c.patientName} (${c.species || 'Animal'})` : (c.species || 'Animal')}
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

                    <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const ownerId = visit?.ownerId || '';
                          const patId = c.patientId || '';
                          navigate(`/prescriptions/new?visitId=${visit?.id}&ownerId=${ownerId}&patientId=${patId}&visitCaseId=${c.id || ''}`);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 font-bold text-[11px] border border-teal-200 transition-colors shadow-sm"
                        title="Create separate Prescription for this animal"
                      >
                        <Plus className="w-3 h-3 text-teal-700" />
                        <span>Prescribe for {c.patientName || c.species || `Animal #${idx + 1}`}</span>
                      </button>
                    </div>
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
                  onClick={() => setIsMedicineModalOpen(true)}
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
              <div className="space-y-1">
                {visit.timelineEvents.map((ev, idx) => {
                  const evDate = new Date(ev.occurredAt);
                  const timeStr = evDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isLast = idx === visit.timelineEvents!.length - 1;

                  return (
                    <div key={ev.id || idx} className="flex items-stretch gap-3 text-xs">
                      {/* Left: Dedicated Marker Column */}
                      <div className="flex flex-col items-center shrink-0 w-4">
                        <span className="w-3 h-3 rounded-full bg-teal-700 ring-4 ring-teal-50 shrink-0 mt-1" />
                        {!isLast && <div className="w-0.5 bg-slate-200 flex-1 my-1" />}
                      </div>

                      {/* Right: Dedicated Text Column */}
                      <div className="flex-1 min-w-0 pb-4">
                        <div className="font-black text-slate-900 leading-tight">{ev.title}</div>
                        <div className="text-[11px] text-slate-600 font-medium mt-0.5">{timeStr}</div>
                        {ev.description && (
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed break-words">{ev.description}</p>
                        )}
                      </div>
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

          {/* Linked Prescriptions Card */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-700" />
                Linked Prescriptions ({linkedPrescriptions.length})
              </h2>
              <button
                type="button"
                onClick={() => {
                  const firstCase = visit.cases?.[0];
                  const firstPatId = firstCase?.patientId || '';
                  const ownerId = visit.ownerId || '';
                  const caseId = firstCase?.id || '';
                  navigate(`/prescriptions/new?visitId=${visit.id}&ownerId=${ownerId}&patientId=${firstPatId}&visitCaseId=${caseId}`);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 font-bold text-[11px] border border-teal-200 transition-colors"
                title="Create new Prescription linked to this visit"
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
                No Prescription created yet for this visit.
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
                  const firstCase = visit.cases?.[0];
                  const firstPatId = firstCase?.patientId || '';
                  const ownerId = visit.ownerId || '';
                  const caseId = firstCase?.id || '';
                  navigate(`/prescriptions/new?visitId=${visit.id}&ownerId=${ownerId}&patientId=${firstPatId}&visitCaseId=${caseId}`);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-teal-50 border border-teal-200 text-teal-900 font-bold flex items-center justify-between shadow-sm"
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                  <span>{linkedPrescriptions.length > 0 ? 'Create Additional Prescription' : 'Create Prescription'}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-teal-600" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const firstPatId = visit?.cases?.[0]?.patientId || (visit as any)?.patientId || '';
                  const ownerId = visit?.ownerId || '';
                  navigate(`/invoices/new?visitId=${visit?.id}&ownerId=${ownerId}&patientId=${firstPatId}`);
                }}
                className="w-full py-2 px-3 rounded-xl bg-white hover:bg-teal-50 border border-teal-200 text-teal-900 font-bold flex items-center justify-between shadow-sm"
              >
                <span className="flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-teal-600" />
                  <span>{linkedInvoices.length > 0 ? 'Create Additional Invoice' : 'Generate Invoice'}</span>
                </span>
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

            {/* Linked Invoices (Stage 5) */}
            {linkedInvoices.length > 0 && (
              <div className="pt-2 border-t border-teal-200/60 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                  Linked Invoices ({linkedInvoices.length})
                </div>
                {linkedInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    className="p-2.5 rounded-xl bg-white/80 border border-teal-200 flex items-center justify-between text-xs cursor-pointer hover:bg-white transition-all shadow-sm"
                  >
                    <div>
                      <div className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</div>
                      <div className="text-[10px] text-slate-500">
                        ₹{((inv.grandTotal || 0) / 100).toFixed(2)} • {inv.status}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                ))}
              </div>
            )}

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

      {/* ── Modal: Record Actual Medicine Usage (Shared Unified Selector) ── */}
      <MedicineSelectorModal
        isOpen={isMedicineModalOpen}
        onClose={() => setIsMedicineModalOpen(false)}
        onSelect={handleUnifiedMedicineSelect}
        mode="usage"
        targetAnimalName={medPatientName || visit.cases?.[0]?.species || 'Animal'}
      />

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

      {/* ── Modal: Change Priority / Classification ────────────────────────── */}
      <ChangePriorityModal
        isOpen={isChangePriorityOpen}
        currentPriority={visit.priority || 'PLANNED'}
        entityName={visit.ownerName || `Visit #${visit.id}`}
        onClose={() => setIsChangePriorityOpen(false)}
        onConfirm={handlePriorityUpdate}
      />
    </div>
  );
};
