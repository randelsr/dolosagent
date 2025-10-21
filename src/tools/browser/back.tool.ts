/**
 * Back tool - Navigate back in browser history
 */

import { tool } from 'ai';
import { z } from 'zod';
import { Page } from 'playwright';

export function createBackTool(page: Page) {
  return tool({
    description: 'Navigate back to the previous page in browser history (like clicking the back button)',
    parameters: z.object({}),
    execute: async () => {
      try {
        await page.goBack({ waitUntil: 'domcontentloaded' });

        // Wait for page stability
        await page.waitForTimeout(1500);

        const url = page.url();
        const title = await page.title();

        return `Navigated back to ${url} (${title})`;
      } catch (error: any) {
        throw new Error(`Back navigation failed: ${error.message}`);
      }
    }
  });
}
