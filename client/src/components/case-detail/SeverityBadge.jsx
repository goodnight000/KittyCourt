import React from 'react';
import { AlertTriangle, Zap, Cloud } from 'lucide-react';

const SEVERITY_STYLES = {
  high_tension: {
    gradient: 'from-red-500 to-rose-600',
    glow: 'shadow-red-500/30',
    icon: AlertTriangle,
  },
  friction: {
    gradient: 'from-amber-400 to-orange-500',
    glow: 'shadow-amber-500/30',
    icon: Zap,
  },
  disconnection: {
    gradient: 'from-sky-400 to-blue-500',
    glow: 'shadow-sky-500/30',
    icon: Cloud,
  },
};

const HORSEMAN_STYLES = {
  Criticism: {
    gradient: 'from-pink-400 to-rose-500',
    glow: 'shadow-pink-500/25',
  },
  Contempt: {
    gradient: 'from-red-400 to-red-600',
    glow: 'shadow-red-500/25',
  },
  Defensiveness: {
    gradient: 'from-amber-400 to-amber-600',
    glow: 'shadow-amber-500/25',
  },
  Stonewalling: {
    gradient: 'from-slate-400 to-slate-600',
    glow: 'shadow-slate-500/25',
  },
};

/**
 * Severity level badge with gradient styling
 */
export const SeverityBadge = ({ severity, label }) => {
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.friction;
  const Icon = style.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r ${style.gradient} text-white text-xs font-bold shadow-lg ${style.glow}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </div>
  );
};

/**
 * Horseman pattern badge
 */
export const HorsemanBadge = ({ horseman, label }) => {
  const style = HORSEMAN_STYLES[horseman];
  if (!style) return null;

  return (
    <div className={`inline-flex items-center px-3 py-1.5 rounded-full bg-gradient-to-r ${style.gradient} text-white text-xs font-bold shadow-lg ${style.glow}`}>
      <span>{label}</span>
    </div>
  );
};

/**
 * Verdict count badge
 */
export const VerdictCountBadge = ({ count, label }) => {
  if (count <= 1) return null;

  return (
    <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-400 to-purple-500 text-white text-xs font-bold shadow-lg shadow-violet-500/25">
      <span>{label}</span>
    </div>
  );
};

export default SeverityBadge;
