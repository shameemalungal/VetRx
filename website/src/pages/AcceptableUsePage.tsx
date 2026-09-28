import React from 'react';
import { LegalLayout } from '../components/LegalLayout';

export const AcceptableUsePage: React.FC = () => {
  const toc = [
    { id: 'purpose', title: '1. Purpose & Scope' },
    { id: 'prohibited-activities', title: '2. Prohibited Activities' },
    { id: 'plan-boundaries', title: '3. Plan Integrity & Multi-User Rules' },
    { id: 'statutory-vet-practice', title: '4. Statutory Veterinary Practice Integrity' },
    { id: 'system-security', title: '5. Platform Security & Reverse Engineering' },
    { id: 'data-sanctity', title: '6. Patient & Client Data Sanctity' },
    { id: 'investigation', title: '7. Monitoring & Violation Investigation' },
    { id: 'consequences', title: '8. Consequences & Termination' },
    { id: 'reporting', title: '9. Reporting Violations' },
  ];

  const relatedLinks = [
    {
      title: 'Terms of Service',
      href: '/terms',
      desc: 'Master commercial agreement and licensing obligations.',
    },
    {
      title: 'Security Architecture',
      href: '/security',
      desc: 'Technical perimeter, tenant isolation, and access controls.',
    },
    {
      title: 'Clinical Disclaimer',
      href: '/clinical-disclaimer',
      desc: 'Professional boundaries and practitioner responsibilities.',
    },
  ];

  return (
    <LegalLayout
      title="Acceptable Use Policy"
      subtitle="Operational rules, behavioral standards, and multi-tenant security boundaries governing access to the VetRx veterinary practice management platform."
      badge="Operational Standards"
      lastUpdated="September 24, 2026"
      toc={toc}
      relatedLinks={relatedLinks}
    >
      <div className="space-y-12">
        {/* Intro */}
        <div className="p-5 rounded-xl bg-teal-soft/60 border border-teal/20 text-content-primary">
          <p className="font-heading font-semibold text-teal-dark mb-1">
            Safeguarding Veterinary Care &amp; Multi-Tenant Integrity
          </p>
          <p className="text-sm leading-relaxed text-content-secondary">
            VetRx provides critical practice management infrastructure for licensed veterinary clinicians across India. This Acceptable Use Policy protects the security, reliability, and statutory sanctity of the platform for all participating clinics and their animal patients.
          </p>
        </div>

        {/* Section 1 */}
        <section id="purpose" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            1. Purpose &amp; Scope
          </h2>
          <p className="text-content-secondary leading-relaxed">
            This Acceptable Use Policy (&ldquo;AUP&rdquo;) defines prohibited activities and mandatory standards of conduct when utilizing the VetRx marketing website, web application, APIs, and associated services. This policy binds all account holders, veterinarians, receptionists, administrative personnel, and authorized team members.
          </p>
        </section>

        {/* Section 2 */}
        <section id="prohibited-activities" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            2. Prohibited Activities
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Users may not engage in, attempt to engage in, or facilitate any of the following activities on or through the VetRx platform:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li><strong>Unauthorized Access &amp; Intrusion:</strong> Accessing or attempting to access accounts, practice workspaces, server consoles, database instances, or network infrastructure without explicit authorization.</li>
            <li><strong>Security Probing:</strong> Performing vulnerability scanning, port scanning, penetration testing, or denial-of-service simulations against VetRx servers without prior written authorization from VetRx engineering management.</li>
            <li><strong>Malicious Code Propagation:</strong> Uploading, injecting, or transmitting viruses, trojans, worms, logic bombs, ransomware, or malicious browser scripts into patient notes, attachment uploads, or form fields.</li>
            <li><strong>Automated Scraping &amp; Crawling:</strong> Deploying bots, scrapers, automated spiders, or unauthorized scripts to extract clinical data, inventory pricing, or platform interfaces.</li>
            <li><strong>API Flooding:</strong> Generating unreasonable volumes of API requests designed to bypass rate limits or degrade system performance for other tenant clinics.</li>
            <li><strong>Fraud &amp; Deceptive Identity:</strong> Misrepresenting credentials, forging prescription signatures, fabricating client identities, or presenting false statutory registration details.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section id="plan-boundaries" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            3. Plan Integrity &amp; Multi-User Rules
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Subscription tiers are structured around practice operational scale. Circumventing authorized user limits undermines platform performance and audit trail integrity:
          </p>
          <div className="grid sm:grid-cols-2 gap-4 not-prose">
            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-2">
              <h3 className="font-heading font-semibold text-content-primary text-base">Individual Plan</h3>
              <p className="text-sm text-content-secondary leading-relaxed">
                Licensed for one (1) individual solo veterinary practitioner. Sharing account credentials among multiple independent practicing veterinarians to evade plan upgrading is strictly prohibited.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-2">
              <h3 className="font-heading font-semibold text-content-primary text-base">Clinic Plan</h3>
              <p className="text-sm text-content-secondary leading-relaxed">
                Licensed for up to five (5) distinct licensed veterinary practitioners, plus designated receptionist and accountant seats. Each user must have a unique credential for clinical audit accountability.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section id="statutory-vet-practice" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            4. Statutory Veterinary Practice Integrity
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Under Indian law, only individuals holding recognized veterinary qualifications and registered with the Veterinary Council of India (VCI) or respective State Veterinary Councils under the Indian Veterinary Council Act, 1984, are legally permitted to practice veterinary medicine and issue veterinary prescriptions.
          </p>
          <div className="p-4 rounded-lg bg-surface-card border border-clinical-border space-y-2 text-sm text-content-secondary">
            <p className="font-semibold text-content-primary">Mandatory Practitioner Standards:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>You may not use VetRx to issue clinical prescriptions or formal health certificates unless you possess an active, valid veterinary statutory registration number.</li>
              <li>You may not permit unqualified clinic assistants or non-veterinarians to approve prescriptions or sign clinical examination records.</li>
              <li>You must enter authentic registration credentials in your practice profile for inclusion on printed prescriptions and statutory invoices.</li>
            </ul>
          </div>
        </section>

        {/* Section 5 */}
        <section id="system-security" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            5. Platform Security &amp; Reverse Engineering
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Users agree not to:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li>Decompile, disassemble, reverse-engineer, or attempt to reconstruct source code, underlying algorithms, or proprietary data models of VetRx, except to the minimal extent expressly permitted by applicable law.</li>
            <li>Attempt to bypass tenant isolation boundaries to view or manipulate data belonging to any other veterinary clinic or practitioner.</li>
            <li>Alter, remove, or obscure any proprietary copyright, trademark, or intellectual property notices from software screens, receipts, or exported documentation.</li>
          </ul>
        </section>

        {/* Section 6 */}
        <section id="data-sanctity" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            6. Patient &amp; Client Data Sanctity
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Customers must handle pet owner personal information in compliance with the Digital Personal Data Protection Act, 2023. Prohibited actions include:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li>Exporting or extracting pet owner phone numbers, emails, or home addresses for resale to third-party commercial marketers or unconsented advertising brokers.</li>
            <li>Uploading non-clinical defamatory, abusive, obscene, or harassing content into animal history records or communication logs.</li>
            <li>Entering fraudulent case notes designed to assist in insurance fraud, illegal breeding documentation, or false certification of Schedule drugs.</li>
          </ul>
        </section>

        {/* Section 7 */}
        <section id="investigation" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            7. Monitoring &amp; Violation Investigation
          </h2>
          <p className="text-content-secondary leading-relaxed">
            VetRx reserves the right to monitor system health, API usage volumes, and operational audit logs to ensure compliance with this policy and preserve platform stability. When potential abuse is detected, VetRx may investigate account activities, review transaction patterns, and request credential verification from the practice administrator.
          </p>
        </section>

        {/* Section 8 */}
        <section id="consequences" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            8. Consequences &amp; Termination
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Failure to adhere to this Acceptable Use Policy constitutes a material breach of the Terms of Service. In response to verified violations, VetRx may take immediate action, including:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li>Issuing formal warnings to the practice administrator;</li>
            <li>Temporarily restricting API access or deactivating specific sub-user accounts;</li>
            <li>Suspending the practice workspace pending resolution of statutory registration inquiries;</li>
            <li>Permanently terminating the account without refund of prepaid subscription fees; and</li>
            <li>Reporting fraudulent or criminal behavior to statutory law enforcement and relevant State Veterinary Councils.</li>
          </ul>
        </section>

        {/* Section 9 */}
        <section id="reporting" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            9. Reporting Violations
          </h2>
          <p className="text-content-secondary leading-relaxed">
            If you become aware of any security vulnerability, abusive practice, or unauthorized usage of VetRx, please report it immediately:
          </p>
          <div className="p-4 rounded-xl border border-clinical-border bg-white text-sm space-y-2">
            <p className="font-semibold text-content-primary">VetRx Trust &amp; Safety Desk</p>
            <p className="text-content-secondary">
              Email:{' '}
              <a href="mailto:supportvetrx@gmail.com" className="text-teal font-medium hover:underline">
                supportvetrx@gmail.com
              </a>
            </p>
            <p className="text-xs text-content-muted">
              Reports containing technical vulnerability details will be reviewed expeditiously by our engineering team.
            </p>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
};
