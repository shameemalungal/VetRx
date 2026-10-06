import React from 'react';
import { LegalLayout } from '../components/LegalLayout';

export const AboutPage: React.FC = () => {
  const toc = [
    { id: 'mission', title: '1. Our Mission' },
    { id: 'the-problem', title: '2. The Indian Veterinary Reality' },
    { id: 'clinical-origins', title: '3. Developed by Veterinary Doctors' },
    { id: 'design-philosophy', title: '4. Our Design Philosophy' },
    { id: 'built-in-india', title: '5. Built in India, for India' },
    { id: 'roadmap', title: '6. What We Stand For' },
  ];

  const relatedLinks = [
    {
      title: 'Veterinary Clinical Disclaimer',
      href: '/clinical-disclaimer',
      desc: 'Our fundamental stance on preserving practitioner clinical independence.',
    },
    {
      title: 'Subscription & Billing',
      href: '/billing',
      desc: 'Transparent, fair pricing structured for Indian clinics and solo practitioners.',
    },
    {
      title: 'Contact the Team',
      href: '/contact',
      desc: 'Connect directly with our team for questions, feedback, or suggestions.',
    },
  ];

  return (
    <LegalLayout
      title="About VetRx"
      subtitle="Built in India. Designed around real veterinary practice. VetRx is developed by veterinary doctors with 15+ years of clinical experience."
      badge="Our Story &amp; Mission"
      lastUpdated="September 24, 2026"
      toc={toc}
      relatedLinks={relatedLinks}
    >
      <div className="space-y-12">
        {/* Core Tagline Card */}
        <div className="p-8 rounded-3xl bg-gradient-to-br from-teal-soft via-surface-card to-white border-2 border-teal/20 text-content-primary shadow-sm space-y-4">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-teal-dark bg-white/80 px-3 py-1 rounded-full border border-teal/20">
            Core Purpose
          </span>
          <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-content-primary tracking-tight">
            &ldquo;Simplify your practice. Focus on better treatment.&rdquo;
          </h2>
          <p className="text-content-secondary leading-relaxed text-base">
            VetRx is a veterinary practice management platform built in India for veterinary practitioners and veterinary clinics. VetRx provides software tools for managing patients, owners, prescriptions, medicines, treatment records, invoices and day-to-day veterinary practice workflows. VetRx is operated by Alungal Shameem.
          </p>
        </div>

        {/* Section 1 */}
        <section id="mission" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            1. Our Mission
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Our mission is to elevate Indian veterinary practice management by equipping independent clinicians, small animal hospitals, mixed rural practices, and mobile veterinarians with fast, dependable, cloud-native tools that mirror the actual rhythm of clinical consultations.
          </p>
          <p className="text-content-secondary leading-relaxed">
            We reject the notion that software should force clinicians to endure dozens of redundant mouse clicks or complex enterprise menus during a live examination. Software must serve the clinician, not the other way around.
          </p>
        </section>

        {/* Section 2 */}
        <section id="the-problem" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            2. The Indian Veterinary Reality
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Veterinary practice in India possesses distinct operational dynamics that Western veterinary practice software completely fails to understand:
          </p>
          <div className="grid sm:grid-cols-2 gap-4 not-prose my-4">
            <div className="p-5 rounded-xl border border-clinical-border bg-white space-y-2">
              <h3 className="font-heading font-semibold text-content-primary text-base">Rapid Consultations</h3>
              <p className="text-sm text-content-secondary leading-relaxed">
                Outpatient queues in Indian clinics are fast-paced. A consultation note must be captured in seconds, not ten minutes of bureaucratic documentation.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-clinical-border bg-white space-y-2">
              <h3 className="font-heading font-semibold text-content-primary text-base">Mixed Practice Reality</h3>
              <p className="text-sm text-content-secondary leading-relaxed">
                Practitioners frequently treat companion pets in the morning, conduct bovine or equine field rounds in the afternoon, and handle mobile home visits in the evening.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-clinical-border bg-white space-y-2">
              <h3 className="font-heading font-semibold text-content-primary text-base">Clear Printed Prescriptions</h3>
              <p className="text-sm text-content-secondary leading-relaxed">
                Indian pharmacies and pet parents demand legible, branded prescription slips with statutory veterinary council registration numbers clearly stated.
              </p>
            </div>
            <div className="p-5 rounded-xl border border-clinical-border bg-white space-y-2">
              <h3 className="font-heading font-semibold text-content-primary text-base">Reasonable SaaS Pricing</h3>
              <p className="text-sm text-content-secondary leading-relaxed">
                Global veterinary suites charging tens of thousands of rupees monthly are economically unviable for the vast majority of Indian clinics and solo practitioners.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section id="clinical-origins" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            3. Developed by Veterinary Doctors
          </h2>
          <p className="text-content-secondary leading-relaxed">
            VetRx is developed by veterinary doctors with 15+ years of clinical experience. Built in India. Designed around real veterinary practice.
          </p>
          <div className="p-5 rounded-2xl border border-clinical-border bg-surface-canvas space-y-3">
            <h3 className="font-heading font-bold text-content-primary text-base">
              The Practitioner&apos;s Perspective
            </h3>
            <p className="text-sm text-content-secondary leading-relaxed">
              Every workflow in VetRx&mdash;from rapid drug auto-complete and weight-specific dose notes to the two-click prescription print format&mdash;stems from direct observations at the consultation table. We know what it feels like when an aggressive canine patient is on the table, a panicked owner is asking questions, and you need to document the treatment without delay.
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section id="design-philosophy" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            4. Our Design Philosophy
          </h2>
          <p className="text-content-secondary leading-relaxed">
            We adhere to strict product principles in every screen we engineer:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li><strong>Zero Clutter:</strong> If a button or menu doesn&apos;t contribute to clinical speed or statutory record clarity, it doesn&apos;t belong in our interface.</li>
            <li><strong>Practitioner Sovereignty:</strong> We never impose rigid artificial intelligence diagnosis or automated prescribing algorithms. The treating veterinary surgeon remains the absolute master of clinical decision-making.</li>
            <li><strong>Data Integrity:</strong> Patient medical histories, surgical logs, and treatment records are immutable clinical assets that belong exclusively to the treating clinic.</li>
            <li><strong>Responsive Anywhere:</strong> Works seamlessly on clinic desktop monitors, reception laptops, clinician tablets, and mobile smartphones in the field.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section id="built-in-india" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            5. Built in India, for India
          </h2>
          <p className="text-content-secondary leading-relaxed">
            We take pride in building software specifically engineered for the Indian regulatory and clinical landscape. From rupee-denominated billing and itemized tax invoice generation to adherence with the Digital Personal Data Protection Act, 2023, VetRx is crafted to serve the nationwide veterinary community.
          </p>
        </section>

        {/* Section 6 */}
        <section id="roadmap" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            6. What We Stand For
          </h2>
          <p className="text-content-secondary leading-relaxed">
            We measure our success not by inflated corporate vanity metrics, but by the hours saved each day in veterinary clinics across the country. When a veterinarian can complete an evening OPD session on time, with flawless records and zero documentation backlogs, VetRx has achieved its purpose.
          </p>
          <div className="pt-4">
            <a
              href="https://app.vetrx.brightbase.in/register"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-teal text-white font-heading font-semibold text-sm hover:bg-teal-dark transition-colors shadow-sm"
            >
              Start 14-Day Free Practice Trial &rarr;
            </a>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
};
