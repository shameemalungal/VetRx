import React, { useState } from 'react';
import { LegalLayout } from '../components/LegalLayout';
import { Link } from 'react-router-dom';

interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: React.ReactNode;
}

export const FaqPage: React.FC = () => {
  const [openId, setOpenId] = useState<string | null>('what-is-vetrx');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const faqs: FaqItem[] = [
    // Category 1: Product & Practice Scope
    {
      id: 'what-is-vetrx',
      category: 'Product & Scope',
      question: 'What is VetRx?',
      answer: (
        <p>
          VetRx is a cloud-based veterinary practice management platform built specifically for Indian veterinary practitioners. It provides end-to-end clinical workflow automation, including patient registration, digital consultation notes, statutory prescription generation, diagnostic history tracking, and client billing.
        </p>
      ),
    },
    {
      id: 'who-is-vetrx-for',
      category: 'Product & Scope',
      question: 'Who is VetRx for?',
      answer: (
        <p>
          VetRx is designed for licensed veterinary surgeons across India, including solo practitioners, companion animal outpatient clinics, multi-doctor animal hospitals, mobile field veterinarians, and government veterinary officers undertaking permitted private practice.
        </p>
      ),
    },
    {
      id: 'does-vetrx-provide-treatment',
      category: 'Product & Scope',
      question: 'Does VetRx provide veterinary treatment?',
      answer: (
        <p>
          No. VetRx is software used by veterinary professionals to manage their practice and clinical workflows. VetRx does not provide veterinary treatment, physical examinations, medical consultations, surgical care, or healthcare services of any kind.
        </p>
      ),
    },
    {
      id: 'does-vetrx-sell-medicines',
      category: 'Product & Scope',
      question: 'Does VetRx sell veterinary medicines?',
      answer: (
        <p>
          No. VetRx does not sell, dispense, distribute, market, or deliver veterinary medicines, pharmaceuticals, or medical equipment. VetRx is not an online pharmacy, medical distributor, or drug marketplace. The software provides an internal clinic tool for inventory recording and veterinary dosage calculation.
        </p>
      ),
    },
    {
      id: 'is-vetrx-telemedicine',
      category: 'Product & Scope',
      question: 'Is VetRx an online veterinary consultation service or telemedicine platform?',
      answer: (
        <p>
          No. VetRx is not an online veterinary consultation platform, telemedicine service, or healthcare provider. We do not connect animal owners with veterinarians for remote treatment or medical advice. VetRx is strictly internal cloud practice-management software used by registered veterinary practices for their own day-to-day operations.
        </p>
      ),
    },
    {
      id: 'is-it-only-for-pets',
      category: 'Product & Scope',
      question: 'Is VetRx only for pet practice?',
      answer: (
        <p>
          No. While VetRx excels in companion animal (canine, feline) practice, it fully supports mixed practice, including large animals (cattle, buffalo, sheep, goats), equine patients, avian species, and exotic pets, with species-specific medical history tracking.
        </p>
      ),
    },
    {
      id: 'can-mobile-vets-use-it',
      category: 'Product & Scope',
      question: 'Can mobile veterinarians use it?',
      answer: (
        <p>
          Yes. VetRx is engineered as a responsive web platform that functions smoothly on smartphones and tablets. Mobile veterinarians can register patients, record consultation notes, and generate PDF prescriptions or fee receipts right at the client&apos;s home or farm during field visits.
        </p>
      ),
    },
    {
      id: 'can-clinics-use-it',
      category: 'Product & Scope',
      question: 'Can clinics use it?',
      answer: (
        <p>
          Yes. The VetRx Clinic Plan is specifically tailored for veterinary clinics and multi-doctor hospitals. It features centralized patient records, unified inventory management, shared appointment queues, and granular staff roles.
        </p>
      ),
    },
    {
      id: 'how-many-vets-in-clinic',
      category: 'Product & Scope',
      question: 'How many veterinarians are included in the Clinic plan?',
      answer: (
        <p>
          The standard Clinic Plan includes access for up to five (5) licensed veterinary practitioners. Additionally, clinics can add dedicated non-veterinary staff accounts for front-desk receptionists and accountants at no additional charge. Multi-branch networks requiring more than 5 clinicians can opt for custom Enterprise arrangements.
        </p>
      ),
    },

    // Category 2: Pricing & Subscriptions
    {
      id: 'what-is-the-price',
      category: 'Pricing & Billing',
      question: 'What is the price of VetRx?',
      answer: (
        <div className="space-y-2">
          <p>
            VetRx offers transparent, affordable rupee pricing:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Individual Plan:</strong> ₹599/month (or ₹5,999/year) for solo practitioners.</li>
            <li><strong>Clinic Plan:</strong> ₹1,499/month (or ₹14,999/year) for clinics with up to 5 veterinarians plus receptionist and accountant seats.</li>
            <li><strong>Enterprise Plan:</strong> Custom pricing for larger hospitals and multi-branch networks.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'is-there-a-free-trial',
      category: 'Pricing & Billing',
      question: 'Is there a free trial?',
      answer: (
        <p>
          Yes. Every new practice enjoys a 14-day free trial with full feature access. No upfront credit card or advance payment is required to evaluate the software in your daily practice.
        </p>
      ),
    },
    {
      id: 'when-does-billing-start',
      category: 'Pricing & Billing',
      question: 'When does billing start?',
      answer: (
        <p>
          Billing initiates automatically at the conclusion of your 14-day free trial unless you cancel your plan beforehand. Our approved trial wording is: <em>&ldquo;14 days free. Your selected plan begins after the trial unless you cancel beforehand.&rdquo;</em>
        </p>
      ),
    },
    {
      id: 'can-i-cancel',
      category: 'Pricing & Billing',
      question: 'Can I cancel my subscription?',
      answer: (
        <p>
          Yes, at any time. There are no long-term lock-in contracts or early termination penalties. You can cancel directly within your practice settings. Your account remains active through the end of your current paid billing period.
        </p>
      ),
    },
    {
      id: 'does-vetrx-charge-per-prescription',
      category: 'Pricing & Billing',
      question: 'Does VetRx charge per prescription or per patient?',
      answer: (
        <p>
          No. VetRx subscriptions provide unlimited patient records and unlimited prescription generation during your active subscription period. There are no per-prescription, per-patient, or hidden transaction platform fees.
        </p>
      ),
    },
    {
      id: 'does-vetrx-handle-payments',
      category: 'Pricing & Billing',
      question: 'Does VetRx process veterinary patient payments or hold clinic funds?',
      answer: (
        <p>
          No. VetRx does not collect, process, or settle payments made by pet owners to veterinary practices. The invoicing module is an administrative tool that enables veterinarians to calculate, format, and print itemized bills and receipts for their own practice records. Pet owners pay the clinic directly. VetRx only charges subscription fees to the veterinary practice for software platform access.
        </p>
      ),
    },

    // Category 3: Clinical & Practice Workflows
    {
      id: 'can-invoices-be-created',
      category: 'Clinical Workflows',
      question: 'Can invoices be created for pet owners?',
      answer: (
        <p>
          Yes. VetRx allows clinics to generate itemized, professional invoices and payment receipts for clients. Invoices include consultation charges, procedure fees, dispensed drugs, and applicable taxes, ready to be printed or shared digitally with pet owners.
        </p>
      ),
    },
    {
      id: 'can-prescriptions-be-printed',
      category: 'Clinical Workflows',
      question: 'Can prescriptions be printed or shared?',
      answer: (
        <p>
          Yes. VetRx generates clean, professional prescription slips featuring your clinic letterhead, practitioner qualifications, statutory council registration number, and clear dosage instructions. Prescriptions can be printed instantly or saved as PDF documents.
        </p>
      ),
    },
    {
      id: 'is-patient-history-supported',
      category: 'Clinical Workflows',
      question: 'Is complete patient history supported?',
      answer: (
        <p>
          Yes. Every patient record contains a chronological timeline of past consultations, clinical symptoms, physical examination findings, administered medications, vaccination dates, diagnostic tests, and surgical procedures across all previous visits.
        </p>
      ),
    },
    {
      id: 'are-treatment-packages-supported',
      category: 'Clinical Workflows',
      question: 'Are treatment packages supported?',
      answer: (
        <p>
          Yes. Clinics can configure customizable treatment bundles, standardized vaccination protocols, and surgical fee templates to accelerate entry during consultations and ensure consistent billing.
        </p>
      ),
    },

    // Category 4: Clinical & Legal Boundaries
    {
      id: 'does-vetrx-provide-diagnosis',
      category: 'Clinical Boundaries',
      question: 'Does VetRx provide diagnosis?',
      answer: (
        <p>
          No. VetRx is practice management software, not a diagnostic medical device or autonomous AI. The software does not analyze symptoms to produce autonomous diagnoses. Definitive clinical diagnosis remains the responsibility of the attending registered veterinary practitioner.
        </p>
      ),
    },
    {
      id: 'does-vetrx-provide-automatic-prescribing',
      category: 'Clinical Boundaries',
      question: 'Does VetRx provide automatic prescribing?',
      answer: (
        <p>
          No. VetRx does not diagnose disease, independently prescribe treatment, or calculate medication dosages without veterinarian supervision. It does not replace physical examination or professional veterinary judgment. The treating veterinarian remains responsible for clinical assessment, diagnosis, prescription, dosage decisions and treatment.
        </p>
      ),
    },
    {
      id: 'can-government-vets-use-vetrx',
      category: 'Clinical Boundaries',
      question: 'Can government veterinarians use VetRx?',
      answer: (
        <p>
          Yes, for permitted private-practice workflows. As stated in our regulatory guidance: <em>&ldquo;Practitioners are responsible for complying with applicable service rules, permissions and government orders. VetRx does not provide legal or regulatory compliance guarantees.&rdquo;</em> VetRx helps maintain neat records of permitted private consultations outside duty hours.
        </p>
      ),
    },
    {
      id: 'does-vetrx-replace-judgment',
      category: 'Clinical Boundaries',
      question: 'Does VetRx replace professional veterinary judgment?',
      answer: (
        <p>
          Under no circumstances. VetRx is an administrative record-keeping tool. Professional judgment, physical clinical assessment, therapeutic decisions, and surgical care remain under the purview of the treating veterinarian.
        </p>
      ),
    },

    // Category 5: Data Security & Support
    {
      id: 'is-my-data-secure',
      category: 'Security & Privacy',
      question: 'Is my practice data secure?',
      answer: (
        <p>
          Yes. VetRx employs modern technical defenses, including Transport Layer Security (HTTPS/TLS) encryption for all traffic, cryptographically secure HttpOnly session authentication, strict database-level multi-tenant isolation, role-based access control, and automated database backups.
        </p>
      ),
    },
    {
      id: 'does-vetrx-sell-customer-data',
      category: 'Security & Privacy',
      question: 'Does VetRx sell customer or patient data?',
      answer: (
        <p>
          Never. VetRx does not sell, rent, monetize, or trade practitioner information, client contacts, or patient medical records to third-party data brokers, pharmaceutical marketers, or advertisers. Your clinical data belongs to your practice.
        </p>
      ),
    },
    {
      id: 'how-do-i-contact-support',
      category: 'Security & Privacy',
      question: 'How do I contact support?',
      answer: (
        <p>
          You can reach our practitioner support team via email at <a href="mailto:supportvetrx@gmail.com" className="text-teal font-medium hover:underline">supportvetrx@gmail.com</a> or message us on WhatsApp at <a href="https://wa.me/919074683808" target="_blank" rel="noopener noreferrer" className="text-teal font-medium hover:underline">+91 90746 83808</a>.
        </p>
      ),
    },
  ];

  const categories = ['All', 'Product & Scope', 'Pricing & Billing', 'Clinical Workflows', 'Clinical Boundaries', 'Security & Privacy'];

  const filteredFaqs = selectedCategory === 'All' 
    ? faqs 
    : faqs.filter((item) => item.category === selectedCategory);

  const toc = categories.filter((c) => c !== 'All').map((cat) => ({
    id: cat.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: cat,
  }));

  const relatedLinks = [
    {
      title: 'Subscription & Billing Guide',
      href: '/billing',
      desc: 'Transparent pricing, plans, renewal mechanics, and tax invoices.',
    },
    {
      title: 'Veterinary Clinical Disclaimer',
      href: '/clinical-disclaimer',
      desc: 'Clear legal boundaries regarding diagnosis and prescribing.',
    },
    {
      title: 'Privacy Policy',
      href: '/privacy',
      desc: 'Data protection standards aligned with India’s DPDP Act, 2023.',
    },
  ];

  return (
    <LegalLayout
      title="Frequently Asked Questions"
      subtitle="Detailed, factual answers regarding VetRx functionality, subscription pricing, clinical workflows, data privacy, and statutory boundaries."
      badge="Knowledge Base"
      lastUpdated="September 24, 2026"
      toc={toc}
      relatedLinks={relatedLinks}
    >
      <div className="space-y-10">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-2 not-prose">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-heading font-semibold transition-all ${
                selectedCategory === cat
                  ? 'bg-teal text-white shadow-sm'
                  : 'bg-white border border-clinical-border text-content-secondary hover:text-content-primary hover:border-teal/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3 not-prose">
          {filteredFaqs.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div
                key={faq.id}
                id={faq.id}
                className="border border-clinical-border rounded-xl bg-white overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  className="w-full text-left p-5 flex items-center justify-between gap-4 hover:bg-surface-canvas/50 transition-colors"
                >
                  <span className="font-heading font-semibold text-base text-content-primary">
                    {faq.question}
                  </span>
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-transform ${
                      isOpen
                        ? 'rotate-180 bg-teal text-white border-teal'
                        : 'bg-surface-canvas text-content-muted border-clinical-border'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-content-secondary text-sm leading-relaxed border-t border-clinical-border/50 bg-surface-canvas/20">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom CTA Card */}
        <div className="p-6 rounded-2xl border border-clinical-border bg-gradient-to-r from-teal-soft/80 to-surface-card flex flex-col sm:flex-row items-center justify-between gap-4 not-prose">
          <div>
            <h3 className="font-heading font-bold text-lg text-content-primary">
              Have another question not answered here?
            </h3>
            <p className="text-sm text-content-secondary mt-1">
              Our practitioner support desk is ready to answer any clinical or technical queries.
            </p>
          </div>
          <Link
            to="/contact"
            className="shrink-0 px-5 py-2.5 rounded-xl bg-teal text-white font-heading font-semibold text-sm hover:bg-teal-dark transition-colors shadow-sm"
          >
            Contact Support &rarr;
          </Link>
        </div>
      </div>
    </LegalLayout>
  );
};
