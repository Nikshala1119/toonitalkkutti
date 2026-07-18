import { supabase } from './supabase';

// Parent account + family/child linking (PRD §5.3, NFR-4).
// The app stays fully usable offline/local-only; these calls are what turn
// on cloud sync + the parent dashboard.

export interface ConsentInput {
  parentLanguage: 'ta' | 'en';
  cameraConsent: boolean;
}

export type AuthOutcome =
  | { ok: true; needsEmailConfirm: boolean }
  | { ok: false; message: string };

export async function signUpParent(email: string, password: string): Promise<AuthOutcome> {
  if (!supabase) return { ok: false, message: 'offline' };
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { ok: false, message: error.message };
  // With email confirmation enabled, session is null until the link is clicked.
  return { ok: true, needsEmailConfirm: !data.session };
}

export async function signInParent(email: string, password: string): Promise<AuthOutcome> {
  if (!supabase) return { ok: false, message: 'offline' };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: error.message };
  return { ok: true, needsEmailConfirm: false };
}

export async function signOutParent(): Promise<void> {
  await supabase?.auth.signOut();
}

export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Idempotently create/update this parent's `families` row, recording consent
 * timestamps (NFR-4: consent before child use; camera consent separate and
 * revocable). Returns the family id.
 */
export async function ensureFamily(consent: ConsentInput): Promise<string | null> {
  if (!supabase) return null;
  const userId = await currentUserId();
  if (!userId) return null;

  const { data: existing } = await supabase
    .from('families')
    .select('id, consent_given_at, camera_consent_at')
    .eq('parent_user_id', userId)
    .maybeSingle();

  const now = new Date().toISOString();
  if (existing) {
    const { error } = await supabase
      .from('families')
      .update({
        parent_language: consent.parentLanguage,
        consent_given_at: existing.consent_given_at ?? now,
        camera_consent_at: consent.cameraConsent
          ? (existing.camera_consent_at ?? now)
          : null,
      })
      .eq('id', existing.id);
    return error ? null : existing.id;
  }

  const { data, error } = await supabase
    .from('families')
    .insert({
      parent_user_id: userId,
      parent_language: consent.parentLanguage,
      consent_given_at: now,
      camera_consent_at: consent.cameraConsent ? now : null,
    })
    .select('id')
    .single();
  return error ? null : data.id;
}

export async function createChildProfile(args: {
  familyId: string;
  nickname: string;
  birthYearBand: '4-5' | '6-7';
  cameraEnabled: boolean;
}): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('children')
    .insert({
      family_id: args.familyId,
      nickname: args.nickname,
      birth_year_band: args.birthYearBand,
      camera_enabled: args.cameraEnabled,
    })
    .select('id')
    .single();
  return error ? null : data.id;
}
