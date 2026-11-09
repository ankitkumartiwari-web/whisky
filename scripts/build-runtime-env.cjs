/* Build the runtime .env shipped inside installers.
 *
 * Start from .env.example (safe defaults / placeholders for everything that is not
 * meant to be public), then copy only the explicitly whitelisted values from the
 * developer's local .env. Server-side secrets such as SUPABASE_SERVICE_ROLE_KEY and
 * RESEND_API_KEY are never copied into the package.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const realEnvPath = path.join(root, '.env');
const examplePath = path.join(root, '.env.example');
const outPath = path.join(root, 'build', 'runtime.env');

// Keys that are safe/necessary to ship so AI features work without per-user setup.
// NOTE: anything listed here ends up readable inside the installer. Keep the list tiny
// and prefer keys with strict spending caps.
const OVERRIDE_FROM_REAL_ENV = [
  'OPENROUTER_API_KEY',
  'OPENROUTER_MODEL',
  'OPENROUTER_BASE_URL',
  'YOUTUBE_API_KEY',
];

function parseEnv(text) {
  const map = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    map.set(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  }
  return map;
}

if (!fs.existsSync(examplePath)) {
  throw new Error(`Missing ${examplePath}`);
}

const exampleText = fs.readFileSync(examplePath, 'utf8');
const real = fs.existsSync(realEnvPath)
  ? parseEnv(fs.readFileSync(realEnvPath, 'utf8'))
  : new Map();

const applied = [];
const lines = exampleText.split(/\r?\n/).map((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return line;
  const idx = trimmed.indexOf('=');
  if (idx === -1) return line;
  const key = trimmed.slice(0, idx).trim();
  if (!OVERRIDE_FROM_REAL_ENV.includes(key)) return line;
  const value = real.get(key);
  if (!value || /^your_/i.test(value)) return line;
  applied.push(key);
  return `${key}=${value}`;
});

for (const key of OVERRIDE_FROM_REAL_ENV) {
  if (applied.includes(key)) continue;
  const value = real.get(key);
  if (!value || /^your_/i.test(value)) continue;
  lines.push(`${key}=${value}`);
  applied.push(key);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');

console.log(`runtime env: ${outPath}`);
console.log(`overrides from .env: ${applied.join(', ') || '(none — no local .env found)'}`);
