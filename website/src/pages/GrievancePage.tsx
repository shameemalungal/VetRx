import React from 'react';
import { LegalLayout } from '../components/LegalLayout';

export const GrievancePage: React.FC = () => {
  const toc = [
    { id: 'escalation-framework', title: '1. Support & Escalation Framework' },
    { id: 'contact-details', title: '2. Support & Escalation Desk' },
    { id: 'complaint-categories', title: '3. Categories of Concerns Handled' },
    { id: 'submission-process', title: '4. How to Submit an Inquiry or Escalation' },
    { id: 'dpdp-inquiries', title: '5. Privacy & Data Inquiries' },
  ];

  const relatedLinks = [
    {
      title: 'Privacy Policy',
      href: '/privacy',
      desc: 'Information handling practices and data privacy principles.',
    },
    {
      title: 'Terms of Service',
      href: '/terms',
      desc: 'Governing law, jurisdiction, and commercial terms.',
    },
    {
      title: 'Contact Desk',
      href: '/contact',
      desc: 'General product inquiries and direct operational support channels.',
    },
  ];

  return (
    <LegalLayout
      title="Support &amp; Grievance Escalation Desk"
      subtitle="Dedicated escalation channels for unresolved service inquiries, billing adjustments, and data privacy requests."
      badge="Support &amp; Escalation"
      lastUpdated="September 24, 2026"
      toc={toc}
      relatedLinks={relatedLinks}
    >
      <div className="space-y-12">
        {/* Intro */}
        <div className="p-5 rounded-xl bg-teal-soft/60 border border-teal/20 text-content-primary">
          <p className="font-heading font-semibold text-teal-dark mb-1">
            Commitment to Fair &amp; Transparent Escalation Handling
          </p>
          <p className="text-sm leading-relaxed text-content-secondary">
            VetRx is committed to providing prompt, fair, and documented resolution for customer inquiries, billing concerns, and service escalations across all veterinary practice accounts.
          </p>
        </div>

        {/* Section 1 */}
        <section id="escalation-framework" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            1. Support &amp; Escalation Framework
          </h2>
          <p className="text-content-secondary leading-relaxed">
            We provide a transparent escalation mechanism to resolve technical issues, account inquiries, billing discrepancies, or privacy questions. If an issue is not resolved through initial support channels, practitioners and account administrators can escalate their concerns through our dedicated escalation desk.
          </p>
        </section>

        {/* Section 2 */}
        <section id="contact-details" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            2. Support &amp; Escalation Desk
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Any user or practice experiencing service concerns or wishing to raise a formal escalation may reach our support desk via:
          </p>

          <div className="p-6 rounded-2xl border-2 border-clinical-border bg-white shadow-sm space-y-4 not-prose">
            <div className="flex items-center justify-between border-b border-clinical-border pb-3">
              <span className="font-heading font-bold text-lg text-content-primary">
                VetRx Support &amp; Escalation Desk
              </span>
              <span className="text-xs font-mono bg-teal-soft text-teal-dark px-2.5 py-0.5 rounded-full font-semibold">
                Direct Contact
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-mono text-content-muted uppercase">Business Identity</p>
                <p className="font-medium text-content-primary mt-0.5">
                  VetRx Support
                </p>
                <p className="text-content-muted text-xs mt-0.5">VetRx is operated by Alungal Shameem.</p>
              </div>

              <div>
                <p className="text-xs font-mono text-content-muted uppercase">Postal Address</p>
                <p className="font-medium text-content-primary mt-0.5">
                  Nasheman, Chemmaniyode PO, Malappuram DT, Kerala - 679325, India
                </p>
              </div>

              <div>
                <p className="text-xs font-mono text-content-muted uppercase">Support &amp; Escalation Email</p>
                <p className="font-medium text-content-primary mt-0.5">
                  <a href="mailto:supportvetrx@gmail.com" className="text-teal font-medium hover:underline">
                    supportvetrx@gmail.com
                  </a>
                </p>
              </div>

              <div>
                <p className="text-xs font-mono text-content-muted uppercase">WhatsApp Support</p>
                <p className="font-medium text-content-primary mt-0.5">
                  <a href="https://wa.me/919074683808" target="_blank" rel="noopener noreferrer" className="text-teal font-medium hover:underline">
                    +91 90746 83808
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section id="complaint-categories" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            3. Categories of Concerns Handled
          </h2>
          <p className="text-content-secondary leading-relaxed">
            The Support &amp; Escalation Desk handles communications across four primary categories:
          </p>
          <div className="grid sm:grid-cols-2 gap-4 not-prose my-4">
            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-1.5">
              <h3 className="font-heading font-semibold text-content-primary text-sm">Product &amp; Technical Support</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Platform performance, record management workflows, prescription template formatting, or account synchronization issues.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-1.5">
              <h3 className="font-heading font-semibold text-content-primary text-sm">Billing &amp; Subscription Inquiries</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Subscription activation, renewal questions, duplicate payment reconciliation, and invoice verification.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-1.5">
              <h3 className="font-heading font-semibold text-content-primary text-sm">Privacy &amp; Data Concerns</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Data export requests, account deletion inquiries, and privacy-related questions.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-1.5">
              <h3 className="font-heading font-semibold text-content-primary text-sm">Account Administration</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Practice team seat management, role permission updates, and account access recovery.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section id="submission-process" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            4. How to Submit an Inquiry or Escalation
          </h2>
          <p className="text-content-secondary leading-relaxed">
            To ensure prompt review and effective resolution, please submit your request in writing via email or WhatsApp and include:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-content-secondary text-sm">
            <li><strong>Practice Details:</strong> Practice name and registered account email address associated with your VetRx account.</li>
            <li><strong>Subject:</strong> A brief description of the issue or inquiry.</li>
            <li><strong>Details:</strong> Clear explanation of the matter, including relevant dates or transaction references if applicable.</li>
            <li><strong>Attachments:</strong> Any relevant screenshots or error logs that help our team diagnose the issue.</li>
          </ol>
        </section>

        {/* Section 5 */}
        <section id="dpdp-inquiries" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            5. Privacy &amp; Data Inquiries
          </h2>
          <p className="text-content-secondary leading-relaxed">
            For data protection inquiries or requests regarding personal information handled by VetRx, users can contact our support team at <a href="mailto:supportvetrx@gmail.com" className="text-teal font-medium hover:underline">supportvetrx@gmail.com</a>. We review and process data inquiries in accordance with applicable Indian privacy standards.
          </p>
        </section>
      </div>
    </LegalLayout>
  );
};
