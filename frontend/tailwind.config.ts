import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Dashboard design tokens
        surface: {
          DEFAULT: '#0F1117',
          card: '#161B27',
          hover: '#1E2435',
          border: '#252D40',
        },
      },
      gridTemplateAreas: {
        shell: '"topbar topbar" "sidebar main"',
      },
    },
  },
  plugins: [],
} satisfies Config
