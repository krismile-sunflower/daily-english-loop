import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpenText, Clock3, Flame, Library, Repeat2 } from "lucide-react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { clampPercent, formatLevel } from "@/lib/utils";

export function DashboardPage() {
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });

  return (
    <ProtectedPage>
      {dashboard.isLoading ? (
        <LoadingState label="正在读取今日进度" />
      ) : dashboard.isError ? (
        <EmptyState
          title="学习面板暂时没有加载出来"
          description="登录状态或进度接口可能刚刚更新。刷新后会重新读取今日任务、单词和周进度。"
          action={
            <Button variant="primary" onClick={() => void dashboard.refetch()}>
              重新加载面板
            </Button>
          }
        />
      ) : dashboard.data ? (
        <div className="space-y-8">
          <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
            <Card className="overflow-hidden" style={{ background: "var(--hero-gradient)" }}>
              <CardContent className="relative p-6 sm:p-8 lg:p-10">
                <div className="soft-breathe absolute -right-14 -top-14 h-44 w-44 rounded-full bg-[var(--action-soft)]" />
                <div className="absolute bottom-8 right-8 hidden h-24 w-24 rounded-full bg-[var(--accent-soft)] lg:block" />
                <Badge>{formatLevel(dashboard.data.user.level)} 学习轨道</Badge>
                <h1 className="relative mt-5 max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-normal text-[var(--text)] sm:text-6xl">
                  今天只完成一个温和的小循环。
                </h1>
                <p className="relative mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
                  新词负责输入，复习负责留存，课程提供语境，练习把知识转成可用能力。
                </p>
                <div className="relative mt-8 flex flex-wrap gap-3">
                  <Button asChild variant="primary" size="lg">
                    <Link to="/vocabulary">
                      开始今日任务
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="lg">
                    <Link to="/review">
                      到期复习 {dashboard.data.reviewDueCount}
                      <Repeat2 className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/82">
              <CardHeader>
                <CardTitle>今天的状态</CardTitle>
                <CardDescription>少看数字，多看下一步。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Metric icon={<Flame className="h-4 w-4" />} label="连续学习" value={`${dashboard.data.streakDays} 天`} />
                <Metric icon={<Clock3 className="h-4 w-4" />} label="今日时长" value={`${dashboard.data.today.minutesStudied} 分钟`} />
                <Metric icon={<BookOpenText className="h-4 w-4" />} label="可学新词" value={`${dashboard.data.newWordsAvailable} 个`} />
                <Metric icon={<Library className="h-4 w-4" />} label="已完成课程" value={`${dashboard.data.lessonsCompleted} 节`} />
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {dashboard.data.tasks.map((task, index) => (
              <Card
                key={task.id}
                className="group bg-white/80 transition-[box-shadow,transform,border-color] duration-300 ease-[var(--ease-soft)] hover:-translate-y-1 hover:border-[color:var(--hairline-strong)] hover:shadow-[var(--shadow-lift)]"
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="mb-4 grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-1)] text-sm font-extrabold text-[var(--action-strong)] shadow-[var(--shadow-soft)]">
                        {index + 1}
                      </span>
                      <p className="text-base font-extrabold text-[var(--text)]">{task.label}</p>
                      <p className="mt-1 text-xs font-extrabold text-[var(--muted)]">
                        {task.value} / {task.goal}
                      </p>
                    </div>
                    <Badge>{clampPercent(task.value, task.goal)}%</Badge>
                  </div>
                  <Progress className="mt-5" value={clampPercent(task.value, task.goal)} />
                  <Button asChild className="mt-5 w-full" variant={index === 0 ? "secondary" : "ghost"}>
                    <Link to={task.href}>
                      进入
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </section>

          <Card className="bg-white/80">
            <CardHeader>
              <CardTitle>最近 7 天学习节奏</CardTitle>
              <CardDescription>按学习分钟数显示，帮助你判断节奏是否稳定。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2 sm:gap-3">
                {dashboard.data.weekly.map((day) => {
                  const maxMinutes = Math.max(...dashboard.data.weekly.map((item) => item.minutesStudied), 20);
                  const height = Math.max(12, Math.round((day.minutesStudied / maxMinutes) * 120));
                  return (
                    <div key={day.date} className="flex flex-col items-center gap-2">
                      <div className="flex h-32 w-full items-end rounded-[22px] border border-[color:var(--hairline)] bg-[var(--surface-1)] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                        <div
                          className="w-full rounded-[18px] bg-[linear-gradient(180deg,var(--action),var(--accent))] shadow-[0_8px_18px_rgba(143,174,111,0.18)]"
                          style={{ height }}
                        />
                      </div>
                      <span className="text-[11px] font-extrabold text-[var(--muted)]">{day.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState
          title="学习面板还没有数据"
          description="这通常发生在本地服务刚启动或数据还没完成初始化时。可以先进入单词库开始今天的新词。"
          action={
            <Button asChild variant="primary">
              <Link to="/vocabulary">打开单词库</Link>
            </Button>
          }
        />
      )}
    </ProtectedPage>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-[20px] border border-[color:var(--hairline)] bg-[var(--surface-1)] px-4 py-3">
      <span className="flex items-center gap-3 text-sm font-bold text-[var(--muted)]">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-[var(--accent-light)] shadow-[var(--shadow-soft)]">
          {icon}
        </span>
        {label}
      </span>
      <span className="text-sm font-extrabold text-[var(--text)]">{value}</span>
    </div>
  );
}
