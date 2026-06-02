export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#080810',
        surface: '#0D0D1A',
        card: '#12122A',
        text: '#E8E4FF',
        muted: '#6B6B8A',
        green: '#4DFF9F',
        gold: '#FFC83D',
        cyan: '#2EE8FF',
        red: '#FF3D8A',
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        mono: ['"Syne Mono"', 'monospace'],
      }
    }
  },
  plugins: []
}
