import type { InputMode } from "../types";

// Default prompts by mode - used across all pipelines for consistency
export const DEFAULT_PROMPTS: Record<InputMode, string> = {
  text: "bright clouds on an acid iridescent sky",
  video: "bright clouds on an acid iridescent sky",
};

export function getDefaultPromptForMode(mode: InputMode): string {
  return DEFAULT_PROMPTS[mode];
}
