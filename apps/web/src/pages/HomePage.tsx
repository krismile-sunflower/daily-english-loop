import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { FullPageLoading } from "@/components/LoadingState";
import { api } from "@/lib/api";

export function HomePage() {
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });

  useEffect(() => {
    if (me.isError) {
      void navigate({ to: "/login" });
    }
    if (me.data && !me.data.user) {
      void navigate({ to: "/login" });
    }
    if (me.data?.user) {
      void navigate({ to: me.data.user.level ? "/dashboard" : "/onboarding/level" });
    }
  }, [me.data?.user, me.isError, navigate]);

  return <FullPageLoading />;
}
