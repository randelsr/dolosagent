/**
 * Tool registry for managing browser tools
 */

import { CoreTool } from 'ai';

export class ToolRegistry {
  private tools: Map<string, CoreTool> = new Map();

  /**
   * Register a tool with a specific name
   * @param name - The name to register the tool under
   * @param tool - The CoreTool instance from tool() helper
   */
  register(name: string, tool: CoreTool): void {
    this.tools.set(name, tool);
    console.log(`🔧 Registered tool: ${name}`);
  }

  /**
   * Get tool by name
   */
  get(name: string): CoreTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tools as a record for AI SDK
   */
  getAISDKTools(): Record<string, CoreTool> {
    const tools: Record<string, CoreTool> = {};
    for (const [name, tool] of this.tools.entries()) {
      tools[name] = tool;
    }
    return tools;
  }

  /**
   * List all registered tool names
   */
  list(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Remove a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }
}
