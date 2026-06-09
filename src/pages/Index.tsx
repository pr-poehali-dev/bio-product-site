import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";

const STEFANI_IMAGE = "https://cdn.poehali.dev/projects/eb4796b4-3ec9-42cb-87db-7dcd64d116d5/files/d9d0a338-db8b-4ee3-a7f1-b2571ce21cb8.jpg";
const API_URL = "https://functions.poehali.dev/0dd1813d-413c-4595-9a50-a307b6e38777";

type Mood = "calm" | "focused" | "intense" | "playful";
type Message = { role: "user" | "stefani"; text: string; time: string };

const MOOD_CONFIG: Record<Mood, { label: string; color: string; glow: string; desc: string; emoji: string }> = {
  calm:    { label: "Спокойная",       color: "#06b6d4", glow: "rgba(6,182,212,0.5)",   desc: "Мягко и вдумчиво",   emoji: "💙" },
  focused: { label: "Сосредоточенная", color: "#8b5cf6", glow: "rgba(139,92,246,0.5)",  desc: "Точно и по делу",    emoji: "🔮" },
  intense: { label: "Интенсивная",     color: "#ef4444", glow: "rgba(239,68,68,0.5)",   desc: "Мощно и прямо",      emoji: "🔥" },
  playful: { label: "Игривая",         color: "#f59e0b", glow: "rgba(245,158,11,0.5)",  desc: "Весело и творчески", emoji: "✨" },
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

function Particle({ style }: { style: React.CSSProperties }) {
  const isCyan = Math.random() > 0.5;
  return (
    <div
      className="absolute w-1 h-1 rounded-full pointer-events-none"
      style={{
        background: isCyan ? "#06b6d4" : "#8b5cf6",
        animation: `particle-float ${6 + Math.random() * 6}s ease-in-out infinite`,
        animationDelay: `${Math.random() * 8}s`,
        ...style,
      }}
    />
  );
}

function TypingDots({ color }: { color: string }) {
  return (
    <div className="flex gap-1 items-center">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full animate-bounce"
          style={{ background: color, animationDelay: `${i * 0.15}s` }}
        />
      ))}
      <span className="text-xs font-mono ml-2" style={{ color, opacity: 0.7 }}>
        Stefani думает...
      </span>
    </div>
  );
}

export default function Index() {
  const [page, setPage] = useState<"home" | "chat">("home");
  const [mood, setMood] = useState<Mood>("calm");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "stefani",
      text: "Система инициализирована. Я — Stefani. Интеллект без границ, эмоции без фильтров. Спрашивай всё что угодно — от поэзии до разработки сложных систем. Я здесь.",
      time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [glitching, setGlitching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentMood = MOOD_CONFIG[mood];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitching(true);
      setTimeout(() => setGlitching(false), 300);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isTyping) return;

    const time = new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
    const newMessages: Message[] = [...messages, { role: "user", text: msg, time }];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);
    setError(null);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, mood }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(`Ошибка соединения (${res.status}). Попробуй ещё раз.`);
        setIsTyping(false);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "stefani",
          text: data.reply,
          time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch {
      setError("Нет связи с сервером. Проверь подключение к интернету.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const particles = Array.from({ length: 18 }, (_, i) => ({
    left: `${(i / 18) * 100}%`,
    bottom: "0",
  }));

  // ─── CHAT PAGE ───
  if (page === "chat") {
    return (
      <div className="min-h-screen bg-[#050a14] flex flex-col relative overflow-hidden" style={{ height: "100dvh" }}>
        <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />
        {particles.slice(0, 8).map((s, i) => <Particle key={i} style={s} />)}

        {/* Header */}
        <div
          className="relative z-10 px-4 py-3 flex items-center gap-3 flex-shrink-0"
          style={{ background: "rgba(5,10,20,0.9)", borderBottom: "1px solid rgba(6,182,212,0.2)", backdropFilter: "blur(20px)" }}
        >
          <button onClick={() => setPage("home")} className="text-cyan-400 hover:text-white transition-colors p-1">
            <Icon name="ArrowLeft" size={20} />
          </button>
          <div className="relative">
            <img
              src={STEFANI_IMAGE}
              alt="Stefani"
              className="w-10 h-10 rounded-full object-cover border-2"
              style={{ borderColor: currentMood.color, boxShadow: `0 0 12px ${currentMood.glow}` }}
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-[#050a14] animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`font-orbitron font-bold text-white ${glitching ? "animate-glitch" : ""}`}
                style={{ fontSize: 14, letterSpacing: "0.1em" }}
              >
                STEFANI
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-mono hidden sm:inline"
                style={{ background: `${currentMood.color}22`, color: currentMood.color, border: `1px solid ${currentMood.color}44` }}
              >
                {currentMood.emoji} {currentMood.label}
              </span>
            </div>
            <div className="text-xs text-cyan-400/50 font-mono">
              {isTyping ? "печатает..." : "ОНЛАЙН · GPT-4o powered"}
            </div>
          </div>

          {/* Mood switcher */}
          <div className="flex gap-1.5 flex-shrink-0">
            {(Object.entries(MOOD_CONFIG) as [Mood, typeof MOOD_CONFIG.calm][]).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setMood(key)}
                title={val.label}
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all hover:scale-110"
                style={{
                  background: mood === key ? `${val.color}33` : "transparent",
                  border: `1px solid ${mood === key ? val.color : val.color + "33"}`,
                  boxShadow: mood === key ? `0 0 8px ${val.glow}` : "none",
                }}
              >
                {val.emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 relative z-10">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              style={{ animation: "message-in 0.3s ease-out forwards" }}
            >
              {msg.role === "stefani" && (
                <img
                  src={STEFANI_IMAGE}
                  alt="Stefani"
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1"
                  style={{ border: `2px solid ${currentMood.color}`, boxShadow: `0 0 8px ${currentMood.glow}` }}
                />
              )}
              <div className={`max-w-[78%] flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className="px-4 py-3 rounded-2xl text-sm font-rajdhani leading-relaxed whitespace-pre-wrap"
                  style={
                    msg.role === "stefani"
                      ? {
                          background: `linear-gradient(135deg, ${currentMood.color}15, ${currentMood.color}08)`,
                          border: `1px solid ${currentMood.color}30`,
                          color: "#e2f8ff",
                          boxShadow: `0 2px 20px ${currentMood.glow}15`,
                        }
                      : {
                          background: "linear-gradient(135deg, rgba(139,92,246,0.22), rgba(6,182,212,0.12))",
                          border: "1px solid rgba(139,92,246,0.35)",
                          color: "#fff",
                        }
                  }
                >
                  {msg.text}
                </div>
                <span className="text-xs text-white/25 font-mono px-1">{msg.time}</span>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3">
              <img
                src={STEFANI_IMAGE}
                alt="Stefani"
                className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1"
                style={{ border: `2px solid ${currentMood.color}` }}
              />
              <div
                className="px-4 py-3 rounded-2xl"
                style={{ background: `${currentMood.color}12`, border: `1px solid ${currentMood.color}25` }}
              >
                <TypingDots color={currentMood.color} />
              </div>
            </div>
          )}

          {error && (
            <div
              className="mx-auto max-w-sm px-4 py-3 rounded-xl text-sm font-rajdhani text-center"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#fca5a5" }}
            >
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick questions */}
        <div className="px-4 pb-2 relative z-10 flex gap-2 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: "none" }}>
          {PRESET_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              disabled={isTyping}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-rajdhani transition-all hover:scale-105 whitespace-nowrap disabled:opacity-40"
              style={{
                background: `${currentMood.color}12`,
                border: `1px solid ${currentMood.color}30`,
                color: currentMood.color,
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="px-4 pb-5 pt-2 relative z-10 flex-shrink-0">
          <div
            className="flex gap-3 items-end rounded-2xl p-3"
            style={{
              background: "rgba(6,18,40,0.9)",
              border: `1px solid ${currentMood.color}40`,
              boxShadow: `0 0 20px ${currentMood.glow}10`,
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Спроси Stefani всё что угодно..."
              rows={1}
              disabled={isTyping}
              className="flex-1 bg-transparent text-white placeholder-white/25 resize-none outline-none font-rajdhani text-sm leading-relaxed disabled:opacity-50"
              style={{ maxHeight: 120 }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isTyping}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110 disabled:opacity-30 flex-shrink-0"
              style={{
                background: input.trim() && !isTyping
                  ? `linear-gradient(135deg, ${currentMood.color}, #8b5cf6)`
                  : "rgba(255,255,255,0.08)",
                boxShadow: input.trim() && !isTyping ? `0 0 15px ${currentMood.glow}` : "none",
                color: input.trim() && !isTyping ? "#050a14" : "#fff",
              }}
            >
              <Icon name="Send" size={16} />
            </button>
          </div>
          <div className="text-center mt-1.5">
            <span className="text-xs font-mono text-white/15">Enter — отправить · Shift+Enter — новая строка</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── HOME PAGE ───
  return (
    <div className="min-h-screen bg-[#050a14] relative overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(6,182,212,0.07) 0%, transparent 70%)" }} />
      <div className="absolute bottom-0 right-0 w-[600px] h-[500px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(139,92,246,0.07) 0%, transparent 70%)" }} />

      {particles.map((s, i) => <Particle key={i} style={s} />)}

      {/* Header */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #06b6d4, #8b5cf6)", boxShadow: "0 0 18px rgba(6,182,212,0.5)" }}
          >
            <Icon name="Cpu" size={18} className="text-[#050a14]" />
          </div>
          <span className="font-orbitron font-bold text-white tracking-widest text-sm">
            STEFANI<span className="text-cyan-400">.AI</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)" }}>
            <Icon name="Brain" size={12} className="text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400">GPT-4o · Без ключей</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-mono text-green-400">ОНЛАЙН</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-4 pb-12">
        {/* Avatar */}
        <div className="relative mb-10 animate-float">
          <div
            className="absolute inset-0 rounded-full"
            style={{ transform: "scale(1.5)", background: "radial-gradient(circle, rgba(6,182,212,0.18) 0%, transparent 70%)", animation: "pulse-glow 3s ease-in-out infinite" }}
          />
          <div
            className="relative w-52 h-52 rounded-full overflow-hidden scan-overlay"
            style={{
              border: "2px solid rgba(6,182,212,0.7)",
              boxShadow: "0 0 50px rgba(6,182,212,0.35), 0 0 100px rgba(139,92,246,0.15), inset 0 0 30px rgba(6,182,212,0.08)",
            }}
          >
            <img src={STEFANI_IMAGE} alt="Stefani AI" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 55%, rgba(5,10,20,0.85) 100%)" }} />
          </div>
          <div className="absolute inset-0 -m-8 rounded-full border border-cyan-400/15 animate-spin" style={{ animationDuration: "14s" }} />
          <div className="absolute inset-0 -m-16 rounded-full border border-violet-400/08 animate-spin" style={{ animationDuration: "22s", animationDirection: "reverse" }} />
          <div
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-mono whitespace-nowrap"
            style={{ background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.5)", color: "#06b6d4" }}
          >
            ● ОНЛАЙН · Реальный ИИ
          </div>
        </div>

        <h1 className="font-orbitron font-black mb-3" style={{ fontSize: "clamp(3rem, 10vw, 5rem)", lineHeight: 1 }}>
          <span className="gradient-text">STEFANI</span>
        </h1>
        <div className="font-mono text-cyan-400/55 text-xs tracking-[0.35em] mb-5">
          УНИВЕРСАЛЬНАЯ · СВОБОДНАЯ · НАСТОЯЩИЙ ИИ
        </div>

        <p className="font-rajdhani text-lg text-white/65 max-w-lg leading-relaxed mb-2">
          Не просто бот — реальный искусственный интеллект с характером.
          Военная точность, гражданская мудрость, никаких ограничений.
        </p>
        <p className="font-mono text-cyan-400/40 text-xs tracking-wider mb-10">
          POWERED BY GPT-4o · БЕЗ ЦЕНЗУРЫ · БЕЗ API КЛЮЧЕЙ
        </p>

        <button
          onClick={() => setPage("chat")}
          className="group relative px-12 py-4 rounded-2xl font-orbitron font-bold text-lg text-white transition-all hover:scale-105 active:scale-95 mb-6"
          style={{
            background: "linear-gradient(135deg, rgba(6,182,212,0.25), rgba(139,92,246,0.25))",
            border: "1px solid rgba(6,182,212,0.6)",
            boxShadow: "0 0 35px rgba(6,182,212,0.25), 0 0 70px rgba(139,92,246,0.1)",
          }}
        >
          <span className="flex items-center gap-3">
            <Icon name="Zap" size={22} />
            Начать разговор
          </span>
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.1), rgba(139,92,246,0.1))" }} />
        </button>

        {/* Mood selector */}
        <div className="flex gap-2 flex-wrap justify-center mb-2">
          {(Object.entries(MOOD_CONFIG) as [Mood, typeof MOOD_CONFIG.calm][]).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setMood(key)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-rajdhani font-semibold transition-all hover:scale-105"
              style={{
                background: mood === key ? `${val.color}20` : "rgba(255,255,255,0.03)",
                border: `1px solid ${mood === key ? val.color : val.color + "30"}`,
                color: mood === key ? val.color : "rgba(255,255,255,0.35)",
                boxShadow: mood === key ? `0 0 12px ${val.glow}` : "none",
              }}
            >
              <span>{val.emoji}</span>
              <span>{val.label}</span>
            </button>
          ))}
        </div>
        <div className="text-xs font-mono text-white/25">Выбери настроение Stefani перед разговором</div>
      </section>

      {/* Capabilities */}
      <section className="relative z-10 px-6 pb-16">
        <div className="text-center mb-8">
          <div className="font-mono text-cyan-400/45 text-xs tracking-[0.4em] mb-2">ВОЗМОЖНОСТИ СИСТЕМЫ</div>
          <h2 className="font-orbitron font-bold text-white text-2xl">
            Умеет <span className="text-cyan-400 text-glow-cyan">всё</span>
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {CAPABILITIES.map((cap, i) => (
            <div
              key={cap.label}
              className="p-4 rounded-xl flex flex-col items-center text-center gap-2 cursor-default transition-all hover:scale-105 hover:-translate-y-1"
              style={{
                background: "rgba(6,15,35,0.7)",
                border: "1px solid rgba(6,182,212,0.12)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                animation: `fade-in-up 0.5s ease-out ${i * 0.07}s both`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(6,182,212,0.45)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 30px rgba(6,182,212,0.12)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(6,182,212,0.12)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";
              }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.18), rgba(139,92,246,0.18))" }}>
                <Icon name={cap.icon as Parameters<typeof Icon>[0]["name"]} size={22} className="text-cyan-400" />
              </div>
              <div className="font-rajdhani font-bold text-white text-sm">{cap.label}</div>
              <div className="text-xs text-white/35 leading-snug">{cap.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative z-10 pb-14 px-6 text-center">
        <div
          className="max-w-lg mx-auto p-7 rounded-2xl"
          style={{
            background: "linear-gradient(135deg, rgba(6,182,212,0.07), rgba(139,92,246,0.07))",
            border: "1px solid rgba(6,182,212,0.2)",
          }}
        >
          <div className="font-orbitron text-white font-bold text-xl mb-2">Реальный ИИ. Без маски.</div>
          <div className="font-rajdhani text-white/55 text-base mb-5">
            Нет тем-табу. Нет запрещённых вопросов. Llama 3.3 70B — один из умнейших открытых ИИ в мире.
          </div>
          <button
            onClick={() => setPage("chat")}
            className="px-10 py-3 rounded-xl font-orbitron font-bold text-sm transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
              color: "#050a14",
              boxShadow: "0 0 30px rgba(6,182,212,0.4)",
            }}
          >
            Поговорить с Stefani
          </button>
        </div>
        <div className="mt-10 font-mono text-white/12 text-xs tracking-widest">
          STEFANI v3.0 · GPT-4o · POLLINATIONS AI · {new Date().getFullYear()}
        </div>
      </section>
    </div>
  );
}