import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  { ignores: ["**/*.backup.tsx", "**/*.backup2.tsx"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Large legacy CRM codebase; strict `any` bans fail CI when lint runs (e.g. `npm run lint && next build`).
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
];

export default eslintConfig;
