/**
 * Scroll tool - Scroll the page in a direction
 */

import { tool } from 'ai';
import { z } from 'zod';
import { Page } from 'playwright';

export function createScrollTool(page: Page) {
  return tool({
    description: 'Scroll the page in a direction by 500 pixels.',
    parameters: z.object({
      direction: z.enum(['up', 'down', 'left', 'right']).describe('Direction to scroll')
    }),
    execute: async ({ direction }) => {
      try {
        const amount = 500;
        const scrollMap = {
          up: { x: 0, y: -amount },
          down: { x: 0, y: amount },
          left: { x: -amount, y: 0 },
          right: { x: amount, y: 0 }
        };

        const delta = scrollMap[direction];

        await page.mouse.wheel(delta.x, delta.y);
        await page.waitForTimeout(500);

        return `Scrolled ${direction} by ${amount}px`;
      } catch (error: any) {
        throw new Error(`Scroll failed: ${error.message}`);
      }
    }
  });
}
