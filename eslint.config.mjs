import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default [
  { ignores: ["lib/types/database.ts"] },
  ...nextCoreWebVitals,
  {
    rules: {
      "@next/next/no-img-element": "warn",
      "jsx-a11y/alt-text": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
];
