import { useMutation } from "@tanstack/react-query";
import { Loader2, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { playAudioUrl, speakEnglishText } from "@/lib/speech";
import { cn } from "@/lib/utils";

type PronunciationButtonProps = {
  vocabularyItemId: string;
  word: string;
  className?: string;
  size?: "sm" | "md" | "lg";
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

export function PronunciationButton({ vocabularyItemId, word, className, size = "md" }: PronunciationButtonProps) {
  const [unavailable, setUnavailable] = useState(false);
  const pronunciation = useMutation({
    mutationFn: async () => {
      setUnavailable(false);
      const result = await api.vocabularyPronunciation(vocabularyItemId);

      if (result.audioUrl) {
        try {
          await playAudioUrl(result.audioUrl);
          return;
        } catch {
          // Fall through to browser TTS when the remote media cannot start.
        }
      }

      if (!speakEnglishText(result.fallbackText || word)) {
        setUnavailable(true);
      }
    },
    onError: () => {
      if (!speakEnglishText(word)) {
        setUnavailable(true);
      }
    }
  });

  const Icon = pronunciation.isPending ? Loader2 : unavailable ? VolumeX : Volume2;

  return (
    <button
      type="button"
      aria-label={`播放 ${word} 发音`}
      title={unavailable ? "当前浏览器无法播放发音" : "播放发音"}
      disabled={pronunciation.isPending}
      onClick={() => pronunciation.mutate()}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full border border-[color:var(--hairline)] bg-white/72 text-[var(--action-strong)] shadow-[0_8px_18px_rgba(244,165,115,0.14)] transition-[background-color,border-color,box-shadow,transform,color,opacity] duration-300 ease-[var(--ease-soft)] hover:-translate-y-0.5 hover:border-[color:var(--hairline-strong)] hover:bg-white hover:shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--action-soft)] disabled:pointer-events-none disabled:opacity-60",
        sizeClasses[size],
        unavailable && "text-[var(--danger)]",
        className
      )}
    >
      <Icon className={cn(iconSizeClasses[size], pronunciation.isPending && "animate-spin")} />
    </button>
  );
}
