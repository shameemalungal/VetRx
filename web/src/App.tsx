// =============================================================
// VetRx — App.tsx
// Root router. Loads settings, seeds DB, manages Auth Gate & AppShell.
// =============================================================

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { AppShell } from './components/Layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { MedicinesListPage } from './pages/medicines/MedicinesListPage';
import { SettingsPage } from './pages/SettingsPage';
import { PatientsListPage } from './pages/patients/PatientsListPage';
import { PatientDetailsPage } from './pages/patients/PatientDetailsPage';
import { PatientFormPage } from './pages/patients/PatientFormPage';
import { PrescriptionsListPage } from './pages/prescriptions/PrescriptionsListPage';
import { PrescriptionBuilderPage } from './pages/prescriptions/PrescriptionBuilderPage';
import { PrescriptionDetailsPage } from './pages/prescriptions/PrescriptionDetailsPage';
import { PackagesListPage } from './pages/packages/PackagesListPage';
import { PackageFormPage } from './pages/packages/PackageFormPage';
import { InvoicesListPage } from './pages/invoices/InvoicesListPage';
import { InvoiceBuilderPage } from './pages/invoices/InvoiceBuilderPage';
import { InvoiceDetailsPage } from './pages/invoices/InvoiceDetailsPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { AcceptInvitationPage } from './pages/auth/AcceptInvitationPage';
import { RolePermissionManagementPage } from './pages/platform/RolePermissionManagementPage';
import { PlatformShell } from './components/Layout/PlatformShell';
import { PlatformDashboardPage } from './pages/platform/PlatformDashboardPage';
import { PlatformPracticesPage } from './pages/platform/PlatformPracticesPage';
import { PlatformPracticeDetailsPage } from './pages/platform/PlatformPracticeDetailsPage';
import { PlatformUsersPage } from './pages/platform/PlatformUsersPage';
import { PlatformUserDetailsPage } from './pages/platform/PlatformUserDetailsPage';
import { PlatformSubscriptionsPage } from './pages/platform/PlatformSubscriptionsPage';
import { PlatformPaymentsPage } from './pages/platform/PlatformPaymentsPage';
import { PlatformIssuesPage } from './pages/platform/PlatformIssuesPage';
import { PlatformAuditPage } from './pages/platform/PlatformAuditPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useSettingsStore } from './store/settingsStore';
import { ensureSeeded } from './db/schema';

import './pages/DashboardPage.css';

function PlatformAppRoutes() {
  return (
    <PlatformShell>
      <Routes>
        <Route path="/dashboard" element={<PlatformDashboardPage />} />
        <Route path="/practices" element={<PlatformPracticesPage />} />
        <Route path="/practices/:id" element={<PlatformPracticeDetailsPage />} />
        <Route path="/users" element={<PlatformUsersPage />} />
        <Route path="/users/:id" element={<PlatformUserDetailsPage />} />
        <Route path="/subscriptions" element={<PlatformSubscriptionsPage />} />
        <Route path="/payments" element={<PlatformPaymentsPage />} />
        <Route path="/issues" element={<PlatformIssuesPage />} />
        <Route path="/audit" element={<PlatformAuditPage />} />
        <Route path="/permissions" element={<RolePermissionManagementPage />} />
        <Route path="*" element={<Navigate to="/platform/dashboard" replace />} />
      </Routes>
    </PlatformShell>
  );
}

function AuthenticatedAppRoutes() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        {/* Patients Module (Phase 2) */}
        <Route path="/patients" element={<PatientsListPage />} />
        <Route path="/patients/new" element={<PatientFormPage mode="new" />} />
        <Route path="/patients/:id" element={<PatientDetailsPage />} />
        <Route path="/patients/:id/edit" element={<PatientFormPage mode="edit" />} />

        {/* Prescriptions Module (Phase 3) */}
        <Route path="/prescriptions" element={<PrescriptionsListPage />} />
        <Route path="/prescriptions/new" element={<PrescriptionBuilderPage mode="new" />} />
        <Route path="/prescriptions/:id" element={<PrescriptionDetailsPage />} />
        <Route path="/prescriptions/:id/edit" element={<PrescriptionBuilderPage mode="edit" />} />

        {/* Treatment Packages Module (Phase 4) */}
        <Route path="/packages" element={<PackagesListPage />} />
        <Route path="/packages/new" element={<PackageFormPage mode="new" />} />
        <Route path="/packages/:id" element={<PackageFormPage mode="edit" />} />
        <Route path="/packages/:id/edit" element={<PackageFormPage mode="edit" />} />
        <Route path="/medicines" element={<MedicinesListPage />} />

        {/* Invoices Module (Phase 6) */}
        <Route path="/invoices" element={<InvoicesListPage />} />
        <Route path="/invoices/new" element={<InvoiceBuilderPage mode="new" />} />
        <Route path="/invoices/:id" element={<InvoiceDetailsPage />} />
        <Route path="/invoices/:id/edit" element={<InvoiceBuilderPage mode="edit" />} />

        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/platform/permissions" element={<RolePermissionManagementPage />} />
        <Route path="/invite/:token" element={<AcceptInvitationPage />} />

        {/* Auth routes when already authenticated redirect to dashboard */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Navigate to="/" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

function PublicAuthRoutes() {
  return (
    <Routes>
      <Route path="/invite/:token" element={<AcceptInvitationPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function MainContent() {
  const { user, practice, settings, isLoading, isPlatformAdmin } = useAuth();
  const { loadSettings } = useSettingsStore();
  const [dbReady, setDbReady] = useState(false);
  const location = useLocation();

  // Public/direct invitation acceptance route
  if (location.pathname.startsWith('/invite/')) {
    return (
      <Routes>
        <Route path="/invite/:token" element={<AcceptInvitationPage />} />
      </Routes>
    );
  }

  // Platform Super Admin Console Routing
  if (location.pathname.startsWith('/platform')) {
    if (isLoading) {
      return (
        <div className="loading-screen" role="status" aria-label="Loading VetRx…">
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto var(--space-base)' }} />
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'var(--text-headline-sm)',
                color: 'var(--color-text-muted)',
              }}
            >
              Loading VetRx Platform Console…
            </div>
          </div>
        </div>
      );
    }
    if (user && isPlatformAdmin?.()) {
      return (
        <Routes>
          <Route path="/platform/*" element={<PlatformAppRoutes />} />
        </Routes>
      );
    }
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    async function initDb() {
      try {
        await ensureSeeded();
        await loadSettings(settings, user);
      } catch (err) {
        console.error('VetRx IndexedDB init error:', err);
      } finally {
        setDbReady(true);
      }
    }
    void initDb();
  }, [practice?.id, user?.id, loadSettings, settings, user]);

  if (isLoading || !dbReady) {
    return (
      <div className="loading-screen" role="status" aria-label="Loading VetRx…">
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto var(--space-base)' }} />
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--text-headline-sm)',
              color: 'var(--color-text-muted)',
            }}
          >
            Loading VetRx…
          </div>
        </div>
      </div>
    );
  }

  // If user is authenticated as Platform Super Admin without a practice, take to platform console
  if (user && isPlatformAdmin?.() && !practice) {
    return <Navigate to="/platform/dashboard" replace />;
  }

  // If user is authenticated, render protected clinical routes scoped by practice
  if (user && practice) {
    return <AuthenticatedAppRoutes key={practice.id} />;
  }

  // Otherwise render public login / registration routes
  return <PublicAuthRoutes />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <MainContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
