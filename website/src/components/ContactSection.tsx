import React from 'react';
import { APP_LOGIN_URL } from './Navbar';

export const ContactSection: React.FC = () => {
  return (
    <section className="py-28 bg-gradient-to-b from-[#F6FAFA] to-white relative overflow-hidden scroll-reveal" data-purpose="contact-section" id="contact">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200/60 text-teal-800 text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-teal animate-gentle-pulse" />
            Direct Practitioner Line
          </div>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-content-primary mt-2 tracking-tight">
            Have questions? Let&apos;s talk.
          </h2>
          <p className="text-base sm:text-lg text-content-secondary mt-3 leading-relaxed">
            We speak veterinary practice. Reach out directly to discuss your clinic&apos;s transition.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* WhatsApp CTA */}
          <div className="p-7 rounded-3xl bg-white border border-slate-200/90 shadow-subtle flex flex-col justify-between hover:shadow-card-lift hover:border-emerald-500/40 transition-all duration-300 group hover:-translate-y-1">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-600 border border-emerald-500/30 flex items-center justify-center font-bold mb-5 text-xl group-hover:scale-110 transition-transform shadow-2xs">
                💬
              </div>
              <h3 className="font-heading font-extrabold text-xl text-content-primary group-hover:text-emerald-700 transition-colors">
                WhatsApp Practitioner Desk
              </h3>
              <p className="text-xs text-content-secondary mt-2.5 leading-relaxed font-normal">
                Direct answers about pricing, plan switching, and printer configuration from our clinical support team.
              </p>
            </div>
            <a
              href="https://wa.me/919074683808"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 w-full py-3.5 px-4 rounded-xl text-center text-xs font-heading font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white transition-all shadow-sm hover:shadow-md"
            >
              Chat on WhatsApp: +91 90746 83808 →
            </a>
          </div>

          {/* Email Consultation */}
          <div className="p-7 rounded-3xl bg-white border border-slate-200/90 shadow-subtle flex flex-col justify-between hover:shadow-card-lift hover:border-teal/40 transition-all duration-300 group hover:-translate-y-1">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500/20 to-aqua/20 text-teal-dark border border-teal-500/30 flex items-center justify-center font-bold mb-5 text-xl group-hover:scale-110 transition-transform shadow-2xs">
                ✉️
              </div>
              <h3 className="font-heading font-extrabold text-xl text-content-primary group-hover:text-teal transition-colors">
                Email Support &amp; Onboarding
              </h3>
              <p className="text-xs text-content-secondary mt-2.5 leading-relaxed font-normal">
                Send us questions about data onboarding from your existing registry or request custom hospital configurations.
              </p>
            </div>
            <a
              href="mailto:supportvetrx@gmail.com"
              className="mt-7 w-full py-3.5 px-4 rounded-xl text-center text-xs font-heading font-bold bg-slate-50 text-content-primary hover:bg-slate-100 border border-slate-200 transition-all"
            >
              supportvetrx@gmail.com
            </a>
          </div>

          {/* Practitioner Console Direct Link */}
          <div className="p-7 rounded-3xl bg-white border border-slate-200/90 shadow-subtle flex flex-col justify-between hover:shadow-card-lift hover:border-sky-blue/40 transition-all duration-300 group hover:-translate-y-1">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-blue/20 to-blue/20 text-sky-blue border border-sky-blue/30 flex items-center justify-center font-bold mb-5 text-xl group-hover:scale-110 transition-transform shadow-2xs">
                🏥
              </div>
              <h3 className="font-heading font-extrabold text-xl text-content-primary group-hover:text-teal transition-colors">
                Existing Veterinarian Console
              </h3>
              <p className="text-xs text-content-secondary mt-2.5 leading-relaxed font-normal">
                Already registered your practice? Sign in directly to your live clinical prescription and patient management desk.
              </p>
            </div>
            <a
              href={APP_LOGIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 w-full py-3.5 px-4 rounded-xl text-center text-xs font-heading font-bold bg-gradient-to-r from-teal to-teal-dark hover:from-teal-dark hover:to-teal text-white transition-all shadow-clinical hover:shadow-hero-glow"
            >
              Login to Practice →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
