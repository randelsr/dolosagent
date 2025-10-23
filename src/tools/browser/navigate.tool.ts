/**
 * Navigate tool - Navigate to a specific URL
 */

import { tool } from 'ai';
import { z } from 'zod';
import { Page } from 'playwright';
import { logger } from '../../core/logger';

export function createNavigateTool(page: Page, networkWait: number = 2000) {
  return tool({
    description: 'Navigate to a specific URL.',
    parameters: z.object({
      url: z.string().describe('Full URL to navigate to (must include http:// or https://)')
    }),
    execute: async ({ url }) => {
      try {
        // Wait for networkidle to ensure JS rendering is complete
        await page.goto(url, { waitUntil: 'networkidle' });

        const finalUrl = page.url();
        const title = await page.title();

        // Additional programmatic wait after network idle
        logger.debug(`  Network wait: ${networkWait}ms after navigation`);
        await page.waitForTimeout(networkWait);

        return `Navigated to ${finalUrl} (${title})`;
      } catch (error: any) {
        throw new Error(`Navigation failed: ${error.message}`);
      }
    }
  });
}
