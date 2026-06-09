import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

interface NameModalProps {
  onSave: (name: string) => void;
}

export default function NameModal({ onSave }: NameModalProps) {
  const [name, setName] = useState("");
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    }, 300);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = () => {
    const n = name.trim();
    onSave(n || "");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") onSave("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        background: "rgba(5,10,20,0.85)",
        backdropFilter: "blur(12px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s ease",
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-5"
        style={{
          background: "linear-gradient(135deg, rgba(6,18,40,0.98), rgba(12,8,30,0.98))",
          border: "1px solid rgba(6,182,212,0.35)",
          boxShadow: "0 0 60px rgba(6,182,212,0.15), 0 0 120px rgba(139,92,246,0.08)",
          transform: visible ? "translateY(0) scale(1)" : "translateY(20px) scale(0.95)",
          transition: "transform 0.4s ease",
        }}
      >
        {/* Аватар */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <img
              src="https://cdn.poehali.dev/projects/eb4796b4-3ec9-42cb-87db-7dcd64d116d5/files/d9d0a338-db8b-4ee3-a7f1-b2571ce21cb8.jpg"
              alt="Stefani"
              className="w-20 h-20 rounded-full object-cover"
              style={{
                border: "2px solid rgba(6,182,212,0.6)",
                boxShadow: "0 0 24px rgba(6,182,212,0.3)",
              }}
            />
            <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-green-400 border-2 border-[#050a14] animate-pulse" />
          </div>
          <div className="text-center">
            <div className="font-orbitron font-bold text-white text-lg">Привет, я Stefani</div>
            <div className="text-sm font-rajdhani text-white/50 mt-1">Как мне к тебе обращаться?</div>
          </div>
        </div>

        {/* Инпут имени */}
        <div className="relative">
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Твоё имя..."
            maxLength={30}
            className="w-full px-4 py-3 rounded-xl bg-transparent text-white placeholder-white/25 outline-none font-rajdhani text-base"
            style={{
              border: "1px solid rgba(6,182,212,0.4)",
              background: "rgba(6,182,212,0.05)",
              boxShadow: name ? "0 0 12px rgba(6,182,212,0.15)" : "none",
              transition: "all 0.2s",
            }}
          />
          {name && (
            <button
              onClick={() => setName("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              <Icon name="X" size={14} />
            </button>
          )}
        </div>

        {/* Кнопки */}
        <div className="flex gap-3">
          <button
            onClick={() => onSave("")}
            className="flex-1 py-2.5 rounded-xl text-sm font-rajdhani font-medium text-white/40 hover:text-white/60 transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Пропустить
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-xl text-sm font-orbitron font-bold text-[#050a14] transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
              boxShadow: "0 0 20px rgba(6,182,212,0.35)",
            }}
          >
            Поехали
          </button>
        </div>
      </div>
    </div>
  );
}
