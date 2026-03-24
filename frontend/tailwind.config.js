/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pepe: {
          bg: '#0a0f0a',
          card: '#111a11',
          border: '#1e3a1e',
          green: '#22c55e',
          lime: '#84cc16',
          dark: '#0d1a0d',
          muted: '#4a7c4a',
          accent: '#16a34a',
          glow: '#15803d',
        }
      },
      boxShadow: {
        'pepe': '0 0 20px rgba(34, 197, 94, 0.15)',
        'pepe-lg': '0 0 40px rgba(34, 197, 94, 0.2)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
