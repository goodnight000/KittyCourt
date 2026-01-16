import { useState, useEffect } from 'react';

/**
 * Hook to detect user's reduced motion preference
 * Returns true if user prefers reduced motion
 */
export default function usePrefersReducedMotion() {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mediaQuery.matches);

        const handleChange = (event) => setPrefersReducedMotion(event.matches);
        mediaQuery.addEventListener('change', handleChange);

        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return prefersReducedMotion;
}
