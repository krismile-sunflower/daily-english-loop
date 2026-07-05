let activeAudio: HTMLAudioElement | null = null;

export async function playAudioUrl(audioUrl: string) {
  stopActiveAudio();
  if (typeof window !== "undefined") {
    window.speechSynthesis?.cancel();
  }

  const audio = new Audio();
  audio.preload = "auto";
  audio.setAttribute("playsinline", "true");
  audio.src = audioUrl;
  activeAudio = audio;
  audio.addEventListener(
    "ended",
    () => {
      if (activeAudio === audio) {
        activeAudio = null;
      }
    },
    { once: true }
  );

  try {
    audio.load();
    await audio.play();
  } catch (error) {
    if (activeAudio === audio) {
      activeAudio = null;
    }
    throw error;
  }
}

export function speakEnglishText(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return false;
  }

  stopActiveAudio();
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.88;
  const preferredVoice =
    synth.getVoices().find((voice) => voice.lang === "en-US") ??
    synth.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("en"));
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }
  synth.speak(utterance);
  return true;
}

export function stopActiveAudio() {
  if (!activeAudio) {
    return;
  }

  activeAudio.pause();
  activeAudio.currentTime = 0;
  activeAudio = null;
}
