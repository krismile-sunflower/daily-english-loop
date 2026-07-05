import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[color:var(--hairline)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-extrabold leading-5 text-[var(--accent-light)]",
        className
      )}
      {...props}
    />
  );
}
