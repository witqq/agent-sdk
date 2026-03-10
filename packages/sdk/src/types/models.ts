/** Model metadata returned by listModels() */
export interface ModelInfo {
  id: string;
  name?: string;
  provider?: string;
  /** Model tier for UI categorization and cost hints */
  tier?: "fast" | "standard" | "premium";
  /** Context window size in tokens */
  contextWindow?: number;
  /** Model capabilities (e.g. "vision", "tools", "structured") */
  capabilities?: string[];
}

/** LLM model parameters */
export interface ModelParams {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
}

/** Result of backend validation check */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
