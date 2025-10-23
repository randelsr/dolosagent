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
      networkWait: 2000,
      verbosity: 'info',
      ...config
    };

    // Set logger verbosity
    logger.setLevel(this.config.verbosity!);

    // STRICT REQUIREMENT: Both logic and vision clients must be configured
    if (!config.imageModel || !config.imageProvider) {
      throw new Error(
        'Vision LLM must be configured. Two-phase architecture requires both:\n' +
        '  - Logic LLM (provider, model) for decision-making and planning\n' +
        '  - Vision LLM (imageProvider, imageModel) for screenshot analysis\n\n' +
        'Please set imageProvider and imageModel in your configuration or .env file:\n' +
        '  DEFAULT_IMAGE_PROVIDER=openai\n' +
        '  DEFAULT_IMAGE_MODEL=gpt-4o'
      );
    }

    this.memory = new Memory();

    // Logic client (required)
    this.aiClient = new AIClient({
      provider: config.provider,
      apiKey: config.apiKey!,
      model: config.model
    });

    // Vision client (required)
    this.visionClient = AIClient.createVisionClient({
      provider: config.imageProvider,
      apiKey: config.imageApiKey || config.apiKey!,
      model: config.imageModel
    });

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

    // Initialize planning engine with logic client only
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
      logger.info(`Navigating to initial URL: ${startUrl}`);
      await this.page.goto(startUrl, { waitUntil: 'networkidle' });
      logger.debug(`  Network wait: ${this.config.networkWait}ms after initial navigation`);
      await this.page.waitForTimeout(this.config.networkWait!);
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

        // Planning always uses logic client (text-only)
        this.logicUsage.inputTokens += planningUsage.inputTokens;
        this.logicUsage.outputTokens += planningUsage.outputTokens;
        this.logicUsage.totalTokens += planningUsage.totalTokens;

        this.totalUsage.inputTokens += planningUsage.inputTokens;
        this.totalUsage.outputTokens += planningUsage.outputTokens;
        this.totalUsage.totalTokens += planningUsage.totalTokens;

        logger.info(`Planning Tokens - Logic: ${planningUsage.totalTokens} (total: ${this.logicUsage.totalTokens}) | Vision: 0 (total: ${this.visionUsage.totalTokens})`);
      }

      // LOOP DETECTION
      const loopCheck = this.loopDetector.detectLoop(this.memory.getRecentActions());
      if (loopCheck.isLooping) {
        console.warn(loopCheck.message);
      }

      // ============================================================
      // PHASE 1: VISION ANALYSIS (required)
      // ============================================================
      logger.debugHeader('VISION ANALYSIS PHASE');

      const visionResult = await this.analyzePageWithVision(observation, task);
      const visionAnalysis = visionResult.analysis;

      // Track vision tokens
      const visionTokensThisStep = visionResult.usage.totalTokens;
      this.visionUsage.inputTokens += visionResult.usage.inputTokens;
      this.visionUsage.outputTokens += visionResult.usage.outputTokens;
      this.visionUsage.totalTokens += visionResult.usage.totalTokens;

      this.totalUsage.inputTokens += visionResult.usage.inputTokens;
      this.totalUsage.outputTokens += visionResult.usage.outputTokens;
      this.totalUsage.totalTokens += visionResult.usage.totalTokens;

      logger.debug(`Vision Analysis:\n${visionAnalysis.substring(0, 500)}${visionAnalysis.length > 500 ? '...' : ''}`);

      // Store vision analysis in memory
      this.memory.addVisionAnalysisStep({
        stepNumber: this.stepCount,
        analysis: visionAnalysis,
        observation
      });

      logger.debugSeparator();

      // ============================================================
      // PHASE 2: LOGIC DECISION
      // ============================================================

      const logicResult = await this.makeLogicDecision(
        observation,
        visionAnalysis,
        task,
        stateChanged
      );

      // Track logic tokens
      const logicTokensThisStep = logicResult.usage.totalTokens;
      this.logicUsage.inputTokens += logicResult.usage.inputTokens;
      this.logicUsage.outputTokens += logicResult.usage.outputTokens;
      this.logicUsage.totalTokens += logicResult.usage.totalTokens;

      this.totalUsage.inputTokens += logicResult.usage.inputTokens;
      this.totalUsage.outputTokens += logicResult.usage.outputTokens;
      this.totalUsage.totalTokens += logicResult.usage.totalTokens;

      // Display token usage for BOTH phases
      logger.info(`Tokens - Logic: ${logicTokensThisStep} (total: ${this.logicUsage.totalTokens}) | Vision: ${visionTokensThisStep} (total: ${this.visionUsage.totalTokens})`);

      const result = logicResult.result;

      // ============================================================
      // END TWO-PHASE ARCHITECTURE
      // ============================================================

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

  /**
   * Phase 1: Vision Analysis
   * Analyzes screenshot and returns structured text observations
   */
  private async analyzePageWithVision(
    observation: BrowserState,
    task?: string
  ): Promise<{
    analysis: string;
    usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  }> {
    // Build vision-specific prompt with action context
    const taskContext = task ? `OVERALL TASK: ${task}\n\n` : '';

    // Get recent actions for context
    const recentActions = this.memory.getRecentActions(3);
    const actionHistory = recentActions.length > 0
      ? `RECENT ACTIONS TAKEN:\n${recentActions.map(a =>
          `- Step ${a.stepNumber}: ${a.toolName}(${JSON.stringify(a.parameters)}) → ${a.result?.observation || 'completed'}`
        ).join('\n')}\n\n`
      : 'RECENT ACTIONS: None (first step)\n\n';

    const visionPrompt = `You are a vision analysis agent helping with browser automation.

${taskContext}${actionHistory}CURRENT PAGE:
- URL: ${observation.url}
- Title: ${observation.title}
- Viewport: ${observation.viewportSize.width}x${observation.viewportSize.height}

YOUR JOB:
Analyze the screenshot and report FACTS about what you see. Provide coordinates for interactive elements. Do NOT provide logical reasoning - just report visual observations.

Provide your analysis in this format:

1. WHAT I SEE:
   - List ALL interactive elements visible (buttons, inputs, links, text fields, etc.)
   - For each element, provide EXACT coordinates in format: "Element name/description at (x, y)"
   - Include current state (e.g., "Input field containing 'hello world' at (290, 60)")
   - Example: "Search button at (640, 350)"

2. WHAT CHANGED:
   - Factual comparison: What is visually different from before the previous action?
   - Did new elements appear? Did elements disappear? Did text change?
   - If nothing changed visually, state: "No visual change detected"

3. NEXT ACTION TARGET:
   - Based ONLY on the task goal, identify what element needs interaction
   - EITHER: "TASK_COMPLETE - Visual evidence: [what shows task is done]"
   - OR: "NEXT_TARGET: [element description] at (x, y)"
   - OR: "BLOCKER: [blocking element description] at (x, y)"
   - Do NOT explain WHY - just identify WHAT and WHERE

BE SPECIFIC with coordinates. Report observations, not interpretations.`;

    const messages = [{
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: visionPrompt },
        {
          type: 'image' as const,
          image: observation.screenshot,
          mimeType: 'image/png' as const
        }
      ]
    }];

    logger.debug('Sending screenshot to vision model...');

    // Call vision client (NO TOOLS - text only)
    const result = await this.visionClient!.generate({
      messages,
      system: 'You are a visual observer for browser automation. Report FACTS about what you see in screenshots - elements, coordinates, current state, changes. Do NOT provide logical reasoning or explain "why" - that is the job of the logic agent. Your role: OBSERVE and REPORT visual information with precise coordinates.',
      maxSteps: 1
      // NOTE: NO tools parameter - vision model only analyzes, doesn't act
    });

    return {
      analysis: result.text || '',
      usage: result.usage
    };
  }

  /**
   * Phase 2: Logic Decision
   * Makes tool call decisions based on vision analysis (no screenshot)
   */
  private async makeLogicDecision(
    observation: BrowserState,
    visionAnalysis: string,
    task?: string,
    stateChanged: boolean = true
  ): Promise<{
    result: any;
    usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  }> {
    // Build messages for logic decision
    const messages = this.buildLogicMessages(observation, visionAnalysis, task, stateChanged);

    // Get tool definitions
    const toolDefinitions = this.tools.getAISDKTools();

    logger.debugHeader('LOGIC DECISION PHASE');
    logger.debug('Sending to logic model (with vision analysis, no screenshot)...');

    // Trace: Log full prompt being sent to logic LLM
    if (logger.getLevel() === 'trace') {
      logger.trace('=== LOGIC LLM PROMPT ===');
      logger.trace('System Prompt:');
      logger.trace(this.memory.systemPrompt);
      logger.trace('\nMessages:');
      messages.forEach((msg, idx) => {
        logger.trace(`\n[Message ${idx + 1}] Role: ${msg.role}`);
        if (typeof msg.content === 'string') {
          logger.trace(msg.content);
        } else if (Array.isArray(msg.content)) {
          msg.content.forEach((part: any, partIdx: number) => {
            if (part.type === 'text') {
              logger.trace(`  [Part ${partIdx + 1}] Text: ${part.text}`);
            } else if (part.type === 'image') {
              logger.trace(`  [Part ${partIdx + 1}] Image: [base64 data, ${part.image?.length || 0} chars]`);
            } else if (part.type === 'tool-result') {
              logger.trace(`  [Part ${partIdx + 1}] Tool Result: ${part.toolName} - ${JSON.stringify(part.result).substring(0, 200)}`);
            }
          });
        }
      });
      logger.trace('\n=== END LOGIC LLM PROMPT ===\n');
    }

    // Call logic client (aiClient) with tools
    const result = await this.aiClient.generate({
      messages,
      system: this.memory.systemPrompt,
      tools: toolDefinitions,
      maxSteps: 1
    });

    // Log response
    if (result.text) {
      logger.info(`Logic reasoning: ${result.text}`);
    }
    if (result.toolCalls && result.toolCalls.length > 0) {
      logger.debug(`Tool calls: ${result.toolCalls.map(tc => `${tc.toolName}(${JSON.stringify(tc.args)})`).join(', ')}`);
    }
    if (!result.text && (!result.toolCalls || result.toolCalls.length === 0)) {
      logger.debug('Logic returned no text or tool calls');
    }
    logger.debugSeparator();

    return {
      result,
      usage: result.usage
    };
  }

  /**
   * Build messages for logic phase (Phase 2)
   * Includes vision analysis as TEXT instead of screenshot
   */
  private buildLogicMessages(
    observation: BrowserState,
    visionAnalysis: string,
    task?: string,
    stateChanged: boolean = true
  ): CoreMessage[] {
    // Get existing message history from memory
    const messages: CoreMessage[] = this.memory.toMessages();

    // Build state change warning if applicable
    let stateWarning = '';
    if (!stateChanged && this.stepCount > 1) {
      stateWarning = '\nWARNING: The page state has NOT changed since your last action. This may mean:\n' +
        '- A chat agent is still typing/thinking\n' +
        '- A response is loading and needs more time\n' +
        '- Your last action had no effect\n' +
        'The next screenshot will show if the page updates.\n\n';
    }

    // Build task reminder
    const taskReminder = task ? `\nCURRENT TASK: ${task}\n\n` : '';

    // Build current observation with VISION ANALYSIS instead of screenshot
    const observationText = `${taskReminder}${stateWarning}Current Browser State:
URL: ${observation.url}
Title: ${observation.title}
Viewport: ${observation.viewportSize.width}x${observation.viewportSize.height}

VISION ANALYSIS:
${visionAnalysis}

Based on this information, what action should you take next to complete the CURRENT task?`;

    // Add observation as TEXT-ONLY message (no image)
    messages.push({
      role: 'user',
      content: observationText  // Simple string, not array with image
    });

    return messages;
  }

  private buildMessages(observation: BrowserState, task?: string, stateChanged: boolean = true): CoreMessage[] {
    const messages: CoreMessage[] = this.memory.toMessages();

    // Build state change warning if applicable
    let stateWarning = '';
    if (!stateChanged && this.stepCount > 1) {
      stateWarning = '\nWARNING: The page state has NOT changed since your last action. This may mean:\n' +
        '- A chat agent is still typing/thinking\n' +
        '- A response is loading and needs more time\n' +
        '- Your last action had no effect\n' +
        'The next screenshot will show if the page updates.\n\n';
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
    const { createDoneTool } = await import('../tools/browser/done.tool');

    // Register all tools with their names (coordinate-based only)
    // Wrap each tool to capture results
    this.tools.register('click', this.wrapToolWithResultCapture('click', createClickTool(this.page, this.config.networkWait!)));
    this.tools.register('type', this.wrapToolWithResultCapture('type', createTypeTool(this.page, this.config.typingDelay!)));
    this.tools.register('navigate', this.wrapToolWithResultCapture('navigate', createNavigateTool(this.page, this.config.networkWait!)));
    this.tools.register('back', this.wrapToolWithResultCapture('back', createBackTool(this.page, this.config.networkWait!)));
    this.tools.register('forward', this.wrapToolWithResultCapture('forward', createForwardTool(this.page, this.config.networkWait!)));
    this.tools.register('scroll', this.wrapToolWithResultCapture('scroll', createScrollTool(this.page)));
    this.tools.register('press', this.wrapToolWithResultCapture('press', createPressKeyTool(this.page, this.config.networkWait!)));
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
