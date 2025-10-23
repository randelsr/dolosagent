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

You: navigate to salesforce.com
Agent: Navigated to salesforce.com

You: click the ask agentforce button
Agent: Clicked button and chat opened

You: type "hello world" and press enter
Agent: Typed message and sent
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
DEFAULT_TYPING_DELAY=50      # milliseconds between keystrokes
DEFAULT_NETWORK_WAIT=2000    # milliseconds to wait after network-triggering actions
DEFAULT_VERBOSITY=info       # error, warn, info, debug, trace
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
--network-wait <number>        Network wait in ms (default: 2000)
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
- `type(x, y, text)` - Type text only (no special keys)
- `press(key)` - Press keyboard key (Enter, Tab, Escape, etc.)
- `scroll(direction)` - Scroll up/down/left/right
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
WARNING: The page state has NOT changed since your last action.
This may mean:
- A chat agent is still typing/thinking
- A response is loading and needs more time
- Your last action had no effect
The next screenshot will show if the page updates.
```

### Loop Detection
Prevents repeated actions at similar coordinates:
```
LOOP DETECTED: Repeated click 3 times. Try a different approach!
```

## Verbosity & Debugging

Full transparency into agent decisions:

**Screenshot Capture:**
```
CAPTURING PAGE STATE
Screenshot captured: 245678 bytes
Found 74 interactive elements (62 visible)
Top 10 visible elements:
  1. button at (850, 40) - "Ask Agentforce"
```

**Vision Analysis:**
```
VISION ANALYSIS PHASE
Sending screenshot to vision model...
1. WHAT I SEE:
   - Ask Agentforce button at (850, 40)
   - Search field at (500, 100)
...
3. NEXT ACTION TARGET:
   NEXT_TARGET: Ask Agentforce button at (850, 40)
```

**Logic Decision:**
```
LOGIC DECISION PHASE
Logic reasoning: The vision analysis identified the Ask Agentforce button
at coordinates (850, 40). I should click it to proceed.
Tool calls: click({"x":850,"y":40})
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

## Future Improvements

### Intelligent Page State Detection
**Current Approach:** Fixed timeout after actions (e.g., 2000ms after click/press)

**Problem:** Modern web apps use streaming responses (WebSockets, Server-Sent Events) and dynamic content loading that continue beyond fixed timeouts. Screenshots may capture loading states instead of final content.

**Observed Issue:** AI chat interfaces (e.g., Salesforce Agentforce) stream responses over WebSocket connections. Fixed timeouts capture "typing..." indicators and incomplete responses.

**Potential Solutions:**
1. **WebSocket Monitoring** - Track WebSocket frame activity using Playwright's `page.on('websocket')` events
2. **Loading Indicator Detection** - Wait for visual indicators to disappear (spinners, "typing...", skeleton loaders)
3. **Text Stability Detection** - Monitor DOM text content and wait for stabilization period
4. **Hybrid Approach** - Combine DOM mutation observer + WebSocket tracking + visual indicator detection

**Implementation Complexity:** Medium-High
- Requires different strategies per application type
- Need to balance wait time vs. responsiveness
- Risk of false positives (page appears stable but still loading)

**Trade-offs:**
- Fixed timeout: Fast but may miss content
- Smart detection: More reliable but slower and complex

**Reference:** See deleted `src/tools/helpers/smart-wait.ts` for initial DOM mutation + fetch tracking implementation (insufficient for WebSocket/streaming)

## License

MIT

## Credits

- ReAct Framework: [smolagents](https://github.com/huggingface/smolagents)
- Browser Automation: [Playwright](https://playwright.dev/)
- AI SDK: [Vercel AI SDK](https://sdk.vercel.ai/)
