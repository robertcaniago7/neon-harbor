// Neon Harbor 3D — main.ts
// Entrypoint (Node 22, standard library only). Copies game/ and screenshots/
// from beside itself to the output directory, then writes dossier.json with
// the vendored make.fun library.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(OUT, { recursive: true });
cpSync(join(HERE, 'game'), join(OUT, 'game'), { recursive: true });
cpSync(join(HERE, 'screenshots'), join(OUT, 'screenshots'), { recursive: true });

// Sanity: the game must have its page and at least 3 screenshots.
const indexExists = await import('node:fs').then((fs) => fs.existsSync(join(OUT, 'game', 'index.html')));
if (!indexExists) throw new Error('game/index.html missing from output');

const dossier = buildDossier(OUT, CAPS);
writeFileSync(join(OUT, 'dossier.json'), dossier);
console.log(`Neon Harbor dossier written: ${dossier.length} bytes -> ${join(OUT, 'dossier.json')}`);
