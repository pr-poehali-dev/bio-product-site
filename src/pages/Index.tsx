import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

const API = "https://functions.poehali.dev/826782b1-c754-4d3c-830d-899a05683526";

interface Project { id: number; title: string; description: string; html?: string; updated_at: string; }
interface Msg     { id: number; role: "user"|"wolf"; text: string; time: string; source?: string; html?: string; }
interface Status  { ollama: boolean; ollama_url: string; has_groq: boolean; has_openrouter: boolean; models?: string[]; error?: string; }
interface Settings{ ollama_url: string; model_name: string; ai_name: string; ai_personality: string; }

type Panel = "chat"|"preview"|"code"|"setup"|"knowledge";

function getSession() {
  let s = localStorage.getItem("wolf_session");
  if (!s) { s = "wolf_" + Math.random().toString(36).slice(2) + Date.now(); localStorage.setItem("wolf_session", s); }
  return s;
}
function ts() { return new Date().toLocaleTimeString("ru",{hour:"2-digit",minute:"2-digit"}); }
function md(t: string) {
  return t
    .replace(/```[\w]*\n?([\s\S]*?)```/g,'<pre class="wpre"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g,'<code class="win">$1</code>')
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/\n/g,"<br/>");
}

const EXAMPLES = [
  {icon:"Globe",           text:"Создай лендинг для барбершопа"},
  {icon:"ShoppingBag",     text:"Интернет-магазин кроссовок"},
  {icon:"Briefcase",       text:"Портфолио для дизайнера"},
  {icon:"Calculator",      text:"Калькулятор ипотеки"},
  {icon:"UtensilsCrossed", text:"Меню для кафе с ценами"},
  {icon:"Rocket",          text:"Лендинг для мобильного приложения"},
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
  const [activeId, setActiveId] = useState<number|null>(null);
  const [notif,    setNotif]    = useState("");
  const [status,   setStatus]   = useState<Status|null>(null);
  const [settings, setSettings] = useState<Settings>({ollama_url:"",model_name:"llama3.2",ai_name:"Волк",ai_personality:""});
  const [savingSettings, setSavingSettings] = useState(false);
  const [knowledge, setKnowledge] = useState<{id:number;topic:string;content:string;source:string}[]>([]);
  const [newTopic,  setNewTopic]  = useState("");
  const [newContent,setNewContent]= useState("");

  const post = useCallback(async (body: object) => {
    const r = await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    return r.json();
  },[]);

  const notify = (text: string) => { setNotif(text); setTimeout(()=>setNotif(""),3000); };

  const loadProjects = useCallback(async () => {
    try { const d = await post({action:"projects",session_id:session.current}); setProjects(d.projects||[]); } catch(_e) { /* ignore */ }
  },[post]);

  const loadStatus = useCallback(async () => {
    try { const d = await post({action:"status"}); setStatus(d); } catch(_e) { /* ignore */ }
  },[post]);

  const loadSettings = useCallback(async () => {
    try {
      const d = await post({action:"settings"});
      setSettings({ollama_url:d.ollama_url||"",model_name:d.model_name||"llama3.2",ai_name:d.ai_name||"Волк",ai_personality:d.ai_personality||""});
    } catch(_e) { /* ignore */ }
  },[post]);

  const loadKnowledge = useCallback(async () => {
    try { const d = await post({action:"knowledge"}); setKnowledge(d.knowledge||[]); } catch(_e) { /* ignore */ }
  },[post]);

  useEffect(()=>{loadProjects();loadStatus();loadSettings();},[loadProjects,loadStatus,loadSettings]);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs,busy]);

  // Источник ИИ
  const sourceLabel = (src?: string) => {
    if (!src || src==="none") return null;
    if (src==="ollama") return <span className="text-xs px-1.5 py-0.5 rounded" style={{background:"rgba(34,197,94,0.15)",color:"#22c55e"}}>🐺 Локальный ИИ</span>;
    if (src==="groq")   return <span className="text-xs px-1.5 py-0.5 rounded" style={{background:"rgba(99,102,241,0.15)",color:"#818cf8"}}>⚡ Groq</span>;
    return <span className="text-xs px-1.5 py-0.5 rounded" style={{background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.4)"}}>☁️ Cloud</span>;
  };

  const send = useCallback(async (text: string) => {
    if (!text.trim()||busy) return;
    const userMsg: Msg = {id:++msgId.current,role:"user",text:text.trim(),time:ts()};
    setMsgs(p=>[...p,userMsg]); setInput(""); setBusy(true);
    if(taRef.current) taRef.current.style.height="auto";

    const t = text.toLowerCase();
    const isGen  = /создай|сделай|напиши|сверстай|сгенерируй|построй/.test(t) &&
                   /сайт|лендинг|страниц|магазин|портфолио|форм|калькулятор|меню|блог|приложен/.test(t);
    const isEdit = !!html && /измени|добавь|убери|исправь|перепиши|улучши|поменяй|обнови|переделай/.test(t);

    try {
      let body: Record<string,unknown>;
      if (isEdit)     body = {action:"edit",   prompt:text.trim(), html};
      else if (isGen) body = {action:"generate",prompt:text.trim()};
      else            body = {action:"chat",   message:text.trim(), session_id:session.current};

      const data = await post(body);

      if (data.error==="no_key"||data.reply==="no_key") {
        setMsgs(p=>[...p,{id:++msgId.current,role:"wolf",time:ts(),
          text:"⚠️ **ИИ недоступен**\n\nНастрой подключение в разделе **⚙️ Настройки** — подключи свой Ollama на ноутбуке или добавь облачный ключ."}]);
        return;
      }

      if ((isGen||isEdit) && data.html) {
        setHtml(data.html); setTitle(data.title||"Сайт"); setPanel("preview"); setActiveId(null);
        setMsgs(p=>[...p,{id:++msgId.current,role:"wolf",time:ts(),source:data.source,html:data.html,
          text:`✅ **${data.title||"Сайт"}** готов! Смотри превью →\n\n${data.description?`_${data.description}_`:""}`}]);
      } else if (data.reply) {
        if (data.html) { setHtml(data.html); setTitle("Сайт"); setPanel("preview"); }
        setMsgs(p=>[...p,{id:++msgId.current,role:"wolf",time:ts(),source:data.source,html:data.html,text:data.reply}]);
      } else if (data.error) {
        setMsgs(p=>[...p,{id:++msgId.current,role:"wolf",time:ts(),text:`⚠️ ${data.error}`}]);
      }
    } catch {
      setMsgs(p=>[...p,{id:++msgId.current,role:"wolf",time:ts(),text:"Ошибка соединения. Попробуй ещё раз."}]);
    } finally {
      setBusy(false); taRef.current?.focus();
    }
  },[busy,html,post]);

  const onKey = (e: React.KeyboardEvent) => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(input);} };

  const save = async () => {
    if (!html||saving) return; setSaving(true);
    try {
      const d = await post({action:"save",session_id:session.current,title,description:"",html,id:activeId});
      if (d.id) { setActiveId(d.id); await loadProjects(); notify("💾 Сохранено!"); }
    } finally { setSaving(false); }
  };

  const openProject = async (p: Project) => {
    const d = await post({action:"get",id:p.id,session_id:session.current});
    if (d.html) { setHtml(d.html); setTitle(d.title); setPanel("preview"); setActiveId(d.id); setSidebar(false); }
  };

  const deleteProject = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await post({action:"delete",id,session_id:session.current});
    await loadProjects();
    if (activeId===id) { setHtml(""); setActiveId(null); setPanel("chat"); }
    notify("🗑 Удалено");
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html],{type:"text/html"}));
    a.download = `${title.replace(/\s+/g,"-").toLowerCase()||"project"}.html`;
    a.click();
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    await post({action:"settings",update:settings});
    await loadStatus();
    setSavingSettings(false);
    notify("✅ Настройки сохранены!");
  };

  const addKnowledge = async () => {
    if (!newTopic.trim()||!newContent.trim()) return;
    await post({action:"learn",topic:newTopic,content:newContent,source:"manual"});
    setNewTopic(""); setNewContent("");
    await loadKnowledge();
    notify("🧠 Знание добавлено!");
  };

  const clearMemory = async () => {
    await post({action:"clear_memory",session_id:session.current});
    notify("🗑 Память очищена");
  };

  const isEmpty = msgs.length===0;

  // Статус подключения
  const aiStatus = status?.ollama ? {color:"#22c55e",label:`🐺 ${settings.model_name}`}
    : status?.has_groq ? {color:"#818cf8",label:"⚡ Groq"}
    : status?.has_openrouter ? {color:"#f59e0b",label:"☁️ OpenRouter"}
    : {color:"#ef4444",label:"❌ Нет ИИ"};

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{background:"#0c0c10",color:"#f1f1f3",fontFamily:"Inter,system-ui,sans-serif"}}>
      <style>{`
        .wpre{background:#0f0f14;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px;margin:6px 0;overflow-x:auto}
        .wpre code{color:#7dd3a8;font-size:11px;font-family:monospace;white-space:pre}
        .win{background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-size:11px;font-family:monospace;color:#fbbf24}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px}
        textarea::placeholder{color:rgba(255,255,255,0.25)}
      `}</style>

      {notif && <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-xl" style={{background:"#22c55e",color:"#0c0c10"}}>{notif}</div>}

      {/* ШАПКА */}
      <header className="flex items-center gap-2 px-4 h-12 flex-shrink-0" style={{background:"#111116",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <button onClick={()=>setSidebar(s=>!s)} className="flex items-center gap-2 hover:opacity-70 transition-opacity">
          <span className="text-lg">🐺</span>
          <span className="font-bold text-sm">Клан Волка</span>
        </button>
        <div className="w-px h-4 mx-1" style={{background:"rgba(255,255,255,0.1)"}}/>
        {/* Статус ИИ */}
        <button onClick={()=>setPanel("setup")} className="flex items-center gap-1.5 text-xs transition-all hover:opacity-80">
          <div className="w-1.5 h-1.5 rounded-full" style={{background:aiStatus.color,boxShadow:`0 0 6px ${aiStatus.color}`}}/>
          <span style={{color:aiStatus.color}}>{aiStatus.label}</span>
        </button>
        <div className="flex-1"/>
        {/* Навигация */}
        <div className="flex items-center gap-1">
          {html && <>
            {(["preview","code"] as Panel[]).map(p=>(
              <button key={p} onClick={()=>setPanel(p)}
                className="px-2.5 py-1 rounded-lg text-xs transition-all"
                style={panel===p?{background:"rgba(255,255,255,0.1)",color:"#fff"}:{color:"rgba(255,255,255,0.35)"}}>
                {p==="preview"?"🖥 Сайт":"</> Код"}
              </button>
            ))}
          </>}
          <button onClick={()=>setPanel("chat")} className="px-2.5 py-1 rounded-lg text-xs transition-all"
            style={panel==="chat"?{background:"rgba(255,255,255,0.1)",color:"#fff"}:{color:"rgba(255,255,255,0.35)"}}>
            💬
          </button>
          <button onClick={()=>{setPanel("knowledge");loadKnowledge();}} className="px-2.5 py-1 rounded-lg text-xs transition-all"
            style={panel==="knowledge"?{background:"rgba(255,255,255,0.1)",color:"#fff"}:{color:"rgba(255,255,255,0.35)"}}>
            🧠
          </button>
          <button onClick={()=>setPanel("setup")} className="px-2.5 py-1 rounded-lg text-xs transition-all"
            style={panel==="setup"?{background:"rgba(255,255,255,0.1)",color:"#fff"}:{color:"rgba(255,255,255,0.35)"}}>
            ⚙️
          </button>
        </div>
        {html && <>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ml-1 transition-all hover:opacity-80 disabled:opacity-40"
            style={{background:"rgba(34,197,94,0.15)",color:"#22c55e",border:"1px solid rgba(34,197,94,0.3)"}}>
            <Icon name={saving?"Loader2":"Save"} size={12} className={saving?"animate-spin":""}/>
            {activeId?"Обновить":"Сохранить"}
          </button>
          <button onClick={download}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all hover:opacity-80"
            style={{background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.4)",border:"1px solid rgba(255,255,255,0.1)"}}>
            <Icon name="Download" size={12}/>
          </button>
        </>}
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* САЙДБАР */}
        {sidebar && (
          <div className="flex flex-col flex-shrink-0" style={{width:240,background:"#0f0f14",borderRight:"1px solid rgba(255,255,255,0.07)"}}>
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
              <span className="text-sm font-semibold">Проекты</span>
              <button onClick={()=>setSidebar(false)} style={{color:"rgba(255,255,255,0.3)"}}><Icon name="X" size={14}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {projects.length===0 && <p className="text-xs text-center py-8" style={{color:"rgba(255,255,255,0.25)"}}>Нет проектов</p>}
              {projects.map(p=>(
                <button key={p.id} onClick={()=>openProject(p)}
                  className="w-full flex items-center gap-2 p-2.5 rounded-lg text-left transition-all hover:bg-white/5 group"
                  style={{border:activeId===p.id?"1px solid rgba(34,197,94,0.4)":"1px solid transparent"}}>
                  <span className="text-base">🌐</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{p.title}</div>
                    <div className="text-xs truncate" style={{color:"rgba(255,255,255,0.3)"}}>{new Date(p.updated_at).toLocaleDateString("ru")}</div>
                  </div>
                  <button onClick={e=>deleteProject(p.id,e)} className="opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity" style={{color:"rgba(239,68,68,0.6)"}}>
                    <Icon name="Trash2" size={11}/>
                  </button>
                </button>
              ))}
            </div>
            <div className="p-3 flex-shrink-0" style={{borderTop:"1px solid rgba(255,255,255,0.07)"}}>
              <button onClick={()=>{setHtml("");setTitle("");setActiveId(null);setPanel("chat");setMsgs([]);setSidebar(false);}}
                className="w-full py-2 rounded-lg text-xs font-medium" style={{background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)"}}>
                + Новый проект
              </button>
            </div>
          </div>
        )}

        {/* НАСТРОЙКИ */}
        {panel==="setup" && (
          <div className="flex-1 overflow-y-auto p-6" style={{maxWidth:640}}>
            <h2 className="text-lg font-bold mb-1">⚙️ Настройки</h2>
            <p className="text-sm mb-6" style={{color:"rgba(255,255,255,0.4)"}}>Подключи свой ИИ на ноутбуке или облачный ключ</p>

            {/* Статус */}
            <div className="p-4 rounded-xl mb-6" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
              <div className="text-xs font-semibold mb-3" style={{color:"rgba(255,255,255,0.4)"}}>СТАТУС ПОДКЛЮЧЕНИЯ</div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{background:status?.ollama?"#22c55e":"#ef4444"}}/>
                  <span className="text-sm">Локальный Ollama (ноутбук)</span>
                  <span className="text-xs ml-auto" style={{color:status?.ollama?"#22c55e":"rgba(255,255,255,0.25)"}}>
                    {status?.ollama ? `✓ ${(status.models||[]).join(", ")||"подключён"}` : "не подключён"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{background:status?.has_groq?"#818cf8":"rgba(255,255,255,0.2)"}}/>
                  <span className="text-sm">Groq (облако)</span>
                  <span className="text-xs ml-auto" style={{color:status?.has_groq?"#818cf8":"rgba(255,255,255,0.25)"}}>
                    {status?.has_groq?"✓ ключ есть":"нет ключа"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{background:status?.has_openrouter?"#f59e0b":"rgba(255,255,255,0.2)"}}/>
                  <span className="text-sm">OpenRouter (облако)</span>
                  <span className="text-xs ml-auto" style={{color:status?.has_openrouter?"#f59e0b":"rgba(255,255,255,0.25)"}}>
                    {status?.has_openrouter?"✓ ключ есть":"нет ключа"}
                  </span>
                </div>
              </div>
              <button onClick={loadStatus} className="mt-3 text-xs transition-all hover:opacity-70" style={{color:"rgba(255,255,255,0.35)"}}>
                🔄 Обновить статус
              </button>
            </div>

            {/* Инструкция установки Ollama */}
            <div className="p-4 rounded-xl mb-6" style={{background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.2)"}}>
              <div className="text-sm font-semibold mb-3" style={{color:"#22c55e"}}>🐺 Установка локального ИИ на твой ноутбук</div>
              <div className="space-y-2 text-sm" style={{color:"rgba(255,255,255,0.6)"}}>
                <p><strong style={{color:"#fff"}}>Шаг 1.</strong> Скачай Ollama: <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{background:"rgba(255,255,255,0.08)"}}>ollama.com</span> → Install for Windows</p>
                <p><strong style={{color:"#fff"}}>Шаг 2.</strong> Открой PowerShell и выполни:</p>
                <pre className="text-xs p-2 rounded" style={{background:"rgba(0,0,0,0.4)",color:"#7dd3a8"}}>ollama pull llama3.2</pre>
                <p><strong style={{color:"#fff"}}>Шаг 3.</strong> Запусти туннель (чтобы сайт видел твой ноутбук):</p>
                <pre className="text-xs p-2 rounded" style={{background:"rgba(0,0,0,0.4)",color:"#7dd3a8"}}>{"# Скачай ngrok.com, затем:\nngrok http 11434"}</pre>
                <p><strong style={{color:"#fff"}}>Шаг 4.</strong> Скопируй URL из ngrok (вида <span className="font-mono text-xs" style={{color:"#fbbf24"}}>https://abc123.ngrok.io</span>) и вставь ниже</p>
              </div>
            </div>

            {/* Форма настроек */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{color:"rgba(255,255,255,0.5)"}}>URL Ollama (ngrok-адрес)</label>
                <input value={settings.ollama_url} onChange={e=>setSettings(s=>({...s,ollama_url:e.target.value}))}
                  placeholder="https://abc123.ngrok.io"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff"}}/>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{color:"rgba(255,255,255,0.5)"}}>Модель</label>
                <input value={settings.model_name} onChange={e=>setSettings(s=>({...s,model_name:e.target.value}))}
                  placeholder="llama3.2"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff"}}/>
                <p className="text-xs mt-1" style={{color:"rgba(255,255,255,0.3)"}}>llama3.2 (3B, лёгкая) · llama3.1 (8B) · mistral (7B)</p>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{color:"rgba(255,255,255,0.5)"}}>Имя ИИ</label>
                <input value={settings.ai_name} onChange={e=>setSettings(s=>({...s,ai_name:e.target.value}))}
                  placeholder="Волк"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff"}}/>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{color:"rgba(255,255,255,0.5)"}}>Личность / системный промпт</label>
                <textarea value={settings.ai_personality} onChange={e=>setSettings(s=>({...s,ai_personality:e.target.value}))}
                  rows={4} placeholder="Ты — Волк, умный ИИ-помощник..."
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none resize-none"
                  style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff"}}/>
              </div>
              <div className="flex gap-2">
                <button onClick={saveSettings} disabled={savingSettings}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80 disabled:opacity-40"
                  style={{background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#0c0c10"}}>
                  {savingSettings?"Сохраняю...":"Сохранить настройки"}
                </button>
                <button onClick={clearMemory}
                  className="px-4 py-2 rounded-lg text-sm transition-all hover:opacity-80"
                  style={{background:"rgba(239,68,68,0.1)",color:"rgba(239,68,68,0.7)",border:"1px solid rgba(239,68,68,0.2)"}}>
                  Очистить память
                </button>
              </div>
            </div>
          </div>
        )}

        {/* БАЗА ЗНАНИЙ */}
        {panel==="knowledge" && (
          <div className="flex-1 overflow-y-auto p-6" style={{maxWidth:640}}>
            <h2 className="text-lg font-bold mb-1">🧠 База знаний</h2>
            <p className="text-sm mb-6" style={{color:"rgba(255,255,255,0.4)"}}>Обучай ИИ — добавляй знания которые он будет использовать в разговорах</p>
            <div className="p-4 rounded-xl mb-6" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
              <div className="text-xs font-semibold mb-3" style={{color:"rgba(255,255,255,0.4)"}}>ДОБАВИТЬ ЗНАНИЕ</div>
              <input value={newTopic} onChange={e=>setNewTopic(e.target.value)} placeholder="Тема (напр: мой бизнес, мой продукт)"
                className="w-full px-3 py-2 rounded-lg text-sm mb-2 focus:outline-none"
                style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff"}}/>
              <textarea value={newContent} onChange={e=>setNewContent(e.target.value)} rows={3}
                placeholder="Содержимое (факты, описания, контекст...)"
                className="w-full px-3 py-2 rounded-lg text-sm mb-3 focus:outline-none resize-none"
                style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#fff"}}/>
              <button onClick={addKnowledge}
                className="w-full py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                style={{background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#0c0c10"}}>
                + Добавить в базу знаний
              </button>
            </div>
            <div className="space-y-2">
              {knowledge.length===0 && <p className="text-sm text-center py-8" style={{color:"rgba(255,255,255,0.25)"}}>База знаний пуста — добавь первое знание выше</p>}
              {knowledge.map(k=>(
                <div key={k.id} className="p-3 rounded-xl" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold" style={{color:"#22c55e"}}>{k.topic}</span>
                    <span className="text-xs ml-auto" style={{color:"rgba(255,255,255,0.25)"}}>{k.source}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{color:"rgba(255,255,255,0.55)"}}>{k.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ЧАТ */}
        {panel==="chat" && (
          <div className="flex flex-col overflow-hidden" style={{width:html?"380px":"100%",flexShrink:0,borderRight:html?"1px solid rgba(255,255,255,0.07)":"none"}}>
            {isEmpty ? (
              <div className="flex-1 flex flex-col items-center justify-center px-5 pb-10">
                <div className="text-5xl mb-3">🐺</div>
                <h1 className="text-xl font-bold mb-2">Клан Волка</h1>
                <p className="text-sm mb-2 text-center" style={{color:"rgba(255,255,255,0.4)",maxWidth:340}}>Опиши что создать — получишь готовый сайт.</p>
                {!status?.ollama && !status?.has_groq && !status?.has_openrouter && (
                  <button onClick={()=>setPanel("setup")} className="mb-6 px-4 py-2 rounded-xl text-sm transition-all hover:opacity-80"
                    style={{background:"rgba(239,68,68,0.1)",color:"#f87171",border:"1px solid rgba(239,68,68,0.2)"}}>
                    ⚙️ Сначала настрой ИИ
                  </button>
                )}
                <div className="grid grid-cols-1 gap-2 w-full" style={{maxWidth:340}}>
                  {EXAMPLES.map(ex=>(
                    <button key={ex.text} onClick={()=>send(ex.text)} disabled={busy}
                      className="flex items-center gap-3 p-3 rounded-xl text-left text-sm transition-all hover:scale-[1.01] disabled:opacity-40"
                      style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}
                      onMouseEnter={e=>(e.currentTarget.style.borderColor="rgba(34,197,94,0.4)")}
                      onMouseLeave={e=>(e.currentTarget.style.borderColor="rgba(255,255,255,0.08)")}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:"rgba(34,197,94,0.1)"}}>
                        <Icon name={ex.icon as Parameters<typeof Icon>[0]["name"]} size={14} style={{color:"#22c55e"}}/>
                      </div>
                      <span className="text-xs leading-snug" style={{color:"rgba(255,255,255,0.7)"}}>{ex.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {msgs.map(m=>(
                  <div key={m.id} className={`flex gap-2.5 ${m.role==="user"?"flex-row-reverse":""}`}>
                    <div className="flex-shrink-0 mt-0.5">
                      {m.role==="wolf"
                        ? <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{background:"rgba(34,197,94,0.12)",border:"1px solid rgba(34,197,94,0.25)"}}>🐺</div>
                        : <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)"}}>Я</div>
                      }
                    </div>
                    <div className={`flex flex-col gap-1 ${m.role==="user"?"items-end":"items-start"}`} style={{maxWidth:"82%"}}>
                      <div className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
                        style={m.role==="wolf"
                          ?{background:"#15151b",border:"1px solid rgba(255,255,255,0.07)"}
                          :{background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.2)"}}>
                        <div dangerouslySetInnerHTML={{__html:md(m.text)}}/>
                        {m.html && <button onClick={()=>{setHtml(m.html!);setTitle("Сайт");setPanel("preview");}}
                          className="mt-2 text-xs px-2 py-1 rounded-lg transition-all hover:opacity-80"
                          style={{background:"rgba(34,197,94,0.15)",color:"#22c55e",border:"1px solid rgba(34,197,94,0.3)"}}>
                          🖥 Открыть превью
                        </button>}
                      </div>
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-xs" style={{color:"rgba(255,255,255,0.18)"}}>{m.time}</span>
                        {m.role==="wolf" && sourceLabel(m.source)}
                      </div>
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{background:"rgba(34,197,94,0.12)",border:"1px solid rgba(34,197,94,0.25)"}}>🐺</div>
                    <div className="px-3.5 py-3 rounded-2xl flex gap-1.5 items-center" style={{background:"#15151b",border:"1px solid rgba(255,255,255,0.07)"}}>
                      {[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{background:"#22c55e",animationDelay:`${i*0.15}s`}}/>)}
                      <span className="text-xs ml-1" style={{color:"rgba(255,255,255,0.3)"}}>
                        {status?.ollama?`${settings.ai_name} думает...`:"Генерирую..."}
                      </span>
                    </div>
                  </div>
                )}
                <div ref={endRef}/>
              </div>
            )}
            <div className="px-4 pb-4 pt-2 flex-shrink-0">
              {html && <div className="flex items-center gap-1.5 mb-2 text-xs" style={{color:"rgba(255,255,255,0.3)"}}><Icon name="Pencil" size={11}/><span style={{color:"#22c55e"}}>{title}</span> — напиши что изменить</div>}
              <div className="flex gap-2 items-end p-3 rounded-2xl" style={{background:"#16161c",border:"1px solid rgba(255,255,255,0.1)"}}>
                <textarea ref={taRef} value={input}
                  onChange={e=>{setInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,130)+"px";}}
                  onKeyDown={onKey}
                  placeholder={html?"Что изменить?...":"Опиши что создать или задай вопрос..."}
                  rows={1} disabled={busy}
                  className="flex-1 bg-transparent resize-none text-sm focus:outline-none leading-relaxed"
                  style={{maxHeight:130,color:"#f1f1f3",caretColor:"#22c55e"}}/>
                <button onClick={()=>send(input)} disabled={!input.trim()||busy}
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 active:scale-95 disabled:opacity-25"
                  style={input.trim()&&!busy?{background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"#0c0c10"}:{background:"rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.3)"}}>
                  {busy?<Icon name="Loader2" size={15} className="animate-spin"/>:<Icon name="ArrowUp" size={15}/>}
                </button>
              </div>
              <p className="text-center text-xs mt-1.5" style={{color:"rgba(255,255,255,0.1)"}}>Enter — отправить · Shift+Enter — перенос</p>
            </div>
          </div>
        )}

        {/* ПРЕВЬЮ / КОД */}
        {html && (panel==="preview"||panel==="code") && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {panel==="preview" && <iframe srcDoc={html} sandbox="allow-scripts allow-same-origin" className="flex-1 w-full border-0" title={title}/>}
            {panel==="code" && (
              <div className="flex-1 overflow-auto p-5" style={{background:"#0a0a0d"}}>
                <pre className="text-xs leading-relaxed whitespace-pre-wrap break-all" style={{color:"#7dd3a8",fontFamily:"monospace"}}>{html}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}