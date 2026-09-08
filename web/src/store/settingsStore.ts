// =============================================================
// VetRx — Settings store (Zustand + Dexie persistence)
// Holds Practitioner and optional Organisation data.
// =============================================================

import { create } from 'zustand';
import { db } from '../db/schema';
import type { Practitioner, Organisation } from '../types';

interface SettingsState {
  practitioner: Practitioner | null;
  organisation: Organisation | null;
  loading: boolean;

  loadSettings: () => Promise<void>;
  savePractitioner: (data: Omit<Practitioner, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  saveOrganisation: (data: Partial<Omit<Organisation, 'id' | 'createdAt' | 'updatedAt'>> | null) => Promise<void>;
  setClinicActive: (active: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  practitioner: null,
  organisation: null,
  loading: true,

  loadSettings: async () => {
    const [practitioner, organisation] = await Promise.all([
      db.practitioners.toCollection().first(),
      db.organisations.toCollection().first(),
    ]);
    set({
      practitioner: practitioner ?? null,
      organisation: organisation ?? null,
      loading: false,
    });
  },

  savePractitioner: async (data) => {
    const now = new Date();
    const existing = get().practitioner;
    if (existing?.id) {
      await db.practitioners.update(existing.id, { ...data, updatedAt: now });
      set({ practitioner: { ...existing, ...data, updatedAt: now } });
    } else {
      const id = await db.practitioners.add({ ...data, createdAt: now, updatedAt: now });
      set({ practitioner: { id: id as number, ...data, createdAt: now, updatedAt: now } });
    }
  },

  saveOrganisation: async (data) => {
    const now = new Date();
    const existing = get().organisation;
    if (data === null) {
      // Deactivating clinic: Never delete from database, set isActive = false
      if (existing?.id) {
        await db.organisations.update(existing.id, { isActive: false, updatedAt: now });
        set({ organisation: { ...existing, isActive: false, updatedAt: now } });
      }
      return;
    }
    if (existing?.id) {
      const updated: Organisation = {
        ...existing,
        ...data,
        isActive: data.isActive !== undefined ? data.isActive : (existing.isActive !== undefined ? existing.isActive : true),
        updatedAt: now,
      };
      await db.organisations.update(existing.id, updated);
      set({ organisation: updated });
    } else {
      const newOrg: Organisation = {
        name: data.name || '',
        address: data.address || '',
        state: data.state || '',
        city: data.city || '',
        pincode: data.pincode || '',
        phone: data.phone || '',
        email: data.email || '',
        registrationNumber: data.registrationNumber || '',
        licenseNumber: data.licenseNumber || '',
        logoDataUrl: data.logoDataUrl,
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: now,
        updatedAt: now,
      };
      const id = await db.organisations.add(newOrg);
      set({ organisation: { id: id as number, ...newOrg } });
    }
  },

  setClinicActive: async (active: boolean) => {
    const now = new Date();
    const existing = get().organisation;
    if (existing?.id) {
      await db.organisations.update(existing.id, { isActive: active, updatedAt: now });
      set({ organisation: { ...existing, isActive: active, updatedAt: now } });
    }
  },
}));
