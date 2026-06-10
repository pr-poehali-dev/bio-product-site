import { useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";

const CHAT_API = "https://functions.poehali.dev/0dd1813d-413c-4595-9a50-a307b6e38777";

export default function Game() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [html, setHtml] = useState<string>("");
  const [title, setTitle] = useState("Загружаю игру...");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [editInput, setEditInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const request = searchParams.get("request") || "простая аркада";
  const mode = searchParams.get("mode") || "create";

  useEffect(() => {
    generateGame(request, "", mode === "edit" ? "create" : mode);
  }, []);

  async function generateGame(req: string, currentCode: string, gameMode: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(CHAT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_game",
          request: req,
          current_code: currentCode,
          mode: gameMode,
        }),
      });
      const data = await res.json();
      if (!data.html) throw new Error("Нет HTML в ответе");
      setHtml(data.html);
      setTitle(data.title || "Игра от Stefani");
      setDescription(data.description || "");
      setModel(data.model || "");
    } catch (e) {
      setError("Не удалось создать игру. Попробуй ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit() {
    if (!editInput.trim() || editing) return;
    setEditing(true);
    await generateGame(editInput.trim(), html, "edit");
    setEditInput("");
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEdit();
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white flex flex-col">
      {/* Хедер */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0d0d20]">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-[#ff6b9d] hover:text-white transition-colors text-sm"
        >
          <Icon name="ArrowLeft" size={16} />
          Вернуться к Stefani
        </button>
        <div className="w-px h-5 bg-white/20" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon name="Gamepad2" size={18} className="text-[#ff6b9d] flex-shrink-0" />
          <span className="font-semibold truncate">{title}</span>
          {model === "fallback" && (
            <span className="text-xs text-yellow-400/70 flex-shrink-0">(демо)</span>
          )}
        </div>
        <button
          onClick={() => generateGame(request, "", "create")}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-white/20 hover:border-[#ff6b9d] hover:text-[#ff6b9d] transition-all"
          disabled={loading}
        >
          <Icon name="RefreshCw" size={14} />
          Новая
        </button>
      </header>

      {/* Описание */}
      {description && (
        <div className="px-4 py-2 text-sm text-white/50 bg-[#0d0d20] border-b border-white/5">
          {description}
        </div>
      )}

      {/* Игровое поле */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-[#ff6b9d]/30 border-t-[#ff6b9d] animate-spin" />
            <div className="text-center">
              <p className="text-[#ff6b9d] font-semibold text-lg">Stefani пишет игру...</p>
              <p className="text-white/40 text-sm mt-1">Это занимает 10–30 секунд</p>
            </div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <Icon name="AlertCircle" size={48} className="text-red-400" />
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => generateGame(request, "", "create")}
              className="px-4 py-2 rounded-lg bg-[#ff6b9d] text-white hover:bg-[#ff6b9d]/80 transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            srcDoc={html}
            className="w-full h-full border-0"
            style={{ minHeight: "calc(100vh - 180px)" }}
            sandbox="allow-scripts allow-same-origin"
            title={title}
          />
        )}
      </div>

      {/* Панель редактирования */}
      <div className="border-t border-white/10 bg-[#0d0d20] p-3">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <input
            value={editInput}
            onChange={e => setEditInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Скажи Stefani что изменить... "добавь больше врагов", "сделай карту больше"'
            disabled={loading || editing}
            className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm placeholder:text-white/30 focus:outline-none focus:border-[#ff6b9d]/60 disabled:opacity-40"
          />
          <button
            onClick={handleEdit}
            disabled={!editInput.trim() || loading || editing}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#ff6b9d] text-white rounded-xl text-sm font-medium hover:bg-[#ff6b9d]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {editing ? (
              <Icon name="Loader2" size={16} className="animate-spin" />
            ) : (
              <Icon name="Wand2" size={16} />
            )}
            {editing ? "Изменяю..." : "Изменить"}
          </button>
        </div>
        <p className="text-center text-white/20 text-xs mt-2">
          Нажми Enter или кнопку — Stefani перепишет игру по твоему запросу
        </p>
      </div>
    </div>
  );
}
