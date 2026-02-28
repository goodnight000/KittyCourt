import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useId, useMemo } from 'react';
import { useI18n } from '../../i18n';

/**
 * Default configuration for liquid glass effect
 * Based on archisvaze/liquid-glass implementation
 */
const DEFAULT_CONFIG = {
  radius: '28px',
  outerShadow: '0px 6px 24px rgba(0, 0, 0, 0.2)',
  // Inner shadow - creates the signature "liquid edge" effect
  innerShadowBlur: 20,
  innerShadowSpread: -5,
  innerShadowColor: 'rgba(255, 255, 255, 0.7)',
  // Tint overlay
  tintColor: '255, 255, 255',
  tintOpacity: 0.04,
  // Frost blur (subtle)
  frostBlur: 2,
  // SVG distortion parameters
  noiseFrequency: 0.008,
  distortionStrength: 77,
  filterSeed: 92,
  filterNumOctaves: 2,
};

/**
 * Liquid Glass Popup - iOS 26-style frosted glass popup with distortion effect
 * Based on archisvaze/liquid-glass implementation
 *
 * @component
 * @example
 * ```jsx
 * <LiquidGlassPopup
 *   isOpen={showPopup}
 *   onClose={() => setShowPopup(false)}
 *   title="Confirm Action"
 * >
 *   <p>Are you sure you want to proceed?</p>
 * </LiquidGlassPopup>
 * ```
 */
export default function LiquidGlassPopup({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdropClick = true,
  config = {},
}) {
  const { t } = useI18n();
  const filterId = useId();
  const mergedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  };

  const handleBackdropClick = () => {
    if (closeOnBackdropClick) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && closeOnBackdropClick) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* SVG Filter Definition - Glass Distortion */}
          <svg className="absolute w-0 h-0" aria-hidden="true">
            <defs>
              <filter id={filterId}>
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency={mergedConfig.noiseFrequency}
                  numOctaves={mergedConfig.filterNumOctaves}
                  seed={mergedConfig.filterSeed}
                />
                <feGaussianBlur stdDeviation="2" />
                <feDisplacementMap
                  in="SourceGraphic"
                  scale={mergedConfig.distortionStrength}
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            </defs>
          </svg>

          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleBackdropClick}
            className="fixed inset-0 bg-black/20 z-[60]"
            aria-hidden="true"
          />

          {/* Modal Container */}
          <div
            className="fixed inset-0 flex items-center justify-center z-[60] p-4 pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'liquid-glass-modal-title' : undefined}
            onKeyDown={handleKeyDown}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{
                type: 'spring',
                damping: 25,
                stiffness: 300,
              }}
              className={`w-full ${sizeClasses[size]} pointer-events-auto`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Liquid Glass Container */}
              <div
                className="relative"
                style={{
                  borderRadius: mergedConfig.radius,
                  boxShadow: mergedConfig.outerShadow,
                }}
              >
                {/* Layer 1: Tint + Inner Shadow (::before equivalent) */}
                <div
                  className="absolute inset-0"
                  style={{
                    borderRadius: mergedConfig.radius,
                    backgroundColor: `rgba(${mergedConfig.tintColor}, ${mergedConfig.tintOpacity})`,
                    boxShadow: `inset 0 0 ${mergedConfig.innerShadowBlur}px ${mergedConfig.innerShadowSpread}px ${mergedConfig.innerShadowColor}`,
                  }}
                />

                {/* Layer 2: Blur + Distortion (::after equivalent) */}
                <div
                  className="absolute inset-0"
                  style={{
                    borderRadius: mergedConfig.radius,
                    backdropFilter: `blur(${mergedConfig.frostBlur}px)`,
                    WebkitBackdropFilter: `blur(${mergedConfig.frostBlur}px)`,
                    filter: `url(#${filterId})`,
                  }}
                />

                {/* Content */}
                <div
                  className="relative z-10 p-6 max-h-[85dvh] overflow-y-auto"
                  style={{ borderRadius: mergedConfig.radius }}
                >
                  {/* Header */}
                  {(title || showCloseButton) && (
                    <div className="flex items-center justify-between mb-4">
                      {title && (
                        <h2
                          id="liquid-glass-modal-title"
                          className="text-xl font-bold text-neutral-800"
                          style={{
                            textShadow: '0 1px 2px rgba(255,255,255,0.5)',
                          }}
                        >
                          {title}
                        </h2>
                      )}
                      {showCloseButton && (
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={onClose}
                          className="p-2 rounded-full bg-white/30 hover:bg-white/40 transition-colors ml-auto"
                          aria-label={t('common.close')}
                          style={{
                            boxShadow: 'inset 0 0 8px -2px rgba(255,255,255,0.5)',
                          }}
                        >
                          <X size={18} className="text-neutral-700" />
                        </motion.button>
                      )}
                    </div>
                  )}

                  {/* Body */}
                  <div className="text-neutral-700">{children}</div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
