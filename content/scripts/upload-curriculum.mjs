// Upserts content/curriculum/*.json into the Supabase `units` and
// `activities` tables (PRD §5.2 step 3). Requires env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (service role — build-time only,
//   never ship this key in the app)
//
// Usage:  node content/scripts/upload-curriculum.mjs

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(url, key);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const curriculumDir = join(root, 'content', 'curriculum');
const files = (await readdir(curriculumDir)).filter((f) => f.endsWith('.json'));

for (const file of files) {
  const bundle = JSON.parse(await readFile(join(curriculumDir, file), 'utf8'));
  const u = bundle.unit;

  const { error: unitErr } = await supabase.from('units').upsert({
    id: u.id,
    slug: u.slug,
    title_en: u.titleEn,
    title_ta: u.titleTa,
    position: u.position,
    is_free: u.isFree,
  });
  if (unitErr) throw new Error(`unit ${u.slug}: ${unitErr.message}`);

  const rows = bundle.activities.map((a, i) => ({
    id: a.id,
    unit_id: u.id,
    position: i + 1,
    activity_type: a.type,
    skill: a.skill,
    spec: a,
    updated_at: new Date().toISOString(),
  }));
  const { error: actErr } = await supabase.from('activities').upsert(rows);
  if (actErr) throw new Error(`activities ${u.slug}: ${actErr.message}`);

  console.log(`Upserted unit ${u.id} (${u.slug}) with ${rows.length} activities`);
}
