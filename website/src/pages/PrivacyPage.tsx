import React from 'react';
import { LegalLayout } from '../components/LegalLayout';
import { Link } from 'react-router-dom';

export const PrivacyPage: React.FC = () => {
  const toc = [
    { id: 'introduction', title: '1. Introduction & Statutory Scope' },
    { id: 'data-distinction', title: '2. Distinction of Data Categories' },
    { id: 'personal-data-collected', title: '3. Personal Data We Collect' },
    { id: 'purposes-processing', title: '4. Purposes & Grounds for Processing' },
    { id: 'cookies-technical', title: '5. Cookies & Technical Logging' },
    { id: 'data-sharing', title: '6. Data Sharing & Infrastructure Disclosures' },
    { id: 'no-commercial-sale', title: '7. Non-Sale & No AI Model Training' },
    { id: 'security-retention', title: '8. Security Measures & Data Retention' },
    { id: 'data-principal-rights', title: '9. Rights of Data Principals' },
    { id: 'children-data', title: '10. Protection of Minors' },
    { id: 'grievance-officer', title: '11. Grievance Officer & Contact' },
    { id: 'updates', title: '12. Updates to this Policy' },
  ];

  const relatedLinks = [
    { title: 'Terms of Service', href: '/terms', desc: 'Commercial contract and platform terms.' },
    { title: 'Security Architecture', href: '/security', desc: 'Technical isolation, encryption, and session security.' },
    { title: 'Cookie Policy', href: '/cookie-policy', desc: 'HttpOnly session tokens and technical cookies.' },
  ];

  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="How VetRx collects, processes, and safeguards personal data in accordance with the Digital Personal Data Protection Act, 2023 (DPDP Act) and applicable Indian information technology regulations."
      badge="Data Protection &amp; Privacy"
      lastUpdated="September 24, 2026"
      toc={toc}
      relatedLinks={relatedLinks}
    >
      {/* Notice Banner */}
      <div className="p-4 rounded-xl bg-teal-soft/50 border border-teal/20 text-xs text-content-secondary space-y-1">
        <p className="font-bold text-teal-dark font-heading uppercase tracking-wider">
          DPDP Act 2023 Alignment Notice
        </p>
        <p>
          This Policy explains our data processing practices under the Digital Personal Data Protection Act, 2023 (DPDP Act) and applicable Indian information technology regulations.
        </p>
      </div>

      {/* Section 1 */}
      <section id="introduction" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          1. Introduction &amp; Statutory Scope
        </h2>
        <p>
          Praxivon Technologies Private Limited, the business behind VetRx (&ldquo;VetRx&rdquo;, &ldquo;We&rdquo;, &ldquo;Our&rdquo;, or &ldquo;Us&rdquo;), provides a veterinary practice management software platform to veterinary practitioners, clinics, and animal health organizations across India.
          This Privacy Policy sets out how personal data is collected, stored, processed, and protected when you visit our public website or utilize the VetRx platform hosted at <a href="https://vetrx.brightbase.in" target="_blank" rel="noopener noreferrer" className="text-teal-dark font-medium underline">vetrx.brightbase.in</a>.
        </p>
        <p>
          We are committed to processing personal digital data lawfully, transparently, and with strict security, in compliance with the Digital Personal Data Protection Act, 2023 (MeitY, Government of India) and the Information Technology Act, 2000.
        </p>
      </section>

      {/* Section 2 */}
      <section id="data-distinction" className="space-y-3 border-l-4 border-teal pl-4 bg-teal-soft/20 py-3 rounded-r-xl">
        <h2 className="font-heading font-bold text-xl text-teal-dark">
          2. Distinction of Data Categories
        </h2>
        <p className="text-content-primary font-semibold text-xs sm:text-sm">
          To ensure clarity and transparency, VetRx categorizes all data processed across six distinct operational classifications:
        </p>
        <div className="grid sm:grid-cols-2 gap-3 text-xs sm:text-sm not-prose my-2">
          <div className="p-3 bg-white rounded-lg border border-clinical-border">
            <strong className="text-content-primary block font-heading font-bold">1. Practitioner Account Data</strong>
            <p className="text-content-secondary mt-1 text-xs">
              Name, professional qualifications, veterinary council registration numbers, account email, phone number, and encrypted credentials.
            </p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-clinical-border">
            <strong className="text-content-primary block font-heading font-bold">2. Practice Configuration Data</strong>
            <p className="text-content-secondary mt-1 text-xs">
              Clinic name, clinic branding, custom letterheads, dispensing inventory lists, service rate cards, and team staff assignments.
            </p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-clinical-border">
            <strong className="text-content-primary block font-heading font-bold">3. Animal &amp; Patient Clinical Data</strong>
            <p className="text-content-secondary mt-1 text-xs">
              Species, breed, age, weight, clinical symptoms, examination records, diagnoses, and generated prescriptions.
            </p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-clinical-border">
            <strong className="text-content-primary block font-heading font-bold">4. Animal-Owner Contact &amp; Invoice Data</strong>
            <p className="text-content-secondary mt-1 text-xs">
              Animal-owner names, phone numbers, addresses, and itemized billing ledger entries entered by the clinic.
            </p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-clinical-border">
            <strong className="text-content-primary block font-heading font-bold">5. Subscription &amp; Transaction Metadata</strong>
            <p className="text-content-secondary mt-1 text-xs">
              Selected plan tier, renewal cycle dates, PayU transaction references, and generated electronic invoices.
            </p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-clinical-border">
            <strong className="text-content-primary block font-heading font-bold">6. Technical Logs &amp; Audit Trails</strong>
            <p className="text-content-secondary mt-1 text-xs">
              System access timestamps, IP addresses, session identifiers, and immutable audit logs of prescription approvals.
            </p>
          </div>
        </div>
        <p className="text-xs text-content-secondary">
          Animal patient and animal-owner records are entered and managed under the direct authority of the attending veterinary practice. VetRx processes this data solely to provide platform services under strict multi-tenant isolation.
        </p>
      </section>

      {/* Section 3 */}
      <section id="personal-data-collected" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          3. Personal Data Collection &amp; Authentication
        </h2>
        <p>We collect personal information through direct user entry and secure authentication methods:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
          <li><strong>Direct Registration:</strong> Information provided when setting up an account or configuring your clinic profile.</li>
          <li><strong>Google OAuth Single Sign-On:</strong> When you choose to authenticate via Google, VetRx receives basic profile information (name, email address, profile picture) solely for authentication and account creation. VetRx does not access Google Drive, Gmail, or your Google contacts.</li>
          <li><strong>Communications:</strong> We separate transactional service emails (e.g. account verification, password resets, billing receipts) from optional marketing announcements. Practitioners may opt out of marketing communications at any time.</li>
        </ul>
      </section>

      {/* Section 4 */}
      <section id="purposes-processing" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          4. Purposes &amp; Grounds for Processing
        </h2>
        <p>We process personal data for specified, legitimate purposes:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
          <li>To provision, authenticate, and maintain your clinical practice console and user sessions.</li>
          <li>To generate digital clinical prescriptions, treatment package histories, and INR tax invoices.</li>
          <li>To administer the multi-doctor prescription approval workflow and maintain an audit log of clinical approvals.</li>
          <li>To manage subscription entitlements, evaluate trial periods, and issue official billing receipts.</li>
          <li>To provide technical assistance, bug resolution, and onboarding support to veterinarians.</li>
          <li>To fulfill statutory compliance obligations under Indian law and orders of competent judicial authorities.</li>
        </ul>
      </section>

      {/* Section 5 */}
      <section id="cookies-technical" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          5. Cookies &amp; Technical Logging
        </h2>
        <p>
          VetRx uses strictly necessary authentication cookies (<code className="text-teal-dark font-mono bg-surface-canvas px-1 py-0.5 rounded">vetrx_session</code>).
          These cookies are configured with <code className="text-teal-dark font-mono bg-surface-canvas px-1 py-0.5 rounded">HttpOnly: true</code>, <code className="text-teal-dark font-mono bg-surface-canvas px-1 py-0.5 rounded">Secure: true</code>, and <code className="text-teal-dark font-mono bg-surface-canvas px-1 py-0.5 rounded">SameSite: lax</code> attributes to prevent cross-site script access.
        </p>
        <p>
          We do NOT deploy advertising tracking pixels, cross-site profiling trackers, or third-party behavioral ad cookies on our clinical platform.
          For complete specifics, review our dedicated <Link to="/cookie-policy" className="text-teal-dark font-medium underline">Cookie Policy</Link>.
        </p>
      </section>

      {/* Section 6 */}
      <section id="data-sharing" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          6. Data Sharing &amp; Infrastructure Disclosures
        </h2>
        <p>We only share data with verified infrastructure service providers who support our core operations under strict data protection covenants:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
          <li><strong>Cloud Infrastructure &amp; Database Hosting:</strong> Production application instances and PostgreSQL databases hosted on secure cloud infrastructure located in India with network-level container isolation.</li>
          <li><strong>Payment Processing:</strong> Domestic subscription transactions are processed by our authorized payment aggregator, PayU. Payment card and banking credentials are handled directly by the gateway.</li>
          <li><strong>Transactional Email Services:</strong> Automated system notifications and verification links delivered via transactional email APIs using encrypted endpoints.</li>
          <li><strong>Law Enforcement &amp; Legal Duty:</strong> We may disclose data if mandated by a formal warrant, court order, or binding directive issued by an Indian statutory body with competent legal jurisdiction.</li>
        </ul>
      </section>

      {/* Section 7 */}
      <section id="no-commercial-sale" className="space-y-3 border-l-4 border-emerald-500 pl-4 bg-emerald-50/30 py-3 rounded-r-xl">
        <h2 className="font-heading font-bold text-xl text-emerald-800">
          7. Strict Non-Sale &amp; No AI Training Commitment
        </h2>
        <p className="font-semibold text-content-primary">
          VetRx maintains an uncompromising commitment to clinical data privacy:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-content-secondary">
          <li>We do NOT sell, rent, monetize, or trade practice, client, animal-owner, or patient data to pharmaceutical companies, commercial brokers, or third-party advertisers.</li>
          <li>We do NOT feed customer clinical records, prescriptions, or patient details into public or external generative AI model training datasets.</li>
          <li>VetRx may generate de-identified, aggregated statistical insights to analyze platform usage trends, provided such data cannot reasonably identify any individual, practice, animal owner, or patient.</li>
        </ul>
      </section>

      {/* Section 8 */}
      <section id="security-retention" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          8. Security Measures &amp; Data Retention
        </h2>
        <p>
          We implement technical and organizational security controls designed to safeguard personal data against unauthorized disclosure, alteration, or loss.
          These include encrypted TLS transport (HTTPS with modern certificates), salted bcrypt password hashing, container-level PostgreSQL isolation,
          and practice-level multi-tenant database scoping. Detailed security controls are published on our <Link to="/security" className="text-teal-dark font-medium underline">Security Architecture Page</Link>.
        </p>
        <p>
          <strong>Retention:</strong> Personal data is retained as long as your practice account remains active. Upon subscription cancellation, your practice data is retained for 90 days, allowing users to export their clinical records or submit account deletion requests directly within the application. Following this 90-day retention period, data is scheduled for permanent deletion, subject to statutory tax and accounting retention requirements.
        </p>
      </section>

      {/* Section 9 */}
      <section id="data-principal-rights" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          9. Rights of Data Principals (DPDP Act, 2023)
        </h2>
        <p>Under the Digital Personal Data Protection Act, 2023, registered Data Principals in India possess the following statutory rights:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
          <li><strong>Right to Access:</strong> The right to obtain a summary of personal data being processed and the processing activities undertaken.</li>
          <li><strong>Right to Correction &amp; Erasure:</strong> The right to request correction of inaccurate or incomplete personal data, and the deletion of personal data no longer required for its lawful purpose.</li>
          <li><strong>Right of Grievance Redressal:</strong> The right to prompt redressal of grievances regarding the handling of your personal data through our support desk.</li>
          <li><strong>Right to Nominate:</strong> The right to nominate an individual to exercise your rights in the event of death or incapacity.</li>
        </ul>
        <p>
          To exercise any of these rights, please submit a written request to our team at <a href="mailto:supportvetrx@gmail.com" className="text-teal font-medium hover:underline">supportvetrx@gmail.com</a>.
        </p>
      </section>

      {/* Section 10 */}
      <section id="children-data" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          10. Protection of Minors
        </h2>
        <p>
          VetRx is a professional B2B/practitioner SaaS platform. We do not knowingly offer services to or collect personal data directly from children under the age of 18.
          Any animal owner contact information entered by a veterinarian must represent the adult guardian or responsible legal owner of the animal patient.
        </p>
      </section>

      {/* Section 11 */}
      <section id="grievance-officer" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          11. Support &amp; Privacy Contact
        </h2>
        <p>
          For privacy-related inquiries, data requests, or policy questions, please contact our team:
        </p>
        <div className="p-4 bg-surface-canvas rounded-xl border border-clinical-border font-mono text-xs space-y-1">
          <p><strong>Business Identity:</strong> Praxivon Technologies Private Limited</p>
          <p><strong>Postal Address:</strong> Melattur PO, Malappuram District, Kerala, India</p>
          <p><strong>Support &amp; Privacy Email:</strong> supportvetrx@gmail.com</p>
          <p><strong>WhatsApp Support:</strong> +91 90746 83808</p>
          <p><strong>Escalation Desk:</strong> <Link to="/grievance" className="text-teal-dark underline font-sans font-bold">Support &amp; Grievance Escalation Desk →</Link></p>
        </div>
      </section>

      {/* Section 12 */}
      <section id="updates" className="space-y-3">
        <h2 className="font-heading font-bold text-xl text-content-primary">
          12. Updates to this Policy
        </h2>
        <p>
          We may update this Privacy Policy from time to time to reflect operational modifications or statutory advancements in Indian privacy law.
          When material updates are enacted, we will update the &ldquo;Last updated&rdquo; timestamp and notify active practitioners via their dashboard or registered email.
        </p>
      </section>
    </LegalLayout>
  );
};
