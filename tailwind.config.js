const flowbitePlugin = require("flowbite-react/plugin/tailwindcss");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/flowbite-react/dist/esm/**/*.js",
    "./node_modules/flowbite-react/dist/components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/forms'),
    flowbitePlugin,
  ],
}

