// Neon Harbor 3D — entrypoint (make.fun gta6-01).
// Node 22+, standard library only, erasable TypeScript: runs as-is under
// `node main.ts` with no flags, no build and no install.
//
// Copies game/ and screenshots/ from beside itself to /output (or
// $MAKEFUN_OUTPUT_DIR when set) and writes /output/dossier.json with the
// vendored make.fun library (./vendor/makefun-game.ts).

import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Copy a directory (recursively) into the output, creating it first. */
function copyDir(name: string): void {
  const src = join(here, name);
  const dst = join(outDir, name);
  if (!existsSync(src)) {
    throw new Error(`main.ts: ${name}/ is missing beside main.ts`);
  }
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
}

/** The bounty gate's caps (from the spec): what buildDossier is held to. */
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function main(): void {
  mkdirSync(outDir, { recursive: true });
  copyDir('game');
  copyDir('screenshots');
  const dossier = buildDossier(outDir, CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`Neon Harbor 3D: wrote ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
}

main();
