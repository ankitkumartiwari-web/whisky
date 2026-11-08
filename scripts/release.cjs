#!/usr/bin/env node
// One-shot release: builds the desktop installer(s), publishes them to GitHub as
// a draft release tied to the current package.json version, then flips it from
// draft to "Latest" so auto-updater clients pick it up.
//
// Prereqs:
//   - gh CLI installed and authenticated (gh auth login)
//   - package.json version bumped (see notes below)
//   - macOS builds MUST run on macOS (dmg/hdiutil + code signing); Windows
//     builds run on Windows. Use `--all` in a CI matrix, or run this script on
//     each host.
//
// Usage:
//   npm run release            # build for the current OS (win32 -> win, darwin -> mac)
//   npm run release -- --win   # force Windows build
//   npm run release -- --mac   # force macOS build (run on macOS)
//   npm run release -- --all   # build both (only works where both targets can build)
//
// Tip: bump the version with `npm version patch|minor|major` first so the
// release picks up the new tag. Auto-updater only triggers when the published
// version is higher than what's installed.
//
// macOS signing (optional but recommended for auto-update):
//   CSC_LINK + CSC_KEY_PASSWORD for the Developer ID certificate, plus
//   APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID for notarization.

const { execSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function run(cmd, opts = {}) {
  console.log(`\n→ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function tryRun(cmd, opts = {}) {
  console.log(`\n→ ${cmd}`);
  const res = spawnSync(cmd, { shell: true, stdio: 'inherit', ...opts });
  return res.status === 0;
}

function findGhExe() {
  const candidates =
    process.platform === 'win32'
      ? [
          'C:/Program Files/GitHub CLI/gh.exe',
          'C:/Program Files (x86)/GitHub CLI/gh.exe',
          'gh',
        ]
      : ['/opt/homebrew/bin/gh', '/usr/local/bin/gh', 'gh'];
  for (const c of candidates) {
    if (c === 'gh') return 'gh';
    if (fs.existsSync(c)) return `"${c}"`;
  }
  return 'gh';
}

const argv = process.argv.slice(2);
const wantWin = argv.includes('--win');
const wantMac = argv.includes('--mac');
const wantAll = argv.includes('--all');

let targets;
if (wantAll) {
  targets = ['win', 'mac'];
} else if (wantWin) {
  targets = ['win'];
} else if (wantMac) {
  targets = ['mac'];
} else {
  targets = [process.platform === 'darwin' ? 'mac' : 'win'];
}

if (targets.includes('mac') && process.platform !== 'darwin') {
  console.error('\nFAIL: macOS builds must run on macOS. Run `npm run release -- --mac` there, or split releases across CI runners.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const version = pkg.version;
const tag = `v${version}`;
const gh = findGhExe();

console.log(`\n=== Whisky release ${tag} (${targets.join(', ')}) ===\n`);

// Pull GH_TOKEN from gh CLI so electron-builder can upload to the release.
let token = '';
try {
  token = execSync(`${gh} auth token`, { encoding: 'utf8' }).trim();
} catch (err) {
  console.error('\nFAIL: gh CLI not authenticated. Run: gh auth login --web');
  process.exit(1);
}
process.env.GH_TOKEN = token;

// Build + publish (creates a DRAFT release with the installer + latest.yml).
for (const target of targets) {
  run(`npm run dist:${target} -- --publish always`);
}

// Flip the draft to Latest so auto-updater clients discover it.
console.log('\n→ promoting draft release to latest');
const ok = tryRun(
  `${gh} release edit ${tag} --repo ankitkumartiwari-web/whisky --draft=false --latest`
);

if (!ok) {
  console.error(`\nFAIL: could not promote ${tag} to latest. Check 'gh release list' and run manually.`);
  process.exit(1);
}

console.log(`\n✓ Released ${tag}. Installed clients will auto-update on next launch.`);
console.log(`  https://github.com/ankitkumartiwari-web/whisky/releases/tag/${tag}`);
