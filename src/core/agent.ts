/**
 * DolosAgent - Main ReAct agent for browser automation
 */

import { chromium, Browser, Page } from 'playwright';
import { CoreMessage } from 'ai';
import { AgentConfig, BrowserState } from '../types/agent.types';
import { Memory } from './memory';
import { BrowserObserver } from './observation';
import { ToolRegistry } from './tool-registry';
import { AIClient } from './ai-client';
import { PlanningEngine } from './planning';
import { LoopDetector } from './loop-detector';
import { logger } from './logger';

export class DolosAgent {
  private browser?: Browser;
  private page?: Page;
  private memory: Memory;
  private aiClient: AIClient;
  private visionClient?: AIClient;
  private observer?: BrowserObserver;
  private tools: ToolRegistry;
  private config: AgentConfig;
  private stepCount: number = 0;
  private totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  private logicUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  private visionUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  private planningEngine?: PlanningEngine;
  private loopDetector: LoopDetector;
  private lastStateHash?: string;
  private lastToolResults: Map<string, string> = new Map();

  constructor(config: AgentConfig) {
    this.config = {
      maxSteps: 50,
      planningInterval: 5,
      viewport: { width: 1280, height: 720 },
      headless: false,
      typingDelay: 50,
      verbosity: 'info',
      ...config
    };

    // Set logger verbosity
    logger.setLevel(this.config.verbosity!);

    this.memory = new Memory();

    // Main AI client
    this.aiClient = new AIClient({
      provider: config.provider,
      apiKey: config.apiKey!,
      model: config.model
    });

    // Optional separate vision client
    if (config.imageModel && config.imageProvider) {
      this.visionClient = AIClient.createVisionClient({
        provider: config.imageProvider,
        apiKey: config.imageApiKey || config.apiKey!,
        model: config.imageModel
      });
    }

    this.tools = new ToolRegistry();
    this.loopDetector = new LoopDetector();
  }

  async initialize(): Promise<void> {
    logger.infoHeader('INITIALIZING DOLOSAGENT');
    logger.info(`Main Model: ${this.config.provider}/${this.config.model}`);
    if (this.visionClient) {
      logger.info(`Vision Model: ${this.config.imageProvider}/${this.config.imageModel}`);
    }

    this.browser = await chromium.launch({
      headless: this.config.headless
    });

    this.page = await this.browser.newPage({
      viewport: this.config.viewport
    });

    this.observer = new BrowserObserver(this.page);

    // Register browser tools (Phase 2)
    await this.registerBrowserTools();

    // Initialize planning engine (Phase 4)
    this.planningEngine = new PlanningEngine(this.aiClient, this.memory);

    logger.success('Agent initialized');
    logger.separator();
  }

  async run(task: string, startUrl?: string): Promise<string> {
    if (!this.page || !this.observer) {
      throw new Error('Agent not initialized');
    }

    // Navigate to start URL if provided
    if (startUrl) {
      await this.page.goto(startUrl);
    }

    // Add task to memory
    this.memory.addTaskStep(task);

    logger.infoHeader(`TASK: ${task}`);

    let finalAnswer: string | undefined;
    this.stepCount = 0;

    // ReAct loop
    while (!finalAnswer && this.stepCount < this.config.maxSteps!) {
      this.stepCount++;
      logger.infoHeader(`STEP ${this.stepCount}`);

      // OBSERVE - wait for page to be stable before capturing
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(500); // Additional stability wait

      const observation = await this.observer.captureState();

      // STATE CHANGE DETECTION
      const stateChanged = this.hasStateChanged(observation);
      logger.debugHeader('PAGE STATE INTERPRETATION');
      logger.debug(`State Changed: ${stateChanged ? 'YES' : 'NO'}`);
      if (!stateChanged && this.stepCount > 1) {
        logger.warn('WARNING: Page state unchanged - may be waiting for response...');
      }
      logger.debug(`Total Elements: ${observation.elements.length} (${observation.elements.filter(e => e.isVisible).length} visible)`);
      logger.debug(`Current URL: ${observation.url}`);
      logger.debug(`Page Title: ${observation.title}`);
      logger.debugSeparator();

      // PLANNING PHASE (if interval reached)
      if (this.stepCount % this.config.planningInterval! === 0 && this.planningEngine) {
        const planningUsage = await this.planningEngine.executePlanningPhase(observation, this.stepCount, task);

        // Planning always uses vision (includes screenshot)
        this.visionUsage.inputTokens += planningUsage.inputTokens;
        this.visionUsage.outputTokens += planningUsage.outputTokens;
        this.visionUsage.totalTokens += planningUsage.totalTokens;

        this.totalUsage.inputTokens += planningUsage.inputTokens;
        this.totalUsage.outputTokens += planningUsage.outputTokens;
        this.totalUsage.totalTokens += planningUsage.totalTokens;

        logger.info(`Planning Tokens - Logic: 0 (total: ${this.logicUsage.totalTokens}) | Vision: ${planningUsage.totalTokens} (total: ${this.visionUsage.totalTokens})`);
      }

      // LOOP DETECTION
      const loopCheck = this.loopDetector.detectLoop(this.memory.getRecentActions());
      if (loopCheck.isLooping) {
        console.warn(loopCheck.message);
      }

      // Build messages with observation (include state change info)
      const messages = this.buildMessages(observation, task, stateChanged);

      // LOG: Full user prompt being sent to LLM
      logger.traceHeader('SENDING TO LLM');
      logger.trace('SYSTEM PROMPT:');
      logger.trace(this.memory.systemPrompt.substring(0, 500) + '...\n');
      logger.trace('USER MESSAGES:');
      messages.forEach((msg, idx) => {
        logger.trace(`\nMessage ${idx + 1} [${msg.role}]:`);
        if (Array.isArray(msg.content)) {
          msg.content.forEach((item: any) => {
            if (item.type === 'text') {
              logger.trace(`  TEXT: ${item.text.substring(0, 300)}...`);
            } else if (item.type === 'image') {
              logger.trace(`  IMAGE: [base64 screenshot, ${item.image.length} bytes]`);
            } else if (item.type === 'tool-call') {
              logger.trace(`  TOOL-CALL: ${item.toolName}(${JSON.stringify(item.args).substring(0, 100)})`);
            } else if (item.type === 'tool-result') {
              logger.trace(`  TOOL-RESULT: ${JSON.stringify(item).substring(0, 200)}...`);
            }
          });
        } else if (typeof msg.content === 'string' && msg.content.length > 0) {
          logger.trace(`  ${msg.content.substring(0, 300)}...`);
        } else if (typeof msg.content === 'string' && msg.content.length === 0) {
          logger.trace(`  [empty string]`);
        } else if (!msg.content) {
          logger.trace(`  [no content]`);
        } else {
          logger.trace(`  ${String(msg.content).substring(0, 300)}...`);
        }
      });
      logger.traceSeparator();

      // Get AI SDK tool definitions
      const toolDefinitions = this.tools.getAISDKTools();

      // THINK & ACT (using vision client if available)
      const activeClient = this.visionClient || this.aiClient;

      const result = await activeClient.generate({
        messages,
        system: this.memory.systemPrompt,
        tools: toolDefinitions,
        maxSteps: 1
      });

      // LOG: Full LLM response
      logger.traceHeader('LLM RESPONSE');
      logger.trace(`Finish Reason: ${result.finishReason}`);
      if (result.text) {
        logger.trace(`\nThinking/Reasoning:\n${result.text}`);
      }
      if (result.toolCalls && result.toolCalls.length > 0) {
        logger.trace(`\nTool Calls (${result.toolCalls.length}):`);
        result.toolCalls.forEach((tc, idx) => {
          logger.trace(`  ${idx + 1}. ${tc.toolName}(${JSON.stringify(tc.args)})`);
        });
      }
      logger.traceSeparator();

      // Track usage - determine if this was a vision or logic call
      const isVisionCall = activeClient === this.visionClient;

      let logicTokensThisStep = 0;
      let visionTokensThisStep = 0;

      if (isVisionCall) {
        visionTokensThisStep = result.usage.totalTokens;
        this.visionUsage.inputTokens += result.usage.inputTokens;
        this.visionUsage.outputTokens += result.usage.outputTokens;
        this.visionUsage.totalTokens += result.usage.totalTokens;
      } else {
        logicTokensThisStep = result.usage.totalTokens;
        this.logicUsage.inputTokens += result.usage.inputTokens;
        this.logicUsage.outputTokens += result.usage.outputTokens;
        this.logicUsage.totalTokens += result.usage.totalTokens;
      }

      this.totalUsage.inputTokens += result.usage.inputTokens;
      this.totalUsage.outputTokens += result.usage.outputTokens;
      this.totalUsage.totalTokens += result.usage.totalTokens;

      logger.info(`Tokens - Logic: ${logicTokensThisStep} (total: ${this.logicUsage.totalTokens}) | Vision: ${visionTokensThisStep} (total: ${this.visionUsage.totalTokens})`);

      // Check if done
      if (result.finishReason === 'stop' && result.text) {
        finalAnswer = result.text;
        break;
      }

      // Execute tool calls
      if (result.toolCalls && result.toolCalls.length > 0) {
        for (const toolCall of result.toolCalls) {
          logger.debug(`Tool: ${toolCall.toolName}(${JSON.stringify(toolCall.args)})`);

          // Check for 'done' tool
          if (toolCall.toolName === 'done') {
            finalAnswer = toolCall.args.result || 'Task completed';
            break;
          }

          // Note: AI SDK already executed the tool via its execute function
          // Retrieve the captured result from our wrapper
          const toolResult = this.lastToolResults.get(toolCall.toolName) || `${toolCall.toolName} executed`;

          logger.debug(`  Tool result captured: ${toolResult.substring(0, 100)}...`);

          // Add to memory with actual tool result
          this.memory.addActionStep({
            stepNumber: this.stepCount,
            toolName: toolCall.toolName,
            parameters: toolCall.args,
            reasoning: result.text || '',
            observation,
            result: {
              success: true,
              observation: toolResult
            }
          });

          // Clear the result after storing it
          this.lastToolResults.delete(toolCall.toolName);

          // Wait for page updates
          await this.page.waitForTimeout(1500);
        }
      }
    }

    if (!finalAnswer) {
      finalAnswer = `Task incomplete after ${this.config.maxSteps} steps`;
    }

    logger.successHeader('FINAL RESULT');
    logger.success(`Answer: ${finalAnswer}`);
    logger.info(`Logic Tokens: ${this.logicUsage.totalTokens.toLocaleString()}`);
    logger.info(`Vision Tokens: ${this.visionUsage.totalTokens.toLocaleString()}`);
    logger.info(`Total Tokens Used: ${this.totalUsage.totalTokens.toLocaleString()}`);
    logger.separator();

    return finalAnswer;
  }

  private buildMessages(observation: BrowserState, task?: string, stateChanged: boolean = true): CoreMessage[] {
    const messages: CoreMessage[] = this.memory.toMessages();

    // Build state change warning if applicable
    let stateWarning = '';
    if (!stateChanged && this.stepCount > 1) {
      stateWarning = '\n⚠️  WARNING: The page state has NOT changed since your last action. This may mean:\n' +
        '- A chat agent is still typing/thinking and you should wait\n' +
        '- A response is loading and needs more time\n' +
        '- Your last action had no effect\n' +
        'Consider using the wait() tool to give the page more time to respond.\n\n';
    }

    // Build task reminder
    const taskReminder = task ? `\nCURRENT TASK: ${task}\n\n` : '';

    // Build current observation message with screenshot
    const content: any[] = [
      {
        type: 'text',
        text: `${taskReminder}${stateWarning}Current Browser State:\n${this.observer!.formatStateAsText(observation)}\n\nBased on this information, what action should you take next to complete the CURRENT task?`
      }
    ];

    // Add screenshot as image
    content.push({
      type: 'image',
      image: observation.screenshot,
      mimeType: 'image/png'
    });

    messages.push({
      role: 'user',
      content
    });

    return messages;
  }

  private wrapToolWithResultCapture(toolName: string, tool: any): any {
    // Wrap the tool's execute function to capture results
    const originalExecute = tool.execute.bind(tool);

    return {
      ...tool,
      execute: async (args: any) => {
        const result = await originalExecute(args);
        // Store the result for later retrieval
        this.lastToolResults.set(toolName, result);
        return result;
      }
    };
  }

  private async registerBrowserTools(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    // Import tool factories (coordinate-based only)
    const { createClickTool } = await import('../tools/browser/click.tool');
    const { createTypeTool } = await import('../tools/browser/type.tool');
    const { createNavigateTool } = await import('../tools/browser/navigate.tool');
    const { createBackTool } = await import('../tools/browser/back.tool');
    const { createForwardTool } = await import('../tools/browser/forward.tool');
    const { createScrollTool } = await import('../tools/browser/scroll.tool');
    const { createPressKeyTool } = await import('../tools/browser/press.tool');
    const { createWaitTool } = await import('../tools/browser/wait.tool');
    const { createDoneTool } = await import('../tools/browser/done.tool');

    // Register all tools with their names (coordinate-based only)
    // Wrap each tool to capture results
    this.tools.register('click', this.wrapToolWithResultCapture('click', createClickTool(this.page)));
    this.tools.register('type', this.wrapToolWithResultCapture('type', createTypeTool(this.page, this.config.typingDelay!)));
    this.tools.register('navigate', this.wrapToolWithResultCapture('navigate', createNavigateTool(this.page)));
    this.tools.register('back', this.wrapToolWithResultCapture('back', createBackTool(this.page)));
    this.tools.register('forward', this.wrapToolWithResultCapture('forward', createForwardTool(this.page)));
    this.tools.register('scroll', this.wrapToolWithResultCapture('scroll', createScrollTool(this.page)));
    this.tools.register('press', this.wrapToolWithResultCapture('press', createPressKeyTool(this.page)));
    this.tools.register('wait', this.wrapToolWithResultCapture('wait', createWaitTool(this.page)));
    this.tools.register('done', this.wrapToolWithResultCapture('done', createDoneTool(this.page)));

    logger.debug(`Registered ${this.tools.list().length} browser tools`);
  }

  private computeStateHash(observation: BrowserState): string {
    // Create a simple hash of the page state
    const stateData = {
      url: observation.url,
      title: observation.title,
      elementCount: observation.elements.length,
      elements: observation.elements.slice(0, 20).map(e => ({
        tag: e.tag,
        text: e.text?.substring(0, 50),
        x: e.x,
        y: e.y
      }))
    };
    return JSON.stringify(stateData);
  }

  private hasStateChanged(observation: BrowserState): boolean {
    const currentHash = this.computeStateHash(observation);
    const changed = currentHash !== this.lastStateHash;
    this.lastStateHash = currentHash;
    return changed;
  }

  async close(): Promise<void> {
    this.displayUsageSummary();
    await this.browser?.close();
    logger.info('Agent closed');
  }

  displayUsageSummary(): void {
    logger.infoHeader('TOKEN USAGE SUMMARY');
    logger.info(`Input Tokens:  ${this.totalUsage.inputTokens.toLocaleString()}`);
    logger.info(`Output Tokens: ${this.totalUsage.outputTokens.toLocaleString()}`);
    logger.info(`Total Tokens:  ${this.totalUsage.totalTokens.toLocaleString()}`);
    logger.separator();
  }
}
