import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { FullPageLoading } from "@/components/LoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

export function ProtectedPage({
  children,
  requireLevel = true,
  requireAdmin = false
}: {
  children: ReactNode;
  requireLevel?: boolean;
  requireAdmin?: boolean;
}) {
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });

  useEffect(() => {
    if (me.isError) {
      void navigate({ to: "/login" });
    }
    if (me.data && !me.data.user) {
      void navigate({ to: "/login" });
    }
    if (me.data?.user && requireLevel && !me.data.user.level) {
      void navigate({ to: "/onboarding/level" });
    }
  }, [me.data?.user, me.isError, navigate, requireLevel]);

  if (me.isLoading || me.isError || !me.data?.user || (requireLevel && !me.data.user.level)) {
    return <FullPageLoading />;
  }

  if (requireAdmin && me.data.user.role !== "admin") {
    return (
      <AppShell>
        <Card className="mx-auto max-w-2xl bg-white/82">
          <CardContent className="p-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--action-soft)] text-[var(--action-strong)]">
              <ShieldAlert className="h-6 w-6" />
            </span>
            <h1 className="mt-5 text-3xl font-extrabold text-[var(--text)]">没有管理员权限</h1>
            <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-[var(--muted)]">
              当前账号只能访问学习页面。后台入口只对管理员开放。
            </p>
            <Button className="mt-6" variant="primary" onClick={() => void navigate({ to: "/dashboard" })}>
              返回学习面板
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}
