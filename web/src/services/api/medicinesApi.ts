// ==============================================================================
// VetRx — Medicines API Client (web/src/services/api/medicinesApi.ts)
// Server-Authoritative PostgreSQL Access via /api/medicines
// ==============================================================================

import { apiRequest } from './apiClient';
import type { Medicine } from '../../types';

export interface ServerMedicine {
  id: string;
  practiceId: string;
  name: string;
  genericName?: string | null;
  category?: string | null;
  form?: string | null;
  strength?: string | null;
  unitPrice?: number;
  defaultDosageInstructions?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Normalizes a server medicine record into the frontend Medicine model
 */
export function normalizeServerMedicine(sm: ServerMedicine): Medicine {
  return {
    id: sm.id,
    brandName: sm.name,
    genericName: sm.genericName || undefined,
    presentation: sm.form || 'Tablet',
    strength: sm.strength || undefined,
    strengthVolume: sm.strength || undefined,
    category: sm.category || 'General',
    isActive: sm.isActive,
    notes: sm.defaultDosageInstructions || undefined,
    createdAt: new Date(sm.createdAt),
    updatedAt: new Date(sm.updatedAt),
  };
}

export const medicinesApi = {
  async list(search?: string): Promise<Medicine[]> {
    const list = await apiRequest<ServerMedicine[]>('/api/medicines', {
      method: 'GET',
      params: search ? { search } : undefined,
    });
    return (list || []).map(normalizeServerMedicine);
  },

  async getById(id: string): Promise<Medicine> {
    const item = await apiRequest<ServerMedicine>(`/api/medicines/${id}`, {
      method: 'GET',
    });
    return normalizeServerMedicine(item);
  },

  async create(data: Partial<Medicine>): Promise<Medicine> {
    const payload = {
      name: data.brandName || (data as any).name,
      brandName: data.brandName,
      genericName: data.genericName,
      presentation: data.presentation,
      form: data.presentation,
      strength: data.strength || data.strengthVolume,
      category: data.category,
      unitPrice: (data as any).unitPrice || 0,
      notes: data.notes,
      defaultDosageInstructions: data.notes,
      isActive: data.isActive !== false,
    };
    const created = await apiRequest<ServerMedicine>('/api/medicines', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeServerMedicine(created);
  },

  async update(id: string, data: Partial<Medicine>): Promise<Medicine> {
    const payload = {
      name: data.brandName !== undefined ? data.brandName : (data as any).name,
      brandName: data.brandName,
      genericName: data.genericName,
      presentation: data.presentation,
      form: data.presentation,
      strength: data.strength || data.strengthVolume,
      category: data.category,
      notes: data.notes,
      defaultDosageInstructions: data.notes,
      isActive: data.isActive,
    };
    const updated = await apiRequest<ServerMedicine>(`/api/medicines/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return normalizeServerMedicine(updated);
  },

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/api/medicines/${id}`, {
      method: 'DELETE',
    });
  },
};
