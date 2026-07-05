import { LoaderCircle } from "lucide-react";

export function LoadingState({ label = "加载中" }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center text-sm font-bold text-[var(--muted)]">
      <LoaderCircle className="mr-2 h-5 w-5 animate-spin text-[var(--action)]" />
      {label}
    </div>
  );
}

export function FullPageLoading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--ground)] text-[var(--text)]">
      <LoadingState label="正在进入学习面板" />
    </main>
  );
}
