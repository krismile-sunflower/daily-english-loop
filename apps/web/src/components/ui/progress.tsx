import { cn } from "@/lib/utils";

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-3 overflow-hidden rounded-full bg-[var(--progress-track)]", className)}>
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--action))] transition-[width] duration-500 ease-[var(--ease-soft)]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
