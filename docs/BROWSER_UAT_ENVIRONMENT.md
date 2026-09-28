# VetRx Browser & Playwright UAT Environment

## Overview

The VetRx browser UAT harness uses **locally installed system browsers** (Google Chrome or Microsoft Edge) directly via Playwright browser channels, completely bypassing the need to download Chromium driver binaries from remote CDNs (such as Azure Edge CDN) which frequently experience HTTP 404 outages.

---

## Architecture & Browser Strategy

```
Antigravity Browser UAT / Test Scripts
                ↓
    scripts/browser_env.mjs
   (Detects installed browser)
                ↓
  Google Chrome / Microsoft Edge
  (Channel: 'chrome' or 'msedge')
                ↓
            Playwright
                ↓
    VetRx Localhost (5173)
```

### Detection Strategy
`scripts/browser_env.mjs` executes an ordered search across Windows standard program directories:

1. **System Google Chrome channel** (`channel: 'chrome'`)
   - Checks `C:\Program Files\Google\Chrome\Application\chrome.exe`
   - Checks `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`
   - Checks `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`
2. **Explicit Google Chrome binary path** (`executablePath`)
3. **System Microsoft Edge channel** (`channel: 'msedge'`)
   - Checks `C:\Program Files\Microsoft\Edge\Application\msedge.exe`
   - Checks `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
4. **Explicit Microsoft Edge binary path** (`executablePath`)
5. **Fallback**: Playwright Chromium (if installed) or graceful failure reporting full environment diagnostics.

---

## Configuration Files

- [`playwright.config.ts`](file:///c:/Antigravity/VetRx/playwright.config.ts): Playwright configuration importing options from `scripts/browser_env.mjs`, targeting `http://127.0.0.1:5173/`, with automatic Vite webServer launcher and viewport defaults.
- [`scripts/browser_env.mjs`](file:///c:/Antigravity/VetRx/scripts/browser_env.mjs): Shared helper module providing `getBrowserLaunchOptions()` and `getEnvironmentDiagnostics()`.
- [`scripts/browser_smoke.mjs`](file:///c:/Antigravity/VetRx/scripts/browser_smoke.mjs): Standalone smoke test verifying browser launch, page navigation, and diagnostics reporting.
- [`scripts/run_browser_uat.mjs`](file:///c:/Antigravity/VetRx/scripts/run_browser_uat.mjs): Comprehensive end-to-end browser UAT test runner verifying:
  - Root application loading and login flow
  - Platform navigation & platform header layout
  - All 7 viewports (1440×900, 1366×768, 1280×800, 1024×768, 768×1024, 390×844, 360×800) with real browser `scrollWidth <= clientWidth` checks
  - Medicines New Medicine formulation form
  - Prescription Builder Add Medicine formulation integration

---

## Available NPM Scripts

From the repository root (`c:/Antigravity/VetRx`) or `web/`:

```bash
# Run the quick browser environment smoke test
npm run test:browser:smoke

# Run the complete end-to-end browser UAT suite
npm run test:browser

# Run existing unit and integration tests
npm test
```

---

## Diagnostics and Failure Handling

If a browser fails to launch or is missing, the harness automatically prints an environment diagnostic table:

```
============================================================
BROWSER UAT ENVIRONMENT
-----------------------
OS:                       win32 (x64)
Node:                     v22.18.0
npm:                      10.8.2
Playwright:               1.63.0
Browser channel:          chrome
Browser executable:       C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
Browser version:          154.0.8037.57
PLAYWRIGHT_BROWSERS_PATH: [unset / standard]
Frontend URL:             http://127.0.0.1:5173/
============================================================
```

This immediately distinguishes between **browser runtime problems** and **VetRx application problems**.
