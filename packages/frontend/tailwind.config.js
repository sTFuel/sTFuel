/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#4D5BFF",
        secondary: "#00C4B3",
        tfuel: "rgb(236,136,53)",
        theta: "rgb(88,188,238)",
        "background-light": "#f6f7f8",
        "background-dark": "#121217",
        "card-dark": "#1A1A22",
        "text-secondary-dark": "#A0A0B0",
        "border-dark": "#325567",
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
    },
  },
  plugins: [],
};
