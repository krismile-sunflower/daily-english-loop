import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, RotateCcw, Send } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ProtectedPage } from "@/components/ProtectedPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { PageHeader } from "./VocabularyPage";

export function PracticePage() {
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const session = useQuery({ queryKey: ["practice-session"], queryFn: api.practiceSession });
  const submit = useMutation({
    mutationFn: () =>
      api.submitPractice({
        answers: Object.entries(answers).map(([exerciseId, answer]) => ({ exerciseId, answer }))
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });

  const allAnswered = session.data?.exercises.every((exercise) => answers[exercise.id]) ?? false;

  function resetSession() {
    setAnswers({});
    submit.reset();
    void queryClient.invalidateQueries({ queryKey: ["practice-session"] });
  }

  return (
    <ProtectedPage>
      <div className="space-y-6">
        <PageHeader
          eyebrow="综合练习"
          title="5 道题快速检测今天是否学进去。"
          description="练习题从当前等级课程和词汇中抽取，提交后直接更新今日任务进度。"
        />

        {session.isLoading ? (
          <LoadingState label="正在生成练习" />
        ) : session.data?.exercises.length ? (
          <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
            <section className="space-y-4">
              {session.data.exercises.map((exercise, index) => {
                const result = submit.data?.results.find((item) => item.exerciseId === exercise.id);
                return (
                  <Card key={exercise.id} className="bg-white/84">
                    <CardContent className="pt-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Badge>第 {index + 1} 题</Badge>
                        {result ? (
                          <Badge className={result.correct ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                            {result.correct ? "答对了" : "再看看"}
                          </Badge>
                        ) : null}
                      </div>
                      <h2 className="mt-5 text-xl font-extrabold leading-8">{exercise.prompt}</h2>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {exercise.options.map((option) => {
                          const selected = answers[exercise.id] === option;
                          return (
                            <button
                              key={option}
                              className={`rounded-[20px] border px-4 py-4 text-left text-base font-bold transition-[background-color,border-color,color,box-shadow,transform] duration-300 ease-[var(--ease-soft)] hover:-translate-y-0.5 ${
                                selected
                                  ? "border-[color:var(--action)] bg-[var(--action-soft)] text-[var(--text)] shadow-[var(--shadow-soft)]"
                                  : "border-[color:var(--hairline)] bg-[var(--surface-1)] text-[var(--muted)] hover:bg-white hover:text-[var(--text)]"
                              }`}
                              onClick={() => setAnswers((current) => ({ ...current, [exercise.id]: option }))}
                              disabled={submit.isSuccess}
                              type="button"
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                      {result ? <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{result.explanation}</p> : null}
                    </CardContent>
                  </Card>
                );
              })}
            </section>

            <Card className="h-fit bg-white/82">
              <CardContent className="space-y-4 pt-6">
                <Badge>本组练习</Badge>
                <div>
                  <p className="text-5xl font-extrabold">{Object.keys(answers).length} / {session.data.exercises.length}</p>
                  <p className="mt-2 text-sm font-bold text-[var(--muted)]">已作答</p>
                </div>
                {submit.data ? (
                  <div className="rounded-[24px] border border-[color:var(--hairline)] bg-[var(--surface-1)] p-5">
                    <CheckCircle2 className="h-6 w-6 text-[var(--success)]" />
                    <p className="mt-3 text-3xl font-extrabold">
                      {submit.data.score} / {submit.data.total}
                    </p>
                    <p className="mt-1 text-sm font-bold text-[var(--muted)]">本次得分</p>
                  </div>
                ) : null}
                <Button className="w-full" variant="primary" onClick={() => submit.mutate()} disabled={!allAnswered || submit.isPending || submit.isSuccess}>
                  <Send className="h-4 w-4" />
                  提交练习
                </Button>
                <Button className="w-full" variant="secondary" onClick={resetSession}>
                  <RotateCcw className="h-4 w-4" />
                  换一组
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <EmptyState title="当前等级暂无练习" description="可以先去课程页完成一节短课。" />
        )}
      </div>
    </ProtectedPage>
  );
}
