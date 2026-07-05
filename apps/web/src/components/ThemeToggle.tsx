import { Moon, SunMedium } from "lucide-react";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

const options: Array<{ value: ThemeMode; label: string; icon: typeof SunMedium }> = [
  { value: "day", label: "日间", icon: SunMedium },
  { value: "night", label: "夜读", icon: Moon }
];

export function ThemeToggle({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-[color:var(--hairline)] bg-[var(--theme-toggle-bg)] p-1 shadow-[var(--shadow-soft)] backdrop-blur",
        className
      )}
      role="group"
      aria-label="切换主题"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = option.value === theme;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            className={cn(
              "inline-flex h-9 min-w-9 items-center justify-center gap-2 rounded-full px-3 text-xs font-extrabold text-[var(--muted)] transition-[background-color,color,box-shadow,transform] duration-300 ease-[var(--ease-soft)] hover:-translate-y-0.5 hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--action-soft)]",
              active && "bg-[var(--theme-toggle-active)] text-[var(--text)] shadow-[var(--shadow-soft)]",
              compact && "px-2"
            )}
            onClick={() => setTheme(option.value)}
          >
            <Icon className="h-4 w-4" />
            {compact ? <span className="sr-only">{option.label}</span> : <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
