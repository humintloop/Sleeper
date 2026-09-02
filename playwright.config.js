import { defineConfig, devices } from '@playwright/test';

// Critical-flow coverage for the handoff doc's Phase 3 "Browser-level tests
// and CI" section. Every test here runs against the Sample Replay target
// only — deterministic, no API key, no WebGPU — so CI never needs live
// provider credentials, matching "Prefer deterministic simulated targets in
// CI; live providers must not be required" exactly.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/Sleeper/',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://localhost:4173/Sleeper/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
