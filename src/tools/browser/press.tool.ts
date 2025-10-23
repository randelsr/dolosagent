/**
 * Press key tool - Press a keyboard key
 */

import { tool } from 'ai';
import { z } from 'zod';
import { Page } from 'playwright';
import { logger } from '../../core/logger';

export function createPressKeyTool(page: Page, networkWait: number = 2000) {
  return tool({
    description: 'Press a keyboard key (e.g., Enter, Escape, Tab, etc.).',
    parameters: z.object({
      key: z.string().describe('Key name to press (Enter, Escape, Tab, ArrowDown, etc.)')
    }),
    execute: async ({ key }) => {
      try {
        await page.keyboard.press(key);

        // Simple timeout - see README for future improvement opportunities
        logger.debug(`  Network wait: ${networkWait}ms after pressing ${key}`);
        await page.waitForTimeout(networkWait);

        return `Pressed key: ${key}`;
      } catch (error: any) {
        throw new Error(`Key press failed: ${error.message}`);
      }
    }
  });
}
