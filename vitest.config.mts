import { defineConfig } from 'vitest/config'


// Lean by design: node environment, no jsdom, no setup files. These tests
// cover pure data logic (cancellation, season derivation) — the parts where
// a silent regression deletes a real race from the site.
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  // import.meta.dirname, not __dirname: this config is loaded as ESM.
  resolve: { alias: { '@': import.meta.dirname } },
})
