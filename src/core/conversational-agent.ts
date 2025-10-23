/**
 * Conversational Agent - Persistent chat interface for continuous interaction
 */

import { DolosAgent } from './agent';
import * as readline from 'readline';
import * as fs from 'fs/promises';
import { AgentConfig } from '../types/agent.types';
import { logger } from './logger';

export class ConversationalAgent extends DolosAgent {
  private conversationActive: boolean = false;

  constructor(config: AgentConfig) {
    super(config);
  }

  async startConversation(initialUrl?: string, initialTask?: string): Promise<void> {
    await this.initialize();

    if (initialUrl) {
      logger.info(`Navigating to initial URL: ${initialUrl}`);
      await this.getPage().goto(initialUrl, { waitUntil: 'networkidle' });
      logger.debug(`  Network wait: ${this.getConfig().networkWait}ms after initial navigation`);
      await this.getPage().waitForTimeout(this.getConfig().networkWait!);
    }

    // Execute initial task if provided
    if (initialTask) {
      try {
        logger.info('\nWorking...\n');
        const result = await this.run(initialTask);
        logger.success(`\n${result}`);
      } catch (error: any) {
        logger.error(`\nError: ${error.message}`);
      }
    }

    this.conversationActive = true;

    logger.infoHeader('CONVERSATIONAL MODE');
    logger.info('Commands: exit | memory | clear | snapshot');
    logger.separator();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const askQuestion = (): Promise<string> => {
      return new Promise(resolve => {
        rl.question('\nYou: ', answer => resolve(answer.trim()));
      });
    };

    while (this.conversationActive) {
      const userInput = await askQuestion();

      if (!userInput) continue;

      if (userInput.toLowerCase() === 'exit') {
        logger.info('Exiting...');
        this.conversationActive = false;
        rl.close();
        break;
      }

      if (userInput.toLowerCase() === 'memory') {
        this.displayMemory();
        continue;
      }

      if (userInput.toLowerCase() === 'clear') {
        this.getMemory().clear();
        logger.success('Memory cleared');
        continue;
      }

      if (userInput.toLowerCase() === 'snapshot') {
        await this.saveSnapshot();
        continue;
      }

      // Execute task
      try {
        logger.info('\nWorking...\n');
        const result = await this.run(userInput);
        logger.success(`\n${result}`);
      } catch (error: any) {
        logger.error(`\nError: ${error.message}`);
      }
    }

    await this.close();
  }

  private displayMemory(): void {
    const memory = this.getMemory().toJSON();
    logger.debugHeader(`MEMORY: ${memory.steps.length} steps`);
    memory.steps.slice(-10).forEach((step: any, idx: number) => {
      if (step.type === 'task') {
        logger.debug(`[${idx + 1}] TASK: ${step.task}`);
      } else if (step.type === 'action') {
        logger.debug(`[${idx + 1}] ${step.toolName}(${JSON.stringify(step.parameters)})`);
      } else if (step.type === 'planning') {
        logger.debug(`[${idx + 1}] PLANNING: ${step.currentFacts.length} facts, ${step.nextSteps.length} steps`);
      }
    });
    logger.debugSeparator();
  }

  private async saveSnapshot(): Promise<void> {
    const snapshot = {
      memory: this.getMemory().toJSON(),
      url: this.getPage().url(),
      timestamp: new Date().toISOString()
    };

    const filename = `snapshot_${Date.now()}.json`;
    await fs.writeFile(filename, JSON.stringify(snapshot, null, 2));
    logger.success(`Saved: ${filename}`);
  }

  async loadSnapshot(filename: string): Promise<void> {
    const data = await fs.readFile(filename, 'utf-8');
    const snapshot = JSON.parse(data);

    // Restore memory
    const memory = this.getMemory();
    (memory as any).steps = snapshot.memory.steps;

    // Navigate to saved URL
    logger.info(`Restoring URL: ${snapshot.url}`);
    await this.getPage().goto(snapshot.url, { waitUntil: 'networkidle' });
    logger.debug(`  Network wait: ${this.getConfig().networkWait}ms after snapshot restoration`);
    await this.getPage().waitForTimeout(this.getConfig().networkWait!);

    logger.success(`Loaded: ${filename} (${snapshot.memory.steps.length} steps)`);
  }

  // Accessor methods to access private properties from base class
  private getPage() {
    return (this as any).page;
  }

  private getMemory() {
    return (this as any).memory;
  }

  private getConfig() {
    return (this as any).config;
  }
}
