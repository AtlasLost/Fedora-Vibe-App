
export interface HardeningOption {
  id: string;
  label: string;
  description: string;
  prompt: string;
  subOptions?: HardeningOption[];
  rebootRequired?: boolean;
}

export type SelectedOptions = Record<string, boolean>;

export interface AnalysisResult {
  analysisText: string;
  securityScore: number;
}

export interface RefinedPrompt {
    id: string;
    newPrompt: string;
}

export interface ImprovementResult {
    correctedScript: string;
    refinedPrompts: RefinedPrompt[];
    improvementSummary: string[];
}

export interface ParanoiaLevel {
  level: number;
  title: string;
  description: string;
  options: HardeningOption[];
}

export interface SuggestedPrompt {
  label: string;
  promptText: string;
}