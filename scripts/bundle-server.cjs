const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const entry = path.join(root, 'server', 'resend-api.mjs');
const outdir = path.join(root, 'dist-server');
const outfile = path.join(outdir, 'resend-api.mjs');

fs.mkdirSync(outdir, { recursive: true });

esbuild.buildSync({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile,
  // Keep node built-ins external; everything else (dotenv, express, cors, resend,
  // @supabase/supabase-js, ytmusic-api) gets inlined so the packaged server is
  // a single self-contained .mjs and doesn't need node_modules at runtime.
  banner: {
    // Alias the import: the server source also imports createRequire, and a duplicate
    // top-level declaration makes the whole ESM bundle fail to parse at runtime.
    js: "import { createRequire as __bundleCreateRequire } from 'node:module'; const require = __bundleCreateRequire(import.meta.url);",
  },
  logLevel: 'info',
});

// Catch broken bundles at build time instead of shipping a server that immediately
// crashes with a SyntaxError (the app would silently fall back to file:// and every
// /api call would fail at runtime).
execFileSync(process.execPath, ['--check', outfile], { stdio: 'inherit' });

const stat = fs.statSync(outfile);
console.log(`bundled server: ${outfile} (${(stat.size / 1024).toFixed(1)} KB)`);
