// ==============================================================================
// VetRx — Prescriptions API Client (web/src/services/api/prescriptionsApi.ts)
// Server-Authoritative PostgreSQL Access via /api/prescriptions
// ==============================================================================

import { apiRequest } from './apiClient';
import type { Prescription, PrescriptionItem } from '../../types';

export interface ServerPrescriptionItem {
  id: string;
  prescriptionId: string;
  medicineId?: string | null;
  medicineName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  totalQuantity: number;
  quantityUnit?: string | null;
  instructions?: string | null;
  medicine?: {
    id: string;
    name: string;
    genericName?: string;
    form?: string;
  };
}

export interface ServerPrescription {
  id: string;
  practiceId: string;
  patientId: string;
  rxNumber: string;
  diagnosis?: string | null;
  notes?: string | null;
  status: string;
  version: number;
  prescribedAt: string;
  createdAt: string;
  updatedAt: string;
  forwardingRemarks?: string | null;
  forwardedByUser?: any;
  forwardedToUser?: any;
  approvedByUser?: any;
  approvedAt?: string | null;
  items: ServerPrescriptionItem[];
  patient?: {
    id: string;
    name: string;
    species: string;
    breed?: string;
    owner?: {
      id: string;
      name: string;
      phone: string;
    };
  };
}

export function normalizeServerPrescription(sp: ServerPrescription): Prescription {
  const items: PrescriptionItem[] = (sp.items || []).map((itm, idx) => ({
    id: itm.id,
    prescriptionId: sp.id,
    medicineId: itm.medicineId || undefined,
    brandName: itm.medicineName,
    genericName: itm.medicine?.genericName,
    presentation: itm.medicine?.form || 'Tablet',
    dose: itm.dosage,
    doseUnit: itm.quantityUnit || undefined,
    quantity: itm.totalQuantity,
    unit: itm.quantityUnit || 'unit',
    frequency: itm.frequency,
    durationDays: itm.durationDays,
    directions: itm.instructions || undefined,
    sortOrder: idx,
  }));

  return {
    id: sp.id,
    rxNumber: sp.rxNumber,
    patientId: sp.patientId,
    ownerId: sp.patient?.owner?.id || '',
    status: (sp.status.charAt(0).toUpperCase() + sp.status.slice(1).toLowerCase()) as any,
    diagnosis: sp.diagnosis || undefined,
    instructions: sp.notes || undefined,
    version: sp.version,
    patient: sp.patient,
    items,
    createdAt: new Date(sp.createdAt),
    updatedAt: new Date(sp.updatedAt),
  };
}

export const prescriptionsApi = {
  async list(params?: { search?: string; status?: string; patientId?: string }): Promise<Prescription[]> {
    const list = await apiRequest<ServerPrescription[]>('/api/prescriptions', {
      method: 'GET',
      params,
    });
    return (list || []).map(normalizeServerPrescription);
  },

  async getById(id: string): Promise<Prescription> {
    const item = await apiRequest<ServerPrescription>(`/api/prescriptions/${id}`, {
      method: 'GET',
    });
    return normalizeServerPrescription(item);
  },

  async create(data: any): Promise<Prescription> {
    const created = await apiRequest<ServerPrescription>('/api/prescriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return normalizeServerPrescription(created);
  },

  async update(id: string, data: any): Promise<Prescription> {
    const updated = await apiRequest<ServerPrescription>(`/api/prescriptions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return normalizeServerPrescription(updated);
  },

  async forward(id: string, targetUserId: string, remarks?: string): Promise<Prescription> {
    const res = await apiRequest<ServerPrescription>(`/api/prescriptions/${id}/forward`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId, remarks }),
    });
    return normalizeServerPrescription(res);
  },

  async approve(id: string, remarks?: string): Promise<Prescription> {
    const res = await apiRequest<ServerPrescription>(`/api/prescriptions/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
    return normalizeServerPrescription(res);
  },

  async requestChanges(id: string, remarks: string): Promise<Prescription> {
    const res = await apiRequest<ServerPrescription>(`/api/prescriptions/${id}/request-changes`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
    return normalizeServerPrescription(res);
  },

  async revise(id: string, remarks?: string): Promise<Prescription> {
    const res = await apiRequest<ServerPrescription>(`/api/prescriptions/${id}/revise`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
    return normalizeServerPrescription(res);
  },

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/api/prescriptions/${id}`, {
      method: 'DELETE',
    });
  },
};
