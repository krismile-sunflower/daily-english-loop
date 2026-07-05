import type { ReviewGrade, VocabularyItem } from "@english-learning/shared";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Loader2, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { playAudioUrl } from "@/lib/speech";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PronunciationButton } from "@/components/PronunciationButton";

type StudyExampleModalProps = {
  open: boolean;
  item: VocabularyItem | null;
  grade: ReviewGrade | null;
  onClose: () => void;
};

const gradeCopy: Record<ReviewGrade, { label: string; detail: string }> = {
  again: { label: "不认识", detail: "已安排 10 分钟后再看一次。" },
  hard: { label: "模糊", detail: "已进入短间隔复习队列。" },
  good: { label: "认识", detail: "已按遗忘曲线安排下次复习。" },
  easy: { label: "很熟", detail: "已延长下一次复习间隔。" }
};

export function StudyExampleModal({ open, item, grade, onClose }: StudyExampleModalProps) {
  const itemId = item?.id ?? "";
  const [visibleTranslations, setVisibleTranslations] = useState<Record<string, boolean>>({});
  const examples = useQuery({
    queryKey: ["vocabulary-examples", itemId],
    queryFn: () => api.vocabularyExamples(itemId),
    enabled: open && Boolean(itemId)
  });

  useEffect(() => {
    setVisibleTranslations({});
  }, [itemId, open]);

  const selectedGrade = grade ? gradeCopy[grade] : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-4xl">
        <div className="max-h-[min(88dvh,760px)] overflow-y-auto p-5 pr-5 sm:p-7">
          {item ? (
            <div className="space-y-5">
              <DialogHeader className="pr-12">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>例句学习</Badge>
                  {selectedGrade ? (
                    <Badge className="border-[color:rgba(245,134,123,0.22)] bg-[var(--action-soft)] text-[var(--action-strong)]">
                      {selectedGrade.label}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <DialogTitle className="break-words text-4xl sm:text-5xl">{item.word}</DialogTitle>
                  <PronunciationButton vocabularyItemId={item.id} word={item.word} />
                </div>
                <DialogDescription>{selectedGrade?.detail ?? "复习选择已保存，关闭弹框后会刷新今日新词列表。"}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 rounded-[24px] border border-[color:var(--hairline)] bg-[var(--surface-1)] p-4 sm:grid-cols-[1fr_auto] sm:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{item.phonetic}</Badge>
                    <Badge>{item.topic}</Badge>
                  </div>
                  <p className="mt-3 text-xl font-extrabold text-[var(--action-strong)]">{item.meaningZh}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted)]">{item.definitionEn}</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--hairline)] bg-white/76 px-4 py-2 text-sm font-extrabold text-[var(--accent-light)]">
                  <CheckCircle2 className="h-4 w-4" />
                  已保存
                </div>
              </div>

              {examples.isLoading ? (
                <div className="grid min-h-40 place-items-center rounded-[24px] border border-[color:var(--hairline)] bg-white/64 p-6 text-sm font-extrabold text-[var(--muted)]">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--action-strong)]" />
                    正在查找真实例句
                  </span>
                </div>
              ) : examples.isError ? (
                <div className="rounded-[24px] border border-[color:rgba(201,101,101,0.2)] bg-[rgba(201,101,101,0.08)] p-5">
                  <p className="font-extrabold text-[var(--danger)]">例句暂时加载失败</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted)]">
                    复习选择已经保存，可以稍后再打开单词库查看。
                  </p>
                </div>
              ) : examples.data?.examples.length ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--muted)]">
                    <BookOpen className="h-4 w-4 text-[var(--accent-light)]" />
                    真实例句
                  </div>
                  {examples.data.examples.map((example) => {
                    const translationVisible = Boolean(visibleTranslations[example.id]);
                    const ToggleIcon = translationVisible ? ChevronUp : ChevronDown;
                    const sourceLabel = `Tatoeba #${example.sentenceId}`;

                    return (
                      <article
                        key={example.id}
                        className="rounded-[24px] border border-[color:var(--hairline)] bg-white/78 p-4 shadow-[0_10px_26px_rgba(244,165,115,0.12)]"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          {example.audioUrl ? (
                            <ExampleAudioButton audioUrl={example.audioUrl} sentenceId={example.sentenceId} />
                          ) : null}
                          <p className="min-w-0 flex-1 break-words text-lg font-extrabold leading-8 text-[var(--text)]">
                            {example.text}
                          </p>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setVisibleTranslations((current) => ({
                                ...current,
                                [example.id]: !translationVisible
                              }))
                            }
                          >
                            {translationVisible ? "隐藏翻译" : "显示翻译"}
                            <ToggleIcon className="h-4 w-4" />
                          </Button>
                          <a
                            className="inline-flex min-w-0 items-center gap-1 rounded-full border border-[color:var(--hairline)] bg-[var(--surface-1)] px-3 py-2 text-xs font-extrabold text-[var(--muted)] transition-colors hover:text-[var(--text)]"
                            href={example.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span className="truncate">{sourceLabel}</span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          </a>
                        </div>
                        {translationVisible ? (
                          <p className="mt-3 rounded-[18px] bg-[var(--surface-1)] px-4 py-3 text-sm font-bold leading-6 text-[var(--text)]">
                            {example.translationZh}
                          </p>
                        ) : null}
                        <p className="mt-3 text-xs font-semibold leading-5 text-[var(--muted-2)]">
                          来源 {sourceLabel}，作者 {example.owner ?? "unknown"}
                          {example.translationOwner ? `；翻译 ${example.translationOwner}` : ""}
                          {example.license ? `；${example.license}` : ""}
                        </p>
                      </article>
                    );
                  })}
                </div>
              ) : (
                  <div className="rounded-[24px] border border-[color:var(--hairline)] bg-white/70 p-5">
                  <p className="font-extrabold text-[var(--text)]">暂无双语例句</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted)]">
                    暂时没有找到带中文翻译的真实例句；先用释义确认这个词的核心意思。
                  </p>
                  <div className="mt-4 rounded-[18px] bg-[var(--surface-1)] p-4">
                    <p className="font-extrabold text-[var(--action-strong)]">
                      {examples.data?.fallbackDefinition.meaningZh ?? item.meaningZh}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted)]">
                      {examples.data?.fallbackDefinition.definitionEn ?? item.definitionEn}
                    </p>
                  </div>
                </div>
              )}

              <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-[color:var(--hairline)] bg-[color-mix(in_oklab,var(--surface-2)_88%,transparent)] px-5 py-4 backdrop-blur sm:-mx-7 sm:-mb-7 sm:px-7">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold leading-6 text-[var(--muted)]">关闭后刷新今日新词，继续下一张卡片。</p>
                  <Button variant="primary" onClick={onClose}>
                    继续学习
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExampleAudioButton({ audioUrl, sentenceId }: { audioUrl: string; sentenceId: number }) {
  const [status, setStatus] = useState<"idle" | "loading" | "unavailable">("idle");
  const Icon = status === "loading" ? Loader2 : status === "unavailable" ? VolumeX : Volume2;

  return (
    <button
      type="button"
      aria-label={`播放 Tatoeba 例句 ${sentenceId} 的真实录音`}
      title={status === "unavailable" ? "录音暂时无法播放" : "播放真实录音"}
      disabled={status === "loading"}
      onClick={async () => {
        setStatus("loading");
        try {
          await playAudioUrl(audioUrl);
          setStatus("idle");
        } catch {
          setStatus("unavailable");
        }
      }}
      className="inline-grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[color:var(--hairline)] bg-white/72 text-[var(--action-strong)] shadow-[0_8px_18px_rgba(244,165,115,0.14)] transition-[background-color,border-color,box-shadow,transform,color,opacity] duration-300 ease-[var(--ease-soft)] hover:-translate-y-0.5 hover:border-[color:var(--hairline-strong)] hover:bg-white hover:shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--action-soft)] disabled:pointer-events-none disabled:opacity-60"
    >
      <Icon className={`h-3.5 w-3.5 ${status === "loading" ? "animate-spin" : ""}`} />
    </button>
  );
}
