// Neon Coast Cover Studio — the entry program (Node 22, standard library
// only). The app itself lives in app/ as plain static files: a desktop
// browser opens app/index.html, loads its photos and fonts from disk, and
// never makes a network request. This program hands that app in: it copies
// app/ and screenshots/ from beside this file into the grader's output
// directory and writes dossier.json there with the vendored make.fun
// library, so the judge can read the entry.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for
// /output, e.g.:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the app locally with `node serve.ts`, then open
// http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The scorer's caps for this bounty (reference/gate.json): the dossier text
// cap shapes the bytes; the rest refuse an entry the scorer would refuse —
// more than 4 screenshots, one over 256 KiB, app/ over 993 files or 48 MiB
// in all, or any app/ path over 1000 bytes.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function fail(message) {
  throw new Error(`neon-coast entry: ${message}`);
}

function countFiles(dir) {
  let total = 0;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) total += countFiles(path);
    else if (name.isFile()) total += 1;
  }
  return total;
}

function treeBytes(dir) {
  let total = 0;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, name.name);
    if (name.isDirectory()) total += treeBytes(path);
    else if (name.isFile()) total += statSync(path).size;
  }
  return total;
}

function main() {
  const repoRoot = fileURLToPath(new URL('.', import.meta.url));
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  const appDir = join(repoRoot, 'app');
  const shotsDir = join(repoRoot, 'screenshots');

  if (!existsSync(appDir)) fail('app/ is missing from the repository');
  if (!existsSync(join(appDir, 'index.html'))) fail('app/index.html is missing');
  if (countFiles(appDir) > CAPS.app_max_files) fail('app/ has more than 993 files');
  if (treeBytes(appDir) > CAPS.app_max_bytes) fail('app/ is over 48 MiB');

  mkdirSync(outDir, { recursive: true });
  cpSync(appDir, join(outDir, 'app'), { recursive: true });

  const shotNames = existsSync(shotsDir) ? readdirSync(shotsDir).sort() : [];
  if (shotNames.length < 3 || shotNames.length > CAPS.screenshots.max) {
    fail(`expected 3 or 4 screenshots, found ${shotNames.length}`);
  }
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  for (const name of shotNames) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > CAPS.screenshots.max_bytes) fail(`screenshots/${name} is over 256 KiB`);
  }
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

  writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, CAPS));
  console.log(`entry written to ${outDir} (${shotNames.length} screenshots)`);
}

main();
