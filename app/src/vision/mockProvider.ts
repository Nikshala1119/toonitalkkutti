import { VisionMode, VisionProvider, VisionResult } from './types';

// Dev-only provider: the CameraStage overlay calls simulate() when the tester
// taps a simulated answer. Swap for the MediaPipe-backed provider in the
// dev-build (see src/vision/types.ts header).
class MockVisionProvider implements VisionProvider {
  private handler: ((r: VisionResult) => void) | null = null;
  private mode: VisionMode | null = null;

  start(mode: VisionMode, onResult: (r: VisionResult) => void) {
    this.mode = mode;
    this.handler = onResult;
  }

  stop() {
    this.handler = null;
    this.mode = null;
  }

  get activeMode(): VisionMode | null {
    return this.mode;
  }

  simulateFingers(count: number) {
    if (this.mode === 'fingers') {
      this.handler?.({ kind: 'fingers', count, stable: true });
    }
  }

  simulateColor(color: string) {
    if (this.mode === 'color') {
      this.handler?.({ kind: 'color', color, stable: true });
    }
  }

  simulateCount(count: number) {
    if (this.mode === 'count') {
      this.handler?.({ kind: 'count', count, confidence: 1, stable: true });
    }
  }
}

export const mockVision = new MockVisionProvider();
