import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Lean by design: node environment, no jsdom, no setup files. These tests
// cover pure data logic (cancellation, season derivation) — the parts where
// a silent regression deletes a real race from the site.
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
