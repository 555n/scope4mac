/**
 * useOscPaths — derives sequencer-eligible runtime parameters from pipeline schemas.
 *
 * Reads pipeline schemas (already loaded by usePipelinesContext) and extracts
 * numeric runtime parameters for each pipeline in the active chain.
 * Responds instantly to node add/remove — no streaming required.
 */

import { useMemo } from "react";

export interface OscParam {
  key: string;
  type: string;
  description: string;
  min?: number;
  max?: number;
  label?: string;
  pipelineId?: string;
  oscAddress: string;
}

// Params handled by hardwired tracks or dedicated UI — skip
const SKIP_KEYS = new Set([
  "strength", "seed",
  "seed_lfo", "seed_lfo_ms", "seed_lfo_amount", "seed_lfo_hz",
  "height", "width", "use_gpu_native",
  "rife_mode", "target_fps", "depth",
  "lookahead_frames",
  "base_seed", "vace_context_scale", "denoising_steps",
  "noise_scale", "noise_controller", "manage_cache",
  "lora_merge_strategy", "input_size", "ref_images",
  "quantization",
]);

/**
 * @param pipelineIds — the current pre+post processor IDs in the chain
 * @param pipelineSchemas — all available pipeline schemas from usePipelinesContext
 */
export function useOscPaths(
  pipelineIds: string[],
  pipelineSchemas: Record<string, any> | null,
): { activeParams: OscParam[] } {
  const activeParams = useMemo(() => {
    if (!pipelineSchemas || pipelineIds.length === 0) return [];

    const params: OscParam[] = [];

    for (const pid of pipelineIds) {
      const schema = pipelineSchemas[pid];
      if (!schema) continue;

      const configSchema = schema.config_schema || schema.configSchema;
      if (!configSchema) continue;

      const properties = configSchema.properties || {};
      const defs = configSchema.$defs || configSchema.definitions || {};

      for (const [key, prop] of Object.entries(properties) as [string, any][]) {
        if (SKIP_KEYS.has(key)) continue;

        // Only include params with explicit UI metadata (skip base schema inherited fields)
        const ui = prop.ui;
        if (!ui) continue;
        if (ui.is_load_param === true) continue;

        // Resolve $ref to get type info
        let resolvedProp = prop;
        if (prop.$ref) {
          const refName = prop.$ref.split("/").pop();
          if (refName && defs[refName]) {
            resolvedProp = { ...defs[refName], ...prop };
          }
        }

        const pType = resolvedProp.type || "any";
        // Only numeric types for sequencer tracks
        if (!["number", "integer", "float"].includes(pType)) continue;

        params.push({
          key,
          type: pType === "number" ? "float" : pType,
          description: resolvedProp.description || "",
          min: resolvedProp.minimum ?? resolvedProp.ge,
          max: resolvedProp.maximum ?? resolvedProp.le,
          label: ui.label || key,
          pipelineId: pid,
          oscAddress: `/scope/${key}`,
        });
      }
    }

    return params;
  }, [pipelineIds, pipelineSchemas]);

  return { activeParams };
}
