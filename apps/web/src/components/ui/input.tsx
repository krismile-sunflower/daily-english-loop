import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-[16px] border border-[color:var(--hairline)] bg-white/72 px-4 text-base font-semibold text-[var(--text)] outline-none transition-[border-color,background-color,box-shadow] duration-300 placeholder:text-[var(--muted-2)] focus:border-[color:var(--action)] focus:bg-white focus:ring-4 focus:ring-[color:var(--action-soft)]",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
