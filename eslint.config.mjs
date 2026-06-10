import js from "@eslint/js";
import tseslint from "typescript-eslint";
import vitest from "eslint-plugin-vitest";
import prettier from "eslint-config-prettier";

const sharedRules = {
  "@typescript-eslint/consistent-type-imports": [
    "error",
    {
      prefer: "type-imports",
      fixStyle: "separate-type-imports",
      disallowTypeAnnotations: false,
    },
  ],
  "@typescript-eslint/no-non-null-assertion": "error",
  "no-restricted-imports": [
    "error",
    {
      paths: [
        {
          name: "@commands/CommandFactory",
          message: "Import from @commands instead.",
        },
      ],
      patterns: [
        {
          group: ["../*/Commands/*", "../*/Commands"],
          message: "Use @commands path alias instead of relative imports.",
        },
      ],
    },
  ],
};

export default [
  {
    ignores: ["node_modules/", "dist/", "coverage/", "**/*.d.ts"],
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
      ...sharedRules,
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
      ...sharedRules,
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    files: ["src/Systems/Economy/handlers/**/*.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    files: ["examples/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./examples/tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-empty": ["warn", { allowEmptyCatch: true }],
      ...sharedRules,
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
];
