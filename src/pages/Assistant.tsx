import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";

const CHAT_API = "https://functions.poehali.dev/0dd1813d-413c-4595-9a50-a307b6e38777";
const STEFANI_IMG = "https://cdn.poehali.dev/projects/eb4796b4-3ec9-42cb-87db-7dcd64d116d5/files/d9d0a338-db8b-4ee3-a7f1-b2571ce21cb8.jpg";

type Message = { role: "user" | "stefani"; text: string; time: string };

const GAME_SYSTEM = `Ты — Stefani, стратегический советник Галактической Империи (Galactic Empire).
Ты помогаешь игроку в браузерной космической стратегии.

Правила игры которые ты знаешь:
- Карта галактики: 14 планет. У каждой есть корабли, защита, производство ресурсов.
- 4 ресурса: Минералы (⛏️), Энергия (⚡), Кредиты (💰), Наука (🔬)
- Каждый ход: производство идёт с планет игрока, строятся корабли (1 корабль = 3 минерала каждые 2 хода)
- Флоты: выбери планету → выбери цель → нажми "Отправить флот". Слайдер задаёт количество.
- Бой: атакующие корабли × (1.5 если есть технология "Оружие") vs обороняющиеся + защита планеты
- Дерево технологий: Щиты (+2 защита), Двигатели (быстрее флоты), Оружие (+50% урон), Колонизация, Экономика (+1 кредит), Сенсоры
- ИИ-враг ходит каждые 3 хода — атакует нейтральные и планеты игрока
- Победа: захватить все вражеские планеты. Поражение: потерять все свои.

Советуй конкретно и по делу. Говори живо, с характером. Максимум 3-4 предложения на ответ.
Иногда добавляй военные метафоры или космическую тематику. Ты боевой советник, не добрая помощница.`;

const QUICK_TIPS = [
  "С чего начать игру?",
  "Какую технологию исследовать первой?",
  "Как победить врага?",
  "Сколько кораблей отправлять на атаку?",
  "Как быстро накопить ресурсы?",
];

export default function Assistant() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([{
    role: "stefani",
    text: "Командор, я Stefani — твой стратегический советник. Галактика не ждёт. Задавай вопросы по игре — отвечу чётко и по делу.",
    time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
  }]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const time = new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
    const newMsgs: Message[] = [...messages, { role: "user", text: text.trim(), time }];
    setMessages(newMsgs);
    setInput("");
    setIsTyping(true);

    try {
      const apiMessages = [
        { role: "system", content: GAME_SYSTEM },
        ...newMsgs.slice(-12).map(m => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.text,
        })),
      ];
      const res = await fetch(CHAT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs.slice(-12), mood: "focused" }),
      });
      const data = await res.json();
      const reply = data.reply || "Сигнал потерян. Повтори запрос, командор.";
      setMessages(prev => [...prev, {
        role: "stefani", text: reply,
        time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "stefani", text: "Помехи в канале связи. Попробуй ещё раз.",
        time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-screen bg-[#020814] flex flex-col text-white overflow-hidden">
      {/* Хедер */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0"
        style={{ background: "rgba(3,9,29,0.95)" }}>
        <button onClick={() => navigate(-1)} className="text-white/40 hover:text-white transition-colors">
          <Icon name="ArrowLeft" size={16} />
        </button>
        <img src={STEFANI_IMG} className="w-8 h-8 rounded-full object-cover border border-purple-500/50" />
        <div>
          <div className="font-mono font-bold text-sm text-purple-400">STEFANI</div>
          <div className="font-mono text-xs text-white/30">Стратегический советник</div>
        </div>
        <div className="flex-1" />
        <button onClick={() => navigate("/play")}
          className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg font-mono font-bold transition-all hover:scale-105"
          style={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", color: "#020814" }}>
          <Icon name="Sword" size={13} />
          В игру
        </button>
      </header>

      {/* Сообщения */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            {m.role === "stefani" && (
              <img src={STEFANI_IMG} className="w-8 h-8 rounded-full object-cover border border-purple-500/30 flex-shrink-0 mt-1" />
            )}
            <div className={`max-w-[75%] ${m.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              <div className="px-4 py-3 rounded-2xl text-sm font-mono leading-relaxed"
                style={m.role === "stefani"
                  ? { background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)", color: "#e2e8f0" }
                  : { background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.2)", color: "#e2e8f0" }}>
                {m.text}
              </div>
              <span className="text-xs text-white/20 font-mono px-1">{m.time}</span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-3">
            <img src={STEFANI_IMG} className="w-8 h-8 rounded-full object-cover border border-purple-500/30 flex-shrink-0" />
            <div className="flex items-center gap-1 px-4 py-3 rounded-2xl"
              style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)" }}>
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Быстрые подсказки */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: "none" }}>
        {QUICK_TIPS.map(tip => (
          <button key={tip} onClick={() => send(tip)} disabled={isTyping}
            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-mono transition-all hover:scale-105 disabled:opacity-40 whitespace-nowrap"
            style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)", color: "#c084fc" }}>
            {tip}
          </button>
        ))}
      </div>

      {/* Ввод */}
      <div className="px-4 pb-5 pt-2 flex-shrink-0">
        <div className="flex gap-2 items-end p-2 rounded-2xl"
          style={{ background: "rgba(3,9,29,0.95)", border: "1px solid rgba(124,58,237,0.2)" }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Спроси советника по стратегии..."
            rows={1}
            disabled={isTyping}
            className="flex-1 bg-transparent resize-none text-sm font-mono text-white placeholder:text-white/25 focus:outline-none px-2 py-1"
          />
          <button onClick={() => send(input)} disabled={!input.trim() || isTyping}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-110 disabled:opacity-30"
            style={input.trim() && !isTyping
              ? { background: "linear-gradient(135deg,#7c3aed,#ec4899)", color: "#fff" }
              : { background: "rgba(255,255,255,0.07)", color: "#fff" }}>
            <Icon name="Send" size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
