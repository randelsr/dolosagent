/**
 * Click tool - Click at specific coordinates
 */

import { tool } from 'ai';
import { z } from 'zod';
import { Page } from 'playwright';
import { addVisualMarker } from '../helpers';

export function createClickTool(page: Page) {
  return tool({
    description: 'Click at specific coordinates on the page. Use this to interact with buttons, links, or any clickable elements.',
    parameters: z.object({
      x: z.number().describe('X coordinate (horizontal position) where to click'),
      y: z.number().describe('Y coordinate (vertical position) where to click')
    }),
    execute: async ({ x, y }) => {
      try {
        // Log coordinates for debugging
        console.log(`  → Clicking at viewport coordinates: (${x}, ${y})`);

        // Add visual marker for debugging
        await addVisualMarker(page, x, y, 'red', 2000);

        // Perform click with visible pause
        await page.mouse.move(x, y);
        await page.waitForTimeout(2000); // Pause 2 seconds so you can see cursor position
        await page.mouse.click(x, y);

        // Wait for potential navigation/updates
        await page.waitForTimeout(1000);

        return `Clicked at coordinates (${x}, ${y})`;
      } catch (error: any) {
        throw new Error(`Click failed: ${error.message}`);
      }
    }
  });
}
