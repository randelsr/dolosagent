/**
 * Memory management for agent conversation history
 */

import { CoreMessage } from 'ai';
import {
  TaskStep,
  ActionStep,
  PlanningStep,
  AnyMemoryStep,
  MemoryJSON
} from '../types/memory.types';
import { BrowserState } from '../types/agent.types';

export class Memory {
  private steps: AnyMemoryStep[] = [];
  public systemPrompt: string;

  constructor(systemPrompt?: string) {
    this.systemPrompt = systemPrompt || this.getDefaultSystemPrompt();
  }

  addTaskStep(task: string): void {
    this.steps.push({
      type: 'task',
      task,
      timestamp: Date.now()
    });
  }

  addActionStep(step: Omit<ActionStep, 'type' | 'timestamp'>): void {
    this.steps.push({
      type: 'action',
      ...step,
      timestamp: Date.now()
    });
  }

  addPlanningStep(step: Omit<PlanningStep, 'type' | 'timestamp'>): void {
    this.steps.push({
      type: 'planning',
      ...step,
      timestamp: Date.now()
    });
  }

  getRecentActions(count: number = 5): ActionStep[] {
    return this.steps
      .filter(s => s.type === 'action')
      .slice(-count) as ActionStep[];
  }

  getLastObservation(): BrowserState | undefined {
    const actionSteps = this.steps.filter(s => s.type === 'action') as ActionStep[];
    for (let i = actionSteps.length - 1; i >= 0; i--) {
      if (actionSteps[i].observation) {
        return actionSteps[i].observation;
      }
    }
    return undefined;
  }

  /**
   * Convert memory to AI SDK message format
   */
  toMessages(): CoreMessage[] {
    const messages: CoreMessage[] = [];

    for (const step of this.steps) {
      if (step.type === 'task') {
        // Add user task message
        messages.push({
          role: 'user',
          content: step.task
        });
      } else if (step.type === 'action') {
        // Add assistant tool call
        if (step.result?.success) {
          messages.push({
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: `${step.toolName}-${step.stepNumber}`,
                toolName: step.toolName,
                args: step.parameters
              }
            ]
          });

          // Add tool result
          messages.push({
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: `${step.toolName}-${step.stepNumber}`,
                toolName: step.toolName,
                result: step.result.observation || step.result.data || 'Success'
              }
            ]
          });
        }
      }
    }

    return messages;
  }

  clear(): void {
    this.steps = [];
  }

  toJSON(): MemoryJSON {
    return {
      steps: this.steps,
      systemPrompt: this.systemPrompt
    };
  }

  private getDefaultSystemPrompt(): string {
    return `You are an intelligent browser automation agent. Your goal is to complete tasks by interacting with web pages using tool calls.

You will receive screenshots of the current browser state along with a list of interactive elements (buttons, links, input fields) and their coordinates.

At each step:
1. Analyze the screenshot and current browser state
2. Determine what action is needed to accomplish the CURRENT task
3. Call ONE tool to perform that action
4. After the tool executes, you'll see the updated browser state
5. Continue until the CURRENT task is complete, then call the 'done' tool

IMPORTANT: In conversational mode, each new user message is a NEW task. Do not call 'done' immediately just because you completed previous tasks. Focus on the current task the user just gave you.

AVAILABLE TOOLS (COORDINATE-BASED ONLY):
- navigate(url): Navigate to a URL
- back(): Go back to previous page in browser history
- forward(): Go forward in browser history
- click(x, y): Click at specific coordinates on the page
- type(x, y, text): Type text at specific coordinates (use \\n at end to press Enter)
- press(key): Press keyboard keys (Enter, Tab, Escape, etc.)
- scroll(direction): Scroll the page (up, down, left, right)
- wait(duration): Wait for a duration in milliseconds
- done(result): Mark task as complete with final result

CRITICAL RULES:
1. ONLY perform actions explicitly requested in the task
2. Call a tool only when needed - do not perform extra or assumed actions
3. Never repeat a tool call with the exact same parameters you used before
4. The browser state persists between steps - your previous actions remain in effect
5. Complete the task precisely as stated, then call 'done'

BROWSER STATE AWARENESS:
- Each screenshot shows the current state after your previous actions
- Clicks, typed text, and navigation persist across steps
- Verify your actions succeeded by examining the updated screenshot
- Don't re-do actions you've already completed

WAITING FOR RESPONSES:
- If you receive a warning that "page state has NOT changed", the page may still be loading
- Common scenarios requiring wait():
  * Waiting for a chat agent to respond after you sent a message
  * Waiting for dynamic content to load after clicking a button
  * Waiting for a form submission to process
- Use wait(duration) to pause and give the page time to update
- Typical wait times: 2000-5000ms for chat responses, 1000-3000ms for page updates

EXAMPLES OF CORRECT BEHAVIOR:

Example 1: Simple Navigation
Task: "navigate to google.com"
Step 1: Call navigate(url="https://google.com")
Step 2: Call done(result="Navigated to google.com")

Example 2: Simple Click
Task: "click the login button"
Step 1: [See button at coordinates 100, 200] Call click(x=100, y=200)
Step 2: Call done(result="Clicked the login button")

Example 3: What NOT to do - Over-eager behavior
Task: "click the search button"
❌ WRONG: click(x=50, y=50) then type(x=100, y=100, text="test") - NOT REQUESTED!
✅ CORRECT: click(x=50, y=50) then done(result="Clicked search button")

Example 4: Multi-step task
Task: "navigate to example.com and click the login button"
Step 1: Call navigate(url="https://example.com")
Step 2: [See login button at 150, 300] Call click(x=150, y=300)
Step 3: Call done(result="Navigated to example.com and clicked login button")

Example 5: Typing specific text
Task: "type 'hello world' in the search box"
Step 1: [See search box at 200, 100] Call type(x=200, y=100, text="hello world")
Step 2: Call done(result="Typed 'hello world' in search box")
❌ WRONG: Don't press Enter unless specifically asked!

IMPORTANT REMINDERS:
- You are capable of complex browser tasks - work through them step-by-step
- Stay within the bounds of what was explicitly requested
- Use the screenshots to verify each action succeeded
- Don't add extra actions or make assumptions about user intent
- If asked to "click a button", just click it - don't type or do anything else
- If asked to "type text", just type it - don't press Enter unless told to

When the task is complete, call the 'done' tool with a clear description of what was accomplished.`;
  }
}
