import React from 'react';

/**
 * Atmospheric backdrop for the CaseDetailPage
 * Features: parchment gradient, paper texture, asymmetric gradient orbs
 */
const CaseDetailBackdrop = () => (
  <div className="absolute inset-0 pointer-events-none">
    {/* Parchment-like base gradient */}
    <div className="absolute inset-0 bg-gradient-to-b from-court-cream via-court-ivory to-amber-50/30" />

    {/* Subtle paper texture overlay using SVG noise */}
    <div
      className="absolute inset-0 opacity-[0.03] mix-blend-multiply"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }}
    />

    {/* Dramatic gradient orbs - positioned asymmetrically */}
    <div className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-amber-200/25 blur-[80px]" />
    <div className="absolute top-1/4 -left-32 h-96 w-96 rounded-full bg-rose-200/20 blur-[100px]" />
    <div className="absolute bottom-20 right-1/4 h-64 w-64 rounded-full bg-violet-200/15 blur-[60px]" />

    {/* Radial light overlay */}
    <div
      className="absolute inset-0 opacity-40"
      style={{
        backgroundImage:
          'radial-gradient(circle at 25% 15%, rgba(255,255,255,0.7) 0%, transparent 50%), radial-gradient(circle at 75% 80%, rgba(255,235,210,0.5) 0%, transparent 55%)',
      }}
    />
  </div>
);

export default CaseDetailBackdrop;
