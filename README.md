# DolosAgent

Vision-enabled browser automation agent using ReAct reasoning and coordinate-based navigation.

## Features

- **Vision-First Navigation** - Screenshot analysis for coordinate-based clicking (no CSS selectors)
- **ReAct Framework** - Reason + Act loop with planning and loop detection
- **Multi-Provider LLMs** - OpenAI, Anthropic, or Google
- **Conversational Mode** - Persistent memory across multiple tasks
- **Human-Like Typing** - Configurable delay between keystrokes
- **State Change Detection** - Automatically waits for page updates
- **Full Verbosity** - Complete transparency into LLM reasoning and decisions

## Quick Start

```bash
# Install and build
npm install && npm run build && npm link

# Configure API keys
cp .env.example .env
# Edit .env and add your API key(s)

# Run a task
dolos run -t "Navigate to google.com and search for TypeScript"

# Start conversational mode
dolos chat -u "https://example.com"
```

## Usage

### One-Shot Task
```bash
dolos run \
  --provider openai \
  --model gpt-4o \
  --image-provider google \
  --image-model gemini-2.0-flash-exp \
  -t "Click the login button and type username 'demo'" \
  -u "https://example.com"
```

### Conversational Mode
```bash
dolos chat --provider anthropic --model claude-sonnet-4-20250514

👤 You: navigate to salesforce.com
🤖 Navigated to salesforce.com

👤 You: click the ask agentforce button
🤖 Clicked button and chat opened

👤 You: type "hello world" and press enter
🤖 Typed message and sent
```

## Configuration

### Environment Variables (.env)
```bash
# API Keys
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
DEFAULT_TYPING_DELAY=50     # milliseconds between keystrokes
DEFAULT_VERBOSITY=info      # error, warn, info, debug, trace
```

### CLI Options
```bash
-t, --task <task>              Task to execute (required for 'run')
-u, --url <url>                Starting URL
--provider <provider>          LLM provider (openai|anthropic|google)
--model <model>                Main model name
--image-provider <provider>    Vision model provider
--image-model <model>          Vision model name
--max-steps <number>           Maximum steps (default: 50)
--planning-interval <number>   Planning frequency (default: 5)
--typing-delay <number>        Typing delay in ms (default: 50)
--verbosity <level>            Logging verbosity (error|warn|info|debug|trace)
--headless                     Run browser headless
```

### Verbosity Levels
Control logging output with the `--verbosity` flag or `DEFAULT_VERBOSITY` env var:

- **error**: Critical errors only
- **warn**: Warnings + loop detection alerts
- **info**: Step progress, task start/end, token counts (default)
- **debug**: Page state, memory, element lists, planning
- **trace**: Full LLM prompts and responses

Output is color-coded for readability:
- Errors: Red
- Warnings: Yellow
- Info: Cyan
- Success: Green
- Debug: Gray
- Trace: Magenta
```

## How It Works

### ReAct Loop
```
1. OBSERVE    → Capture screenshot + extract DOM elements
2. DETECT     → Check if page state changed
3. PLAN       → Reflect on progress (every N steps)
4. THINK      → LLM analyzes and decides next action
5. ACT        → Execute tool (click, type, navigate, etc.)
6. REMEMBER   → Store action with actual results
7. REPEAT     → Until task complete or max steps
```

### Available Tools (Coordinate-Based Only)
- `navigate(url)` - Navigate to URL
- `back()` - Browser back button
- `forward()` - Browser forward button
- `click(x, y)` - Click at coordinates
- `type(x, y, text)` - Type text (use `\n` for Enter)
- `press(key)` - Press keyboard key
- `scroll(direction)` - Scroll up/down/left/right
- `wait(duration)` - Wait milliseconds
- `done(result)` - Complete task

### Planning System
Every N steps (default: 5), the agent reflects:
```
FACTS: What I know to be true
NEXT STEPS: What to do next
CONTINUE: yes/no
```

Includes full action history with results for context.

### State Change Detection
Detects when page hasn't changed after an action:
```
⏳ Page state unchanged - may be waiting for response...
⚠️  WARNING: The page state has NOT changed since your last action.
Consider using wait() to give the page more time to respond.
```

### Loop Detection
Prevents repeated actions at similar coordinates:
```
⚠️ LOOP DETECTED: Repeated click 3 times. Try a different approach!
```

## Verbosity & Debugging

Full transparency into agent decisions:

**Screenshot Capture:**
```
📸 CAPTURING PAGE STATE
✓ Screenshot captured: 245678 bytes
✓ Found 74 interactive elements (62 visible)
Top 10 visible elements:
  1. button at (850, 40) - "Ask Agentforce"
```

**LLM Prompt:**
```
📤 SENDING TO LLM
SYSTEM PROMPT: You are an intelligent browser automation agent...
USER MESSAGES:
  🎯 CURRENT TASK: click on ask agentforce button
  Current Browser State: [62 visible elements]
  IMAGE: [base64 screenshot, 327571 bytes]
```

**LLM Response:**
```
📥 LLM RESPONSE
Thinking/Reasoning: I can see the button at (850, 40)...
Tool Calls: click({"x":850,"y":40})
```

## Recommended Models

**Cost-Optimized (Recommended):**
- Main: `gpt-4o` (OpenAI)
- Vision: `gemini-2.0-flash-exp` (Google) - fast & cheap

**High Quality:**
- Main: `gpt-5` (OpenAI)
- Vision: `gpt-5` (OpenAI)

**Budget:**
- Main: `gpt-4o-mini` (OpenAI)
- Vision: `gemini-2.0-flash-exp` (Google)

## Project Structure
```
src/
├── core/
│   ├── agent.ts              # Main ReAct loop
│   ├── conversational-agent.ts
│   ├── memory.ts             # Action history
│   ├── observation.ts        # Screenshot + DOM
│   ├── planning.ts           # Reflection system
│   ├── loop-detector.ts      # Repetition detection
│   └── ai-client.ts          # LLM integration
├── tools/browser/            # Coordinate-based tools
│   ├── click.tool.ts
│   ├── type.tool.ts
│   ├── navigate.tool.ts
│   └── ...
└── cli.ts                    # CLI interface
```

## Troubleshooting

**"API key not set"**
```bash
cp .env.example .env
# Add your API key(s)
```

**Browser doesn't launch**
```bash
npx playwright install chromium
```

**Coordinates are off / Wrong elements clicked**
- Check console for visual marker position (red/blue circles)
- Agent pauses 2 seconds before clicking (verify position)
- Use verbosity logs to see element detection

**High token usage**
- Use dual-model config (cheap vision model)
- Reduce `--max-steps`
- Increase `--planning-interval`

**Agent keeps repeating same action**
- Loop detector should warn after 3 repetitions
- Check if page state is actually changing
- Agent may need `wait()` for dynamic content

## Key Design Principles

1. **Coordinate-Based Only** - No CSS selectors, pure visual navigation
2. **Smolagents System Prompt** - Proven ReAct patterns
3. **Tool Results in Planning** - Full context for decision-making
4. **State Change Awareness** - Knows when to wait
5. **Human-Like Behavior** - Typing delays, visual markers

## License

MIT

## Credits

- ReAct Framework: [smolagents](https://github.com/huggingface/smolagents)
- Browser Automation: [Playwright](https://playwright.dev/)
- AI SDK: [Vercel AI SDK](https://sdk.vercel.ai/)
