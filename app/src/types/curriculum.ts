// Shared curriculum types. content/curriculum/*.json is the source of truth;
// content/scripts/sync-to-app.mjs copies it into app/assets/curriculum/.

export type LanguageLevel = 'A' | 'B' | 'C';

export type ActivityType =
  | 'tap_answer'
  | 'show_fingers'
  | 'find_color'
  | 'count_show'
  | 'say_it_back';

export interface PromptVariant {
  /** Tamil line, spoken first at level A */
  ta?: string;
  /** English line */
  en?: string;
}

export interface TapChoice {
  id: string;
  /** Key into the asset registry (placeholder art for now) */
  image: string;
}

export interface TapPayload {
  kind: 'tap_answer';
  choices: TapChoice[];
  correctId: string;
}

export interface FingersPayload {
  kind: 'show_fingers';
  count: number;
}

export interface ColorPayload {
  kind: 'find_color';
  color: string;
}

export interface CountPayload {
  kind: 'count_show';
  count: number;
}

export interface SayPayload {
  kind: 'say_it_back';
  word: string;
  image?: string;
}

export type ActivityPayload =
  | TapPayload
  | FingersPayload
  | ColorPayload
  | CountPayload
  | SayPayload;

export interface Activity {
  id: string;
  type: ActivityType;
  skill: string;
  isReview?: boolean;
  prompts: Record<LanguageLevel, PromptVariant>;
  payload: ActivityPayload;
  /** FR-3.5: every camera activity has a tap-based fallback variant */
  tapFallback?: TapPayload;
}

export interface Unit {
  id: number;
  slug: string;
  titleEn: string;
  titleTa: string;
  position: number;
  isFree: boolean;
}

export interface UnitBundle {
  unit: Unit;
  activities: Activity[];
}
