/**
 * Helper utilities for browser tools
 */

import { Page } from 'playwright';

/**
 * Add visual debug marker at coordinates
 */
export async function addVisualMarker(
  page: Page,
  x: number,
  y: number,
  color: string,
  duration: number = 2000
): Promise<void> {
  await page.evaluate(
    ({ x, y, color, duration }) => {
      // Create marker at exact coordinates
      const marker = document.createElement('div');
      marker.className = 'dolos-debug-marker'; // Mark for exclusion from state detection
      marker.style.position = 'fixed';
      marker.style.left = `${x - 10}px`;
      marker.style.top = `${y - 10}px`;
      marker.style.width = '20px';
      marker.style.height = '20px';
      marker.style.borderRadius = '50%';
      marker.style.border = `3px solid ${color}`;
      marker.style.backgroundColor = `${color}33`;
      marker.style.zIndex = '999999';
      marker.style.pointerEvents = 'none';
      document.body.appendChild(marker);

      // Also highlight the element at these coordinates
      const element = document.elementFromPoint(x, y) as HTMLElement;
      if (element) {
        const originalOutline = element.style.outline;
        element.style.outline = `3px solid ${color}`;
        setTimeout(() => {
          element.style.outline = originalOutline;
        }, duration);
      }

      setTimeout(() => marker.remove(), duration);
    },
    { x, y, color, duration }
  );
}
