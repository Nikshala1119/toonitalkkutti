import { UnitBundle } from '../types/curriculum';

// Bundled curriculum snapshot (copied from content/curriculum by
// `npm run sync-content`). In production the app also syncs the manifest from
// Supabase and caches downloaded clips (FR-2.1/FR-2.3); the bundled copy is
// the first-run/offline seed.

const unit1 = require('../../assets/curriculum/unit-01-colors-i.json') as UnitBundle;
const unit2 = require('../../assets/curriculum/unit-02-numbers-1-5.json') as UnitBundle;

export const unitBundles: UnitBundle[] = [unit1, unit2].sort(
  (a, b) => a.unit.position - b.unit.position,
);

export function getUnitBundle(unitId: number): UnitBundle | undefined {
  return unitBundles.find((u) => u.unit.id === unitId);
}
