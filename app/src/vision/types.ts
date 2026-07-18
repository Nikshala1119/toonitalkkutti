// Vision provider interface (PRD §5.4).
//
// Production targets:
//   fingers  → MediaPipe Hands (21 landmarks → extended-finger count), needs a
//              dev-build native module (react-native-vision-camera frame
//              processor or a custom MediaPipe binding) — NOT available in Expo Go.
//   color    → center-region HSV dominant-color sampling on preview frames.
//   objects  → on-device lite detector, cloud fallback via Edge Function.
//
// The MockVisionProvider makes the full activity loop playable in Expo Go
// today: the dev overlay simulates detections.

export interface FingerResult {
  kind: 'fingers';
  count: number;
  /** True once the same count was seen across 5 consecutive frames (§5.4) */
  stable: boolean;
}

export interface ColorResult {
  kind: 'color';
  color: string; // 'red' | 'blue' | ... dominant color name
  stable: boolean;
}

export interface CountResult {
  kind: 'count';
  count: number;
  confidence: number;
  stable: boolean;
}

export type VisionResult = FingerResult | ColorResult | CountResult;

export type VisionMode = 'fingers' | 'color' | 'count';

export interface VisionProvider {
  /** Start analyzing; calls onResult whenever a stable pose/answer is seen. */
  start(mode: VisionMode, onResult: (r: VisionResult) => void): void;
  stop(): void;
}
