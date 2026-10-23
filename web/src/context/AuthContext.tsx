// ==============================================================================
// VetRx — AuthContext.tsx
// Manages authentication state, secure session bootstrap, and practice tenant context.
// ==============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { switchTenantDb, ensureSeeded } from '../db/schema';
import { useSettingsStore } from '../store/settingsStore';
import { inMemoryCache } from '../services/api/cache';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  platformRole?: string | null;
  hasPassword?: boolean;
  createdAt: string;
}

export interface AuthPractice {
  id: string;
  name: string;
  slug: string | null;
  ownerUserId: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuthMembership {
  id: string;
  practiceId: string;
  userId: string;
  role: 'PRACTICE_OWNER' | 'PRACTICE_ADMIN' | 'VETERINARIAN' | 'STAFF' | 'PRACTICE_STAFF' | 'READ_ONLY';
  isClinicalApprover?: boolean;
  isActive: boolean;
  permissions?: string[];
}

export interface AuthPracticeSettings {
  id: string;
  practiceId: string;
  clinicName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  registrationNumber: string | null;
  doctorName: string | null;
  doctorRegistrationNumber: string | null;
  doctorQualifications?: string | null;
  doctorPhone?: string | null;
  doctorEmail?: string | null;
  doctorAddress?: string | null;
  doctorPhotoUrl: string | null;
  doctorSignatureUrl: string | null;
  clinicLogoUrl: string | null;
  clinicLicenseNumber?: string | null;
  ownerSpecialInstructionEnabled: boolean;
  mykgvoaMemberId: string | null;
}

export interface AuthPracticeSummary {
  practiceId: string;
  practiceName: string;
  practiceType?: 'INDEPENDENT' | 'CLINIC' | 'ENTERPRISE';
  role: string;
  isClinicalApprover: boolean;
  isCurrent: boolean;
  subscription?: {
    status: string;
    planName?: string;
    planCode?: string;
    trialEndsAt?: string | null;
    currentPeriodEnd?: string | null;
  } | null;
}

export interface RegisterParams {
  name: string;
  email: string;
  password: string;
  practiceName?: string;
  practiceType?: 'INDEPENDENT' | 'CLINIC';
  isClinicalApprover?: boolean;
  phone?: string;
  address?: string;
  teamMembers?: Array<{ name?: string; email: string; role: string }>;
  invitationToken?: string;
}

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { API_BASE } from '../config/api';

export interface AuthContextType {
  user: AuthUser | null;
  practice: AuthPractice | null;
  membership: AuthMembership | null;
  settings: AuthPracticeSettings | null;
  permissions: string[];
  practices: AuthPracticeSummary[];
  isLoading: boolean;
  error: string | null;
  can: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  isPracticeOwner: () => boolean;
  isPlatformAdmin: () => boolean;
  login: (email: string, password: string) => Promise<{ needsPracticeSelection?: boolean; practices?: AuthPracticeSummary[] }>;
  register: (
    nameOrParams: string | RegisterParams,
    email?: string,
    password?: string,
    practiceName?: string,
    invitationToken?: string
  ) => Promise<void>;
  switchPractice: (practiceId: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updatePracticeSettings: (updates: Partial<AuthPracticeSettings>) => Promise<void>;
  exchangeMobileTicket: (ticket: string) => Promise<string>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [practice, setPractice] = useState<AuthPractice | null>(null);
  const [membership, setMembership] = useState<AuthMembership | null>(null);
  const [settings, setSettings] = useState<AuthPracticeSettings | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [practices, setPractices] = useState<AuthPracticeSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const can = useCallback(
    (permission: string) => {
      return (
        permissions.includes(permission) ||
        permissions.includes('all') ||
        permissions.includes('*') ||
        membership?.role === 'PRACTICE_OWNER'
      );
    },
    [permissions, membership]
  );

  const hasRole = useCallback(
    (role: string) => {
      if (!membership) return false;
      if (membership.role === role) return true;
      if (role === 'STAFF' && membership.role === 'PRACTICE_STAFF') return true;
      return false;
    },
    [membership]
  );

  const isPracticeOwner = useCallback(() => {
    return membership?.role === 'PRACTICE_OWNER';
  }, [membership]);

  const isPlatformAdmin = useCallback(() => {
    return user?.platformRole === 'PLATFORM_SUPER_ADMIN';
  }, [user]);

  const refreshSession = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setPractice(data.practice);
        setMembership(data.membership);
        setSettings(data.settings);
        setPermissions(data.permissions || data.membership?.permissions || []);
        if (data.practices) setPractices(data.practices);
        switchTenantDb(data.practice?.id);
        inMemoryCache.setPractice(data.practice?.id || null);
        void useSettingsStore.getState().loadSettings(data.settings, data.user);
      } else {
        const isDev = !Capacitor.isNativePlatform() && (import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && localStorage.getItem('vetrx_dev_unauth') !== 'true';
        if (isDev) {
          const demoUser: AuthUser = {
            id: 'demo-user-1',
            email: 'doctor@vetrx.demo',
            name: 'Dr. Anand Sharma',
            avatarUrl: null,
            emailVerified: true,
            platformRole: 'PLATFORM_SUPER_ADMIN',
            createdAt: new Date().toISOString(),
          };
          const demoPractice: AuthPractice = {
            id: 'demo-practice-id',
            name: 'VetRx Clinical Practice',
            slug: 'vetrx-demo',
            ownerUserId: 'demo-user-1',
            isActive: true,
            createdAt: new Date().toISOString(),
          };
          const demoMembership: AuthMembership = {
            id: 'demo-membership-1',
            practiceId: 'demo-practice-id',
            userId: 'demo-user-1',
            role: 'PRACTICE_OWNER',
            isClinicalApprover: true,
            isActive: true,
            permissions: ['all'],
          };
          setUser(demoUser);
          setPractice(demoPractice);
          setMembership(demoMembership);
          setPermissions(['all']);
          switchTenantDb('demo-practice-id');
          await ensureSeeded();
          void useSettingsStore.getState().loadSettings(null, demoUser);
        } else {
          setUser(null);
          setPractice(null);
          setMembership(null);
          setSettings(null);
          setPermissions([]);
          setPractices([]);
          switchTenantDb(null);
          inMemoryCache.clear();
          useSettingsStore.getState().reset();
        }
      }
    } catch (err) {
      console.warn('Session check could not reach backend, starting in offline dev/guest mode:', err);
      const isDev = !Capacitor.isNativePlatform() && (import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && localStorage.getItem('vetrx_dev_unauth') !== 'true';
      if (isDev) {
        const demoUser: AuthUser = {
          id: 'demo-user-1',
          email: 'doctor@vetrx.demo',
          name: 'Dr. Anand Sharma',
          avatarUrl: null,
          emailVerified: true,
          platformRole: 'PLATFORM_SUPER_ADMIN',
          createdAt: new Date().toISOString(),
        };
        const demoPractice: AuthPractice = {
          id: 'demo-practice-id',
          name: 'VetRx Clinical Practice',
          slug: 'vetrx-demo',
          ownerUserId: 'demo-user-1',
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        const demoMembership: AuthMembership = {
          id: 'demo-membership-1',
          practiceId: 'demo-practice-id',
          userId: 'demo-user-1',
          role: 'PRACTICE_OWNER',
          isClinicalApprover: true,
          isActive: true,
          permissions: ['all'],
        };
        setUser(demoUser);
        setPractice(demoPractice);
        setMembership(demoMembership);
        setPermissions(['all']);
        switchTenantDb('demo-practice-id');
        await ensureSeeded();
        void useSettingsStore.getState().loadSettings(null, demoUser);
      } else {
        setUser(null);
        setPractice(null);
        setMembership(null);
        setSettings(null);
        setPermissions([]);
        setPractices([]);
        switchTenantDb(null);
        inMemoryCache.clear();
        useSettingsStore.getState().reset();
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const exchangeMobileTicket = useCallback(async (ticket: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/mobile/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ticket }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Authentication ticket exchange failed');
      }

      setUser(data.user);
      setPractice(data.practice);
      setMembership(data.membership);
      setSettings(data.settings);
      setPermissions(data.permissions || data.membership?.permissions || []);
      if (data.practices) setPractices(data.practices);
      switchTenantDb(data.practice?.id);
      inMemoryCache.setPractice(data.practice?.id || null);
      await useSettingsStore.getState().loadSettings(data.settings, data.user);

      return (data.redirectTo as string) || '/dashboard';
    } catch (err: any) {
      setError(err?.message || 'Failed to exchange mobile authentication ticket');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let subHandle: any = null;
    const registerDeepLink = async () => {
      subHandle = await App.addListener('appUrlOpen', async ({ url }) => {
        try {
          if (url.includes('auth/callback')) {
            const parsed = new URL(url);
            const ticket = parsed.searchParams.get('ticket');
            const errorParam = parsed.searchParams.get('error');

            try {
              await Browser.close();
            } catch {
              // Custom tab may already be dismissed
            }

            if (errorParam) {
              setError(`Google authentication failed: ${errorParam}`);
              return;
            }

            if (ticket) {
              const redirectPath = await exchangeMobileTicket(ticket);
              window.location.hash = redirectPath;
            }
          }
        } catch (err: any) {
          console.error('Deep link exchange error:', err);
          setError(err?.message || 'Deep link authentication failed');
        }
      });
    };

    void registerDeepLink();

    return () => {
      if (subHandle && typeof subHandle.remove === 'function') {
        subHandle.remove();
      }
    };
  }, [exchangeMobileTicket]);

  const login = async (email: string, password: string) => {
    setError(null);
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Login failed.');
    }

    setUser(data.user);
    setPractice(data.practice);
    setMembership(data.membership);
    setSettings(data.settings);
    setPermissions(data.permissions || data.membership?.permissions || []);
    if (data.practices) setPractices(data.practices);
    switchTenantDb(data.practice?.id);
    inMemoryCache.setPractice(data.practice?.id || null);
    await useSettingsStore.getState().loadSettings(data.settings, data.user);
    return {
      needsPracticeSelection: Boolean(data.needsPracticeSelection || (data.practices && data.practices.length > 1)),
      practices: data.practices || [],
    };
  };

  const register = async (
    nameOrParams: string | RegisterParams,
    email?: string,
    password?: string,
    practiceName?: string,
    invitationToken?: string
  ) => {
    setError(null);
    const payload =
      typeof nameOrParams === 'object'
        ? nameOrParams
        : {
            name: nameOrParams,
            email: email!,
            password: password!,
            practiceName,
            invitationToken,
          };

    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Registration failed.');
    }

    setUser(data.user);
    setPractice(data.practice);
    setMembership(data.membership);
    setSettings(data.settings);
    setPermissions(data.permissions || data.membership?.permissions || []);
    if (data.practices) setPractices(data.practices);
    switchTenantDb(data.practice?.id);
    inMemoryCache.setPractice(data.practice?.id || null);
    await useSettingsStore.getState().loadSettings(data.settings, data.user);
  };

  const switchPractice = async (practiceId: string) => {
    setError(null);
    const res = await fetch(`${API_BASE}/api/auth/switch-practice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ practiceId }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to switch practice.');
    }

    setUser(data.user);
    setPractice(data.practice);
    setMembership(data.membership);
    setSettings(data.settings);
    setPermissions(data.permissions || data.membership?.permissions || []);
    if (data.practices) setPractices(data.practices);
    switchTenantDb(data.practice?.id);
    inMemoryCache.setPractice(data.practice?.id || null);
    await useSettingsStore.getState().loadSettings(data.settings, data.user);
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
    } finally {
      setUser(null);
      setPractice(null);
      setMembership(null);
      setSettings(null);
      setPermissions([]);
      setPractices([]);
      switchTenantDb(null);
      inMemoryCache.clear();
      useSettingsStore.getState().reset();
    }
  };

  const updatePracticeSettings = async (updates: Partial<AuthPracticeSettings>) => {
    const res = await fetch(`${API_BASE}/api/practice/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to update settings.');
    }

    setSettings(data);
    if (data.clinicName && data.clinicName.trim()) {
      const newName = data.clinicName.trim();
      setPractice((prev) => (prev ? { ...prev, name: newName } : prev));
      setPractices((prev) =>
        prev.map((p) => (p.practiceId === data.practiceId ? { ...p, practiceName: newName } : p))
      );
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        practice,
        membership,
        settings,
        permissions,
        practices,
        isLoading,
        error,
        can,
        hasRole,
        isPracticeOwner,
        isPlatformAdmin,
        login,
        register,
        switchPractice,
        logout,
        refreshSession,
        updatePracticeSettings,
        exchangeMobileTicket,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
