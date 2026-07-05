import type { ReviewGrade } from "@english-learning/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Eye, RotateCcw, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ProtectedPage } from "@/components/ProtectedPage";
import { PronunciationButton } from "@/components/PronunciationButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { PageHeader } from "./VocabularyPage";

export function ReviewPage() {
  const [revealed, setRevealed] = useState(false);
  const queryClient = useQueryClient();
  const due = useQuery({ queryKey: ["review-due"], queryFn: api.reviewDue });
  const vocabulary = useQuery({ queryKey: ["vocabulary", "review-summary"], queryFn: () => api.vocabulary() });
  const current = due.data?.items[0];
  const remaining = due.data?.items.length ?? 0;
  const reviewQueueCount = vocabulary.data?.items.filter((item) => item.progress).length ?? 0;
  const review = useMutation({
    mutationFn: ({ id, grade }: { id: string; grade: ReviewGrade }) => api.reviewVocabulary(id, grade),
    onSuccess: async () => {
      setRevealed(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["review-due"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["vocabulary"] })
      ]);
    }
  });

  const nextDueLabel = useMemo(() => {
    const dueAt = current?.progress?.dueAt;
    return dueAt ? new Date(dueAt).toLocaleString() : "现在";
  }, [current?.progress?.dueAt]);

  return (
    <ProtectedPage>
      <div className="space-y-6">
        <PageHeader
          eyebrow="间隔复习"
          title="只复习已经到期的单词。"
          description="先回忆，再看答案。选择越准确，后续间隔越稳定。"
        />
        {due.isLoading ? (
          <LoadingState label="正在检查到期单词" />
        ) : current ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_320px]">
            <Card className="overflow-hidden" style={{ background: "var(--review-gradient)" }}>
              <CardContent className="relative p-6 sm:p-8 lg:p-10">
                <div className="soft-breathe absolute left-8 top-24 h-28 w-28 rounded-full bg-[var(--accent-soft)]" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge>剩余 {remaining}</Badge>
                  <Badge>到期 {nextDueLabel}</Badge>
                </div>
                <div className="relative mt-12 text-center">
                  <p className="text-sm font-extrabold text-[var(--muted)]">{current.topic}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    <h2 className="max-w-full break-words text-6xl font-extrabold tracking-normal sm:text-8xl">{current.word}</h2>
                    <PronunciationButton vocabularyItemId={current.id} word={current.word} size="lg" />
                  </div>
                  <p className="mt-4 text-lg font-bold text-[var(--muted)]">{current.phonetic}</p>
                </div>

                {revealed ? (
                  <div className="mx-auto mt-10 max-w-2xl rounded-[28px] border border-[color:var(--hairline)] bg-white/82 p-6 shadow-[var(--shadow-soft)]">
                    <p className="text-2xl font-extrabold text-[var(--action-strong)]">{current.meaningZh}</p>
                    <p className="mt-3 text-base leading-7 text-[var(--muted)]">{current.definitionEn}</p>
                    <p className="mt-5 rounded-[20px] bg-[var(--surface-1)] p-4 text-base leading-7 text-[var(--text)]">{current.exampleEn}</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted)]">{current.exampleZh}</p>
                  </div>
                ) : null}

                <div className="relative mt-8 flex flex-wrap justify-center gap-2">
                  {!revealed ? (
                    <Button variant="primary" size="lg" onClick={() => setRevealed(true)}>
                      <Eye className="h-4 w-4" />
                      查看答案
                    </Button>
                  ) : (
                    <>
                      <Button variant="danger" onClick={() => review.mutate({ id: current.id, grade: "again" })} disabled={review.isPending}>
                        <RotateCcw className="h-4 w-4" />
                        再来一遍
                      </Button>
                      <Button variant="secondary" onClick={() => review.mutate({ id: current.id, grade: "hard" })} disabled={review.isPending}>
                        有点难
                      </Button>
                      <Button variant="success" onClick={() => review.mutate({ id: current.id, grade: "good" })} disabled={review.isPending}>
                        <Check className="h-4 w-4" />
                        记住了
                      </Button>
                      <Button variant="primary" onClick={() => review.mutate({ id: current.id, grade: "easy" })} disabled={review.isPending}>
                        <Zap className="h-4 w-4" />
                        很轻松
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="h-fit bg-white/82">
              <CardContent className="space-y-4 pt-6">
                <Badge>复习规则</Badge>
                <p className="text-base leading-7 text-[var(--muted)]">
                  系统按遗忘曲线调整下次出现时间：再来一遍约 10 分钟后出现；记住了会从 1 天、3 天开始逐步拉长；很轻松会更快延长间隔。
                </p>
                <div className="grid gap-2">
                  {["先回忆", "再看答案", "最后选档"].map((item, index) => (
                    <div key={item} className="flex items-center gap-3 rounded-full bg-[var(--surface-1)] px-4 py-3 text-sm font-extrabold text-[var(--text)]">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-[var(--action-strong)] shadow-[var(--shadow-soft)]">
                        {index + 1}
                      </span>
                      {item}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        ) : (
          <EmptyState
            title="现在没有到期复习"
            description={
              reviewQueueCount > 0
                ? `你的复习队列里已有 ${reviewQueueCount} 个单词，只是现在还没到下次复习时间。`
                : "可以去学习几个新词，系统会自动安排下一次复习。"
            }
            action={
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="primary">
                  <Link to="/vocabulary">打开单词库</Link>
                </Button>
                {reviewQueueCount > 0 ? <Badge>复习队列 {reviewQueueCount}</Badge> : null}
              </div>
            }
          />
        )}
      </div>
    </ProtectedPage>
  );
}
