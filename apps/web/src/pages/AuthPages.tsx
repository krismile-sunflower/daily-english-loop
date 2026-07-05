import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BookOpenText, CheckCircle2, GraduationCap, Repeat2, Sprout } from "lucide-react";
import { FormEvent, type ReactNode, useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";

function AuthFrame({ children, title, description }: { children: ReactNode; title: string; description: string }) {
  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[var(--ground)] px-4 py-8 text-[var(--text)] sm:py-12">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="pointer-events-none fixed inset-0">
        <div className="soft-breathe absolute left-[8%] top-[14%] h-72 w-72 rounded-full bg-[var(--auth-glow-action)] blur-3xl" />
        <div className="absolute bottom-[-12rem] right-[-8rem] h-96 w-96 rounded-full bg-[var(--auth-glow-accent)] blur-3xl" />
      </div>
      <section className="relative mx-auto grid min-h-[calc(100dvh-4rem)] min-w-0 w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden lg:block">
          <div className="mb-8 flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-[20px] border border-[color:var(--hairline)] bg-white shadow-[var(--shadow-soft)]">
              <GraduationCap className="h-6 w-6 text-[var(--action)]" />
            </span>
            <div>
              <p className="text-base font-extrabold">Daily English</p>
              <p className="text-sm font-bold text-[var(--muted)]">把学习变成一天里的小循环</p>
            </div>
          </div>
          <p className="mb-4 w-fit rounded-full bg-white/70 px-4 py-2 text-sm font-extrabold text-[var(--accent-light)] shadow-[var(--shadow-soft)]">
            今日学习闭环
          </p>
          <h1 className="max-w-2xl text-5xl font-extrabold leading-[0.98] tracking-normal text-[var(--text)] sm:text-6xl">
            学一点，记一点，再用一点。
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">
            每天只安排四件事：新词、复习、短课和练习。界面应该让你愿意回来，而不是像打开一个后台。
          </p>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            <LoopItem icon={<BookOpenText className="h-5 w-5" />} title="10 个新词" detail="先输入，不贪多" />
            <LoopItem icon={<Repeat2 className="h-5 w-5" />} title="到期复习" detail="把记忆接回来" />
            <LoopItem icon={<Sprout className="h-5 w-5" />} title="1 节短课" detail="用语境理解" />
            <LoopItem icon={<CheckCircle2 className="h-5 w-5" />} title="5 道练习" detail="确认学会了" />
          </div>
        </div>

        <div className="min-w-0">
          <div className="mx-auto mb-4 flex w-full max-w-md items-center gap-3 lg:hidden">
            <span className="grid h-12 w-12 place-items-center rounded-[20px] border border-[color:var(--hairline)] bg-white shadow-[var(--shadow-soft)]">
              <GraduationCap className="h-6 w-6 text-[var(--action)]" />
            </span>
            <div>
              <p className="text-base font-extrabold">Daily English</p>
              <p className="text-sm font-bold text-[var(--muted)]">今天从一个小循环开始</p>
            </div>
          </div>
          <div className="mx-auto min-w-0 w-full max-w-md rounded-[32px] border border-[color:var(--hairline)] bg-white/78 p-3 shadow-[var(--shadow-lift)] backdrop-blur">
            <div className="rounded-[28px] bg-[var(--surface-1)] p-5 sm:p-6">
              <div className="mb-6 flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--action-soft)]">
                  <GraduationCap className="h-5 w-5 text-[var(--action-strong)]" />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-[var(--text)]">欢迎回来</p>
                  <p className="text-xs font-bold text-[var(--muted)]">今天从一个小任务开始</p>
                </div>
              </div>
              <h2 className="text-3xl font-extrabold text-[var(--text)]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
              <div className="mt-5 grid grid-cols-4 gap-2 lg:hidden">
                {["新词", "复习", "短课", "练习"].map((item, index) => (
                  <span
                    key={item}
                    className={`grid h-10 place-items-center rounded-full text-xs font-extrabold ${
                      index === 0
                        ? "bg-[var(--action-soft)] text-[var(--action-strong)]"
                        : "bg-[var(--accent-soft)] text-[var(--accent-light)]"
                    }`}
                  >
                    {item}
                  </span>
                ))}
              </div>
              <div className="mt-6">{children}</div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function LoopItem({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="rounded-[24px] border border-[color:var(--hairline)] bg-white/64 p-4 shadow-[var(--shadow-soft)]">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-light)]">
        {icon}
      </div>
      <p className="font-extrabold text-[var(--text)]">{title}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--muted)]">{detail}</p>
    </div>
  );
}

export function LoginPage() {
  const [email, setEmail] = useState("learner@example.com");
  const [password, setPassword] = useState("password123");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: api.login,
    onSuccess: async (data) => {
      queryClient.setQueryData(["me"], data);
      await navigate({ to: data.user.level ? "/dashboard" : "/onboarding/level" });
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({ email, password });
  }

  const error = mutation.error instanceof ApiClientError ? mutation.error.message : null;

  return (
    <AuthFrame title="登录继续学习" description="回到今天的单词、复习、课程和练习。">
      <form className="space-y-5" onSubmit={submit}>
        <label className="block space-y-2">
          <span className="text-sm font-extrabold text-[var(--muted)]">邮箱</span>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-extrabold text-[var(--muted)]">密码</span>
          <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
        </label>
        {error ? <p className="text-sm font-bold text-[var(--danger)]">{error}</p> : null}
        <Button className="w-full" variant="primary" size="lg" disabled={mutation.isPending}>
          进入学习面板
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-center text-sm font-semibold text-[var(--muted)]">
          还没有账号？{" "}
          <Link className="text-[var(--action-strong)] hover:text-[var(--text)]" to="/register">
            注册
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const [name, setName] = useState("Learner");
  const [email, setEmail] = useState("learner@example.com");
  const [password, setPassword] = useState("password123");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: api.register,
    onSuccess: async (data) => {
      queryClient.setQueryData(["me"], data);
      await navigate({ to: "/onboarding/level" });
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({ name, email, password });
  }

  const error = mutation.error instanceof ApiClientError ? mutation.error.message : null;

  return (
    <AuthFrame title="创建学习账号" description="先选择英语水平，然后进入第一天的学习闭环。">
      <form className="space-y-5" onSubmit={submit}>
        <label className="block space-y-2">
          <span className="text-sm font-extrabold text-[var(--muted)]">昵称</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} minLength={2} required />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-extrabold text-[var(--muted)]">邮箱</span>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-extrabold text-[var(--muted)]">密码</span>
          <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={8} required />
        </label>
        {error ? <p className="text-sm font-bold text-[var(--danger)]">{error}</p> : null}
        <Button className="w-full" variant="primary" size="lg" disabled={mutation.isPending}>
          注册并选择水平
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-center text-sm font-semibold text-[var(--muted)]">
          已有账号？{" "}
          <Link className="text-[var(--action-strong)] hover:text-[var(--text)]" to="/login">
            登录
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}
