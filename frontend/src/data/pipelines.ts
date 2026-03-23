import type { InputMode } from "../types";

// Default prompts by mode - used across all pipelines for consistency
export const DEFAULT_PROMPTS: Record<InputMode, string> = {
  text: "neon bacteria fungi bioluminescence",
  video: "neon bacteria fungi bioluminescence",
};

export function getDefaultPromptForMode(mode: InputMode): string {
  return DEFAULT_PROMPTS[mode];
}
