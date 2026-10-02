import React, { useEffect } from 'react';
import { Hero } from '../components/Hero';
import { ProductOverview } from '../components/ProductOverview';
import { CommandDeskShowcase } from '../components/CommandDeskShowcase';
import { WorkflowPipeline } from '../components/WorkflowPipeline';
import { CoreFeatures } from '../components/CoreFeatures';
import { UseCases } from '../components/UseCases';
import { GovernmentVetNotice } from '../components/GovernmentVetNotice';
import { BenefitsSection } from '../components/BenefitsSection';
import { WhyVetRx } from '../components/WhyVetRx';
import { PricingSection } from '../components/PricingSection';
import { WalkthroughSimulator } from '../components/WalkthroughSimulator';
import { ResourcesSection } from '../components/ResourcesSection';
import { FaqSection } from '../components/FaqSection';
import { AboutTrust } from '../components/AboutTrust';
import { ContactSection } from '../components/ContactSection';
import { FinalCta } from '../components/FinalCta';

export const HomePage: React.FC = () => {
  useEffect(() => {
    // Check if URL has a hash for section scrolling
    if (window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, []);

  return (
    <main>
      <Hero />
      <ProductOverview />
      <CommandDeskShowcase />
      <WorkflowPipeline />
      <CoreFeatures />
      <UseCases />
      <GovernmentVetNotice />
      <BenefitsSection />
      <WhyVetRx />
      <PricingSection />
      <WalkthroughSimulator />
      <ResourcesSection />
      <FaqSection />
      <AboutTrust />
      <ContactSection />
      <FinalCta />
    </main>
  );
};
