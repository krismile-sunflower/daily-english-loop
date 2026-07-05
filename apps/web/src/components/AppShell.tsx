import { Link } from "@tanstack/react-router";
import {
  BookOpenText,
  Dumbbell,
  GraduationCap,
  Leaf,
  LayoutDashboard,
  Library,
  Repeat2,
  Settings,
  ShieldCheck,
  Sunrise
} from "lucide-react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatLevel } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "面板", icon: LayoutDashboard },
  { to: "/vocabulary", label: "单词", icon: BookOpenText },
  { to: "/review", label: "复习", icon: Repeat2 },
  { to: "/lessons", label: "课程", icon: Library },
  { to: "/practice", label: "练习", icon: Dumbbell },
  { to: "/settings", label: "设置", icon: Settings }
] as const;

const adminNavItem = { to: "/admin", label: "管理", icon: ShieldCheck } as const;

export function AppShell({ children }: { children: ReactNode }) {
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const visibleNavItems = me.data?.user?.role === "admin" ? [adminNavItem, ...navItems] : navItems;

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[var(--ground)] text-[var(--text)] lg:h-dvh lg:overflow-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="soft-breathe absolute -left-24 top-24 h-72 w-72 rounded-full bg-[var(--page-glow-action)] blur-3xl" />
        <div className="absolute right-[-12rem] top-[-10rem] h-96 w-96 rounded-full bg-[var(--page-glow-accent)] blur-3xl" />
      </div>
      <div className="relative mx-auto grid min-h-dvh w-full max-w-[1500px] grid-cols-1 lg:h-dvh lg:grid-cols-[288px_1fr]">
        <aside className="border-b border-[color:var(--hairline)] bg-[var(--shell-panel)] backdrop-blur-xl lg:h-dvh lg:overflow-y-auto lg:overscroll-contain lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col gap-6 p-4 lg:p-6">
            <Link to="/dashboard" className="flex items-center gap-3 rounded-[24px] px-1 py-2">
              <span className="grid h-12 w-12 place-items-center rounded-[20px] border border-[color:var(--hairline)] bg-white shadow-[var(--shadow-soft)]">
                <GraduationCap className="h-6 w-6 text-[var(--action)]" />
              </span>
              <span>
                <span className="block text-base font-extrabold leading-5">Daily English</span>
                <span className="block text-xs font-bold text-[var(--muted)]">轻量学习闭环</span>
              </span>
            </Link>

            <nav className="grid grid-cols-3 gap-2 lg:grid-cols-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-extrabold text-[var(--muted)] transition-[background-color,color,box-shadow,transform] duration-300 ease-[var(--ease-soft)] hover:-translate-y-0.5 hover:bg-white/70 hover:text-[var(--text)] hover:shadow-[0_10px_24px_rgba(91,71,46,0.08)] lg:justify-start"
                    activeProps={{
                      className: "bg-white text-[var(--text)] border border-[color:var(--hairline)] shadow-[var(--shadow-soft)]"
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center justify-between gap-3 rounded-[24px] border border-[color:var(--hairline)] bg-[var(--surface-1)] p-2 pl-4">
              <span className="text-xs font-extrabold text-[var(--muted)]">界面主题</span>
              <ThemeToggle compact />
            </div>

            <div className="mt-auto hidden overflow-hidden rounded-[28px] border border-[color:var(--hairline)] bg-white/76 p-5 shadow-[var(--shadow-soft)] lg:block">
              <div className="flex items-center justify-between">
                <Badge>{me.data?.user?.role === "admin" ? "管理员" : formatLevel(me.data?.user?.level)}</Badge>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent-soft)]">
                  <Leaf className="h-5 w-5 text-[var(--accent-light)]" />
                </span>
              </div>
              <p className="mt-5 text-lg font-extrabold text-[var(--text)]">{me.data?.user?.name ?? "Learner"}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">每天沿着四步走：新词、复习、短课、练习。</p>
              <div className="mt-5 grid grid-cols-4 gap-2">
                {["词", "复", "课", "练"].map((label, index) => (
                  <span
                    key={label}
                    className={`grid h-10 place-items-center rounded-full text-xs font-extrabold ${
                      index === 0
                        ? "bg-[var(--action-soft)] text-[var(--action-strong)]"
                        : "bg-[var(--accent-soft)] text-[var(--accent-light)]"
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0 overflow-x-hidden px-4 py-5 pb-10 sm:px-6 lg:h-dvh lg:overflow-y-auto lg:overscroll-contain lg:px-8 lg:py-8 lg:pb-12">
          <div className="mb-5 hidden items-center gap-2 text-sm font-bold text-[var(--muted)] lg:flex">
            <Sunrise className="h-4 w-4 text-[var(--action)]" />
            今天只需要完成一个小循环
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
