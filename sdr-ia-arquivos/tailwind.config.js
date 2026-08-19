/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta "Midnight Premium" — nunca preto puro
        navy: {
          950: "#060A14",
          900: "#0A1220",
          850: "#0D1728",
          800: "#122035",
          700: "#1B2C4A",
        },
        brand: {
          blue: "#3E7BFA",   // acento principal (ações humanas)
          violet: "#8B5CF6", // acento IA (tudo que a IA fez)
          cyan: "#22D3EE",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-grotesk)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(2,6,17,0.45)",
        glow: "0 0 40px rgba(62,123,250,0.22)",
      },
    },
  },
  plugins: [],
};
