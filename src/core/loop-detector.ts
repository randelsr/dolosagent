/**
 * Loop Detector - Identifies repetitive action patterns
 */

import { ActionStep } from '../types/memory.types';

export class LoopDetector {
  private readonly maxRepetitions = 3;

  detectLoop(recentActions: ActionStep[]): { isLooping: boolean; message?: string } {
    if (recentActions.length < 2) {
      return { isLooping: false };
    }

    const lastAction = recentActions[recentActions.length - 1];
    let repetitionCount = 0;

    for (const action of recentActions.slice(-5)) {
      if (this.actionsAreSimilar(action, lastAction)) {
        repetitionCount++;
      }
    }

    if (repetitionCount >= this.maxRepetitions) {
      return {
        isLooping: true,
        message: `LOOP DETECTED: Repeated ${lastAction.toolName} ${repetitionCount} times. Try a different approach!`
      };
    }

    return { isLooping: false };
  }

  private actionsAreSimilar(a: ActionStep, b: ActionStep): boolean {
    if (a.toolName !== b.toolName) return false;

    // For coordinate actions, check proximity
    if (a.toolName === 'click' || a.toolName === 'type') {
      const xDiff = Math.abs((a.parameters.x || 0) - (b.parameters.x || 0));
      const yDiff = Math.abs((a.parameters.y || 0) - (b.parameters.y || 0));
      return xDiff < 10 && yDiff < 10;
    }

    // For other actions, compare parameters
    return JSON.stringify(a.parameters) === JSON.stringify(b.parameters);
  }
}
