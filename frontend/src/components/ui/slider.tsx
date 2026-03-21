import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import { AQUA_GRADIENTS } from "@/lib/AquaStyles";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center py-2",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2.5 w-full grow overflow-hidden rounded-full bg-black/10 shadow-inner">
      <SliderPrimitive.Range 
        className="absolute h-full" 
        style={{ background: AQUA_GRADIENTS.aquaGel }}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border border-black/20 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.3)] ring-offset-background transition-all hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:pointer-events-none disabled:opacity-50 cursor-pointer relative">
       <span style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "40%",
            background: "linear-gradient(180deg, rgba(255,255,255,0.8) 0%, transparent 100%)",
            borderRadius: "50%",
            pointerEvents: "none",
          }} />
    </SliderPrimitive.Thumb>
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
