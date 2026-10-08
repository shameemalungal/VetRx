import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';

// Pages
import { HomePage } from './pages/HomePage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { RefundPolicyPage } from './pages/RefundPolicyPage';
import { CookiePolicyPage } from './pages/CookiePolicyPage';
import { AcceptableUsePage } from './pages/AcceptableUsePage';
import { BillingPage } from './pages/BillingPage';
import { SecurityPage } from './pages/SecurityPage';
import { ClinicalDisclaimerPage } from './pages/ClinicalDisclaimerPage';
import { GovernmentPracticePage } from './pages/GovernmentPracticePage';
import { GrievancePage } from './pages/GrievancePage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { FaqPage } from './pages/FaqPage';
import { PricingPage } from './pages/PricingPage';
import { FeaturesPage } from './pages/FeaturesPage';

// Scroll to top or target hash on route changes
const ScrollManager: React.FC = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const timer = setTimeout(() => {
        const el = document.querySelector(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 50);
      return () => clearTimeout(timer);
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return null;
};

export const AppContent: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Respect prefers-reduced-motion for scroll reveal
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      document.querySelectorAll('.scroll-reveal').forEach((el) => {
        el.classList.add('is-visible');
      });
      return;
    }

    let observer: IntersectionObserver | null = null;

    const revealElements = () => {
      const reveals = document.querySelectorAll('.scroll-reveal');
      if (reveals.length === 0) return;

      if (!('IntersectionObserver' in window)) {
        reveals.forEach((el) => el.classList.add('is-visible'));
        return;
      }

      if (!observer) {
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer?.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.05, rootMargin: '50px 0px 50px 0px' }
        );
      }

      reveals.forEach((el) => {
        if (el.classList.contains('is-visible')) return;

        // If element is already within the visible viewport or scrolled past, reveal immediately
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > -50) {
          el.classList.add('is-visible');
        } else {
          observer?.observe(el);
        }
      });
    };

    // Run on route mount, next paint, and fallback safety timers
    revealElements();
    const rafId = requestAnimationFrame(revealElements);
    const timer1 = setTimeout(revealElements, 80);
    const timer2 = setTimeout(revealElements, 300);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer1);
      clearTimeout(timer2);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [pathname]);

  return (
    <div className="min-h-screen bg-surface-canvas text-content-primary selection:bg-teal-100 selection:text-teal-dark overflow-x-hidden flex flex-col justify-between">
      <ScrollManager />
      {/* 1. Header / Navigation */}
      <Navbar />

      {/* 2. Routed Content */}
      <div className="flex-grow">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/refund-policy" element={<RefundPolicyPage />} />
          <Route path="/cookie-policy" element={<CookiePolicyPage />} />
          <Route path="/acceptable-use" element={<AcceptableUsePage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/clinical-disclaimer" element={<ClinicalDisclaimerPage />} />
          <Route path="/government-practice" element={<GovernmentPracticePage />} />
          <Route path="/grievance" element={<GrievancePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          {/* Catch-all fallback */}
          <Route path="*" element={<HomePage />} />
        </Routes>
      </div>

      {/* 3. Site Footer */}
      <Footer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
