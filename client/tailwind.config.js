/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Premium Court Palette - Champagne Gold Theme
                'court': {
                    // Primary Champagne Gold (gavel, badge)
                    'gold': '#D4AF37',           // True gold - richer than mustard
                    'goldLight': '#E6CFA3',      // Champagne - soft, luxurious
                    'goldDark': '#B8972E',       // Deep gold - sophisticated accent
                    // Warm Browns (robe, wood)
                    'brown': '#4A3728',
                    'brownLight': '#6B5344',
                    'brownDark': '#2D221A',
                    // Cream/Tan (cat fur, background)
                    'cream': '#FFFBF5',          // Warm ivory - brighter, cleaner
                    'tan': '#E6D5C3',            // Softer tan
                    'ivory': '#FFFEF8',          // Pure warm white
                    // Deep Accents (chair, accents)
                    'maroon': '#8B4513',         // Saddle brown - warmer accent
                    'maroonLight': '#A0522D',    // Sienna - softer accent
                    // Neutral grays
                    'slate': '#4A4A4A',
                },
                // Soft pastel palette (legacy support)
                'blush': {
                    50: '#fef7f8',
                    100: '#fdeef0',
                    200: '#fbd5dc',
                    300: '#f8b4c0',
                    400: '#f48a9d',
                    500: '#eb5a7a',
                    600: '#d83a5d',
                    700: '#b52c4a',
                    800: '#972840',
                    900: '#7f263a',
                },
                'lavender': {
                    50: '#f8f7fc',
                    100: '#f1eef9',
                    200: '#e5dff5',
                    300: '#d1c6ec',
                    400: '#b8a4e0',
                    500: '#9f7ed2',
                    600: '#8b61c1',
                    700: '#7750a8',
                    800: '#63448a',
                    900: '#533b71',
                },
                'cream': {
                    50: '#fffefb',
                    100: '#fefcf5',
                    200: '#fdf8e8',
                    300: '#fbf0d4',
                    400: '#f8e4b8',
                    500: '#f3d28d',
                    600: '#e8b654',
                    700: '#d49a32',
                    800: '#af7c29',
                    900: '#8e6624',
                },
                'mint': {
                    50: '#f3fcf9',
                    100: '#d8f5eb',
                    200: '#b1ebd8',
                    300: '#81d9c1',
                    400: '#52c0a5',
                    500: '#33a58c',
                    600: '#268572',
                    700: '#236a5d',
                    800: '#21554c',
                    900: '#1f4740',
                },
                'peach': {
                    50: '#fff8f5',
                    100: '#ffefe8',
                    200: '#ffdccc',
                    300: '#ffc3a3',
                    400: '#ffa070',
                    500: '#ff7a3d',
                    600: '#f05a1a',
                    700: '#c74512',
                    800: '#a33913',
                    900: '#863315',
                },
                'sky': {
                    50: '#f4f9fd',
                    100: '#e7f2fb',
                    200: '#c9e3f6',
                    300: '#9bccee',
                    400: '#66b0e4',
                    500: '#4194d1',
                    600: '#3077b2',
                    700: '#286091',
                    800: '#265178',
                    900: '#244564',
                },
            },
            fontFamily: {
                sans: ['Nunito', 'sans-serif'],
                display: ['Quicksand', 'sans-serif'],
            },
            borderRadius: {
                '4xl': '2rem',
                '5xl': '2.5rem',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out',
                'slide-up': 'slideUp 0.5s ease-out',
                'slide-down': 'slideDown 0.3s ease-out',
                'bounce-soft': 'bounceSoft 2s infinite',
                'float': 'float 6s ease-in-out infinite',
                'float-slow': 'float 8s ease-in-out infinite',
                'wiggle': 'wiggle 2s ease-in-out infinite',
                'wiggle-slow': 'wiggle 3s ease-in-out infinite',
                'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
                'shimmer': 'shimmer 3s linear infinite',
                'scale-in': 'scaleIn 0.3s ease-out',
                'heart-beat': 'heartBeat 1.5s ease-in-out infinite',
                'sparkle': 'sparkle 1.5s ease-in-out infinite',
                'paw-print': 'pawPrint 0.5s ease-out forwards',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideDown: {
                    '0%': { transform: 'translateY(-10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
                    '50%': { transform: 'translateY(-12px) rotate(2deg)' },
                },
                bounceSoft: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-8px)' },
                },
                wiggle: {
                    '0%, 100%': { transform: 'rotate(-3deg)' },
                    '50%': { transform: 'rotate(3deg)' },
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1', transform: 'scale(1)' },
                    '50%': { opacity: '0.8', transform: 'scale(0.98)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-1000px 0' },
                    '100%': { backgroundPosition: '1000px 0' },
                },
                scaleIn: {
                    '0%': { transform: 'scale(0.9)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
                heartBeat: {
                    '0%, 100%': { transform: 'scale(1)' },
                    '14%': { transform: 'scale(1.15)' },
                    '28%': { transform: 'scale(1)' },
                    '42%': { transform: 'scale(1.15)' },
                    '70%': { transform: 'scale(1)' },
                },
                sparkle: {
                    '0%, 100%': { opacity: '1', transform: 'scale(1) rotate(0deg)' },
                    '50%': { opacity: '0.6', transform: 'scale(0.9) rotate(180deg)' },
                },
                pawPrint: {
                    '0%': { transform: 'scale(0) rotate(-20deg)', opacity: '0' },
                    '50%': { transform: 'scale(1.2) rotate(0deg)', opacity: '1' },
                    '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
                },
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
                'shimmer-gradient': 'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                'soft-gradient': 'linear-gradient(135deg, rgba(251, 207, 232, 0.3) 0%, rgba(221, 214, 254, 0.3) 50%, rgba(254, 243, 199, 0.3) 100%)',
            },
            boxShadow: {
                'soft-sm': '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
                'soft': '0 4px 16px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.03)',
                'soft-md': '0 8px 24px rgba(0, 0, 0, 0.06), 0 4px 8px rgba(0, 0, 0, 0.03)',
                'soft-lg': '0 12px 40px rgba(0, 0, 0, 0.08), 0 6px 12px rgba(0, 0, 0, 0.04)',
                'soft-xl': '0 20px 60px rgba(0, 0, 0, 0.1), 0 10px 20px rgba(0, 0, 0, 0.05)',
                'glow-pink': '0 8px 30px rgba(244, 114, 182, 0.25), 0 4px 12px rgba(244, 114, 182, 0.15)',
                'glow-lavender': '0 8px 30px rgba(167, 139, 250, 0.25), 0 4px 12px rgba(167, 139, 250, 0.15)',
                'glow-cream': '0 8px 30px rgba(251, 191, 36, 0.2), 0 4px 12px rgba(251, 191, 36, 0.1)',
                'inner-soft': 'inset 0 2px 4px rgba(0, 0, 0, 0.03)',
                'premium': '0 10px 40px rgba(0, 0, 0, 0.04), 0 2px 10px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
            },
            backdropBlur: {
                xs: '2px',
            },
        },
    },
    plugins: [],
}
