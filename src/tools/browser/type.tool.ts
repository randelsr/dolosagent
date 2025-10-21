/**
 * Type tool - Type text at specific coordinates with human-like delay
 */

import { tool } from 'ai';
import { z } from 'zod';
import { Page } from 'playwright';
import { addVisualMarker } from '../helpers';

export function createTypeTool(page: Page, typingDelay: number = 50) {
  return tool({
    description: 'Type text at specific coordinates. First clicks at the coordinates to focus, then types the text. Use \\n at the end to press Enter.',
    parameters: z.object({
      x: z.number().describe('X coordinate of the input field'),
      y: z.number().describe('Y coordinate of the input field'),
      text: z.string().describe('Text to type. End with \\n to automatically press Enter.')
    }),
    execute: async ({ x, y, text }) => {
      try {
        // Visual marker
        await addVisualMarker(page, x, y, 'blue', 2000);

        // Click to focus with visible pause
        await page.mouse.move(x, y);
        await page.waitForTimeout(2000); // Pause 2 seconds so you can see cursor position
        await page.mouse.click(x, y);
        await page.waitForTimeout(1000); // Wait for focus to take effect

        // Check if text ends with newline
        const pressEnter = text.endsWith('\n');
        const textToType = pressEnter ? text.slice(0, -1) : text;

        // Type text character by character with human-like delay
        for (const char of textToType) {
          await page.keyboard.type(char);
          await page.waitForTimeout(typingDelay);
        }

        // Press Enter if requested
        if (pressEnter) {
          await page.keyboard.press('Enter');
        }

        const displayText = text.replace(/\n/g, '\\n');

        return `Typed "${displayText}" at (${x}, ${y})${pressEnter ? ' and pressed Enter' : ''}`;
      } catch (error: any) {
        throw new Error(`Type failed: ${error.message}`);
      }
    }
  });
}
