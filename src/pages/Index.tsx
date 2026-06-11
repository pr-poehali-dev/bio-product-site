import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

const API = "https://functions.poehali.dev/826782b1-c754-4d3c-830d-899a05683526";

interface Project { id: number; title: string; description: string; html?: string; created_at: string; updated_at: string; }
interface Msg     { id: number; role: "user" | "wolf"; text: string; time: string; }
type Panel = "chat" | "preview" | "code";

function getSession(): string {
  let s = localStorage.getItem("wolf_session");
  if (!s) { s = "wolf_" + Math.random().toString(36).slice(2) + Date.now(); localStorage.setItem("wolf_session", s); }
  return s;
}
function ts() { return new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }); }
function md(t: string) {
  return t
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre class="wpre"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="win">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}

const EXAMPLES = [
  { icon: "Globe",           text: "Создай лендинг для барбершопа" },
  { icon: "ShoppingBag",     text: "Интернет-магазин кроссовок" },
  { icon: "Briefcase",       text: "Портфолио для дизайнера" },
  { icon: "Calculator",      text: "Калькулятор ипотеки" },
  { icon: "UtensilsCrossed", text: "Меню для кафе с ценами" },
  { icon: "Rocket",          text: "Лендинг для мобильного приложения" },
];

export default function Index() {
  const session = useRef(getSession());
  const msgId   = useRef(0);
  const taRef   = useRef<HTMLTextAreaElement>(null);
  const endRef  = useRef<HTMLDivElement>(null);

  const [msgs,     setMsgs]     = useState<Msg[]>([]);
  const [input,    setInput]    = useState("");
  const [busy,     setBusy]     = useState(false);
  const [panel,    setPanel]    = useState<Panel>("chat");
  const [html,     setHtml]     = useState("");
  const [title,    setTitle]    = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [sidebar,  setSidebar]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [notif,    setNotif]    = useState("");

  const loadProjects = useCallback(async () => {
    try {
      const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "projects", session_id: session.current }) });
      const d = await r.json();
      setProjects(d.projects || []);
    } catch { /* тихо */ }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const notify = (text: string) => { setNotif(text); setTimeout(() => setNotif(""), 3000); };

  const send = useCallback(async (text: string) => {
    if (!text.trim() || busy) return;
    const userMsg: Msg = { id: ++msgId.current, role: "user", text: text.trim(), time: ts() };
    setMsgs(p => [...p, userMsg]);
    setInput("");
    setBusy(true);
    if (taRef.current) taRef.current.style.height = "auto";

    const t = text.toLowerCase();
    const isGen  = /создай|сделай|напиши|сверстай|сгенерируй|построй/.test(t) &&
                   /сайт|лендинг|страниц|магазин|портфолио|форм|калькулятор|интерфейс|меню|блог|приложен/.test(t);
    const isEdit = !!html && /измени|добавь|убери|исправь|перепиши|улучши|поменяй|обнови|переделай/.test(t);

    try {
      let body: Record<string, unknown>;
      if (isEdit) {
        body = { action: "edit", prompt: text.trim(), html };
      } else if (isGen) {
        body = { action: "generate", prompt: text.trim() };
      } else {
        body = { action: "chat", message: text.trim(), messages: msgs.slice(-16).map(m => ({ role: m.role, text: m.text })) };
      }

      const r    = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json();

      if (data.error === "no_key" || data.reply === "no_key") {
        setMsgs(p => [...p, { id: ++msgId.current, role: "wolf", time: ts(),
          text: "⚠️ **ИИ недоступен** — нет рабочего ключа.\n\nДобавь **GROQ_API_KEY**: зайди на **console.groq.com/keys** → Create API Key → вставь в Ядро → Секреты." }]);
        return;
      }

      if ((isGen || isEdit) && data.html) {
        setHtml(data.html);
        setTitle(data.title || "Сайт");
        setPanel("preview");
        setActiveId(null);
        setMsgs(p => [...p, { id: ++msgId.current, role: "wolf", time: ts(),
          text: `✅ **${data.title || "Сайт"}** готов! Смотри превью →\n\n${data.description ? `_${data.description}_\n\n` : ""}Хочешь что-то изменить — просто напиши.` }]);
        setPanel("preview");
      } else if (data.reply) {
        setMsgs(p => [...p, { id: ++msgId.current, role: "wolf", time: ts(), text: data.reply }]);
      } else if (data.error) {
        setMsgs(p => [...p, { id: ++msgId.current, role: "wolf", time: ts(), text: `⚠️ ${data.error}` }]);
      }
    } catch {
      setMsgs(p => [...p, { id: ++msgId.current, role: "wolf", time: ts(), text: "Ошибка соединения. Попробуй ещё раз." }]);
    } finally {
      setBusy(false);
      taRef.current?.focus();
    }
  }, [busy, msgs, html]);

  const onKey = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } };

  const save = async () => {
    if (!html || saving) return;
    setSaving(true);
    try {
      const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", session_id: session.current, title, description: "", html, id: activeId }) });
      const d = await r.json();
      if (d.id) { setActiveId(d.id); await loadProjects(); notify("💾 Сохранено!"); }
    } finally { setSaving(false); }
  };

  const openProject = async (p: Project) => {
    const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get", id: p.id, session_id: session.current }) });
    const d = await r.json();
    if (d.html) { setHtml(d.html); setTitle(d.title); setPanel("preview"); setActiveId(d.id); setSidebar(false); }
  };

  const deleteProject = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id, session_id: session.current }) });
    await loadProjects();
    if (activeId === id) { setHtml(""); setActiveId(null); setPanel("chat"); }
    notify("🗑 Удалено");
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = `${title.replace(/\s+/g, "-").toLowerCase() || "project"}.html`;
    a.click();
  };

  const newProject = () => { setHtml(""); setTitle(""); setActiveId(null); setPanel("chat"); setMsgs([]); setSidebar(false); };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#0c0c10", color: "#f1f1f3", fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        .wpre{background:#0f0f14;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px;margin:6px 0;overflow-x:auto}
        .wpre code{color:#7dd3a8;font-size:11px;font-family:monospace;white-space:pre}
        .win{background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-size:11px;font-family:monospace;color:#fbbf24}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
      `}</style>

      {notif && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg" style={{ background: "#22c55e", color: "#0c0c10" }}>
          {notif}
        </div>
      )}

      {/* ШАПКА */}
      <header className="flex items-center gap-3 px-4 h-12 flex-shrink-0" style={{ background: "#111116", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <button onClick={() => setSidebar(s => !s)} className="flex items-center gap-2 hover:opacity-70 transition-opacity">
          <span className="text-lg">🐺</span>
          <span className="font-bold text-sm">Клан Волка</span>
        </button>
        <div className="w-px h-4" style={{ background: "rgba(255,255,255,0.1)" }} />
        <button onClick={() => setSidebar(s => !s)} className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70" style={{ color: "rgba(255,255,255,0.4)" }}>
          <Icon name="FolderOpen" size={13} />
          {projects.length} проектов
        </button>
        <div className="flex-1" />
        {html && (
          <div className="flex items-center gap-1.5">
            <div className="flex p-1 rounded-lg gap-0.5" style={{ background: "rgba(255,255,255,0.05)" }}>
              {(["chat","preview","code"] as Panel[]).map(p => (
                <button key={p} onClick={() => setPanel(p)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                  style={panel === p ? { background: "rgba(255,255,255,0.12)", color: "#fff" } : { color: "rgba(255,255,255,0.35)" }}>
                  {p === "chat" ? "💬" : p === "preview" ? "🖥 Сайт" : "</> Код"}
                </button>
              ))}
            </div>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40"
              style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}>
              <Icon name={saving ? "Loader2" : "Save"} size={12} className={saving ? "animate-spin" : ""} />
              {activeId ? "Обновить" : "Сохранить"}
            </button>
            <button onClick={download}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Icon name="Download" size={12} />
              .html
            </button>
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* САЙДБАР */}
        {sidebar && (
          <div className="flex flex-col flex-shrink-0" style={{ width: 250, background: "#0f0f14", borderRight: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-sm font-semibold">Мои проекты</span>
              <button onClick={() => setSidebar(false)} style={{ color: "rgba(255,255,255,0.3)" }}><Icon name="X" size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {projects.length === 0 && <p className="text-xs text-center py-8" style={{ color: "rgba(255,255,255,0.25)" }}>Нет сохранённых проектов</p>}
              {projects.map(p => (
                <button key={p.id} onClick={() => openProject(p)}
                  className="w-full flex items-center gap-2 p-2.5 rounded-lg text-left transition-all hover:bg-white/5 group"
                  style={{ border: activeId === p.id ? "1px solid rgba(34,197,94,0.4)" : "1px solid transparent" }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm" style={{ background: "rgba(255,255,255,0.06)" }}>🌐</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{p.title}</div>
                    <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{new Date(p.updated_at).toLocaleDateString("ru")}</div>
                  </div>
                  <button onClick={e => deleteProject(p.id, e)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded" style={{ color: "rgba(239,68,68,0.6)" }}>
                    <Icon name="Trash2" size={11} />
                  </button>
                </button>
              ))}
            </div>
            <div className="p-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <button onClick={newProject} className="w-full py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                + Новый проект
              </button>
            </div>
          </div>
        )}

        {/* ЧАТ */}
        <div className="flex flex-col overflow-hidden" style={{ width: html && panel !== "chat" ? "380px" : "100%", flexShrink: 0, borderRight: html && panel !== "chat" ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
          {isEmpty ? (
            <div className="flex-1 flex flex-col items-center justify-center px-5 pb-10">
              <div className="text-5xl mb-3">🐺</div>
              <h1 className="text-xl font-bold mb-2">Клан Волка</h1>
              <p className="text-sm mb-7 text-center" style={{ color: "rgba(255,255,255,0.4)", maxWidth: 340 }}>
                Опиши что создать — получишь готовый сайт. Редактируй через чат.
              </p>
              <div className="grid grid-cols-1 gap-2 w-full" style={{ maxWidth: 340 }}>
                {EXAMPLES.map(ex => (
                  <button key={ex.text} onClick={() => send(ex.text)} disabled={busy}
                    className="flex items-center gap-3 p-3 rounded-xl text-left text-sm transition-all hover:scale-[1.01] disabled:opacity-40"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(34,197,94,0.4)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(34,197,94,0.1)" }}>
                      <Icon name={ex.icon as Parameters<typeof Icon>[0]["name"]} size={14} style={{ color: "#22c55e" }} />
                    </div>
                    <span className="text-xs leading-snug" style={{ color: "rgba(255,255,255,0.7)" }}>{ex.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {msgs.map(m => (
                <div key={m.id} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {m.role === "wolf"
                      ? <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}>🐺</div>
                      : <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>Я</div>
                    }
                  </div>
                  <div className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`} style={{ maxWidth: "82%" }}>
                    <div className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                      style={m.role === "wolf"
                        ? { background: "#15151b", border: "1px solid rgba(255,255,255,0.07)" }
                        : { background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
                      <div dangerouslySetInnerHTML={{ __html: md(m.text) }} />
                    </div>
                    <span className="text-xs px-1" style={{ color: "rgba(255,255,255,0.18)" }}>{m.time}</span>
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}>🐺</div>
                  <div className="px-3.5 py-3 rounded-2xl flex gap-1.5 items-center" style={{ background: "#15151b", border: "1px solid rgba(255,255,255,0.07)" }}>
                    {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#22c55e", animationDelay: `${i*0.15}s` }} />)}
                    <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.3)" }}>Генерирую...</span>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}

          {/* ВВОД */}
          <div className="px-4 pb-4 pt-2 flex-shrink-0">
            {html && <div className="flex items-center gap-1.5 mb-2 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}><Icon name="Pencil" size={11} /><span style={{ color: "#22c55e" }}>{title}</span> — напиши что изменить</div>}
            <div className="flex gap-2 items-end p-3 rounded-2xl" style={{ background: "#16161c", border: "1px solid rgba(255,255,255,0.1)" }}>
              <textarea ref={taRef} value={input}
                onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 130) + "px"; }}
                onKeyDown={onKey}
                placeholder={html ? "Что изменить? Напиши — Волк переделает..." : "Опиши сайт который хочешь создать..."}
                rows={1} disabled={busy}
                className="flex-1 bg-transparent resize-none text-sm focus:outline-none leading-relaxed"
                style={{ maxHeight: 130, color: "#f1f1f3", caretColor: "#22c55e" }}
              />
              <button onClick={() => send(input)} disabled={!input.trim() || busy}
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 active:scale-95 disabled:opacity-25"
                style={input.trim() && !busy ? { background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#0c0c10" } : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)" }}>
                {busy ? <Icon name="Loader2" size={15} className="animate-spin" /> : <Icon name="ArrowUp" size={15} />}
              </button>
            </div>
            <p className="text-center text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.1)" }}>Enter — отправить · Shift+Enter — перенос</p>
          </div>
        </div>

        {/* ПРЕВЬЮ / КОД */}
        {html && panel !== "chat" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {panel === "preview" && <iframe srcDoc={html} sandbox="allow-scripts allow-same-origin" className="flex-1 w-full border-0" title={title} />}
            {panel === "code" && (
              <div className="flex-1 overflow-auto p-5" style={{ background: "#0a0a0d" }}>
                <pre className="text-xs leading-relaxed whitespace-pre-wrap break-all" style={{ color: "#7dd3a8", fontFamily: "monospace" }}>{html}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
