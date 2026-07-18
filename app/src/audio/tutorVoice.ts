import * as Speech from 'expo-speech';
import { AudioPlayer, createAudioPlayer } from 'expo-audio';
import { LanguageLevel, PromptVariant } from '../types/curriculum';
import { getClipUri, getVisemes } from './clipStore';

// Tutor voice (FR-1.3): plays pre-generated clips (with viseme-driven mouth
// timelines) when available; falls back to on-device expo-speech until the
// clip pipeline (content/scripts/generate-tts.mjs) has run for a line.
// Call sites only use speakPrompt/speakLine, so the swap is contained here.

export type SpeakDone = () => void;

// --- viseme fan-out (Tutor subscribes for mouth animation) -----------------

type VisemeListener = (shape: string) => void;
const visemeListeners = new Set<VisemeListener>();
let visemeTimers: ReturnType<typeof setTimeout>[] = [];
let mouthCycleTimer: ReturnType<typeof setInterval> | null = null;

// Fallback mouth animation for clips without a viseme timeline (non-Azure
// providers): cycle plausible shapes while audio is actually playing.
const CYCLE_SHAPES = ['A', 'E', 'O', 'M', 'E', 'A', 'W', 'E'];

function startMouthCycle() {
  stopMouthCycle();
  let i = 0;
  mouthCycleTimer = setInterval(() => {
    emitViseme(CYCLE_SHAPES[i % CYCLE_SHAPES.length]);
    i += 1;
  }, 120);
}

function stopMouthCycle() {
  if (mouthCycleTimer) {
    clearInterval(mouthCycleTimer);
    mouthCycleTimer = null;
  }
}

export function subscribeVisemes(cb: VisemeListener): () => void {
  visemeListeners.add(cb);
  return () => visemeListeners.delete(cb);
}

function emitViseme(shape: string) {
  for (const cb of visemeListeners) cb(shape);
}

function clearVisemeSchedule() {
  for (const t of visemeTimers) clearTimeout(t);
  visemeTimers = [];
  stopMouthCycle();
  emitViseme('rest');
}

// --- playback --------------------------------------------------------------

let activePlayer: AudioPlayer | null = null;

function stopClip() {
  if (activePlayer) {
    try {
      activePlayer.remove();
    } catch {
      // already released
    }
    activePlayer = null;
  }
  clearVisemeSchedule();
}

async function playClip(clipId: string, onDone: SpeakDone): Promise<boolean> {
  const uri = await getClipUri(clipId);
  if (!uri) return false;

  stopClip();
  const player = createAudioPlayer(uri);
  activePlayer = player;

  const visemes = await getVisemes(clipId);
  if (visemes) {
    for (const ev of visemes.events) {
      visemeTimers.push(setTimeout(() => emitViseme(ev.shape), ev.t));
    }
    visemeTimers.push(
      setTimeout(() => emitViseme('rest'), visemes.durationMs + 50),
    );
  } else {
    startMouthCycle();
  }

  player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish && activePlayer === player) {
      stopClip();
      onDone();
    }
  });
  player.play();
  return true;
}

function speakOne(text: string, language: string, onDone: SpeakDone) {
  Speech.speak(text, {
    language,
    rate: 0.9, // slightly slow for young children
    onDone,
    onError: onDone, // never wedge the activity loop on a TTS error
  });
}

/**
 * Speak a prompt for the given language level.
 * Level A speaks Tamil first then English; B/C lead with English (§3.2).
 * If `clipId` resolves to a generated clip, that plays instead (with visemes).
 */
export function speakPrompt(
  prompt: PromptVariant,
  level: LanguageLevel,
  onDone: SpeakDone,
  clipId?: string,
) {
  const fallback = () => {
    const parts: Array<{ text: string; language: string }> = [];
    if (level === 'A') {
      if (prompt.ta) parts.push({ text: prompt.ta, language: 'ta-IN' });
      if (prompt.en) parts.push({ text: prompt.en, language: 'en-IN' });
    } else {
      if (prompt.en) parts.push({ text: prompt.en, language: 'en-IN' });
      if (level === 'B' && prompt.ta) parts.push({ text: prompt.ta, language: 'ta-IN' });
    }
    if (parts.length === 0) {
      onDone();
      return;
    }
    let i = 0;
    const next = () => {
      if (i >= parts.length) {
        onDone();
        return;
      }
      const p = parts[i++];
      speakOne(p.text, p.language, next);
    };
    next();
  };

  if (clipId) {
    playClip(clipId, onDone).then((played) => {
      if (!played) fallback();
    });
  } else {
    fallback();
  }
}

export function speakLine(
  text: string,
  language: 'ta-IN' | 'en-IN',
  onDone: SpeakDone,
  clipId?: string,
) {
  if (clipId) {
    playClip(clipId, onDone).then((played) => {
      if (!played) speakOne(text, language, onDone);
    });
  } else {
    speakOne(text, language, onDone);
  }
}

export function stopSpeaking() {
  Speech.stop();
  stopClip();
}

// In-character stock lines. Single source of truth is
// content/curriculum/stock-lines.json (synced into assets); ids map to
// pre-generated clips.
interface StockLine {
  id: string;
  ta: string | null;
  en: string | null;
}

export const stockLines = require('../../assets/curriculum/stock-lines.json') as {
  encourage: StockLine[];
  celebrate: StockLine[];
  demo: StockLine;
  sessionEnd: StockLine;
};

/** Speak a stock line: clip first, composed device-TTS fallback. */
export function speakStockLine(line: StockLine, onDone: SpeakDone) {
  playClip(line.id, onDone).then((played) => {
    if (played) return;
    const parts: Array<{ text: string; language: 'ta-IN' | 'en-IN' }> = [];
    if (line.ta) parts.push({ text: line.ta, language: 'ta-IN' });
    if (line.en) parts.push({ text: line.en, language: 'en-IN' });
    let i = 0;
    const next = () => {
      if (i >= parts.length) {
        onDone();
        return;
      }
      const p = parts[i++];
      speakOne(p.text, p.language, next);
    };
    next();
  });
}
