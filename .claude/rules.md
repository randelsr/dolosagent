# Claude Code Rules for DolosAgent

## Project Overview

**DolosAgent** is a vision-enabled browser automation agent using the ReAct (Reason + Act) framework. It performs web tasks through coordinate-based navigation powered by LLM screenshot analysis.

### Core Philosophy
- **Vision-First**: Navigation via screenshot analysis and coordinate clicking (NO CSS selectors)
- **ReAct Framework**: Thought → Action → Observation loop inspired by smolagents
- **Human-Like**: Realistic typing delays, visual markers, state awareness
- **Transparent**: Full verbosity showing all LLM interactions and decisions

## Architecture

### Stack
- **Language**: TypeScript
- **Browser**: Playwright (Chromium)
- **LLM Integration**: Vercel AI SDK (multi-provider: OpenAI, Anthropic, Google)
- **Reasoning**: ReAct framework with planning and loop detection

### Key Directories
```
src/
├── core/                    # Main agent functionality
│   ├── agent.ts            # Main ReAct loop coordinator
│   ├── conversational-agent.ts  # Chat mode with persistent memory
│   ├── ai-client.ts        # LLM integration (AI SDK wrapper)
│   ├── memory.ts           # System prompt + action history
│   ├── observation.ts      # Screenshot + DOM element extraction
│   ├── planning.ts         # Periodic reflection system
│   ├── loop-detector.ts    # Repetition detection
│   └── tool-registry.ts    # Tool management
├── tools/
│   ├── browser/            # Coordinate-based browser tools
│   └── helpers.ts          # Visual debug markers
├── types/                  # TypeScript interfaces
└── cli.ts                  # CLI interface
```

## Critical Principles

### 1. Coordinate-Based Navigation ONLY

**NEVER use CSS selectors or text-based element selection.**

❌ **FORBIDDEN:**
```typescript
await page.click('button.login');
await page.locator('text=Submit').click();
await page.getByRole('button', { name: 'Login' }).click();
```

✅ **REQUIRED:**
```typescript
// Extract coordinates from visual observation
const elements = await observer.captureState();
// Click at specific viewport coordinates
await page.mouse.click(x, y);
```

**Why:** DolosAgent is vision-first. The LLM analyzes screenshots to determine coordinates, not DOM structure.

### 2. ReAct Loop Structure

Every agent action follows this cycle:

```typescript
// 1. OBSERVE - Capture page state
const observation = await observer.captureState();

// 2. DETECT - Check if state changed
const stateChanged = hasStateChanged(observation);

// 3. PLAN - Reflect periodically (every N steps)
if (stepCount % planningInterval === 0) {
  await planningEngine.executePlanningPhase(observation, stepCount, task);
}

// 4. THINK - LLM analyzes and decides
const result = await aiClient.generate({ messages, tools });

// 5. ACT - Execute tool
await executeTool(result.toolCall);

// 6. REMEMBER - Store action with actual results
memory.addActionStep({ toolName, parameters, result });

// 7. REPEAT
```

**Never skip steps or reorder them.**

### 3. Tool Results Must Be Captured

All tool executions must return actual results, not generic messages.

❌ **Wrong:**
```typescript
this.memory.addActionStep({
  result: { observation: 'click executed' }  // Generic!
});
```

✅ **Correct:**
```typescript
const toolResult = await tool.execute(args);  // "Clicked at coordinates (100, 200)"
this.memory.addActionStep({
  result: { observation: toolResult }  // Actual result!
});
```

**Why:** Planning phase needs real context about what happened.

### 4. Human-Like Behavior

All interactions must appear human:

```typescript
// Typing - character by character with delay
for (const char of text) {
  await page.keyboard.type(char);
  await page.waitForTimeout(typingDelay);  // Default: 50ms
}

// Clicking - pause to show visual marker
await addVisualMarker(page, x, y, 'red', 2000);
await page.waitForTimeout(2000);  // User can verify position
await page.mouse.click(x, y);
```

### 5. State Change Detection

Agent must recognize when pages haven't updated:

```typescript
private computeStateHash(observation: BrowserState): string {
  return JSON.stringify({
    url: observation.url,
    title: observation.title,
    elementCount: observation.elements.length,
    elements: observation.elements.slice(0, 20).map(e => ({
      tag: e.tag,
      text: e.text?.substring(0, 50),
      x: e.x, y: e.y
    }))
  });
}
```

**Warn the LLM when state is unchanged** - it may need to wait for responses.

### 6. System Prompt Philosophy

Follow smolagents' approach:

- **Minimal Instructions**: Only essential information
- **Tool-Focused**: Explain tools clearly with examples
- **Boundary Setting**: "ONLY perform actions explicitly requested"
- **Examples**: Show ✅ CORRECT vs ❌ WRONG behavior
- **Task Awareness**: "Each new user message is a NEW task"

❌ **Don't:**
- Give overly verbose instructions
- Make assumptions about user intent
- Add extra actions beyond what's requested

✅ **Do:**
- Keep it concise and actionable
- Use concrete examples
- Emphasize precise task completion

## Code Style Guidelines

### TypeScript Standards

```typescript
// ✅ Explicit types for parameters and returns
async function executeTool(
  toolName: string,
  args: Record<string, any>
): Promise<string> {
  // Implementation
}

// ✅ Interface for object shapes
interface BrowserState {
  url: string;
  title: string;
  screenshot: string;
  elements: InteractiveElement[];
  viewportSize: { width: number; height: number };
}

// ✅ Avoid 'any' - use specific types
type ToolResult = {
  success: boolean;
  observation: string;
  error?: string;
};
```

### Tool Structure

All browser tools follow this pattern:

```typescript
import { Page } from 'playwright';
import { tool } from 'ai';
import { z } from 'zod';

export function createToolName(page: Page, config?: ToolConfig) {
  return tool({
    description: 'Clear, concise description of what this tool does',
    parameters: z.object({
      param1: z.number().describe('What this parameter represents'),
      param2: z.string().describe('What this parameter represents'),
      // NO .optional() - AI SDK doesn't support it properly
    }),
    execute: async ({ param1, param2 }) => {
      // 1. Log action
      console.log(`  → Performing action...`);

      // 2. Add visual feedback if applicable
      await addVisualMarker(page, x, y, 'red', 2000);

      // 3. Execute action
      await page.mouse.click(x, y);

      // 4. Return descriptive result (NOT generic "executed")
      return `Clicked at coordinates (${x}, ${y})`;
    }
  });
}
```

### Naming Conventions
- **Files**: kebab-case (`click.tool.ts`, `loop-detector.ts`)
- **Classes**: PascalCase (`DolosAgent`, `BrowserObserver`)
- **Functions**: camelCase (`captureState`, `executeTool`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_MAX_STEPS`)
- **Interfaces/Types**: PascalCase (`BrowserState`, `AgentConfig`)

## Tool Development Rules

### Adding New Tools

1. **Must be coordinate-based** - No selectors
2. **Return descriptive results** - Not "executed" or "done"
3. **Add visual feedback** - Use markers for coordinate actions
4. **Handle errors gracefully** - Return error strings, don't throw
5. **Register in agent.ts** - Add to `registerBrowserTools()`
6. **Wrap for result capture** - Use `wrapToolWithResultCapture()`

### Tool Parameter Rules

```typescript
// ❌ DON'T use optional parameters
parameters: z.object({
  x: z.number(),
  y: z.number(),
  debugMarker: z.boolean().optional()  // AI SDK validation fails!
})

// ✅ DO use defaults in execute function
parameters: z.object({
  x: z.number(),
  y: z.number()
})
execute: async ({ x, y }) => {
  const debugMarker = true;  // Default handled here
}
```

### Excluded Tool Types

**Never implement:**
- Text-based clicking (`clickText`, `clickByLabel`)
- Selector-based tools (`querySelector`, `extract`)
- DOM manipulation (`setAttribute`, `removeElement`)

## Memory & Context Management

### Action Storage

```typescript
memory.addActionStep({
  stepNumber: 1,
  toolName: 'click',
  parameters: { x: 100, y: 200 },
  reasoning: 'I can see the login button at coordinates (100, 200)',
  observation: browserState,
  result: {
    success: true,
    observation: 'Clicked at coordinates (100, 200)'  // Actual result!
  }
});
```

### Planning Context

Planning must see **full action history with results**:

```typescript
const detailedActionLog = recentActions.map(a => {
  let log = `Step ${a.stepNumber}: ${a.toolName}(${JSON.stringify(a.parameters)})`;

  if (a.reasoning) {
    log += `\n  Reasoning: ${a.reasoning}`;
  }

  if (a.result?.observation) {
    log += `\n  Result: ${a.result.observation}`;  // CRITICAL!
  }

  return log;
}).join('\n\n');
```

## Verbosity & Logging

### Required Logging Points

```typescript
// 1. Screenshot capture
console.log('📸 CAPTURING PAGE STATE');
console.log(`✓ Screenshot captured: ${bytes} bytes`);
console.log(`✓ Found ${elements.length} interactive elements`);

// 2. State interpretation
console.log('🔎 PAGE STATE INTERPRETATION');
console.log(`State Changed: ${stateChanged ? 'YES ✓' : 'NO ✗'}`);

// 3. Full LLM prompt
console.log('📤 SENDING TO LLM');
console.log('SYSTEM PROMPT:', systemPrompt.substring(0, 500) + '...');
console.log('USER MESSAGES:', /* log each message */);

// 4. Full LLM response
console.log('📥 LLM RESPONSE');
console.log(`Finish Reason: ${result.finishReason}`);
console.log(`Thinking/Reasoning:\n${result.text}`);
console.log(`Tool Calls:`, result.toolCalls);

// 5. Tool execution
console.log(`🔧 Tool: ${toolName}(${JSON.stringify(args)})`);
console.log(`  ✓ Tool result captured: ${result}`);
```

**Why:** Users need complete transparency for debugging and trust.

## Configuration Management

### Environment Variables

```bash
# Required API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Defaults
DEFAULT_PROVIDER=openai
DEFAULT_MODEL=gpt-4o
DEFAULT_IMAGE_PROVIDER=google
DEFAULT_IMAGE_MODEL=gemini-2.0-flash-exp

# Agent Behavior
DEFAULT_MAX_STEPS=50
DEFAULT_PLANNING_INTERVAL=5
DEFAULT_TYPING_DELAY=50
```

### CLI Options

All config should be accessible via:
1. Environment variables (`.env`)
2. CLI flags (`--model`, `--provider`, etc.)
3. Programmatic config (`AgentConfig` interface)

## Testing Requirements

### Before Committing

- [ ] TypeScript compiles: `npm run build`
- [ ] No console errors (except expected LLM warnings)
- [ ] Visual markers display correctly
- [ ] State change detection working
- [ ] Tool results captured (not generic "executed")
- [ ] Planning phase sees full context

### Manual Testing Checklist

```bash
# Test basic navigation
dolos run -t "navigate to google.com" -u "https://google.com"

# Test click accuracy
dolos run -t "click the search button" -u "https://example.com"

# Test typing with human delay
dolos run -t "type 'hello world' in the search box" -u "https://google.com"

# Test conversational mode
dolos chat -u "https://example.com"
# Give multiple sequential tasks
```

## Common Patterns

### Dual Model Configuration

Recommended: Cheap vision model + capable main model

```typescript
const agent = new DolosAgent({
  provider: 'openai',
  model: 'gpt-4o',              // Main reasoning
  imageProvider: 'google',       // Vision analysis
  imageModel: 'gemini-2.0-flash-exp',  // Cheap & fast
  typingDelay: 50,
  maxSteps: 50,
  planningInterval: 5
});
```

### Tool Result Wrapping

Always wrap tools to capture results:

```typescript
private wrapToolWithResultCapture(toolName: string, tool: any): any {
  const originalExecute = tool.execute.bind(tool);

  return {
    ...tool,
    execute: async (args: any) => {
      const result = await originalExecute(args);
      this.lastToolResults.set(toolName, result);  // Store for retrieval
      return result;
    }
  };
}
```

### State Change Warning

```typescript
if (!stateChanged && stepCount > 1) {
  const warning = `
⚠️  WARNING: The page state has NOT changed since your last action. This may mean:
- A chat agent is still typing/thinking and you should wait
- A response is loading and needs more time
- Your last action had no effect
Consider using the wait() tool to give the page more time to respond.
  `.trim();

  // Add to LLM prompt
}
```

## Anti-Patterns to Avoid

### ❌ Don't Do This

1. **Selector-based navigation**
   ```typescript
   await page.click('button.login');  // FORBIDDEN!
   ```

2. **Generic tool results**
   ```typescript
   return 'executed';  // Not helpful!
   ```

3. **Optional parameters in tools**
   ```typescript
   z.object({ x: z.number().optional() })  // AI SDK fails!
   ```

4. **Skipping visual markers**
   ```typescript
   await page.mouse.click(x, y);  // Too fast! No marker!
   ```

5. **Ignoring state change**
   ```typescript
   // Don't proceed without checking if page updated
   ```

6. **Throwing errors from tools**
   ```typescript
   throw new Error('Failed');  // Return error string instead!
   ```

## Debug Marker Hygiene

Visual markers must not pollute state detection:

```typescript
// Create marker with exclusion class
const marker = document.createElement('div');
marker.className = 'dolos-debug-marker';  // CRITICAL!
marker.style.position = 'fixed';
// ... rest of styling

// Exclude from observation
if (element.classList.contains('dolos-debug-marker')) {
  return;  // Skip this element
}
```

## Emergency Procedures

### Build Failing
1. Check TypeScript: `npx tsc --noEmit`
2. Clear dist: `rm -rf dist && npm run build`
3. Reinstall: `rm -rf node_modules && npm install`

### Agent Loops or Gets Stuck
1. Check loop detector warnings in console
2. Verify state change detection working (look for "State Changed: NO")
3. Increase typing delay or wait times
4. Check planning phase logs for context

### Wrong Coordinates Clicked
1. Verify visual marker position (red/blue circle)
2. Check viewport size matches observation
3. Review element extraction logs
4. Consider using different vision model

### High Token Usage
1. Use dual-model config (cheap vision model)
2. Reduce `--max-steps`
3. Increase `--planning-interval`
4. Check for excessive element lists in prompts

## Documentation References

- **System Prompt**: `src/core/memory.ts` (smolagents-inspired)
- **ReAct Loop**: `src/core/agent.ts` (main implementation)
- **Tool Examples**: `src/tools/browser/*.tool.ts`
- **README**: Project overview and usage

## Output Formatting Rules

### NO EMOJIS EVER

**NEVER use emojis in any output, logging, or code comments.**

❌ **FORBIDDEN:**
```typescript
console.log('🚀 Initializing agent...');
console.log('✅ Success!');
console.log('📸 Capturing screenshot');
```

✅ **REQUIRED:**
```typescript
console.log('Initializing agent...');
console.log('Success');
console.log('Capturing screenshot');
```

### Logging Format

All logging must use **single-column table format** with box-drawing characters:

```typescript
// Header with content below
console.log('\n' + '─'.repeat(80));
console.log('STEP 1: OBSERVE');
console.log('─'.repeat(80));
console.log('Screenshot captured: 245678 bytes');
console.log('Found 74 interactive elements (62 visible)');
console.log('─'.repeat(80) + '\n');
```

Follow smolagents style:
- Use `─` (U+2500) for horizontal lines
- Use `│` (U+2502) for vertical separators if needed
- Headers go in the title line
- Content goes in cells below
- Keep it clean and readable

## Final Notes

- **Vision-first is non-negotiable** - No selectors, ever
- **Results matter** - Capture and store real tool outcomes
- **Human-like is critical** - Typing delays and visual feedback
- **Transparency builds trust** - Log everything
- **Planning needs context** - Full action history with results
- **NO EMOJIS EVER** - Clean, professional output only

---

**When in doubt:** Check existing tools in `src/tools/browser/` for patterns, and ensure all actions are coordinate-based.
