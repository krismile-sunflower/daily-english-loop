import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { FullPageLoading } from "@/components/LoadingState";
import { api } from "@/lib/api";

export function ProtectedPage({ children, requireLevel = true }: { children: ReactNode; requireLevel?: boolean }) {
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

  return <AppShell>{children}</AppShell>;
}
