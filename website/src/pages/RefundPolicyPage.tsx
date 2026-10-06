import React from 'react';
import { LegalLayout } from '../components/LegalLayout';

export const RefundPolicyPage: React.FC = () => {
  const toc = [
    { id: 'trial', title: '1. 14-Day Free Trial' },
    { id: 'subscription-commencement', title: '2. Subscription Commencement' },
    { id: 'plans-and-billing', title: '3. Subscription Plans & Billing Cycles' },
    { id: 'cancellation', title: '4. Cancellation Terms & Access' },
    { id: 'refund-eligibility', title: '5. Refund Eligibility' },
    { id: 'duplicate-payments', title: '6. Duplicate & Erroneous Payments' },
    { id: 'failed-payments', title: '7. Payment Failures & Service Status' },
    { id: 'exceptional-circumstances', title: '8. Exceptional Circumstances' },
    { id: 'processing-timelines', title: '9. Processing Timelines & Taxes' },
    { id: 'contact', title: '10. Contact for Billing Queries' },
  ];

  const relatedLinks = [
    {
      title: 'Subscription & Billing Guide',
      href: '/billing',
      desc: 'Complete overview of Individual, Clinic, and Enterprise plans.',
    },
    {
      title: 'Terms of Service',
      href: '/terms',
      desc: 'Master commercial and licensing terms governing platform usage.',
    },
    {
      title: 'Grievance & Support Desk',
      href: '/grievance',
      desc: 'Formal escalation channels for unresolved billing complaints.',
    },
  ];

  return (
    <LegalLayout
      title="Refund & Cancellation Policy"
      subtitle="Clear, transparent terms regarding your 14-day free trial, subscription renewal, cancellation rights, and refund review procedures."
      badge="Commercial Terms"
      lastUpdated="September 24, 2026"
      toc={toc}
      relatedLinks={relatedLinks}
    >
      <div className="space-y-12">
        {/* Intro Highlight */}
        <div className="p-5 rounded-xl bg-teal-soft/60 border border-teal/20 text-content-primary">
          <p className="font-heading font-semibold text-teal-dark mb-1">
            Summary of Commercial Commitment
          </p>
          <p className="text-sm leading-relaxed text-content-secondary">
            VetRx provides a full 14-day free trial with unrestricted feature access so you can evaluate the platform in your daily practice before any payment. You can cancel at any time directly from your practice console without penalties.
          </p>
        </div>

        {/* Section 1 */}
        <section id="trial" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            1. 14-Day Free Trial &amp; Recurring Mandate Authorization
          </h2>
          <p className="text-content-secondary leading-relaxed">
            All newly registered veterinary practices begin with a fourteen (14) calendar day free trial with full feature access:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li>Practitioners receive full access to their chosen plan features (Individual or Clinic).</li>
            <li>No subscription fee is charged during the 14-day trial period (subscription fee is ₹0).</li>
            <li>Your chosen payment method is authorized during signup for recurring billing via PayU. For PayU Hosted Checkout free-trial registration: Cards (₹2 authorization transaction), UPI (₹2 authorization transaction), and Net Banking (₹0 authorization transaction). This is an authorization verification transaction and is not your VetRx subscription fee.</li>
            <li>Practitioners may configure practice profiles, add staff, manage appointments, and generate clinical case records without immediate billing.</li>
          </ul>
          <div className="p-4 rounded-lg bg-surface-card border border-clinical-border text-sm text-content-secondary italic">
            <strong>Approved Trial Terms:</strong> &ldquo;14 days free. Your selected plan begins after the trial unless you cancel beforehand.&rdquo;
          </div>
        </section>

        {/* Section 2 */}
        <section id="subscription-commencement" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            2. Day 12 Reminder &amp; Subscription Commencement
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Exactly two days before trial expiration (Day 12), an automated transactional reminder email is delivered to the registered billing email address, clearly communicating the scheduled charge date, the approved plan price, and cancellation instructions.
          </p>
          <p className="text-content-secondary leading-relaxed">
            Upon conclusion of the 14-day trial period (Day 14), the practice&apos;s chosen subscription plan will automatically initiate through the authorized payment method unless the subscription is explicitly cancelled prior to the trial expiration timestamp.
          </p>
        </section>

        {/* Section 3 */}
        <section id="plans-and-billing" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            3. Subscription Plans &amp; Billing Cycles
          </h2>
          <p className="text-content-secondary leading-relaxed">
            VetRx subscriptions are offered under the following standard commercial structures:
          </p>
          <div className="grid sm:grid-cols-2 gap-4 not-prose my-4">
            <div className="p-5 rounded-xl border border-clinical-border bg-white shadow-sm space-y-2">
              <span className="text-xs font-mono font-bold uppercase text-teal-dark bg-teal-soft px-2 py-0.5 rounded">Individual Plan</span>
              <h3 className="font-heading font-bold text-lg text-content-primary">Solo Practitioners &amp; Mobile Vets</h3>
              <p className="text-2xl font-extrabold text-content-primary">₹599 <span className="text-sm font-normal text-content-muted">/ month</span></p>
              <p className="text-sm text-content-secondary">Or ₹5,999 / year (billed annually in advance).</p>
            </div>
            <div className="p-5 rounded-xl border border-clinical-border bg-white shadow-sm space-y-2">
              <span className="text-xs font-mono font-bold uppercase text-teal-dark bg-teal-soft px-2 py-0.5 rounded">Clinic Plan</span>
              <h3 className="font-heading font-bold text-lg text-content-primary">Veterinary Hospitals &amp; Clinics</h3>
              <p className="text-2xl font-extrabold text-content-primary">₹1,499 <span className="text-sm font-normal text-content-muted">/ month</span></p>
              <p className="text-sm text-content-secondary">Or ₹14,999 / year. Up to 5 licensed veterinarians plus receptionist and accountant team seats.</p>
            </div>
          </div>
          <p className="text-content-secondary leading-relaxed text-sm">
            Enterprise plans with customized clinician limits, dedicated support, or specialized multi-branch configurations are negotiated under separate enterprise agreements.
          </p>
        </section>

        {/* Section 4 */}
        <section id="cancellation" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            4. Cancellation Terms &amp; Ongoing Access
          </h2>
          <p className="text-content-secondary leading-relaxed">
            You may cancel your active subscription at any time without early cancellation fees or penalties. Cancellation can be executed:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li>Directly within the VetRx Web Application under <strong>Settings &rarr; Subscription &amp; Billing</strong>; or</li>
            <li>By emailing a formal written cancellation request to <a href="mailto:supportvetrx@gmail.com" className="text-teal font-medium hover:underline">supportvetrx@gmail.com</a> from the practice administrator&apos;s registered email.</li>
          </ul>
          <div className="p-4 rounded-lg bg-surface-canvas border border-clinical-border space-y-2">
            <h4 className="font-heading font-semibold text-content-primary text-sm">What happens after cancellation?</h4>
            <p className="text-sm text-content-secondary leading-relaxed">
              Upon cancellation, your practice maintains uninterrupted, full read-and-write access to your VetRx account through the conclusion of your current paid billing period (month or year). Your subscription will not renew at the end of that cycle.
            </p>
            <p className="text-sm text-content-secondary leading-relaxed">
              Following expiration of the active billing period, your practice enters a read-only archive state where clinical records remain accessible for inspection and export according to our data retention schedule.
            </p>
          </div>
        </section>

        {/* Section 5 */}
        <section id="refund-eligibility" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            5. Refund Eligibility
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Because VetRx provides a comprehensive 14-day free trial before any subscription payment is initiated, recurring monthly and annual SaaS subscription fees are generally non-refundable once billed for the active cycle.
          </p>
          <p className="text-content-secondary leading-relaxed">
            Requests for refund consideration arising from duplicate, accidental, or erroneous transactions are evaluated on a case-by-case basis by our support team upon submission of relevant payment verification records.
          </p>
          <p className="text-content-secondary leading-relaxed">
            If a payment is debited from your bank account or card but fails to reflect or activate your subscription due to a gateway timeout or banking reconciliation error, please contact our support desk immediately with your payment reference details (UTR/Transaction ID) to verify and resolve the credit.
          </p>
        </section>

        {/* Section 6 */}
        <section id="duplicate-payments" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            6. Duplicate &amp; Erroneous Payments
          </h2>
          <p className="text-content-secondary leading-relaxed">
            In the event that an account is charged multiple times for the same billing cycle due to a technical glitch, network timeout, or payment gateway reconciliation error:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li>The redundant transaction will be credited back in full to the original source instrument upon verification.</li>
            <li>Customers should notify support within thirty (30) days of the transaction date with the relevant transaction identifiers (UTR/Bank Reference number).</li>
            <li>No administrative fee or deduction is assessed on verified duplicate charges.</li>
          </ul>
        </section>

        {/* Section 7 */}
        <section id="failed-payments" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            7. Payment Failures &amp; Service Status
          </h2>
          <p className="text-content-secondary leading-relaxed">
            If an automated subscription renewal transaction fails (e.g., due to expired payment instruments, insufficient balance, or bank downtime):
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-content-secondary">
            <li>VetRx provides a courtesy grace period of three (3) business days to allow the practice administrator to update payment information.</li>
            <li>The system will attempt retry transactions according to standard banking gateway schedules.</li>
            <li>Practice records are never deleted immediately upon payment failure. If payment remains unresolved following the grace period, account access will shift to read-only status until resolved.</li>
          </ol>
        </section>

        {/* Section 8 */}
        <section id="exceptional-circumstances" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            8. Exceptional Circumstances
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Refund requests originating from catastrophic platform unavailability (unplanned downtime exceeding forty-eight consecutive hours directly attributable to VetRx infrastructure, excluding scheduled maintenance) may be reviewed for pro-rata credit or refund at VetRx&apos;s sole reasonable discretion.
          </p>
        </section>

        {/* Section 9 */}
        <section id="processing-timelines" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            9. Processing Timelines &amp; Applicable Taxes
          </h2>
          <p className="text-content-secondary leading-relaxed">
            When a refund is approved by VetRx:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li>The refund instruction is submitted to our authorized payment processing partner within five (5) to seven (7) business days.</li>
            <li>Final credit to the customer&apos;s bank account or credit card depends on the issuing bank&apos;s settlement schedule (typically 3 to 10 additional working days).</li>
            <li>Where taxes have been levied and deposited with statutory authorities, credit notes will be issued in compliance with Indian tax regulations.</li>
          </ul>
        </section>

        {/* Section 10 */}
        <section id="contact" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            10. Contact for Billing Queries
          </h2>
          <p className="text-content-secondary leading-relaxed">
            For questions regarding your invoices, plan renewals, cancellations, or refund requests, please contact our billing desk:
          </p>
          <div className="p-5 rounded-xl border border-clinical-border bg-white space-y-3">
            <p className="font-semibold text-content-primary">VetRx Billing &amp; Subscription Inquiries</p>
            <p className="text-xs text-content-muted">VetRx is operated by Alungal Shameem.</p>
            <p className="text-sm text-content-secondary">
              Email: <a href="mailto:supportvetrx@gmail.com" className="text-teal font-medium hover:underline">supportvetrx@gmail.com</a>
            </p>
            <p className="text-sm text-content-secondary">
              WhatsApp Support: <a href="https://wa.me/919074683808" target="_blank" rel="noopener noreferrer" className="text-teal font-medium hover:underline">+91 90746 83808</a>
            </p>
            <p className="text-xs text-content-muted">
              Please include your Practice Name and registered account email address in all communications.
            </p>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
};
