import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

interface TocItem {
  id: string;
  title: string;
}

interface LegalLayoutProps {
  title: string;
  subtitle?: string;
  badge?: string;
  lastUpdated?: string;
  toc?: TocItem[];
  relatedLinks?: { title: string; href: string; desc: string }[];
  children: React.ReactNode;
}

export const LegalLayout: React.FC<LegalLayoutProps> = ({
  title,
  subtitle,
  badge = 'Official Document',
  lastUpdated = 'September 24, 2026',
  toc = [],
  relatedLinks = [],
  children,
}) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-24 pb-24 bg-gradient-to-b from-[#F6FAFA] via-white to-[#F0F7F7] min-h-screen">
      {/* Header Banner */}
      <div className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md py-14 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-xs font-mono text-content-tertiary mb-4">
              <Link to="/" className="hover:text-teal font-medium transition-colors">
                Home
              </Link>
              <span>/</span>
              <span className="text-teal font-semibold">{title}</span>
            </nav>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200/60 text-teal-800 text-xs font-mono font-bold uppercase tracking-wider mb-4 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-teal animate-gentle-pulse"></span>
              {badge}
            </div>

            <h1 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-content-primary tracking-tight">
              {title}
            </h1>

            {subtitle && (
              <p className="mt-4 text-base sm:text-lg text-content-secondary leading-relaxed font-normal">
                {subtitle}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-mono text-content-secondary">
              <span className="bg-slate-100 px-2.5 py-1 rounded-md font-medium">Last updated: {lastUpdated}</span>
              <span>•</span>
              <span className="text-teal-dark font-medium">Applies to VetRx Platform &amp; Services</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Table of Contents (Sticky on Desktop) */}
          {toc.length > 0 && (
            <aside className="hidden lg:block lg:col-span-3">
              <div className="sticky top-28 p-6 bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-subtle space-y-4">
                <span className="text-xs font-mono uppercase tracking-widest font-extrabold text-teal block">
                  Contents
                </span>
                <nav className="space-y-2 text-xs">
                  {toc.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="block py-1.5 px-2 rounded-lg text-content-secondary hover:text-teal hover:bg-teal-50/60 hover:translate-x-1 transition-all line-clamp-1 font-medium"
                    >
                      {item.title}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          )}

          {/* Document Content Body */}
          <main className={toc.length > 0 ? 'lg:col-span-9' : 'lg:col-span-12'}>
            <div className="max-w-4xl bg-white p-7 sm:p-12 rounded-3xl border border-slate-200/80 shadow-subtle space-y-8 text-sm sm:text-base text-content-secondary leading-relaxed font-sans">
              {children}
            </div>

            {/* Related Legal Links */}
            {relatedLinks.length > 0 && (
              <div className="max-w-4xl mt-12">
                <h3 className="font-heading font-extrabold text-lg text-content-primary mb-5 tracking-tight">
                  Related Documents &amp; Policies
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4.5">
                  {relatedLinks.map((link) => (
                    <Link
                      key={link.href}
                      to={link.href}
                      className="p-5 bg-white rounded-2xl border border-slate-200/80 hover:border-teal/40 hover:shadow-card-lift transition-all duration-300 group hover:-translate-y-1"
                    >
                      <span className="font-heading font-extrabold text-sm text-content-primary block group-hover:text-teal transition-colors">
                        {link.title} →
                      </span>
                      <span className="text-xs text-content-secondary mt-1.5 block font-normal">
                        {link.desc}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
