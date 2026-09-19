// =============================================================
// VetRx — InvoiceBuilderPage (Create / Edit Invoice)
// Phase 6: Government-Prescribed Items & Rate-Control Support
// =============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type {
  InvoiceItem,
  InvoiceItemCategory,
  InvoiceStatus,
  MasterDataItem,
  Prescription,
} from '../../types';
import { Icon } from '../../components/ui/Icon';
import { useSettingsStore } from '../../store/settingsStore';
import { formatINR, getNextInvoiceNumber, formatLocalDateInput } from './invoiceUtils';
import { formatAnimalSubtitle, formatOwnerPrimary } from '../../utils/patientFormat';
import { DISPENSE_UNITS } from '../../utils/unitConverter';
import { ImportPrescriptionsModal, type SelectedMedicineImport } from './ImportPrescriptionsModal';
import './Invoices.css';

interface InvoiceBuilderProps {
  mode: 'new' | 'edit';
}

interface ItemDraft {
  id?: number;
  tempId: string;
  category: InvoiceItemCategory;
  description: string;
  quantity: number;
  unit: string;
  unitPricePaisa: number;
  discountAmtPaisa: number;
  isGovPrescribed?: boolean;
  govOrderNote?: string;
  govOrderNumber?: string;
  govOrderDate?: string;
  rateControlled?: boolean;
  // Multi-prescription source snapshot
  prescriptionId?: number;
  prescriptionNumber?: string;
  prescriptionDate?: Date | string;
  patientId?: number;
  patientName?: string;
  patientSubtitle?: string;
  ownerId?: number;
  ownerName?: string;
  medicineId?: number;
}

export const InvoiceBuilderPage: React.FC<InvoiceBuilderProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  const queryRxId = searchParams.get('prescriptionId') || searchParams.get('fromRx');
  const queryPatientId = searchParams.get('patientId');

  // Live queries
  const allPatients = useLiveQuery(() => db.patients.toArray(), []) || [];
  const allOwners = useLiveQuery(() => db.owners.toArray(), []) || [];
  const allMedicines = useLiveQuery(() => db.medicines.toArray(), []) || [];
  const masterInvoiceItems = useLiveQuery(
    () => db.masterDataItems.where('category').equals('invoice_item').toArray(),
    []
  ) || [];
  const masterInvoiceUnits = useLiveQuery(
    () => db.masterDataItems.where('category').equals('invoice_unit').toArray(),
    []
  ) || [];

  const { practitioner } = useSettingsStore();

  // Form states
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<number | ''>('');
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [prescriptionId, setPrescriptionId] = useState<number | undefined>(undefined);
  const [invoiceDate, setInvoiceDate] = useState<string>(
    formatLocalDateInput()
  );
  const [doctorDiscountPaisa, setDoctorDiscountPaisa] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<InvoiceStatus>('Draft');
  const [editRecordLoaded, setEditRecordLoaded] = useState(mode !== 'edit');  // Items in invoice
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Prescriptions for selected patient (for manual import)
  const patientPrescriptions = useLiveQuery<Prescription[]>(
    async () => {
      if (!selectedPatientId) return [];
      return db.prescriptions.where('patientId').equals(Number(selectedPatientId)).reverse().sortBy('createdAt');
    },
    [selectedPatientId]
  ) || [];

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // Modal form states
  const [modalCategory, setModalCategory] = useState<InvoiceItemCategory>('Consultation Fee');
  const [modalDescription, setModalDescription] = useState('');
  const [modalQuantity, setModalQuantity] = useState(1);
  const [modalUnit, setModalUnit] = useState('Per unit');
  const [modalUnitPriceRupees, setModalUnitPriceRupees] = useState('0');
  const [modalDiscountRupees, setModalDiscountRupees] = useState('0');
  const [modalIsGovPrescribed, setModalIsGovPrescribed] = useState(false);
  const [modalGovOrderNumber, setModalGovOrderNumber] = useState('G.O.(Rt) No.589/2023/AHD');
  const [modalGovOrderDate, setModalGovOrderDate] = useState('13-12-2023');
  const [modalRateControlled, setModalRateControlled] = useState(false);
  const [modalError, setModalError] = useState('');

  // Tab & search states for Quick Insert inside modal
  const [catalogCategoryTab, setCatalogCategoryTab] = useState<string>('All');
  const [catalogSearchQuery, setCatalogSearchQuery] = useState<string>('');

  // Initial load
  useEffect(() => {
    async function loadData() {
      if (mode === 'edit' && id) {
        const inv = await db.invoices.get(parseInt(id, 10));
        if (inv) {
          setInvoiceNumber(inv.invoiceNumber);
          setSelectedPatientId(inv.patientId);
          setPrescriptionId(inv.prescriptionId);
          setInvoiceDate(formatLocalDateInput(inv.invoiceDate));
          setDoctorDiscountPaisa(inv.discountTotal || 0);
          setNotes(inv.notes || '');
          setStatus(inv.status);

          const existingItems = await db.invoiceItems
            .where('invoiceId')
            .equals(inv.id!)
            .sortBy('sortOrder');

          setItems(
            existingItems.map((it, idx) => ({
              id: it.id,
              tempId: `existing_${idx}_${Date.now()}`,
              category: it.category,
              description: it.description,
              quantity: it.quantity,
              unit: it.unit || 'unit',
              unitPricePaisa: it.unitPricePaisa,
              discountAmtPaisa: it.discountAmtPaisa || 0,
              isGovPrescribed: it.isGovPrescribed,
              govOrderNote: it.govOrderNote,
              govOrderNumber: it.govOrderNumber,
              govOrderDate: it.govOrderDate,
              rateControlled: it.rateControlled,
              prescriptionId: it.prescriptionId,
              prescriptionNumber: it.prescriptionNumber,
              prescriptionDate: it.prescriptionDate,
              patientId: it.patientId,
              patientName: it.patientName,
              patientSubtitle: it.patientSubtitle,
              ownerId: it.ownerId,
              ownerName: it.ownerName,
              medicineId: it.medicineId,
            }))
          );
        }
        setEditRecordLoaded(true);
      } else {
        // Mode 'new'
        const nextNum = await getNextInvoiceNumber();
        setInvoiceNumber(nextNum);

        // Pre-fill from Rx if requested
        if (queryRxId) {
          const rxIdNum = parseInt(queryRxId, 10);
          const rx = await db.prescriptions.get(rxIdNum);
          if (rx) {
            setPrescriptionId(rxIdNum);
            setSelectedPatientId(rx.patientId);
            setNotes(`Linked to clinical prescription #${rx.rxNumber}`);

            const rxPatient = await db.patients.get(rx.patientId);
            const rxOwner = rxPatient ? await db.owners.get(rxPatient.ownerId) : undefined;
            const rxPatientSubtitle = rxPatient ? formatAnimalSubtitle(rxPatient) : undefined;
            const rxDateStr = rx.createdAt instanceof Date ? rx.createdAt.toISOString() : String(rx.createdAt || '');

            const rxItems = await db.prescriptionItems
              .where('prescriptionId')
              .equals(rxIdNum)
              .toArray();

            const draftedItems: ItemDraft[] = rxItems.map((rxi, i) => ({
              tempId: `rx_${i}_${Date.now()}`,
              category: 'Prescription Medicine',
              description: `${rxi.brandName}${rxi.strengthVolume ? ' ' + rxi.strengthVolume : ''}`,
              quantity: rxi.quantity || 1,
              unit: rxi.dispenseUnit || rxi.unit || 'tablets',
              unitPricePaisa: 0, // Safe default rate of 0 (UAT Requirement 8)
              discountAmtPaisa: 0,
              rateControlled: false,
              prescriptionId: rx.id,
              prescriptionNumber: rx.rxNumber,
              prescriptionDate: rxDateStr,
              patientId: rx.patientId,
              patientName: rxPatient?.name,
              patientSubtitle: rxPatientSubtitle,
              ownerId: rxPatient?.ownerId,
              ownerName: rxOwner?.name,
              medicineId: rxi.medicineId,
            }));

            // Add standard consultation fee
            draftedItems.unshift({
              tempId: `consult_${Date.now()}`,
              category: 'Consultation Fee',
              description: 'Clinical Consultation & Physical Examination',
              quantity: 1,
              unit: 'Per visit',
              unitPricePaisa: 50000, // ₹500
              discountAmtPaisa: 0,
              rateControlled: false,
              patientId: rx.patientId,
              patientName: rxPatient?.name,
              patientSubtitle: rxPatientSubtitle,
              ownerId: rxPatient?.ownerId,
              ownerName: rxOwner?.name,
            });

            setItems(draftedItems);
          }
        } else if (queryPatientId) {
          setSelectedPatientId(parseInt(queryPatientId, 10));
        }
      }
    }

    void loadData();
  }, [mode, id, queryRxId, queryPatientId]);

  // Selected Patient & Owner
  const selectedPatient = useMemo(() => {
    return allPatients.find((p) => p.id === selectedPatientId);
  }, [allPatients, selectedPatientId]);

  const selectedOwner = useMemo(() => {
    if (!selectedPatient) return null;
    return allOwners.find((o) => o.id === selectedPatient.ownerId);
  }, [allOwners, selectedPatient]);

  // Filtered patients for owner-first searchable selection
  const filteredPatients = useMemo(() => {
    if (!allPatients) return [];
    if (!patientSearchQuery.trim()) return allPatients.slice(0, 20);
    const q = patientSearchQuery.toLowerCase().trim();
    return allPatients.filter((p) => {
      const owner = allOwners.find((o) => o.id === p.ownerId);
      const ownerName = (owner?.name || '').toLowerCase();
      const ownerPhone = (owner?.phone || '').toLowerCase();
      const petName = (p.name || '').toLowerCase();
      const species = (p.species || '').toLowerCase();
      const breed = (p.breed || '').toLowerCase();
      return (
        ownerName.includes(q) ||
        ownerPhone.includes(q) ||
        petName.includes(q) ||
        species.includes(q) ||
        breed.includes(q)
      );
    });
  }, [allPatients, allOwners, patientSearchQuery]);

  // Master invoice units dropdown list
  const availableInvoiceUnits = useMemo(() => {
    const fallback = [
      'Per unit',
      'Per consultation',
      'Per certificate',
      'Per report',
      'Per procedure',
      'Per visit',
      'Per dose',
      'Per vial',
      ...DISPENSE_UNITS,
      'tablets',
      'capsules',
      'ml',
      'drops',
    ];
    const fromDb = masterInvoiceUnits.filter((u) => u.isActive !== false).map((u) => u.name);
    const combined = Array.from(new Set([...fromDb, ...fallback]));
    if (modalUnit && !combined.includes(modalUnit)) {
      combined.push(modalUnit);
    }
    return combined;
  }, [masterInvoiceUnits, modalUnit]);

  // Grouped and filterable Quick Insert Catalog items (UAT Requirement 7)
  const catalogItems = useMemo(() => {
    type CatalogEntry = {
      id: string;
      name: string;
      categoryTag: string;
      unit: string;
      priceRupees: string;
      isGovPrescribed: boolean;
      onSelect: () => void;
    };

    const entries: CatalogEntry[] = [];

    masterInvoiceItems.forEach((mItem) => {
      let catTag = 'Other';
      if (mItem.isGovPrescribed) {
        catTag = 'Statutory / Govt';
      } else if (
        (mItem.category as string) === 'Consultation Fee' ||
        mItem.code.toLowerCase().includes('consult') ||
        mItem.name.toLowerCase().includes('consult')
      ) {
        catTag = 'Consultation';
      } else if (
        (mItem.category as string) === 'Procedure Fee' ||
        mItem.code.toLowerCase().includes('proc') ||
        mItem.name.toLowerCase().includes('proc') ||
        mItem.name.toLowerCase().includes('surgery') ||
        mItem.name.toLowerCase().includes('dressing')
      ) {
        catTag = 'Procedures';
      } else if (
        (mItem.category as string) === 'Lab Fee' ||
        mItem.code.toLowerCase().includes('lab') ||
        mItem.name.toLowerCase().includes('lab') ||
        mItem.name.toLowerCase().includes('test') ||
        mItem.name.toLowerCase().includes('blood') ||
        mItem.name.toLowerCase().includes('skin')
      ) {
        catTag = 'Laboratory';
      }

      entries.push({
        id: `m_${mItem.id}`,
        name: mItem.name,
        categoryTag: catTag,
        unit: mItem.unit || 'Per unit',
        priceRupees: ((mItem.defaultPricePaisa || 0) / 100).toFixed(0),
        isGovPrescribed: !!mItem.isGovPrescribed,
        onSelect: () => handleSelectMasterItem(mItem),
      });
    });

    allMedicines.forEach((med) => {
      entries.push({
        id: `med_${med.id}`,
        name: `${med.brandName}${med.presentation ? ' ' + med.presentation : ''}`,
        categoryTag: 'Medicines',
        unit: med.presentation || 'tablets',
        priceRupees: '0',
        isGovPrescribed: false,
        onSelect: () => handleSelectMedicine(med),
      });
    });

    let filtered = entries;
    if (catalogCategoryTab !== 'All') {
      filtered = filtered.filter((e) => e.categoryTag === catalogCategoryTab);
    }
    if (catalogSearchQuery.trim()) {
      const q = catalogSearchQuery.toLowerCase().trim();
      filtered = filtered.filter((e) => e.name.toLowerCase().includes(q));
    }
    return filtered.slice(0, 30);
  }, [masterInvoiceItems, allMedicines, catalogCategoryTab, catalogSearchQuery]);

  // Import prescription medicines handler (UAT Requirement 8)
  const handleImportPrescription = async (rxIdToImport: number) => {
    const rx = await db.prescriptions.get(rxIdToImport);
    if (!rx) return;
    const rxItems = await db.prescriptionItems.where('prescriptionId').equals(rxIdToImport).toArray();
    if (rxItems.length === 0) {
      alert('No medicines found in this prescription.');
      return;
    }
    const rxPatient = await db.patients.get(rx.patientId);
    const rxOwner = rxPatient ? await db.owners.get(rxPatient.ownerId) : undefined;
    const rxPatientSubtitle = rxPatient ? formatAnimalSubtitle(rxPatient) : undefined;
    const rxDateStr = rx.createdAt instanceof Date ? rx.createdAt.toISOString() : String(rx.createdAt || '');

    const newItems: ItemDraft[] = rxItems.map((rxi, i) => ({
      tempId: `imported_rx_${rxi.id || i}_${Date.now()}`,
      category: 'Prescription Medicine',
      description: `${rxi.brandName}${rxi.strengthVolume ? ' ' + rxi.strengthVolume : ''}`,
      quantity: rxi.quantity || 1,
      unit: rxi.dispenseUnit || rxi.unit || 'tablets',
      unitPricePaisa: 0, // Safe default rate 0
      discountAmtPaisa: 0,
      rateControlled: false,
      prescriptionId: rx.id,
      prescriptionNumber: rx.rxNumber,
      prescriptionDate: rxDateStr,
      patientId: rx.patientId,
      patientName: rxPatient?.name,
      patientSubtitle: rxPatientSubtitle,
      ownerId: rxPatient?.ownerId,
      ownerName: rxOwner?.name,
      medicineId: rxi.medicineId,
    }));
    setItems((prev) => [...prev, ...newItems]);
    if (!prescriptionId) {
      setPrescriptionId(rxIdToImport);
    }
    if (!notes) {
      setNotes(`From Rx: #${rx.rxNumber}`);
    }
  };

  // Multi-Prescription Import Handler from Modal
  const handleImportMedicinesFromModal = (importedList: SelectedMedicineImport[]) => {
    if (!importedList.length) return;

    const newDrafts: ItemDraft[] = importedList.map((imp, idx) => {
      const dirStr = imp.directions ? ` (${imp.directions})` : '';
      const strVolStr = imp.strengthVolume ? ` ${imp.strengthVolume}` : '';
      return {
        tempId: `imported_rx_${imp.prescriptionItemId || idx}_${Date.now()}_${idx}`,
        category: 'Prescription Medicine',
        description: imp.description || `${imp.brandName}${strVolStr}${dirStr}`.trim(),
        quantity: Math.max(1, imp.quantity || 1),
        unit: imp.unit || 'tablets',
        unitPricePaisa: 0, // Safe default rate of 0
        discountAmtPaisa: 0,
        rateControlled: false,
        prescriptionId: imp.prescriptionId,
        prescriptionNumber: imp.prescriptionNumber,
        prescriptionDate: imp.prescriptionDate,
        patientId: imp.patientId,
        patientName: imp.patientName,
        patientSubtitle: imp.patientSubtitle,
        ownerId: imp.ownerId,
        ownerName: imp.ownerName,
        medicineId: imp.medicineId,
      };
    });

    setItems((prev) => [...prev, ...newDrafts]);

    // If no primary patient is selected yet and items have a patient, auto-select patient
    if (!selectedPatientId && newDrafts[0]?.patientId) {
      setSelectedPatientId(newDrafts[0].patientId);
    }
    // If no primary prescriptionId is set, set the first one
    if (!prescriptionId && newDrafts[0]?.prescriptionId) {
      setPrescriptionId(newDrafts[0].prescriptionId);
    }
    // Update notes if empty with list of prescription numbers
    if (!notes.trim()) {
      const uniqueRxNums = Array.from(new Set(newDrafts.map((d) => d.prescriptionNumber).filter(Boolean)));
      if (uniqueRxNums.length > 0) {
        setNotes(`Includes medicines from Rx: ${uniqueRxNums.map((n) => `#${n}`).join(', ')}`);
      }
    }
  };

  // Calculations
  const calculations = useMemo(() => {
    let grossSubtotalPaisa = 0;
    let itemDiscountsPaisa = 0;

    items.forEach((item) => {
      const lineSubtotal = Math.round(item.quantity * item.unitPricePaisa);
      grossSubtotalPaisa += lineSubtotal;
      itemDiscountsPaisa += item.discountAmtPaisa || 0;
    });

    const netBeforeDoctorDiscount = Math.max(0, grossSubtotalPaisa - itemDiscountsPaisa);
    const finalTotalPaisa = Math.max(0, netBeforeDoctorDiscount - doctorDiscountPaisa);

    return {
      grossSubtotalPaisa,
      itemDiscountsPaisa,
      doctorDiscountPaisa,
      finalTotalPaisa,
    };
  }, [items, doctorDiscountPaisa]);

  // Open Modal to Add
  const handleOpenAddItem = (prefillCategory?: InvoiceItemCategory) => {
    setEditingItemIndex(null);
    setModalCategory(prefillCategory || 'Other');
    setModalDescription('');
    setModalQuantity(1);
    setModalUnit('Per unit');
    setModalUnitPriceRupees('0');
    setModalDiscountRupees('0');
    setModalIsGovPrescribed(false);
    setModalGovOrderNumber('G.O.(Rt) No.589/2023/AHD');
    setModalGovOrderDate('13-12-2023');
    setModalRateControlled(false);
    setModalError('');
    setIsItemModalOpen(true);
  };

  // Open Modal to Edit
  const handleOpenEditItem = (index: number) => {
    const item = items[index];
    if (!item) return;
    setEditingItemIndex(index);
    setModalCategory(item.category);
    setModalDescription(item.description);
    setModalQuantity(item.quantity);
    setModalUnit(item.unit || 'Per unit');
    setModalUnitPriceRupees(((item.unitPricePaisa || 0) / 100).toFixed(2));
    setModalDiscountRupees(((item.discountAmtPaisa || 0) / 100).toFixed(2));
    setModalIsGovPrescribed(!!item.isGovPrescribed);
    setModalGovOrderNumber(item.govOrderNumber || 'G.O.(Rt) No.589/2023/AHD');
    setModalGovOrderDate(item.govOrderDate || '13-12-2023');
    setModalRateControlled(!!item.rateControlled);
    setModalError('');
    setIsItemModalOpen(true);
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Quick Select from Master Catalog / Govt Rates in Modal
  const handleSelectMasterItem = (mItem: MasterDataItem) => {
    setModalDescription(mItem.name);
    setModalUnit(mItem.unit || 'Per unit');
    if (mItem.defaultPricePaisa !== undefined) {
      setModalUnitPriceRupees((mItem.defaultPricePaisa / 100).toFixed(2));
    }

    if (mItem.isGovPrescribed) {
      setModalIsGovPrescribed(true);
      setModalGovOrderNumber(mItem.govOrderNumber || 'G.O.(Rt) No.589/2023/AHD');
      setModalGovOrderDate(mItem.govOrderDate || '13-12-2023');
      setModalRateControlled(true);
      setModalCategory('Other');
    } else {
      setModalIsGovPrescribed(false);
      setModalRateControlled(!!mItem.rateControlled);
      if (mItem.code.includes('consult')) {
        setModalCategory('Consultation Fee');
      } else if (mItem.code.includes('proc')) {
        setModalCategory('Procedure Fee');
      }
    }
  };

  // Quick Select Medicine in Modal
  const handleSelectMedicine = (med: any) => {
    setModalDescription(`${med.brandName}${med.genericName ? ' (' + med.genericName + ')' : ''} ${med.presentation || ''}`.trim());
    setModalCategory('Medicine');
    setModalUnit(med.presentation || 'tablets');
    setModalUnitPriceRupees('0.00');
    setModalIsGovPrescribed(false);
    setModalRateControlled(false);
  };

  // Save Modal Item
  const handleSaveModalItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalDescription.trim()) {
      setModalError('Item description is required.');
      return;
    }
    const unitPriceRupees = parseFloat(modalUnitPriceRupees);
    if (isNaN(unitPriceRupees) || unitPriceRupees < 0) {
      setModalError('Please enter a valid unit price.');
      return;
    }
    const discountRupees = parseFloat(modalDiscountRupees) || 0;

    const unitPricePaisa = Math.round(unitPriceRupees * 100);
    const discountAmtPaisa = Math.round(discountRupees * 100);

    // Exact statutory note if government prescribed
    const govNote = modalIsGovPrescribed
      ? `As per the rate fixed by ${modalGovOrderNumber.trim()} dated ${modalGovOrderDate.trim()}.`
      : undefined;

    const updatedDraft: ItemDraft = {
      tempId: editingItemIndex !== null ? items[editingItemIndex].tempId : `item_${Date.now()}`,
      id: editingItemIndex !== null ? items[editingItemIndex].id : undefined,
      category: modalCategory,
      description: modalDescription.trim(),
      quantity: Math.max(1, modalQuantity),
      unit: modalUnit.trim() || 'Per unit',
      unitPricePaisa,
      discountAmtPaisa,
      isGovPrescribed: modalIsGovPrescribed,
      govOrderNumber: modalIsGovPrescribed ? modalGovOrderNumber.trim() : undefined,
      govOrderDate: modalIsGovPrescribed ? modalGovOrderDate.trim() : undefined,
      govOrderNote: govNote,
      rateControlled: modalIsGovPrescribed ? true : modalRateControlled,
      prescriptionId: editingItemIndex !== null ? items[editingItemIndex].prescriptionId : undefined,
      prescriptionNumber: editingItemIndex !== null ? items[editingItemIndex].prescriptionNumber : undefined,
      prescriptionDate: editingItemIndex !== null ? items[editingItemIndex].prescriptionDate : undefined,
      patientId: editingItemIndex !== null ? items[editingItemIndex].patientId : undefined,
      patientName: editingItemIndex !== null ? items[editingItemIndex].patientName : undefined,
      patientSubtitle: editingItemIndex !== null ? items[editingItemIndex].patientSubtitle : undefined,
      ownerId: editingItemIndex !== null ? items[editingItemIndex].ownerId : undefined,
      ownerName: editingItemIndex !== null ? items[editingItemIndex].ownerName : undefined,
      medicineId: editingItemIndex !== null ? items[editingItemIndex].medicineId : undefined,
    };

    if (editingItemIndex !== null) {
      setItems((prev) => {
        const next = [...prev];
        next[editingItemIndex] = updatedDraft;
        return next;
      });
    } else {
      setItems((prev) => [...prev, updatedDraft]);
    }

    setIsItemModalOpen(false);
  };

  // Save entire invoice
  const handleSaveInvoice = async (saveStatus: InvoiceStatus) => {
    if (!selectedPatientId) {
      alert('Please select a patient before saving the invoice.');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one billed item to the invoice.');
      return;
    }
    if (mode === 'edit' && status !== 'Draft') {
      alert('Issued or cancelled invoices are read-only. Create a new invoice or revise from a draft.');
      return;
    }

    const patient = allPatients.find((p) => p.id === selectedPatientId);
    const ownerId = patient?.ownerId;
    if (!ownerId) {
      alert('The selected patient has no valid owner association. Please correct the patient record before invoicing.');
      return;
    }
    if (!practitioner?.id) {
      alert('Please configure the veterinarian profile in Settings before creating an invoice.');
      return;
    }

    try {
      let savedInvoiceId: number;

      // Extract all unique prescription IDs from line items
      const rxIdsFromItems = Array.from(
        new Set(
          items
            .map((it) => it.prescriptionId)
            .filter((pid): pid is number => typeof pid === 'number' && pid > 0)
        )
      );
      const combinedRxIds = Array.from(
        new Set([...(prescriptionId ? [prescriptionId] : []), ...rxIdsFromItems])
      );
      const primaryPrescriptionId = combinedRxIds[0] || undefined;

      if (mode === 'edit' && id) {
        const invIdNum = parseInt(id, 10);
        await db.invoices.update(invIdNum, {
          patientId: selectedPatientId as number,
          ownerId,
          prescriptionId: primaryPrescriptionId,
          prescriptionIds: combinedRxIds.length > 0 ? combinedRxIds : undefined,
          invoiceDate: new Date(invoiceDate),
          discountTotal: doctorDiscountPaisa,
          taxTotal: 0,
          grandTotal: calculations.finalTotalPaisa,
          status: saveStatus,
          notes: notes.trim() || undefined,
          issuedAt: saveStatus === 'Issued' ? new Date() : undefined,
          updatedAt: new Date(),
        });

        // Delete old items and insert updated
        await db.invoiceItems.where('invoiceId').equals(invIdNum).delete();
        savedInvoiceId = invIdNum;
      } else {
        savedInvoiceId = (await db.invoices.add({
          invoiceNumber,
          patientId: selectedPatientId as number,
          ownerId,
          practitionerId: practitioner.id,
          prescriptionId: primaryPrescriptionId,
          prescriptionIds: combinedRxIds.length > 0 ? combinedRxIds : undefined,
          invoiceDate: new Date(invoiceDate),
          discountTotal: doctorDiscountPaisa,
          taxTotal: 0,
          grandTotal: calculations.finalTotalPaisa,
          status: saveStatus,
          notes: notes.trim() || undefined,
          issuedAt: saveStatus === 'Issued' ? new Date() : undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        })) as number;
      }

      // Add line items
      const itemsToInsert: InvoiceItem[] = items.map((item, idx) => {
        const lineSubtotal = Math.round(item.quantity * item.unitPricePaisa);
        const lineTotal = Math.max(0, lineSubtotal - (item.discountAmtPaisa || 0));

        return {
          invoiceId: savedInvoiceId,
          category: item.category,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPricePaisa: item.unitPricePaisa,
          discountPct: 0,
          taxPct: 0,
          subtotalPaisa: lineSubtotal,
          discountAmtPaisa: item.discountAmtPaisa || 0,
          taxAmtPaisa: 0,
          lineTotalPaisa: lineTotal,
          sortOrder: idx + 1,
          isGovPrescribed: item.isGovPrescribed,
          govOrderNumber: item.govOrderNumber,
          govOrderDate: item.govOrderDate,
          govOrderNote: item.govOrderNote,
          rateControlled: item.rateControlled,
          prescriptionId: item.prescriptionId,
          prescriptionNumber: item.prescriptionNumber,
          prescriptionDate: item.prescriptionDate,
          patientId: item.patientId,
          patientName: item.patientName,
          patientSubtitle: item.patientSubtitle,
          ownerId: item.ownerId,
          ownerName: item.ownerName,
          medicineId: item.medicineId,
        };
      });

      await db.invoiceItems.bulkAdd(itemsToInsert);

      navigate(`/invoices/${savedInvoiceId}`);
    } catch (err: any) {
      alert(`Failed to save invoice: ${err?.message || err}`);
    }
  };

  if (mode === 'edit' && !editRecordLoaded) {
    return (
      <div className="invoices-page-container">
        <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <div className="section-title">Loading invoice…</div>
        </div>
      </div>
    );
  }

  if (mode === 'edit' && status !== 'Draft') {
    return (
      <div className="invoices-page-container">
        <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
          <Icon name="lock" size={28} className="text-primary" />
          <div className="section-title" style={{ marginTop: '10px' }}>Invoice is read-only</div>
          <p className="section-sub">{status === 'Issued' ? 'Issued invoices cannot be silently overwritten.' : 'Cancelled invoices remain preserved in history.'}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/invoices/${id}`)}>
            <Icon name="chevron-left" size={15} />
            <span>Back to Invoice</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="invoices-page-container">
      {/* Top Breadcrumb Navigation */}
      <div style={{ marginBottom: '16px' }}>
        <Link to="/invoices" className="btn-back" title="Back to Invoices">
          <Icon name="arrow-left" size={14} />
          <span>Back</span>
        </Link>
      </div>

      {/* Top Banner & Context Notification */}
      <div className="invoices-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h1 className="invoices-title" style={{ margin: 0 }}>
              {mode === 'edit' ? `Edit Invoice (${invoiceNumber})` : 'Create Invoice'}
            </h1>
            {mode === 'edit' && (
              <span className={`invoice-status-pill status-${status.toLowerCase()}`}>
                {status}
              </span>
            )}
            {prescriptionId && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'var(--color-primary-fixed)',
                  color: 'var(--color-on-primary-fixed)',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                <Icon name="check" size={12} /> Auto-linked from Rx
              </span>
            )}
          </div>
          <p className="invoices-subtitle" style={{ marginTop: '4px' }}>
            Bill clinical services, government-prescribed certificates, and medicines.
          </p>
        </div>

        <div className="invoices-actions-deck">
          <button
            type="button"
            className="btn btn-secondary btn-md"
            onClick={() => navigate('/invoices')}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-md"
            onClick={() => handleSaveInvoice('Draft')}
            id="btn-save-draft"
          >
            Save Draft
          </button>
          <button
            type="button"
            className="btn btn-primary btn-md"
            onClick={() => handleSaveInvoice('Issued')}
            id="btn-issue-invoice"
          >
            <Icon name="check" size={18} />
            <span>{mode === 'edit' ? 'Update & Issue' : 'Save & Issue Invoice'}</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Clinical Layout */}
      <div className="invoice-builder-layout">
        {/* Left Column: Patient & Items (8 cols) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          {/* Patient Signalment Strip */}
          <div className="invoice-patient-strip">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
              <div className="invoice-patient-avatar">
                <Icon name="paw" size={28} />
              </div>

              <div className="invoice-patient-info">
                {selectedPatient ? (
                  <>
                    <div className="invoice-patient-name-row">
                      <span className="invoice-patient-name">{formatOwnerPrimary(selectedOwner, 'Client')}</span>
                      {selectedOwner?.phone && (
                        <span style={{ fontSize: '12px', fontFamily: 'var(--font-data)', color: 'var(--color-on-surface-variant)' }}>
                          ({selectedOwner.phone})
                        </span>
                      )}
                      {selectedPatient.species && (
                        <span className="invoices-status-pill issued">{selectedPatient.species}</span>
                      )}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-on-surface-variant)' }}>
                      {formatAnimalSubtitle(selectedPatient)}
                    </span>
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-primary)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        padding: 0,
                        textAlign: 'left',
                        marginTop: '4px',
                        fontWeight: 600,
                      }}
                      onClick={() => setSelectedPatientId('')}
                    >
                      Change Patient
                    </button>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                    <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                      Select Patient for Invoice <span className="text-error">*</span>
                    </label>

                    {/* Search Input */}
                    <div style={{ position: 'relative', width: '100%', maxWidth: '480px' }}>
                      <Icon
                        name="search"
                        size={16}
                        style={{
                          position: 'absolute',
                          left: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--color-outline)',
                          pointerEvents: 'none',
                        }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        style={{ paddingLeft: '36px', paddingRight: patientSearchQuery ? '36px' : '12px' }}
                        placeholder="Search client name, phone, pet name, species..."
                        value={patientSearchQuery}
                        onChange={(e) => setPatientSearchQuery(e.target.value)}
                        autoComplete="off"
                      />
                      {patientSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setPatientSearchQuery('')}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-outline)',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          title="Clear search"
                        >
                          <Icon name="x-mark" size={14} />
                        </button>
                      )}
                    </div>

                    {/* Filtered Owner-First Patient Cards List */}
                    <div
                      style={{
                        maxHeight: '220px',
                        overflowY: 'auto',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius)',
                        background: 'var(--color-surface-container-lowest)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        padding: '4px',
                        maxWidth: '560px',
                      }}
                    >
                      {filteredPatients.length === 0 ? (
                        <div style={{ padding: '14px', textAlign: 'center', color: 'var(--color-outline)', fontSize: '12px' }}>
                          {patientSearchQuery.trim()
                            ? `No registered patients found matching "${patientSearchQuery}"`
                            : 'No registered animals available'}
                        </div>
                      ) : (
                        filteredPatients.map((p) => {
                          const o = allOwners.find((x) => x.id === p.ownerId);
                          const ownerDisplayName = formatOwnerPrimary(o, 'Registered Client');
                          const animalSubtitle = formatAnimalSubtitle(p);
                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                setSelectedPatientId(p.id!);
                                setPatientSearchQuery('');
                              }}
                              style={{
                                padding: '8px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                transition: 'background-color 0.15s ease',
                                gap: '10px',
                                border: '1px solid transparent',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--color-surface-container)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <strong style={{ fontSize: '13px', color: 'var(--color-on-surface)' }}>
                                    {ownerDisplayName}
                                  </strong>
                                  {o?.phone && (
                                    <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-data)' }}>
                                      {o.phone}
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
                                  {animalSubtitle}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                {p.species && (
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      padding: '2px 8px',
                                      borderRadius: 'var(--radius-full)',
                                      background: 'var(--color-surface-container-high)',
                                      color: 'var(--color-on-surface-variant)',
                                    }}
                                  >
                                    {p.species}
                                  </span>
                                )}
                                <span style={{ color: 'var(--color-primary)', fontSize: '12px', fontWeight: 600 }}>
                                  Select →
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Owner Details */}
            {selectedOwner && (
              <div className="invoice-client-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon name="user" size={15} />
                  <strong style={{ fontSize: '13px', color: 'var(--color-on-surface)' }}>
                    {selectedOwner.name}
                  </strong>
                </div>
                {selectedOwner.phone && (
                  <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
                    {selectedOwner.phone}
                  </span>
                )}
                {selectedOwner.address && (
                  <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
                    {selectedOwner.address}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Billed Items Section */}
          <div className="invoice-items-section">
            <div className="invoice-items-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700 }}>
                  Billed Items
                </h2>
                <span className="master-data-count-chip">{items.length} items</span>
              </div>

              {/* Fast Category Quick-Add Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleOpenAddItem()}
                  id="btn-add-item-modal"
                >
                  <Icon name="plus" size={15} />
                  <span>Add Item</span>
                </button>

                {/* Import from multi-prescription modal */}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)', fontWeight: 600 }}
                  onClick={() => setIsImportModalOpen(true)}
                  title="Import medicines from multiple prescriptions across owners or patients"
                  id="btn-import-prescriptions-modal"
                >
                  <Icon name="pill" size={14} />
                  <span>+ Add Prescription Medicines</span>
                </button>

                {/* Import from prescription button if patient has prescriptions */}
                {patientPrescriptions.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)', fontWeight: 600 }}
                    onClick={() => {
                      const latestRx = patientPrescriptions[0];
                      if (latestRx?.id) {
                        void handleImportPrescription(latestRx.id);
                      }
                    }}
                    title={`Import medicines from prescription #${patientPrescriptions[0]?.rxNumber}`}
                  >
                    <Icon name="pill" size={14} />
                    <span>Import Latest Rx ({patientPrescriptions[0]?.rxNumber})</span>
                  </button>
                )}

                {/* Quick Add Pill for Government Rate items */}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    handleOpenAddItem('Other');
                    // Find Certificate Issuance from master data
                    const certItem = masterInvoiceItems.find((m) => m.code === 'cert_issuance');
                    if (certItem) {
                      handleSelectMasterItem(certItem);
                    }
                  }}
                  title="Add Government-Prescribed Certificate (₹250)"
                  style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                >
                  <Icon name="lock" size={14} />
                  <span>Govt Certificate (₹250)</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    handleOpenAddItem('Other');
                    // Find Necropsy Report from master data
                    const necropsyItem = masterInvoiceItems.find((m) => m.code === 'necropsy_report');
                    if (necropsyItem) {
                      handleSelectMasterItem(necropsyItem);
                    }
                  }}
                  title="Add Government-Prescribed Necropsy Report (₹1,000)"
                  style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                >
                  <Icon name="lock" size={14} />
                  <span>Govt Necropsy (₹1,000)</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenAddItem('Medicine')}
                >
                  <Icon name="plus" size={14} />
                  <span>Medicine</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenAddItem('Consultation Fee')}
                >
                  <Icon name="plus" size={14} />
                  <span>Consultation</span>
                </button>
              </div>
            </div>

            {/* Items List */}
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px', color: 'var(--color-outline)' }}>
                <Icon name="invoices" size={32} />
                <p style={{ marginTop: '8px', fontSize: '13px' }}>
                  No items billed yet. Click &quot;Add Item&quot; or select a category above.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {items.map((item, idx) => {
                  const lineSubtotal = Math.round(item.quantity * item.unitPricePaisa);
                  const netLineAmount = Math.max(0, lineSubtotal - (item.discountAmtPaisa || 0));

                  return (
                    <div key={item.tempId} className="invoice-item-card">
                      <div className="invoice-item-row-main">
                        <div className="invoice-item-desc-col">
                          <div className="invoice-item-icon">
                            {item.isGovPrescribed ? (
                              <Icon name="lock" size={20} />
                            ) : item.category === 'Medicine' ? (
                              <Icon name="pill" size={20} />
                            ) : (
                              <Icon name="clinical-notes" size={20} />
                            )}
                          </div>

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span className="invoice-item-title">{item.description}</span>
                              <span className="invoices-status-pill draft">{item.category}</span>
                              {item.isGovPrescribed && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    background: 'rgba(0, 104, 95, 0.12)',
                                    color: 'var(--color-primary)',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  <Icon name="lock" size={10} /> Statutory Fixed Rate
                                </span>
                              )}
                            </div>

                            <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                              Billing unit: <strong>{item.unit || 'Per unit'}</strong>
                            </span>

                            {(item.prescriptionNumber || item.patientName) && (
                              <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                {item.prescriptionNumber && (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      background: 'var(--color-secondary-container, #e8def8)',
                                      color: 'var(--color-on-secondary-container, #1d192b)',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                    }}
                                  >
                                    <Icon name="pill" size={11} /> Rx #{item.prescriptionNumber}
                                  </span>
                                )}
                                {item.patientName && (
                                  <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
                                    Patient: <strong>{item.patientName}</strong>
                                    {item.ownerName ? ` (${item.ownerName})` : ''}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Pricing & Actions */}
                        <div className="invoice-item-pricing-cols">
                          <div className="invoice-item-price-block">
                            <span className="invoice-item-price-label">Qty</span>
                            <span style={{ fontFamily: 'var(--font-data)', fontWeight: 700 }}>
                              {item.quantity}
                            </span>
                          </div>

                          <div className="invoice-item-price-block">
                            <span className="invoice-item-price-label">Rate</span>
                            <span style={{ fontFamily: 'var(--font-data)' }}>
                              {formatINR(item.unitPricePaisa)}
                            </span>
                          </div>

                          <div className="invoice-item-price-block" style={{ minWidth: '80px' }}>
                            <span className="invoice-item-price-label">Amount</span>
                            <span className="invoice-item-amount">{formatINR(netLineAmount)}</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              className="master-data-reorder-btn"
                              title="Edit Item"
                              onClick={() => handleOpenEditItem(idx)}
                            >
                              <Icon name="edit" size={15} />
                            </button>
                            <button
                              type="button"
                              className="master-data-reorder-btn"
                              title="Remove Item"
                              style={{ color: 'var(--color-error)' }}
                              onClick={() => handleRemoveItem(idx)}
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* ITEM-LEVEL GOVERNMENT ORDER NOTE DIRECTLY BELOW THIS SPECIFIC ITEM */}
                      {item.isGovPrescribed && (
                        <div className="invoice-item-go-note">
                          <Icon name="info" size={14} />
                          <span>
                            {item.govOrderNote ||
                              `As per the rate fixed by ${item.govOrderNumber || 'G.O.(Rt) No.589/2023/AHD'} dated ${item.govOrderDate || '13-12-2023'}`}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Financial Summary Card (4 cols) */}
        <div>
          <div className="invoice-summary-card">
            <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700 }}>
              Invoice Ledger Summary
            </h3>

            {/* Date Picker */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="inv-date">
                Invoice Date
              </label>
              <input
                id="inv-date"
                type="date"
                className="form-input"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
              <div className="invoice-summary-row">
                <span>Gross Subtotal</span>
                <span style={{ fontFamily: 'var(--font-data)', fontWeight: 600 }}>
                  {formatINR(calculations.grossSubtotalPaisa)}
                </span>
              </div>

              {calculations.itemDiscountsPaisa > 0 && (
                <div className="invoice-summary-row">
                  <span>Item Discounts</span>
                  <span style={{ fontFamily: 'var(--font-data)', color: 'var(--color-tertiary)' }}>
                    -{formatINR(calculations.itemDiscountsPaisa)}
                  </span>
                </div>
              )}

              {/* Doctor / Courtesy Discount Field */}
              <div className="invoice-summary-row" style={{ alignItems: 'center' }}>
                <label htmlFor="doc-discount" style={{ fontSize: '13px' }}>
                  Doctor Discount (₹)
                </label>
                <input
                  id="doc-discount"
                  type="number"
                  min="0"
                  step="1"
                  className="form-input font-mono"
                  style={{ width: '100px', height: '32px', textAlign: 'right', fontSize: '12px' }}
                  value={doctorDiscountPaisa / 100}
                  onChange={(e) => {
                    const num = Math.max(0, parseFloat(e.target.value) || 0);
                    setDoctorDiscountPaisa(Math.round(num * 100));
                  }}
                />
              </div>

              <div className="invoice-summary-row">
                <span>GST (Tax Rate: 0.0%)</span>
                <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
                  [Exempt - Healthcare]
                </span>
              </div>
            </div>

            {/* Grand Total Highlight */}
            <div className="invoice-grand-total-box">
              <span style={{ fontWeight: 700, fontSize: '14px' }}>Grand Total</span>
              <span className="invoice-grand-total-value">
                {formatINR(calculations.finalTotalPaisa)}
              </span>
            </div>

            {/* Notes */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="inv-notes">
                Invoice Notes / Payment Remarks
              </label>
              <textarea
                id="inv-notes"
                className="form-input"
                rows={2}
                placeholder="e.g. Cash / UPI payment received. Thank you!"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '6px' }}>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                onClick={() => handleSaveInvoice('Issued')}
                id="btn-issue-summary"
              >
                <Icon name="check" size={18} />
                <span>{mode === 'edit' ? 'Update & Issue' : 'Issue Invoice'}</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-md"
                style={{ width: '100%' }}
                onClick={() => handleSaveInvoice('Draft')}
                id="btn-draft-summary"
              >
                Save as Draft
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =============================================================
          ADD / EDIT INVOICE ITEM MODAL
          ============================================================= */}
      {isItemModalOpen && (
        <div className="master-data-modal-backdrop" onClick={() => setIsItemModalOpen(false)}>
          <div
            className="master-data-modal invoice-item-builder-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="master-data-modal-header">
              <h3>{editingItemIndex !== null ? 'Edit Invoice Item' : 'Add Invoice Item'}</h3>
              <button
                type="button"
                className="master-data-modal-close"
                onClick={() => setIsItemModalOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Quick Catalog / Prescribed Rates Drawer (UAT Requirement 7) */}
            <div style={{ padding: '12px 16px', background: 'var(--color-surface-container-low)', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Quick Insert Catalog:
                </span>
                <input
                  type="search"
                  placeholder="Filter items..."
                  value={catalogSearchQuery}
                  onChange={(e) => setCatalogSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ height: '26px', fontSize: '11px', padding: '2px 8px', width: '160px' }}
                />
              </div>

              {/* Category Filter Chips */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {['All', 'Statutory / Govt', 'Consultation', 'Procedures', 'Laboratory', 'Medicines'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    style={{
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-full)',
                      border: catalogCategoryTab === tab ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                      background: catalogCategoryTab === tab ? 'var(--color-primary-container)' : 'var(--color-surface)',
                      color: catalogCategoryTab === tab ? 'var(--color-on-primary-container)' : 'var(--color-on-surface-variant)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setCatalogCategoryTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Items Cards Grid */}
              <div style={{ maxHeight: '110px', overflowY: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {catalogItems.length === 0 ? (
                  <span style={{ fontSize: '11px', color: 'var(--color-outline)', padding: '4px' }}>
                    No catalog items match criteria.
                  </span>
                ) : (
                  catalogItems.map((cItem) => (
                    <button
                      key={cItem.id}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        background: cItem.isGovPrescribed ? 'rgba(0, 104, 95, 0.1)' : undefined,
                        borderColor: cItem.isGovPrescribed ? 'var(--color-primary)' : undefined,
                        color: cItem.isGovPrescribed ? 'var(--color-primary)' : undefined,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      onClick={cItem.onSelect}
                      title={`Insert ${cItem.name} (${cItem.categoryTag})`}
                    >
                      {cItem.isGovPrescribed && <Icon name="lock" size={12} />}
                      <span>{cItem.name}</span>
                      <strong style={{ opacity: 0.85 }}>₹{cItem.priceRupees}</strong>
                    </button>
                  ))
                )}
              </div>
            </div>

            <form onSubmit={handleSaveModalItem}>
              <div className="master-data-modal-body">
                {modalError && (
                  <div className="master-data-alert">
                    <Icon name="alert-circle" size={16} />
                    <span>{modalError}</span>
                  </div>
                )}

                {/* Type of Item & Description */}
                <div className="invoice-modal-item-type-row">
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label className="form-label" htmlFor="modal-cat">
                      Type of Item
                    </label>
                    <select
                      id="modal-cat"
                      className="form-input invoice-item-type-select"
                      value={modalCategory}
                      onChange={(e) => setModalCategory(e.target.value as InvoiceItemCategory)}
                    >
                      <option value="Consultation Fee">Consultation Fee</option>
                      <option value="Certificate">Certificate</option>
                      <option value="Necropsy Report">Necropsy Report</option>
                      <option value="Prescription Medicine">Prescription Medicine</option>
                      <option value="Medicine">Medicine</option>
                      <option value="Procedure Fee">Procedure Fee</option>
                      <option value="Lab Fee">Lab Fee</option>
                      <option value="Travel Fee">Travel Fee</option>
                      <option value="Other">Other / Statutory</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label className="form-label" htmlFor="modal-desc">
                      Item Description <span className="text-error">*</span>
                    </label>
                    <input
                      id="modal-desc"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Certificate Issuance (Health Certificate)"
                      value={modalDescription}
                      onChange={(e) => setModalDescription(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Quantity, Unit, Unit Price, Discount */}
                <div className="invoice-modal-pricing-grid">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="modal-qty">
                      Qty
                    </label>
                    <input
                      id="modal-qty"
                      type="number"
                      min="1"
                      className="form-input font-mono"
                      value={modalQuantity}
                      onChange={(e) => setModalQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="modal-unit">
                      Unit
                    </label>
                    <select
                      id="modal-unit"
                      className="form-input"
                      value={modalUnit}
                      onChange={(e) => setModalUnit(e.target.value)}
                    >
                      {availableInvoiceUnits.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="modal-rate">
                      Rate (₹){' '}
                      {modalRateControlled && (
                        <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>[Locked]</span>
                      )}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="modal-rate"
                        type="number"
                        step="0.5"
                        min="0"
                        className="form-input font-mono"
                        disabled={modalRateControlled}
                        title={modalRateControlled ? 'Statutory government rate cannot be modified' : ''}
                        style={{
                          background: modalRateControlled ? 'var(--color-surface-container-high)' : undefined,
                          cursor: modalRateControlled ? 'not-allowed' : undefined,
                        }}
                        value={modalUnitPriceRupees}
                        onChange={(e) => setModalUnitPriceRupees(e.target.value)}
                      />
                      {modalRateControlled && (
                        <span
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--color-primary)',
                          }}
                          title="Government fixed rate (Protected from alteration)"
                        >
                          <Icon name="lock" size={14} />
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="modal-disc">
                      Disc (₹)
                    </label>
                    <input
                      id="modal-disc"
                      type="number"
                      step="1"
                      min="0"
                      className="form-input font-mono"
                      value={modalDiscountRupees}
                      onChange={(e) => setModalDiscountRupees(e.target.value)}
                    />
                  </div>
                </div>

                {/* Government Prescribed Rate Controls */}
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: modalIsGovPrescribed ? 'rgba(0, 104, 95, 0.05)' : 'var(--color-surface-container-low)',
                    border: `1px solid ${modalIsGovPrescribed ? 'rgba(0, 104, 95, 0.25)' : 'var(--color-border)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={modalIsGovPrescribed}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setModalIsGovPrescribed(checked);
                          if (checked) {
                            setModalRateControlled(true);
                          }
                        }}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
                      />
                      <strong style={{ fontSize: '12px', color: 'var(--color-on-surface)' }}>
                        Government-Prescribed Item (Applies statutory rate rule &amp; printed notice)
                      </strong>
                    </label>
                  </div>

                  {modalIsGovPrescribed && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '6px' }}>
                        <input
                          type="text"
                          className="form-input font-mono"
                          style={{ fontSize: '11px', height: '30px' }}
                          placeholder="G.O. No."
                          value={modalGovOrderNumber}
                          onChange={(e) => setModalGovOrderNumber(e.target.value)}
                        />
                        <input
                          type="text"
                          className="form-input font-mono"
                          style={{ fontSize: '11px', height: '30px' }}
                          placeholder="G.O. Date"
                          value={modalGovOrderDate}
                          onChange={(e) => setModalGovOrderDate(e.target.value)}
                        />
                      </div>

                      <div
                        style={{
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(0, 104, 95, 0.08)',
                          fontSize: '11px',
                          color: 'var(--color-primary)',
                          fontStyle: 'italic',
                          fontWeight: 600,
                        }}
                      >
                        Printed note below item: &quot;As per the rate fixed by {modalGovOrderNumber} dated {modalGovOrderDate}.&quot;
                      </div>
                    </>
                  )}
                </div>

                {/* Computed Total Box */}
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-primary-fixed)',
                    color: 'var(--color-on-primary-fixed)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>Calculated Line Total:</span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 800 }}>
                    ₹
                    {(
                      Math.max(
                        0,
                        modalQuantity * (parseFloat(modalUnitPriceRupees) || 0) -
                          (parseFloat(modalDiscountRupees) || 0)
                      )
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="master-data-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsItemModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  id="btn-confirm-add-item"
                >
                  {editingItemIndex !== null ? 'Save Changes' : 'Add Item to Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Multi-Prescription Import Modal */}
      <ImportPrescriptionsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        selectedPatientId={selectedPatientId}
        selectedOwnerId={selectedOwner?.id}
        existingItemsSummary={items.map((it) => ({
          prescriptionId: it.prescriptionId,
          description: it.description,
        }))}
        onImportMedicines={handleImportMedicinesFromModal}
      />
    </div>
  );
};
