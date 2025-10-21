/**
 * Forward tool - Navigate forward in browser history
 */

import { tool } from 'ai';
import { z } from 'zod';
import { Page } from 'playwright';

export function createForwardTool(page: Page) {
  return tool({
    description: 'Navigate forward in browser history (like clicking the forward button)',
    parameters: z.object({}),
    execute: async () => {
      try {
        await page.goForward({ waitUntil: 'domcontentloaded' });

        // Wait for page stability
        await page.waitForTimeout(1500);

        const url = page.url();
        const title = await page.title();

        return `Navigated forward to ${url} (${title})`;
      } catch (error: any) {
        throw new Error(`Forward navigation failed: ${error.message}`);
      }
    }
  });
}
