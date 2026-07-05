import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Headphones, Play } from "lucide-react";
import { LoadingState } from "@/components/LoadingState";
import { ProtectedPage } from "@/components/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatCourseType, formatExerciseType } from "@/lib/utils";

export function LessonDetailPage({ lessonId }: { lessonId: string }) {
  const queryClient = useQueryClient();
  const lesson = useQuery({ queryKey: ["lesson", lessonId], queryFn: () => api.lesson(lessonId) });
  const complete = useMutation({
    mutationFn: () => api.completeLesson(lessonId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] }),
        queryClient.invalidateQueries({ queryKey: ["lessons"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      ]);
    }
  });

  function playAudioText() {
    const text = lesson.data?.audioText;
    if (!text || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  return (
    <ProtectedPage>
      <div className="space-y-6">
        <Button asChild variant="ghost">
          <Link to="/lessons">
            <ArrowLeft className="h-4 w-4" />
            返回课程
          </Link>
        </Button>

        {lesson.isLoading ? (
          <LoadingState label="正在加载课程详情" />
        ) : lesson.data ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <Card className="bg-white/84">
              <CardContent className="p-6 sm:p-8 lg:p-10">
                <div className="flex flex-wrap gap-2">
                  <Badge>{formatCourseType(lesson.data.type)}</Badge>
                  <Badge>{lesson.data.level}</Badge>
                  <Badge>{lesson.data.estimatedMinutes} 分钟</Badge>
                  {lesson.data.completed ? <Badge className="text-[var(--success)]">已完成</Badge> : null}
                </div>
                <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-normal sm:text-6xl">
                  {lesson.data.title}
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">{lesson.data.description}</p>

                {lesson.data.type === "listening" ? (
                  <div className="mt-6 rounded-[24px] border border-[color:var(--hairline)] bg-[var(--surface-1)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm font-extrabold">
                        <Headphones className="h-4 w-4 text-[var(--action-strong)]" />
                        听力文本播放
                      </span>
                      <Button onClick={playAudioText} disabled={!lesson.data.audioText}>
                        <Play className="h-4 w-4" />
                        播放
                      </Button>
                    </div>
                  </div>
                ) : null}

                <article className="mt-8 whitespace-pre-wrap rounded-[28px] bg-[var(--surface-1)] p-6 text-xl leading-10 text-[var(--text)]">
                  {lesson.data.content}
                </article>

                <Button
                  className="mt-8"
                  variant={lesson.data.completed ? "success" : "primary"}
                  onClick={() => complete.mutate()}
                  disabled={complete.isPending || lesson.data.completed}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {lesson.data.completed ? "已完成" : "标记完成"}
                </Button>
              </CardContent>
            </Card>

            <Card className="h-fit bg-white/82">
              <CardHeader>
                <CardTitle>本课练习</CardTitle>
                <CardDescription>完成课程后可以去综合练习巩固。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {lesson.data.exercises.map((exercise) => (
                  <div key={exercise.id} className="rounded-[20px] border border-[color:var(--hairline)] bg-[var(--surface-1)] p-4">
                    <p className="text-sm font-bold leading-6 text-[var(--text)]">{exercise.prompt}</p>
                    <p className="mt-2 text-xs font-extrabold text-[var(--muted)]">{formatExerciseType(exercise.type)}</p>
                  </div>
                ))}
                <Button asChild className="w-full" variant="secondary">
                  <Link to="/practice">进入综合练习</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </ProtectedPage>
  );
}
