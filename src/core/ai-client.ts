/**
 * AI Client - Vercel AI SDK wrapper for multi-provider support
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, LanguageModel, CoreMessage, CoreTool } from 'ai';

export interface AIClientConfig {
  provider: 'openai' | 'anthropic' | 'google';
  apiKey: string;
  model?: string;
}

export interface GenerateOptions {
  messages: CoreMessage[];
  system?: string;
  tools?: Record<string, CoreTool>;
  maxSteps?: number;
}

export interface GenerateResult {
  text?: string;
  toolCalls?: Array<{
    toolCallId: string;
    toolName: string;
    args: any;
  }>;
  finishReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export class AIClient {
  private model: LanguageModel;
  private config: AIClientConfig;

  constructor(config: AIClientConfig) {
    this.config = config;
    this.model = this.createModel();
  }

  private createModel(): LanguageModel {
    const modelId = this.config.model || this.getDefaultModel();

    switch (this.config.provider) {
      case 'anthropic': {
        const anthropic = createAnthropic({
          apiKey: this.config.apiKey
        });
        return anthropic(modelId);
      }
      case 'openai': {
        const openai = createOpenAI({
          apiKey: this.config.apiKey
        });
        return openai(modelId);
      }
      case 'google': {
        const google = createGoogleGenerativeAI({
          apiKey: this.config.apiKey
        });
        return google(modelId);
      }
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  private getDefaultModel(): string {
    const defaults = {
      anthropic: 'claude-sonnet-4-20250514',
      openai: 'gpt-4o',
      google: 'gemini-2.0-flash-exp'
    };
    return defaults[this.config.provider];
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const result = await generateText({
      model: this.model,
      messages: options.messages,
      system: options.system,
      tools: options.tools,
      maxSteps: options.maxSteps || 1
    });

    return {
      text: result.text,
      toolCalls: result.toolCalls?.map(tc => ({
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        args: tc.args
      })),
      finishReason: result.finishReason,
      usage: {
        inputTokens: result.usage.promptTokens,
        outputTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens
      }
    };
  }

  /**
   * Factory method for creating a vision-specific client
   */
  static createVisionClient(config: AIClientConfig): AIClient {
    return new AIClient(config);
  }
}
