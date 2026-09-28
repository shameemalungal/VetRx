import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { chromium } from '@playwright/test';

// Known system paths for Chrome and Edge on Windows
const WINDOWS_CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
];

const WINDOWS_EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
];

/**
 * Detect available browser strategy on the system without relying on broken CDNs.
 */
export function detectBrowserConfig() {
  const isWindows = process.platform === 'win32';
  let chromePath = null;
  let edgePath = null;

  if (isWindows) {
    for (const p of WINDOWS_CHROME_PATHS) {
      if (fs.existsSync(p)) {
        chromePath = p;
        break;
      }
    }
    for (const p of WINDOWS_EDGE_PATHS) {
      if (fs.existsSync(p)) {
        edgePath = p;
        break;
      }
    }
  }

  // Determine priority strategy
  if (chromePath) {
    return {
      type: 'channel',
      channel: 'chrome',
      executablePath: chromePath,
      name: 'Google Chrome',
      isSystemBrowser: true,
    };
  }

  if (edgePath) {
    return {
      type: 'channel',
      channel: 'msedge',
      executablePath: edgePath,
      name: 'Microsoft Edge',
      isSystemBrowser: true,
    };
  }

  // Fallback to default Playwright chromium if system browser not located
  return {
    type: 'default',
    channel: undefined,
    executablePath: undefined,
    name: 'Playwright Chromium',
    isSystemBrowser: false,
  };
}

/**
 * Launch browser using the best available local runtime.
 */
export async function launchReliableBrowser(options = {}) {
  const config = detectBrowserConfig();
  const launchOptions = {
    headless: options.headless ?? true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', ...(options.args || [])],
    ...options,
  };

  const attempts = [];

  // Attempt 1: System Chrome channel
  if (config.channel === 'chrome') {
    attempts.push({
      desc: 'Chrome channel',
      opts: { ...launchOptions, channel: 'chrome' },
    });
  }

  // Attempt 2: Explicit Chrome path
  if (config.executablePath && config.name.includes('Chrome')) {
    attempts.push({
      desc: 'Explicit Chrome executable',
      opts: { ...launchOptions, executablePath: config.executablePath, channel: undefined },
    });
  }

  // Attempt 3: Edge channel
  attempts.push({
    desc: 'Edge channel',
    opts: { ...launchOptions, channel: 'msedge', executablePath: undefined },
  });

  // Attempt 4: Explicit Edge path if known
  for (const ep of WINDOWS_EDGE_PATHS) {
    if (fs.existsSync(ep)) {
      attempts.push({
        desc: 'Explicit Edge executable',
        opts: { ...launchOptions, executablePath: ep, channel: undefined },
      });
      break;
    }
  }

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const browser = await chromium.launch(attempt.opts);
      return {
        browser,
        config: {
          ...config,
          usedAttempt: attempt.desc,
          version: browser.version(),
          executablePath: attempt.opts.executablePath || config.executablePath || 'System registered path',
        },
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`Failed to launch browser across all reliable system strategies. Last error: ${lastError?.message}`);
}

/**
 * Collect complete environment diagnostic telemetry.
 */
export function getEnvironmentDiagnostics() {
  let npmVersion = 'unknown';
  try {
    npmVersion = execSync('npm -v').toString().trim();
  } catch {
    // ignore
  }

  let playwrightVersion = 'unknown';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('node_modules/@playwright/test/package.json'), 'utf8'));
    playwrightVersion = pkg.version;
  } catch {
    // ignore
  }

  const browserConfig = detectBrowserConfig();

  return {
    os: `${process.platform} ${os.release()} (${os.arch()})`,
    node: process.version,
    npm: npmVersion,
    playwright: playwrightVersion,
    browserChannel: browserConfig.channel || 'none (default)',
    browserName: browserConfig.name,
    browserExecutable: browserConfig.executablePath || 'Not found',
    playwrightBrowsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH || 'Not set (using system browser)',
    frontendUrl: 'http://127.0.0.1:5173/',
  };
}
