// ==============================================================================
// VetRx — Subscription & Billing Section Component (Phase 12)
// Manages commercial plans, 14-day trial status, usage limits, upgrades,
// downgrades with limit validation, cancellation, and authoritative pricing.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { Icon } from '../ui/Icon';
import { useInventoryEntitlement } from '../../context/InventoryEntitlementContext';
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

interface PaymentRecord {
  id: string;
  amountPaisa: number;
  currency: string;
  status: string;
  paymentProvider: string;
  internalReference: string;
  gatewayTransactionId: string | null;
  paymentMethod: string | null;
  createdAt: string;
  receiptNumber?: string | null;
  gatewayResponseRaw?: {
    planCode?: string;
    planName?: string;
    billingInterval?: string;
    receiptNumber?: string;
  };
}

export const SubscriptionBillingSection: React.FC = () => {
  const { isEntitled: isInventoryEntitled, toggleDevEntitlement, mockMode } = useInventoryEntitlement();
  const [togglingInventory, setTogglingInventory] = useState(false);
  const [status, setStatus] = useState<CommercialStatus | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
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
  const [confirmDataDeletion, setConfirmDataDeletion] = useState(false);

  const fetchCommercialData = async () => {
    try {
      setLoading(true);
      const [statusRes, usageRes, paymentsRes] = await Promise.all([
        fetch(`${API_BASE}/api/commercial/status`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/commercial/usage`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/commercial/payments`, { credentials: 'include' }),
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsage(usageData);
      }
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData);
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
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const paymentStatus = searchParams.get('payment_status');
    const txnid = searchParams.get('txnid');
    if (paymentStatus === 'success') {
      setActionSuccess(`Payment verified successfully! Transaction reference: ${txnid || 'Confirmed'}. Your subscription is now active.`);
    } else if (paymentStatus === 'failed') {
      setActionError('Payment could not be verified or was cancelled. Please try again.');
    }
    void fetchCommercialData();
  }, []);

  const handleExecuteAction = async () => {
    if (!confirmModal) return;
    setSubmittingAction(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      if (confirmModal.type === 'UPGRADE') {
        const payRes = await fetch(`${API_BASE}/api/commercial/payments/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ planCode: confirmModal.planCode, billingInterval }),
        });
        const payData = await payRes.json();
        if (!payRes.ok) {
          throw new Error(payData.message || 'Payment order initiation failed.');
        }

        if (payData.checkoutUrl && payData.formParameters) {
          const form = document.createElement('form');
          form.method = 'POST';
          form.action = payData.checkoutUrl;
          for (const [k, v] of Object.entries(payData.formParameters)) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = k;
            input.value = String(v);
            form.appendChild(input);
          }
          document.body.appendChild(form);
          form.submit();
          return;
        }

        setActionSuccess('Payment initiated successfully.');
        setConfirmModal(null);
        await fetchCommercialData();
        return;
      }

      let endpoint = '';
      let body: any = undefined;

      if (confirmModal.type === 'DOWNGRADE') {
        endpoint = `${API_BASE}/api/commercial/subscription/downgrade`;
        body = JSON.stringify({ planCode: confirmModal.planCode });
      } else if (confirmModal.type === 'CANCEL') {
        if (status?.isTrial) {
          endpoint = `${API_BASE}/api/commercial/trial/cancel`;
          body = JSON.stringify({ confirmDelete: confirmDataDeletion });
        } else {
          endpoint = `${API_BASE}/api/commercial/subscription/cancel`;
        }
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

      if (confirmModal.type === 'CANCEL' && status?.isTrial && confirmDataDeletion) {
        alert('Your trial has been cancelled and practice data permanently deleted. Redirecting to home.');
        window.location.href = 'https://vetrx.brightbase.in';
        return;
      }

      setActionSuccess(data.message || 'Subscription successfully updated.');
      setConfirmModal(null);
      setConfirmDataDeletion(false);
      await fetchCommercialData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleAuthorizeMandate = async (paymentMethod: 'CARD' | 'UPI' | 'NETBANKING' = 'CARD') => {
    setSubmittingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/commercial/trial/mandate/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          planCode: status?.activePlan?.code?.startsWith('CLINIC') ? 'CLINIC' : 'INDIVIDUAL',
          billingInterval,
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Mandate initiation failed.');

      if (data.checkoutUrl && data.formParameters) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = data.checkoutUrl;
        for (const [k, v] of Object.entries(data.formParameters)) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = k;
          input.value = String(v);
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
        return;
      }
      setActionSuccess('Mandate registration completed.');
      await fetchCommercialData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to initiate mandate registration.');
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
            ) : status?.isTrial ? (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                onClick={() => setConfirmModal({ type: 'CANCEL' })}
              >
                Cancel Trial
              </button>
            ) : null}
          </div>
        </div>

        {/* Trial Countdown Banner */}
        {status?.isTrial && (
          <div className="trial-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div className="trial-banner-left">
              <span className="trial-countdown-badge">
                {status.daysRemainingInPeriod ?? 14} Days Left
              </span>
              <p className="trial-banner-text">
                Your 14-day full-featured trial is active. You have full access to clinical tools and practice features.
              </p>
            </div>
            {status.paymentMethodStatus !== 'CONFIGURED' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: '0.8125rem', padding: '6px 14px', whiteSpace: 'nowrap' }}
                  onClick={() => handleAuthorizeMandate('CARD')}
                  disabled={submittingAction}
                >
                  Authorize Payment Method (₹2 Auth)
                </button>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'right' }}>
                  Cards/UPI: ₹2 verification • Net Banking: ₹0 verification
                </span>
              </div>
            )}
          </div>
        )}

        {/* Payment Method Notice */}
        <div className="payment-req-banner">
          <Icon name="info" size={16} />
          <span>
            <strong>Payment Method Notice:</strong> Subscriptions are processed securely in INR through PayU payment gateway. PayU may process a small authorization transaction during recurring mandate registration (₹2 for Cards/UPI, ₹0 for Net Banking). This is an authorization verification transaction and is not your VetRx subscription fee. No subscription fee is charged during the 14-day trial.
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
        Simple, transparent pricing. No per-patient or per-prescription charges. Applicable taxes, if any, will be reflected in the applicable invoice.
      </p>

      {/* ── ADD-ON MODULES ────────────────────────────────────────── */}
      <div className="payment-history-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="box" size={20} color="var(--color-primary, #00685f)" />
              <h3 className="payment-history-title" style={{ margin: 0 }}>Available Add-on Modules</h3>
            </div>
            <p className="payment-history-subtitle" style={{ margin: '4px 0 0 0' }}>
              Specialized plug-in capabilities requiring an active base subscription and independent module entitlement.
            </p>
          </div>
        </div>

        <div
          style={{
            marginTop: '16px',
            padding: '20px',
            borderRadius: '14px',
            background: isInventoryEntitled ? 'rgba(0, 104, 95, 0.04)' : '#f8fafc',
            border: `1px solid ${isInventoryEntitled ? 'rgba(0, 104, 95, 0.2)' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                Inventory &amp; Stock Management V1
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: '#f1f5f9',
                  color: '#475569',
                }}
              >
                inventory_management
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: isInventoryEntitled ? '#dcfce7' : '#f1f5f9',
                  color: isInventoryEntitled ? '#15803d' : '#64748b',
                }}
              >
                {isInventoryEntitled ? 'ACTIVE (ENTITLED)' : 'INACTIVE'}
              </span>
              {mockMode && (
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: '#e0f2fe',
                    color: '#0369a1',
                  }}
                >
                  Dev Mock Mode
                </span>
              )}
            </div>
            <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Universal purchase invoice importer (PDF/images/text), batch-level physical stock tracking,
              immutable audit ledger, FEFO stock deduction, physical stocktake, and prescription internal/external source resolution.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className={`btn ${isInventoryEntitled ? 'btn-secondary' : 'btn-primary'}`}
              id="btn-toggle-inventory-dev"
              disabled={togglingInventory}
              onClick={async () => {
                setTogglingInventory(true);
                try {
                  await toggleDevEntitlement(!isInventoryEntitled);
                } finally {
                  setTogglingInventory(false);
                }
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name={isInventoryEntitled ? 'block' : 'check'} size={16} />
              <span>
                {togglingInventory
                  ? 'Updating...'
                  : isInventoryEntitled
                  ? 'Disable Module (Dev Toggle)'
                  : 'Enable Inventory (Dev / Test Mode)'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── PAYMENT HISTORY ────────────────────────────────────── */}
      <div className="payment-history-card">
        <h3 className="payment-history-title">Payment & Billing History</h3>
        <p className="payment-history-subtitle">
          Record of all commercial subscription transactions processed through PayU.
        </p>
        {payments && payments.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="payment-history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Receipt Number</th>
                  <th>Transaction Reference</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const receiptNo = p.receiptNumber || p.gatewayResponseRaw?.receiptNumber || `REC-VRX-${p.id.slice(0, 8).toUpperCase()}`;
                  return (
                    <tr key={p.id}>
                      <td>{new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td>{p.gatewayResponseRaw?.planName || 'VetRx Subscription'} ({p.gatewayResponseRaw?.billingInterval || 'Standard'})</td>
                      <td>₹{(p.amountPaisa / 100).toLocaleString('en-IN')}</td>
                      <td>
                        <span className={`billing-status-badge ${p.status === 'SUCCESS' ? 'active' : p.status === 'PENDING' ? 'trial' : 'expired'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a' }}>
                        {p.status === 'SUCCESS' ? receiptNo : '—'}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{p.gatewayTransactionId || p.internalReference}</td>
                      <td style={{ textAlign: 'right' }}>
                        {p.status === 'SUCCESS' ? (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                            onClick={() => window.open(`${API_BASE}/api/commercial/payments/${p.id}/receipt?format=html`, '_blank')}
                          >
                            Download Receipt
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="payment-history-empty">
            No payment transactions recorded yet.
          </div>
        )}
      </div>

      {/* ── CONFIRMATION MODAL ─────────────────────────────────── */}
      {confirmModal && (
        <div className="billing-modal-backdrop" onClick={() => !submittingAction && setConfirmModal(null)}>
          <div className="billing-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="billing-modal-title">
              {confirmModal.type === 'UPGRADE'
                ? `Subscribe to ${confirmModal.planName}`
                : confirmModal.type === 'DOWNGRADE'
                ? `Downgrade to ${confirmModal.planName}`
                : confirmModal.type === 'CANCEL' && status?.isTrial
                ? 'Cancel Trial & Delete Account'
                : confirmModal.type === 'CANCEL'
                ? 'Cancel Subscription Renewal'
                : 'Reactivate Renewal'}
            </h3>

            <p className="billing-modal-body">
              {confirmModal.type === 'UPGRADE'
                ? `You will proceed to secure PayU checkout for the ${confirmModal.planName} plan (${billingInterval === 'ANNUAL' ? 'Annual: ₹' + (confirmModal.planName === 'Clinic' ? '14,999' : '5,999') + '/yr' : 'Monthly: ₹' + (confirmModal.planName === 'Clinic' ? '1,499' : '599') + '/mo'}).`
                : confirmModal.type === 'DOWNGRADE'
                ? `Your plan will downgrade to ${confirmModal.planName} at the end of your current billing period. Please ensure your active veterinarian seats do not exceed the plan limit.`
                : confirmModal.type === 'CANCEL' && status?.isTrial
                ? 'Cancelling your trial will cancel pending subscription conversion and prevent any post-trial charges.'
                : confirmModal.type === 'CANCEL'
                ? 'Your subscription will not renew automatically. Your full access remains intact until the end of your current billing period.'
                : 'Your automatic renewal will be restored at the end of your current billing period.'}
            </p>

            {confirmModal.type === 'CANCEL' && status?.isTrial && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', marginTop: '12px', marginBottom: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '0.8125rem', color: '#991b1b' }}>
                  <input
                    type="checkbox"
                    checked={confirmDataDeletion}
                    onChange={(e) => setConfirmDataDeletion(e.target.checked)}
                    style={{ marginTop: '2px', accentColor: '#dc2626' }}
                  />
                  <span>
                    <strong>Permanent Deletion:</strong> Permanently delete practice data and remove practice from active VetRx use upon cancellation.
                  </span>
                </label>
              </div>
            )}

            <div className="billing-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={submittingAction}
                onClick={() => {
                  setConfirmModal(null);
                  setConfirmDataDeletion(false);
                }}
              >
                {confirmModal.type === 'CANCEL' && status?.isTrial ? 'Keep Trial' : 'Cancel'}
              </button>
              <button
                type="button"
                className={`btn ${confirmModal.type === 'CANCEL' ? 'btn-danger' : 'btn-primary'}`}
                disabled={submittingAction}
                onClick={handleExecuteAction}
              >
                {submittingAction
                  ? 'Processing…'
                  : confirmModal.type === 'UPGRADE'
                  ? 'Proceed to PayU'
                  : confirmModal.type === 'CANCEL' && status?.isTrial
                  ? confirmDataDeletion
                    ? 'Cancel & Delete Practice'
                    : 'Cancel Trial'
                  : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
