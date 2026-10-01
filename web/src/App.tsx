// =============================================================
// VetRx — App.tsx
// Root router. Loads settings, seeds DB, manages Auth Gate & AppShell.
// =============================================================

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

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
import { InventoryEntitlementProvider } from './context/InventoryEntitlementContext';
import {
  InventoryDashboardPage,
  InventoryStockPage,
  InventoryPurchasesPage,
  InventoryAlertsPage,
  InventoryMovementsPage,
  InventoryReportsPage,
  InventoryRouteGate,
} from './pages/inventory';
import { useSettingsStore } from './store/settingsStore';
import { ensureSeeded } from './db/schema';

import './pages/DashboardPage.css';

interface PlatformErrorBoundaryProps {
  children: React.ReactNode;
}

interface PlatformErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class PlatformErrorBoundary extends React.Component<
  PlatformErrorBoundaryProps,
  PlatformErrorBoundaryState
> {
  constructor(props: PlatformErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PlatformErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('PlatformShell uncaught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '60px 24px',
            textAlign: 'center',
            maxWidth: '540px',
            margin: '40px auto',
            background: '#fff',
            borderRadius: '16px',
            border: '1px solid #fecaca',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚠️</div>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 700,
              margin: '0 0 8px',
              color: '#0f172a',
            }}
          >
            Platform Console Error
          </h2>
          <p
            style={{
              fontSize: '13.5px',
              color: '#64748b',
              margin: '0 0 16px',
              lineHeight: 1.5,
            }}
          >
            An unexpected error occurred while rendering the Platform Administration Console.
          </p>
          {this.state.error?.message && (
            <div
              style={{
                padding: '10px 14px',
                background: '#fef2f2',
                borderRadius: '8px',
                color: '#991b1b',
                fontSize: '12px',
                fontFamily: 'monospace',
                marginBottom: '16px',
                wordBreak: 'break-word',
                textAlign: 'left',
              }}
            >
              {this.state.error.message}
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              Reload Console
            </button>
            <a
              href="/dashboard"
              className="btn btn-primary"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            >
              Return to Practice
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PlatformAccessDeniedPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '36px 32px',
          textAlign: 'center',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: '#fee2e2',
            color: '#dc2626',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            fontSize: '24px',
          }}
        >
          🛡️
        </div>
        <h1
          style={{
            fontSize: '20px',
            fontWeight: 800,
            color: '#0f172a',
            margin: '0 0 8px',
          }}
        >
          Platform Access Required
        </h1>
        <p
          style={{
            fontSize: '13.5px',
            color: '#64748b',
            lineHeight: 1.5,
            margin: '0 0 24px',
          }}
        >
          This area is strictly restricted to Platform Super Administrators. Your authenticated account (<strong>{user?.email}</strong>) does not have platform administrative privileges.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', height: '42px', justifyContent: 'center' }}
            onClick={() => navigate('/dashboard')}
          >
            Return to Practice Workspace
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', height: '42px', justifyContent: 'center' }}
            onClick={async () => {
              await logout();
              navigate(`/login?redirect=${encodeURIComponent('/platform')}`);
            }}
          >
            Sign in with Different Account
          </button>
        </div>
      </div>
    </div>
  );
}

function PlatformAppRoutes() {
  return (
    <PlatformErrorBoundary>
      <PlatformShell>
        <Routes>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<PlatformDashboardPage />} />
          <Route path="practices" element={<PlatformPracticesPage />} />
          <Route path="practices/:id" element={<PlatformPracticeDetailsPage />} />
          <Route path="users" element={<PlatformUsersPage />} />
          <Route path="users/:id" element={<PlatformUserDetailsPage />} />
          <Route path="subscriptions" element={<PlatformSubscriptionsPage />} />
          <Route path="payments" element={<PlatformPaymentsPage />} />
          <Route path="issues" element={<PlatformIssuesPage />} />
          <Route path="audit" element={<PlatformAuditPage />} />
          <Route path="permissions" element={<RolePermissionManagementPage />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </PlatformShell>
    </PlatformErrorBoundary>
  );
}

function AuthenticatedAppRoutes() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
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

        {/* Inventory & Stock Management Module (Add-on V1) */}
        <Route path="/inventory" element={<InventoryRouteGate><InventoryDashboardPage /></InventoryRouteGate>} />
        <Route path="/inventory/dashboard" element={<Navigate to="/inventory" replace />} />
        <Route path="/inventory/stock" element={<InventoryRouteGate><InventoryStockPage /></InventoryRouteGate>} />
        <Route path="/inventory/purchases" element={<InventoryRouteGate><InventoryPurchasesPage /></InventoryRouteGate>} />
        <Route path="/inventory/alerts" element={<InventoryRouteGate><InventoryAlertsPage /></InventoryRouteGate>} />
        <Route path="/inventory/movements" element={<InventoryRouteGate><InventoryMovementsPage /></InventoryRouteGate>} />
        <Route path="/inventory/reports" element={<InventoryRouteGate><InventoryReportsPage /></InventoryRouteGate>} />

        {/* Invoices Module (Phase 6) */}
        <Route path="/invoices" element={<InvoicesListPage />} />
        <Route path="/invoices/new" element={<InvoiceBuilderPage mode="new" />} />
        <Route path="/invoices/:id" element={<InvoiceDetailsPage />} />
        <Route path="/invoices/:id/edit" element={<InvoiceBuilderPage mode="edit" />} />

        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/platform/permissions" element={<RolePermissionManagementPage />} />
        <Route path="/invite/:token" element={<AcceptInvitationPage />} />

        {/* Auth routes when already authenticated redirect to dashboard */}
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/register" element={<Navigate to="/dashboard" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
          <Route path="/platform" element={<Navigate to="/platform/dashboard" replace />} />
        </Routes>
      );
    }
    if (!user) {
      const redirectTarget = location.pathname + location.search;
      return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
    }
    return <PlatformAccessDeniedPage />;
  }

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
      <InventoryEntitlementProvider>
        <BrowserRouter>
          <MainContent />
        </BrowserRouter>
      </InventoryEntitlementProvider>
    </AuthProvider>
  );
}
