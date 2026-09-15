// =============================================================
// VetRx — App.tsx
// Root router. Loads settings, seeds DB, renders AppShell.
// =============================================================

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

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
import { useSettingsStore } from './store/settingsStore';
import { ensureSeeded } from './db/schema';

import './pages/DashboardPage.css';

function AppRoutes() {
  return (
    <AppShell>
      <Routes>
        <Route path="/"                element={<DashboardPage />} />
        {/* Patients Module (Phase 2) */}
        <Route path="/patients"        element={<PatientsListPage />} />
        <Route path="/patients/new"    element={<PatientFormPage mode="new" />} />
        <Route path="/patients/:id"    element={<PatientDetailsPage />} />
        <Route path="/patients/:id/edit" element={<PatientFormPage mode="edit" />} />

        {/* Prescriptions Module (Phase 3) */}
        <Route path="/prescriptions"          element={<PrescriptionsListPage />} />
        <Route path="/prescriptions/new"      element={<PrescriptionBuilderPage mode="new" />} />
        <Route path="/prescriptions/:id"      element={<PrescriptionDetailsPage />} />
        <Route path="/prescriptions/:id/edit" element={<PrescriptionBuilderPage mode="edit" />} />

        {/* Treatment Packages Module (Phase 4) */}
        <Route path="/packages"          element={<PackagesListPage />} />
        <Route path="/packages/new"      element={<PackageFormPage mode="new" />} />
        <Route path="/packages/:id"      element={<PackageFormPage mode="edit" />} />
        <Route path="/packages/:id/edit" element={<PackageFormPage mode="edit" />} />
        <Route path="/medicines"       element={<MedicinesListPage />} />

        {/* Invoices Module (Phase 6) */}
        <Route path="/invoices"          element={<InvoicesListPage />} />
        <Route path="/invoices/new"      element={<InvoiceBuilderPage mode="new" />} />
        <Route path="/invoices/:id"      element={<InvoiceDetailsPage />} />
        <Route path="/invoices/:id/edit" element={<InvoiceBuilderPage mode="edit" />} />

        <Route path="/settings"        element={<SettingsPage />} />
        {/* Catch-all */}
        <Route path="*"                element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  const { loadSettings } = useSettingsStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        await ensureSeeded();
        await loadSettings();
      } catch (err) {
        console.error('VetRx init error:', err);
      } finally {
        setReady(true);
      }
    }
    void init();
  }, [loadSettings]);

  if (!ready) {
    return (
      <div className="loading-screen" role="status" aria-label="Loading VetRx…">
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto var(--space-base)' }} />
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-headline-sm)', color: 'var(--color-text-muted)' }}>
            Loading VetRx…
          </div>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
