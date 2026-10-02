import React from 'react';

export const ResourcesSection: React.FC = () => {
  const resources = [
    {
      tag: 'Product Specs',
      title: 'Features Guide',
      desc: 'Explore everything VetRx can do—from formulary references to receptionist and doctor permissions.',
      linkText: 'Read Feature Breakdown →',
      linkHref: '#features',
      accent: 'from-teal/10 to-aqua/10 text-teal-dark border-teal/20',
      icon: '📋',
    },
    {
      tag: 'Clinical Workflow',
      title: 'Workflow Overview',
      desc: 'Step-by-step walkthrough of consultation intake, clinical note capture, prescription generation, and receipts.',
      linkText: 'Explore Workflow →',
      linkHref: '#workflow',
      accent: 'from-sky-blue/10 to-blue/10 text-sky-blue border-sky-blue/20',
      icon: '⚡',
    },
    {
      tag: 'Practice Guidance',
      title: 'Government Practice',
      desc: 'Operational guidance for veterinary officers undertaking permitted private-practice workflows in India.',
      linkText: 'Read Practice Guide →',
      linkHref: '/government-practice',
      accent: 'from-mint/20 to-teal/10 text-teal-dark border-mint/30',
      icon: '🏛️',
    },
    {
      tag: 'Help Desk',
      title: 'Help Centre & FAQ',
      desc: 'Answers to common questions regarding practice setup, multi-user accounts, pricing, and support channels.',
      linkText: 'Get Help & Support →',
      linkHref: '/faq',
      accent: 'from-violet/10 to-purple-500/10 text-violet border-violet/20',
      icon: '💡',
    },
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-[#F0F7F7] to-white relative overflow-hidden scroll-reveal" data-purpose="resources-section" id="resources">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200/60 text-teal-800 text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-teal animate-gentle-pulse" />
            Practitioner Knowledge Hub
          </div>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-content-primary mt-2 tracking-tight">
            Product guides, practice workflows &amp; FAQs
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {resources.map((r) => (
            <div
              key={r.title}
              className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200/80 hover:border-teal/40 shadow-subtle hover:shadow-card-lift transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1.5"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className={`text-[10px] font-mono uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-lg bg-gradient-to-r ${r.accent} border`}>
                    {r.tag}
                  </span>
                  <span className="text-xl opacity-80 group-hover:scale-110 transition-transform">{r.icon}</span>
                </div>
                <h3 className="font-heading font-extrabold text-lg text-content-primary mb-2 group-hover:text-teal transition-colors">
                  {r.title}
                </h3>
                <p className="text-xs text-content-secondary leading-relaxed font-normal">
                  {r.desc}
                </p>
              </div>
              <a
                href={r.linkHref}
                className="mt-6 text-xs font-heading font-extrabold text-teal hover:text-teal-dark inline-flex items-center gap-1 group-hover:translate-x-1 transition-all"
              >
                {r.linkText}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
