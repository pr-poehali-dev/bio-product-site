import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

const WOLF_API = "https://functions.poehali.dev/826782b1-c754-4d3c-830d-899a05683526";

type Mode = "beginner" | "intermediate" | "pro";
type MsgType = "chat" | "code" | "preview";
type Role = "user" | "wolf";

interface Message {
  id: number;
  role: Role;
  text: string;
  type: MsgType;
  code?: string;
  html?: string;
  title?: string;
  time: string;
}

const MODES: Record<Mode, { label: string; icon: string; color: string; accent: string; desc: string }> = {
  beginner:     { label: "Новичок",  icon: "Sprout",   color: "#22c55e", accent: "#16a34a", desc: "Просто и понятно" },
  intermediate: { label: "Обучение", icon: "BookOpen", color: "#f59e0b", accent: "#d97706", desc: "Учимся вместе"    },
  pro:          { label: "Профи",    icon: "Zap",      color: "#06b6d4", accent: "#0891b2", desc: "Без лишних слов"  },
};

const PRESETS: Record<Mode, string[]> = {
  beginner:     ["Создай простой сайт-визитку", "Что такое сайт?", "Сделай страницу приветствия", "Создай калькулятор"],
  intermediate: ["Создай лендинг для кофейни",  "Как работает Flexbox?", "Форма обратной связи", "Создай To-Do список"],
  pro:          ["React компонент с сортировкой", "Dashboard с графиками", "TypeScript utility types", "Оптимальная архитектура SPA"],
};

const WOLF_GREETINGS: Record<Mode, string> = {
  beginner:     "Привет! Я Волк — твой помощник в создании сайтов. Не важно, что ты никогда этим не занимался — объясню всё просто. С чего начнём?",
  intermediate: "Привет! Я Волк. Основы знаешь — отлично. Будем разбираться глубже: компоненты, паттерны, реальные проекты. Что строим?",
  pro:          "Волк. Режим PRO. React, TypeScript, Python, архитектура — всё в деле. Что нужно?",
};

function now() {
  return new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
}

function renderMarkdown(text: string): string {
  return text
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre class="wolf-pre"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="wolf-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

export default function Index() {
  const [mode, setMode]         = useState<Mode>("beginner");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [preview, setPreview]   = useState<{ html: string; title: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTab, setPreviewTab]   = useState<"site" | "code">("site");
  const endRef   = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const msgId    = useRef(0);

  useEffect(() => {
    setMessages([{
      id: ++msgId.current,
      role: "wolf",
      text: WOLF_GREETINGS[mode],
      type: "chat",
      time: now(),
    }]);
    setPreview(null);
    setShowPreview(false);
  }, [mode]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: ++msgId.current, role: "user", text: text.trim(), type: "chat", time: now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = [...messages, userMsg].slice(-16);
      const res = await fetch(WOLF_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          mode,
          message: text.trim(),
          messages: history.map(m => ({ role: m.role === "user" ? "user" : "assistant", text: m.text })),
        }),
      });
      const data = await res.json();
      const wolfMsg: Message = {
        id: ++msgId.current, role: "wolf",
        text: data.reply || "...",
        type: data.type || "chat",
        code: data.code, html: data.html, title: data.title,
        time: now(),
      };
      setMessages(prev => [...prev, wolfMsg]);
      if (data.type === "preview" && data.html) {
        setPreview({ html: data.html, title: data.title || "Превью" });
        setShowPreview(true);
        setPreviewTab("site");
      }
    } catch {
      setMessages(prev => [...prev, { id: ++msgId.current, role: "wolf", text: "Связь прервана. Попробуй ещё раз.", type: "chat", time: now() }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [loading, messages, mode]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const m = MODES[mode];

  return (
    <div className="h-screen flex flex-col bg-[#0c0c0f] text-white overflow-hidden">
      <style>{`
        .wolf-pre { background:#111114; border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:12px; margin:8px 0; overflow-x:auto; }
        .wolf-pre code { color:#a5f3c4; font-size:12px; font-family:monospace; white-space:pre; }
        .wolf-code { background:rgba(255,255,255,0.08); padding:1px 5px; border-radius:4px; font-size:12px; font-family:monospace; color:#fbbf24; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.12); border-radius:4px; }
      `}</style>

      {/* ── ШАПКА ── */}
      <header className="flex items-center gap-3 px-4 h-14 border-b border-white/8 flex-shrink-0 bg-[#0f0f13]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
            style={{ background: `linear-gradient(135deg,${m.color}30,${m.color}10)`, border: `1px solid ${m.color}40` }}>
            🐺
          </div>
          <div>
            <div className="font-bold text-sm leading-none">Клан Волка</div>
            <div className="text-xs leading-none mt-0.5" style={{ color: m.color }}>{m.desc}</div>
          </div>
        </div>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Режимы */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/8">
          {(Object.entries(MODES) as [Mode, typeof m][]).map(([key, md]) => (
            <button key={key} onClick={() => setMode(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={mode === key
                ? { background: `${md.color}20`, color: md.color, border: `1px solid ${md.color}40` }
                : { color: "rgba(255,255,255,0.3)", border: "1px solid transparent" }}>
              <Icon name={md.icon as Parameters<typeof Icon>[0]["name"]} size={11} />
              {md.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {preview && (
          <button onClick={() => setShowPreview(p => !p)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
            style={showPreview
              ? { background: `${m.color}20`, color: m.color, border: `1px solid ${m.color}40` }
              : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <Icon name="Monitor" size={13} />
            {showPreview ? "Скрыть" : "Превью"}
          </button>
        )}
      </header>

      {/* ── ТЕЛО ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── ЧАТ ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* Сообщения */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className="flex-shrink-0 mt-0.5">
                  {msg.role === "wolf" ? (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                      style={{ background: `${m.color}20`, border: `1px solid ${m.color}40` }}>
                      🐺
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
                      Ты
                    </div>
                  )}
                </div>
                <div className={`flex flex-col gap-1 max-w-[78%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                    style={msg.role === "wolf"
                      ? { background: "#15151a", border: "1px solid rgba(255,255,255,0.08)" }
                      : { background: `${m.color}15`, border: `1px solid ${m.color}30` }}>
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                    {msg.type === "preview" && msg.html && (
                      <button
                        onClick={() => { setPreview({ html: msg.html!, title: msg.title || "Превью" }); setShowPreview(true); setPreviewTab("site"); }}
                        className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                        style={{ background: `${m.color}20`, color: m.color, border: `1px solid ${m.color}40` }}>
                        <Icon name="Eye" size={12} />
                        Открыть превью
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-white/20 px-1">{msg.time}</span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: `${m.color}20`, border: `1px solid ${m.color}40` }}>
                  🐺
                </div>
                <div className="px-4 py-3 rounded-2xl flex gap-1.5"
                  style={{ background: "#15151a", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: m.color, animationDelay: `${i*0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Быстрые подсказки */}
          <div className="px-4 pb-2 flex gap-2 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: "none" }}>
            {PRESETS[mode].map(q => (
              <button key={q} onClick={() => send(q)} disabled={loading}
                className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-all hover:opacity-80 disabled:opacity-30"
                style={{ background: `${m.color}12`, border: `1px solid ${m.color}28`, color: m.color }}>
                {q}
              </button>
            ))}
          </div>

          {/* Ввод */}
          <div className="px-4 pb-5 pt-1 flex-shrink-0">
            <div className="flex gap-2 items-end p-3 rounded-2xl"
              style={{ background: "#15151a", border: `1px solid rgba(255,255,255,0.1)` }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={handleKey}
                placeholder={
                  mode === "pro" ? "Команда, вопрос или задача..." :
                  mode === "beginner" ? "Напиши что хочешь создать или спроси что угодно..." :
                  "Опиши задачу или задай вопрос..."
                }
                rows={1}
                disabled={loading}
                className="flex-1 bg-transparent resize-none text-sm text-white placeholder:text-white/25 focus:outline-none leading-relaxed"
                style={{ maxHeight: 120 }}
              />
              <button onClick={() => send(input)} disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                style={input.trim() && !loading
                  ? { background: `linear-gradient(135deg,${m.color},${m.accent})`, color: "#0c0c0f" }
                  : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)" }}>
                {loading
                  ? <Icon name="Loader2" size={15} className="animate-spin" />
                  : <Icon name="ArrowUp" size={15} />}
              </button>
            </div>
            <p className="text-center text-white/15 text-xs mt-1.5">Enter — отправить · Shift+Enter — новая строка</p>
          </div>
        </div>

        {/* ── ПАНЕЛЬ ПРЕВЬЮ ── */}
        {showPreview && preview && (
          <div className="flex flex-col border-l border-white/8 bg-[#0f0f13] flex-shrink-0"
            style={{ width: "clamp(300px, 44vw, 660px)" }}>

            {/* Шапка панели */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/8 flex-shrink-0">
              <div className="flex gap-1.5 flex-shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              </div>
              <span className="text-xs text-white/35 font-mono flex-1 text-center truncate">{preview.title}</span>
              <button onClick={() => setShowPreview(false)} className="text-white/25 hover:text-white/60 transition-colors flex-shrink-0">
                <Icon name="X" size={13} />
              </button>
            </div>

            {/* Вкладки */}
            <div className="flex border-b border-white/8 flex-shrink-0">
              {(["site","code"] as const).map(t => (
                <button key={t} onClick={() => setPreviewTab(t)}
                  className="flex-1 py-2 text-xs font-medium transition-colors"
                  style={{ color: previewTab === t ? m.color : "rgba(255,255,255,0.35)", borderBottom: previewTab === t ? `2px solid ${m.color}` : "2px solid transparent" }}>
                  {t === "site" ? "🖥 Сайт" : "< /> Код"}
                </button>
              ))}
            </div>

            {/* Контент вкладок */}
            {previewTab === "site" ? (
              <iframe
                srcDoc={preview.html}
                sandbox="allow-scripts allow-same-origin"
                className="flex-1 w-full border-0"
                title={preview.title}
              />
            ) : (
              <div className="flex-1 overflow-auto p-4 bg-[#0a0a0d]">
                <pre className="text-xs text-green-400 font-mono leading-relaxed whitespace-pre-wrap break-all">
                  {preview.html}
                </pre>
              </div>
            )}

            {/* Кнопки */}
            <div className="flex gap-2 p-3 border-t border-white/8 flex-shrink-0">
              <button
                onClick={() => {
                  const blob = new Blob([preview.html], { type: "text/html" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `${preview.title.replace(/\s+/g,"-").toLowerCase()}.html`;
                  a.click();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                style={{ background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}35` }}>
                <Icon name="Download" size={12} />
                Скачать .html
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(preview.html)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Icon name="Copy" size={12} />
                Копировать
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
