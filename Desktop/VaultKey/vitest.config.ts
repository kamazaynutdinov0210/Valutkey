import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node', // Node provides Web Crypto (globalThis.crypto) for the M1 tests
    include: ['tests/unit/**/*.test.ts'],
    testTimeout: 30_000, // Argon2 at 64 MiB can take a second or two on slow CI
  },
})
