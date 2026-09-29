import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { VetRxLogo } from './VetRxLogo';

export const APP_LOGIN_URL = 'https://app.vetrx.brightbase.in/login';
export const APP_REGISTER_URL = 'https://app.vetrx.brightbase.in/register';

export const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getSectionHref = (hash: string) => {
    return isHomePage ? hash : `/${hash}`;
  };

  return (
    <header
      id="site-header"
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        isScrolled
          ? 'glass-panel-elevated border-b border-teal/15 shadow-subtle'
          : 'bg-surface-canvas/80 backdrop-blur-md border-b border-clinical-border/40'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo & Brand Identity */}
          <Link
            to="/"
            aria-label="VetRx Home"
            className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-teal rounded-xl p-1 transition-transform hover:scale-[1.02]"
          >
            <VetRxLogo size={36} />
            <span className="hidden sm:inline-flex items-center text-[10px] uppercase font-mono tracking-widest text-teal-deep font-semibold bg-teal-soft/80 px-2 py-0.5 rounded-md border border-teal/20">
              Clinical OS
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-7 text-sm font-medium text-content-secondary">
            <a href={getSectionHref('#product')} className="hover:text-teal-deep hover:translate-y-[-1px] transition-all">Product</a>
            <a href={getSectionHref('#workflow')} className="hover:text-teal-deep hover:translate-y-[-1px] transition-all">Workflow</a>
            <a href={getSectionHref('#features')} className="hover:text-teal-deep hover:translate-y-[-1px] transition-all">Features</a>
            <a href={getSectionHref('#use-cases')} className="hover:text-teal-deep hover:translate-y-[-1px] transition-all">Use Cases</a>
            <a href={getSectionHref('#pricing')} className="hover:text-teal-deep hover:translate-y-[-1px] transition-all">Pricing</a>
            <Link to="/about" className="hover:text-teal-deep hover:translate-y-[-1px] transition-all">About</Link>
            <Link to="/contact" className="hover:text-teal-deep hover:translate-y-[-1px] transition-all">Contact</Link>
          </nav>

          {/* Right Action Items (Login + Primary CTA) */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href={APP_LOGIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="Login to your clinical workspace"
              className="text-sm font-semibold text-content-primary hover:text-teal-deep px-3 py-2 transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-teal rounded-lg hover:bg-teal-50"
            >
              <span>Login</span>
              <svg className="w-3.5 h-3.5 text-content-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <a
              href={APP_REGISTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white gradient-teal-aqua hover:opacity-95 rounded-xl shadow-clinical hover:shadow-card-lift transition-all duration-200 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2"
            >
              <span>Start Free Trial</span>
              <svg className="w-3.5 h-3.5 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <a
              href={APP_LOGIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-teal-deep px-3 py-1.5 rounded-lg border border-teal/20 bg-white"
            >
              Login
            </a>
            <button
              type="button"
              aria-label="Toggle Navigation Menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-white border border-clinical-border text-content-secondary hover:text-teal focus:outline-none focus:ring-2 focus:ring-teal"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden glass-panel border-b border-clinical-border px-5 pt-3 pb-6 space-y-3 animate-calm-float" style={{ animationDuration: '0.2s' }}>
          <nav className="flex flex-col space-y-1 text-sm font-medium text-content-secondary">
            <a
              href={getSectionHref('#product')}
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-lg hover:bg-teal-50 hover:text-teal-deep transition-colors"
            >
              Product
            </a>
            <a
              href={getSectionHref('#workflow')}
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-lg hover:bg-teal-50 hover:text-teal-deep transition-colors"
            >
              Workflow
            </a>
            <a
              href={getSectionHref('#features')}
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-lg hover:bg-teal-50 hover:text-teal-deep transition-colors"
            >
              Features
            </a>
            <a
              href={getSectionHref('#use-cases')}
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-lg hover:bg-teal-50 hover:text-teal-deep transition-colors"
            >
              Use Cases
            </a>
            <a
              href={getSectionHref('#pricing')}
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-lg hover:bg-teal-50 hover:text-teal-deep transition-colors"
            >
              Pricing
            </a>
            <Link
              to="/about"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-lg hover:bg-teal-50 hover:text-teal-deep transition-colors"
            >
              About
            </Link>
            <Link
              to="/contact"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-lg hover:bg-teal-50 hover:text-teal-deep transition-colors"
            >
              Contact
            </Link>
            <Link
              to="/faq"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-lg hover:bg-teal-50 hover:text-teal-deep transition-colors"
            >
              FAQ
            </Link>
          </nav>
          <div className="pt-3 border-t border-clinical-border flex flex-col gap-2">
            <a
              href={APP_REGISTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-center px-4 py-3 text-sm font-semibold text-white gradient-teal-aqua rounded-xl shadow-clinical"
            >
              Start 14-Day Free Trial
            </a>
          </div>
        </div>
      )}
    </header>
  );
};

