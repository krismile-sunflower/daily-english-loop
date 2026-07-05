import type { EnglishLevel } from "@english-learning/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, LogOut, Palette, Save, ShieldCheck, UserRound } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { LoadingState } from "@/components/LoadingState";
import { ProtectedPage } from "@/components/ProtectedPage";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatLevel } from "@/lib/utils";
import { PageHeader } from "./VocabularyPage";

const levelOptions: Array<{
  value: EnglishLevel;
  label: string;
  description: string;
}> = [
  { value: "A1", label: "入门基础", description: "问候、数字、日常名词" },
  { value: "A2", label: "日常交流", description: "出行、购物、简单表达" },
  { value: "B1", label: "独立表达", description: "观点、经历、短阅读" },
  { value: "B2", label: "深入沟通", description: "复杂文本、讨论与写作" },
  { value: "C1", label: "高阶使用", description: "学术、职场、精细表达" }
];

export function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const [name, setName] = useState("");
  const [level, setLevel] = useState<EnglishLevel>("A1");
  const update = useMutation({
    mutationFn: () => api.updateMe({ name, level }),
    onSuccess: async (data) => {
      queryClient.setQueryData(["me"], data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["vocabulary"] }),
        queryClient.invalidateQueries({ queryKey: ["lessons"] }),
        queryClient.invalidateQueries({ queryKey: ["practice-session"] })
      ]);
    }
  });
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      queryClient.clear();
      await navigate({ to: "/login" });
    }
  });

  useEffect(() => {
    if (me.data?.user) {
      setName(me.data.user.name);
      setLevel((me.data.user.level ?? "A1") as EnglishLevel);
    }
  }, [me.data?.user]);

  function submit(event: FormEvent) {
    event.preventDefault();
    update.mutate();
  }

  return (
    <ProtectedPage>
      <div className="space-y-6">
        <PageHeader
          eyebrow="设置"
          title="管理你的学习空间。"
          description="账号、等级、主题和退出登录都放在这里，减少侧栏里的隐藏操作。"
        />
        {me.isLoading ? (
          <LoadingState />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <Card className="overflow-hidden" style={{ background: "var(--hero-gradient)" }}>
                <CardContent className="relative p-6 sm:p-8">
                  <div className="soft-breathe absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[var(--action-soft)]" />
                  <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[24px] border border-[color:var(--hairline)] bg-white/72 shadow-[var(--shadow-soft)]">
                        <UserRound className="h-7 w-7 text-[var(--action-strong)]" />
                      </span>
                      <div className="min-w-0">
                        <Badge>{formatLevel(me.data?.user?.level)} 学习轨道</Badge>
                        <h2 className="mt-3 text-3xl font-extrabold leading-tight text-[var(--text)]">{me.data?.user?.name ?? "Learner"}</h2>
                        <p className="mt-1 break-all text-sm font-semibold text-[var(--muted)]">{me.data?.user?.email}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 sm:w-56">
                      {["词", "复", "课", "练"].map((label, index) => (
                        <span
                          key={label}
                          className={`grid h-11 place-items-center rounded-full text-xs font-extrabold ${
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
                </CardContent>
              </Card>

              <Card className="bg-white/82">
                <CardHeader>
                  <CardTitle>学习偏好</CardTitle>
                  <CardDescription>切换等级后，新词、课程和练习会按新等级加载；已有复习进度仍保留。</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-5" onSubmit={submit}>
                    <label className="block space-y-2">
                      <span className="text-sm font-extrabold text-[var(--muted)]">昵称</span>
                      <Input value={name} onChange={(event) => setName(event.target.value)} minLength={2} />
                    </label>
                    <fieldset className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <span id="english-level-label" className="text-sm font-extrabold text-[var(--muted)]">
                            英语等级
                          </span>
                          <p className="mt-1 text-sm font-semibold leading-6 text-[var(--muted)]">
                            选择当前学习轨道，保存后会刷新单词、课程和练习推荐。
                          </p>
                        </div>
                        <span className="w-fit rounded-full border border-[color:var(--hairline)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-extrabold text-[var(--accent-light)]">
                          当前 {formatLevel(level)}
                        </span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-5" role="radiogroup" aria-labelledby="english-level-label">
                        {levelOptions.map((item) => {
                          const selected = level === item.value;

                          return (
                            <button
                              key={item.value}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => setLevel(item.value)}
                              className={cn(
                                "group min-h-[128px] rounded-[24px] border p-4 text-left transition-[background-color,border-color,box-shadow,transform] duration-300 ease-[var(--ease-soft)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--action-soft)]",
                                selected
                                  ? "border-[color:rgba(245,134,123,0.42)] bg-[var(--action-soft)] shadow-[0_14px_30px_rgba(245,134,123,0.16)]"
                                  : "border-[color:var(--hairline)] bg-white/62 hover:-translate-y-0.5 hover:border-[color:var(--hairline-strong)] hover:bg-white/82 hover:shadow-[var(--shadow-soft)]"
                              )}
                            >
                              <span className="flex items-start justify-between gap-3">
                                <span>
                                  <span
                                    className={cn(
                                      "block text-2xl font-black leading-none",
                                      selected ? "text-[var(--action-strong)]" : "text-[var(--text)]"
                                    )}
                                  >
                                    {item.value}
                                  </span>
                                  <span className="mt-2 block text-sm font-extrabold text-[var(--text)]">{item.label}</span>
                                </span>
                                <span
                                  className={cn(
                                    "grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors duration-300",
                                    selected
                                      ? "border-[color:var(--action)] bg-[var(--action)] text-[var(--button-on-action)]"
                                      : "border-[color:var(--hairline)] bg-white/70 text-transparent group-hover:text-[var(--muted-2)]"
                                  )}
                                >
                                  <Check className="h-4 w-4" />
                                </span>
                              </span>
                              <span className="mt-4 block text-sm font-semibold leading-6 text-[var(--muted)]">{item.description}</span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button variant="primary" disabled={update.isPending}>
                        <Save className="h-4 w-4" />
                        保存学习设置
                      </Button>
                      {update.isSuccess ? <p className="text-sm font-bold text-[var(--success)]">已保存。</p> : null}
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            <aside className="space-y-5">
              <Card className="bg-white/82">
                <CardHeader>
                  <span className="mb-2 grid h-11 w-11 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-light)]">
                    <Palette className="h-5 w-5" />
                  </span>
                  <CardTitle>界面主题</CardTitle>
                  <CardDescription>日间适合白天学习，夜读降低长时间阅读的亮度。</CardDescription>
                </CardHeader>
                <CardContent>
                  <ThemeToggle />
                </CardContent>
              </Card>

              <Card className="bg-white/82">
                <CardHeader>
                  <span className="mb-2 grid h-11 w-11 place-items-center rounded-full bg-[var(--action-soft)] text-[var(--action-strong)]">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <CardTitle>账号操作</CardTitle>
                  <CardDescription>退出后会回到登录页，本地学习数据和服务器进度不会被删除。</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="danger" onClick={() => logout.mutate()} disabled={logout.isPending}>
                    <LogOut className="h-4 w-4" />
                    退出登录
                  </Button>
                </CardContent>
              </Card>
            </aside>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
