import type { EnglishLevel } from "@english-learning/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

const levels: Array<{ level: EnglishLevel; title: string; detail: string }> = [
  { level: "A1", title: "能读懂最基础句子", detail: "适合从日常词汇和 be 动词开始。" },
  { level: "A2", title: "能完成简单交流", detail: "适合建立稳定阅读、听力和练习习惯。" },
  { level: "B1", title: "能理解常见话题", detail: "适合练习语境猜词、段落理解和表达准确性。" },
  { level: "B2", title: "能处理复杂材料", detail: "第一版会先用 B1 内容过渡。" },
  { level: "C1", title: "能进行高阶表达", detail: "第一版会先用 B1 内容过渡。" }
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (level: EnglishLevel) => api.updateMe({ level }),
    onSuccess: async (data) => {
      queryClient.setQueryData(["me"], data);
      await navigate({ to: "/dashboard" });
    }
  });

  return (
    <ProtectedPage requireLevel={false}>
      <div className="mx-auto max-w-6xl">
        <Badge>英语水平</Badge>
        <h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-tight tracking-normal text-[var(--text)] sm:text-6xl">
          先锁定水平，系统会给你今天最合适的一组任务。
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
          第一版以 A1、A2、B1 内容为主。B2/C1 可以先进入高阶轨道，后续再扩展高级课程与写作批改。
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {levels.map((item) => (
            <Card key={item.level} className="group bg-white/82 transition-[box-shadow,transform,border-color] duration-300 ease-[var(--ease-soft)] hover:-translate-y-1 hover:border-[color:var(--action)] hover:shadow-[var(--shadow-lift)]">
              <CardContent className="flex h-full flex-col gap-4 pt-6">
                <Badge className="w-fit">{item.level}</Badge>
                <div>
                  <h2 className="text-lg font-extrabold">{item.title}</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted)]">{item.detail}</p>
                </div>
                <Button className="mt-auto" variant="secondary" onClick={() => mutation.mutate(item.level)} disabled={mutation.isPending}>
                  选择 {item.level}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </ProtectedPage>
  );
}
