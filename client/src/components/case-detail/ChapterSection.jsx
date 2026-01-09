import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

/**
 * Collapsible chapter section with book-like design
 */
const ChapterSection = ({
  icon: Icon,
  title,
  number,
  isOpen,
  onToggle,
  accentColor = 'amber',
  children,
  delay = 0,
}) => {
  // Map accent colors to Tailwind classes
  const colorClasses = {
    amber: {
      iconBg: 'from-amber-100 to-amber-50',
      iconBorder: 'border-amber-200/50',
      iconText: 'text-amber-500',
      labelText: 'text-amber-400',
      expandBg: 'bg-amber-50',
      expandIcon: 'text-amber-400',
      underline: 'from-amber-200/50 via-amber-100',
    },
    rose: {
      iconBg: 'from-rose-100 to-rose-50',
      iconBorder: 'border-rose-200/50',
      iconText: 'text-rose-500',
      labelText: 'text-rose-400',
      expandBg: 'bg-rose-50',
      expandIcon: 'text-rose-400',
      underline: 'from-rose-200/50 via-rose-100',
    },
    violet: {
      iconBg: 'from-violet-100 to-violet-50',
      iconBorder: 'border-violet-200/50',
      iconText: 'text-violet-500',
      labelText: 'text-violet-400',
      expandBg: 'bg-violet-50',
      expandIcon: 'text-violet-400',
      underline: 'from-violet-200/50 via-violet-100',
    },
    emerald: {
      iconBg: 'from-emerald-100 to-emerald-50',
      iconBorder: 'border-emerald-200/50',
      iconText: 'text-emerald-500',
      labelText: 'text-emerald-400',
      expandBg: 'bg-emerald-50',
      expandIcon: 'text-emerald-400',
      underline: 'from-emerald-200/50 via-emerald-100',
    },
  };

  const colors = colorClasses[accentColor] || colorClasses.amber;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="relative"
    >
      {/* Chapter header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full group"
      >
        <div className="flex items-center gap-4 py-3">
          {/* Chapter icon badge */}
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors.iconBg} border ${colors.iconBorder} flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow`}>
            <Icon className={`w-5 h-5 ${colors.iconText}`} />
          </div>

          {/* Chapter title */}
          <div className="flex-1 text-left">
            {number && (
              <p className={`text-[10px] font-semibold ${colors.labelText} uppercase tracking-[0.25em]`}>
                Chapter {number}
              </p>
            )}
            <p className="font-bold text-neutral-800">{title}</p>
          </div>

          {/* Expand indicator */}
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className={`w-8 h-8 rounded-full ${colors.expandBg} flex items-center justify-center`}
          >
            <ChevronDown className={`w-4 h-4 ${colors.expandIcon}`} />
          </motion.div>
        </div>

        {/* Decorative underline */}
        <div className={`h-px bg-gradient-to-r ${colors.underline} to-transparent`} />
      </button>

      {/* Chapter content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pt-4 pb-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ChapterSection;
