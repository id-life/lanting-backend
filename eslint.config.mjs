// @ts-check

import { defineConfig } from "@ayingott/eslint-config"

export default defineConfig({
  rules: {
    "ts/consistent-type-imports": ["error", { prefer: "no-type-imports" }],
  },
  ignores: ["**/prisma/**", "**/data/**"],
})
