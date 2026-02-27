import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';
import { useI18n } from '../../i18n';

/**
 * Reusable modal wrapper with animation and accessibility
 *
 * @component
 * @example
 * ```jsx
 * <Modal
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   title="Edit Profile"
 *   size="lg"
 * >
 *   <p>Modal content here</p>
 * </Modal>
 * ```
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdropClick = true
}) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const { t } = useI18n()
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleBackdropClick}
            className="fixed inset-0 bg-black/50 z-50"
            aria-hidden="true"
          />

          {/* Modal */}
          <div
            className="fixed inset-0 flex items-center justify-center z-[60] p-4 pointer-events-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            onKeyDown={handleKeyDown}
          >
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 20 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: prefersReducedMotion ? 0.12 : 0.2 }}
              className={`glass-card p-6 w-full ${sizeClasses[size]} pointer-events-auto relative max-h-[90dvh] overflow-y-auto`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              {(title || showCloseButton) && (
                <div className="flex items-center justify-between mb-4">
                  {title && (
                    <h2 id="modal-title" className="text-xl font-bold text-court-brown">
                      {title}
                    </h2>
                  )}
                  {showCloseButton && (
                    <button
                      onClick={onClose}
                      className="p-2 hover:bg-court-tan/50 rounded-full transition-colors ml-auto"
                      aria-label={t('common.close')}
                    >
                      <X size={20} className="text-court-brown" />
                    </button>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="text-court-brown">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
