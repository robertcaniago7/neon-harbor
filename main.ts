// Neon Harbor 3D — entrypoint.
// Copies game/ and screenshots/ from beside this file to /output (or
// $MAKEFUN_OUTPUT_DIR when set) and writes /output/dossier.json with the
// vendored make.fun library. Node 22, standard library only.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTree(name: string): void {
  const src = join(here, name);
  const dst = join(outDir, name);
  if (!existsSync(src)) {
    console.log(`skip: ${name}/ not present`);
    return;
  }
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log(`copied ${name}/ -> ${dst}`);
}

function main(): void {
  mkdirSync(outDir, { recursive: true });
  copyTree('game');
  copyTree('screenshots');
  const dossier = buildDossier(outDir, CAPS);
  const dossierPath = join(outDir, 'dossier.json');
  writeFileSync(dossierPath, dossier);
  console.log(`wrote ${dossierPath} (${dossier.length} bytes)`);
  // Sanity check: the dossier must parse back as JSON with the expected
  // top-level shape (schema + text + cover + images).
  const parsed = JSON.parse(new TextDecoder('utf-8').decode(dossier)) as {
    schema?: string;
    text?: string;
  };
  if (typeof parsed.schema !== 'string' || typeof parsed.text !== 'string') {
    throw new Error('dossier is missing its schema/text');
  }
  console.log(`dossier OK: schema ${parsed.schema}, text ${parsed.text.length} chars`);
}

main();
