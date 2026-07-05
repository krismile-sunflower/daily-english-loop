import type { ReviewGrade, VocabularyItem } from "@english-learning/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Clock3, Library, RotateCcw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ProtectedPage } from "@/components/ProtectedPage";
import { PronunciationButton } from "@/components/PronunciationButton";
import { StudyExampleModal } from "@/components/StudyExampleModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";

const levels = ["", "A1", "A2", "B1", "B2", "C1"] as const;
const statusFilters = [
  { value: "all", label: "全部状态" },
  { value: "new", label: "未学" },
  { value: "learning", label: "复习中" },
  { value: "learned", label: "已掌握" }
] as const;

type StatusFilter = (typeof statusFilters)[number]["value"];

export function VocabularyPage() {
  const queryClient = useQueryClient();
  const [level, setLevel] = useState<(typeof levels)[number]>("");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pendingReviewedWord, setPendingReviewedWord] = useState<{ item: VocabularyItem; grade: ReviewGrade } | null>(
    null
  );
  const pageSize = 50;
  const vocabulary = useQuery({
    queryKey: ["vocabulary", { level: level || "current", query, topic, status, page, pageSize }],
    queryFn: () =>
      api.vocabulary({
        level: level || undefined,
        q: query.trim() || undefined,
        topic,
        status,
        page,
        pageSize
      })
  });
  const newVocabulary = useQuery({
    queryKey: ["vocabulary", "new-task", level || "current", "daily-shuffle"],
    queryFn: () =>
      api.vocabulary({
        level: level || undefined,
        status: "new",
        shuffle: "daily",
        page: 1,
        pageSize: 10
      })
  });
  const review = useMutation({
    mutationFn: ({ item, grade }: { item: VocabularyItem; grade: ReviewGrade }) => api.reviewVocabulary(item.id, grade),
    onSuccess: (_response, variables) => {
      setPendingReviewedWord({ item: variables.item, grade: variables.grade });
    }
  });

  const items = vocabulary.data?.items ?? [];
  const newItems = newVocabulary.data?.items ?? [];
  const topics = vocabulary.data?.topics ?? [];
  const total = vocabulary.data?.total ?? 0;
  const totalPages = vocabulary.data?.totalPages ?? 1;

  useEffect(() => {
    setPage(1);
  }, [level, query, topic, status]);

  function closeStudyExampleModal() {
    setPendingReviewedWord(null);
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["vocabulary"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["review-due"] })
    ]);
  }

  return (
    <ProtectedPage>
      <div className="space-y-6">
        <PageHeader
          eyebrow="单词学习"
          title="先学新词，再把它们送进复习队列。"
          description="第一版把“学习”定义为一次主动判断：认识、模糊、不认识。系统会根据你的选择安排下次复习。"
        />

        {vocabulary.isLoading || newVocabulary.isLoading ? (
          <LoadingState label="正在加载单词" />
        ) : vocabulary.data ? (
          <div className="space-y-6">
            <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
              <div className="grid gap-4">
                {newItems.length === 0 ? (
                  <EmptyState
                    title="当前等级的新词已学完"
                    description="下面的单词库仍会显示已学词和复习状态；也可以切换等级继续学习。"
                    action={
                      <Button variant="secondary" onClick={() => setStatus("all")}>
                        查看完整词库
                      </Button>
                    }
                  />
                ) : (
                  newItems.slice(0, 10).map((item) => (
                    <VocabularyCard
                      key={item.id}
                      item={item}
                      busy={review.isPending}
                      onReview={(grade) => review.mutate({ item, grade })}
                    />
                  ))
                )}
              </div>
              <Card className="h-fit bg-white/82">
                <CardHeader>
                  <CardTitle>今日新词目标</CardTitle>
                  <CardDescription>建议每天只学 10 个，给复习留出容量。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Stat label="当前筛选" value={total} />
                  <Stat label="本页显示" value={items.length} />
                  <Stat label="今日新词" value={newItems.length} />
                  <Stat label="每页上限" value={pageSize} />
                </CardContent>
              </Card>
            </section>

            <section className="rounded-[32px] border border-[color:var(--hairline)] bg-white/62 p-4 shadow-[var(--shadow-soft)] sm:p-5">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                <div>
                  <Badge>单词库</Badge>
                  <h2 className="mt-3 text-2xl font-extrabold text-[var(--text)] sm:text-3xl">浏览当前等级的全部单词。</h2>
                  <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--muted)]">
                    新词、复习中、已掌握都会保留在这里，方便按主题和状态回看。
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:w-[520px]">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                    <Input
                      className="pl-10"
                      placeholder="搜索英文、中文或释义"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                  <Select
                    value={level}
                    onChange={(event) => {
                      setLevel(event.target.value as (typeof levels)[number]);
                      setTopic("all");
                    }}
                  >
                    <option value="">当前等级</option>
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="C1">C1</option>
                  </Select>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
                <Select value={topic} onChange={(event) => setTopic(event.target.value)}>
                  <option value="all">全部主题</option>
                  {topics.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
                <Select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
                  {statusFilters.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
                <div className="flex items-center rounded-full bg-[var(--surface-1)] px-4 py-3 text-sm font-extrabold text-[var(--muted)]">
                  <Library className="mr-2 h-4 w-4 text-[var(--accent-light)]" />
                  第 {page} / {totalPages} 页，共 {total} 个
                </div>
              </div>

              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {items.length ? (
                  items.map((item) => <LibraryWordCard key={item.id} item={item} />)
                ) : (
                  <EmptyState title="没有匹配的单词" description="换一个搜索词，或把主题和状态筛选切回全部。" />
                )}
              </div>
              <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-[24px] border border-[color:var(--hairline)] bg-[var(--surface-1)] p-3 sm:flex-row">
                <p className="text-sm font-extrabold text-[var(--muted)]">
                  正在显示第 {page} 页，每页 {pageSize} 个词
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    <ArrowLeft className="h-4 w-4" />
                    上一页
                  </Button>
                  <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                    下一页
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </section>
          </div>
        ) : null}
        <StudyExampleModal
          open={Boolean(pendingReviewedWord)}
          item={pendingReviewedWord?.item ?? null}
          grade={pendingReviewedWord?.grade ?? null}
          onClose={closeStudyExampleModal}
        />
      </div>
    </ProtectedPage>
  );
}

function VocabularyCard({
  item,
  busy,
  onReview
}: {
  item: VocabularyItem;
  busy: boolean;
  onReview: (grade: ReviewGrade) => void;
}) {
  return (
    <Card className="bg-white/84 transition-[box-shadow,transform,border-color] duration-300 ease-[var(--ease-soft)] hover:-translate-y-1 hover:border-[color:var(--hairline-strong)] hover:shadow-[var(--shadow-lift)]">
      <CardContent className="grid gap-6 pt-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-4xl font-extrabold tracking-normal text-[var(--text)]">{item.word}</h2>
            <PronunciationButton vocabularyItemId={item.id} word={item.word} prefetch />
            <Badge>{item.phonetic}</Badge>
            <Badge>{item.topic}</Badge>
          </div>
          <p className="mt-3 text-xl font-extrabold text-[var(--action-strong)]">{item.meaningZh}</p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">{item.definitionEn}</p>
          {item.exampleEn || item.exampleZh ? (
            <p className="mt-4 rounded-[20px] border border-[color:var(--hairline)] bg-[var(--surface-1)] p-4 text-base leading-7 text-[var(--text)]">
              {item.exampleEn}
              {item.exampleZh ? <span className="mt-2 block text-sm font-semibold text-[var(--muted)]">{item.exampleZh}</span> : null}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 lg:w-56 lg:flex-col">
          <Button variant="danger" onClick={() => onReview("again")} disabled={busy}>
            <RotateCcw className="h-4 w-4" />
            不认识
          </Button>
          <Button variant="secondary" onClick={() => onReview("hard")} disabled={busy}>
            模糊
          </Button>
          <Button variant="success" onClick={() => onReview("good")} disabled={busy}>
            <Check className="h-4 w-4" />
            认识
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-[18px] border border-[color:var(--hairline)] bg-[var(--surface-1)] px-4 py-3">
      <span className="text-sm font-bold text-[var(--muted)]">{label}</span>
      <span className="text-base font-extrabold text-[var(--text)]">{value}</span>
    </div>
  );
}

function LibraryWordCard({ item }: { item: VocabularyItem }) {
  const statusLabel = !item.progress ? "未学" : item.progress.status === "learned" ? "已掌握" : "复习中";
  const dueLabel = item.progress?.dueAt ? new Date(item.progress.dueAt).toLocaleString() : "未安排";

  return (
    <div className="rounded-[24px] border border-[color:var(--hairline)] bg-white/78 p-4 transition-[border-color,box-shadow,transform] duration-300 ease-[var(--ease-soft)] hover:-translate-y-0.5 hover:border-[color:var(--hairline-strong)] hover:shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-extrabold text-[var(--text)]">{item.word}</h3>
            <PronunciationButton vocabularyItemId={item.id} word={item.word} size="sm" />
            <Badge>{item.phonetic}</Badge>
          </div>
          <p className="mt-1 text-base font-extrabold text-[var(--action-strong)]">{item.meaningZh}</p>
        </div>
        <Badge className={item.progress?.status === "learned" ? "text-[var(--success)]" : item.progress ? "text-[var(--action-strong)]" : undefined}>
          {statusLabel}
        </Badge>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-[var(--muted)]">{item.definitionEn}</p>
      {item.exampleEn || item.exampleZh ? (
        <p className="mt-3 rounded-[18px] bg-[var(--surface-1)] px-4 py-3 text-sm font-bold leading-6 text-[var(--text)]">
          {item.exampleEn}
          {item.exampleZh ? <span className="mt-1 block font-semibold text-[var(--muted)]">{item.exampleZh}</span> : null}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-extrabold text-[var(--muted)]">
        <Badge>{item.topic}</Badge>
        {item.progress ? (
          <>
            <Badge>复习 {item.progress.reviewCount} 次</Badge>
            <Badge>
              <Clock3 className="mr-1 h-3 w-3" />
              {dueLabel}
            </Badge>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="rounded-[32px] border border-[color:var(--hairline)] bg-white/58 p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <Badge>{eyebrow}</Badge>
      <h1 className="mt-4 max-w-4xl text-3xl font-extrabold leading-tight tracking-normal text-[var(--text)] sm:text-5xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">{description}</p>
    </header>
  );
}
