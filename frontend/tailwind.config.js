/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Light content-area surfaces (page bg -> card -> tile, lightest to
        // most "recessed"). Renamed from the old dark palette but kept the
        // same token names (base-950/900/800...) so component classes didn't
        // need to change, just the values they resolve to.
        base: {
          950: '#EEF1F8',
          900: '#FFFFFF',
          850: '#F6F8FC',
          800: '#F1F4FA',
          700: '#E4E9F3',
          600: '#CBD5E5',
        },
        // Dedicated dark chrome for the sidebar, kept separate from `base`
        // so it stays navy even though the rest of the app is now light.
        navy: {
          950: '#070B14',
          900: '#0B1120',
          800: '#121A2E',
          700: '#1A2438',
        },
        brand: {
          400: '#8B7CF6',
          500: '#7C5CFC',
          600: '#6941E8',
        },
        risk: {
          low: '#34D399',
          medium: '#FBBF24',
          high: '#FB923C',
          critical: '#F87171',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(124,92,252,0.15), 0 8px 30px -10px rgba(124,92,252,0.25)',
      },
    },
  },
  plugins: [],
}
