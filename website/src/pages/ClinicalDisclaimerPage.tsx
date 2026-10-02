import React from 'react';
import { LegalLayout } from '../components/LegalLayout';

export const ClinicalDisclaimerPage: React.FC = () => {
  const toc = [
    { id: 'fundamental-nature', title: '1. Software Nature & Definition' },
    { id: 'what-vetrx-does-not-do', title: '2. What VetRx Does NOT Do' },
    { id: 'practitioner-responsibility', title: '3. Exclusive Responsibilities of the Veterinarian' },
    { id: 'dosages-and-formulations', title: '4. Dosages, Formulations & Drug Interactions' },
    { id: 'emergency-and-critical-care', title: '5. Emergency, Triage & Referral Decisions' },
    { id: 'statutory-framework', title: '6. Indian Statutory & Regulatory Framework' },
    { id: 'limitation-of-clinical-liability', title: '7. Limitation of Clinical Liability' },
    { id: 'acknowledgment', title: '8. Mandatory User Acknowledgment' },
  ];

  const relatedLinks = [
    {
      title: 'Terms of Service',
      href: '/terms',
      desc: 'Master commercial agreement and general disclaimers.',
    },
    {
      title: 'Government Practice',
      href: '/government-practice',
      desc: 'Information regarding permitted private practice workflows in India.',
    },
    {
      title: 'Acceptable Use Policy',
      href: '/acceptable-use',
      desc: 'Mandatory statutory veterinary registration requirements.',
    },
  ];

  return (
    <LegalLayout
      title="Veterinary & Clinical Disclaimer"
      subtitle="Critical professional boundaries, statutory role definitions, and practitioner responsibilities governing clinical use of the VetRx practice management software."
      badge="Clinical Disclaimer"
      lastUpdated="September 24, 2026"
      toc={toc}
      relatedLinks={relatedLinks}
    >
      <div className="space-y-12">
        {/* Prominent Callout */}
        <div className="p-6 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-600 animate-pulse"></span>
            <h2 className="font-heading font-extrabold text-lg text-amber-900 tracking-tight">
              Fundamental Clinical Statement
            </h2>
          </div>
          <p className="text-sm font-medium leading-relaxed">
            VetRx does not diagnose disease, independently prescribe treatment, or calculate medication dosages without veterinarian supervision. It does not replace physical examination or professional veterinary judgment.
          </p>
          <p className="text-sm font-medium leading-relaxed">
            The treating veterinarian remains responsible for clinical assessment, diagnosis, prescription, dosage decisions and treatment.
          </p>
        </div>

        {/* Section 1 */}
        <section id="fundamental-nature" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            1. Software Nature &amp; Definition
          </h2>
          <p className="text-content-secondary leading-relaxed">
            VetRx is an administrative, organizational, and electronic case management tool designed specifically for veterinary hospitals, outpatient clinics, companion animal practitioners, and mobile veterinary professionals across India.
          </p>
          <p className="text-content-secondary leading-relaxed">
            The software serves as a digital record-keeper, schedule coordinator, and documentation assistant. It facilitates the drafting and printing of veterinary prescriptions, animal owner receipts, and historical case summaries. It is an administrative instrument utilized by veterinarians, not an autonomous medical device or diagnostic authority.
          </p>
        </section>

        {/* Section 2 */}
        <section id="what-vetrx-does-not-do" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            2. What VetRx Does NOT Do
          </h2>
          <p className="text-content-secondary leading-relaxed">
            To prevent any misunderstanding by practitioners, animal owners, or administrative authorities, VetRx explicitly affirms that the platform DOES NOT:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li><strong>Autonomously diagnose:</strong> The system does not analyze symptoms, lab findings, or clinical signs to generate automated veterinary diagnoses.</li>
            <li><strong>Replace physical examination:</strong> Software records cannot substitute for physical observation, auscultation, palpation, temperature measurement, or diagnostic laboratory testing of an animal.</li>
            <li><strong>Independently prescribe medicines:</strong> The system does not issue automated prescriptions or make autonomous pharmaceutical recommendations.</li>
            <li><strong>Guarantee therapeutic outcomes:</strong> Clinical response depends on biological factors, disease progression, owner compliance, and medical circumstances beyond any software system.</li>
            <li><strong>Supersede clinical judgment:</strong> Software templates and historical dosage notes exist solely as practitioner-curated aids and must never override individual clinical assessment.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section id="practitioner-responsibility" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            3. Responsibilities of the Treating Veterinarian
          </h2>
          <p className="text-content-secondary leading-relaxed">
            The treating veterinarian remains responsible for clinical assessment, diagnosis, prescription, dosage decisions and treatment, including but not limited to:
          </p>
          <div className="grid sm:grid-cols-2 gap-4 not-prose my-4">
            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-1.5">
              <h3 className="font-heading font-semibold text-content-primary text-sm">Diagnosis &amp; Staging</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Determining differential and definitive diagnoses based on direct physical examination and diagnostic evaluation.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-1.5">
              <h3 className="font-heading font-semibold text-content-primary text-sm">Drug &amp; Regimen Selection</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Selecting appropriate therapeutic molecules, commercial formulations, routes of administration, and treatment durations.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-1.5">
              <h3 className="font-heading font-semibold text-content-primary text-sm">Dosage Calculation</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Calculating exact milligram and volumetric dosages based on species, breed, age, weight, organ function, and patient condition.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-1.5">
              <h3 className="font-heading font-semibold text-content-primary text-sm">Contraindications &amp; Interactions</h3>
              <p className="text-xs text-content-secondary leading-relaxed">
                Verifying drug-drug interactions, pre-existing organ compromises, known breed sensitivities, and off-label precautions.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section id="dosages-and-formulations" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            4. Dosages, Formulations &amp; Drug Interactions
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Any drug names, strengths, packaging details, or dosage instructions stored in your clinic inventory or personal prescription library represent user-entered data or customizable presets configured by your clinic.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li>Practitioners must independently verify drug concentrations and manufacturers&apos; statutory package inserts before administering or dispensing medication.</li>
            <li>VetRx makes no representation or warranty regarding the pharmacological accuracy, bioavailability, safety, or regulatory approval status of any medicinal product entered by users.</li>
            <li>Off-label and extra-label use of human pharmaceutical preparations must strictly comply with veterinary medical ethics and statutory guidelines.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section id="emergency-and-critical-care" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            5. Emergency, Triage &amp; Referral Decisions
          </h2>
          <p className="text-content-secondary leading-relaxed">
            VetRx is not an emergency response dispatch system or intensive care monitor. In life-threatening emergencies (e.g., gastric dilatation-volvulus, severe trauma, pyometra, acute anaphylaxis, or urethral obstruction), clinicians must immediately execute stabilization, critical resuscitation, or specialist surgical referral without relying on software workflows.
          </p>
        </section>

        {/* Section 6 */}
        <section id="statutory-framework" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            6. Indian Statutory &amp; Regulatory Framework
          </h2>
          <p className="text-content-secondary leading-relaxed">
            The issuance of veterinary prescriptions in India is regulated under:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary text-sm">
            <li>The Indian Veterinary Council Act, 1984, and State Veterinary Council Codes of Professional Conduct.</li>
            <li>The Drugs and Cosmetics Act, 1940, and Drugs and Cosmetics Rules, 1945 (including Schedule H and Schedule X regulations for veterinary use).</li>
            <li>The Prevention of Cruelty to Animals Act, 1960.</li>
          </ul>
          <p className="text-content-secondary leading-relaxed text-sm">
            VetRx provides formatting tools to display the clinician&apos;s statutory council registration number, qualifications, and clinic address on printed prescriptions. The clinician remains responsible for ensuring that all issued documents comply with prevailing central and state medical jurisprudence.
          </p>
        </section>

        {/* Section 7 */}
        <section id="limitation-of-clinical-liability" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            7. Limitation of Clinical Liability
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Under no circumstances shall VetRx, its operators, directors, employees, or hosting providers be held liable for any clinical malpractice, diagnostic error, misinterpretation, adverse drug reaction, animal injury, therapeutic failure, morbidity, or mortality arising from veterinary care administered by users of the platform.
          </p>
        </section>

        {/* Section 8 */}
        <section id="acknowledgment" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            8. Mandatory User Acknowledgment
          </h2>
          <p className="text-content-secondary leading-relaxed">
            By creating an account, approving prescriptions, or maintaining clinical records in VetRx, you acknowledge that you have read, understood, and agreed to this Veterinary &amp; Clinical Disclaimer in its entirety.
          </p>
        </section>
      </div>
    </LegalLayout>
  );
};
