import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT || 3123)

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Pixel 7'], browserName: 'chromium' },
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : [
      {
        command: 'node tests/e2e/mock-idp.mjs',
        url: 'http://127.0.0.1:39117/oidc/.well-known/openid-configuration',
        reuseExistingServer: false,
      },
      {
        command: `npx next start -p ${PORT} -H 127.0.0.1`,
        url: `http://127.0.0.1:${PORT}/api/rules`,
        reuseExistingServer: false,
        timeout: 60_000,
        env: {
          DATA_DIR: process.env.E2E_DATA_DIR || '.data-e2e',
          SESSION_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-secret',
          ADMIN_EMAIL: 'owner@sharein.test',
          ADMIN_PASSWORD: 'rahasia-e2e-123',
          MYTOPSTAR_ISSUER: 'http://localhost:39117/oidc',
          MYTOPSTAR_CLIENT_ID: 'sharein-e2e',
        },
      },
    ],
})
