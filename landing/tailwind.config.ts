import type { Config } from 'tailwindcss'

export default {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './renderer/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#FAF7F2',
          dark: '#F0EBE3',
          darker: '#E5DFD5'
        },
        ink: {
          DEFAULT: '#1a1816',
          light: '#3d3835',
          muted: '#6b6460',
          faint: '#a39d98'
        },
        coral: {
          DEFAULT: '#E85D4C',
          dark: '#C94D3E',
          light: '#F18B7E'
        },
        navy: {
          DEFAULT: '#1E3A5F',
          light: '#2D5A8A',
          dark: '#152A45'
        },
        sage: {
          DEFAULT: '#7D9F8E',
          light: '#9BB8A9',
          dark: '#5F7D6C'
        },
        amber: {
          DEFAULT: '#D4A853',
          light: '#E5C47A',
          dark: '#B88F3D'
        }
      },
      fontFamily: {
        serif: ['Instrument Serif', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'fade-in': 'fade-in 0.5s ease-out forwards',
        'slide-in':
          'slide-in-right 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        float: 'float 3s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite'
      }
    }
  },
  plugins: []
} satisfies Config
