import React from 'react';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';

/**
 * Resolution banner with dramatic reveal animation
 * Shows the short resolution summary prominently
 * @param {Object} props
 * @param {string} props.resolution - The resolution text
 * @param {Function} props.t - Translation function
 */
const ResolutionBanner = ({ resolution, t }) => {
  if (!resolution) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ delay: 0.8, duration: 0.5 }}
      className="relative mx-[-1rem] overflow-hidden"
    >
      {/* Layered background for depth */}
      <div className="absolute inset-0 bg-gradient-to-r from-rose-50/80 via-pink-50/60 to-violet-50/80" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.8)_0%,_transparent_70%)]" />

      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-rose-200/50 rounded-tl-xl" />
      <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-violet-200/50 rounded-br-xl" />

      <div className="relative px-6 py-5">
        <div className="flex items-start gap-4">
          {/* Heart icon with pulse */}
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/30 flex-shrink-0"
          >
            <Heart className="w-6 h-6 text-white" fill="white" />
          </motion.div>

          <div className="flex-1">
            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-[0.25em] mb-1">
              {t?.('cases.detail.resolution.label') || 'Resolution'}
            </p>
            <p className="text-neutral-800 font-medium leading-relaxed">
              {resolution}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ResolutionBanner;
