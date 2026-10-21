// =============================================================
// VetRx — Settings store (Zustand + Dexie + Server Sync)
// Multi-tenant scoped to active practice.
// =============================================================

import { create } from 'zustand';
import { db } from '../db/schema';
import type { Practitioner, Organisation } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');

interface ServerSettingsPayload {
  doctorName?: string | null;
  doctorRegistrationNumber?: string | null;
  doctorQualifications?: string | null;
  doctorPhone?: string | null;
  doctorEmail?: string | null;
  doctorAddress?: string | null;
  doctorPhotoUrl?: string | null;
  doctorSignatureUrl?: string | null;
  clinicName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  registrationNumber?: string | null;
  clinicLicenseNumber?: string | null;
  clinicLogoUrl?: string | null;
  ownerSpecialInstructionEnabled?: boolean;
}

interface SettingsState {
  practitioner: Practitioner | null;
  organisation: Organisation | null;
  loading: boolean;
  showHsnColumn: boolean;
  showSacColumn: boolean;
  showSpecialInstructionsForOwner: boolean;

  reset: () => void;
  loadSettings: (serverSettings?: ServerSettingsPayload | null, user?: { name?: string; email?: string; avatarUrl?: string | null } | null) => Promise<void>;
  savePractitioner: (data: Omit<Practitioner, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  saveOrganisation: (data: Partial<Omit<Organisation, 'id' | 'createdAt' | 'updatedAt'>> | null) => Promise<void>;
  setClinicActive: (active: boolean) => Promise<void>;
  setShowHsnColumn: (show: boolean) => void;
  setShowSacColumn: (show: boolean) => void;
  setShowSpecialInstructionsForOwner: (show: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  practitioner: null,
  organisation: null,
  loading: true,
  showHsnColumn: localStorage.getItem('vetrx_show_hsn') !== 'false',
  showSacColumn: localStorage.getItem('vetrx_show_sac') !== 'false',
  showSpecialInstructionsForOwner: localStorage.getItem('vetrx_show_owner_instructions') !== 'false',

  reset: () => {
    set({
      practitioner: null,
      organisation: null,
      loading: false,
    });
  },

  setShowHsnColumn: (show: boolean) => {
    localStorage.setItem('vetrx_show_hsn', String(show));
    set({ showHsnColumn: show });
  },

  setShowSacColumn: (show: boolean) => {
    localStorage.setItem('vetrx_show_sac', String(show));
    set({ showSacColumn: show });
  },

  setShowSpecialInstructionsForOwner: (show: boolean) => {
    localStorage.setItem('vetrx_show_owner_instructions', String(show));
    set({ showSpecialInstructionsForOwner: show });
  },

  loadSettings: async (serverSettings, user) => {
    const now = new Date();
    let [practitioner, organisation] = await Promise.all([
      db.practitioners.toCollection().first(),
      db.organisations.toCollection().first(),
    ]);

    // Authoritative backend synchronization:
    // If serverSettings or user is present, ensure Dexie and store have the authoritative data
    if (serverSettings || user) {
      const practitionerData: Omit<Practitioner, 'id'> = {
        name: serverSettings?.doctorName || practitioner?.name || user?.name || '',
        registrationNumber: serverSettings?.doctorRegistrationNumber || practitioner?.registrationNumber || '',
        qualifications: serverSettings?.doctorQualifications || practitioner?.qualifications || '',
        phone: serverSettings?.doctorPhone || practitioner?.phone || '',
        email: serverSettings?.doctorEmail || practitioner?.email || user?.email || '',
        address: serverSettings?.doctorAddress || practitioner?.address || '',
        photoDataUrl: serverSettings?.doctorPhotoUrl || practitioner?.photoDataUrl || user?.avatarUrl || undefined,
        signatureDataUrl: serverSettings?.doctorSignatureUrl || practitioner?.signatureDataUrl || undefined,
        createdAt: practitioner?.createdAt ?? now,
        updatedAt: now,
      };

      if (practitioner?.id) {
        await db.practitioners.update(practitioner.id, practitionerData);
        practitioner = { id: practitioner.id, ...practitionerData };
      } else {
        const id = await db.practitioners.add(practitionerData as Practitioner);
        practitioner = { id: id as number, ...practitionerData };
      }

      if (serverSettings?.clinicName || organisation) {
        const orgData: Omit<Organisation, 'id'> = {
          name: serverSettings?.clinicName || organisation?.name || '',
          address: serverSettings?.address || organisation?.address || '',
          state: organisation?.state || '',
          city: organisation?.city || '',
          pincode: organisation?.pincode || '',
          phone: serverSettings?.phone || organisation?.phone || '',
          email: serverSettings?.email || organisation?.email || '',
          registrationNumber: serverSettings?.registrationNumber || organisation?.registrationNumber || '',
          licenseNumber: serverSettings?.clinicLicenseNumber || organisation?.licenseNumber || '',
          logoDataUrl: serverSettings?.clinicLogoUrl || organisation?.logoDataUrl || undefined,
          isActive: organisation?.isActive !== undefined ? organisation.isActive : true,
          createdAt: organisation?.createdAt ?? now,
          updatedAt: now,
        };

        if (organisation?.id) {
          await db.organisations.update(organisation.id, orgData);
          organisation = { id: organisation.id, ...orgData };
        } else if (serverSettings?.clinicName) {
          const id = await db.organisations.add(orgData as Organisation);
          organisation = { id: id as number, ...orgData };
        }
      }
    }

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

    // Sync to backend practice settings
    const res = await fetch(`${API_BASE}/api/practice/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        doctorName: data.name,
        doctorRegistrationNumber: data.registrationNumber,
        doctorQualifications: data.qualifications,
        doctorPhone: data.phone,
        doctorEmail: data.email,
        doctorAddress: data.address,
        doctorPhotoUrl: data.photoDataUrl || null,
        doctorSignatureUrl: data.signatureDataUrl || null,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Failed to save practitioner profile to server (HTTP ${res.status}).`);
    }
  },

  saveOrganisation: async (data) => {
    const now = new Date();
    const existing = get().organisation;
    if (data === null) {
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

    // Sync to backend practice settings
    const res = await fetch(`${API_BASE}/api/practice/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        clinicName: data.name || null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        registrationNumber: data.registrationNumber || null,
        clinicLicenseNumber: data.licenseNumber || null,
        clinicLogoUrl: data.logoDataUrl || null,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Failed to save clinic details to server (HTTP ${res.status}).`);
    }

    if (data.name && data.name.trim()) {
      void fetch(`${API_BASE}/api/practice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: data.name.trim() }),
      }).catch(() => null);
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
