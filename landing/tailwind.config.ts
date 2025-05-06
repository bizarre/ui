// landing/tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './renderer/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
    // Add other paths to your components if needed
  ],
  theme: {
    extend: {}
  },
  plugins: []
} satisfies Config
