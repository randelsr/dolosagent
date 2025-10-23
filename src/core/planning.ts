/**
 * Planning Engine - Periodic reflection and strategy planning
 */

import { BrowserState } from '../types/agent.types';
import { Memory } from './memory';
import { AIClient } from './ai-client';
import { logger } from './logger';

export class PlanningEngine {
  constructor(
    private aiClient: AIClient,
    private memory: Memory
  ) {}

  async executePlanningPhase(observation: BrowserState, stepNumber: number, currentTask?: string): Promise<{ inputTokens: number; outputTokens: number; totalTokens: number }> {
    logger.debugHeader('PLANNING PHASE');

    const recentActions = this.memory.getRecentActions(5);
    const taskContext = currentTask ? `\n\nYour Current Task: ${currentTask}` : '';

    // Build detailed action log with results and reasoning
    const detailedActionLog = recentActions.map(a => {
      let log = `Step ${a.stepNumber}: ${a.toolName}(${JSON.stringify(a.parameters)})`;

      if (a.reasoning) {
        log += `\n  Reasoning: ${a.reasoning}`;
      }

      if (a.result?.observation) {
        log += `\n  Result: ${a.result.observation}`;
      } else if (a.result?.data) {
        log += `\n  Result: ${JSON.stringify(a.result.data)}`;
      } else if (a.result?.error) {
        log += `\n  Error: ${a.result.error}`;
      } else {
        logger.warn(`WARNING: Step ${a.stepNumber} (${a.toolName}) has no result data!`);
      }

      return log;
    }).join('\n\n');

    logger.debug(`Sending to planning:\n${detailedActionLog.substring(0, 500)}...`);

    // Build visible elements summary
    const visibleElements = observation.elements.filter(el => el.isVisible);
    const elementsSummary = visibleElements.length > 0
      ? visibleElements.slice(0, 10).map((el, idx) => {
          const text = el.text || el.placeholder || el.ariaLabel || '';
          return `  ${idx + 1}. ${el.tag} at (${el.x}, ${el.y})${text ? ` - "${text.substring(0, 50)}"` : ''}`;
        }).join('\n')
      : '  (No visible interactive elements detected)';

    const planningPrompt = `
You are at step ${stepNumber}. Reflect on your progress:${taskContext}

Current Page: ${observation.title} (${observation.url})

CURRENT PAGE STATE:
Screenshot: [See attached image showing current page appearance]
Viewport: ${observation.viewportSize.width}x${observation.viewportSize.height}
Visible Interactive Elements (${visibleElements.length} total, showing top 10):
${elementsSummary}

RECENT ACTION HISTORY (last ${recentActions.length} steps):
${detailedActionLog}

Based on the CURRENT PAGE STATE (visible in the screenshot) and complete action history with results, provide:
1. FACTS: What you know to be true right now based on what you can SEE in the screenshot and what actions succeeded/failed
2. NEXT STEPS: What you should do in the next few actions
3. CONTINUE: yes/no - should you keep going?

Format:
FACTS:
- [fact]

NEXT STEPS:
- [step]

CONTINUE: yes/no
`;

    const result = await this.aiClient.generate({
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: planningPrompt },
          { type: 'image', image: observation.screenshot, mimeType: 'image/png' }
        ]
      }],
      system: 'You are a planning assistant for a browser automation agent. Use the screenshot to understand the current page state.',
      maxSteps: 1
    });

    logger.debug(`Planning: ${result.text}`);
    logger.debugSeparator();

    // Parse and add to memory
    const facts = this.extractSection(result.text || '', 'FACTS');
    const nextSteps = this.extractSection(result.text || '', 'NEXT STEPS');

    this.memory.addPlanningStep({
      stepNumber,
      currentFacts: facts,
      nextSteps
    });

    // Return token usage for aggregation
    return result.usage;
  }

  private extractSection(text: string, section: string): string[] {
    const regex = new RegExp(`${section}:[\\s\\S]*?(?=NEXT STEPS:|CONTINUE:|$)`);
    const match = text.match(regex);
    if (!match) return [];

    return match[0]
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.trim().substring(2));
  }
}
