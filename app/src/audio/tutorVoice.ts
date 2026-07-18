import * as Speech from 'expo-speech';
import { LanguageLevel, PromptVariant } from '../types/curriculum';

// FR-1.3: production uses pre-generated TTS clips + viseme JSON cached on
// device (played via expo-audio), zero runtime TTS. Until the clip pipeline
// (content/scripts/generate-tts.mjs) has run, we fall back to on-device
// expo-speech so the app is testable end to end. The call sites only use
// speakPrompt/speakLine, so swapping in the clip player is contained here.

export type SpeakDone = () => void;

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
 */
export function speakPrompt(
  prompt: PromptVariant,
  level: LanguageLevel,
  onDone: SpeakDone,
) {
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
}

export function speakLine(text: string, language: 'ta-IN' | 'en-IN', onDone: SpeakDone) {
  speakOne(text, language, onDone);
}

export function stopSpeaking() {
  Speech.stop();
}

// In-character stock lines (will become pre-generated clips).
export const stockLines = {
  encourage: [
    { ta: 'பரவாயில்லை! இன்னொரு முறை முயற்சி செய்!', en: "Let's try again!" },
    { ta: 'கிட்டத்தட்ட சரி! மறுபடியும் பார்ப்போம்!', en: 'Almost! One more try!' },
  ],
  celebrate: [
    { ta: 'சூப்பர்!', en: 'Super! Well done!' },
    { ta: 'அருமை!', en: 'Great job!' },
    { ta: 'வெரி குட்!', en: 'You did it!' },
  ],
  demo: { ta: 'பார், நான் காட்டுறேன்!', en: 'Watch me — here is the answer!' },
  sessionEnd: { ta: 'நல்லா வேலை செய்த! நாளைக்கு பார்க்கலாம்!', en: 'Great work today! See you tomorrow!' },
};
