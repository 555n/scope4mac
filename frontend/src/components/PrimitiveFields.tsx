import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Toggle } from "./ui/toggle";
import { LabelWithTooltip } from "./ui/label-with-tooltip";
import { SliderWithInput } from "./ui/slider-with-input";
import { Minus, Plus } from "lucide-react";
import React from "react";
import type {
  SchemaProperty,
  SchemaFieldUI,
  PrimitiveFieldType,
} from "../lib/schemaSettings";
import { inferPrimitiveFieldType } from "../lib/schemaSettings";
import { MIDIMappable } from "./MIDIMappable";

export interface BaseFieldProps {
  fieldKey: string;
  prop: SchemaProperty;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
  label?: string;
  tooltip?: string;
}

function formatLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function resolveLabelAndTooltip(
  fieldKey: string,
  description: string | undefined,
  label?: string,
  tooltip?: string
): { label: string; tooltip: string } {
  const resolvedLabel = label ?? description ?? formatLabel(fieldKey);
  return { label: resolvedLabel, tooltip: tooltip ?? description ?? "" };
}

export function TextField({
  fieldKey,
  prop,
  value,
  onChange,
  disabled,
  label,
  tooltip,
}: BaseFieldProps) {
  const { label: displayLabel, tooltip: displayTooltip } =
    resolveLabelAndTooltip(fieldKey, prop.description, label, tooltip);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <LabelWithTooltip
          label={displayLabel}
          tooltip={displayTooltip}
          className="text-[13px] font-semibold tracking-tight text-foreground/80"
        />
        <Input
          type="text"
          value={String(value ?? prop.default ?? "")}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className="h-7 text-[13px] bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 rounded-md px-2"
        />
      </div>
    </div>
  );
}

export function NumberField({
  fieldKey,
  prop,
  value,
  onChange,
  disabled,
  label,
  tooltip,
}: BaseFieldProps) {
  const { label: displayLabel, tooltip: displayTooltip } =
    resolveLabelAndTooltip(fieldKey, prop.description, label, tooltip);
  const rawVal = typeof value === "number" ? value : Number(prop.default) || 0;
  const numVal = Math.round(rawVal);
  const min = typeof prop.minimum === "number" ? Math.round(prop.minimum) : 0;
  const max = typeof prop.maximum === "number" ? Math.round(prop.maximum) : 2147483647;
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    if (!Number.isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <LabelWithTooltip
          label={displayLabel}
          tooltip={displayTooltip}
          className="text-[13px] font-semibold tracking-tight text-foreground/80"
        />
        <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded-full p-0.5 border border-black/10 dark:border-white/10">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:scale-90 transition-all"
            onClick={() => onChange(Math.max(min, numVal - 1))}
            disabled={disabled || numVal <= min}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <input
            type="number"
            value={numVal}
            onChange={handleInputChange}
            disabled={disabled}
            className="w-12 h-6 text-center bg-white dark:bg-white text-black rounded-full text-[13px] font-bold shadow-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-transform active:scale-95"
            min={min}
            max={max}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:scale-90 transition-all"
            onClick={() => onChange(Math.min(max, numVal + 1))}
            disabled={disabled || numVal >= max}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SliderField({
  fieldKey,
  prop,
  value,
  onChange,
  disabled,
  label,
  tooltip,
}: BaseFieldProps) {
  const { label: displayLabel, tooltip: displayTooltip } =
    resolveLabelAndTooltip(fieldKey, prop.description, label, tooltip);
  const rawVal = typeof value === "number" ? value : Number(prop.default) || 0;
  const min = typeof prop.minimum === "number" ? prop.minimum : 0;
  const max = typeof prop.maximum === "number" ? prop.maximum : 100;
  const isFloat = prop.type === "number";
  const step = isFloat ? 0.01 : 1;
  const numVal = isFloat ? rawVal : Math.round(rawVal);
  
  return (
    <SliderWithInput
      label={displayLabel}
      tooltip={displayTooltip}
      value={numVal}
      onValueChange={v => onChange(isFloat ? v : Math.round(v))}
      onValueCommit={v => onChange(isFloat ? v : Math.round(v))}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      valueFormatter={isFloat ? (v: number) => v : (v: number) => Math.round(v)}
      inputParser={
        isFloat
          ? (v: string) => parseFloat(v) || numVal
          : (v: string) => Math.round(parseFloat(v) || numVal)
      }
    />
  );
}

export function ToggleField({
  fieldKey,
  prop,
  value,
  onChange,
  disabled,
  label,
  tooltip,
}: BaseFieldProps) {
  const { label: displayLabel, tooltip: displayTooltip } =
    resolveLabelAndTooltip(fieldKey, prop.description, label, tooltip);
  const boolVal = value === true;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <LabelWithTooltip
          label={displayLabel}
          tooltip={displayTooltip}
          className="text-[13px] font-semibold tracking-tight text-foreground/80"
        />
        <Toggle
          pressed={boolVal}
          onPressedChange={p => onChange(p)}
          variant="outline"
          size="sm"
          className="h-7 px-3 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 rounded-full data-[state=on]:bg-blue-500 data-[state=on]:text-white transition-all active:scale-95"
          disabled={disabled}
        >
          {boolVal ? "ON" : "OFF"}
        </Toggle>
      </div>
    </div>
  );
}

export interface EnumFieldProps extends BaseFieldProps {
  enumValues?: string[];
}

export function EnumField({
  fieldKey,
  prop,
  value,
  onChange,
  disabled,
  label,
  tooltip,
  enumValues,
}: EnumFieldProps) {
  const { label: displayLabel, tooltip: displayTooltip } =
    resolveLabelAndTooltip(fieldKey, prop.description, label, tooltip);
  const options = enumValues ?? (prop.enum as string[]) ?? [];
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <LabelWithTooltip
          label={displayLabel}
          tooltip={displayTooltip}
          className="text-[13px] font-semibold tracking-tight text-foreground/80"
        />
        <Select
          value={String(value ?? prop.default ?? "")}
          onValueChange={v => onChange(v)}
          disabled={disabled}
        >
          <SelectTrigger className="w-[140px] h-7 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 rounded-md px-2 text-[13px] focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background/95 backdrop-blur-md border-black/10 dark:border-white/10">
            {options.map(opt => (
              <SelectItem key={String(opt)} value={String(opt)} className="text-[13px]">
                {String(opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export interface SchemaPrimitiveFieldProps extends BaseFieldProps {
  ui?: SchemaFieldUI;
  fieldType?: PrimitiveFieldType;
  enumValues?: string[];
  midiMappable?: boolean;
}

export function SchemaPrimitiveField({
  fieldKey,
  prop,
  value,
  onChange,
  disabled = false,
  label,
  tooltip,
  fieldType,
  enumValues,
  midiMappable = false,
}: SchemaPrimitiveFieldProps) {
  const resolvedType: PrimitiveFieldType | null =
    fieldType ?? inferPrimitiveFieldType(prop);
  if (!resolvedType) return null;

  const base = {
    fieldKey,
    prop,
    value,
    onChange,
    disabled,
    label: label ?? (prop.description as string) ?? undefined,
    tooltip: (tooltip ?? prop.description) as string | undefined,
  };

  let mappingType: "continuous" | "toggle" | "enum_cycle" | undefined;
  let range: { min: number; max: number } | undefined;
  let enumVals: string[] | undefined;

  if (midiMappable) {
    if (resolvedType === "toggle") {
      mappingType = "toggle";
    } else if (resolvedType === "enum") {
      mappingType = "enum_cycle";
      enumVals = enumValues ?? (prop.enum as string[]) ?? undefined;
    } else if (resolvedType === "slider" || resolvedType === "number") {
      mappingType = "continuous";
      const min = typeof prop.minimum === "number" ? prop.minimum : 0;
      const max = typeof prop.maximum === "number" ? prop.maximum : 100;
      range = { min, max };
    }
  }

  const fieldComponent = (() => {
    switch (resolvedType) {
      case "text":
        return <TextField key={fieldKey} {...base} />;
      case "number":
        return <NumberField key={fieldKey} {...base} />;
      case "slider":
        return <SliderField key={fieldKey} {...base} />;
      case "toggle":
        return <ToggleField key={fieldKey} {...base} />;
      case "enum":
        return <EnumField key={fieldKey} {...base} enumValues={enumValues} />;
      default:
        return null;
    }
  })();

  if (!fieldComponent) return null;

  if (midiMappable && mappingType) {
    return (
      <MIDIMappable
        parameterId={fieldKey}
        mappingType={mappingType}
        range={range}
        enumValues={enumVals}
      >
        {fieldComponent}
      </MIDIMappable>
    );
  }

  return fieldComponent;
}
