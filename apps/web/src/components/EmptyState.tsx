import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({ title, description, action }: { title: string; description: ReactNode; action?: ReactNode }) {
  return (
    <Card className="border-dashed bg-white/72">
      <CardContent className="flex flex-col items-start gap-4 pt-6">
        <div>
          <h3 className="text-lg font-extrabold text-[var(--text)]">{title}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted)]">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
