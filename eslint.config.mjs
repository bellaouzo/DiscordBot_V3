import js from "@eslint/js";
import tseslint from "typescript-eslint";
import vitest from "eslint-plugin-vitest";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: ["node_modules/", "dist/", "coverage/", "examples/", "**/*.d.ts"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["tests/**/*.ts"],
    ...vitest.configs.recommended,
    languageOptions: {
      parserOptions: {
        project: "./tests/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
      globals: vitest.configs.env.languageOptions.globals,
    },
    rules: {
      "vitest/valid-title": ["error", { ignoreTypeOfDescribeName: true }],
    },
  },
];
