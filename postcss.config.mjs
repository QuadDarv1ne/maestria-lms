const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

const config = {
  plugins: isTest ? [] : ["@tailwindcss/postcss"],
};

export default config;
