import type { VocabularyPronunciationResponse } from "@english-learning/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { playAudioUrl, speakEnglishText } from "@/lib/speech";
import { cn } from "@/lib/utils";

type PronunciationButtonProps = {
  vocabularyItemId: string;
  word: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  prefetch?: boolean;
};

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-11 w-11"
};

const iconSizeClasses = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5"
};

type PlaybackStatus = "idle" | "resolving" | "ready" | "unavailable";

function pronunciationQueryKey(vocabularyItemId: string) {
  return ["vocabulary-pronunciation", vocabularyItemId] as const;
}

function fallbackPronunciation(vocabularyItemId: string, word: string): VocabularyPronunciationResponse {
  return {
    vocabularyItemId,
    word,
    strategy: "browser-tts",
    audioUrl: null,
    source: null,
    sourceUrl: null,
    accent: null,
    fallbackText: word
  };
}

export function PronunciationButton({ vocabularyItemId, word, className, size = "md", prefetch = false }: PronunciationButtonProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [resolvedPronunciation, setResolvedPronunciation] = useState<VocabularyPronunciationResponse | null>(null);
  const isResolving = status === "resolving";
  const isReady = status === "ready";
  const isUnavailable = status === "unavailable";
  const Icon = isResolving ? Loader2 : isUnavailable ? VolumeX : Volume2;

  useEffect(() => {
    if (!prefetch) {
      return;
    }

    let cancelled = false;
    queryClient
      .fetchQuery({
        queryKey: pronunciationQueryKey(vocabularyItemId),
        queryFn: () => api.vocabularyPronunciation(vocabularyItemId),
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: 1000 * 60 * 60 * 12
      })
      .then((result) => {
        if (!cancelled) {
          setResolvedPronunciation(result);
        }
      })
      .catch(() => {
        // Click handling still falls back to browser TTS if a background prefetch fails.
      });

    return () => {
      cancelled = true;
    };
  }, [prefetch, queryClient, vocabularyItemId]);

  async function playResolvedPronunciation(result: VocabularyPronunciationResponse, fromDirectTap: boolean) {
    if (result.audioUrl) {
      try {
        await playAudioUrl(result.audioUrl);
        setStatus("idle");
      } catch {
        setStatus(fromDirectTap ? "unavailable" : "ready");
      }
      return;
    }

    if (fromDirectTap && speakEnglishText(result.fallbackText || word)) {
      setStatus("idle");
      return;
    }

    setStatus(fromDirectTap ? "unavailable" : "ready");
  }

  async function handleClick() {
    if (isResolving) {
      return;
    }

    const cached =
      resolvedPronunciation ?? queryClient.getQueryData<VocabularyPronunciationResponse>(pronunciationQueryKey(vocabularyItemId));
    if (cached) {
      await playResolvedPronunciation(cached, true);
      return;
    }

    setStatus("resolving");
    try {
      const result = await queryClient.fetchQuery({
        queryKey: pronunciationQueryKey(vocabularyItemId),
        queryFn: () => api.vocabularyPronunciation(vocabularyItemId),
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: 1000 * 60 * 60 * 12
      });
      setResolvedPronunciation(result);
      await playResolvedPronunciation(result, false);
    } catch {
      const fallback = fallbackPronunciation(vocabularyItemId, word);
      setResolvedPronunciation(fallback);
      queryClient.setQueryData(pronunciationQueryKey(vocabularyItemId), fallback);
      setStatus("ready");
    }
  }

  const title = isUnavailable ? "当前浏览器无法播放发音" : isReady ? "已准备好，再点一次播放" : "播放发音";

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <button
        type="button"
        aria-label={`播放 ${word} 发音`}
        title={title}
        disabled={isResolving}
        onClick={handleClick}
        className={cn(
          "inline-grid shrink-0 place-items-center rounded-full border border-[color:var(--hairline)] bg-white/72 text-[var(--action-strong)] shadow-[0_8px_18px_rgba(244,165,115,0.14)] transition-[background-color,border-color,box-shadow,transform,color,opacity] duration-300 ease-[var(--ease-soft)] hover:-translate-y-0.5 hover:border-[color:var(--hairline-strong)] hover:bg-white hover:shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--action-soft)] disabled:pointer-events-none disabled:opacity-60",
          sizeClasses[size],
          isReady && "border-[color:rgba(245,134,123,0.42)] bg-[var(--action-soft)] text-[var(--action-strong)]",
          isUnavailable && "text-[var(--danger)]"
        )}
      >
        <Icon className={cn(iconSizeClasses[size], isResolving && "animate-spin")} />
      </button>
      {isReady ? (
        <span className="pointer-events-none absolute -right-1 -top-2 rounded-full border border-[color:rgba(245,134,123,0.24)] bg-white px-2 py-0.5 text-[10px] font-extrabold leading-none text-[var(--action-strong)] shadow-[0_8px_18px_rgba(244,165,115,0.16)]">
          再点
        </span>
      ) : null}
    </span>
  );
}
