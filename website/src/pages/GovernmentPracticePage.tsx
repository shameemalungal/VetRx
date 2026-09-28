import React from 'react';
import { LegalLayout } from '../components/LegalLayout';

export const GovernmentPracticePage: React.FC = () => {
  const toc = [
    { id: 'statutory-notice', title: '1. Mandatory Regulatory Notice' },
    { id: 'context', title: '2. Understanding Permitted Private Practice' },
    { id: 'vetrx-role', title: '3. Designed for Permitted Workflows' },
    { id: 'separation-records', title: '4. Segregation of Clinical Records' },
    { id: 'rate-schedules', title: '5. Government Orders & Rate Schedules' },
    { id: 'non-authorization', title: '6. Explicit Non-Authorization Disclaimer' },
    { id: 'compliance-checklist', title: '7. Practitioner Compliance Responsibilities' },
  ];

  const relatedLinks = [
    {
      title: 'Veterinary Clinical Disclaimer',
      href: '/clinical-disclaimer',
      desc: 'Exclusive practitioner responsibility for clinical and diagnostic decisions.',
    },
    {
      title: 'Terms of Service',
      href: '/terms',
      desc: 'Master commercial agreement and regulatory compliance covenants.',
    },
    {
      title: 'Subscription & Billing Guide',
      href: '/billing',
      desc: 'Plan options tailored for individual mobile and field practice.',
    },
  ];

  return (
    <LegalLayout
      title="Government &amp; Permitted Private Practice"
      subtitle="Operational guidance for government veterinary officers and institutional veterinarians undertaking permitted private practice workflows under applicable state service rules."
      badge="Regulatory Context"
      lastUpdated="September 24, 2026"
      toc={toc}
      relatedLinks={relatedLinks}
    >
      <div className="space-y-12">
        {/* Prominent Statutory Notice - MANDATORY REQUIREMENT */}
        <section id="statutory-notice" className="scroll-mt-28">
          <div className="p-6 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-600 animate-pulse"></span>
              <h2 className="font-heading font-extrabold text-lg text-amber-900 tracking-tight">
                Mandatory Statutory Notice
              </h2>
            </div>
            <p className="text-base font-semibold leading-relaxed text-amber-950">
              &ldquo;Practitioners are responsible for complying with applicable service rules, permissions and government orders. VetRx does not provide legal or regulatory compliance guarantees.&rdquo;
            </p>
            <p className="text-xs text-amber-800 leading-relaxed">
              Use of the VetRx platform does not constitute statutory authorization to practice. Each veterinary officer must verify and maintain their own valid official departmental permissions.
            </p>
          </div>
        </section>

        {/* Section 2 */}
        <section id="context" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            2. Understanding Permitted Private Practice
          </h2>
          <p className="text-content-secondary leading-relaxed">
            In several Indian states and Union Territories, veterinarians employed in state Animal Husbandry departments, veterinary dispensaries, mobile veterinary units, or public institutions are permitted by specific statute, departmental notification, or Government Order (GO) to undertake private clinical practice outside designated official duty hours and outside hospital jurisdictions.
          </p>
          <p className="text-content-secondary leading-relaxed">
            Permitted private practice often encompasses mobile home visits, companion animal outpatient care, farm animal emergency consultations, and rural livestock advisory services.
          </p>
        </section>

        {/* Section 3 */}
        <section id="vetrx-role" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            3. Designed for Government-Approved Private-Practice Workflows
          </h2>
          <p className="text-content-secondary leading-relaxed">
            VetRx is designed for government-approved private-practice workflows where applicable service rules permit. The platform provides:
          </p>
          <div className="grid sm:grid-cols-2 gap-4 not-prose my-4">
            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-1.5">
              <h3 className="font-heading font-semibold text-content-primary text-sm">Mobile &amp; Field Accessibility</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Responsive mobile-first interface optimized for rapid case documentation during home visits, farm calls, and field emergency rounds.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-1.5">
              <h3 className="font-heading font-semibold text-content-primary text-sm">Private Practice Letterhead</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Dedicated prescription and invoice headers featuring the clinician&apos;s personal statutory council registration and private contact details.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-1.5">
              <h3 className="font-heading font-semibold text-content-primary text-sm">Owner Receipts &amp; Transparency</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Instant generation of transparent digital fee receipts for pet owners and farmers, mitigating financial ambiguity during private consultations.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-1.5">
              <h3 className="font-heading font-semibold text-content-primary text-sm">Historical Patient Timeline</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Structured chronological tracking of follow-up treatments, vaccinations, and surgical history across recurring private patients.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section id="separation-records" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            4. Segregation of Clinical Records
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Maintaining strict separation between official departmental resources and permitted private consultations is an essential legal and service-conduct requirement for government veterinary officers.
          </p>
          <div className="p-4 rounded-xl border border-clinical-border bg-surface-card space-y-2 text-sm text-content-secondary">
            <p className="font-semibold text-content-primary">Key Operational Boundaries:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>VetRx must only be used to record private clinical consultations conducted strictly outside official government duty hours.</li>
              <li>Official government institutional records, departmental medicine registers, and government dispensary drug stocks must not be commingled with private VetRx accounts.</li>
              <li>Official departmental letterheads or state emblems must never be uploaded as private clinic logos.</li>
            </ul>
          </div>
        </section>

        {/* Section 5 */}
        <section id="rate-schedules" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            5. Government Orders &amp; Rate Schedules
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Certain state governments specify maximum permissible consultation fees, mileage allowances, or procedure charges under specific private practice Government Orders.
          </p>
          <p className="text-content-secondary leading-relaxed">
            Where government-prescribed service rates are referenced or customized in your VetRx fee templates, please note that applicable rates, ceiling fees, and statutory rules may change over time. <strong>Users remain solely responsible for verifying and applying the current applicable Government Order in their jurisdiction.</strong>
          </p>
        </section>

        {/* Section 6 */}
        <section id="non-authorization" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            6. Explicit Non-Authorization Disclaimer
          </h2>
          <div className="p-5 rounded-xl border border-clinical-border bg-white space-y-3 text-content-secondary text-sm">
            <p className="leading-relaxed">
              <strong>VetRx does not authorize, license, or grant permission for private practice.</strong> Subscribing to or using VetRx does not validate or legitimize private clinical practice if the practitioner lacks valid authorization under their specific employment service rules.
            </p>
            <p className="leading-relaxed">
              VetRx disclaims any liability for disciplinary actions, audit objections, departmental inquiries, or service rule violations initiated against practitioners who fail to secure and maintain requisite statutory permissions.
            </p>
          </div>
        </section>

        {/* Section 7 */}
        <section id="compliance-checklist" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            7. Practitioner Compliance Responsibilities
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Government veterinary officers utilizing VetRx must ensure ongoing adherence to:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary text-sm">
            <li>State Government Service Conduct Rules governing private consultation and non-practicing allowance (NPA) regulations;</li>
            <li>Valid statutory registration with the Veterinary Council of India (VCI) or State Veterinary Council;</li>
            <li>Direct procurement of medicines through authorized commercial distributors for private practice without utilizing departmental institutional stores; and</li>
            <li>Filing of appropriate professional income tax returns declaring private practice earnings as mandated under Indian tax law.</li>
          </ul>
        </section>
      </div>
    </LegalLayout>
  );
};
