import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "@/components/ui/icon";

// ── Типы ──────────────────────────────────────────────────────────────────
type PlanetType = "home" | "colony" | "enemy" | "neutral" | "ruins";
type ShipClass = "fighter" | "cruiser" | "battleship" | "scout";
type ResourceType = "minerals" | "energy" | "research" | "credits";

interface Planet {
  id: number;
  name: string;
  x: number;
  y: number;
  type: PlanetType;
  size: number;
  color: string;
  ships: number;
  maxShips: number;
  production: Partial<Record<ResourceType, number>>;
  defense: number;
  level: number;
  owner: "player" | "enemy" | "neutral";
}

interface Fleet {
  id: number;
  fromId: number;
  toId: number;
  ships: number;
  progress: number; // 0..1
  owner: "player" | "enemy";
  shipClass: ShipClass;
}

interface Resources {
  minerals: number;
  energy: number;
  research: number;
  credits: number;
}

interface GameState {
  turn: number;
  phase: "map" | "battle" | "victory" | "defeat";
  selectedPlanet: number | null;
  targetPlanet: number | null;
  fleets: Fleet[];
  resources: Resources;
  planets: Planet[];
  log: string[];
  tech: string[];
  score: number;
}

// ── Данные планет ──────────────────────────────────────────────────────────
const PLANET_NAMES = [
  "Аурелия", "Кратос", "Вегенар", "Солис", "Нова Терра",
  "Экзион", "Марквар", "Целестия", "Дракониус", "Тенебрис",
  "Хелиос", "Ригель", "Антарес", "Кронус", "Зефир",
  "Орион", "Кассиопея", "Вега", "Альтаир", "Сириус",
];

const PLANET_COLORS: Record<PlanetType, string[]> = {
  home:    ["#06b6d4", "#0ea5e9"],
  colony:  ["#22c55e", "#16a34a"],
  enemy:   ["#ef4444", "#dc2626"],
  neutral: ["#94a3b8", "#64748b"],
  ruins:   ["#f59e0b", "#d97706"],
};

function generateGalaxy(): Planet[] {
  const planets: Planet[] = [];
  const usedPositions: {x:number;y:number}[] = [];

  const tryPos = (): {x:number;y:number} => {
    for (let i = 0; i < 100; i++) {
      const x = 80 + Math.random() * 840;
      const y = 80 + Math.random() * 540;
      if (usedPositions.every(p => Math.hypot(p.x - x, p.y - y) > 90)) {
        return {x, y};
      }
    }
    return {x: 80 + Math.random() * 840, y: 80 + Math.random() * 540};
  };

  // Домашняя планета игрока
  const homePos = {x: 150, y: 350};
  usedPositions.push(homePos);
  planets.push({
    id: 0, name: "Нова Терра", x: homePos.x, y: homePos.y,
    type: "home", size: 28, color: PLANET_COLORS.home[0],
    ships: 15, maxShips: 50, defense: 5, level: 1, owner: "player",
    production: { minerals: 4, energy: 3, credits: 2, research: 1 },
  });

  // Главная база врага
  const enemyPos = {x: 820, y: 250};
  usedPositions.push(enemyPos);
  planets.push({
    id: 1, name: "Кратос Прайм", x: enemyPos.x, y: enemyPos.y,
    type: "enemy", size: 30, color: PLANET_COLORS.enemy[0],
    ships: 20, maxShips: 60, defense: 8, level: 2, owner: "enemy",
    production: { minerals: 5, energy: 4, credits: 3, research: 2 },
  });

  // Остальные планеты
  const types: PlanetType[] = ["neutral","neutral","neutral","neutral","ruins","neutral","neutral","enemy","ruins","neutral","neutral","enemy"];
  for (let i = 0; i < 12; i++) {
    const pos = tryPos();
    usedPositions.push(pos);
    const type = types[i];
    const colorArr = PLANET_COLORS[type];
    const col = colorArr[Math.floor(Math.random() * colorArr.length)];
    const isEnemy = type === "enemy";
    planets.push({
      id: i + 2,
      name: PLANET_NAMES[i],
      x: pos.x, y: pos.y,
      type,
      size: 16 + Math.floor(Math.random() * 14),
      color: col,
      ships: isEnemy ? 5 + Math.floor(Math.random() * 10) : Math.floor(Math.random() * 4),
      maxShips: 20 + Math.floor(Math.random() * 30),
      defense: Math.floor(Math.random() * 5),
      level: 1,
      owner: isEnemy ? "enemy" : (type === "ruins" ? "neutral" : "neutral"),
      production: {
        minerals: 1 + Math.floor(Math.random() * 4),
        energy: 1 + Math.floor(Math.random() * 3),
        credits: Math.floor(Math.random() * 3),
        research: Math.floor(Math.random() * 2),
      },
    });
  }
  return planets;
}

const INITIAL_RESOURCES: Resources = { minerals: 50, energy: 40, credits: 30, research: 10 };

const TECH_TREE = [
  { id: "shields",    name: "Щиты",          cost: 20, desc: "+2 защита всех планет" },
  { id: "engines",    name: "Двигатели",      cost: 25, desc: "Флоты движутся быстрее" },
  { id: "weapons",    name: "Оружие",         cost: 30, desc: "+50% урон в бою" },
  { id: "colony",     name: "Колонизация",    cost: 15, desc: "Захватывай руины быстрее" },
  { id: "economy",    name: "Экономика",      cost: 20, desc: "+1 кредит с каждой планеты" },
  { id: "sensors",    name: "Сенсоры",        cost: 10, desc: "Видишь силы врага" },
];

// ── Компонент ──────────────────────────────────────────────────────────────
export default function Play() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const starsRef = useRef<{x:number;y:number;r:number;a:number}[]>([]);

  const [gs, setGs] = useState<GameState>(() => ({
    turn: 1,
    phase: "map",
    selectedPlanet: null,
    targetPlanet: null,
    fleets: [],
    resources: { ...INITIAL_RESOURCES },
    planets: generateGalaxy(),
    log: ["👑 Галактическая Империя основана. Выбери планету и начни завоевание!"],
    tech: [],
    score: 0,
  }));

  const [tab, setTab] = useState<"map" | "tech" | "log">("map");
  const [sendCount, setSendCount] = useState(5);
  const [showTechModal, setShowTechModal] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  // Генерируем звёзды один раз
  useEffect(() => {
    starsRef.current = Array.from({length: 180}, () => ({
      x: Math.random() * 1000,
      y: Math.random() * 700,
      r: Math.random() * 1.5,
      a: 0.2 + Math.random() * 0.8,
    }));
  }, []);

  // Рисуем canvas
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#020814";
    ctx.fillRect(0, 0, 1000, 700);

    // Звёзды
    starsRef.current.forEach(s => {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Маршруты между планетами (тонкие линии)
    setGs(prev => {
      const { planets, fleets, selectedPlanet, targetPlanet } = prev;

      // Линии потенциальных маршрутов
      planets.forEach(a => {
        planets.forEach(b => {
          if (b.id <= a.id) return;
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 250) {
            ctx.strokeStyle = "rgba(6,182,212,0.06)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        });
      });

      // Линия выбранной планеты
      if (selectedPlanet !== null) {
        const sel = planets.find(p => p.id === selectedPlanet);
        if (sel) {
          planets.forEach(p => {
            if (p.id === sel.id) return;
            ctx.strokeStyle = p.id === targetPlanet ? "rgba(6,182,212,0.6)" : "rgba(6,182,212,0.15)";
            ctx.lineWidth = p.id === targetPlanet ? 2 : 1;
            ctx.setLineDash([4, 6]);
            ctx.beginPath();
            ctx.moveTo(sel.x, sel.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            ctx.setLineDash([]);
          });
        }
      }

      // Флоты
      fleets.forEach(f => {
        const from = planets.find(p => p.id === f.fromId);
        const to   = planets.find(p => p.id === f.toId);
        if (!from || !to) return;
        const fx = from.x + (to.x - from.x) * f.progress;
        const fy = from.y + (to.y - from.y) * f.progress;

        // Хвост
        ctx.strokeStyle = f.owner === "player" ? "rgba(6,182,212,0.5)" : "rgba(239,68,68,0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fx - (to.x - from.x) * 0.08, fy - (to.y - from.y) * 0.08);
        ctx.lineTo(fx, fy);
        ctx.stroke();

        // Кораблик
        ctx.fillStyle = f.owner === "player" ? "#06b6d4" : "#ef4444";
        ctx.beginPath();
        ctx.arc(fx, fy, 5, 0, Math.PI * 2);
        ctx.fill();

        // Количество
        ctx.fillStyle = "#fff";
        ctx.font = "bold 10px monospace";
        ctx.fillText(String(f.ships), fx + 7, fy - 5);
      });

      // Планеты
      planets.forEach(p => {
        const isSelected = p.id === selectedPlanet;
        const isHovered  = p.id === hovered;
        const isTarget   = p.id === targetPlanet;

        // Ореол выбора
        if (isSelected) {
          ctx.strokeStyle = "#06b6d4";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size + 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (isTarget) {
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size + 8, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Свечение
        if (isHovered || isSelected) {
          const grd = ctx.createRadialGradient(p.x, p.y, p.size * 0.5, p.x, p.y, p.size * 2.5);
          grd.addColorStop(0, p.color + "44");
          grd.addColorStop(1, "transparent");
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Сама планета
        const grd = ctx.createRadialGradient(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.1, p.x, p.y, p.size);
        grd.addColorStop(0, p.color + "ff");
        grd.addColorStop(1, p.color + "66");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Кольцо владельца
        ctx.strokeStyle =
          p.owner === "player" ? "#06b6d4" :
          p.owner === "enemy"  ? "#ef4444" : "#64748b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + 2, 0, Math.PI * 2);
        ctx.stroke();

        // Название
        ctx.fillStyle = "#e2e8f0";
        ctx.font = `bold ${p.type === "home" ? 12 : 10}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(p.name, p.x, p.y + p.size + 14);

        // Кораблики
        if (p.ships > 0) {
          ctx.fillStyle = p.owner === "player" ? "#06b6d4" : p.owner === "enemy" ? "#fca5a5" : "#94a3b8";
          ctx.font = "bold 11px monospace";
          ctx.fillText(`⚔ ${p.ships}`, p.x, p.y + 4);
        }
        ctx.textAlign = "left";
      });

      return prev;
    });

    animRef.current = requestAnimationFrame(draw);
  }, [hovered]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  // ── Клик по канвасу ──
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = 1000 / rect.width;
    const scaleY = 700 / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    setGs(prev => {
      const clicked = prev.planets.find(p => Math.hypot(p.x - mx, p.y - my) < p.size + 10);

      if (!clicked) return { ...prev, selectedPlanet: null, targetPlanet: null };

      // Нет выбранной — выбираем
      if (prev.selectedPlanet === null) {
        if (clicked.owner !== "player") return prev;
        return { ...prev, selectedPlanet: clicked.id, targetPlanet: null };
      }

      const sel = prev.planets.find(p => p.id === prev.selectedPlanet)!;

      // Кликнули по той же — снимаем выбор
      if (clicked.id === prev.selectedPlanet) return { ...prev, selectedPlanet: null, targetPlanet: null };

      // Выбираем цель
      if (prev.targetPlanet === null) {
        return { ...prev, targetPlanet: clicked.id };
      }

      // Уже выбрана цель — если кликнули ещё раз по ней = отправляем флот
      if (clicked.id === prev.targetPlanet) {
        return sendFleet(prev, sel, clicked);
      }

      // Другая планета — меняем цель
      return { ...prev, targetPlanet: clicked.id };
    });
  };

  // ── Наведение ──
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (1000 / rect.width);
    const my = (e.clientY - rect.top) * (700 / rect.height);
    const h = gs.planets.find(p => Math.hypot(p.x - mx, p.y - my) < p.size + 10);
    setHovered(h ? h.id : null);
  };

  // ── Отправить флот ──
  function sendFleet(prev: GameState, from: Planet, to: Planet): GameState {
    if (from.ships < 2) {
      return { ...prev, log: [`⚠️ Недостаточно кораблей на ${from.name}`, ...prev.log.slice(0, 29)] };
    }
    const count = Math.min(sendCount, from.ships - 1);
    const newFleet: Fleet = {
      id: Date.now(),
      fromId: from.id,
      toId: to.id,
      ships: count,
      progress: 0,
      owner: "player",
      shipClass: "fighter",
    };
    const planets = prev.planets.map(p =>
      p.id === from.id ? { ...p, ships: p.ships - count } : p
    );
    return {
      ...prev,
      planets,
      fleets: [...prev.fleets, newFleet],
      selectedPlanet: null,
      targetPlanet: null,
      log: [`🚀 Отправлено ${count} кораблей: ${from.name} → ${to.name}`, ...prev.log.slice(0, 29)],
    };
  }

  // ── Следующий ход ──
  const nextTurn = () => {
    setGs(prev => {
      const { planets, fleets, resources, turn, log, score, tech } = prev;
      const newLog = [...log];
      let newScore = score;

      // Двигаем флоты
      const speed = tech.includes("engines") ? 0.12 : 0.08;
      const arrivedFleets: Fleet[] = [];
      const activeFleets = fleets.map(f => {
        const np = Math.min(1, f.progress + speed);
        if (np >= 1) { arrivedFleets.push({ ...f, progress: 1 }); return null; }
        return { ...f, progress: np };
      }).filter(Boolean) as Fleet[];

      // Разрешаем прибытие флотов
      let newPlanets = [...planets];
      arrivedFleets.forEach(f => {
        const toIdx = newPlanets.findIndex(p => p.id === f.toId);
        if (toIdx === -1) return;
        const target = newPlanets[toIdx];

        if (target.owner === f.owner) {
          // Подкрепление
          newPlanets[toIdx] = { ...target, ships: Math.min(target.maxShips, target.ships + f.ships) };
          newLog.unshift(`✅ Подкрепление прибыло на ${target.name} (+${f.ships})`);
        } else {
          // Бой
          const atkBonus = tech.includes("weapons") ? 1.5 : 1.0;
          const defBonus = target.defense + (tech.includes("shields") ? 2 : 0);
          const attackPower = Math.floor(f.ships * atkBonus);
          const defensePower = target.ships + defBonus;

          if (attackPower > defensePower) {
            const remaining = Math.max(1, Math.floor((attackPower - defensePower) / 2));
            const newOwner = f.owner;
            const newType: PlanetType = newOwner === "player" ? "colony" : "enemy";
            newPlanets[toIdx] = {
              ...target,
              owner: newOwner,
              ships: remaining,
              type: newType,
              color: PLANET_COLORS[newType][0],
            };
            if (f.owner === "player") {
              newLog.unshift(`🏆 ${target.name} завоёвана! (${remaining} кораблей)`);
              newScore += 100 * target.level;
            } else {
              newLog.unshift(`💀 ${target.name} захвачена врагом!`);
            }
          } else {
            const remaining = Math.max(1, target.ships + defBonus - attackPower);
            newPlanets[toIdx] = { ...target, ships: remaining };
            newLog.unshift(`💥 Атака на ${target.name} отражена (осталось ${remaining})`);
          }
        }
      });

      // Производство
      const prod: Resources = { minerals: 0, energy: 0, credits: 0, research: 0 };
      let playerPlanets = 0;
      newPlanets.forEach(p => {
        if (p.owner === "player") {
          playerPlanets++;
          (Object.keys(p.production) as ResourceType[]).forEach(r => {
            prod[r] += (p.production[r] || 0) + (r === "credits" && tech.includes("economy") ? 1 : 0);
          });
        }
      });

      const newRes: Resources = {
        minerals: Math.min(999, resources.minerals + prod.minerals),
        energy:   Math.min(999, resources.energy   + prod.energy),
        credits:  Math.min(999, resources.credits  + prod.credits),
        research: Math.min(999, resources.research + prod.research),
      };

      // Производство кораблей (1 корабль каждые 2 хода за 3 минерала)
      if (turn % 2 === 0) {
        newPlanets = newPlanets.map(p => {
          if (p.owner === "player" && p.ships < p.maxShips && newRes.minerals >= 3) {
            newRes.minerals -= 3;
            return { ...p, ships: p.ships + 1 };
          }
          return p;
        });
      }

      // ИИ врага — отправляет флоты к нейтральным и игроку
      if (turn % 3 === 0) {
        const enemyPlanets = newPlanets.filter(p => p.owner === "enemy" && p.ships > 5);
        const targetPlanets = newPlanets.filter(p => p.owner !== "enemy");
        if (enemyPlanets.length && targetPlanets.length) {
          const ep = enemyPlanets[Math.floor(Math.random() * enemyPlanets.length)];
          const tp = targetPlanets[Math.floor(Math.random() * targetPlanets.length)];
          const sendShips = Math.floor(ep.ships * 0.6);
          if (sendShips > 0) {
            activeFleets.push({
              id: Date.now() + Math.random(),
              fromId: ep.id, toId: tp.id,
              ships: sendShips, progress: 0,
              owner: "enemy", shipClass: "fighter",
            });
            const epIdx = newPlanets.findIndex(p => p.id === ep.id);
            newPlanets[epIdx] = { ...newPlanets[epIdx], ships: newPlanets[epIdx].ships - sendShips };
          }
        }
        // Враг строит корабли
        newPlanets = newPlanets.map(p =>
          p.owner === "enemy" && p.ships < p.maxShips
            ? { ...p, ships: Math.min(p.maxShips, p.ships + 2) }
            : p
        );
      }

      // Проверка победы/поражения
      const playerHasPlanets = newPlanets.some(p => p.owner === "player");
      const enemyHasPlanets  = newPlanets.some(p => p.owner === "enemy");
      let phase: GameState["phase"] = "map";
      if (!playerHasPlanets) phase = "defeat";
      else if (!enemyHasPlanets) phase = "victory";

      return {
        ...prev,
        turn: turn + 1,
        phase,
        fleets: activeFleets,
        planets: newPlanets,
        resources: newRes,
        log: newLog.slice(0, 30),
        score: newScore + playerPlanets * 5,
      };
    });
  };

  // ── Исследование технологии ──
  const researchTech = (techId: string) => {
    const t = TECH_TREE.find(t => t.id === techId);
    if (!t) return;
    setGs(prev => {
      if (prev.tech.includes(techId) || prev.resources.research < t.cost) return prev;
      return {
        ...prev,
        tech: [...prev.tech, techId],
        resources: { ...prev.resources, research: prev.resources.research - t.cost },
        log: [`🔬 Технология "${t.name}" исследована!`, ...prev.log.slice(0, 29)],
      };
    });
    setShowTechModal(false);
  };

  const sel  = gs.planets.find(p => p.id === gs.selectedPlanet);
  const tgt  = gs.planets.find(p => p.id === gs.targetPlanet);
  const playerPlanets = gs.planets.filter(p => p.owner === "player").length;
  const totalPlanets  = gs.planets.length;

  const RESOURCE_ICONS: Record<ResourceType, string> = {
    minerals: "⛏️", energy: "⚡", credits: "💰", research: "🔬",
  };

  if (gs.phase === "victory" || gs.phase === "defeat") {
    return (
      <div className="min-h-screen bg-[#020814] flex flex-col items-center justify-center text-white">
        <div className="text-center p-12 rounded-2xl border"
          style={{ background: "rgba(6,15,35,0.95)", borderColor: gs.phase === "victory" ? "#06b6d4" : "#ef4444" }}>
          <div className="text-6xl mb-4">{gs.phase === "victory" ? "🏆" : "💀"}</div>
          <h1 className="font-mono text-3xl font-bold mb-2"
            style={{ color: gs.phase === "victory" ? "#06b6d4" : "#ef4444" }}>
            {gs.phase === "victory" ? "ГАЛАКТИКА ПОКОРЕНА!" : "ИМПЕРИЯ ПАЛА"}
          </h1>
          <p className="text-white/60 mb-2">Ход: {gs.turn} · Счёт: {gs.score.toLocaleString()}</p>
          <p className="text-white/40 text-sm mb-8">{gs.phase === "victory" ? "Ты завоевал все вражеские планеты" : "Все твои планеты захвачены"}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setGs(s => ({ ...s, turn: 1, phase: "map", fleets: [], resources: { ...INITIAL_RESOURCES }, planets: generateGalaxy(), log: ["👑 Новая кампания начата!"], tech: [], score: 0 }))}
              className="px-6 py-3 rounded-xl font-mono font-bold transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", color: "#020814" }}>
              Новая игра
            </button>
            <button onClick={() => navigate("/")}
              className="px-6 py-3 rounded-xl font-mono border border-white/20 hover:border-white/50 transition-all">
              На главную
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#020814] flex flex-col overflow-hidden text-white">
      {/* ── Хедер ── */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-white/10 bg-[#03091d] flex-shrink-0">
        <button onClick={() => navigate("/")} className="text-white/40 hover:text-white transition-colors">
          <Icon name="ArrowLeft" size={16} />
        </button>
        <div className="font-mono text-cyan-400 font-bold text-sm tracking-wider">⚔ GALACTIC EMPIRE</div>
        <div className="text-white/30 text-xs font-mono">ХОД {gs.turn}</div>
        <div className="flex-1" />
        {/* Ресурсы */}
        <div className="flex gap-3 text-xs font-mono">
          {(["minerals","energy","credits","research"] as ResourceType[]).map(r => (
            <span key={r} className="flex items-center gap-1">
              <span>{RESOURCE_ICONS[r]}</span>
              <span style={{ color: r === "minerals" ? "#94a3b8" : r === "energy" ? "#fbbf24" : r === "credits" ? "#22c55e" : "#c084fc" }}>
                {gs.resources[r]}
              </span>
            </span>
          ))}
        </div>
        <div className="text-white/30 text-xs font-mono hidden md:block">
          🏛 {playerPlanets}/{totalPlanets} · 🏆 {gs.score}
        </div>
        <button onClick={() => navigate("/assistant")}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-purple-500/30 text-purple-400 hover:border-purple-500 transition-all">
          <Icon name="Bot" size={13} />
          Советник
        </button>
      </header>

      {/* ── Основной контент ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Карта ── */}
        <div className="flex-1 relative overflow-hidden">
          <canvas
            ref={canvasRef}
            width={1000} height={700}
            className="w-full h-full cursor-crosshair"
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
          />

          {/* Подсказка */}
          {!sel && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs font-mono text-white/30 pointer-events-none">
              Нажми на свою планету → выбери цель → нажми ещё раз для атаки
            </div>
          )}
        </div>

        {/* ── Правая панель ── */}
        <aside className="w-64 flex-shrink-0 border-l border-white/10 bg-[#03091d] flex flex-col overflow-hidden">
          {/* Вкладки */}
          <div className="flex border-b border-white/10">
            {(["map","tech","log"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 py-2 text-xs font-mono transition-colors"
                style={{ color: tab === t ? "#06b6d4" : "rgba(255,255,255,0.35)", borderBottom: tab === t ? "2px solid #06b6d4" : "2px solid transparent" }}>
                {t === "map" ? "КАРТА" : t === "tech" ? "НАУКА" : "ЛОГ"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {tab === "map" && (
              <>
                {/* Выбранная планета */}
                {sel ? (
                  <div className="rounded-xl p-3 border" style={{ background: "rgba(6,182,212,0.08)", borderColor: "rgba(6,182,212,0.3)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: sel.color }} />
                      <span className="font-mono font-bold text-cyan-400 text-sm">{sel.name}</span>
                    </div>
                    <div className="space-y-1 text-xs font-mono text-white/60">
                      <div>⚔ Корабли: <span className="text-white">{sel.ships}/{sel.maxShips}</span></div>
                      <div>🛡 Защита: <span className="text-white">{sel.defense}</span></div>
                      <div>⭐ Уровень: <span className="text-white">{sel.level}</span></div>
                      <div className="text-white/40 text-xs">Производство:</div>
                      {(Object.entries(sel.production) as [ResourceType, number][]).map(([r, v]) => (
                        <div key={r}>{RESOURCE_ICONS[r]} {v}/ход</div>
                      ))}
                    </div>
                    {tgt && (
                      <div className="mt-3 pt-2 border-t border-white/10">
                        <div className="text-xs font-mono text-amber-400 mb-2">→ {tgt.name} ({tgt.owner === "player" ? "свой" : tgt.owner === "enemy" ? "враг" : "нейтрал"})</div>
                        <div className="flex items-center gap-2 mb-2">
                          <input type="range" min={1} max={sel.ships - 1} value={sendCount}
                            onChange={e => setSendCount(+e.target.value)}
                            className="flex-1 accent-cyan-400" />
                          <span className="text-xs font-mono text-cyan-400 w-6 text-right">{sendCount}</span>
                        </div>
                        <button
                          onClick={() => setGs(prev => {
                            if (!sel || !tgt) return prev;
                            return sendFleet(prev, sel, tgt);
                          })}
                          className="w-full py-1.5 rounded-lg text-xs font-mono font-bold transition-all hover:scale-105"
                          style={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", color: "#020814" }}>
                          🚀 Отправить флот
                        </button>
                      </div>
                    )}
                    {!tgt && <p className="text-xs text-white/30 font-mono mt-2">Нажми на цель на карте</p>}
                  </div>
                ) : (
                  <div className="text-xs font-mono text-white/30 text-center py-4">
                    Выбери свою планету на карте
                  </div>
                )}

                {/* Список планет */}
                <div className="space-y-1">
                  <div className="text-xs font-mono text-white/30 mb-1">ПЛАНЕТЫ ИМПЕРИИ</div>
                  {gs.planets.filter(p => p.owner === "player").map(p => (
                    <button key={p.id}
                      onClick={() => setGs(prev => ({ ...prev, selectedPlanet: p.id, targetPlanet: null }))}
                      className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all hover:bg-white/5"
                      style={{ border: gs.selectedPlanet === p.id ? "1px solid rgba(6,182,212,0.5)" : "1px solid transparent" }}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                      <span className="text-xs font-mono text-white/80 flex-1 truncate">{p.name}</span>
                      <span className="text-xs font-mono text-cyan-400">⚔{p.ships}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {tab === "tech" && (
              <div className="space-y-2">
                <div className="text-xs font-mono text-white/30 mb-2">🔬 Наука: {gs.resources.research}</div>
                {TECH_TREE.map(t => {
                  const done = gs.tech.includes(t.id);
                  const canResearch = !done && gs.resources.research >= t.cost;
                  return (
                    <button key={t.id}
                      onClick={() => canResearch && researchTech(t.id)}
                      disabled={done || !canResearch}
                      className="w-full p-2.5 rounded-lg text-left transition-all"
                      style={{
                        background: done ? "rgba(34,197,94,0.1)" : canResearch ? "rgba(6,182,212,0.08)" : "rgba(255,255,255,0.03)",
                        border: done ? "1px solid rgba(34,197,94,0.3)" : canResearch ? "1px solid rgba(6,182,212,0.3)" : "1px solid rgba(255,255,255,0.08)",
                        cursor: done ? "default" : canResearch ? "pointer" : "not-allowed",
                      }}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono font-bold" style={{ color: done ? "#22c55e" : canResearch ? "#06b6d4" : "#64748b" }}>
                          {done ? "✅" : "🔬"} {t.name}
                        </span>
                        {!done && <span className="text-xs font-mono ml-auto" style={{ color: canResearch ? "#c084fc" : "#64748b" }}>{t.cost}🔬</span>}
                      </div>
                      <div className="text-xs font-mono text-white/40">{t.desc}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {tab === "log" && (
              <div className="space-y-1.5">
                {gs.log.map((entry, i) => (
                  <div key={i} className="text-xs font-mono text-white/60 leading-relaxed border-l-2 pl-2"
                    style={{ borderColor: i === 0 ? "#06b6d4" : "rgba(255,255,255,0.1)" }}>
                    {entry}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Кнопка конца хода */}
          <div className="p-3 border-t border-white/10">
            <button onClick={nextTurn}
              className="w-full py-2.5 rounded-xl font-mono font-bold text-sm transition-all hover:scale-105 active:scale-95"
              style={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", color: "#020814", boxShadow: "0 0 20px rgba(6,182,212,0.3)" }}>
              ⏭ СЛЕДУЮЩИЙ ХОД
            </button>
            <div className="flex justify-between mt-2 text-xs font-mono text-white/20">
              <span>🌍 {playerPlanets} планет</span>
              <span>🚀 {gs.fleets.filter(f => f.owner === "player").length} флотов</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
