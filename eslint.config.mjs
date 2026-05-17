import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/ban-ts-comment": "warn",
    "@typescript-eslint/prefer-as-const": "error",
    "@typescript-eslint/no-unused-expressions": "error",

    // React rules
    "react-hooks/exhaustive-deps": "error",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",

    // Next.js rules
    "@next/next/no-img-element": "error",
    "@next/next/no-html-link-for-pages": "off",

    // General JavaScript rules
    "prefer-const": "error",
    "no-unused-vars": "off", // disabled in favor of @typescript-eslint/no-unused-vars
    "no-console": "off",
    "no-debugger": "off",
    "no-empty": "warn",
    "no-irregular-whitespace": "error",
    "no-case-declarations": "off",
    "no-fallthrough": "error",
    "no-mixed-spaces-and-tabs": "error",
    "no-redeclare": "error",
    "no-unreachable": "error",
    "no-useless-escape": "warn",
  },
}, {
  files: ["**/*.ts", "**/*.tsx"],
  rules: {
    "no-undef": "off", // TypeScript handles this better
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills", "eslint.config.mjs"]
}];

export default eslintConfig;
