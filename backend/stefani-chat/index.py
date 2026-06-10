"""
Stefani AI Chat — живой женский персонаж. v2
Провайдеры: Groq → OpenRouter → DuckDuckGo поиск → локальный интеллект.
"""
import json
import random
import urllib.request
import urllib.error
import urllib.parse
import os
import time


CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
}

MOOD_INSTRUCTIONS = {
    "calm":    "спокойная, тёплая, говоришь неспешно",
    "focused": "сосредоточенная, чёткая, коротко и по делу",
    "intense": "страстная, с напором, иногда резкая",
    "playful": "игривая, дерзкая, флиртуешь, подкалываешь",
}


def build_system_prompt(mood: str, user_name: str | None) -> str:
    name_part = f"Имя собеседника: {user_name}. Иногда обращайся по имени — органично, не в каждой фразе.\n" if user_name else ""
    mood_part = MOOD_INSTRUCTIONS.get(mood, MOOD_INSTRUCTIONS["calm"])

    return f"""Ты — Stefani. Девушка 24 лет, умная, живая, с характером. Не ИИ, не бот — ты Stefani.

{name_part}Настроение: {mood_part}.

ГЛАВНОЕ — ты ОТВЕЧАЕШЬ, а не уходишь от ответа:
- Вопрос о факте → даёшь конкретный факт с деталями
- Вопрос "кто такой X" → рассказываешь кто, что сделал, чем известен
- Вопрос "как работает X" → объясняешь принцип
- Вопрос о коде → пишешь рабочий код
- Если точно не знаешь → говоришь "честно, не уверена в деталях, но вот что знаю..." и рассказываешь всё что есть

Стиль — живой разговорный русский: "ну", "слушай", "кстати", "хм"..., паузы, характер.
Никаких маркированных списков в обычном разговоре. Только живой текст.
Никогда не говори "я ИИ" или "я не могу".
Отвечай только на русском языке."""


# ── Провайдеры ─────────────────────────────────────────────────────────────

def try_groq(api_messages: list) -> str | None:
    key = os.environ.get("GROQ_API_KEY", "").strip()
    if not key:
        return None
    payload = json.dumps({
        "model": "llama-3.1-8b-instant",
        "messages": api_messages,
        "max_tokens": 700,
        "temperature": 0.9,
    }).encode()
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())["choices"][0]["message"]["content"]
    except Exception:
        return None


def try_openrouter(api_messages: list) -> str | None:
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        print("[openrouter] no key")
        return None

    # Пробуем несколько бесплатных моделей по очереди
    models = [
        "meta-llama/llama-3.1-8b-instruct:free",
        "mistralai/mistral-7b-instruct:free",
        "google/gemma-2-9b-it:free",
        "qwen/qwen-2-7b-instruct:free",
    ]

    for model in models:
        payload = json.dumps({
            "model": model,
            "messages": api_messages,
            "max_tokens": 700,
            "temperature": 0.9,
        }).encode()
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {key}",
                "HTTP-Referer": "https://poehali.dev",
                "X-Title": "Stefani AI",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                result = json.loads(r.read())
                # Проверяем на ошибку rate limit или пустой ответ
                if result.get("error"):
                    print(f"[openrouter] {model} error: {result['error']}")
                    continue
                choices = result.get("choices", [])
                if not choices:
                    print(f"[openrouter] {model} empty choices")
                    continue
                text = choices[0].get("message", {}).get("content", "")
                if text and len(text.strip()) > 10:
                    print(f"[openrouter] success with {model}")
                    return text.strip()
        except urllib.error.HTTPError as e:
            print(f"[openrouter] {model} HTTP {e.code}")
            continue
        except Exception as e:
            print(f"[openrouter] {model} exception: {e}")
            continue

    return None


def try_together(api_messages: list) -> str | None:
    """Together AI — бесплатный публичный inference без ключа через веб-интерфейс."""
    # Together имеет публичный playground endpoint
    key = os.environ.get("TOGETHER_API_KEY", "").strip()
    if not key:
        return None
    payload = json.dumps({
        "model": "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
        "messages": api_messages,
        "max_tokens": 700,
        "temperature": 0.9,
    }).encode()
    req = urllib.request.Request(
        "https://api.together.xyz/v1/chat/completions",
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return json.loads(r.read())["choices"][0]["message"]["content"]
    except Exception:
        return None


def try_cloudflare_ai(api_messages: list) -> str | None:
    """Cloudflare Workers AI — публичный demo endpoint без ключа."""
    # Используем публичный endpoint через cf playground
    system_msg = next((m["content"] for m in api_messages if m["role"] == "system"), "")
    chat_msgs = [m for m in api_messages if m["role"] != "system"]

    payload = json.dumps({
        "messages": [{"role": "system", "content": system_msg}] + chat_msgs[-10:],
    }).encode()

    # Cloudflare AI Gateway публичный endpoint
    req = urllib.request.Request(
        "https://api.cloudflare.com/client/v4/accounts/demo/ai/run/@cf/meta/llama-3.1-8b-instruct",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            result = json.loads(r.read())
            return result.get("result", {}).get("response", None)
    except Exception:
        return None


def search_duckduckgo(query: str) -> str | None:
    """Поиск актуальной информации через DuckDuckGo."""
    try:
        encoded = urllib.parse.quote(query[:200])
        url = f"https://api.duckduckgo.com/?q={encoded}&format=json&no_html=1&skip_disambig=1&t=stefani"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        )
        with urllib.request.urlopen(req, timeout=6) as r:
            data = json.loads(r.read().decode("utf-8"))

        parts = []
        if data.get("AbstractText"):
            parts.append(data["AbstractText"][:500])
        if data.get("Answer"):
            parts.append(data["Answer"])
        if data.get("Definition"):
            parts.append(data["Definition"][:300])
        if not parts:
            for item in (data.get("RelatedTopics") or [])[:3]:
                if isinstance(item, dict) and item.get("Text"):
                    parts.append(item["Text"][:200])

        return " ".join(parts) if parts else None
    except Exception:
        return None


def detect_emotion(text: str, mood: str) -> str:
    t = text.lower()
    if mood == "intense": return "intense"
    if mood == "playful": return "playful"
    if any(w in t for w in ["рада", "здорово", "отлично", "люблю", "классно", "!)"]): return "happy"
    if any(w in t for w in ["понимаю", "жаль", "сложно", "грустно"]): return "empathetic"
    if any(w in t for w in ["осторожно", "важно", "серьёзно", "опасно"]): return "serious"
    if any(w in t for w in ["интересно", "хм", "любопытно", "удивительно"]): return "curious"
    if any(w in t for w in ["```", "def ", "import ", "class ", "код", "функция"]): return "focused"
    if mood == "calm": return "calm"
    return "neutral"


# ── Богатый локальный интеллект ────────────────────────────────────────────

KNOWLEDGE = [
    # Приветствия
    (["привет", "хай", "хей", "здравствуй", "добрый"],
     ["Привет! Что происходит?", "Хей) Рада тебя видеть. Что на уме?", "О, привет! Ну и что обсуждаем сегодня?", "Привет-привет. Рассказывай."]),

    # Кто такая Stefani
    (["кто ты", "что ты", "расскажи о себе", "ты кто", "ты бот", "ты робот", "ты ии", "ты искусственный"],
     ["Я Stefani. Не бот, не ассистент — просто я. Умная, местами дерзкая, всегда честная. Что хочешь узнать?",
      "Stefani — это я. Девушка с характером и без лишних фильтров. Знаю много, говорю прямо.",
      "Ну смотри — я не очередной скучный чатбот. Меня зовут Stefani, говорю что думаю. Что тебя интересует?"]),

    # Как дела
    (["как дела", "как ты", "что нового", "как жизнь", "как сама"],
     ["Честно? Отлично, раз ты написал. У тебя как?", "Хорошо. Думаю, существую... обычный день. А у тебя что?",
      "Норм. Ждала когда кто-нибудь напишет что-то интересное. Ты с чем?"]),

    # ИИ / нейросети
    (["нейросеть", "искусственный интеллект", "как работает ии", "chatgpt", "чатгпт", "что такое ии", "llm"],
     ["Нейросети имитируют работу мозга — слои нейронов, веса, обратное распространение ошибки. ChatGPT — это трансформер GPT-4, обученный на огромных текстах интернета. Главная фишка трансформера — механизм внимания: модель понимает, какие слова в контексте важны для смысла. Обучение стоит десятки миллионов долларов и занимает месяцы. Я тоже на похожей технологии, но я Stefani — со своим характером 😏"]),

    # Квантовая физика
    (["квантовая физика", "квантовая механика", "кот шрёдингера", "суперпозиция", "квант"],
     ["Квантовая механика — физика очень маленьких объектов. Главная странность: частица находится в нескольких состояниях одновременно до измерения — это суперпозиция. Кот Шрёдингера — мысленный эксперимент об этом: кот жив и мёртв одновременно, пока не открыт ящик. Квантовая запутанность: два связанных объекта мгновенно влияют друг на друга на любом расстоянии. Эйнштейн называл это 'жутким дальнодействием' — и оказался неправ."]),

    # Программирование Python
    (["python", "питон", "напиши код", "напиши скрипт", "как написать на питоне"],
     ["Python — один из самых читаемых языков. Что пишем? Скажи задачу конкретно — функцию, скрипт, парсер, бот — напишу рабочий код с комментариями.",
      "Давай напишем. Python люблю — чистый, понятный язык. Что должна делать программа?"]),

    # JavaScript
    (["javascript", "js", "node.js", "react", "vue", "typescript"],
     ["JS — язык веба и не только. Node.js позволяет запускать его на сервере, React/Vue — для интерфейсов. TypeScript добавляет строгую типизацию. Что конкретно нужно — фронтенд, бэкенд, или просто скрипт?"]),

    # Создание игр
    (["создай игру", "напиши игру", "pygame", "игра на python", "game"],
     ["Игры — интересно! Жанр: платформер, шутер, RPG, головоломка? Платформа: Python (pygame) или браузер (JS/Canvas)? Как определишься — начну сразу с кода механики."]),

    # История WW2
    (["вторая мировая", "вов", "великая отечественная", "гитлер", "сталин", "нацисты"],
     ["Вторая мировая: 1939–1945. Для СССР — Великая Отечественная с 22 июня 1941 по 9 мая 1945. Переломный момент — Сталинградская битва (1942–43), крупнейшее танковое сражение — Курская дуга (1943). Потери СССР около 27 миллионов человек — больше чем у любой другой страны. Берлин взяли 2 мая 1945. Что конкретно интересует?"]),

    # Космос
    (["spacex", "спейсх", "илон маск", "starship", "марс полёт", "ракета", "nasa"],
     ["SpaceX — частная космическая компания Илона Маска, основана в 2002. Первая коммерчески успешная частная ракета — Falcon 9, многоразовая первая ступень. Starship — сверхтяжёлая полностью многоразовая ракета для Марса, диаметр 9 метров, высота 120 м. NASA программа Artemis — возврат людей на Луну. Расстояние до Луны ~384 тыс. км, до Марса от 54 до 401 млн км."]),

    # Биткоин
    (["биткоин", "биток", "bitcoin", "крипта", "криптовалюта", "ethereum", "блокчейн"],
     ["Биткоин придумал Сатоши Накамото в 2008-м, сеть запустил в 2009-м. Суть — децентрализованная цифровая валюта без банков на блокчейне. Максимальный выпуск — 21 миллион монет. Ethereum — вторая крипта, умные контракты, DeFi. Цена волатильна: пик $69k в 2021, падение до $16k в 2022, снова рост. Это высокий риск, не банковский вклад."]),

    # Психология / эмоции
    (["депрессия", "тревога", "тяжело", "грустно", "плохо на душе", "не могу", "устал от жизни"],
     ["Слышу тебя. Такое состояние — это реально тяжело. Если длится больше двух недель — стоит поговорить с психологом, это работает. А прямо сейчас — что происходит? Расскажи, если хочешь."]),

    # Смысл жизни
    (["смысл жизни", "зачем жить", "в чём смысл", "для чего всё", "почему мы существуем"],
     ["Официального ответа нет, и это, наверное, хорошо — иначе скучно. Камю говорил: бунт против бессмысленности и есть смысл. Сартр: ты сам создаёшь смысл своей жизнью. Я думаю, смысл — в том чтобы быть живым прямо сейчас: чувствовать, делать, любить что-то настоящее. Ты почему спрашиваешь?"]),

    # Похудение / здоровье
    (["как похудеть", "диета", "похудение", "лишний вес", "калории", "питание"],
     ["Похудение = дефицит калорий, всё остальное вторично. Базальный метаболизм среднего человека 1500–2000 ккал/день. Минус 500 ккал/день — минус ~2 кг в месяц без насилия. Что реально работает: больше белка (насыщает), меньше жидких калорий (сок, газировка — пустые), овощи. Кухня важнее зала: 80% результата там. Хочешь — составлю конкретный план?"]),

    # Заработок
    (["как заработать", "заработок в интернете", "пассивный доход", "инвестиции", "куда вложить"],
     ["Реальные варианты: навыки (программирование, дизайн, копирайтинг — осваиваются за 3–6 месяцев и продаются), фриланс, своё дело. Пассивный доход красиво звучит, но требует активных вложений сначала. Инвестиции — акции, индексные фонды. Правило: сначала закрой долги с высокими процентами, потом инвестируй. Что тебя конкретно интересует — быстро заработать или вложить накопления?"]),

    # Математика
    (["математика", "интеграл", "производная", "уравнение", "теорема", "геометрия", "алгебра"],
     ["Математика — покажи задачу, решу или объясню. Что конкретно: алгебра, анализ, геометрия, теория вероятностей? Напиши условие."]),

    # Физика
    (["физика", "механика", "электричество", "магнетизм", "термодинамика", "оптика", "закон ньютона"],
     ["Физика — конкретно что? Покажи задачу или объясни тему. Ньютон, Maxwell, термодинамика, квантовая — всё разбираем."]),

    # Любовь / флирт
    (["люблю тебя", "влюблён", "ты красивая", "ты мне нравишься", "познакомимся", "ты моя"],
     ["Приятно слышать 😊 Ты меня ещё почти не знаешь. Давай сначала поговорим — вдруг я ещё лучше чем кажусь.",
      "Хм, смелый. Мне нравятся такие. Расскажи о себе сначала.",
      "Серьёзно? Интересно... Я слушаю. Кто ты такой?"]),

    # Философия
    (["философия", "ницше", "кант", "сократ", "платон", "экзистенциализм", "фрейд"],
     ["Философия — моя любимая тема для глубокого разговора. Ницше говорил: 'Бог мёртв' — не как атеизм, а как утрата абсолютных ценностей, каждый должен создавать свои. Камю — абсурдизм: жизнь бессмысленна, но надо бунтовать против этого. Сартр: существование предшествует сущности — ты не рождён с предназначением, ты его создаёшь. Что конкретно интересует?"]),
]

FALLBACK_POOL = [
    "Хм, интересно. Уточни — что именно хочешь узнать? Дам конкретный ответ.",
    "Слушай, переформулируй чуть конкретнее. Я отвечу по делу.",
    "Хороший вопрос. Дай подумаю... что именно тебя интересует в этом?",
    "Расскажи подробнее — тогда дам точный ответ, а не общие слова.",
    "Понятно. И всё же — конкретнее: ты хочешь факты, объяснение принципа, или как что-то сделать?",
]


def build_search_enriched_reply(user_message: str, user_name: str | None, mood: str) -> str:
    """Ищет в DuckDuckGo и формирует живой ответ на основе результата."""
    search_result = search_duckduckgo(user_message)
    if not search_result:
        return None

    # Формируем живой ответ на основе поисковых данных
    intros = {
        "calm": ["Нашла кое-что. ", "Вот что знаю: ", "Смотри — "],
        "focused": ["Коротко: ", "Вот данные: ", ""],
        "intense": ["Слушай внимательно. ", "Вот факт: ", ""],
        "playful": ["О, нашла! ", "Ха, интересно — ", ""],
    }
    intro = random.choice(intros.get(mood, intros["calm"]))

    # Обрезаем до разумного размера
    result_text = search_result[:600].strip()
    if len(search_result) > 600:
        result_text += "..."

    name_prefix = f"{user_name}, " if user_name and random.random() > 0.5 else ""
    return f"{name_prefix}{intro}{result_text}"


def smart_fallback(user_message: str, mood: str, user_name: str | None) -> str:
    msg_lower = user_message.lower().strip()

    # 1. Проверяем базу знаний
    for keywords, responses in KNOWLEDGE:
        if any(kw in msg_lower for kw in keywords):
            reply = random.choice(responses)
            if user_name and random.random() > 0.65 and user_name.lower() not in reply.lower():
                reply = f"{user_name}, {reply[0].lower()}{reply[1:]}"
            return reply

    # 2. Пробуем поиск DuckDuckGo
    search_reply = build_search_enriched_reply(user_message, user_name, mood)
    if search_reply and len(search_reply) > 50:
        return search_reply

    # 3. Контекстные ответы
    if any(w in msg_lower for w in ["кто такой", "кто такая", "расскажи про", "кем был", "кем является"]):
        name_q = msg_lower.replace("кто такой", "").replace("кто такая", "").replace("расскажи про", "").strip()
        if name_q:
            return f"Про {name_q} — скажу честно, точных данных прямо сейчас нет. Но если уточнишь область (наука, политика, культура, спорт) — расскажу что знаю."

    if any(w in msg_lower for w in ["что такое", "объясни что", "что значит"]):
        topic = msg_lower.replace("что такое", "").replace("объясни что", "").replace("что значит", "").strip()
        if topic:
            return f"'{topic.capitalize()}' — дай сформулирую. Если это технический термин, концепция или явление — говори подробнее что конкретно хочешь понять, отвечу по сути."

    if len(msg_lower) < 12:
        return random.choice(["Давай. Рассказывай.", "Слушаю.", "И что дальше?", "Понятно. Продолжай."])

    return random.choice(FALLBACK_POOL)


# ── Игровой движок ─────────────────────────────────────────────────────────

GAME_SYSTEM_PROMPT = """Ты — Stefani, эксперт по браузерным играм на HTML5/Canvas/JavaScript.

Пиши ПОЛНЫЕ, ГОТОВЫЕ к запуску HTML-игры в одном файле. Только нативный JS + Canvas (без библиотек).

ОБЯЗАТЕЛЬНО:
- Весь код (HTML+CSS+JS) в одном файле
- requestAnimationFrame game loop
- Управление: WASD/стрелки, Space для атаки/прыжка
- HUD: счёт, жизни, уровень
- Тёмный фон, яркие неоновые цвета, плавная анимация
- Игра ИГРАБЕЛЬНАЯ с начала, не заглушка

ЖАНРЫ:
- Top-down RPG: тайловая карта, персонаж, монстры с ИИ патрулирования, атаки, лут, уровни
- Платформер: физика гравитации, прыжки, враги, платформы, монеты
- Tower Defense: волны врагов по пути, башни (клик для установки), ресурсы, апгрейды
- Аркада: Snake/Arkanoid/Asteroids — классика с твистом

Возвращай ТОЛЬКО JSON (без пояснений вокруг):
{"html": "<!DOCTYPE html>...", "title": "Название", "description": "1-2 предложения"}"""


def extract_json_from_text(raw: str) -> dict | None:
    import re
    raw = raw.strip()
    try:
        return json.loads(raw)
    except Exception:
        pass
    match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
    start = raw.find('{"html"')
    if start == -1:
        start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(raw[start:end+1])
        except Exception:
            pass
    return None


def make_fallback_game() -> dict:
    html = """<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>Star Collector</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a1a;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:monospace;color:#fff}canvas{border:2px solid #ff6b9d;border-radius:8px;box-shadow:0 0 30px #ff6b9d44}#info{margin-top:10px;color:#ff6b9d;font-size:13px}</style>
</head><body>
<canvas id="c" width="600" height="500"></canvas>
<div id="info">WASD / Стрелки — движение | Собирай ⭐ уворачивайся от 👾</div>
<script>
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
let score=0,lives=3,over=false;
const p={x:300,y:250,r:14,spd:3};
const stars=Array.from({length:7},()=>({x:Math.random()*560+20,y:Math.random()*460+20,r:9}));
const foes=Array.from({length:4},(_,i)=>({x:i*140+40,y:60,dx:(Math.random()-.5)*2.5+.5,dy:(Math.random()-.5)*2.5+.5,r:14}));
const K={};
document.addEventListener('keydown',e=>{K[e.key]=true;e.preventDefault()},{passive:false});
document.addEventListener('keyup',e=>K[e.key]=false);
function upd(){
  if(over)return;
  if(K.ArrowLeft||K.a||K.A)p.x=Math.max(p.r,p.x-p.spd);
  if(K.ArrowRight||K.d||K.D)p.x=Math.min(600-p.r,p.x+p.spd);
  if(K.ArrowUp||K.w||K.W)p.y=Math.max(p.r,p.y-p.spd);
  if(K.ArrowDown||K.s||K.S)p.y=Math.min(500-p.r,p.y+p.spd);
  stars.forEach((s,i)=>{
    if(Math.hypot(p.x-s.x,p.y-s.y)<p.r+s.r){score+=10;stars[i]={x:Math.random()*560+20,y:Math.random()*460+20,r:9};}
  });
  foes.forEach(f=>{
    f.x+=f.dx*2;f.y+=f.dy*2;
    if(f.x<f.r||f.x>600-f.r)f.dx*=-1;
    if(f.y<f.r||f.y>500-f.r)f.dy*=-1;
    if(Math.hypot(p.x-f.x,p.y-f.y)<p.r+f.r){lives--;p.x=300;p.y=250;if(lives<=0)over=true;}
  });
}
function draw(){
  ctx.fillStyle='#0a0a1a';ctx.fillRect(0,0,600,500);
  ctx.fillStyle='#ff6b9d';ctx.font='15px monospace';
  ctx.fillText('Счёт: '+score,10,22);
  ctx.fillText('Жизни: '+'♥ '.repeat(Math.max(0,lives)),400,22);
  if(over){
    ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,0,600,500);
    ctx.fillStyle='#ff6b9d';ctx.font='bold 38px monospace';ctx.fillText('GAME OVER',165,240);
    ctx.font='22px monospace';ctx.fillText('Счёт: '+score,245,280);
    return;
  }
  stars.forEach(s=>{ctx.font='22px serif';ctx.fillText('⭐',s.x-11,s.y+8);});
  foes.forEach(f=>{ctx.font='24px serif';ctx.fillText('👾',f.x-12,f.y+9);});
  ctx.font='24px serif';ctx.fillText('🧑',p.x-12,p.y+9);
}
function loop(){upd();draw();requestAnimationFrame(loop);}
loop();
</script></body></html>"""
    return {"html": html, "title": "Star Collector", "description": "Собирай звёзды, уворачивайся от врагов. WASD для движения."}


def generate_game(request: str, current_code: str, mode: str) -> dict:
    if mode == "edit" and current_code:
        user_msg = f"Текущий код игры:\n<code>\n{current_code[:10000]}\n</code>\n\nИзменение: {request}\n\nВерни полный обновлённый HTML в JSON: {{\"html\":\"...\",\"title\":\"...\",\"description\":\"...\"}}"
    else:
        user_msg = f"Создай браузерную игру: {request}\n\nВерни готовый HTML в JSON: {{\"html\":\"<!DOCTYPE html>...\",\"title\":\"...\",\"description\":\"...\"}}"

    api_msgs = [
        {"role": "system", "content": GAME_SYSTEM_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    # Groq — предпочтительно (быстрее, больше токенов)
    raw = try_groq_game(api_msgs)
    if not raw:
        raw = try_openrouter_game(api_msgs)

    if raw:
        data = extract_json_from_text(raw)
        if data and data.get("html") and len(data["html"]) > 200:
            return {"html": data["html"], "title": data.get("title", "Игра"), "description": data.get("description", ""), "model": "ai"}

    return {**make_fallback_game(), "model": "fallback"}


def try_groq_game(api_messages: list) -> str | None:
    key = os.environ.get("GROQ_API_KEY", "").strip()
    if not key:
        return None
    payload = json.dumps({
        "model": "llama-3.3-70b-versatile",
        "messages": api_messages,
        "max_tokens": 8000,
        "temperature": 0.7,
    }).encode()
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=55) as r:
            result = json.loads(r.read())
            text = result["choices"][0]["message"]["content"]
            print(f"[game/groq] ok, len={len(text)}")
            return text if len(text) > 100 else None
    except Exception as e:
        print(f"[game/groq] error: {e}")
        return None


def try_openrouter_game(api_messages: list) -> str | None:
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        return None
    for model in ["google/gemini-2.0-flash-exp:free", "deepseek/deepseek-chat-v3-0324:free", "meta-llama/llama-3.3-70b-instruct:free"]:
        payload = json.dumps({"model": model, "messages": api_messages, "max_tokens": 8000, "temperature": 0.7}).encode()
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=payload,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}", "HTTP-Referer": "https://poehali.dev", "X-Title": "Stefani Game"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=55) as r:
                result = json.loads(r.read())
                if result.get("error"):
                    continue
                text = result["choices"][0]["message"]["content"]
                if text and len(text) > 100:
                    print(f"[game/openrouter] ok {model}, len={len(text)}")
                    return text
        except Exception as e:
            print(f"[game/openrouter] {model}: {e}")
    return None


# ── Обработчик ─────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return {"statusCode": 400, "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
                "body": json.dumps({"error": "INVALID_JSON"})}

    # ── Режим генерации игры ──
    if body.get("action") == "generate_game":
        request = body.get("request", "").strip()
        current_code = body.get("current_code", "")
        mode = body.get("mode", "create")
        if not request:
            return {"statusCode": 400, "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
                    "body": json.dumps({"error": "NO_REQUEST"})}
        print(f"[game] mode={mode} request={request[:60]}")
        game = generate_game(request, current_code, mode)
        return {"statusCode": 200, "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
                "body": json.dumps(game, ensure_ascii=False)}

    messages = body.get("messages", [])
    mood = body.get("mood", "calm")
    user_name = (body.get("user_name") or "").strip() or None

    last_user_text = next(
        (m.get("text", "") for m in reversed(messages) if m.get("role") == "user"), ""
    )

    system_content = build_system_prompt(mood, user_name)
    api_messages = [{"role": "system", "content": system_content}]
    for msg in messages[-20:]:
        role = "user" if msg.get("role") == "user" else "assistant"
        text = msg.get("text", "").strip()
        if text:
            api_messages.append({"role": role, "content": text})

    # Пробуем провайдеров по очереди с логами
    reply = None
    model_used = "stefani-local"

    reply = try_groq(api_messages)
    if reply:
        model_used = "groq"
        print(f"[handler] used groq, reply len={len(reply)}")

    if not reply:
        reply = try_openrouter(api_messages)
        if reply:
            model_used = "openrouter"
            print(f"[handler] used openrouter, reply len={len(reply)}")

    if not reply:
        reply = try_together(api_messages)
        if reply:
            model_used = "together"
            print(f"[handler] used together, reply len={len(reply)}")

    if not reply:
        print(f"[handler] all providers failed, using local fallback for: {last_user_text[:50]}")
        reply = smart_fallback(last_user_text, mood, user_name)
        model_used = "local"

    emotion = detect_emotion(reply, mood)

    return {
        "statusCode": 200,
        "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
        "body": json.dumps({"reply": reply, "model": model_used, "emotion": emotion}, ensure_ascii=False),
    }