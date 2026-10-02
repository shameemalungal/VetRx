import React from 'react';

export const UseCases: React.FC = () => {
  const archetypes = [
    {
      num: '01 / Solo Care',
      title: 'Individual Veterinarians',
      desc: 'Solo private practitioners who need clean records and professional prescriptions without paying for bloated corporate software.',
      tag: 'Prescription speed • History recall',
      badgeColor: 'bg-teal text-white',
      cardBorder: 'border-teal/25 hover:border-teal',
      icon: '🩺',
    },
    {
      num: '02 / Field & Visits',
      title: 'Mobile & Home Practice',
      desc: 'Field veterinarians making doorstep house visits or farm livestock visits who require immediate responsive browser access.',
      tag: 'Mobile responsive • Instant sync',
      badgeColor: 'bg-sky-blue text-white',
      cardBorder: 'border-sky-blue/25 hover:border-sky-blue',
      icon: '🚗',
    },
    {
      num: '03 / Outpatient & Surgery',
      title: 'Private Veterinary Clinics',
      desc: 'Single-centre outpatient facilities handling vaccination, diagnostic testing, surgical consults, and dispensing every day.',
      tag: 'Treatment bundles • Direct billing',
      badgeColor: 'bg-aqua text-white',
      cardBorder: 'border-aqua/25 hover:border-aqua',
      icon: '🏥',
    },
    {
      num: '04 / Collaborative',
      title: 'Multi-Doctor Clinics',
      desc: 'Practices with 2 to 5 doctors sharing patient files, treatment updates, receptionist check-ins, and daily revenue ledgers.',
      tag: 'Shared clinical records • Staff roles',
      badgeColor: 'bg-violet text-white',
      cardBorder: 'border-violet/25 hover:border-violet',
      icon: '👥',
    },
    {
      num: '05 / High Throughput',
      title: 'Veterinary Hospitals',
      desc: 'Organized high-throughput facilities managing continuous patient streams, inpatient documentation, and multi-station workflows.',
      tag: 'Multi-station • Dedicated ledger',
      badgeColor: 'bg-electric-blue text-white',
      cardBorder: 'border-electric-blue/25 hover:border-electric-blue',
      icon: '🏢',
    },
    {
      num: '06 / Permitted Practice',
      title: 'Government Veterinarians',
      desc: 'Veterinarians providing permitted private-practice services who require clean personal clinical records separate from public files.',
      tag: 'Independent records • Fast workflows',
      badgeColor: 'bg-teal-deep text-white',
      cardBorder: 'border-mint/50 hover:border-teal',
      icon: '🏛️',
    },
  ];

  return (
    <section className="py-24 bg-white border-b border-clinical-border scroll-reveal relative" data-purpose="use-cases" id="use-cases">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-soft text-teal-deep text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <span>Tailored Solutions</span>
          </div>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-content-primary tracking-tight">
            Designed for every veterinary practice archetype
          </h2>
          <p className="text-base sm:text-lg text-content-secondary mt-3 leading-relaxed">
            Whether you practice as a solo mobile vet or run a multi-doctor hospital, VetRx scales to your consultation structure.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
          {archetypes.map((a) => (
            <div
              key={a.title}
              className={`p-7 rounded-3xl bg-surface-canvas border ${a.cardBorder} space-y-4 hover-lift-card flex flex-col justify-between transition-all group`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono font-extrabold text-teal-deep uppercase tracking-wider">
                    {a.num}
                  </span>
                  <div className="w-10 h-10 rounded-2xl bg-white border border-clinical-border shadow-xs flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                    {a.icon}
                  </div>
                </div>

                <h3 className="font-heading font-extrabold text-xl text-content-primary tracking-tight">
                  {a.title}
                </h3>

                <p className="text-sm text-content-secondary leading-relaxed mt-2 font-sans">
                  {a.desc}
                </p>
              </div>

              <div className="pt-4 border-t border-clinical-border/60">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-clinical-border text-xs font-mono font-semibold text-teal-deep shadow-xs">
                  <span>●</span> {a.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

