/**
 * Wait tool - Wait for a specified duration
 */

import { tool } from 'ai';
import { z } from 'zod';
import { Page } from 'playwright';

export function createWaitTool(page: Page) {
  return tool({
    description: 'Wait for a specified duration in milliseconds.',
    parameters: z.object({
      ms: z.number().max(10000).describe('Milliseconds to wait (max 10000)')
    }),
    execute: async ({ ms }) => {
      try {
        await page.waitForTimeout(ms);
        return `Waited for ${ms}ms`;
      } catch (error: any) {
        throw new Error(`Wait failed: ${error.message}`);
      }
    }
  });
}
