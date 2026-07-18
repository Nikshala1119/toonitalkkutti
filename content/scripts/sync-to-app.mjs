// Copies content/curriculum/*.json into app/assets/curriculum/ so Metro can
// bundle it. content/ is the source of truth — never edit the app copies.
// Run from repo root or app/:  node content/scripts/sync-to-app.mjs
import { cp, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = join(root, 'content', 'curriculum');
const dest = join(root, 'app', 'assets', 'curriculum');

await mkdir(dest, { recursive: true });
const files = (await readdir(src)).filter((f) => f.endsWith('.json'));
for (const f of files) {
  await cp(join(src, f), join(dest, f));
}
console.log(`Synced ${files.length} curriculum file(s) → app/assets/curriculum/`);
