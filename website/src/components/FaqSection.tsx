import React, { useState } from 'react';

interface FaqItem {
  q: string;
  a: string;
}

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0); // First item open for preview

  const faqs: FaqItem[] = [
    {
      q: 'What is VetRx?',
      a: 'VetRx is a veterinary practice management software platform. It connects patient signalment, clinical history, weight-calibrated drug dosages, multi-drug SIG instructions, treatment packages, and itemized practice billing into one unified software console.',
    },
    {
      q: 'Does VetRx provide veterinary treatment or sell medicines?',
      a: 'No. VetRx is software used by veterinary professionals to manage their own clinical workflows. VetRx does not provide veterinary medical treatment, diagnostic services, online consultations, nor does it sell, dispense, or broker medicines or medical supplies.',
    },
    {
      q: 'Who is VetRx designed for?',
      a: 'VetRx is built for veterinary practitioners across private practice, mobile/doorstep services, outpatient surgical clinics, collaborative multi-doctor clinics, and government veterinarians operating permitted private-practice consults.',
    },
    {
      q: 'Does VetRx process payments from pet owners?',
      a: 'No. Pet owners pay the veterinary clinic directly. VetRx provides invoicing and receipt printing tools for the clinic, but does not collect or process patient consultation payments. Subscriptions are solely for clinic access to the software.',
    },
    {
      q: 'Can an individual veterinarian use VetRx?',
      a: 'Yes, perfectly. Our INDIVIDUAL plan (₹599/mo or ₹5,999/yr) is tailor-made for solo practitioners. You receive full access to unlimited patients, prescriptions, history records, and receipts with zero limitations.',
    },
    {
      q: 'Can multiple veterinarians use VetRx in the same clinic?',
      a: 'Yes. The CLINIC plan supports up to 5 veterinarians working simultaneously under the same clinic registry, sharing patient files and treatment notes while keeping prescription author signatures distinct.',
    },
    {
      q: 'Does VetRx support receptionists and accountants?',
      a: 'Yes. In our CLINIC tier, you can configure role-based access for front-desk receptionists (to check-in patients and register owners) and finance staff (to print invoices and manage revenue reports) without giving them clinical prescription edit rights.',
    },
    {
      q: 'Is there a limit on patients or prescriptions?',
      a: 'No. All plans include unlimited patients, unlimited electronic prescriptions, and unlimited treatment records.',
    },
    {
      q: 'How long is the free trial and what happens after 14 days?',
      a: '14 days free. Your selected plan begins after the trial unless you cancel beforehand.',
    },
    {
      q: 'Can I use VetRx for private practice?',
      a: 'Yes, VetRx is specially tailored for private practice workflows. You can personalize your clinic letterhead, registration numbers, qualification stamps, fee schedules, and receipt headers.',
    },
    {
      q: 'Is VetRx available outside Kerala?',
      a: 'Yes. While founded in Kerala, VetRx is available and active for veterinarians across all Indian states and union territories. The drug database and dosage protocols conform to standard Indian veterinary medicine formulations.',
    },
    {
      q: 'How does VetRx handle practice data?',
      a: 'Each clinic repository is logically isolated with rigorous multi-tenant data boundaries. Your records belong exclusively to your practice. We do not sell or share patient, client, or financial information under any circumstances.',
    },
  ];

  const toggleFaq = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="py-28 bg-gradient-to-b from-white via-[#F6FAFA] to-white relative overflow-hidden scroll-reveal" data-purpose="faq-accordion" id="faq">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200/60 text-teal-800 text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-teal animate-gentle-pulse" />
            Frequently Answered
          </div>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-content-primary mt-2 tracking-tight">
            Questions from fellow veterinary practitioners
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={faq.q}
                className={`rounded-2xl transition-all duration-300 overflow-hidden ${
                  isOpen
                    ? 'bg-white border-2 border-teal/40 shadow-card-lift'
                    : 'bg-white/80 backdrop-blur-sm border border-slate-200/80 hover:border-teal/30 hover:bg-white shadow-2xs'
                }`}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between text-content-primary font-heading font-extrabold text-base sm:text-lg hover:text-teal focus:outline-none transition-colors"
                >
                  <span className="pr-4 leading-snug">{faq.q}</span>
                  <span
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono text-lg transition-all duration-300 shrink-0 ${
                      isOpen
                        ? 'bg-teal text-white rotate-45 shadow-xs'
                        : 'bg-teal-50 text-teal rotate-0'
                    }`}
                  >
                    +
                  </span>
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-sm text-content-secondary leading-relaxed border-t border-slate-100 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
