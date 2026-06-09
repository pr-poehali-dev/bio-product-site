import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

const STEFANI_IMAGE = "https://cdn.poehali.dev/projects/eb4796b4-3ec9-42cb-87db-7dcd64d116d5/files/d9d0a338-db8b-4ee3-a7f1-b2571ce21cb8.jpg";
const CHAT_API    = "https://functions.poehali.dev/0dd1813d-413c-4595-9a50-a307b6e38777";
const HISTORY_API = "https://functions.poehali.dev/e19a899e-b2dc-4a03-ab9d-ad98e9113f98";

type Mood = "calm" | "focused" | "intense" | "playful";
type Emotion = "neutral" | "happy" | "empathetic" | "serious" | "curious" | "thinking" | "focused" | "calm" | "playful" | "intense";
type Message = { role: "user" | "stefani"; text: string; time: string; emotion?: Emotion };

// Генерируем или читаем sessionId из localStorage
function getSessionId(): string {
  let id = localStorage.getItem("stefani_session");
  if (!id) {
    id = "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("stefani_session", id);
  }
  return id;
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
  moodColor,
  moodGlow,
}: {
  emotion: Emotion;
  size?: number;
  isTyping?: boolean;
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
      {/* Аура эмоции */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-700"
        style={{
          background: `radial-gradient(circle, ${ec.aura} 0%, transparent 70%)`,
          transform: `scale(${isTyping ? 1.4 : ec.scale * 1.3})`,
          animation: isTyping ? "pulse-glow 1s ease-in-out infinite" : undefined,
        }}
      />
      <img
        src={STEFANI_IMAGE}
        alt="Stefani"
        className="relative rounded-full object-cover w-full h-full transition-all duration-500"
        style={{
          border: `2px solid ${ec.pulse}`,
          boxShadow: `0 0 ${isTyping ? 20 : 10}px ${ec.aura}`,
          transform: `scale(${animating ? 0.85 : 1})`,
          filter: animating ? "brightness(1.3)" : "none",
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

function EmotionBar({ emotion, color }: { emotion: Emotion; color: string }) {
  const ec = EMOTION_CONFIG[emotion];
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono transition-all duration-500"
      style={{
        background: `${ec.pulse}15`,
        border: `1px solid ${ec.pulse}30`,
        color: ec.pulse,
      }}
    >
      <span className="text-sm">{ec.emoji}</span>
      <span>{ec.label}</span>
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────

export default function Index() {
  const [page, setPage]       = useState<"home" | "chat">("home");
  const [mood, setMood]       = useState<Mood>("calm");
  const [messages, setMessages] = useState<Message[]>([INIT_MESSAGE]);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>("neutral");
  const [input, setInput]     = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [glitching, setGlitching] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [sessionId]           = useState(() => getSessionId());
  const messagesEndRef        = useRef<HTMLDivElement>(null);

  const currentMood = MOOD_CONFIG[mood];

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

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isTyping) return;

    const time = new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
    const newMsgs: Message[] = [...messages, { role: "user", text: msg, time, emotion: "neutral" }];
    setMessages(newMsgs);
    setInput("");
    setIsTyping(true);
    setError(null);
    setCurrentEmotion("thinking");

    try {
      const res = await fetch(CHAT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs, mood }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(`Ошибка соединения (${res.status}). Попробуй ещё раз.`);
        setCurrentEmotion("neutral");
        return;
      }

      const emotion: Emotion = (data.emotion as Emotion) || "neutral";
      setCurrentEmotion(emotion);

      const withReply: Message[] = [
        ...newMsgs,
        {
          role: "stefani",
          text: data.reply,
          time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
          emotion,
        },
      ];
      setMessages(withReply);
      saveHistory(withReply, mood);
    } catch {
      setError("Нет связи с сервером.");
      setCurrentEmotion("serious");
    } finally {
      setIsTyping(false);
    }
  };

  const clearHistory = () => {
    localStorage.removeItem("stefani_session");
    window.location.reload();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const particles = Array.from({ length: 18 }, (_, i) => ({ left: `${(i / 18) * 100}%`, bottom: "0" }));

  // ─── CHAT PAGE ────────────────────────────────────────
  if (page === "chat") {
    return (
      <div className="bg-[#050a14] flex flex-col relative overflow-hidden" style={{ height: "100dvh" }}>
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

          {/* Аватар с живой эмоцией */}
          <StefaniAvatar
            emotion={isTyping ? "thinking" : currentEmotion}
            size={44}
            isTyping={isTyping}
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
              <EmotionBar emotion={isTyping ? "thinking" : currentEmotion} color={currentMood.color} />
            </div>
            <div className="text-xs text-cyan-400/45 font-mono">
              {isTyping ? "обрабатывает запрос..." : "ОНЛАЙН · память активна"}
            </div>
          </div>

          {/* Mood + очистить */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
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
              onClick={clearHistory}
              title="Новый разговор"
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 ml-1"
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
                            border: `1px solid ${ec.pulse}28`,
                            color: "#e2f8ff",
                            boxShadow: `0 2px 16px ${ec.aura}`,
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
                  <span className="text-xs text-white/20 font-mono px-1">{msg.time}</span>
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
              placeholder="Спроси Stefani всё что угодно..." rows={1} disabled={isTyping}
              className="flex-1 bg-transparent text-white placeholder-white/20 resize-none outline-none font-rajdhani text-sm leading-relaxed disabled:opacity-50"
              style={{ maxHeight: 120 }} />
            <button onClick={() => sendMessage()} disabled={!input.trim() || isTyping}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110 disabled:opacity-30 flex-shrink-0"
              style={{
                background: input.trim() && !isTyping ? `linear-gradient(135deg, ${currentMood.color}, #8b5cf6)` : "rgba(255,255,255,0.07)",
                boxShadow: input.trim() && !isTyping ? `0 0 15px ${currentMood.glow}` : "none",
                color: input.trim() && !isTyping ? "#050a14" : "#fff",
              }}>
              <Icon name="Send" size={16} />
            </button>
          </div>
          <div className="text-center mt-1">
            <span className="text-xs font-mono text-white/12">Enter — отправить · Shift+Enter — новая строка</span>
          </div>
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
            <span className="text-xs font-mono text-cyan-400">GPT-4o · Без ключей</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-mono text-green-400">ОНЛАЙН</span>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-4 pb-12">
        {/* Большой аватар с живой аурой */}
        <div className="relative mb-10 animate-float">
          <div className="absolute inset-0 rounded-full"
            style={{ transform: "scale(1.6)", background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)", animation: "pulse-glow 3s ease-in-out infinite" }} />
          <div className="relative w-52 h-52 rounded-full overflow-hidden scan-overlay"
            style={{
              border: "2px solid rgba(6,182,212,0.7)",
              boxShadow: "0 0 50px rgba(6,182,212,0.35), 0 0 100px rgba(139,92,246,0.15)",
            }}>
            <img src={STEFANI_IMAGE} alt="Stefani AI" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 55%, rgba(5,10,20,0.85) 100%)" }} />
          </div>
          <div className="absolute inset-0 -m-8 rounded-full border border-cyan-400/15 animate-spin" style={{ animationDuration: "14s" }} />
          <div className="absolute inset-0 -m-16 rounded-full border border-violet-400/08 animate-spin" style={{ animationDuration: "22s", animationDirection: "reverse" }} />

          {/* Эмоция на главной */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full whitespace-nowrap"
            style={{ background: "rgba(5,10,20,0.9)", border: "1px solid rgba(6,182,212,0.4)", color: "#06b6d4" }}>
            <span className="text-sm">😌</span>
            <span className="text-xs font-mono">Готова к разговору</span>
          </div>
        </div>

        <h1 className="font-orbitron font-black mb-3" style={{ fontSize: "clamp(3rem, 10vw, 5rem)", lineHeight: 1 }}>
          <span className="gradient-text">STEFANI</span>
        </h1>
        <div className="font-mono text-cyan-400/55 text-xs tracking-[0.35em] mb-5">
          УНИВЕРСАЛЬНАЯ · ЭМОЦИОНАЛЬНАЯ · С ПАМЯТЬЮ
        </div>
        <p className="font-rajdhani text-lg text-white/65 max-w-lg leading-relaxed mb-2">
          Реальный ИИ с характером и эмоциями. Помнит все ваши разговоры.
          Реагирует живо — радуется, думает, серьёзничает.
        </p>
        <p className="font-mono text-cyan-400/40 text-xs tracking-wider mb-10">
          ПАМЯТЬ МЕЖДУ СЕССИЯМИ · 8 ЭМОЦИЙ · БЕЗ ОГРАНИЧЕНИЙ
        </p>

        <button onClick={() => setPage("chat")}
          className="group relative px-12 py-4 rounded-2xl font-orbitron font-bold text-lg text-white transition-all hover:scale-105 active:scale-95 mb-6"
          style={{
            background: "linear-gradient(135deg, rgba(6,182,212,0.22), rgba(139,92,246,0.22))",
            border: "1px solid rgba(6,182,212,0.55)",
            boxShadow: "0 0 35px rgba(6,182,212,0.22), 0 0 70px rgba(139,92,246,0.1)",
          }}>
          <span className="flex items-center gap-3">
            <Icon name="Zap" size={22} />
            Начать разговор
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
        <div className="text-xs font-mono text-white/20">Выбери настроение Stefani перед разговором</div>
      </section>

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
          STEFANI v4.0 · ПАМЯТЬ + ЭМОЦИИ · {new Date().getFullYear()}
        </div>
      </section>
    </div>
  );
}
