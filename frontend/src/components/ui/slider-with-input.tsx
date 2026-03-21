import { Button } from "./button";
import { DebouncedSlider } from "./debounced-slider";
import { LabelWithTooltip } from "./label-with-tooltip";
import { Plus, Minus } from "lucide-react";
import React from "react";

interface SliderWithInputProps {
  label?: string;
  tooltip?: string;
  value: number;
  onValueChange: (value: number) => void;
  onValueCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  incrementAmount?: number;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  debounceMs?: number;
  valueFormatter?: (value: number) => number;
  inputParser?: (value: string) => number;
  renderExtraButton?: () => React.ReactNode;
}

export function SliderWithInput({
  label,
  tooltip,
  value,
  onValueChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  incrementAmount = step,
  disabled = false,
  className = "",
  labelClassName = "",
  debounceMs = 100,
  valueFormatter = v => v,
  inputParser = v => {
    const parsed = parseFloat(v);
    return isNaN(parsed) ? min : parsed;
  },
  renderExtraButton,
}: SliderWithInputProps) {
  const handleIncrement = () => {
    const newValue = Math.min(max, value + incrementAmount);
    const formattedValue = valueFormatter(newValue);
    onValueChange(formattedValue);
    onValueCommit?.(formattedValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(min, value - incrementAmount);
    const formattedValue = valueFormatter(newValue);
    onValueChange(formattedValue);
    onValueCommit?.(formattedValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsedValue = inputParser(e.target.value);
    const clampedValue = Math.max(min, Math.min(max, parsedValue));
    const formattedValue = valueFormatter(clampedValue);
    onValueChange(formattedValue);
    onValueCommit?.(formattedValue);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        {label && (
          <LabelWithTooltip
            label={label}
            tooltip={tooltip}
            className={`text-[13px] font-semibold tracking-tight text-foreground/80 ${labelClassName}`}
          />
        )}
        <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 rounded-full p-0.5 border border-black/10 dark:border-white/10 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:scale-90 transition-all"
            onClick={handleDecrement}
            disabled={disabled}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <input
            type="number"
            value={value}
            onChange={handleInputChange}
            disabled={disabled}
            className="w-12 h-6 text-center bg-white dark:bg-white text-black rounded-full text-[13px] font-bold shadow-sm focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-transform active:scale-95"
            min={min}
            max={max}
            step={step}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 rounded-full hover:bg-black/10 dark:hover:bg-white/10 active:scale-90 transition-all"
            onClick={handleIncrement}
            disabled={disabled}
          >
            <Plus className="h-3 w-3" />
          </Button>
          {renderExtraButton?.()}
        </div>
      </div>
      <div className="px-1">
        <DebouncedSlider
          value={[value]}
          onValueChange={v => onValueChange(valueFormatter(v[0]))}
          onValueCommit={v => onValueCommit?.(valueFormatter(v[0]))}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className="w-full"
          debounceMs={debounceMs}
        />
      </div>
    </div>
  );
}
