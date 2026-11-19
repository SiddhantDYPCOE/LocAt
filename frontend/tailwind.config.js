/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        indigo: {
          50: "#e7f8ef", 100: "#dcf8c6", 200: "#b9edce", 300: "#83dfaa",
          400: "#4bd783", 500: "#25d366", 600: "#128c7e", 700: "#0f766e",
          800: "#115e59", 900: "#134e4a", 950: "#042f2e"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    },
  },
  plugins: [],
}

