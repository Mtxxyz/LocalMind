import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI Variable', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        soft: 'var(--shadow)',
      },
      borderRadius: {
        lg: '12px',
        xl: '18px',
        '2xl': '24px',
      },
    },
  },
  plugins: [],
} satisfies Config
