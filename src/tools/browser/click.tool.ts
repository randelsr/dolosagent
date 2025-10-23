/**
 * Click tool - Click at specific coordinates
 */

import { tool } from 'ai';
import { z } from 'zod';
import { Page } from 'playwright';
import { addVisualMarker } from '../helpers';
import { logger } from '../../core/logger';

export function createClickTool(page: Page, networkWait: number = 2000) {
  return tool({
    description: 'Click at specific coordinates on the page. Use this to interact with buttons, links, or any clickable elements.',
    parameters: z.object({
      x: z.number().describe('X coordinate (horizontal position) where to click'),
      y: z.number().describe('Y coordinate (vertical position) where to click')
    }),
    execute: async ({ x, y }) => {
      try {
        // Log coordinates for debugging
        logger.debug(`  → Clicking at viewport coordinates: (${x}, ${y})`);

        // Add visual marker for debugging
        await addVisualMarker(page, x, y, 'red', 2000);

        // Perform click
        await page.mouse.move(x, y);
        await page.mouse.click(x, y);

        // Simple timeout - see README for future improvement opportunities
        logger.debug(`  Network wait: ${networkWait}ms after click`);
        await page.waitForTimeout(networkWait);

        return `Clicked at coordinates (${x}, ${y})`;
      } catch (error: any) {
        throw new Error(`Click failed: ${error.message}`);
      }
    }
  });
}
