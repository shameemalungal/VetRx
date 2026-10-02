import React, { useState } from 'react';

export const WorkflowPipeline: React.FC = () => {
  const [activeHoverStage, setActiveHoverStage] = useState<number | null>(null);

  const steps = [
    {
      num: '01',
      title: 'Owner',
      desc: 'Client contact, phone, location & records',
      accent: 'from-teal to-aqua',
      bgGlow: 'border-teal/30 hover:border-teal',
      badgeColor: 'bg-teal text-white',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      ),
    },
    {
      num: '02',
      title: 'Patient',
      desc: 'Species, breed, age, weight & ID chip',
      accent: 'from-aqua to-mint',
      bgGlow: 'border-aqua/30 hover:border-aqua',
      badgeColor: 'bg-aqua text-white',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      ),
    },
    {
      num: '03',
      title: 'Clinical History',
      desc: 'Vitals, symptoms, past visits & diagnosis',
      accent: 'from-sky-blue to-electric-blue',
      bgGlow: 'border-sky-blue/30 hover:border-sky-blue',
      badgeColor: 'bg-sky-blue text-white',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      ),
    },
    {
      num: '04',
      title: 'Prescription',
      desc: 'Weight-band dosage, duration & SIG',
      accent: 'from-electric-blue to-violet',
      bgGlow: 'border-electric-blue/30 hover:border-electric-blue',
      badgeColor: 'bg-electric-blue text-white',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      ),
    },
    {
      num: '05',
      title: 'Treatment',
      desc: 'Pre-calibrated bundles & procedures',
      accent: 'from-violet to-purple-600',
      bgGlow: 'border-violet/30 hover:border-violet',
      badgeColor: 'bg-violet text-white',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      ),
    },
    {
      num: '06',
      title: 'Invoice / Receipt',
      desc: 'Itemized billing & clean client handout',
      accent: 'from-amber-500 to-warm-accent',
      bgGlow: 'border-warm-accent/40 hover:border-warm-accent',
      badgeColor: 'bg-amber-600 text-white',
      icon: (
        <span className="font-mono font-bold text-base">₹</span>
      ),
    },
  ];

  return (
    <section className="py-24 bg-white border-b border-clinical-border scroll-reveal relative" data-purpose="workflow-section" id="workflow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-soft text-teal-deep text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <span>Connected Consultation Pipeline</span>
          </div>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-content-primary tracking-tight">
            Your workflow. <span className="gradient-text-teal">Simplified.</span>
          </h2>
          <p className="text-base sm:text-lg text-content-secondary mt-3 leading-relaxed">
            From the moment a patient arrives to the moment the visit is recorded, VetRx keeps the essential parts of your workflow connected.
          </p>
        </div>

        {/* Timeline Visualization: Responsive Grid with Connecting Line */}
        <div className="relative">
          {/* Desktop Connecting Illuminated Line */}
          <div className="hidden lg:block absolute top-[52px] left-[8%] right-[8%] h-[3px] bg-gradient-to-r from-teal via-electric-blue to-warm-accent -z-0 opacity-40 rounded-full"></div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5 relative z-10">
            {steps.map((s, idx) => {
              const isHovered = activeHoverStage === idx;
              return (
                <div
                  key={s.num}
                  onMouseEnter={() => setActiveHoverStage(idx)}
                  onMouseLeave={() => setActiveHoverStage(null)}
                  className={`relative bg-surface-canvas p-6 rounded-3xl border ${s.bgGlow} text-center flex flex-col items-center hover-lift-card transition-all group ${
                    isHovered ? 'shadow-card-lift bg-white' : 'shadow-xs'
                  }`}
                >
                  {/* Step Sequence Icon & Number */}
                  <div className={`w-14 h-14 rounded-2xl ${s.badgeColor} shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    {s.icon}
                  </div>

                  <span className="text-[11px] font-mono font-bold text-teal-deep tracking-wider mb-1 block">
                    STAGE {s.num}
                  </span>

                  <h3 className="font-heading font-extrabold text-base text-content-primary tracking-wide">
                    {s.title}
                  </h3>

                  <p className="text-xs text-content-secondary mt-2 leading-relaxed">
                    {s.desc}
                  </p>

                  <div className="mt-4 pt-3 border-t border-clinical-border/60 w-full flex items-center justify-center">
                    <span className="text-[10px] font-mono text-content-muted">Step {idx + 1} of 6</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

