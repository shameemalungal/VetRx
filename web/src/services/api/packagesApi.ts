// ==============================================================================
// VetRx — Treatment Packages API Client (web/src/services/api/packagesApi.ts)
// Server-Authoritative PostgreSQL Access via /api/packages
// ==============================================================================

import { apiRequest } from './apiClient';
import type { TreatmentPackage, TreatmentPackageItem } from '../../types';

export interface ServerPackage {
  id: string;
  practiceId: string;
  name: string;
  description?: string | null;
  totalPrice: number;
  itemsJson: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function normalizeServerPackage(sp: ServerPackage): TreatmentPackage & { items: TreatmentPackageItem[] } {
  let parsedItems: TreatmentPackageItem[] = [];
  if (Array.isArray(sp.itemsJson)) {
    parsedItems = sp.itemsJson.map((itm: any, idx: number) => ({
      id: itm.id || idx + 1,
      packageId: sp.id,
      medicineId: itm.medicineId,
      brandName: itm.brandName || itm.name || 'Medicine',
      genericName: itm.genericName,
      presentation: itm.presentation || 'Tablet',
      strength: itm.strength || itm.strengthVolume,
      strengthVolume: itm.strengthVolume || itm.strength,
      dose: itm.dose || itm.dosage || '1 tab',
      quantity: itm.quantity || 1,
      unit: itm.unit || 'unit',
      frequency: itm.frequency || 'OD',
      durationDays: itm.durationDays || 5,
      route: itm.route || 'PO',
      directions: itm.directions,
      sortOrder: itm.sortOrder ?? idx,
    }));
  }

  return {
    id: sp.id,
    name: sp.name,
    description: sp.description || undefined,
    category: (sp as any).category || 'General Protocol',
    species: (sp as any).species,
    targetSpecies: (sp as any).targetSpecies || [],
    protocolCode: (sp as any).protocolCode || `PROTO-${sp.id.slice(0, 6).toUpperCase()}`,
    usageCount: (sp as any).usageCount || 0,
    items: parsedItems,
    createdAt: new Date(sp.createdAt),
    updatedAt: new Date(sp.updatedAt),
  };
}

export const packagesApi = {
  async list(): Promise<Array<TreatmentPackage & { items: TreatmentPackageItem[] }>> {
    const list = await apiRequest<ServerPackage[]>('/api/packages', {
      method: 'GET',
    });
    return (list || []).map(normalizeServerPackage);
  },

  async getById(id: string): Promise<TreatmentPackage & { items: TreatmentPackageItem[] }> {
    const item = await apiRequest<ServerPackage>(`/api/packages/${id}`, {
      method: 'GET',
    });
    return normalizeServerPackage(item);
  },

  async create(data: Partial<TreatmentPackage> & { items?: TreatmentPackageItem[] }): Promise<TreatmentPackage & { items: TreatmentPackageItem[] }> {
    const payload = {
      name: data.name,
      description: data.description,
      totalPrice: 0,
      category: data.category,
      targetSpecies: data.targetSpecies,
      items: data.items || [],
      itemsJson: data.items || [],
      isActive: true,
    };
    const created = await apiRequest<ServerPackage>('/api/packages', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeServerPackage(created);
  },

  async update(id: string, data: Partial<TreatmentPackage> & { items?: TreatmentPackageItem[] }): Promise<TreatmentPackage & { items: TreatmentPackageItem[] }> {
    const payload = {
      name: data.name,
      description: data.description,
      category: data.category,
      targetSpecies: data.targetSpecies,
      items: data.items,
      itemsJson: data.items,
    };
    const updated = await apiRequest<ServerPackage>(`/api/packages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return normalizeServerPackage(updated);
  },

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/api/packages/${id}`, {
      method: 'DELETE',
    });
  },
};
