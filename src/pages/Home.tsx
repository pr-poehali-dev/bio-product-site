import { useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

const FEATURES = [
  { icon: "Globe2",       title: "Карта галактики",     desc: "14 планет, каждая со своим производством и защитой" },
  { icon: "Sword",        title: "Тактические бои",     desc: "Отправляй флоты, рассчитывай силы, управляй атаками" },
  { icon: "Zap",          title: "Дерево технологий",   desc: "6 ветвей: щиты, оружие, двигатели, экономика и другие" },
  { icon: "Bot",          title: "ИИ-советник Stefani", desc: "Спроси совет по стратегии прямо во время игры" },
  { icon: "TrendingUp",   title: "Прогрессия",          desc: "Строй корабли, захватывай системы, расширяй империю" },
  { icon: "ShieldCheck",  title: "Враги с ИИ",          desc: "Противник активно атакует, строит флот и захватывает планеты" },
];

const FACTIONS = [
  { name: "Терранская Империя",  color: "#06b6d4", desc: "Люди-первооткрыватели. Баланс между экономикой и военной мощью.", icon: "🌍" },
  { name: "Кратосский Альянс",   color: "#ef4444", desc: "Агрессивная раса воинов. Бонус к атаке, слабая экономика.", icon: "⚔️" },
  { name: "Нейтральные миры",    color: "#94a3b8", desc: "Независимые планеты. Ждут кто предложит лучшие условия.", icon: "🪐" },
];

export default function Home() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const stars = Array.from({ length: 250 }, () => ({
      x: Math.random() * cv.width,
      y: Math.random() * cv.height,
      r: Math.random() * 1.8,
      speed: 0.1 + Math.random() * 0.3,
      a: 0.3 + Math.random() * 0.7,
    }));

    // Летящие планеты-декорации
    const orbs = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random() * cv.width,
      y: 80 + i * 120,
      r: 20 + Math.random() * 40,
      color: ["#06b6d4","#8b5cf6","#ef4444","#22c55e","#f59e0b","#ec4899"][i],
      speed: 0.2 + Math.random() * 0.4,
    }));

    let t = 0;
    const draw = () => {
      ctx.fillStyle = "#020814";
      ctx.fillRect(0, 0, cv.width, cv.height);

      // Туманность
      const grd = ctx.createRadialGradient(cv.width * 0.5, cv.height * 0.4, 0, cv.width * 0.5, cv.height * 0.4, cv.width * 0.6);
      grd.addColorStop(0, "rgba(139,92,246,0.06)");
      grd.addColorStop(0.5, "rgba(6,182,212,0.04)");
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, cv.width, cv.height);

      // Звёзды
      stars.forEach(s => {
        ctx.globalAlpha = s.a * (0.7 + 0.3 * Math.sin(t * s.speed));
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Орбы
      orbs.forEach(o => {
        o.x -= o.speed;
        if (o.x < -o.r * 2) o.x = cv.width + o.r;
        const g = ctx.createRadialGradient(o.x - o.r * 0.3, o.y - o.r * 0.3, o.r * 0.1, o.x, o.y, o.r);
        g.addColorStop(0, o.color + "cc");
        g.addColorStop(1, o.color + "22");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
      });

      t += 0.02;
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div className="min-h-screen bg-[#020814] text-white overflow-x-hidden">
      {/* Фоновый canvas */}
      <canvas ref={canvasRef} width={1200} height={800}
        className="fixed inset-0 w-full h-full pointer-events-none opacity-70" style={{ zIndex: 0 }} />

      {/* Навбар */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/10"
        style={{ background: "rgba(2,8,20,0.8)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚔</span>
          <span className="font-mono font-bold text-lg tracking-wider" style={{ color: "#06b6d4" }}>GALACTIC EMPIRE</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/assistant")}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-purple-500/30 text-purple-400 hover:border-purple-500 transition-all">
            <Icon name="Bot" size={15} />
            Советник Stefani
          </button>
          <button onClick={() => navigate("/play")}
            className="flex items-center gap-2 text-sm px-5 py-2 rounded-lg font-bold transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", color: "#020814" }}>
            <Icon name="Play" size={15} />
            Играть
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-16">
        <div className="font-mono text-xs tracking-[0.5em] text-cyan-400/50 mb-4">БРАУЗЕРНАЯ СТРАТЕГИЯ · 2026</div>
        <h1 className="font-mono font-black text-5xl md:text-7xl mb-4 leading-tight"
          style={{ textShadow: "0 0 60px rgba(6,182,212,0.4)" }}>
          GALACTIC<br />
          <span style={{ color: "#06b6d4" }}>EMPIRE</span>
        </h1>
        <p className="text-white/50 text-lg max-w-lg mb-2 font-mono">
          Космическая стратегия в реальном времени прямо в браузере
        </p>
        <p className="text-white/30 text-sm max-w-md mb-10 font-mono">
          Захватывай планеты · Строй флоты · Исследуй технологии · Покори галактику
        </p>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <button onClick={() => navigate("/play")}
            className="flex items-center gap-3 px-8 py-4 rounded-xl font-mono font-bold text-lg transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", color: "#020814", boxShadow: "0 0 40px rgba(6,182,212,0.4)" }}>
            <Icon name="Rocket" size={20} />
            Начать кампанию
          </button>
          <button onClick={() => navigate("/assistant")}
            className="flex items-center gap-3 px-6 py-4 rounded-xl font-mono text-sm border border-purple-500/30 text-purple-400 hover:border-purple-500 transition-all">
            <Icon name="Bot" size={18} />
            Спросить советника
          </button>
        </div>
      </section>

      {/* Превью игры */}
      <section className="relative z-10 px-6 pb-16">
        <div className="max-w-4xl mx-auto rounded-2xl overflow-hidden border border-cyan-500/20"
          style={{ background: "rgba(6,182,212,0.04)", boxShadow: "0 0 60px rgba(6,182,212,0.1)" }}>
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="font-mono text-xs text-white/30 ml-2">galactic-empire.play</span>
          </div>
          <div className="p-6 font-mono text-sm space-y-3">
            <div className="flex gap-6">
              <div className="flex-1 space-y-2">
                <div className="text-cyan-400 text-xs tracking-wider">КАРТА ГАЛАКТИКИ</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {["🌍","🪐","⭕","🔴","🟤","🔵","⭕","🔴","🟣","🌑"].map((p,i)=>(
                    <div key={i} className="aspect-square rounded-lg flex items-center justify-center text-lg"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>{p}</div>
                  ))}
                </div>
              </div>
              <div className="w-48 space-y-2">
                <div className="text-cyan-400 text-xs tracking-wider">РЕСУРСЫ</div>
                {[["⛏️ Минералы","124"],["⚡ Энергия","89"],["💰 Кредиты","67"],["🔬 Наука","34"]].map(([k,v])=>(
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-white/50">{k}</span>
                    <span className="text-cyan-400">{v}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-white/10">
                  <div className="text-white/30 text-xs mb-1">Ход 7 из ∞</div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500" style={{width:"42%"}} />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 text-xs">
              <div className="flex-1 p-2 rounded-lg" style={{background:"rgba(6,182,212,0.08)",border:"1px solid rgba(6,182,212,0.2)"}}>
                🚀 Флот (12 истребителей): Нова Терра → Кратос
              </div>
              <div className="flex-1 p-2 rounded-lg" style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)"}}>
                ⚔️ Бой на Аурелии: Победа! (+150 очков)
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Фракции */}
      <section className="relative z-10 px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="font-mono text-xs text-white/30 tracking-[0.4em] mb-2">ФРАКЦИИ</div>
            <h2 className="font-mono font-bold text-2xl">Силы галактики</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FACTIONS.map(f => (
              <div key={f.name} className="p-5 rounded-xl border transition-all hover:-translate-y-1"
                style={{ background: `${f.color}08`, borderColor: `${f.color}25`, boxShadow: `0 4px 20px ${f.color}10` }}>
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-mono font-bold mb-2" style={{ color: f.color }}>{f.name}</h3>
                <p className="text-white/50 text-sm font-mono leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Возможности */}
      <section className="relative z-10 px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="font-mono text-xs text-white/30 tracking-[0.4em] mb-2">ГЕЙМПЛЕЙ</div>
            <h2 className="font-mono font-bold text-2xl">Что тебя ждёт</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {FEATURES.map(f => (
              <div key={f.title} className="p-4 rounded-xl border border-white/8 hover:border-cyan-500/20 transition-all"
                style={{ background: "rgba(6,15,35,0.6)" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: "linear-gradient(135deg,rgba(6,182,212,0.2),rgba(139,92,246,0.2))" }}>
                  <Icon name={f.icon as Parameters<typeof Icon>[0]["name"]} size={20} className="text-cyan-400" />
                </div>
                <h3 className="font-mono font-bold text-sm text-white mb-1">{f.title}</h3>
                <p className="text-white/40 text-xs font-mono leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 pb-20 text-center">
        <div className="max-w-lg mx-auto p-8 rounded-2xl border border-cyan-500/20"
          style={{ background: "rgba(6,182,212,0.05)" }}>
          <h2 className="font-mono font-bold text-2xl mb-3">Готов к завоеванию?</h2>
          <p className="text-white/40 font-mono text-sm mb-6">Галактика ждёт своего императора. Начни прямо сейчас.</p>
          <button onClick={() => navigate("/play")}
            className="px-10 py-4 rounded-xl font-mono font-bold text-lg transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", color: "#020814", boxShadow: "0 0 40px rgba(6,182,212,0.3)" }}>
            ⚔ Начать игру
          </button>
        </div>
        <div className="mt-10 font-mono text-white/10 text-xs tracking-widest">
          GALACTIC EMPIRE · БРАУЗЕРНАЯ СТРАТЕГИЯ · {new Date().getFullYear()}
        </div>
      </section>
    </div>
  );
}
