/**
 * Browser observation system - captures screenshots and extracts DOM state
 */

import { Page } from 'playwright';
import { BrowserState, InteractiveElement } from '../types/agent.types';
import { logger } from './logger';

export class BrowserObserver {
  constructor(private page: Page) {}

  async captureState(): Promise<BrowserState> {
    logger.debugHeader('CAPTURING PAGE STATE');

    const screenshotBuffer = await this.page.screenshot();
    const screenshot = screenshotBuffer.toString('base64');
    logger.debug(`Screenshot captured: ${screenshotBuffer.length} bytes (base64: ${screenshot.length} chars)`);

    const url = this.page.url();
    const title = await this.page.title();
    const viewportSize = this.page.viewportSize() || { width: 1280, height: 720 };
    logger.debug(`Page metadata: ${title}`);
    logger.debug(`URL: ${url}`);
    logger.debug(`Viewport: ${viewportSize.width}x${viewportSize.height}`);

    logger.debugHeader('ANALYZING PAGE CONTENT');
    const elements = await this.extractInteractiveElements();

    const visibleElements = elements.filter(e => e.isVisible);
    logger.debug(`Found ${elements.length} interactive elements (${visibleElements.length} visible)`);

    logger.debug('\nTop 10 visible elements:');
    visibleElements.slice(0, 10).forEach((el, idx) => {
      const label = el.text || el.placeholder || el.ariaLabel || el.role || el.tag;
      logger.debug(`  ${idx + 1}. ${el.tag}${el.type ? `[${el.type}]` : ''} at (${el.x}, ${el.y}) - "${label.substring(0, 50)}"`);
    });
    logger.debugSeparator();

    return {
      url,
      title,
      screenshot,
      elements,
      viewportSize
    };
  }

  private async extractInteractiveElements(): Promise<InteractiveElement[]> {
    return await this.page.evaluate(() => {
      const elements: any[] = [];

      // Interactive element selectors
      const selectors = [
        'a[href]',
        'button',
        'input',
        'textarea',
        'select',
        '[contenteditable="true"]',
        '[role="button"]',
        '[role="link"]',
        '[role="textbox"]',
        '[role="searchbox"]',
        '[onclick]'
      ];

      const nodes = document.querySelectorAll(selectors.join(','));

      nodes.forEach((node: any) => {
        const element = node as HTMLElement;

        // Skip debug markers from Dolos agent
        if (element.classList.contains('dolos-debug-marker')) {
          return;
        }

        const rect = element.getBoundingClientRect();

        // Only include visible elements
        if (
          rect.width === 0 ||
          rect.height === 0 ||
          window.getComputedStyle(element).visibility === 'hidden' ||
          window.getComputedStyle(element).display === 'none'
        ) {
          return;
        }

        const isVisible = rect.top >= 0 && rect.left >= 0 &&
          rect.bottom <= window.innerHeight &&
          rect.right <= window.innerWidth;

        // Calculate center coordinates
        // getBoundingClientRect already includes scroll offset and gives viewport coordinates
        // which is what Playwright's mouse.click expects
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const item: any = {
          tag: element.tagName.toLowerCase(),
          type: element.getAttribute('type') || undefined,
          text: element.textContent?.trim().substring(0, 100) || undefined,
          placeholder: element.getAttribute('placeholder') || undefined,
          ariaLabel: element.getAttribute('aria-label') || undefined,
          role: element.getAttribute('role') || undefined,
          x: Math.round(centerX),
          y: Math.round(centerY),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          isVisible
        };

        elements.push(item);
      });

      return elements;
    });
  }

  formatStateAsText(state: BrowserState): string {
    const visibleElements = state.elements.filter(e => e.isVisible);
    const lines: string[] = [];

    lines.push(`URL: ${state.url}`);
    lines.push(`Title: ${state.title}`);
    lines.push(`Viewport: ${state.viewportSize.width}x${state.viewportSize.height}`);
    lines.push(`\nInteractive Elements (${visibleElements.length} visible):\n`);

    visibleElements.slice(0, 50).forEach((el, idx) => {
      const label = el.text || el.placeholder || el.ariaLabel || el.role || el.tag;
      const truncatedLabel = label.length > 60 ? label.substring(0, 57) + '...' : label;
      lines.push(
        `  [${idx + 1}] ${el.tag}${el.type ? `[${el.type}]` : ''} at (${el.x}, ${el.y}) size:${el.width}x${el.height} - "${truncatedLabel}"`
      );
    });

    if (visibleElements.length > 50) {
      lines.push(`  ... and ${visibleElements.length - 50} more elements`);
    }

    return lines.join('\n');
  }
}
