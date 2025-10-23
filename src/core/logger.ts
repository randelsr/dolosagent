/**
 * Logger utility with verbosity levels and color support
 */

import chalk from 'chalk';
import { VerbosityLevel } from '../types/agent.types';

const VERBOSITY_LEVELS: Record<VerbosityLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

export class Logger {
  private level: VerbosityLevel;
  private readonly MAX_WIDTH = 80;

  constructor(level: VerbosityLevel = 'info') {
    this.level = level;
  }

  setLevel(level: VerbosityLevel): void {
    this.level = level;
  }

  getLevel(): VerbosityLevel {
    return this.level;
  }

  private shouldLog(level: VerbosityLevel): boolean {
    return VERBOSITY_LEVELS[level] <= VERBOSITY_LEVELS[this.level];
  }

  private formatHeader(text: string): string {
    return '\n' + '─'.repeat(this.MAX_WIDTH) + '\n' + text + '\n' + '─'.repeat(this.MAX_WIDTH);
  }

  private wrapText(text: string): string {
    if (text.length <= this.MAX_WIDTH) {
      return text;
    }

    const lines: string[] = [];
    const words = text.split(' ');
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= this.MAX_WIDTH) {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        // If single word is longer than MAX_WIDTH, truncate it
        if (word.length > this.MAX_WIDTH) {
          lines.push(word.substring(0, this.MAX_WIDTH - 3) + '...');
        } else {
          currentLine = word;
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.join('\n');
  }

  // ERROR level (0) - Critical errors only
  error(message: string): void {
    if (this.shouldLog('error')) {
      console.error(chalk.red.bold(this.wrapText(message)));
    }
  }

  errorHeader(message: string): void {
    if (this.shouldLog('error')) {
      console.error(chalk.red.bold(this.formatHeader(message)));
    }
  }

  // WARN level (1) - Warnings and important notices
  warn(message: string): void {
    if (this.shouldLog('warn')) {
      console.warn(chalk.yellow(this.wrapText(message)));
    }
  }

  warnHeader(message: string): void {
    if (this.shouldLog('warn')) {
      console.warn(chalk.yellow.bold(this.formatHeader(message)));
    }
  }

  // INFO level (2) - High-level progress (steps, final results)
  info(message: string): void {
    if (this.shouldLog('info')) {
      console.log(chalk.cyan(this.wrapText(message)));
    }
  }

  infoHeader(message: string): void {
    if (this.shouldLog('info')) {
      console.log(chalk.cyan.bold(this.formatHeader(message)));
    }
  }

  success(message: string): void {
    if (this.shouldLog('info')) {
      console.log(chalk.green(this.wrapText(message)));
    }
  }

  successHeader(message: string): void {
    if (this.shouldLog('info')) {
      console.log(chalk.green.bold(this.formatHeader(message)));
    }
  }

  // DEBUG level (3) - Detailed state and memory info
  debug(message: string): void {
    if (this.shouldLog('debug')) {
      console.log(chalk.gray(this.wrapText(message)));
    }
  }

  debugHeader(message: string): void {
    if (this.shouldLog('debug')) {
      console.log(chalk.gray.bold(this.formatHeader(message)));
    }
  }

  // TRACE level (4) - Full LLM prompts/responses
  trace(message: string): void {
    if (this.shouldLog('trace')) {
      console.log(chalk.magenta(this.wrapText(message)));
    }
  }

  traceHeader(message: string): void {
    if (this.shouldLog('trace')) {
      console.log(chalk.magenta.bold(this.formatHeader(message)));
    }
  }

  // Plain output (no color, no level check)
  plain(message: string): void {
    console.log(message);
  }

  separator(): void {
    if (this.shouldLog('info')) {
      console.log('─'.repeat(this.MAX_WIDTH));
    }
  }

  debugSeparator(): void {
    if (this.shouldLog('debug')) {
      console.log(chalk.gray('─'.repeat(this.MAX_WIDTH)));
    }
  }

  traceSeparator(): void {
    if (this.shouldLog('trace')) {
      console.log(chalk.magenta('─'.repeat(this.MAX_WIDTH)));
    }
  }
}

// Export singleton instance
export const logger = new Logger();
