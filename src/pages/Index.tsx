import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

const WOLF_API = "https://functions.poehali.dev/826782b1-c754-4d3c-830d-899a05683526";

type Mode    = "beginner" | "intermediate" | "pro";
type MsgType = "chat" | "code" | "preview" | "no_key";

interface Msg {
  id: number;
  role: "user" | "wolf";
  text: string;
  type: MsgType;
  html?: string;
  code?: string;
  time: string;
}

const MODES: Record<Mode, { label: string; icon: string; color: string; hint: string }> = {
  beginner:     { label: "Новичок",  icon: "Sprout",   color: "#22c55e", hint: "Просто и понятно" },
  intermediate: { label: "Обучение", icon: "BookOpen", color: "#f59e0b", hint: "С объяснениями"   },
  pro:          { label: "Профи",    icon: "Zap",      color: "#06b6d4", hint: "Быстро и точно"   },
};

const EXAMPLES: Record<Mode, { text: string; icon: string }[]> = {
  beginner: [
    { icon: "Globe",       text: "Создай сайт-визитку для фотографа" },
    { icon: "ShoppingBag", text: "Сделай лендинг для доставки еды"   },
    { icon: "Calculator",  text: "Создай калькулятор ипотеки"         },
    { icon: "BookOpen",    text: "Сделай страницу резюме"             },
  ],
  intermediate: [
    { icon: "LayoutDashboard", text: "Создай dashboard с графиками продаж" },
    { icon: "ShoppingCart",    text: "Лендинг интернет-магазина одежды"    },
    { icon: "Calendar",        text: "Создай приложение-планировщик задач"  },
    { icon: "Palette",         text: "Портфолио дизайнера с анимациями"    },
  ],
  pro: [
    { icon: "Code2",       text: "React компонент таблицы с сортировкой и фильтрами" },
    { icon: "Database",    text: "REST API на Python FastAPI с авторизацией"          },
    { icon: "Cpu",         text: "Хук useDebounce + useLocalStorage на TypeScript"    },
    { icon: "BarChart2",   text: "Realtime dashboard с WebSocket и Chart.js"          },
  ],
};

const GREETINGS: Record<Mode, { title: string; sub: string }> = {
  beginner:     { title: "Привет! Я Волк 🐺",           sub: "Опиши что хочешь создать — я сделаю сразу. Без вопросов."      },
  intermediate: { title: "Готов к работе 🐺",           sub: "Опиши задачу — напишу код, объясню принцип, покажу результат." },
  pro:          { title: "Волк онлайн 🐺",              sub: "Задача → код. Без воды."                                        },
};

function t() {
  return new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
}

function md(text: string) {
  return text
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre class="wcode"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="winline">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

export default function Index() {
  const [mode, setMode]     = useState<Mode>("beginner");
  const [msgs, setMsgs]     = useState<Msg[]>([]);
  const [input, setInput]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [preview, setPreview] = useState<{ html: string } | null>(null);
  const [pTab, setPTab]       = useState<"site" | "code">("site");
  const endRef   = useRef<HTMLDivElement>(null);
  const taRef    = useRef<HTMLTextAreaElement>(null);
  const idRef    = useRef(0);
  const m        = MODES[mode];
  const gr       = GREETINGS[mode];

  useEffect(() => {
    setMsgs([]);
    setPreview(null);
    taRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || busy) return;
    const userMsg: Msg = { id: ++idRef.current, role: "user", text: text.trim(), type: "chat", time: t() };
    setMsgs(p => [...p, userMsg]);
    setInput("");
    setBusy(true);
    if (taRef.current) taRef.current.style.height = "auto";

    try {
      const history = [...msgs, userMsg].slice(-20);
      const res = await fetch(WOLF_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          message: text.trim(),
          messages: history.map(m => ({ role: m.role === "user" ? "user" : "assistant", text: m.text })),
          current_html: preview?.html || "",
        }),
      });
      const data = await res.json();

      if (data.reply === "no_key" || data.type === "no_key") {
        setMsgs(p => [...p, {
          id: ++idRef.current, role: "wolf", type: "chat", time: t(),
          text: "⚠️ **API-ключ не работает или не добавлен.**\n\nЧтобы Волк заработал:\n1. Зайди на **openrouter.ai/keys**\n2. Создай бесплатный ключ\n3. Вставь в настройках проекта → Секреты → OPENROUTER_API_KEY",
        }]);
        return;
      }

      const wolfMsg: Msg = {
        id: ++idRef.current, role: "wolf",
        text: data.reply || "...",
        type: data.type || "chat",
        html: data.html,
        time: t(),
      };
      setMsgs(p => [...p, wolfMsg]);

      if (data.type === "preview" && data.html) {
        setPreview({ html: data.html });
        setPTab("site");
      }
    } catch {
      setMsgs(p => [...p, { id: ++idRef.current, role: "wolf", text: "Ошибка соединения. Попробуй ещё раз.", type: "chat", time: t() }]);
    } finally {
      setBusy(false);
      taRef.current?.focus();
    }
  }, [busy, msgs, mode, preview]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const isEmpty = msgs.length === 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#0c0c10", color: "#f1f1f3", fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        .wcode { background:#111116; border:1px solid rgba(255,255,255,0.09); border-radius:8px; padding:12px 14px; margin:8px 0; overflow-x:auto; }
        .wcode code { color:#7dd3a8; font-size:12px; font-family:'Fira Code',monospace; white-space:pre; }
        .winline { background:rgba(255,255,255,0.09); padding:1px 6px; border-radius:4px; font-size:12px; font-family:monospace; color:#fbbf24; }
        ::-webkit-scrollbar { width:3px; height:3px; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:3px; }
        .ta { field-sizing: content; }
      `}</style>

      {/* ── HEADER ── */}
      <header style={{ background: "#111116", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        className="flex items-center gap-3 px-5 h-13 flex-shrink-0">

        <div className="flex items-center gap-2.5">
          <span className="text-xl">🐺</span>
          <span className="font-bold text-sm tracking-wide">Клан Волка</span>
        </div>

        <div className="w-px h-4 mx-1" style={{ background: "rgba(255,255,255,0.1)" }} />

        {/* Режимы */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }}>
          {(Object.entries(MODES) as [Mode, typeof m][]).map(([key, md]) => (
            <button key={key} onClick={() => setMode(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={mode === key
                ? { background: `${md.color}1a`, color: md.color, border: `1px solid ${md.color}40` }
                : { color: "rgba(255,255,255,0.3)", border: "1px solid transparent" }}>
              <Icon name={md.icon as Parameters<typeof Icon>[0]["name"]} size={11} />
              {md.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {preview && (
          <button
            onClick={() => setPreview(null)}
            className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{ color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.1)" }}>
            Закрыть превью
          </button>
        )}
      </header>

      {/* ── BODY ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── CHAT ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* Пустой экран */}
          {isEmpty && (
            <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
              <div className="text-4xl mb-4">🐺</div>
              <h1 className="text-2xl font-bold mb-2 text-center">{gr.title}</h1>
              <p className="text-sm mb-10 text-center" style={{ color: "rgba(255,255,255,0.4)", maxWidth: 420 }}>{gr.sub}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full" style={{ maxWidth: 560 }}>
                {EXAMPLES[mode].map(ex => (
                  <button key={ex.text} onClick={() => send(ex.text)} disabled={busy}
                    className="flex items-center gap-3 p-3.5 rounded-xl text-left text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = `${m.color}50`)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${m.color}18` }}>
                      <Icon name={ex.icon as Parameters<typeof Icon>[0]["name"]} size={15} style={{ color: m.color }} />
                    </div>
                    <span className="leading-snug">{ex.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Сообщения */}
          {!isEmpty && (
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {msgs.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {msg.role === "wolf"
                      ? <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: `${m.color}1a`, border: `1px solid ${m.color}40` }}>🐺</div>
                      : <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>Ты</div>
                    }
                  </div>
                  <div className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`} style={{ maxWidth: "78%" }}>
                    <div className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                      style={msg.role === "wolf"
                        ? { background: "#16161c", border: "1px solid rgba(255,255,255,0.07)" }
                        : { background: `${m.color}14`, border: `1px solid ${m.color}28` }}>
                      <div dangerouslySetInnerHTML={{ __html: md(msg.text) }} />
                      {msg.type === "preview" && msg.html && (
                        <button onClick={() => { setPreview({ html: msg.html! }); setPTab("site"); }}
                          className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-75"
                          style={{ background: `${m.color}1a`, color: m.color, border: `1px solid ${m.color}40` }}>
                          <Icon name="Eye" size={12} />
                          Открыть превью
                        </button>
                      )}
                    </div>
                    <span className="text-xs px-1" style={{ color: "rgba(255,255,255,0.2)" }}>{msg.time}</span>
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ background: `${m.color}1a`, border: `1px solid ${m.color}40` }}>🐺</div>
                  <div className="px-4 py-3 rounded-2xl flex gap-1.5" style={{ background: "#16161c", border: "1px solid rgba(255,255,255,0.07)" }}>
                    {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: m.color, animationDelay: `${i*0.15}s` }} />)}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}

          {/* ── INPUT ── */}
          <div className="px-4 pb-5 pt-2 flex-shrink-0">
            <div className="rounded-2xl p-3 flex gap-2 items-end" style={{ background: "#16161c", border: "1px solid rgba(255,255,255,0.1)" }}>
              <textarea
                ref={taRef}
                value={input}
                onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px"; }}
                onKeyDown={onKey}
                placeholder="Напиши что создать или спроси что угодно..."
                rows={1}
                disabled={busy}
                className="flex-1 bg-transparent resize-none text-sm focus:outline-none leading-relaxed"
                style={{ maxHeight: 150, color: "#f1f1f3", caretColor: m.color }}
              />
              <button onClick={() => send(input)} disabled={!input.trim() || busy}
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 active:scale-95 disabled:opacity-25"
                style={input.trim() && !busy
                  ? { background: `linear-gradient(135deg, ${m.color}, ${m.color}99)`, color: "#0c0c10" }
                  : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)" }}>
                {busy
                  ? <Icon name="Loader2" size={15} className="animate-spin" />
                  : <Icon name="ArrowUp" size={15} />}
              </button>
            </div>
            <p className="text-center text-xs mt-2" style={{ color: "rgba(255,255,255,0.13)" }}>Enter — отправить · Shift+Enter — новая строка</p>
          </div>
        </div>

        {/* ── PREVIEW PANEL ── */}
        {preview && (
          <div className="flex flex-col flex-shrink-0" style={{ width: "clamp(320px, 45vw, 700px)", borderLeft: "1px solid rgba(255,255,255,0.07)", background: "#111116" }}>

            {/* Шапка */}
            <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#ef4444" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#f59e0b" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#22c55e" }} />
              </div>
              <span className="flex-1 text-center text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>Превью</span>
              <button onClick={() => setPreview(null)} style={{ color: "rgba(255,255,255,0.25)" }} className="hover:text-white transition-colors">
                <Icon name="X" size={13} />
              </button>
            </div>

            {/* Вкладки */}
            <div className="flex flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {(["site","code"] as const).map(tab => (
                <button key={tab} onClick={() => setPTab(tab)}
                  className="flex-1 py-2 text-xs font-medium transition-colors"
                  style={{ color: pTab === tab ? m.color : "rgba(255,255,255,0.3)", borderBottom: pTab === tab ? `2px solid ${m.color}` : "2px solid transparent" }}>
                  {tab === "site" ? "🖥 Сайт" : "</> Код"}
                </button>
              ))}
            </div>

            {pTab === "site"
              ? <iframe srcDoc={preview.html} sandbox="allow-scripts allow-same-origin" className="flex-1 w-full border-0" title="preview" />
              : <div className="flex-1 overflow-auto p-4" style={{ background: "#0a0a0d" }}>
                  <pre className="text-xs leading-relaxed whitespace-pre-wrap break-all" style={{ color: "#7dd3a8", fontFamily: "'Fira Code', monospace" }}>{preview.html}</pre>
                </div>
            }

            {/* Кнопки */}
            <div className="flex gap-2 p-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <button
                onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([preview.html], {type:"text/html"})); a.download = "project.html"; a.click(); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                style={{ background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}35` }}>
                <Icon name="Download" size={12} />
                Скачать .html
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(preview.html); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Icon name="Copy" size={12} />
                Копировать
              </button>
              <button
                onClick={() => { const msg = "Измени этот сайт: "; setInput(msg); taRef.current?.focus(); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all hover:opacity-80"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Icon name="Pencil" size={12} />
                Изменить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
