import React from 'react';
import { APP_LOGIN_URL, APP_REGISTER_URL } from './Navbar';

export const Hero: React.FC = () => {
  return (
    <section className="relative pt-32 pb-24 lg:pt-36 lg:pb-36 overflow-hidden bg-tech-grid" data-purpose="hero-section">
      {/* Layered Gradient Ambient Glow Orbs */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[850px] h-[550px] glow-teal-large pointer-events-none -z-10 blur-3xl opacity-35"></div>
      <div className="absolute -top-20 left-10 w-96 h-96 glow-mint pointer-events-none -z-10 blur-3xl opacity-40"></div>
      <div className="absolute top-40 right-4 w-96 h-96 glow-violet-accent pointer-events-none -z-10 blur-3xl opacity-30"></div>

      {/* Decorative Subtle ECG & Orbital Motifs */}
      <div className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center opacity-25 overflow-hidden">
        <svg className="w-full max-w-7xl h-auto" fill="none" viewBox="0 0 1400 680">
          <defs>
            <linearGradient id="ecgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0D9186" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#19B8A5" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#356DFF" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <path
            d="M0 340 L 450 340 L 480 300 L 510 390 L 540 260 L 570 410 L 600 320 L 630 350 L 660 340 L 1400 340"
            stroke="url(#ecgGrad)"
            strokeWidth="1.8"
            strokeDasharray="4 4"
          />
          <circle cx="700" cy="340" r="240" stroke="#0D9186" strokeWidth="1" strokeOpacity="0.15" />
          <circle cx="700" cy="340" r="380" stroke="#19B8A5" strokeWidth="1" strokeDasharray="6 6" strokeOpacity="0.1" />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          {/* Eyebrow / Trust Indicator */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full glass-badge text-teal-deep text-xs font-semibold tracking-wide uppercase shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal"></span>
            </span>
            <span className="font-heading font-bold text-teal-deep">Veterinary Practice Management Platform</span>
          </div>

          {/* Headline - STRICTLY LOCKED */}
          <h1 className="font-heading font-extrabold text-4xl sm:text-5xl lg:text-6xl text-content-primary tracking-tight leading-[1.12]">
            Simplify your practice. <br />
            <span className="gradient-text-teal">Focus on better treatment.</span>
          </h1>

          {/* Subtitle - STRICTLY LOCKED */}
          <p className="text-lg sm:text-xl text-content-secondary leading-relaxed font-normal max-w-2xl mx-auto">
            VetRx brings patients, owners, prescriptions, clinical history, invoices and everyday practice management
            together in one veterinary-focused platform.
          </p>

          {/* Brand Origin Statement */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 border border-teal/20 text-xs font-mono font-medium text-content-secondary shadow-sm">
            <span>🇮🇳 Built in India. Designed around real veterinary practice.</span>
          </div>

          {/* CTA Action Cluster */}
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={APP_REGISTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-heading font-bold text-white gradient-teal-aqua hover:opacity-95 rounded-xl shadow-clinical hover:shadow-card-lift transition-all duration-200 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2"
            >
              <span>Start 14-Day Free Trial</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
            <a
              href="#walkthrough"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-4 text-base font-heading font-bold text-content-primary bg-white hover:bg-surface-subtle border border-clinical-border rounded-xl transition-all shadow-sm hover:shadow-subtle hover:border-teal/30"
            >
              <div className="w-6 h-6 rounded-full bg-teal-soft flex items-center justify-center text-teal-deep">
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                  <path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" fillRule="evenodd" />
                </svg>
              </div>
              <span>Watch 30-Second Tour</span>
            </a>
          </div>

          <p className="text-xs text-content-muted">
            Already using VetRx?{' '}
            <a
              href={APP_LOGIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-teal-deep underline hover:text-teal ml-1 transition-colors"
            >
              Login to your clinical console →
            </a>
          </p>

          <p className="text-xs text-content-secondary/80 max-w-xl mx-auto leading-relaxed pt-1">
            VetRx is a software platform for veterinary professionals. Subscriptions provide access to VetRx practice-management features for the selected billing period.
          </p>
        </div>

        {/* Hero Visual: Layered Product Composition with Floating Dashboard Cards */}
        <div className="mt-16 relative max-w-5xl mx-auto">
          {/* Main Interface Shell */}
          <div className="rounded-3xl border border-teal/20 bg-white shadow-hero-glow overflow-hidden">
            {/* Window Chrome Header Bar */}
            <div className="h-12 bg-surface-subtle border-b border-clinical-border px-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#FF5F56] border border-black/10"></span>
                <span className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-black/10"></span>
                <span className="w-3 h-3 rounded-full bg-[#27C93F] border border-black/10"></span>
                <div className="ml-3 hidden sm:flex items-center gap-2 px-3 py-1 rounded-md bg-white border border-clinical-border/60 text-[11px] font-mono text-content-muted">
                  <svg className="w-3 h-3 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>app.vetrx.brightbase.in/dashboard</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-50 text-clinical-success border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-clinical-success animate-gentle-pulse"></span>
                  <span>Station Active</span>
                </span>
                <div className="w-7 h-7 rounded-xl gradient-teal-aqua p-0.5 flex items-center justify-center text-[10px] font-bold text-white shadow-xs">
                  <span className="w-full h-full rounded-[9px] bg-teal-deep flex items-center justify-center font-mono">DR</span>
                </div>
              </div>
            </div>

            {/* Mockup Canvas Body */}
            <div className="p-5 sm:p-8 bg-[#F6FAFA] space-y-6">
              {/* Active Session Top Card */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-clinical-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-teal-deep uppercase tracking-wider font-bold">
                      Active Session • Dr. Practitioner (BVSc &amp; AH)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-teal-soft text-teal-deep font-bold">Live</span>
                  </div>
                  <h3 className="font-heading font-extrabold text-xl sm:text-2xl text-content-primary mt-1">New Clinical Prescription</h3>
                  <p className="text-xs sm:text-sm text-content-secondary mt-0.5">
                    Generate weight-calibrated dosing, multi-drug SIG instructions and synchronized invoice.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-4 py-2 gradient-teal-aqua text-white rounded-xl text-xs font-heading font-bold flex items-center gap-1.5 shadow-sm">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                    </svg>
                    <span>New Prescription</span>
                  </span>
                  <span className="px-3 py-2 bg-surface-subtle hover:bg-white text-content-primary rounded-xl text-xs font-semibold border border-clinical-border transition-colors">
                    + Patient
                  </span>
                  <span className="px-3 py-2 bg-surface-subtle hover:bg-white text-content-primary rounded-xl text-xs font-semibold border border-clinical-border transition-colors">
                    + Invoice
                  </span>
                </div>
              </div>

              {/* 4 Metric Cards with Rich Palette Borders */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                <div className="bg-white p-4 rounded-2xl border border-clinical-border shadow-xs hover:border-teal/40 transition-colors">
                  <div className="text-[11px] font-medium text-content-secondary">Today&apos;s Prescriptions</div>
                  <div className="text-2xl sm:text-3xl font-heading font-extrabold text-content-primary mt-1">15</div>
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] font-mono text-clinical-success font-medium">
                    <span>✓</span> 15 Issued today
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-clinical-border shadow-xs hover:border-sky-blue/40 transition-colors">
                  <div className="text-[11px] font-medium text-content-secondary">Total Patients</div>
                  <div className="text-2xl sm:text-3xl font-heading font-extrabold text-content-primary mt-1">842</div>
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] font-mono text-sky-blue font-medium">
                    <span>●</span> Active Registry
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-clinical-border shadow-xs hover:border-violet/40 transition-colors">
                  <div className="text-[11px] font-medium text-content-secondary">Treatment Packages</div>
                  <div className="text-2xl sm:text-3xl font-heading font-extrabold text-content-primary mt-1">9</div>
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] font-mono text-violet font-medium">
                    <span>⚡</span> Pre-calibrated
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-clinical-border shadow-xs hover:border-warm-accent/40 transition-colors">
                  <div className="text-[11px] font-medium text-content-secondary">Recent Invoices</div>
                  <div className="text-2xl sm:text-3xl font-heading font-extrabold text-content-primary mt-1">₹14,200</div>
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] font-mono text-clinical-success font-medium">
                    <span>₹</span> Direct Ledger
                  </div>
                </div>
              </div>

              {/* Patient Record Preview Row */}
              <div className="bg-white rounded-2xl border border-clinical-border p-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl gradient-teal-aqua p-0.5 shadow-xs">
                      <div className="w-full h-full rounded-[10px] bg-white flex items-center justify-center font-heading font-bold text-teal-deep text-xs">
                        BR
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-heading font-bold text-content-primary">
                        Bruno <span className="font-normal text-xs text-content-secondary">• Canine (Labrador) 24.0 kg</span>
                      </div>
                      <div className="text-xs font-mono text-content-muted mt-0.5">Owner: Ahmed Kumar • RX-2026-0987</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-emerald-50 text-clinical-success border border-emerald-200">
                      ✓ Issued
                    </span>
                    <span className="text-xs font-heading font-semibold text-teal-deep px-3 py-1.5 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal/20 transition-colors">
                      View Rx
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Floating Hero Cards (Layered SaaS Depth) */}
          {/* Card 1: Top-Left Floating Patient Card */}
          <div className="hidden sm:block absolute -top-6 -left-6 glass-panel-elevated rounded-2xl p-3.5 shadow-floating animate-calm-float border-teal/25 max-w-[240px]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal/20 flex items-center justify-center text-teal-deep text-base">
                🐾
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono tracking-wider text-teal-deep font-bold">New Patient</p>
                <p className="text-xs font-heading font-bold text-content-primary leading-tight">
                  Bruno <span className="text-content-secondary font-normal">(Labrador, 24 kg)</span>
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Top-Right Floating Prescription Card */}
          <div className="hidden sm:block absolute top-1/4 -right-8 glass-panel-elevated rounded-2xl p-3.5 shadow-floating animate-delayed-calm-float border-teal/25 max-w-[260px]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-clinical-success text-base">
                💊
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono tracking-wider text-clinical-success font-bold">Weight-Calibrated</p>
                <p className="text-xs font-heading font-bold text-content-primary leading-tight">
                  Amoxicillin 250mg <span className="text-clinical-success font-mono text-[10px] block">#RX-0892 Verified</span>
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Bottom-Left Treatment Protocol Card */}
          <div className="hidden sm:block absolute -bottom-6 left-8 glass-panel-elevated rounded-2xl p-3.5 shadow-floating animate-delayed-calm-float border-teal/25 max-w-[250px]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-soft border border-violet/20 flex items-center justify-center text-violet text-base">
                📋
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono tracking-wider text-violet font-bold">Treatment Bundle</p>
                <p className="text-xs font-heading font-bold text-content-primary leading-tight">
                  Canine Otitis Protocol Applied
                </p>
              </div>
            </div>
          </div>

          {/* Card 4: Bottom-Right Itemized Invoice Card */}
          <div className="hidden sm:block absolute -bottom-6 -right-6 glass-panel-elevated rounded-2xl p-3.5 shadow-floating animate-calm-float border-teal/25 max-w-[220px]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-warm-soft border border-warm-accent/30 flex items-center justify-center text-amber-700 font-mono font-bold text-sm">
                ₹
              </div>
              <div>
                <p className="text-[10px] uppercase font-mono tracking-wider text-content-muted font-bold">Itemized Receipt</p>
                <p className="text-xs font-heading font-bold text-content-primary leading-tight">
                  ₹1,600 <span className="text-clinical-success font-mono text-[10px] font-semibold">Generated</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

