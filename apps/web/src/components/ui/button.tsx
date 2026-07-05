import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border px-5 text-sm font-extrabold transition-[border-color,background-color,color,box-shadow,transform,opacity] duration-300 ease-[var(--ease-soft)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--action-soft)] disabled:pointer-events-none disabled:opacity-45 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "border-[color:var(--action)] bg-[var(--action)] text-[var(--button-on-action)] shadow-[0_10px_24px_rgba(245,134,123,0.24)] hover:bg-[var(--action-strong)] hover:shadow-[0_14px_32px_rgba(245,134,123,0.28)] hover:-translate-y-0.5",
        secondary:
          "border-[color:var(--hairline)] bg-[var(--surface-2)] text-[var(--text)] shadow-[0_8px_20px_rgba(91,71,46,0.07)] hover:border-[color:var(--hairline-strong)] hover:bg-[var(--surface-1)] hover:-translate-y-0.5",
        ghost:
          "border-transparent bg-transparent text-[var(--muted)] hover:bg-white/50 hover:text-[var(--text)]",
        danger:
          "border-[color:rgba(201,101,101,0.18)] bg-[rgba(201,101,101,0.11)] text-[var(--danger)] hover:bg-[rgba(201,101,101,0.16)]",
        success:
          "border-[color:rgba(111,156,99,0.18)] bg-[rgba(111,156,99,0.13)] text-[var(--accent-light)] hover:bg-[rgba(111,156,99,0.18)]"
      },
      size: {
        sm: "h-9 px-4 text-xs",
        md: "h-11 px-5",
        lg: "h-[52px] min-h-[52px] px-6 text-base",
        icon: "h-11 w-11 px-0"
      }
    },
    defaultVariants: {
      variant: "secondary",
      size: "md"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";
