
/**
 * Reusable loading spinner component with size and color variants
 *
 * @component
 * @example
 * ```jsx
 * <LoadingSpinner size="lg" color="court-gold" />
 * ```
 */
export default function LoadingSpinner({
  size = 'md',
  color = 'court-gold',
  className = ''
}) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-4',
    xl: 'w-16 h-16 border-4'
  };

  const colorClasses = {
    'court-gold': 'border-court-gold/20 border-t-court-gold',
    'court-brown': 'border-court-brown/20 border-t-court-brown',
    'court-cream': 'border-court-cream/20 border-t-court-cream',
    'white': 'border-white/20 border-t-white'
  };

  return (
    <div
      className={`${sizes[size]} ${colorClasses[color] || colorClasses['court-gold']} rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}
