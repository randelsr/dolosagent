/**
 * Back tool - Navigate back in browser history
 */

import { tool } from 'ai';
import { z } from 'zod';
import { Page } from 'playwright';
import { logger } from '../../core/logger';

export function createBackTool(page: Page, networkWait: number = 2000) {
  return tool({
    description: 'Navigate back to the previous page in browser history (like clicking the back button).',
    parameters: z.object({}),
    execute: async () => {
      try {
        await page.goBack({ waitUntil: 'domcontentloaded' });

        const url = page.url();
        const title = await page.title();

        // Network wait
        logger.debug(`  Network wait: ${networkWait}ms after back navigation`);
        await page.waitForTimeout(networkWait);

        return `Navigated back to ${url} (${title})`;
      } catch (error: any) {
        throw new Error(`Back navigation failed: ${error.message}`);
      }
    }
  });
}
