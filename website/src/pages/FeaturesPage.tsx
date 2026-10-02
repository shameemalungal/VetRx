import React from 'react';
import { CoreFeatures } from '../components/CoreFeatures';
import { WorkflowPipeline } from '../components/WorkflowPipeline';
import { CommandDeskShowcase } from '../components/CommandDeskShowcase';
import { UseCases } from '../components/UseCases';
import { Link } from 'react-router-dom';
import { APP_REGISTER_URL } from '../components/Navbar';

export const FeaturesPage: React.FC = () => {
  return (
    <main className="pt-24 min-h-screen bg-surface-canvas">
      {/* Page Header */}
      <section className="py-16 bg-gradient-to-b from-[#F0F7F7] to-surface-canvas border-b border-clinical-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-soft text-teal-deep text-xs font-mono font-bold uppercase tracking-wider">
            <span>Clinical Operating System</span>
          </div>
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-content-primary tracking-tight">
            Designed Around Real Veterinary Practice
          </h1>
          <p className="text-base sm:text-lg text-content-secondary max-w-2xl mx-auto leading-relaxed">
            Software for veterinary professionals. Manage patients, prescriptions, medicines, dose calculations, treatment packages, invoices, and practice administration in one place.
          </p>

          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <a
              href={APP_REGISTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-heading font-bold text-white gradient-teal-aqua hover:opacity-95 rounded-xl shadow-clinical hover:shadow-card-lift transition-all"
            >
              <span>Start 14-Day Free Trial</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
            <Link
              to="/pricing"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-heading font-bold text-content-primary bg-white hover:bg-slate-50 border border-clinical-border rounded-xl transition-all shadow-sm"
            >
              <span>View Pricing Plans</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Showcase Components */}
      <CommandDeskShowcase />
      <WorkflowPipeline />
      <CoreFeatures />
      <UseCases />

      {/* Bottom CTA & Notice */}
      <section className="py-16 bg-white border-t border-clinical-border text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-content-primary">
            Ready to simplify your veterinary practice?
          </h2>
          <p className="text-sm text-content-secondary max-w-xl mx-auto">
            Evaluate VetRx in your daily consultations with a 14-day free trial. Predictable pricing starting at ₹599/month.
          </p>
          <div className="flex justify-center gap-4">
            <a
              href={APP_REGISTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 text-sm font-heading font-bold text-white gradient-teal-aqua hover:opacity-95 rounded-xl shadow-clinical"
            >
              Start 14-Day Free Trial
            </a>
            <Link
              to="/contact"
              className="px-6 py-3 text-sm font-heading font-bold text-content-primary bg-surface-canvas hover:bg-slate-100 border border-clinical-border rounded-xl"
            >
              Contact Support
            </Link>
          </div>
          <p className="text-xs text-content-muted">
            VetRx is practice-management software. Subscriptions provide cloud access for the selected billing period.
          </p>
        </div>
      </section>
    </main>
  );
};
