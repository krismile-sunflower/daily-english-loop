import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-11 rounded-[16px] border border-[color:var(--hairline)] bg-white/72 px-4 text-sm font-bold text-[var(--text)] outline-none transition-[border-color,background-color,box-shadow] duration-300 focus:border-[color:var(--action)] focus:bg-white focus:ring-4 focus:ring-[color:var(--action-soft)]",
        className
      )}
      {...props}
    />
  )
);
Select.displayName = "Select";
