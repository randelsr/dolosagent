/**
 * Memory types for agent history tracking
 */

import { BrowserState } from './agent.types';

export interface MemoryStep {
  type: 'task' | 'action' | 'planning' | 'vision-analysis';
  timestamp: number;
}

export interface TaskStep extends MemoryStep {
  type: 'task';
  task: string;
}

export interface ActionStep extends MemoryStep {
  type: 'action';
  stepNumber: number;
  toolName: string;
  parameters: Record<string, any>;
  reasoning: string;
  observation?: BrowserState;
  result?: {
    success: boolean;
    data?: any;
    error?: string;
    observation?: string;
  };
}

export interface PlanningStep extends MemoryStep {
  type: 'planning';
  stepNumber: number;
  currentFacts: string[];
  nextSteps: string[];
}

export interface VisionAnalysisStep extends MemoryStep {
  type: 'vision-analysis';
  stepNumber: number;
  analysis: string;
  observation: BrowserState;
}

export type AnyMemoryStep = TaskStep | ActionStep | PlanningStep | VisionAnalysisStep;

export interface MemoryJSON {
  steps: AnyMemoryStep[];
  systemPrompt: string;
}
