/**
 * Forward tool - Navigate forward in browser history
 */

import { tool } from 'ai';
import { z } from 'zod';
import { Page } from 'playwright';
import { logger } from '../../core/logger';

export function createForwardTool(page: Page, networkWait: number = 2000) {
  return tool({
    description: 'Navigate forward in browser history (like clicking the forward button).',
    parameters: z.object({}),
    execute: async () => {
      try {
        await page.goForward({ waitUntil: 'domcontentloaded' });

        const url = page.url();
        const title = await page.title();

        // Network wait
        logger.debug(`  Network wait: ${networkWait}ms after forward navigation`);
        await page.waitForTimeout(networkWait);

        return `Navigated forward to ${url} (${title})`;
      } catch (error: any) {
        throw new Error(`Forward navigation failed: ${error.message}`);
      }
    }
  });
}
