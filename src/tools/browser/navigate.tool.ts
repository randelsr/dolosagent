/**
 * Navigate tool - Navigate to a specific URL
 */

import { tool } from 'ai';
import { z } from 'zod';
import { Page } from 'playwright';

export function createNavigateTool(page: Page) {
  return tool({
    description: 'Navigate to a specific URL. Waits for the page to load.',
    parameters: z.object({
      url: z.string().describe('Full URL to navigate to (must include http:// or https://)')
    }),
    execute: async ({ url }) => {
      try {
        await page.goto(url, { waitUntil: 'load' });

        // Additional wait for dynamic content and page stability
        await page.waitForTimeout(1500);

        const finalUrl = page.url();
        const title = await page.title();

        return `Navigated to ${finalUrl} (${title})`;
      } catch (error: any) {
        throw new Error(`Navigation failed: ${error.message}`);
      }
    }
  });
}
