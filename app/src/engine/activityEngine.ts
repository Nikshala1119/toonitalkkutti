// Activity loop state machine (PRD §3.3):
//   Ask → Child responds → Validate → Feedback → (Retry ×2 max) → Reward
// After two failed tries the tutor demonstrates the answer, awards 1 star
// for effort, and moves on. No lives, no timers, no lockouts.

export type ActivityPhase =
  | 'asking'         // tutor is speaking the prompt
  | 'awaiting'       // waiting for the child's answer
  | 'celebrating'    // correct answer feedback
  | 'encouraging'    // wrong answer, warm re-ask coming
  | 'demonstrating'  // tutor shows the answer after 2 misses
  | 'done';

export type ActivityOutcome = 'success' | 'helped';

export interface ActivityRunState {
  phase: ActivityPhase;
  /** Attempt number the child is on (1-based) */
  tryNumber: number;
  stars: 0 | 1 | 2 | 3;
  outcome: ActivityOutcome | null;
}

export type ActivityEvent =
  | { type: 'PROMPT_DONE' }      // tutor finished asking
  | { type: 'ANSWER'; correct: boolean }
  | { type: 'FEEDBACK_DONE' }    // celebration / encouragement finished
  | { type: 'DEMO_DONE' };       // demonstration finished

export const initialRunState: ActivityRunState = {
  phase: 'asking',
  tryNumber: 1,
  stars: 0,
  outcome: null,
};

export function starsForTry(tryNumber: number): 1 | 2 | 3 {
  if (tryNumber <= 1) return 3;
  if (tryNumber === 2) return 2;
  return 1;
}

export function reduceActivity(
  state: ActivityRunState,
  event: ActivityEvent,
): ActivityRunState {
  switch (state.phase) {
    case 'asking':
      if (event.type === 'PROMPT_DONE') return { ...state, phase: 'awaiting' };
      return state;

    case 'awaiting':
      if (event.type !== 'ANSWER') return state;
      if (event.correct) {
        return {
          ...state,
          phase: 'celebrating',
          stars: starsForTry(state.tryNumber),
          outcome: 'success',
        };
      }
      if (state.tryNumber >= 2) {
        // Two failed tries → demonstrate, 1 star for effort, move on
        return { ...state, phase: 'demonstrating', stars: 1, outcome: 'helped' };
      }
      return { ...state, phase: 'encouraging' };

    case 'celebrating':
      if (event.type === 'FEEDBACK_DONE') return { ...state, phase: 'done' };
      return state;

    case 'encouraging':
      if (event.type === 'FEEDBACK_DONE') {
        return { ...state, phase: 'asking', tryNumber: state.tryNumber + 1 };
      }
      return state;

    case 'demonstrating':
      if (event.type === 'DEMO_DONE') return { ...state, phase: 'done' };
      return state;

    case 'done':
      return state;
  }
}
