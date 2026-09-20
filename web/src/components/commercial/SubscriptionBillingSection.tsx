// ==============================================================================
// VetRx — Subscription & Billing Section Component (Phase 12)
// Manages commercial plans, 14-day trial status, usage limits, upgrades,
// downgrades with limit validation, cancellation, and authoritative pricing.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Icon } from '../ui/Icon';
import './SubscriptionBillingSection.css';

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');

interface UsageData {
  patientsCount: number;
  maxPatients: number | null;
  packagesCount: number;
  maxPackages: number | null;
  customMedicinesCount: number;
  maxCustomMedicines: number | null;
  veterinarianSeatsCount: number;
  maxVeterinarianSeats: number;
  staffSeatsCount: number;
  maxStaffSeats: number | null;
  maxRecordsPerPatient: number | null;
}

interface CommercialStatus {
  practiceId: string;
  status: string;
  activePlan: {
    code: string;
    name: string;
    billingInterval: string;
  };
  isPastDue: boolean;
  isInGracePeriod: boolean;
  isExpired: boolean;
  isTrial: boolean;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  daysRemainingInPeriod: number | null;
  periodEnd: string | null;
  paymentMethodStatus: 'REQUIRED' | 'PENDING' | 'CONFIGURED';
  cancelAtPeriodEnd: boolean;
  usage?: UsageData;
}

export const SubscriptionBillingSection: React.FC = () => {
  const [status, setStatus] = useState<CommercialStatus | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [billingInterval, setBillingInterval] = useState<'MONTHLY' | 'ANNUAL'>('ANNUAL');
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Modals state
  const [confirmModal, setConfirmModal] = useState<{
    type: 'UPGRADE' | 'DOWNGRADE' | 'CANCEL' | 'REACTIVATE';
    planCode?: string;
    planName?: string;
  } | null>(null);

  const fetchCommercialData = async () => {
    try {
      setLoading(true);
      const [statusRes, usageRes] = await Promise.all([
        fetch(`${API_BASE}/api/commercial/status`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/commercial/usage`, { credentials: 'include' }),
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsage(usageData);
      }
    } catch {
      // Fallback for isolated offline/demo mode
      setStatus({
        practiceId: 'default',
        status: 'TRIAL',
        activePlan: {
          code: 'TRIAL',
          name: '14-Day Free Trial',
          billingInterval: 'MONTHLY',
        },
        isPastDue: false,
        isInGracePeriod: false,
        isExpired: false,
        isTrial: true,
        trialStartsAt: new Date().toISOString(),
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        daysRemainingInPeriod: 14,
        periodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        paymentMethodStatus: 'REQUIRED',
        cancelAtPeriodEnd: false,
      });
      setUsage({
        patientsCount: 0,
        maxPatients: 10,
        packagesCount: 0,
        maxPackages: 5,
        customMedicinesCount: 0,
        maxCustomMedicines: 10,
        veterinarianSeatsCount: 1,
        maxVeterinarianSeats: 1,
        staffSeatsCount: 0,
        maxStaffSeats: null,
        maxRecordsPerPatient: 5,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCommercialData();
  }, []);

  const handleExecuteAction = async () => {
    if (!confirmModal) return;
    setSubmittingAction(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      let endpoint = '';
      let body: any = undefined;

      if (confirmModal.type === 'UPGRADE') {
        endpoint = `${API_BASE}/api/commercial/subscription/upgrade`;
        body = JSON.stringify({ planCode: confirmModal.planCode });
      } else if (confirmModal.type === 'DOWNGRADE') {
        endpoint = `${API_BASE}/api/commercial/subscription/downgrade`;
        body = JSON.stringify({ planCode: confirmModal.planCode });
      } else if (confirmModal.type === 'CANCEL') {
        endpoint = `${API_BASE}/api/commercial/subscription/cancel`;
      } else if (confirmModal.type === 'REACTIVATE') {
        endpoint = `${API_BASE}/api/commercial/subscription/reactivate`;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Operation failed.');
      }

      setActionSuccess(data.message || 'Subscription successfully updated.');
      setConfirmModal(null);
      await fetchCommercialData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleActivateTrial = async () => {
    setSubmittingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/commercial/trial/activate`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Trial activation failed.');
      setActionSuccess('14-day trial successfully activated!');
      await fetchCommercialData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to activate trial.');
    } finally {
      setSubmittingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="billing-section-container" style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: '#64748b' }}>Loading subscription and commercial account details…</p>
      </div>
    );
  }

  const isCurrentPlan = (code: string) => {
    if (!status?.activePlan?.code) return false;
    return status.activePlan.code.startsWith(code);
  };

  const getStatusBadgeClass = () => {
    if (!status) return 'trial';
    if (status.status === 'ACTIVE') return 'active';
    if (status.status === 'TRIAL') return 'trial';
    if (status.status === 'GRACE_PERIOD') return 'grace';
    if (status.status === 'EXPIRED') return 'expired';
    return 'trial';
  };

  return (
    <div className="billing-section-container">
      {actionSuccess && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon name="check-circle" size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon name="alert-triangle" size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {/* ── CURRENT PLAN & STATUS CARD ─────────────────────────── */}
      <div className="billing-card">
        <div className="billing-card-header">
          <div className="billing-plan-info">
            <div className="billing-plan-title-row">
              <h2 className="billing-plan-name">{status?.activePlan?.name || 'VetRx Practice Access'}</h2>
              <span className={`billing-status-badge ${getStatusBadgeClass()}`}>
                {status?.status || 'TRIAL'}
              </span>
              {status?.cancelAtPeriodEnd && (
                <span className="billing-status-badge grace">
                  Cancels at period end
                </span>
              )}
            </div>
            <p className="billing-period-note">
              {status?.isTrial
                ? `14-Day Free Trial • ${status.daysRemainingInPeriod ?? 14} days remaining`
                : status?.periodEnd
                ? `Active until ${new Date(status.periodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : 'Foundational Clinical Access'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {status?.cancelAtPeriodEnd ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setConfirmModal({ type: 'REACTIVATE' })}
              >
                Reactivate Renewal
              </button>
            ) : status?.status === 'ACTIVE' ? (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                onClick={() => setConfirmModal({ type: 'CANCEL' })}
              >
                Cancel Subscription
              </button>
            ) : null}
          </div>
        </div>

        {/* Trial Countdown Banner */}
        {status?.isTrial && (
          <div className="trial-banner">
            <div className="trial-banner-left">
              <span className="trial-countdown-badge">
                {status.daysRemainingInPeriod ?? 14} Days Left
              </span>
              <p className="trial-banner-text">
                Your 14-day full-featured trial is active. You have full access to clinical tools and practice features.
              </p>
            </div>
            {status.paymentMethodStatus === 'PENDING' && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8125rem', padding: '6px 12px' }}
                onClick={handleActivateTrial}
                disabled={submittingAction}
              >
                Activate Trial (Test Mode)
              </button>
            )}
          </div>
        )}

        {/* Payment Method Notice (BD-01, BD-27) */}
        <div className="payment-req-banner">
          <Icon name="info" size={16} />
          <span>
            <strong>Payment Method Notice:</strong> A payment method is required to start your subscription. PayU payment gateway processing will be connected in Phase 13.
          </span>
        </div>

        {/* Resource Usage Meters */}
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', margin: '16px 0 8px' }}>
          Resource Usage & Quotas
        </h3>
        <div className="usage-grid">
          {/* Patients */}
          <div className="usage-item">
            <div className="usage-header">
              <span>Patients</span>
              <span className="usage-counts">
                {usage?.patientsCount ?? 0} / {usage?.maxPatients !== null && usage?.maxPatients !== undefined ? usage.maxPatients : '∞'}
              </span>
            </div>
            <div className="usage-progress-bar">
              <div
                className={`usage-progress-fill ${
                  usage?.maxPatients && (usage.patientsCount / usage.maxPatients) >= 1
                    ? 'danger'
                    : usage?.maxPatients && (usage.patientsCount / usage.maxPatients) >= 0.8
                    ? 'warning'
                    : ''
                }`}
                style={{
                  width: `${
                    usage?.maxPatients ? Math.min(100, (usage.patientsCount / usage.maxPatients) * 100) : 10
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Records per Patient */}
          <div className="usage-item">
            <div className="usage-header">
              <span>Records / Patient</span>
              <span className="usage-counts">
                {status?.isTrial ? 'Max 5 per patient' : 'Unlimited'}
              </span>
            </div>
            <div className="usage-progress-bar">
              <div className="usage-progress-fill" style={{ width: status?.isTrial ? '40%' : '100%' }} />
            </div>
          </div>

          {/* Treatment Packages */}
          <div className="usage-item">
            <div className="usage-header">
              <span>Treatment Packages</span>
              <span className="usage-counts">
                {usage?.packagesCount ?? 0} / {usage?.maxPackages !== null && usage?.maxPackages !== undefined ? usage.maxPackages : '∞'}
              </span>
            </div>
            <div className="usage-progress-bar">
              <div
                className={`usage-progress-fill ${
                  usage?.maxPackages && (usage.packagesCount / usage.maxPackages) >= 1 ? 'danger' : ''
                }`}
                style={{
                  width: `${
                    usage?.maxPackages ? Math.min(100, (usage.packagesCount / usage.maxPackages) * 100) : 10
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Custom Medicines */}
          <div className="usage-item">
            <div className="usage-header">
              <span>Custom Medicines</span>
              <span className="usage-counts">
                {usage?.customMedicinesCount ?? 0} / {usage?.maxCustomMedicines !== null && usage?.maxCustomMedicines !== undefined ? usage.maxCustomMedicines : '∞'}
              </span>
            </div>
            <div className="usage-progress-bar">
              <div
                className={`usage-progress-fill ${
                  usage?.maxCustomMedicines && (usage.customMedicinesCount / usage.maxCustomMedicines) >= 1 ? 'danger' : ''
                }`}
                style={{
                  width: `${
                    usage?.maxCustomMedicines ? Math.min(100, (usage.customMedicinesCount / usage.maxCustomMedicines) * 100) : 10
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Veterinarian Seats */}
          <div className="usage-item">
            <div className="usage-header">
              <span>Veterinarian Seats</span>
              <span className="usage-counts">
                {usage?.veterinarianSeatsCount ?? 1} / {usage?.maxVeterinarianSeats ?? 1}
              </span>
            </div>
            <div className="usage-progress-bar">
              <div className="usage-progress-fill" style={{ width: '100%' }} />
            </div>
          </div>

          {/* Staff Seats */}
          <div className="usage-item">
            <div className="usage-header">
              <span>Staff Members</span>
              <span className="usage-counts">
                {usage?.staffSeatsCount ?? 0} (Unlimited)
              </span>
            </div>
            <div className="usage-progress-bar">
              <div className="usage-progress-fill" style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── PRICING HEADER & BILLING TOGGLE ────────────────────── */}
      <div className="pricing-header">
        <h2 className="pricing-title">Transparent, Predictable Plans</h2>
        <p className="pricing-subtitle">
          Simple, transparent pricing. No complicated per-patient or per-prescription charges.
        </p>

        <div className="billing-toggle-container">
          <button
            type="button"
            className={`billing-toggle-btn ${billingInterval === 'MONTHLY' ? 'active' : ''}`}
            onClick={() => setBillingInterval('MONTHLY')}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            className={`billing-toggle-btn ${billingInterval === 'ANNUAL' ? 'active' : ''}`}
            onClick={() => setBillingInterval('ANNUAL')}
          >
            Annual Billing
            <span className="savings-chip">Save ~16.6%</span>
          </button>
        </div>
      </div>

      {/* ── PRICING CARDS GRID ─────────────────────────────────── */}
      <div className="pricing-cards-grid">
        {/* INDIVIDUAL PLAN */}
        <div className={`pricing-card ${isCurrentPlan('INDIVIDUAL') ? 'current' : ''}`}>
          {isCurrentPlan('INDIVIDUAL') && <span className="current-plan-indicator">Current Plan</span>}
          <div>
            <h3 className="plan-card-name">Individual</h3>
            <p className="plan-card-desc">Designed for single veterinarian private clinical practices.</p>

            <div className="plan-price-block">
              {billingInterval === 'MONTHLY' ? (
                <>
                  <span className="plan-price-figure">₹599</span>
                  <span className="plan-price-period">/ month</span>
                </>
              ) : (
                <>
                  <span className="plan-price-figure">₹5,999</span>
                  <span className="plan-price-period">/ year</span>
                  <span className="plan-savings-tag">Save ₹1,189/year (approx. 16.6%)</span>
                </>
              )}
            </div>

            <ul className="plan-features-list">
              <li className="plan-feature-item">
                <Icon name="check" size={16} />
                <span><strong>1 Veterinarian</strong> practitioner seat</span>
              </li>
              <li className="plan-feature-item">
                <Icon name="check" size={16} />
                <span><strong>Unlimited</strong> patients & clinical history</span>
              </li>
              <li className="plan-feature-item">
                <Icon name="check" size={16} />
                <span><strong>Unlimited</strong> prescriptions & invoices</span>
              </li>
              <li className="plan-feature-item">
                <Icon name="check" size={16} />
                <span><strong>Unlimited</strong> treatment packages</span>
              </li>
              <li className="plan-feature-item">
                <Icon name="check" size={16} />
                <span><strong>Unlimited</strong> administrative & staff users</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            className={`plan-action-btn ${isCurrentPlan('INDIVIDUAL') ? 'disabled' : 'primary'}`}
            disabled={isCurrentPlan('INDIVIDUAL')}
            onClick={() => {
              const code = billingInterval === 'MONTHLY' ? 'INDIVIDUAL_MONTHLY' : 'INDIVIDUAL_ANNUAL';
              if (status?.activePlan?.code?.startsWith('CLINIC')) {
                setConfirmModal({ type: 'DOWNGRADE', planCode: code, planName: 'Individual' });
              } else {
                setConfirmModal({ type: 'UPGRADE', planCode: code, planName: 'Individual' });
              }
            }}
          >
            {isCurrentPlan('INDIVIDUAL') ? 'Current Plan' : 'Select Individual'}
          </button>
        </div>

        {/* CLINIC PLAN */}
        <div className={`pricing-card ${isCurrentPlan('CLINIC') ? 'current' : ''}`}>
          {isCurrentPlan('CLINIC') && <span className="current-plan-indicator">Current Plan</span>}
          <div>
            <h3 className="plan-card-name">Clinic</h3>
            <p className="plan-card-desc">Multi-doctor clinics and veterinary centers with collaboration.</p>

            <div className="plan-price-block">
              {billingInterval === 'MONTHLY' ? (
                <>
                  <span className="plan-price-figure">₹1,499</span>
                  <span className="plan-price-period">/ month</span>
                </>
              ) : (
                <>
                  <span className="plan-price-figure">₹14,999</span>
                  <span className="plan-price-period">/ year</span>
                  <span className="plan-savings-tag">Save ₹2,989/year (approx. 16.6%)</span>
                </>
              )}
            </div>

            <ul className="plan-features-list">
              <li className="plan-feature-item">
                <Icon name="check" size={16} />
                <span><strong>Up to 5 Veterinarians</strong> included</span>
              </li>
              <li className="plan-feature-item">
                <Icon name="check" size={16} />
                <span><strong>Unlimited</strong> administrative / front-desk staff</span>
              </li>
              <li className="plan-feature-item">
                <Icon name="check" size={16} />
                <span><strong>Unlimited</strong> patients & medical records</span>
              </li>
              <li className="plan-feature-item">
                <Icon name="check" size={16} />
                <span><strong>Unlimited</strong> prescriptions, invoices, receipts</span>
              </li>
              <li className="plan-feature-item">
                <Icon name="check" size={16} />
                <span><strong>Shared</strong> clinic formulary & treatment protocols</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            className={`plan-action-btn ${isCurrentPlan('CLINIC') ? 'disabled' : 'primary'}`}
            disabled={isCurrentPlan('CLINIC')}
            onClick={() => {
              const code = billingInterval === 'MONTHLY' ? 'CLINIC_MONTHLY' : 'CLINIC_ANNUAL';
              setConfirmModal({ type: 'UPGRADE', planCode: code, planName: 'Clinic' });
            }}
          >
            {isCurrentPlan('CLINIC') ? 'Current Plan' : 'Upgrade to Clinic'}
          </button>
        </div>

        {/* ENTERPRISE PLAN */}
        <div className={`pricing-card ${isCurrentPlan('ENTERPRISE') ? 'current' : ''}`}>
          {isCurrentPlan('ENTERPRISE') && <span className="current-plan-indicator">Current Plan</span>}
          <div>
            <h3 className="plan-card-name">Enterprise</h3>
            <p className="plan-card-desc">Larger veterinary hospitals, multi-location practices, and custom setups.</p>

            <div className="plan-price-block">
              <span className="plan-price-figure">Custom</span>
              <span className="plan-price-period">annual tier</span>
              <span className="plan-savings-tag">Tailored to your network scale</span>
            </div>

            <ul className="plan-features-list">
              <li className="plan-feature-item">
                <Icon name="check" size={16} />
                <span><strong>Unlimited</strong> veterinarian & specialist seats</span>
              </li>
              <li className="plan-feature-item">
                <Icon name="check" size={16} />
                <span><strong>Multi-branch</strong> tenant isolation & aggregation</span>
              </li>
              <li className="plan-feature-item">
                <Icon name="check" size={16} />
                <span><strong>Custom</strong> data exports and dedicated account manager</span>
              </li>
              <li className="plan-feature-item">
                <Icon name="check" size={16} />
                <span><strong>Custom SLA</strong> and priority assistance</span>
              </li>
            </ul>
          </div>

          <a
            href="mailto:support@vetrx.in?subject=VetRx%20Enterprise%20Inquiry"
            className="plan-action-btn secondary"
            style={{ textDecoration: 'none' }}
          >
            Contact Sales
          </a>
        </div>
      </div>

      <p className="gst-disclaimer">
        Prices shown are exclusive of GST. Detailed GSTIN and SaaS tax invoicing will be enabled in Phase 13.
      </p>

      {/* ── CONFIRMATION MODAL ─────────────────────────────────── */}
      {confirmModal && (
        <div className="billing-modal-backdrop" onClick={() => !submittingAction && setConfirmModal(null)}>
          <div className="billing-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="billing-modal-title">
              {confirmModal.type === 'UPGRADE'
                ? `Upgrade to ${confirmModal.planName}`
                : confirmModal.type === 'DOWNGRADE'
                ? `Downgrade to ${confirmModal.planName}`
                : confirmModal.type === 'CANCEL'
                ? 'Cancel Subscription Renewal'
                : 'Reactivate Renewal'}
            </h3>

            <p className="billing-modal-body">
              {confirmModal.type === 'UPGRADE'
                ? `Your plan will upgrade to ${confirmModal.planName} immediately. Payment collection is scheduled for Phase 13.`
                : confirmModal.type === 'DOWNGRADE'
                ? `Your plan will downgrade to ${confirmModal.planName} at the end of your current billing period. Please ensure your active veterinarian seats do not exceed the plan limit.`
                : confirmModal.type === 'CANCEL'
                ? 'Your subscription will not renew automatically. Your full access remains intact until the end of your current billing period.'
                : 'Your automatic renewal will be restored at the end of your current billing period.'}
            </p>

            <div className="billing-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={submittingAction}
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${confirmModal.type === 'CANCEL' ? 'btn-danger' : 'btn-primary'}`}
                disabled={submittingAction}
                onClick={handleExecuteAction}
              >
                {submittingAction ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
