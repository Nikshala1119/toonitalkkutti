import { Directory, File, Paths } from 'expo-file-system';

// Clip cache (FR-1.3): pre-generated tutor clips + viseme timelines are
// downloaded from the public `tutor-clips` Storage bucket and kept in the
// document directory so activities work offline after first sync (FR-2.3).

export interface VisemeTimeline {
  durationMs: number;
  events: Array<{ t: number; shape: string }>;
}

const base = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tutor-clips`
  : null;

function clipDir(): Directory {
  const dir = new Directory(Paths.document, 'tutor-clips');
  if (!dir.exists) dir.create();
  return dir;
}

async function getCached(fileName: string): Promise<File | null> {
  try {
    const dir = clipDir();
    const f = new File(dir, fileName);
    if (f.exists) return f;
    if (!base) return null;
    const out = await File.downloadFileAsync(`${base}/${fileName}`, dir);
    return out as File;
  } catch {
    return null; // offline and not cached, or clip not generated yet
  }
}

/** Local URI for a clip's audio, downloading on first use. Null → fall back to device TTS. */
export async function getClipUri(clipId: string): Promise<string | null> {
  const f = await getCached(`${clipId}.mp3`);
  return f?.uri ?? null;
}

/** Mouth-shape timeline for a clip, if the provider produced one. */
export async function getVisemes(clipId: string): Promise<VisemeTimeline | null> {
  const f = await getCached(`${clipId}.viseme.json`);
  if (!f) return null;
  try {
    return JSON.parse(await f.text()) as VisemeTimeline;
  } catch {
    return null;
  }
}

/** Background prefetch for a session's clips so playback never waits (FR-2.3). */
export function prefetchClips(clipIds: string[]): void {
  for (const id of clipIds) {
    getClipUri(id).catch(() => undefined);
    getVisemes(id).catch(() => undefined);
  }
}
