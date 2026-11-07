import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: 'var(--brand-purple)',
          violet: 'var(--brand-violet)',
          orange: 'var(--brand-orange)',
          amber: 'var(--brand-amber)',
          lavender: 'var(--brand-lavender)',
        },
        ink: 'var(--ink)',
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        bad: 'var(--bad)',
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
