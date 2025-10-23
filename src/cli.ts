#!/usr/bin/env node

/**
 * DolosAgent CLI - Command-line interface for browser automation
 */

import { Command } from 'commander';
import { DolosAgent } from './core/agent';
import { ConversationalAgent } from './core/conversational-agent';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const program = new Command();

program
  .name('dolos')
  .description('Intelligent browser automation with vision and ReAct reasoning')
  .version('1.0.0');

// Run command - One-shot task execution
program
  .command('run')
  .description('Execute a one-shot browser automation task')
  .requiredOption('-t, --task <task>', 'Task description to execute')
  .option('-u, --url <url>', 'Starting URL')
  .option('--provider <provider>', 'LLM provider (openai, anthropic, google)', process.env.DEFAULT_PROVIDER || 'openai')
  .option('--model <model>', 'LLM model name', process.env.DEFAULT_MODEL)
  .option('--image-provider <provider>', 'Vision model provider', process.env.DEFAULT_IMAGE_PROVIDER)
  .option('--image-model <model>', 'Vision model name', process.env.DEFAULT_IMAGE_MODEL)
  .option('--max-steps <number>', 'Maximum ReAct steps', process.env.DEFAULT_MAX_STEPS || '50')
  .option('--planning-interval <number>', 'Planning interval', process.env.DEFAULT_PLANNING_INTERVAL || '5')
  .option('--typing-delay <number>', 'Milliseconds between keystrokes', process.env.DEFAULT_TYPING_DELAY || '50')
  .option('--verbosity <level>', 'Logging verbosity (error|warn|info|debug|trace)', process.env.DEFAULT_VERBOSITY || 'info')
  .option('--headless', 'Run browser in headless mode', false)
  .action(async (options) => {
    try {
      // Validate API key
      const apiKey = getApiKey(options.provider);
      if (!apiKey) {
        console.error(`❌ Error: ${options.provider.toUpperCase()}_API_KEY not set`);
        console.error('Please set the API key in your .env file');
        process.exit(1);
      }

      // Create agent config
      const config: any = {
        provider: options.provider,
        apiKey,
        headless: options.headless,
        maxSteps: parseInt(options.maxSteps),
        planningInterval: parseInt(options.planningInterval),
        typingDelay: parseInt(options.typingDelay),
        verbosity: options.verbosity
      };

      if (options.model) {
        config.model = options.model;
      }

      if (options.imageProvider && options.imageModel) {
        config.imageProvider = options.imageProvider;
        config.imageModel = options.imageModel;
        config.imageApiKey = getApiKey(options.imageProvider);
      }

      // Create and run agent
      const agent = new DolosAgent(config);
      await agent.initialize();

      const result = await agent.run(options.task, options.url);

      console.log('\n' + '='.repeat(60));
      console.log('✅ Task Complete');
      console.log('='.repeat(60));
      console.log(result);
      console.log('='.repeat(60) + '\n');

      await agent.close();
      process.exit(0);
    } catch (error: any) {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    }
  });

// Chat command - Conversational mode
program
  .command('chat')
  .description('Start conversational mode for continuous interaction')
  .option('-t, --task <task>', 'Initial task to execute before starting conversation')
  .option('-u, --url <url>', 'Starting URL')
  .option('--provider <provider>', 'LLM provider (openai, anthropic, google)', process.env.DEFAULT_PROVIDER || 'openai')
  .option('--model <model>', 'LLM model name', process.env.DEFAULT_MODEL)
  .option('--image-provider <provider>', 'Vision model provider', process.env.DEFAULT_IMAGE_PROVIDER)
  .option('--image-model <model>', 'Vision model name', process.env.DEFAULT_IMAGE_MODEL)
  .option('--max-steps <number>', 'Maximum ReAct steps per task', process.env.DEFAULT_MAX_STEPS || '50')
  .option('--planning-interval <number>', 'Planning interval', process.env.DEFAULT_PLANNING_INTERVAL || '5')
  .option('--typing-delay <number>', 'Milliseconds between keystrokes', process.env.DEFAULT_TYPING_DELAY || '50')
  .option('--verbosity <level>', 'Logging verbosity (error|warn|info|debug|trace)', process.env.DEFAULT_VERBOSITY || 'info')
  .option('--headless', 'Run browser in headless mode', false)
  .action(async (options) => {
    try {
      // Validate API key
      const apiKey = getApiKey(options.provider);
      if (!apiKey) {
        console.error(`❌ Error: ${options.provider.toUpperCase()}_API_KEY not set`);
        console.error('Please set the API key in your .env file');
        process.exit(1);
      }

      // Create agent config
      const config: any = {
        provider: options.provider,
        apiKey,
        headless: options.headless,
        maxSteps: parseInt(options.maxSteps),
        planningInterval: parseInt(options.planningInterval),
        typingDelay: parseInt(options.typingDelay),
        verbosity: options.verbosity
      };

      if (options.model) {
        config.model = options.model;
      }

      if (options.imageProvider && options.imageModel) {
        config.imageProvider = options.imageProvider;
        config.imageModel = options.imageModel;
        config.imageApiKey = getApiKey(options.imageProvider);
      }

      // Create and start conversational agent
      const agent = new ConversationalAgent(config);
      await agent.startConversation(options.url, options.task);

      process.exit(0);
    } catch (error: any) {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    }
  });

// Prompts command - List available example prompts
program
  .command('prompts')
  .description('List available example prompts')
  .action(() => {
    const promptsDir = path.join(__dirname, '../prompts');

    if (!fs.existsSync(promptsDir)) {
      console.log('No example prompts found.');
      console.log(`Create prompts in: ${promptsDir}`);
      return;
    }

    const files = fs.readdirSync(promptsDir).filter(f => f.endsWith('.txt'));

    if (files.length === 0) {
      console.log('No example prompts found.');
      return;
    }

    console.log('\n📝 Available Example Prompts:\n');
    files.forEach(file => {
      const name = file.replace('.txt', '');
      const content = fs.readFileSync(path.join(promptsDir, file), 'utf-8');
      const firstLine = content.split('\n')[0];
      console.log(`  ${name}`);
      console.log(`    ${firstLine}`);
      console.log('');
    });

    console.log('Use prompts as task templates for `dolos run -t "..."`\n');
  });

program.parse();

// Helper function to get API key for provider
function getApiKey(provider: string): string | undefined {
  switch (provider.toLowerCase()) {
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY;
    case 'google':
      return process.env.GOOGLE_API_KEY;
    default:
      return undefined;
  }
}
