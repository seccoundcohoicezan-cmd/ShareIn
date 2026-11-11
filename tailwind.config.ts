import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Hex (same values as the CSS variables in globals.css) so opacity modifiers like bg-brand-purple/10 work.
      colors: {
        brand: {
          purple: '#6c2bd9',
          violet: '#a855f7',
          orange: '#f97316',
          amber: '#fbbf24',
          lavender: '#f3f0ff',
        },
        ink: '#2a0f5c',
        ok: '#16a34a',
        warn: '#f59e0b',
        bad: '#dc2626',
      },
      borderRadius: { panel: '28px', field: '16px' },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
