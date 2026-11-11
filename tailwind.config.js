/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn', 'Tahoma', 'sans-serif'],
      },
      colors: {
        bg: 'var(--bg)',
        sidebar: 'var(--sidebar)',
        surface: 'var(--surface)',
        surface2: 'var(--surface-2)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        primary: 'var(--primary)',
        onprimary: 'var(--on-primary)',
        lunch: 'var(--lunch)',
        lunchbg: 'var(--lunch-bg)',
        lunchline: 'var(--lunch-line)',
        dinner: 'var(--dinner)',
        dinnerbg: 'var(--dinner-bg)',
        dinnerline: 'var(--dinner-line)',
        ok: 'var(--ok)',
        okbg: 'var(--ok-bg)',
        warn: 'var(--warn)',
        warnbg: 'var(--warn-bg)',
        danger: 'var(--danger)',
        dangerbg: 'var(--danger-bg)',
        info: 'var(--info)',
        infobg: 'var(--info-bg)',
      },
      borderRadius: {
        md: '8px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(28, 25, 23, 0.04)',
      },
    },
  },
  plugins: [],
}
