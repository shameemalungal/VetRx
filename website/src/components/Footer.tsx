import React from 'react';
import { Link } from 'react-router-dom';
import { APP_LOGIN_URL } from './Navbar';
import { VetRxLogo } from './VetRxLogo';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-gradient-to-b from-[#06252A] via-[#072F35] to-[#041B1F] text-white border-t border-teal/30 pt-20 pb-12 relative overflow-hidden" data-purpose="site-footer">
      {/* Decorative ambient elements */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-teal/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-96 h-96 bg-aqua/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-14 border-b border-white/10">
          {/* Col 1: Brand */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="inline-flex items-center group focus:outline-none hover:opacity-95 transition-opacity" aria-label="VetRx Home">
              <VetRxLogo size={36} variant="white" />
            </Link>
            <p className="text-xs text-teal-100/70 leading-relaxed max-w-sm font-normal">
              VetRx is a software platform for veterinary professionals. Subscriptions provide access to practice-management features for the selected billing period.
            </p>
            <div className="text-xs font-mono text-aqua pt-1">
              Platform Gateway:{' '}
              <a
                href={APP_LOGIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white transition-colors"
              >
                app.vetrx.brightbase.in
              </a>
            </div>
            <div className="text-xs text-teal-100/75 pt-1 leading-relaxed">
              <span className="text-white font-medium">Praxivon Technologies Private Limited</span>, the business behind VetRx.
            </div>
            <div className="text-xs text-teal-100/60 font-mono">
              Melattur PO, Malappuram District, Kerala, India
            </div>
            <div className="text-xs text-teal-100/60 font-mono">
              Built in India. Designed around real veterinary practice.
            </div>
          </div>

          {/* Col 2: Product */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-mono uppercase font-bold text-aqua tracking-wider">Product</h4>
            <ul className="space-y-2.5 text-xs text-teal-100/75">
              <li><Link to="/features" className="hover:text-white transition-colors">Features</Link></li>
              <li><Link to="/pricing" className="hover:text-white transition-colors">Pricing &amp; Plans</Link></li>
              <li><Link to="/about" className="hover:text-white transition-colors">About VetRx</Link></li>
              <li><Link to="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Col 3: Resources & Support */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-mono uppercase font-bold text-aqua tracking-wider">Resources &amp; Support</h4>
            <ul className="space-y-2.5 text-xs text-teal-100/75">
              <li><a href="/#resources" className="hover:text-white transition-colors">Resources Hub</a></li>
              <li><Link to="/about" className="hover:text-white transition-colors">About VetRx</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact Support</Link></li>
              <li><Link to="/grievance" className="hover:text-white transition-colors">Grievance &amp; Redressal</Link></li>
              <li>
                <a
                  href={APP_LOGIN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors text-aqua font-semibold"
                >
                  Practitioner Login →
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Legal & Policies */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-mono uppercase font-bold text-aqua tracking-wider">Legal &amp; Statutory</h4>
            <ul className="space-y-2.5 text-xs text-teal-100/75">
              <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy (DPDP)</Link></li>
              <li><Link to="/refund-policy" className="hover:text-white transition-colors">Refund &amp; Cancellation</Link></li>
              <li><Link to="/cookie-policy" className="hover:text-white transition-colors">Cookie Policy</Link></li>
              <li><Link to="/acceptable-use" className="hover:text-white transition-colors">Acceptable Use Policy</Link></li>
              <li><Link to="/security" className="hover:text-white transition-colors">Security Architecture</Link></li>
              <li><Link to="/clinical-disclaimer" className="hover:text-white transition-colors">Clinical Disclaimer</Link></li>
              <li><Link to="/government-practice" className="hover:text-white transition-colors">Government / Permitted Practice</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Attribution */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-teal-100/60">
          <div>
            © Praxivon Technologies Private Limited. All rights reserved.
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/clinical-disclaimer" className="hover:text-white transition-colors">
              Clinical Disclaimer
            </Link>
            <span>•</span>
            <Link to="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <span>•</span>
            <a
              href={APP_LOGIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-aqua hover:underline"
            >
              Practitioner Console
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
