import React from 'react';
import { LegalLayout } from '../components/LegalLayout';

export const SecurityPage: React.FC = () => {
  const toc = [
    { id: 'philosophy', title: '1. Security Philosophy & Architecture' },
    { id: 'encryption-transit', title: '2. Encryption in Transit (HTTPS / TLS)' },
    { id: 'auth-sessions', title: '3. Session Authentication & Token Security' },
    { id: 'tenant-isolation', title: '4. Multi-Tenant Data Isolation' },
    { id: 'rbac', title: '5. Role-Based Access Control (RBAC)' },
    { id: 'clinical-integrity', title: '6. Clinical Audit & Prescription Locking' },
    { id: 'db-infrastructure', title: '7. Database Architecture & Backups' },
    { id: 'transparency-limits', title: '8. Clear Boundaries & Disclaimers' },
    { id: 'vulnerability-reporting', title: '9. Responsible Vulnerability Disclosure' },
  ];

  const relatedLinks = [
    {
      title: 'Privacy Policy',
      href: '/privacy',
      desc: 'Legal commitments governing practitioner and pet owner personal data.',
    },
    {
      title: 'Cookie & Session Policy',
      href: '/cookie-policy',
      desc: 'Technical breakdown of HttpOnly session cookies and storage.',
    },
    {
      title: 'Acceptable Use Policy',
      href: '/acceptable-use',
      desc: 'Operational boundaries and prohibited activities on the platform.',
    },
  ];

  return (
    <LegalLayout
      title="Security & Data Protection"
      subtitle="A factual, uninflated overview of VetRx's architectural security measures, tenant isolation mechanisms, authentication safeguards, and clinical audit integrity."
      badge="Technical Architecture"
      lastUpdated="September 24, 2026"
      toc={toc}
      relatedLinks={relatedLinks}
    >
      <div className="space-y-12">
        {/* Intro */}
        <div className="p-5 rounded-xl bg-teal-soft/60 border border-teal/20 text-content-primary">
          <p className="font-heading font-semibold text-teal-dark mb-1">
            Engineered for Clinical Confidentiality
          </p>
          <p className="text-sm leading-relaxed text-content-secondary">
            Veterinary medical records, client contact details, and financial transactions represent sensitive practice assets. VetRx implements multi-layered architectural safeguards to protect your practice data against unauthorized access, corruption, or cross-tenant exposure.
          </p>
        </div>

        {/* Section 1 */}
        <section id="philosophy" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            1. Security Philosophy &amp; Architecture
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Our security model is built on verified architectural principles rather than marketing hyperbole. We prioritize defensive depth across three key tiers:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-content-secondary">
            <li><strong>Transport Security:</strong> Complete cryptographic encryption of all browser-to-server data traffic.</li>
            <li><strong>Application Defense:</strong> Strict role-based permissions, cryptographically random session tokens, and clinical mutation validation.</li>
            <li><strong>Data Partitioning:</strong> Relational multi-tenant isolation ensuring that practice records are mathematically partitioned by practice identifier.</li>
          </ol>
        </section>

        {/* Section 2 */}
        <section id="encryption-transit" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            2. Encryption in Transit (HTTPS / TLS)
          </h2>
          <p className="text-content-secondary leading-relaxed">
            All communications between your client device and the VetRx web platform occur exclusively over encrypted Transport Layer Security (TLS 1.2 / TLS 1.3).
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li>HTTP connections are automatically redirected to secure HTTPS endpoints.</li>
            <li>HTTP Strict Transport Security (HSTS) headers instruct modern browsers to disallow unencrypted fallback connections.</li>
            <li>SSL/TLS certificates are maintained with automated renewal cycles and high-grade cipher suites.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section id="auth-sessions" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            3. Session Authentication &amp; Token Security
          </h2>
          <p className="text-content-secondary leading-relaxed">
            VetRx implements secure session-based authentication engineered to prevent credential interception and cross-site scripting (XSS) token theft:
          </p>
          <div className="grid sm:grid-cols-2 gap-4 not-prose">
            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-2">
              <h3 className="font-heading font-semibold text-content-primary text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal"></span>
                HttpOnly Secure Cookies
              </h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Authentication session tokens are flagged as <code className="bg-surface-card border px-1 py-0.5 rounded font-mono">HttpOnly</code>, meaning they cannot be accessed or manipulated by JavaScript scripts executing in the browser.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-2">
              <h3 className="font-heading font-semibold text-content-primary text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal"></span>
                SameSite &amp; Secure Flags
              </h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Session cookies include <code className="bg-surface-card border px-1 py-0.5 rounded font-mono">Secure</code> and <code className="bg-surface-card border px-1 py-0.5 rounded font-mono">SameSite</code> directives, mitigating Cross-Site Request Forgery (CSRF) and unauthorized cross-domain transmission.
              </p>
            </div>
          </div>
          <p className="text-sm text-content-secondary leading-relaxed">
            Passwords are hashed using salted, computationally intensive hashing algorithms prior to persistent storage. VetRx personnel cannot view your plaintext password.
          </p>
        </section>

        {/* Section 4 */}
        <section id="tenant-isolation" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            4. Multi-Tenant Data Isolation
          </h2>
          <p className="text-content-secondary leading-relaxed">
            VetRx serves multiple veterinary clinics on a shared, scalable cloud infrastructure. Maintaining complete isolation between practice workspaces is foundational to our architecture:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li><strong>Mandatory Practice Scoping:</strong> Every patient, consultation record, prescription, diagnostic entry, and financial receipt is scoped to an individual practice identifier at the data layer.</li>
            <li><strong>Server-Enforced Authorization:</strong> Server middleware strictly verifies that the authenticated user possesses active membership in the target practice before fulfilling any read or write request.</li>
            <li><strong>Zero Cross-Tenant Leakage:</strong> A veterinarian or staff member from Clinic A cannot view, query, or modify records belonging to Clinic B under any circumstances.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section id="rbac" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            5. Role-Based Access Control (RBAC)
          </h2>
          <p className="text-content-secondary leading-relaxed">
            To prevent internal practice over-permissioning, VetRx enforces granular role-based permissions:
          </p>
          <div className="overflow-x-auto not-prose">
            <table className="w-full text-left text-sm border border-clinical-border rounded-xl overflow-hidden bg-white">
              <thead className="bg-surface-canvas border-b border-clinical-border text-content-primary font-heading font-semibold">
                <tr>
                  <th className="p-3">Role</th>
                  <th className="p-3">Clinical Authority</th>
                  <th className="p-3">Administrative / Financial Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clinical-border text-content-secondary text-xs">
                <tr>
                  <td className="p-3 font-semibold text-content-primary">Practice Owner / Admin</td>
                  <td className="p-3">Full Clinical Access</td>
                  <td className="p-3">Full Practice Settings, Team Invites, Billing &amp; Subscription</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-content-primary">Veterinarian</td>
                  <td className="p-3">Full Consultation, Diagnosis &amp; Prescription Approval</td>
                  <td className="p-3">View Patients, View Practice Schedule (No Billing Configuration)</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-content-primary">Receptionist</td>
                  <td className="p-3">Check-in, Appointments, Patient Demographics</td>
                  <td className="p-3">Generate Consultation Slips, Record Counter Payments</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-content-primary">Accountant</td>
                  <td className="p-3">No Clinical Authority</td>
                  <td className="p-3">Invoice Reports, Revenue Analytics, Expense Tracking</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 6 */}
        <section id="clinical-integrity" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            6. Clinical Audit &amp; Prescription Locking
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Prescriptions in veterinary medicine carry statutory legal weight. VetRx incorporates an explicit clinical approval workflow:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li>Prescriptions drafted by team members remain in a &ldquo;DRAFT&rdquo; state until reviewed and approved by a registered veterinary practitioner.</li>
            <li>Upon practitioner approval, the prescription receives a cryptographic audit entry recording the approving clinician&apos;s identity and timestamp.</li>
            <li>Approved clinical records are locked against arbitrary silent modification to preserve statutory medical-legal integrity.</li>
          </ul>
        </section>

        {/* Section 7 */}
        <section id="db-infrastructure" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            7. Database Architecture &amp; Backups
          </h2>
          <p className="text-content-secondary leading-relaxed">
            VetRx utilizes a production-grade relational PostgreSQL database deployed within dedicated containerized infrastructure hosted in India.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li>Data integrity is maintained using ACID transactions, strict relational foreign-key cascades, and index optimization.</li>
            <li>Automated periodic database snapshots and transaction log archives are retained to facilitate point-in-time disaster recovery.</li>
            <li>Direct database ports are firewalled and inaccessible from the public Internet.</li>
          </ul>
        </section>

        {/* Section 8 */}
        <section id="transparency-limits" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            8. Clear Boundaries &amp; Disclaimers
          </h2>
          <div className="p-5 rounded-xl border border-clinical-border bg-surface-canvas space-y-3">
            <h3 className="font-heading font-bold text-content-primary text-base">
              Transparent Security Disclosure
            </h3>
            <p className="text-sm text-content-secondary leading-relaxed">
              We believe in honest communication regarding system security. VetRx does not claim third-party certifications such as ISO 27001, SOC 2, HIPAA, or government regulatory guarantees that have not been independently audited.
            </p>
            <p className="text-sm text-content-secondary leading-relaxed">
              No digital computing system, Internet transmission, or electronic database can guarantee 100% absolute security or zero risk of breach. We commit to applying diligent engineering practices, rapid security patching, and transparent incident disclosure in the event of an adverse event.
            </p>
          </div>
        </section>

        {/* Section 9 */}
        <section id="vulnerability-reporting" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            9. Responsible Vulnerability Disclosure
          </h2>
          <p className="text-content-secondary leading-relaxed">
            We appreciate the contributions of cybersecurity researchers who responsibly report vulnerabilities. If you identify a security weakness in VetRx:
          </p>
          <div className="p-4 rounded-xl border border-clinical-border bg-white text-sm space-y-2">
            <p className="font-semibold text-content-primary">VetRx Responsible Disclosure Channel</p>
            <p className="text-content-secondary">
              Email:{' '}
              <a href="mailto:supportvetrx@gmail.com" className="text-teal font-medium hover:underline">
                supportvetrx@gmail.com
              </a>
            </p>
            <p className="text-xs text-content-muted leading-relaxed">
              Please include detailed reproduction steps, request logs, and proof-of-concept indicators. We review reports diligently and work expeditiously toward remediation.
            </p>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
};
