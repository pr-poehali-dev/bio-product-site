import { useState, useRef, useCallback, useEffect } from "react";

export type MicState = "idle" | "listening" | "processing" | "error";

interface UseMicrophoneReturn {
  startListening: () => void;
  stopListening: () => void;
  state: MicState;
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  error: string | null;
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export function useMicrophone(
  onResult: (text: string) => void,
  onInterim?: (text: string) => void
): UseMicrophoneReturn {
  const [state, setState]         = useState<MicState>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError]         = useState<string | null>(null);
  const recognitionRef            = useRef<SpeechRecognition | null>(null);

  const SpeechRecognitionClass =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const isSupported = !!SpeechRecognitionClass;

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setState("idle");
    setTranscript("");
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionClass) return;
    setError(null);
    setTranscript("");

    const recognition = new SpeechRecognitionClass();
    recognition.lang             = "ru-RU";
    recognition.continuous       = false;
    recognition.interimResults   = true;
    recognition.maxAlternatives  = 1;

    recognition.onstart = () => setState("listening");

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      let final   = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interim && onInterim) onInterim(interim);
      if (final) {
        setTranscript(final);
        setState("processing");
        onResult(final.trim());
      }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      const msgs: Record<string, string> = {
        "not-allowed": "Нет доступа к микрофону. Разреши в браузере.",
        "no-speech":   "Ничего не услышала. Попробуй ещё раз.",
        "network":     "Ошибка сети при распознавании.",
        "aborted":     "",
      };
      const msg = msgs[e.error] ?? `Ошибка: ${e.error}`;
      if (msg) setError(msg);
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    };

    recognition.onend = () => {
      setState((prev) => (prev === "listening" ? "idle" : prev));
      setTranscript("");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [SpeechRecognitionClass, onResult, onInterim]);

  useEffect(() => () => { recognitionRef.current?.abort(); }, []);

  return { startListening, stopListening, state, isListening: state === "listening", isSupported, transcript, error };
}
