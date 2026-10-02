import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('--- RUNNING PLATFORM HEADER LAYOUT VERIFICATION ---');

const platformShellTsxPath = path.resolve(process.cwd(), 'src/components/Layout/PlatformShell.tsx');
const platformShellCssPath = path.resolve(process.cwd(), 'src/components/Layout/PlatformShell.css');

assert(fs.existsSync(platformShellTsxPath), 'PlatformShell.tsx must exist');
assert(fs.existsSync(platformShellCssPath), 'PlatformShell.css must exist');

const tsxContent = fs.readFileSync(platformShellTsxPath, 'utf8');
const cssContent = fs.readFileSync(platformShellCssPath, 'utf8');

// 1. Structure Verification in JSX
console.log('1. Checking PlatformShell.tsx structure...');
assert(tsxContent.includes('className="platform-header-right"'), 'Must have platform-header-right');
assert(tsxContent.includes('className="platform-user-identity"'), 'Must have platform-user-identity');
assert(tsxContent.includes('className="platform-user-avatar"'), 'Must have platform-user-avatar');
assert(tsxContent.includes('className="platform-user-details"'), 'Must have platform-user-details');
assert(tsxContent.includes('className="platform-user-name"'), 'Must have platform-user-name');
assert(tsxContent.includes('className="platform-user-badges"'), 'Must have platform-user-badges');
assert(tsxContent.includes('className="platform-context-badge">PLATFORM</span>'), 'Must contain PLATFORM context badge');
assert(tsxContent.includes('className="platform-role-badge">SUPER ADMIN</span>'), 'Must contain SUPER ADMIN role badge');
assert(tsxContent.includes('className="platform-switch-practice-btn platform-header-switch-btn"'), 'Must have platform-header-switch-btn');
assert(tsxContent.includes('className="platform-signout-btn"'), 'Must have platform-signout-btn');
assert(tsxContent.includes('Switch to Practice'), 'Switch to Practice button must be present');
assert(tsxContent.includes('Sign Out'), 'Sign Out button must be present');
assert(tsxContent.includes("user?.name || 'Super Admin'"), 'Must render dynamic user name with fallback');
assert(!tsxContent.includes('"Shameem Alungal"'), 'User name must NOT be hardcoded');

// 2. CSS Rules Verification
console.log('2. Checking PlatformShell.css layout rules...');
assert(cssContent.includes('.platform-header-right {'), 'Must define .platform-header-right');
assert(cssContent.includes('.platform-user-identity {'), 'Must define .platform-user-identity');
assert(cssContent.includes('.platform-user-avatar {'), 'Must define .platform-user-avatar');
assert(cssContent.includes('.platform-user-details {'), 'Must define .platform-user-details');
assert(cssContent.includes('.platform-user-name {'), 'Must define .platform-user-name');
assert(cssContent.includes('.platform-context-badge {'), 'Must define .platform-context-badge');
assert(cssContent.includes('.platform-role-badge {'), 'Must define .platform-role-badge');
assert(cssContent.includes('.platform-header-switch-btn {'), 'Must define .platform-header-switch-btn');
assert(cssContent.includes('.platform-signout-btn {'), 'Must define .platform-signout-btn');

// Check min-width: 0, wrapping, and flex containment rules
assert(cssContent.includes('min-width: 0;') || cssContent.includes('min-width: 0'), 'Must use min-width: 0 for flex children containment');
assert(cssContent.includes('overflow-wrap: break-word') || cssContent.includes('word-break: break-word'), 'Must control overflow-wrap for user name');
assert(cssContent.includes('-webkit-line-clamp: 2'), 'Must clamp user name to maximum 2 lines');
assert(cssContent.includes('@media (max-width: 900px)'), 'Must define tablet/desktop breakpoint');
assert(cssContent.includes('@media (max-width: 580px)'), 'Must define mobile breakpoint');

console.log('✅ ALL PLATFORM HEADER LAYOUT CHECKS PASSED SUCCESSFULLY!');
