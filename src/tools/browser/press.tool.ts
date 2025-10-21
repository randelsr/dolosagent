/**
 * Press key tool - Press a keyboard key
 */

import { tool } from 'ai';
import { z } from 'zod';
import { Page } from 'playwright';

export function createPressKeyTool(page: Page) {
  return tool({
    description: 'Press a keyboard key (e.g., Enter, Escape, Tab, etc.)',
    parameters: z.object({
      key: z.string().describe('Key name to press (Enter, Escape, Tab, ArrowDown, etc.)')
    }),
    execute: async ({ key }) => {
      try {
        await page.keyboard.press(key);
        await page.waitForTimeout(500);

        return `Pressed key: ${key}`;
      } catch (error: any) {
        throw new Error(`Key press failed: ${error.message}`);
      }
    }
  });
}
