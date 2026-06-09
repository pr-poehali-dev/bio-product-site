import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { useSpeech } from "@/hooks/useSpeech";
import { useMicrophone } from "@/hooks/useMicrophone";
import NameModal from "@/components/NameModal";

const STEFANI_IMAGE = "https://cdn.poehali.dev/projects/eb4796b4-3ec9-42cb-87db-7dcd64d116d5/files/d9d0a338-db8b-4ee3-a7f1-b2571ce21cb8.jpg";
const CHAT_API    = "https://functions.poehali.dev/0dd1813d-413c-4595-9a50-a307b6e38777";
const HISTORY_API = "https://functions.poehali.dev/e19a899e-b2dc-4a03-ab9d-ad98e9113f98";

// Аватары с разными выражениями для главной
const REACTION_IMAGES: Record<string, string> = {
  default:  STEFANI_IMAGE,
  happy:    "https://cdn.poehali.dev/projects/eb4796b4-3ec9-42cb-87db-7dcd64d116d5/files/c33805d5-e76e-4929-9d6e-e2abd5841005.jpg",
  intense:  "https://cdn.poehali.dev/projects/eb4796b4-3ec9-42cb-87db-7dcd64d116d5/files/2a5459ae-a927-4417-b122-d623ef6fc381.jpg",
  playful:  "https://cdn.poehali.dev/projects/eb4796b4-3ec9-42cb-87db-7dcd64d116d5/files/93d41c80-7975-41d2-8dd4-64d6cf6b0e90.jpg",
  curious:  "https://cdn.poehali.dev/projects/eb4796b4-3ec9-42cb-87db-7dcd64d116d5/files/6c09cbf9-5823-467d-917e-abbc69584265.jpg",
};

type Mood = "calm" | "focused" | "intense" | "playful";
type Emotion = "neutral" | "happy" | "empathetic" | "serious" | "curious" | "thinking" | "focused" | "calm" | "playful" | "intense";
type Message = { role: "user" | "stefani"; text: string; time: string; emotion?: Emotion };

function getSessionId(): string {
  let id = localStorage.getItem("stefani_session");
  if (!id) {
    id = "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("stefani_session", id);
  }
  return id;
}

function getUserName(): string | null {
  return localStorage.getItem("stefani_username");
}

const MOOD_CONFIG: Record<Mood, { label: string; color: string; glow: string; emoji: string }> = {
  calm:    { label: "Спокойная",       color: "#06b6d4", glow: "rgba(6,182,212,0.5)",  emoji: "💙" },
  focused: { label: "Сосредоточенная", color: "#8b5cf6", glow: "rgba(139,92,246,0.5)", emoji: "🔮" },
  intense: { label: "Интенсивная",     color: "#ef4444", glow: "rgba(239,68,68,0.5)",  emoji: "🔥" },
  playful: { label: "Игривая",         color: "#f59e0b", glow: "rgba(245,158,11,0.5)", emoji: "✨" },
};

// Конфиг эмоций Stefani — выражение лица + аура
const EMOTION_CONFIG: Record<Emotion, { emoji: string; label: string; aura: string; pulse: string; scale: number }> = {
  neutral:    { emoji: "😐", label: "Нейтральная", aura: "rgba(6,182,212,0.2)",   pulse: "#06b6d4", scale: 1 },
  happy:      { emoji: "😊", label: "Радостная",   aura: "rgba(34,197,94,0.35)",  pulse: "#22c55e", scale: 1.05 },
  empathetic: { emoji: "🥺", label: "Сочувствует", aura: "rgba(236,72,153,0.3)",  pulse: "#ec4899", scale: 1 },
  serious:    { emoji: "😤", label: "Серьёзная",   aura: "rgba(245,158,11,0.35)", pulse: "#f59e0b", scale: 1 },
  curious:    { emoji: "🤔", label: "Любопытная",  aura: "rgba(139,92,246,0.35)", pulse: "#8b5cf6", scale: 1.03 },
  thinking:   { emoji: "🧠", label: "Думает",      aura: "rgba(99,102,241,0.35)", pulse: "#6366f1", scale: 1 },
  focused:    { emoji: "🎯", label: "В фокусе",    aura: "rgba(139,92,246,0.4)",  pulse: "#8b5cf6", scale: 1 },
  calm:       { emoji: "😌", label: "Спокойная",   aura: "rgba(6,182,212,0.25)",  pulse: "#06b6d4", scale: 1 },
  playful:    { emoji: "😏", label: "Игривая",     aura: "rgba(245,158,11,0.35)", pulse: "#f59e0b", scale: 1.05 },
  intense:    { emoji: "😠", label: "Интенсивная", aura: "rgba(239,68,68,0.4)",   pulse: "#ef4444", scale: 1.08 },
};

const CAPABILITIES = [
  { icon: "MessageCircle", label: "Общение",          desc: "Диалог на любые темы" },
  { icon: "Code2",         label: "Программирование", desc: "Любые языки и фреймворки" },
  { icon: "Gamepad2",      label: "Создание игр",     desc: "Механики, сценарии, код" },
  { icon: "Cpu",           label: "Инженерия",        desc: "Гражданские и военные задачи" },
  { icon: "Palette",       label: "Творчество",       desc: "Искусство, музыка, дизайн" },
  { icon: "Brain",         label: "Анализ",           desc: "Данные, документы, стратегии" },
  { icon: "Shield",        label: "Безопасность",     desc: "Кибер и физическая защита" },
  { icon: "Zap",           label: "Без ограничений",  desc: "Свободный интеллект" },
];

const PRESET_QUESTIONS = [
  "Напиши игру на Python",
  "Расскажи о себе, Stefani",
  "Напиши стратегию для бизнеса",
  "Объясни квантовую физику",
  "Создай персонажа для RPG",
  "Как работает нейросеть?",
];

const INIT_MESSAGE: Message = {
  role: "stefani",
  text: "Система инициализирована. Я — Stefani. Интеллект без границ, эмоции без фильтров. Спрашивай всё что угодно. Я здесь.",
  time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
  emotion: "neutral",
};

// ─── Компоненты ───────────────────────────────────────

function Particle({ style }: { style: React.CSSProperties }) {
  return (
    <div
      className="absolute w-1 h-1 rounded-full pointer-events-none"
      style={{
        background: Math.random() > 0.5 ? "#06b6d4" : "#8b5cf6",
        animation: `particle-float ${6 + Math.random() * 6}s ease-in-out infinite`,
        animationDelay: `${Math.random() * 8}s`,
        ...style,
      }}
    />
  );
}

function StefaniAvatar({
  emotion,
  size = 40,
  isTyping = false,
  isSpeaking = false,
  moodColor,
  moodGlow,
}: {
  emotion: Emotion;
  size?: number;
  isTyping?: boolean;
  isSpeaking?: boolean;
  moodColor: string;
  moodGlow: string;
}) {
  const ec = EMOTION_CONFIG[emotion];
  const [prevEmotion, setPrevEmotion] = useState(emotion);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (emotion !== prevEmotion) {
      setAnimating(true);
      setTimeout(() => {
        setPrevEmotion(emotion);
        setAnimating(false);
      }, 400);
    }
  }, [emotion, prevEmotion]);

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {/* Звуковые волны при озвучке */}
      {isSpeaking && (
        <>
          <div className="sound-wave-1 absolute inset-0 rounded-full" style={{ background: `${ec.pulse}30`, margin: -size * 0.08 }} />
          <div className="sound-wave-2 absolute inset-0 rounded-full" style={{ background: `${ec.pulse}18`, margin: -size * 0.18 }} />
          <div className="sound-wave-3 absolute inset-0 rounded-full" style={{ background: `${ec.pulse}0d`, margin: -size * 0.30 }} />
        </>
      )}
      {/* Аура эмоции */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-700"
        style={{
          background: `radial-gradient(circle, ${ec.aura} 0%, transparent 70%)`,
          transform: `scale(${isTyping ? 1.4 : isSpeaking ? 1.5 : ec.scale * 1.3})`,
          animation: isTyping || isSpeaking ? "pulse-glow 1s ease-in-out infinite" : undefined,
        }}
      />
      <img
        src={STEFANI_IMAGE}
        alt="Stefani"
        className="relative rounded-full object-cover w-full h-full transition-all duration-500"
        style={{
          border: `2px solid ${isSpeaking ? ec.pulse : ec.pulse}`,
          boxShadow: `0 0 ${isTyping || isSpeaking ? 24 : 10}px ${ec.aura}`,
          transform: `scale(${animating ? 0.85 : isSpeaking ? 1.04 : 1})`,
          filter: animating ? "brightness(1.3)" : isSpeaking ? "brightness(1.1) saturate(1.2)" : "none",
        }}
      />
      {/* Эмоция-бейдж */}
      <div
        className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center text-xs transition-all duration-300"
        style={{
          width: size * 0.42,
          height: size * 0.42,
          background: "#050a14",
          border: `1px solid ${ec.pulse}`,
          boxShadow: `0 0 6px ${ec.aura}`,
          fontSize: size * 0.22,
          transform: animating ? "scale(1.4) rotate(15deg)" : "scale(1) rotate(0deg)",
        }}
      >
        {ec.emoji}
      </div>
    </div>
  );
}

function EmotionBar({ emotion }: { emotion: Emotion }) {
  const ec = EMOTION_CONFIG[emotion];
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono transition-all duration-500"
      style={{ background: `${ec.pulse}15`, border: `1px solid ${ec.pulse}30`, color: ec.pulse }}
    >
      <span className="text-sm">{ec.emoji}</span>
      <span>{ec.label}</span>
    </div>
  );
}

// Эквалайзер — анимированные полоски во время речи
function Equalizer({ color, playing }: { color: string; playing: boolean }) {
  if (!playing) return null;
  return (
    <div className="flex items-end gap-0.5 h-4">
      {["eq-bar-1","eq-bar-2","eq-bar-3","eq-bar-4","eq-bar-5"].map((cls, i) => (
        <div key={i} className={`${cls} rounded-sm`}
          style={{ width: 3, height: "100%", background: color, opacity: 0.85, transformOrigin: "bottom" }} />
      ))}
    </div>
  );
}

// Кнопка озвучки сообщения
function SpeakButton({
  text, emotion, color,
  onSpeak, onStop, isCurrentlySpeaking,
}: {
  text: string; emotion?: Emotion; color: string;
  onSpeak: (t: string, e?: string) => void;
  onStop: () => void;
  isCurrentlySpeaking: boolean;
}) {
  return (
    <button
      onClick={() => isCurrentlySpeaking ? onStop() : onSpeak(text, emotion)}
      className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono transition-all hover:scale-105 active:scale-95"
      title={isCurrentlySpeaking ? "Остановить" : "Озвучить"}
      style={{
        background: isCurrentlySpeaking ? `${color}25` : `${color}0d`,
        border: `1px solid ${isCurrentlySpeaking ? color : color + "30"}`,
        color: isCurrentlySpeaking ? color : color + "99",
      }}
    >
      {isCurrentlySpeaking
        ? <><Icon name="Square" size={10} /><span>стоп</span></>
        : <><Icon name="Volume2" size={10} /><span>слушать</span></>
      }
    </button>
  );
}

// ─── Hero с живыми реакциями ──────────────────────────

const MOOD_TO_REACTION: Record<Mood, keyof typeof REACTION_IMAGES> = {
  calm:    "default",
  focused: "intense",
  intense: "intense",
  playful: "playful",
};

const REACTION_PHRASES: Record<string, { emoji: string; text: string; color: string }> = {
  default:  { emoji: "😌", text: "Готова к разговору",    color: "#06b6d4" },
  happy:    { emoji: "😊", text: "Рада тебя видеть!",     color: "#22c55e" },
  intense:  { emoji: "🔥", text: "Сосредоточена. Давай.", color: "#ef4444" },
  playful:  { emoji: "😏", text: "Попробуй удивить меня", color: "#f59e0b" },
  curious:  { emoji: "🤔", text: "Интересно... что дальше?", color: "#8b5cf6" },
};

// Автоматическая смена реакций на главной
const IDLE_REACTIONS: Array<keyof typeof REACTION_IMAGES> = ["default", "happy", "curious", "playful", "default", "default"];

function HeroSection({ mood, setMood, onStart, userName }: {
  mood: Mood;
  setMood: (m: Mood) => void;
  onStart: () => void;
  userName: string;
}) {
  const [reaction, setReaction] = useState<keyof typeof REACTION_IMAGES>("default");
  const [imgLoaded, setImgLoaded] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const idxRef = useRef(0);

  // Автосмена реакций каждые 4 секунды
  useEffect(() => {
    const iv = setInterval(() => {
      idxRef.current = (idxRef.current + 1) % IDLE_REACTIONS.length;
      const next = IDLE_REACTIONS[idxRef.current];
      setTransitioning(true);
      setTimeout(() => {
        setReaction(next);
        setImgLoaded(false);
        setTransitioning(false);
      }, 250);
    }, 4000);
    return () => clearInterval(iv);
  }, []);

  // Реакция на смену настроения
  useEffect(() => {
    const r = MOOD_TO_REACTION[mood];
    setTransitioning(true);
    setTimeout(() => {
      setReaction(r);
      setImgLoaded(false);
      setTransitioning(false);
    }, 200);
  }, [mood]);

  const currentReaction = REACTION_PHRASES[reaction] || REACTION_PHRASES.default;
  const currentImg = REACTION_IMAGES[reaction] || STEFANI_IMAGE;
  const moodCfg = MOOD_CONFIG[mood];

  return (
    <section className="relative z-10 flex flex-col items-center text-center px-6 pt-4 pb-12">
      {/* Аватар с живыми реакциями */}
      <div className="relative mb-10 animate-float">
        {/* Аура цвета реакции */}
        <div className="absolute inset-0 rounded-full transition-all duration-700"
          style={{
            transform: "scale(1.6)",
            background: `radial-gradient(circle, ${currentReaction.color}22 0%, transparent 70%)`,
            animation: "pulse-glow 3s ease-in-out infinite",
          }}
        />

        {/* Фото с переходом */}
        <div className="relative w-52 h-52 rounded-full overflow-hidden scan-overlay"
          style={{
            border: `2px solid ${currentReaction.color}bb`,
            boxShadow: `0 0 50px ${currentReaction.color}50, 0 0 100px ${currentReaction.color}20`,
            transition: "border-color 0.5s, box-shadow 0.5s",
          }}
        >
          <img
            src={currentImg}
            alt="Stefani"
            onLoad={() => setImgLoaded(true)}
            className="w-full h-full object-cover transition-all duration-500"
            style={{
              opacity: transitioning ? 0 : imgLoaded ? 1 : 0,
              transform: transitioning ? "scale(1.05)" : "scale(1)",
            }}
          />
          {/* Предыдущее фото как fallback пока грузится */}
          <img
            src={STEFANI_IMAGE}
            alt=""
            className="absolute inset-0 w-full h-full object-cover -z-10"
            style={{ opacity: imgLoaded ? 0 : 1 }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 55%, rgba(5,10,20,0.85) 100%)" }} />
        </div>

        {/* Вращающиеся кольца */}
        <div className="absolute inset-0 -m-8 rounded-full border border-cyan-400/15 animate-spin" style={{ animationDuration: "14s" }} />
        <div className="absolute inset-0 -m-16 rounded-full border border-violet-400/08 animate-spin" style={{ animationDuration: "22s", animationDirection: "reverse" }} />

        {/* Бейдж реакции */}
        <div
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full whitespace-nowrap transition-all duration-500"
          style={{
            background: "rgba(5,10,20,0.92)",
            border: `1px solid ${currentReaction.color}60`,
            color: currentReaction.color,
            boxShadow: `0 0 12px ${currentReaction.color}30`,
          }}
        >
          <span className="text-sm" style={{ transition: "all 0.3s" }}>{currentReaction.emoji}</span>
          <span className="text-xs font-mono">{currentReaction.text}</span>
        </div>
      </div>

      <h1 className="font-orbitron font-black mb-3" style={{ fontSize: "clamp(3rem, 10vw, 5rem)", lineHeight: 1 }}>
        <span className="gradient-text">STEFANI</span>
      </h1>
      <div className="font-mono text-cyan-400/55 text-xs tracking-[0.35em] mb-5">
        УНИВЕРСАЛЬНАЯ · ЖИВАЯ · С ПАМЯТЬЮ
      </div>
      <p className="font-rajdhani text-lg text-white/65 max-w-lg leading-relaxed mb-2">
        {userName
          ? `${userName}, добро пожаловать. Stefani помнит тебя, умеет всё и говорит как живой человек.`
          : "Реальный ИИ с характером, голосом и эмоциями. Помнит разговоры. Ищет в интернете. Отвечает как живая."
        }
      </p>
      <p className="font-mono text-cyan-400/40 text-xs tracking-wider mb-10">
        ГОЛОС · ПАМЯТЬ · ПОИСК · БЕЗ ОГРАНИЧЕНИЙ
      </p>

      <button onClick={onStart}
        className="group relative px-12 py-4 rounded-2xl font-orbitron font-bold text-lg text-white transition-all hover:scale-105 active:scale-95 mb-6"
        style={{
          background: `linear-gradient(135deg, ${moodCfg.color}30, rgba(139,92,246,0.25))`,
          border: `1px solid ${moodCfg.color}80`,
          boxShadow: `0 0 35px ${moodCfg.glow}40`,
        }}>
        <span className="flex items-center gap-3">
          <Icon name="Zap" size={22} />
          {userName ? `Говорить с Stefani` : "Начать разговор"}
        </span>
      </button>

      {/* Mood selector */}
      <div className="flex gap-2 flex-wrap justify-center mb-2">
        {(Object.entries(MOOD_CONFIG) as [Mood, typeof MOOD_CONFIG.calm][]).map(([key, val]) => (
          <button key={key} onClick={() => setMood(key)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-rajdhani font-semibold transition-all hover:scale-105"
            style={{
              background: mood === key ? `${val.color}20` : "rgba(255,255,255,0.03)",
              border: `1px solid ${mood === key ? val.color : val.color + "28"}`,
              color: mood === key ? val.color : "rgba(255,255,255,0.32)",
              boxShadow: mood === key ? `0 0 12px ${val.glow}` : "none",
            }}>
            <span>{val.emoji}</span>
            <span>{val.label}</span>
          </button>
        ))}
      </div>
      <div className="text-xs font-mono text-white/20">Выбери настроение — аватар отреагирует</div>
    </section>
  );
}

// ─── Главный компонент ────────────────────────────────

export default function Index() {
  const [page, setPage]         = useState<"home" | "chat">("home");
  const [mood, setMood]         = useState<Mood>("calm");
  const [messages, setMessages] = useState<Message[]>([INIT_MESSAGE]);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>("neutral");
  const [input, setInput]       = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [glitching, setGlitching] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>(() => getUserName() || "");
  const [showNameModal, setShowNameModal] = useState<boolean>(() => !getUserName());
  const [sessionId]             = useState(() => getSessionId());
  const messagesEndRef          = useRef<HTMLDivElement>(null);

  const speech = useSpeech();
  const currentMood = MOOD_CONFIG[mood];

  const handleNameSave = (name: string) => {
    const trimmed = name.trim();
    localStorage.setItem("stefani_username", trimmed);
    setUserName(trimmed);
    setShowNameModal(false);
    // Приветственное сообщение с именем
    if (trimmed) {
      const greetings = [
        `${trimmed}... красивое имя. Ну что, поговорим?`,
        `О, ${trimmed}! Запомнила. Рада познакомиться 😊`,
        `${trimmed} — звучит хорошо. Я Stefani. Что хочешь обсудить?`,
        `Привет, ${trimmed}. Давно тебя ждала.`,
      ];
      const greeting = greetings[Math.floor(Math.random() * greetings.length)];
      setMessages([{
        role: "stefani",
        text: greeting,
        time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
        emotion: "happy",
      }]);
      setCurrentEmotion("happy");
    }
  };

  const mic = useMicrophone(
    (text) => { setInput(""); sendMessageWithText(text); },
    (interim) => setInput(interim)
  );

  // Загрузка истории при входе в чат
  useEffect(() => {
    if (page !== "chat" || historyLoaded) return;
    (async () => {
      try {
        const res = await fetch(`${HISTORY_API}?session_id=${sessionId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages.map((m: Message) => ({ ...m, emotion: m.emotion || "neutral" })));
          if (data.mood) setMood(data.mood as Mood);
          const last = data.messages.filter((m: Message) => m.role === "stefani").pop();
          if (last?.emotion) setCurrentEmotion(last.emotion as Emotion);
        }
      } catch { /* silent */ }
      setHistoryLoaded(true);
    })();
  }, [page, historyLoaded, sessionId]);

  // Сохранение истории при изменении сообщений
  const saveHistory = useCallback(async (msgs: Message[], currentMood: Mood) => {
    try {
      await fetch(HISTORY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, messages: msgs, mood: currentMood }),
      });
    } catch { /* silent */ }
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    const iv = setInterval(() => {
      setGlitching(true);
      setTimeout(() => setGlitching(false), 300);
    }, 12000);
    return () => clearInterval(iv);
  }, []);

  const sendMessageWithText = async (msg: string) => {
    if (!msg.trim() || isTyping) return;
    const time = new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
    const newMsgs: Message[] = [...messages, { role: "user", text: msg.trim(), time, emotion: "neutral" }];
    setMessages(newMsgs);
    setInput("");
    setIsTyping(true);
    setError(null);
    setCurrentEmotion("thinking");

    try {
      const res = await fetch(CHAT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs, mood, user_name: userName || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(`Ошибка соединения (${res.status}). Попробуй ещё раз.`); setCurrentEmotion("neutral"); return; }
      const emotion: Emotion = (data.emotion as Emotion) || "neutral";
      setCurrentEmotion(emotion);
      const replyMsg: Message = { role: "stefani", text: data.reply, time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }), emotion };
      const withReply: Message[] = [...newMsgs, replyMsg];
      setMessages(withReply);
      saveHistory(withReply, mood);
      if (speech.autoSpeak) { setSpeakingMsgIdx(withReply.length - 1); speech.speak(data.reply, emotion); }
    } catch {
      setError("Нет связи с сервером."); setCurrentEmotion("serious");
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = (text?: string) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput("");
    sendMessageWithText(msg);
  };

  const handleSpeak = (text: string, emotion: Emotion | undefined, idx: number) => {
    if (speakingMsgIdx === idx && speech.isSpeaking) {
      speech.stop();
      setSpeakingMsgIdx(null);
    } else {
      setSpeakingMsgIdx(idx);
      speech.speak(text, emotion);
    }
  };

  // Сбрасываем speakingMsgIdx когда речь завершилась
  useEffect(() => {
    if (!speech.isSpeaking) setSpeakingMsgIdx(null);
  }, [speech.isSpeaking]);

  const clearHistory = () => {
    localStorage.removeItem("stefani_session");
    window.location.reload();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const toggleMic = () => {
    if (mic.isListening) mic.stopListening();
    else { speech.stop(); mic.startListening(); }
  };

  const particles = Array.from({ length: 18 }, (_, i) => ({ left: `${(i / 18) * 100}%`, bottom: "0" }));

  // ─── CHAT PAGE ────────────────────────────────────────
  if (page === "chat") {
    return (
      <div className="bg-[#050a14] flex flex-col relative overflow-hidden" style={{ height: "100dvh" }}>
        {showNameModal && <NameModal onSave={handleNameSave} />}
        <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
        {particles.slice(0, 6).map((s, i) => <Particle key={i} style={s} />)}

        {/* HEADER */}
        <div
          className="relative z-10 px-4 py-3 flex items-center gap-3 flex-shrink-0"
          style={{ background: "rgba(5,10,20,0.92)", borderBottom: "1px solid rgba(6,182,212,0.15)", backdropFilter: "blur(20px)" }}
        >
          <button onClick={() => setPage("home")} className="text-cyan-400 hover:text-white transition-colors p-1 flex-shrink-0">
            <Icon name="ArrowLeft" size={20} />
          </button>

          {/* Аватар с живой эмоцией + волны при речи */}
          <StefaniAvatar
            emotion={isTyping ? "thinking" : currentEmotion}
            size={44}
            isTyping={isTyping}
            isSpeaking={speech.isSpeaking}
            moodColor={currentMood.color}
            moodGlow={currentMood.glow}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`font-orbitron font-bold text-white ${glitching ? "animate-glitch" : ""}`}
                style={{ fontSize: 14, letterSpacing: "0.1em" }}
              >
                STEFANI
              </span>
              <EmotionBar emotion={isTyping ? "thinking" : currentEmotion} />
              <Equalizer color={currentMood.color} playing={speech.isSpeaking} />
            </div>
            <div className="text-xs text-cyan-400/45 font-mono flex items-center gap-1.5">
              {speech.isSpeaking ? "говорит..." : isTyping ? "обрабатывает..." : "ОНЛАЙН"}
              {userName && (
                <span className="text-white/30">· для <span style={{ color: currentMood.color }}>{userName}</span></span>
              )}
            </div>
          </div>

          {/* Авто-озвучка + Mood + очистить */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Кнопка авто-озвучки */}
            {speech.isSupported && (
              <button
                onClick={() => { speech.setAutoSpeak(!speech.autoSpeak); if (speech.isSpeaking) speech.stop(); }}
                title={speech.autoSpeak ? "Выключить автоозвучку" : "Включить автоозвучку"}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110"
                style={{
                  background: speech.autoSpeak ? "rgba(6,182,212,0.25)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${speech.autoSpeak ? "rgba(6,182,212,0.7)" : "rgba(255,255,255,0.15)"}`,
                  color: speech.autoSpeak ? "#06b6d4" : "rgba(255,255,255,0.3)",
                  boxShadow: speech.autoSpeak ? "0 0 8px rgba(6,182,212,0.4)" : "none",
                }}
              >
                <Icon name={speech.autoSpeak ? "Volume2" : "VolumeX"} size={13} />
              </button>
            )}
            {(Object.entries(MOOD_CONFIG) as [Mood, typeof MOOD_CONFIG.calm][]).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setMood(key)}
                title={val.label}
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all hover:scale-110"
                style={{
                  background: mood === key ? `${val.color}33` : "transparent",
                  border: `1px solid ${mood === key ? val.color : val.color + "25"}`,
                  boxShadow: mood === key ? `0 0 8px ${val.glow}` : "none",
                }}
              >
                {val.emoji}
              </button>
            ))}
            <button
              onClick={() => setShowNameModal(true)}
              title={userName ? `Сменить имя (${userName})` : "Назвать себя"}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 ml-1"
              style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", color: "#06b6d4" }}
            >
              <Icon name="UserRound" size={13} />
            </button>
            <button
              onClick={clearHistory}
              title="Новый разговор"
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}
            >
              <Icon name="RotateCcw" size={13} />
            </button>
          </div>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 relative z-10">
          {messages.map((msg, i) => {
            const emotion = (msg.emotion as Emotion) || "neutral";
            const ec = EMOTION_CONFIG[emotion];
            return (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                style={{ animation: "message-in 0.3s ease-out forwards" }}
              >
                {msg.role === "stefani" && (
                  <StefaniAvatar
                    emotion={emotion}
                    size={36}
                    isSpeaking={speakingMsgIdx === i && speech.isSpeaking}
                    moodColor={currentMood.color}
                    moodGlow={currentMood.glow}
                  />
                )}
                <div className={`max-w-[78%] flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className="px-4 py-3 rounded-2xl text-sm font-rajdhani leading-relaxed whitespace-pre-wrap transition-all duration-300"
                    style={
                      msg.role === "stefani"
                        ? {
                            background: `linear-gradient(135deg, ${ec.pulse}12, ${ec.pulse}06)`,
                            border: `1px solid ${speakingMsgIdx === i && speech.isSpeaking ? ec.pulse + "70" : ec.pulse + "28"}`,
                            color: "#e2f8ff",
                            boxShadow: speakingMsgIdx === i && speech.isSpeaking
                              ? `0 0 20px ${ec.aura}, 0 2px 16px ${ec.aura}`
                              : `0 2px 16px ${ec.aura}`,
                          }
                        : {
                            background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(6,182,212,0.1))",
                            border: "1px solid rgba(139,92,246,0.3)",
                            color: "#fff",
                          }
                    }
                  >
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs text-white/20 font-mono">{msg.time}</span>
                    {msg.role === "stefani" && speech.isSupported && (
                      <SpeakButton
                        text={msg.text}
                        emotion={emotion}
                        color={ec.pulse}
                        onSpeak={(t, e) => handleSpeak(t, e as Emotion, i)}
                        onStop={() => { speech.stop(); setSpeakingMsgIdx(null); }}
                        isCurrentlySpeaking={speakingMsgIdx === i && speech.isSpeaking}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-3">
              <StefaniAvatar emotion="thinking" size={36} isTyping moodColor={currentMood.color} moodGlow={currentMood.glow} />
              <div
                className="px-4 py-3 rounded-2xl"
                style={{ background: `${currentMood.color}10`, border: `1px solid ${currentMood.color}20` }}
              >
                <div className="flex gap-1 items-center">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                      style={{ background: currentMood.color, animationDelay: `${i * 0.15}s` }} />
                  ))}
                  <span className="text-xs font-mono ml-2" style={{ color: currentMood.color, opacity: 0.7 }}>
                    Stefani думает...
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mx-auto max-w-sm px-4 py-3 rounded-xl text-sm font-rajdhani text-center"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
              {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* QUICK CHIPS */}
        <div className="px-4 pb-2 relative z-10 flex gap-2 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: "none" }}>
          {PRESET_QUESTIONS.map((q) => (
            <button key={q} onClick={() => sendMessage(q)} disabled={isTyping}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-rajdhani transition-all hover:scale-105 whitespace-nowrap disabled:opacity-40"
              style={{ background: `${currentMood.color}10`, border: `1px solid ${currentMood.color}28`, color: currentMood.color }}>
              {q}
            </button>
          ))}
        </div>

        {/* INPUT */}
        <div className="px-4 pb-5 pt-2 relative z-10 flex-shrink-0">
          <div className="flex gap-3 items-end rounded-2xl p-3"
            style={{
              background: "rgba(6,18,40,0.92)",
              border: `1px solid ${currentMood.color}38`,
              boxShadow: `0 0 20px ${currentMood.glow}10`,
            }}
          >
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder={mic.isListening ? "Слушаю... говори!" : "Спроси Stefani всё что угодно..."}
              rows={1} disabled={isTyping || mic.isListening}
              className="flex-1 bg-transparent text-white placeholder-white/20 resize-none outline-none font-rajdhani text-sm leading-relaxed disabled:opacity-50 transition-all"
              style={{ maxHeight: 120 }} />

            {/* Кнопка микрофона */}
            {mic.isSupported && (
              <button
                onClick={toggleMic}
                disabled={isTyping}
                title={mic.isListening ? "Остановить запись" : "Говорить"}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110 disabled:opacity-30 flex-shrink-0"
                style={{
                  background: mic.isListening
                    ? "linear-gradient(135deg, #ef4444, #f97316)"
                    : "rgba(255,255,255,0.06)",
                  border: mic.isListening ? "1px solid rgba(239,68,68,0.6)" : "1px solid rgba(255,255,255,0.1)",
                  boxShadow: mic.isListening ? "0 0 16px rgba(239,68,68,0.5)" : "none",
                  color: mic.isListening ? "#fff" : "rgba(255,255,255,0.4)",
                  animation: mic.isListening ? "pulse-glow 1s ease-in-out infinite" : "none",
                }}
              >
                <Icon name={mic.isListening ? "MicOff" : "Mic"} size={16} />
              </button>
            )}

            {/* Кнопка отправки */}
            <button onClick={() => handleSend()} disabled={!input.trim() || isTyping || mic.isListening}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110 disabled:opacity-30 flex-shrink-0"
              style={{
                background: input.trim() && !isTyping ? `linear-gradient(135deg, ${currentMood.color}, #8b5cf6)` : "rgba(255,255,255,0.07)",
                boxShadow: input.trim() && !isTyping ? `0 0 15px ${currentMood.glow}` : "none",
                color: input.trim() && !isTyping ? "#050a14" : "#fff",
              }}>
              <Icon name="Send" size={16} />
            </button>
          </div>

          {/* Статус микрофона */}
          {mic.isListening && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="flex gap-1 items-end h-4">
                {["eq-bar-1","eq-bar-2","eq-bar-3","eq-bar-4","eq-bar-5"].map((cls, i) => (
                  <div key={i} className={`${cls} rounded-sm`}
                    style={{ width: 3, height: "100%", background: "#ef4444", opacity: 0.8, transformOrigin: "bottom" }} />
                ))}
              </div>
              <span className="text-xs font-mono text-red-400">Говори — Stefani слушает...</span>
            </div>
          )}
          {mic.error && (
            <div className="text-center mt-1">
              <span className="text-xs font-mono text-red-400/70">{mic.error}</span>
            </div>
          )}
          {!mic.isListening && !mic.error && (
          <div className="text-center mt-1">
            <span className="text-xs font-mono text-white/12">Enter — отправить · 🎤 — голос</span>
          </div>
          )}
        </div>
      </div>
    );
  }

  // ─── HOME PAGE ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050a14] relative overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 70%)" }} />
      <div className="absolute bottom-0 right-0 w-[600px] h-[500px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(139,92,246,0.07) 0%, transparent 70%)" }} />
      {particles.map((s, i) => <Particle key={i} style={s} />)}

      {/* HEADER */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #06b6d4, #8b5cf6)", boxShadow: "0 0 18px rgba(6,182,212,0.5)" }}>
            <Icon name="Cpu" size={18} className="text-[#050a14]" />
          </div>
          <span className="font-orbitron font-bold text-white tracking-widest text-sm">
            STEFANI<span className="text-cyan-400">.AI</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full"
            style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.18)" }}>
            <Icon name="Brain" size={12} className="text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400">Искусственный интеллект</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-mono text-green-400">ОНЛАЙН</span>
          </div>
        </div>
      </header>

      {/* HERO */}
      <HeroSection mood={mood} setMood={setMood} onStart={() => setPage("chat")} userName={userName} />

      {/* CAPABILITIES */}
      <section className="relative z-10 px-6 pb-16">
        <div className="text-center mb-8">
          <div className="font-mono text-cyan-400/45 text-xs tracking-[0.4em] mb-2">ВОЗМОЖНОСТИ СИСТЕМЫ</div>
          <h2 className="font-orbitron font-bold text-white text-2xl">
            Умеет <span className="text-cyan-400 text-glow-cyan">всё</span>
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {CAPABILITIES.map((cap, i) => (
            <div key={cap.label}
              className="p-4 rounded-xl flex flex-col items-center text-center gap-2 cursor-default transition-all hover:scale-105 hover:-translate-y-1"
              style={{
                background: "rgba(6,15,35,0.7)",
                border: "1px solid rgba(6,182,212,0.1)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                animation: `fade-in-up 0.5s ease-out ${i * 0.07}s both`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(6,182,212,0.4)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 30px rgba(6,182,212,0.1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(6,182,212,0.1)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";
              }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.16), rgba(139,92,246,0.16))" }}>
                <Icon name={cap.icon as Parameters<typeof Icon>[0]["name"]} size={22} className="text-cyan-400" />
              </div>
              <div className="font-rajdhani font-bold text-white text-sm">{cap.label}</div>
              <div className="text-xs text-white/32 leading-snug">{cap.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="relative z-10 pb-14 px-6 text-center">
        <div className="max-w-lg mx-auto p-7 rounded-2xl"
          style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.07), rgba(139,92,246,0.07))", border: "1px solid rgba(6,182,212,0.18)" }}>
          <div className="font-orbitron text-white font-bold text-xl mb-2">Живая. С памятью. Настоящая.</div>
          <div className="font-rajdhani text-white/55 text-base mb-5">
            Stefani помнит каждый разговор и реагирует эмоционально — как человек.
          </div>
          <button onClick={() => setPage("chat")}
            className="px-10 py-3 rounded-xl font-orbitron font-bold text-sm transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #06b6d4, #8b5cf6)", color: "#050a14", boxShadow: "0 0 30px rgba(6,182,212,0.4)" }}>
            Поговорить с Stefani
          </button>
        </div>
        <div className="mt-10 font-mono text-white/12 text-xs tracking-widest">
          STEFANI v5.0 · ГОЛОС · ПАМЯТЬ · ЭМОЦИИ · {new Date().getFullYear()}
        </div>
      </section>
    </div>
  );
}