/**
 * Type tool - Type text at specific coordinates with human-like delay
 */

import { tool } from 'ai';
import { z } from 'zod';
import { Page } from 'playwright';
import { addVisualMarker } from '../helpers';

export function createTypeTool(page: Page, typingDelay: number = 50) {
  return tool({
    description: 'Type text at specific coordinates. First clicks at the coordinates to focus, then types the text character by character.',
    parameters: z.object({
      x: z.number().describe('X coordinate of the input field'),
      y: z.number().describe('Y coordinate of the input field'),
      text: z.string().describe('Text to type')
    }),
    execute: async ({ x, y, text }) => {
      try {
        // Visual marker
        await addVisualMarker(page, x, y, 'blue', 2000);

        // Click to focus
        await page.mouse.move(x, y);
        await page.mouse.click(x, y);

        // Type text character by character with human-like delay
        for (const char of text) {
          await page.keyboard.type(char);
          await page.waitForTimeout(typingDelay);
        }

        return `Typed "${text}" at (${x}, ${y})`;
      } catch (error: any) {
        throw new Error(`Type failed: ${error.message}`);
      }
    }
  });
}
