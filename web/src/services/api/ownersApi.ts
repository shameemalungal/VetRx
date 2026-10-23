// ==============================================================================
// VetRx — Owners API Client (web/src/services/api/ownersApi.ts)
// Server-Authoritative PostgreSQL Access via /api/owners
// ==============================================================================

import { apiRequest } from './apiClient';
import type { Owner } from '../../types';

export interface ServerOwner {
  id: string;
  practiceId: string;
  name: string;
  phone: string;
  alternatePhones?: string[];
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  patients?: any[];
}

export function normalizeServerOwner(so: ServerOwner): Owner {
  return {
    id: so.id,
    serverId: so.id,
    name: so.name,
    phone: so.phone,
    alternatePhones: so.alternatePhones || [],
    email: so.email || undefined,
    address: so.address || undefined,
    notes: so.notes || undefined,
    createdAt: new Date(so.createdAt),
    updatedAt: new Date(so.updatedAt),
  };
}

export const ownersApi = {
  async list(search?: string): Promise<Owner[]> {
    const list = await apiRequest<ServerOwner[]>('/api/owners', {
      method: 'GET',
      params: search ? { search } : undefined,
    });
    return (list || []).map(normalizeServerOwner);
  },

  async getById(id: string): Promise<Owner> {
    const item = await apiRequest<ServerOwner>(`/api/owners/${id}`, {
      method: 'GET',
    });
    return normalizeServerOwner(item);
  },

  async create(data: { name: string; phone: string; email?: string; address?: string; notes?: string }): Promise<Owner> {
    const created = await apiRequest<ServerOwner>('/api/owners', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: data.email?.trim() || null,
        address: data.address?.trim() || null,
        notes: data.notes?.trim() || null,
      }),
    });
    return normalizeServerOwner(created);
  },

  async update(id: string, data: Partial<{ name: string; phone: string; email?: string; address?: string; notes?: string }>): Promise<Owner> {
    const updated = await apiRequest<ServerOwner>(`/api/owners/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: data.name !== undefined ? data.name.trim() : undefined,
        phone: data.phone !== undefined ? data.phone.trim() : undefined,
        email: data.email !== undefined ? (data.email?.trim() || null) : undefined,
        address: data.address !== undefined ? (data.address?.trim() || null) : undefined,
        notes: data.notes !== undefined ? (data.notes?.trim() || null) : undefined,
      }),
    });
    return normalizeServerOwner(updated);
  },

  async linkPhone(id: string, phone: string): Promise<Owner> {
    const updated = await apiRequest<ServerOwner>(`/api/owners/${id}/link-phone`, {
      method: 'POST',
      body: JSON.stringify({ phone: phone.trim() }),
    });
    return normalizeServerOwner(updated);
  },

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/api/owners/${id}`, {
      method: 'DELETE',
    });
  },
};
