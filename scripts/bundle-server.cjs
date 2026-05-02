const path = require('node:path');
const fs = require('node:fs');
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
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
});

const stat = fs.statSync(outfile);
console.log(`bundled server: ${outfile} (${(stat.size / 1024).toFixed(1)} KB)`);
