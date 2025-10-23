/**
 * Agent configuration and browser state types
 */

export type VerbosityLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface AgentConfig {
  // Provider configuration
  provider: 'openai' | 'anthropic' | 'google';
  apiKey?: string;
  model?: string;

  // Optional separate vision model
  imageProvider?: 'openai' | 'anthropic' | 'google';
  imageModel?: string;
  imageApiKey?: string;

  // Behavior
  maxSteps?: number;
  planningInterval?: number;
  typingDelay?: number; // Milliseconds between keystrokes (default: 50)
  networkWait?: number; // Milliseconds to wait after network-triggering actions (default: 2000)
  verbosity?: VerbosityLevel; // Logging verbosity level (default: 'info')

  // Browser settings
  viewport?: { width: number; height: number };
  headless?: boolean;
}

export interface BrowserState {
  url: string;
  title: string;
  screenshot: string; // base64
  elements: InteractiveElement[];
  viewportSize: { width: number; height: number };
}

export interface InteractiveElement {
  tag: string;
  type?: string;
  text?: string;
  placeholder?: string;
  ariaLabel?: string;
  role?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isVisible: boolean;
}
