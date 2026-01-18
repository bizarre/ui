import { defineConfig, devices } from '@playwright/experimental-ct-react'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  testDir: './',
  testMatch: /.*\.spec\.tsx?$/,
  snapshotDir: './__snapshots__',
  timeout: 10 * 1000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: 'list', // never open the HTML reporter

  use: {
    trace: 'on-first-retry',
    ctPort: 3100,

    ctViteConfig: {
      plugins: [react()]
    }
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['clipboard-read', 'clipboard-write']
      }
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            // Enable clipboard testing in Firefox
            'dom.events.testing.asyncClipboard': true,
            'dom.events.asyncClipboard.readText': true,
            'dom.events.asyncClipboard.clipboardItem': true
          }
        }
      }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    // Mobile device projects for touch/mobile testing
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        permissions: ['clipboard-read', 'clipboard-write']
      }
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] }
    }
  ]
})
