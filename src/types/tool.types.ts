/**
 * Tool types for Vercel AI SDK integration
 */

import { CoreTool } from 'ai';

/**
 * Browser tools are CoreTool instances created via tool() helper
 * No wrapper needed - AI SDK handles execution, validation, and results
 */
export type BrowserTool = CoreTool;
