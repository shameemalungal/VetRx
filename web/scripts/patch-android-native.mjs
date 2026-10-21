import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const androidDir = path.resolve('android');
const candidates = [
  path.join(androidDir, 'app/src/main/java/com/vetrx/app/MainActivity.java'),
  path.join(androidDir, 'app/src/main/java/com/vetrx/app/MainActivity.kt'),
];
const activityPath = candidates.find((candidate) => existsSync(candidate));
if (!activityPath) {
  throw new Error('Capacitor Android MainActivity was not found. Run "npx cap add android" first.');
}

if (activityPath.endsWith('.kt')) {
  throw new Error('Expected the generated Java MainActivity, but found Kotlin. Review the native cookie configuration manually.');
}

const current = await readFile(activityPath, 'utf8');
if (current.includes('setAcceptThirdPartyCookies')) {
  console.log('Android WebView cookie configuration already applied.');
} else {
  const packageLine = current.match(/^package [^;]+;\s*$/m)?.[0];
  if (!packageLine) throw new Error('Could not locate Java package declaration in MainActivity.');
  const imports = '\n\nimport android.os.Bundle;\nimport android.webkit.CookieManager;\nimport android.webkit.WebView;';
  const classBody = `\n\npublic class MainActivity extends BridgeActivity {\n  @Override\n  public void onCreate(Bundle savedInstanceState) {\n    super.onCreate(savedInstanceState);\n    // VetRx uses an HTTP-only session cookie for its shared backend.\n    // The packaged Capacitor origin (https://localhost) is cross-origin to the API host.\n    WebView webView = getBridge().getWebView();\n    CookieManager cookieManager = CookieManager.getInstance();\n    cookieManager.setAcceptCookie(true);\n    cookieManager.setAcceptThirdPartyCookies(webView, true);\n  }\n}\n`;
  const updated = current
    .replace(packageLine, packageLine + imports)
    .replace(/public class MainActivity extends BridgeActivity\s*\{\s*\}/, classBody.trim());
  if (updated === current) throw new Error('MainActivity template did not match expected Capacitor Java class.');
  await writeFile(activityPath, updated, 'utf8');
  console.log('Configured Android WebView cookie support for the VetRx session.');
}
