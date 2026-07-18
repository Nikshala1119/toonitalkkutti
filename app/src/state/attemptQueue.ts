import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../data/supabase';

// Offline-first attempt log (NFR-2): every attempt is queued locally and
// synced at-least-once. The attempt id is generated on device so server
// writes are idempotent (primary-key upsert).

export interface AttemptRecord {
  id: string;
  child_id: string | null; // null until the profile is linked to a server row
  activity_id: string;
  skill: string;
  tries: number;
  stars: number;
  outcome: 'success' | 'helped' | 'skipped';
  validation_source: 'device' | 'cloud' | 'tap';
  duration_ms: number;
  client_created_at: string; // ISO
}

const QUEUE_KEY = 'toontalk.attemptQueue.v1';

function uuidv4(): string {
  // RFC-4122-shaped id; cryptographic strength is not required for an
  // idempotency key. Swap for expo-crypto randomUUID if we add that dep.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function newAttemptId(): string {
  return uuidv4();
}

async function readQueue(): Promise<AttemptRecord[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as AttemptRecord[]) : [];
}

async function writeQueue(queue: AttemptRecord[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueAttempt(record: AttemptRecord): Promise<void> {
  const queue = await readQueue();
  queue.push(record);
  await writeQueue(queue);
}

/**
 * Push queued attempts to Supabase. Safe to call any time; keeps records
 * that fail (or that have no server child id yet) for the next run.
 */
export async function syncAttempts(): Promise<{ synced: number; pending: number }> {
  const queue = await readQueue();
  if (!supabase || queue.length === 0) {
    return { synced: 0, pending: queue.length };
  }

  const ready = queue.filter((a) => a.child_id !== null);
  if (ready.length === 0) return { synced: 0, pending: queue.length };

  const { error } = await supabase
    .from('attempts')
    .upsert(ready, { onConflict: 'id', ignoreDuplicates: true });

  if (error) {
    return { synced: 0, pending: queue.length };
  }

  const syncedIds = new Set(ready.map((a) => a.id));
  const remaining = queue.filter((a) => !syncedIds.has(a.id));
  await writeQueue(remaining);
  return { synced: ready.length, pending: remaining.length };
}
