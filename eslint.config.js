import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist", "evals", "node_modules", "test-results", "playwright-report"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["scripts/**/*.mjs", "*.config.{js,ts}", "demo/vite.config.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.{ts,mjs}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
