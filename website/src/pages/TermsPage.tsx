import React from 'react';
import { LegalLayout } from '../components/LegalLayout';
import { Link } from 'react-router-dom';

export const TermsPage: React.FC = () => {
  const toc = [
    { id: 'acceptance', title: '1. Acceptance of Terms & Eligibility' },
    { id: 'accounts', title: '2. Accounts & Authorized Users' },
    { id: 'plans-trials', title: '3. Subscription Plans & 14-Day Trial' },
    { id: 'billing', title: '4. Fees, Billing & Cancellation' },
    { id: 'professional-duty', title: '5. Veterinary Professional Responsibility' },
    { id: 'acceptable-use', title: '6. Acceptable Use & Conduct' },
    { id: 'ip-data', title: '7. Intellectual Property & Practice Data' },
    { id: 'availability', title: '8. Availability & Maintenance' },
    { id: 'termination', title: '9. Suspension & Termination' },
    { id: 'disclaimers', title: '10. Warranties & Disclaimers' },
    { id: 'liability', title: '11. Limitation of Liability & Indemnity' },
    { id: 'governing-law', title: '12. Governing Law & Jurisdiction' },
    { id: 'contact', title: '13. Contact & Grievance Redressal' },
  ];

  const relatedLinks = [
    { title: 'Privacy Policy', href: '/privacy', desc: 'How practice and patient data is handled under DPDP principles.' },
    { title: 'Clinical Disclaimer', href: '/clinical-disclaimer', desc: 'Veterinary professional judgment & decision boundaries.' },
    { title: 'Refund Policy', href: '/refund-policy', desc: 'Commercial terms, cancellations, and evaluation trial terms.' },
  ];

  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="These Terms govern your access to and use of the VetRx veterinary practice management platform and associated digital services."
      badge="Legal Agreement"
      lastUpdated="September 24, 2026"
      toc={toc}
      relatedLinks={relatedLinks}
    >
      {/* Notice Banner */}
      <div className="p-4 rounded-xl bg-teal-soft/50 border border-teal/20 text-xs text-content-secondary space-y-1">
        <p className="font-bold text-teal-dark font-heading uppercase tracking-wider">
          Commercial Agreement Notice
        </p>
        <p>
          By creating an account, registering a practice, or accessing VetRx, you agree to be bound by these Terms of Service.
          Please read them carefully.
        </p>
      </div>

      {/* Section 1 */}
      <section id="acceptance" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          1. Acceptance of Terms &amp; Eligibility
        </h2>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) constitute a legally binding agreement between you (whether individually as a veterinary practitioner
          or on behalf of a veterinary clinic, hospital, or organization, &ldquo;Customer&rdquo;, &ldquo;You&rdquo;, or &ldquo;User&rdquo;) and
          Praxivon Technologies Private Limited, the business behind VetRx (&ldquo;VetRx&rdquo;, &ldquo;We&rdquo;, &ldquo;Us&rdquo;, or &ldquo;Our&rdquo;),
          with its principal place of operations at Melattur PO, Malappuram District, Kerala, India.
        </p>
        <p>
          <strong>Eligibility:</strong> VetRx is designed exclusively for authorized veterinary professionals, registered veterinary practitioners, clinic owners,
          and authorized clinical support staff. You must possess the requisite legal authority, professional registrations, and capacity under the Indian Contract Act, 1872
          to enter into these Terms.
        </p>
      </section>

      {/* Section 2 */}
      <section id="accounts" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          2. Accounts &amp; Authorized Users
        </h2>
        <p>
          To utilize the platform, you must register a practice account at <a href="https://app.vetrx.brightbase.in/register" target="_blank" rel="noopener noreferrer" className="text-teal-dark font-medium underline">app.vetrx.brightbase.in</a>.
          You agree to provide true, accurate, and current registration details, including your full legal name, professional email address, and practice details.
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
          <li><strong>Account Security:</strong> You are responsible for safeguarding your login credentials and maintaining the confidentiality of active sessions. VetRx employs HttpOnly, secure session cookies in production. You must immediately notify us of any suspected unauthorized access.</li>
          <li><strong>Practice Membership &amp; Roles:</strong> Account administrators may invite team members as authorized users (Veterinarians, Receptionists, Accountants) based on their subscription tier. The Customer remains responsible for all actions conducted by its authorized members.</li>
        </ul>
      </section>

      {/* Section 3 */}
      <section id="plans-trials" className="space-y-3">
        <h2 className="font-heading font-extrabold text-xl text-content-primary">
          3. Subscription Plans &amp; 14-Day Free Trial
        </h2>
        <p>
          VetRx is provided on a software-as-a-service (SaaS) subscription basis across three primary tiers:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3 text-xs">
          <div className="p-3 bg-surface-canvas rounded-lg border border-clinical-border">
            <span className="font-bold text-teal-dark block">INDIVIDUAL PLAN</span>
            <span className="text-content-primary font-semibold">₹599/mo or ₹5,999/yr</span>
            <p className="text-content-muted mt-1">Single veterinarian, unlimited patients, prescriptions &amp; INR invoices.</p>
          </div>
          <div className="p-3 bg-surface-canvas rounded-lg border border-clinical-border">
            <span className="font-bold text-teal-dark block">CLINIC PLAN</span>
            <span className="text-content-primary font-semibold">₹1,499/mo or ₹14,999/yr</span>
            <p className="text-content-muted mt-1">Up to 5 veterinarians, receptionist access, accountant access, multi-station usage.</p>
          </div>
          <div className="p-3 bg-surface-canvas rounded-lg border border-clinical-border">
            <span className="font-bold text-teal-dark block">ENTERPRISE PLAN</span>
            <span className="text-content-primary font-semibold">Custom Pricing</span>
            <p className="text-content-muted mt-1">Tailored hospital agreements, multi-branch switching &amp; dedicated onboarding.</p>
          </div>
        </div>
        <p>
          <strong>14-Day Free Trial:</strong> All new practice registrations receive a 14-day trial without per-patient or per-prescription charges.
          14 days free. Your selected plan begins after the trial unless you cancel beforehand.
        </p>
      </section>

      {/* Section 4 */}
      <section id="billing" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          4. Fees, Billing &amp; Cancellation
        </h2>
        <p>
          Subscription fees are billed in advance on either a monthly or annual recurring cycle as chosen by you. All prices are denominated in Indian Rupees (₹ INR).
          Applicable taxes, if any, will be reflected in the applicable invoice.
        </p>
        <p>
          <strong>Cancellation &amp; Refunds:</strong> You may cancel your subscription renewal at any time through the platform settings. Upon cancellation, you retain full access through the end of your current paid billing period.
          Refunds are governed by our standalone <Link to="/refund-policy" className="text-teal-dark font-medium underline">Refund &amp; Cancellation Policy</Link>.
        </p>
      </section>

      {/* Section 5 */}
      <section id="professional-duty" className="space-y-3 border-l-4 border-teal pl-4 bg-teal-soft/20 py-3 rounded-r-xl">
        <h2 className="font-heading font-bold text-xl text-teal-dark">
          5. Veterinary Professional Responsibility
        </h2>
        <p className="font-semibold text-content-primary">
          VetRx is an administrative, clinical documentation, and practice management tool.
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
          <li><strong>Clinical Boundaries:</strong> VetRx does not diagnose disease, independently prescribe treatment, or calculate medication dosages without veterinarian supervision. It does not replace physical examination or professional veterinary judgment.</li>
          <li><strong>Veterinary Responsibility:</strong> The treating veterinarian remains responsible for clinical assessment, diagnosis, prescription, dosage decisions and treatment. Reference formularies and weight-band calculation tools are supportive aids only and must be independently verified by the practitioner prior to issuing any prescription.</li>
          <li><strong>Statutory Prescribing:</strong> The treating veterinarian remains legally responsible for complying with the Indian Veterinary Council Act, 1984, state veterinary council regulations, drugs and cosmetics laws, and applicable government practice rules.</li>
        </ul>
      </section>

      {/* Section 6 */}
      <section id="acceptable-use" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          6. Acceptable Use &amp; Conduct
        </h2>
        <p>
          You agree to use VetRx solely for legitimate veterinary practice operations. Prohibited activities include:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
          <li>Circumventing plan seat limits, user seat assignments, or multi-tenant database isolation boundaries.</li>
          <li>Reverse-engineering, decompiling, or attempting to discover the source code of the platform.</li>
          <li>Introducing viruses, malicious scripts, automated scraping bots, or disruptive network payloads.</li>
          <li>Storing or transmitting unlawful, infringing, fraudulent, or defamatory content.</li>
        </ul>
        <p>
          Detailed usage expectations are codified in our <Link to="/acceptable-use" className="text-teal-dark font-medium underline">Acceptable Use Policy</Link>.
        </p>
      </section>

      {/* Section 7 */}
      <section id="ip-data" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          7. Intellectual Property &amp; Practice Data
        </h2>
        <p>
          <strong>VetRx Ownership:</strong> VetRx, its software code, UI designs, brand marks, logos, and system architecture are the exclusive intellectual property of Praxivon Technologies Private Limited and its licensors.
        </p>
        <p>
          <strong>Customer Data Sovereignty:</strong> You retain complete ownership of all clinical history records, patient details, client contacts, and invoice ledgers that you enter into the platform.
          VetRx does NOT claim ownership over your clinical records, does NOT sell practice data to pharmaceutical or commercial advertisers, and does NOT utilize your clinical entries for machine learning or AI training models.
        </p>
      </section>

      {/* Section 8 */}
      <section id="availability" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          8. Availability &amp; Maintenance
        </h2>
        <p>
          We strive to provide continuous platform availability. However, service may occasionally be subject to scheduled maintenance, software updates, or unforeseen network disruptions.
          VetRx does not provide contractual 99.99% uptime guarantees or financial SLA credits unless explicitly executed under a separate Enterprise Agreement.
        </p>
      </section>

      {/* Section 9 */}
      <section id="termination" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          9. Suspension, Termination &amp; Data Retention
        </h2>
        <p>
          We reserve the right to suspend or terminate account access if a Customer commits a material breach of these Terms, engages in fraudulent billing activity,
          or poses a security threat to platform infrastructure.
        </p>
        <p>
          Upon cancellation or termination of your subscription, your practice data is retained for 90 days, during which you can request account deletion or export your records directly within the application. Following this 90-day retention period, data is scheduled for permanent deletion.
        </p>
      </section>

      {/* Section 10 */}
      <section id="disclaimers" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          10. Warranties &amp; Disclaimers
        </h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE INDIAN LAW, VETRX IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND,
          WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE. WE EXPRESSLY DISCLAIM ALL IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR CLINICAL PURPOSE,
          AND NON-INFRINGEMENT. NO ADVICE OR INFORMATION OBTAINED THROUGH THE PLATFORM CREATES ANY WARRANTY NOT EXPRESSLY STATED HEREIN.
        </p>
      </section>

      {/* Section 11 */}
      <section id="liability" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          11. Limitation of Liability &amp; Indemnity
        </h2>
        <p>
          TO THE EXTENT PERMITTED UNDER APPLICABLE LAW, IN NO EVENT SHALL VETRX, ITS DIRECTORS, EMPLOYEES, OR SUPPLIERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, LOSS OF PRACTICE REPUTATION, LOSS OF DATA, OR CLINICAL ADVERSE OUTCOMES ARISING FROM YOUR USE OF THE PLATFORM.
          OUR AGGREGATE LIABILITY ARISING UNDER THESE TERMS SHALL NOT EXCEED THE TOTAL FEES PAID BY YOU TO VETRX IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
        </p>
        <p>
          You agree to defend, indemnify, and hold harmless VetRx against any third-party claims, liabilities, or damages arising from your veterinary clinical decisions,
          prescriptions issued under your professional credentials, or violation of applicable service rules.
        </p>
      </section>

      {/* Section 12 */}
      <section id="governing-law" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          12. Governing Law &amp; Jurisdiction
        </h2>
        <p>
          These Terms shall be governed by, construed, and enforced in accordance with the laws of India, Government orders of Kerala, and courts having jurisdiction in Kerala.
        </p>
      </section>

      {/* Section 13 */}
      <section id="contact" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          13. Contact &amp; Grievance Redressal
        </h2>
        <p>
          If you have questions regarding these Terms or wish to lodge a formal contractual inquiry, please contact:
        </p>
        <div className="p-4 bg-surface-canvas rounded-xl border border-clinical-border font-mono text-xs space-y-1">
          <p><strong>Business Identity:</strong> Praxivon Technologies Private Limited</p>
          <p><strong>Address:</strong> Melattur PO, Malappuram District, Kerala, India</p>
          <p><strong>Support &amp; Inquiries:</strong> supportvetrx@gmail.com</p>
          <p><strong>WhatsApp Support:</strong> +91 90746 83808</p>
          <p><strong>Grievance Desk:</strong> <Link to="/grievance" className="text-teal-dark underline font-sans font-bold">Access Grievance Redressal Page →</Link></p>
        </div>
      </section>
    </LegalLayout>
  );
};
