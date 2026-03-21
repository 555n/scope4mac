import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { AQUA_GRADIENTS } from "@/lib/AquaStyles";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-bold ring-offset-background transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden",
  {
    variants: {
      variant: {
        default: "text-white border border-black/25 shadow-sm",
        destructive: "text-white border border-black/25 shadow-sm",
        outline: "border border-black/20 bg-white/50 hover:bg-white/80",
        secondary: "bg-black/10 text-black border border-black/10",
        ghost: "hover:bg-black/5 text-black/70 hover:text-black",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-4 py-2",
        sm: "h-7 rounded-full px-3 text-xs",
        lg: "h-10 rounded-full px-8",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, style, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    // Inject Aqua Gel styles for default and destructive
    const aquaStyle: React.CSSProperties = { ...style };
    if (variant === "default") {
      aquaStyle.background = AQUA_GRADIENTS.aquaGel;
      aquaStyle.textShadow = "0 -1px 0 rgba(0,0,0,0.2)";
    } else if (variant === "destructive") {
      aquaStyle.background = `linear-gradient(180deg, #ff8f87 0%, #ff5f57 40%, #e04040 60%, #ff7f77 100%)`;
      aquaStyle.textShadow = "0 -1px 0 rgba(0,0,0,0.2)";
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        style={aquaStyle}
        {...props}
      >
        {(variant === "default" || variant === "destructive") && (
          <span style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "45%",
            background: "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 100%)",
            borderRadius: "0 0 50% 50% / 0 0 100% 100%",
            pointerEvents: "none",
          }} />
        )}
        <span className="relative z-10 flex items-center gap-2">{children}</span>
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
