// ==============================================================================
// VetRx — Patients API Client (web/src/services/api/patientsApi.ts)
// Server-Authoritative PostgreSQL Access via /api/patients
// ==============================================================================

import { apiRequest } from './apiClient';
import type { Patient, Owner } from '../../types';
import { normalizeServerOwner, type ServerOwner } from './ownersApi';

export interface ServerPatient {
  id: string;
  practiceId: string;
  ownerId: string;
  name: string;
  species: string;
  breed?: string | null;
  sex?: string | null;
  ageYears?: number | null;
  ageMonths?: number | null;
  weightKg?: number | null;
  identification?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: ServerOwner;
}

export function normalizeServerPatient(sp: ServerPatient): Patient & { owner?: Owner } {
  return {
    id: sp.id,
    serverId: sp.id,
    ownerId: sp.ownerId,
    serverOwnerId: sp.ownerId,
    name: sp.name,
    species: sp.species as any,
    breed: sp.breed || undefined,
    sex: (sp.sex as any) || 'Unknown',
    weightKg: sp.weightKg ?? undefined,
    identificationRef: sp.identification || undefined,
    microchipNumber: sp.identification || undefined,
    notes: sp.notes || undefined,
    ageNote: sp.ageYears !== null && sp.ageYears !== undefined
      ? `${sp.ageYears}y ${sp.ageMonths || 0}m`
      : undefined,
    createdAt: new Date(sp.createdAt),
    updatedAt: new Date(sp.updatedAt),
    owner: sp.owner ? normalizeServerOwner(sp.owner) : undefined,
  };
}

export const patientsApi = {
  async list(search?: string): Promise<Array<Patient & { owner?: Owner }>> {
    const list = await apiRequest<ServerPatient[]>('/api/patients', {
      method: 'GET',
      params: search ? { search } : undefined,
    });
    return (list || []).map(normalizeServerPatient);
  },

  async getById(id: string): Promise<Patient & { owner?: Owner }> {
    const item = await apiRequest<ServerPatient>(`/api/patients/${id}`, {
      method: 'GET',
    });
    return normalizeServerPatient(item);
  },

  async create(data: Partial<Patient> & { ownerId: string; name: string; species: string }): Promise<Patient & { owner?: Owner }> {
    const payload = {
      ownerId: data.ownerId,
      name: data.name.trim(),
      species: data.species.trim(),
      breed: data.breed?.trim() || null,
      sex: data.sex?.trim() || null,
      weightKg: data.weightKg,
      identification: data.identificationRef || data.microchipNumber || null,
      notes: data.notes,
      ageNote: data.ageNote,
    };
    const created = await apiRequest<ServerPatient>('/api/patients', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeServerPatient(created);
  },

  async update(id: string, data: Partial<Patient>): Promise<Patient & { owner?: Owner }> {
    const payload = {
      ownerId: data.ownerId ? String(data.ownerId) : undefined,
      name: data.name !== undefined ? data.name.trim() : undefined,
      species: data.species !== undefined ? data.species.trim() : undefined,
      breed: data.breed !== undefined ? (data.breed?.trim() || null) : undefined,
      sex: data.sex !== undefined ? (data.sex?.trim() || null) : undefined,
      weightKg: data.weightKg !== undefined ? data.weightKg : undefined,
      identification: data.identificationRef || data.microchipNumber,
      notes: data.notes,
      ageNote: data.ageNote,
    };
    const updated = await apiRequest<ServerPatient>(`/api/patients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return normalizeServerPatient(updated);
  },

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/api/patients/${id}`, {
      method: 'DELETE',
    });
  },
};
