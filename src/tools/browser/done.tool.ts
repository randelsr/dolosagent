/**
 * Done tool - Mark the current task as complete
 */

import { tool } from 'ai';
import { z } from 'zod';
import { Page } from 'playwright';

export function createDoneTool(page: Page) {
  return tool({
    description: 'Mark the current task as complete. Use this when the objective has been achieved.',
    parameters: z.object({
      result: z.string().describe('Final result or summary of what was accomplished')
    }),
    execute: async ({ result }) => {
      return `Task completed: ${result}`;
    }
  });
}
