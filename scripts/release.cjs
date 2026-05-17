#!/usr/bin/env node
// One-shot release: builds the NSIS installer, publishes to GitHub as a draft
// release tied to the current package.json version, then flips it from draft
// to "Latest" so auto-updater clients pick it up.
//
// Prereqs:
//   - gh CLI installed and authenticated (gh auth login)
//   - package.json version bumped (see notes below)
//
// Usage:
//   npm run release
//
// Tip: bump the version with `npm version patch|minor|major` first so the
// release picks up the new tag. Auto-updater only triggers when the published
// version is higher than what's installed.

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
  const candidates = [
    'C:/Program Files/GitHub CLI/gh.exe',
    'C:/Program Files (x86)/GitHub CLI/gh.exe',
    'gh',
  ];
  for (const c of candidates) {
    if (c === 'gh') return 'gh';
    if (fs.existsSync(c)) return `"${c}"`;
  }
  return 'gh';
}

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const version = pkg.version;
const tag = `v${version}`;
const gh = findGhExe();

console.log(`\n=== Whisky release ${tag} ===\n`);

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
run('npm run dist:win -- --publish always');

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
