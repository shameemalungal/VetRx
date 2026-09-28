import React from 'react';
import { LegalLayout } from '../components/LegalLayout';
import { Link } from 'react-router-dom';

export const CookiePolicyPage: React.FC = () => {
  const toc = [
    { id: 'introduction', title: '1. Introduction & Scope' },
    { id: 'what-are-cookies', title: '2. What Are Cookies & Session Tokens?' },
    { id: 'cookies-we-use', title: '3. Technical Categories of Cookies We Use' },
    { id: 'what-we-do-not-use', title: '4. What We Do NOT Use' },
    { id: 'first-party-audit', title: '5. Specific Cookie & Storage Inventory' },
    { id: 'managing-cookies', title: '6. Managing & Disabling Cookies' },
    { id: 'privacy-relationship', title: '7. Relationship to Privacy Policy' },
    { id: 'contact', title: '8. Questions & Contact' },
  ];

  const relatedLinks = [
    {
      title: 'Privacy Policy',
      href: '/privacy',
      desc: 'How VetRx protects practitioner and practice-entered clinical data.',
    },
    {
      title: 'Security Architecture',
      href: '/security',
      desc: 'Technical implementation of HTTPS and HttpOnly session cookies.',
    },
    {
      title: 'Terms of Service',
      href: '/terms',
      desc: 'Master commercial agreement and platform licensing rules.',
    },
  ];

  return (
    <LegalLayout
      title="Cookie & Session Policy"
      subtitle="Transparent technical explanation of how VetRx utilizes session cookies and local storage exclusively for authentication, security, and interface functionality."
      badge="Technical Transparency"
      lastUpdated="September 24, 2026"
      toc={toc}
      relatedLinks={relatedLinks}
    >
      <div className="space-y-12">
        {/* Intro Highlight */}
        <div className="p-5 rounded-xl bg-teal-soft/60 border border-teal/20 text-content-primary">
          <p className="font-heading font-semibold text-teal-dark mb-1">
            Zero Advertising Trackers Commitment
          </p>
          <p className="text-sm leading-relaxed text-content-secondary">
            VetRx is clinical practice management software. We do not host third-party advertising, we do not deploy commercial retargeting beacons or tracking pixels, and we never monetize user browsing habits.
          </p>
        </div>

        {/* Section 1 */}
        <section id="introduction" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            1. Introduction &amp; Scope
          </h2>
          <p className="text-content-secondary leading-relaxed">
            This Cookie &amp; Session Policy explains how VetRx (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) utilizes cookies, session tokens, and similar web storage mechanisms when you interact with our public website and our secure veterinary practice web application (<code className="text-xs bg-surface-card border px-1.5 py-0.5 rounded font-mono">vetrx.brightbase.in</code>).
          </p>
          <p className="text-content-secondary leading-relaxed">
            We believe in data minimization. In our clinical application, cookies and local storage tokens are employed strictly to maintain authenticated user sessions, prevent forgery attacks, and persist your interface preferences across page reloads.
          </p>
        </section>

        {/* Section 2 */}
        <section id="what-are-cookies" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            2. What Are Cookies &amp; Session Tokens?
          </h2>
          <p className="text-content-secondary leading-relaxed">
            A cookie is a small text file transmitted by a web server and stored in your web browser. When you navigate across different pages or return to the application, your browser presents these credentials to verify your authorized identity.
          </p>
          <p className="text-content-secondary leading-relaxed">
            Modern web applications also utilize browser <code className="text-xs bg-surface-card border px-1.5 py-0.5 rounded font-mono">localStorage</code> or <code className="text-xs bg-surface-card border px-1.5 py-0.5 rounded font-mono">sessionStorage</code> to preserve client-side workspace states without continuously querying the backend database.
          </p>
        </section>

        {/* Section 3 */}
        <section id="cookies-we-use" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            3. Technical Categories of Cookies We Use
          </h2>
          <div className="space-y-4 text-content-secondary">
            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-2">
              <h3 className="font-heading font-semibold text-content-primary flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal"></span>
                Strictly Necessary / Essential Authentication Cookies
              </h3>
              <p className="text-sm leading-relaxed">
                These cookies are indispensable for the operation of the VetRx clinical web application. They verify your session after you log in, authorize requests to practice clinical APIs, and maintain your clinic partition. Disabling these cookies prevents you from logging in or using the software.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-2">
              <h3 className="font-heading font-semibold text-content-primary flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal"></span>
                Security &amp; CSRF Protection
              </h3>
              <p className="text-sm leading-relaxed">
                We utilize tokens designed to thwart Cross-Site Request Forgery (CSRF) and replay attacks, ensuring that state-altering commands (such as approving a prescription or generating a billing invoice) originate intentionally from your active browser session.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-clinical-border bg-white space-y-2">
              <h3 className="font-heading font-semibold text-content-primary flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal"></span>
                Functional &amp; Interface Preference Storage
              </h3>
              <p className="text-sm leading-relaxed">
                We store non-sensitive interface states, such as whether your navigation sidebar is expanded or collapsed, recently selected print layout formats, or active filter toggles, ensuring an efficient workflow during consultations.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section id="what-we-do-not-use" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            4. What We Do NOT Use
          </h2>
          <p className="text-content-secondary leading-relaxed">
            To prevent ambiguity, VetRx explicitly affirms:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary">
            <li><strong>No Behavioral Advertising:</strong> We do not deploy ad-network cookies (e.g., Google AdSense, Meta Pixel, TikTok, or commercial behavioral trackers).</li>
            <li><strong>No Cross-Site Surveillance:</strong> We do not track your activity across websites you visit before or after accessing VetRx.</li>
            <li><strong>No Data Brokering:</strong> We do not sell, rent, or trade cookie identifiers to third-party data aggregators.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section id="first-party-audit" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            5. Specific Cookie &amp; Storage Inventory
          </h2>
          <p className="text-content-secondary leading-relaxed">
            The table below outlines the primary cookies and client storage entities used across VetRx domains:
          </p>
          <div className="overflow-x-auto not-prose">
            <table className="w-full text-left text-sm border border-clinical-border rounded-xl overflow-hidden bg-white">
              <thead className="bg-surface-canvas border-b border-clinical-border text-content-primary font-heading font-semibold">
                <tr>
                  <th className="p-3">Identifier</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Purpose</th>
                  <th className="p-3">Lifespan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clinical-border text-content-secondary font-mono text-xs">
                <tr>
                  <td className="p-3 font-semibold text-content-primary">vetrx_session</td>
                  <td className="p-3">Essential / Auth</td>
                  <td className="p-3 font-sans">Cryptographically signed session identifier for user authentication. Marked HttpOnly, Secure.</td>
                  <td className="p-3">Session / 7 Days</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-content-primary">XSRF-TOKEN</td>
                  <td className="p-3">Security</td>
                  <td className="p-3 font-sans">Protects against Cross-Site Request Forgery attacks on clinical and billing API mutations.</td>
                  <td className="p-3">Session</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-content-primary">vetrx_ui_prefs</td>
                  <td className="p-3">Functional (Local)</td>
                  <td className="p-3 font-sans">Stores practitioner UI settings (e.g., sidebar collapsed state, active tab memory).</td>
                  <td className="p-3">Persistent</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 6 */}
        <section id="managing-cookies" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            6. Managing &amp; Disabling Cookies
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Most web browsers automatically accept cookies by default. You can inspect, modify, or block cookies through your browser settings:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-content-secondary text-sm">
            <li><strong>Google Chrome:</strong> Settings &rarr; Privacy and security &rarr; Third-party cookies.</li>
            <li><strong>Mozilla Firefox:</strong> Settings &rarr; Privacy &amp; Security &rarr; Cookies and Site Data.</li>
            <li><strong>Apple Safari:</strong> Settings &rarr; Safari &rarr; Advanced &rarr; Privacy.</li>
            <li><strong>Microsoft Edge:</strong> Settings &rarr; Cookies and site permissions &rarr; Manage and delete cookies.</li>
          </ul>
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
            <strong>Important Technical Note:</strong> Because our session cookie is strictly necessary for authenticated clinical operation, blocking all cookies in your browser will prevent you from signing in to the VetRx clinical application.
          </div>
        </section>

        {/* Section 7 */}
        <section id="privacy-relationship" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            7. Relationship to Privacy Policy
          </h2>
          <p className="text-content-secondary leading-relaxed">
            Any personal data collected through technical session identifiers is governed by our comprehensive{' '}
            <Link to="/privacy" className="text-teal font-medium hover:underline">
              Privacy Policy
            </Link>
            . We recommend reviewing the Privacy Policy for complete details on our data protection commitments under Indian law.
          </p>
        </section>

        {/* Section 8 */}
        <section id="contact" className="scroll-mt-28 space-y-4">
          <h2 className="font-heading font-bold text-2xl text-content-primary border-b border-clinical-border pb-2">
            8. Questions &amp; Contact
          </h2>
          <p className="text-content-secondary leading-relaxed">
            If you have technical questions regarding our cookie practices, please contact our engineering team:
          </p>
          <div className="p-4 rounded-xl border border-clinical-border bg-white text-sm space-y-1">
            <p className="font-semibold text-content-primary">VetRx Technical Inquiries</p>
            <p className="text-content-secondary">
              Email:{' '}
              <a href="mailto:supportvetrx@gmail.com" className="text-teal font-medium hover:underline">
                supportvetrx@gmail.com
              </a>
            </p>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
};
