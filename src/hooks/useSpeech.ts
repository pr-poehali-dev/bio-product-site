import { useState, useRef, useCallback, useEffect } from "react";

export type SpeechState = "idle" | "speaking" | "paused";

interface UseSpeechReturn {
  speak: (text: string, emotion?: string) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  state: SpeechState;
  isSpeaking: boolean;
  isSupported: boolean;
  autoSpeak: boolean;
  setAutoSpeak: (v: boolean) => void;
  currentText: string;
}

// Выбираем лучший русский голос
function getBestVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const ruVoices = voices.filter((v) => v.lang.startsWith("ru"));
  // Приоритет: женские онлайн-голоса → любые русские → fallback
  const online = ruVoices.find((v) => v.name.toLowerCase().includes("google") && !v.localService);
  const female = ruVoices.find((v) =>
    v.name.toLowerCase().includes("female") ||
    v.name.toLowerCase().includes("alena") ||
    v.name.toLowerCase().includes("irina") ||
    v.name.toLowerCase().includes("milena") ||
    v.name.toLowerCase().includes("maria") ||
    v.name.toLowerCase().includes("anna")
  );
  return online || female || ruVoices[0] || null;
}

// Настройки голоса по эмоции
function getVoiceParams(emotion?: string): { rate: number; pitch: number; volume: number } {
  switch (emotion) {
    case "happy":      return { rate: 1.1,  pitch: 1.2,  volume: 1 };
    case "intense":    return { rate: 1.2,  pitch: 0.85, volume: 1 };
    case "serious":    return { rate: 0.9,  pitch: 0.9,  volume: 1 };
    case "curious":    return { rate: 1.05, pitch: 1.15, volume: 1 };
    case "playful":    return { rate: 1.15, pitch: 1.25, volume: 1 };
    case "empathetic": return { rate: 0.88, pitch: 1.05, volume: 0.95 };
    case "thinking":   return { rate: 0.95, pitch: 1.0,  volume: 0.9 };
    case "focused":    return { rate: 1.0,  pitch: 0.95, volume: 1 };
    default:           return { rate: 1.0,  pitch: 1.05, volume: 1 };
  }
}

// Очищаем текст от markdown для озвучки
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "... блок кода ...") // код → заглушка
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1))      // инлайн код
    .replace(/\*\*(.*?)\*\*/g, "$1")                   // жирный
    .replace(/\*(.*?)\*/g, "$1")                       // курсив
    .replace(/#{1,6}\s/g, "")                          // заголовки
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")           // ссылки
    .replace(/\n{2,}/g, ". ")                          // двойные переносы
    .replace(/\n/g, " ")
    .replace(/[•·▪]/g, "")
    .trim();
}

export function useSpeech(): UseSpeechReturn {
  const [state, setState]           = useState<SpeechState>("idle");
  const [currentText, setCurrentText] = useState("");
  const [autoSpeak, setAutoSpeakState] = useState(() => {
    return localStorage.getItem("stefani_autospeak") === "true";
  });
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSupported  = typeof window !== "undefined" && "speechSynthesis" in window;

  const setAutoSpeak = useCallback((v: boolean) => {
    setAutoSpeakState(v);
    localStorage.setItem("stefani_autospeak", String(v));
  }, []);

  // Инициализируем голоса (Chrome требует preload)
  useEffect(() => {
    if (!isSupported) return;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }, [isSupported]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setState("idle");
    setCurrentText("");
  }, [isSupported]);

  const pause = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.pause();
    setState("paused");
  }, [isSupported]);

  const resume = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.resume();
    setState("speaking");
  }, [isSupported]);

  const speak = useCallback((text: string, emotion?: string) => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();

    const clean = cleanTextForSpeech(text);
    if (!clean) return;

    const params = getVoiceParams(emotion);
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang    = "ru-RU";
    utt.rate    = params.rate;
    utt.pitch   = params.pitch;
    utt.volume  = params.volume;

    // Голос подбираем с небольшой задержкой (голоса могут не быть загружены сразу)
    const voice = getBestVoice();
    if (voice) utt.voice = voice;

    utt.onstart = () => { setState("speaking"); setCurrentText(text); };
    utt.onend   = () => { setState("idle"); setCurrentText(""); };
    utt.onerror = () => { setState("idle"); setCurrentText(""); };
    utt.onpause = () => setState("paused");

    utteranceRef.current = utt;
    window.speechSynthesis.speak(utt);
  }, [isSupported]);

  // Останавливаем при размонтировании
  useEffect(() => () => { if (isSupported) window.speechSynthesis.cancel(); }, [isSupported]);

  return {
    speak, stop, pause, resume,
    state,
    isSpeaking: state === "speaking",
    isSupported,
    autoSpeak,
    setAutoSpeak,
    currentText,
  };
}
