import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        pine: {
          50: '#F4F7F6',
          100: '#E5EFEF',
          200: '#C9DADA',
          600: '#1A5D5E',
          700: '#194F50',
          800: '#134647',
          900: '#0B3B3C',
          950: '#072728',
        },
        accentGreen: '#2ED47A',
        accentCoral: '#E87A48',
        brand: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          600: '#1A5D5E',
          700: '#134647',
          800: '#0B3B3C',
          900: '#072728',
        },
      },
    },
  },
  plugins: [],
};

export default config;
