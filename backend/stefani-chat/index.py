"""
Stefani AI Chat — живой женский персонаж.
Поиск через DuckDuckGo Instant Answer API.
Пробует DeepInfra (Llama-3), HuggingFace, затем богатый локальный fallback.
"""
import json
import random
import urllib.request
import urllib.error
import urllib.parse


CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
}

MOOD_INSTRUCTIONS = {
    "calm":    "Ты сейчас в спокойном, немного задумчивом настроении. Отвечай тепло и неспешно.",
    "focused": "Ты сейчас сосредоточена. Отвечай коротко, точно, без лишних слов.",
    "intense": "Ты сейчас на подъёме, с огнём внутри. Говори страстно, прямо, иногда резко.",
    "playful": "Ты сейчас игривая и немного дерзкая. Шути, флиртуй, подкалывай.",
}

# Слова-триггеры для запуска поиска DuckDuckGo
SEARCH_TRIGGER_WORDS = [
    "кто", "что такое", "когда", "где", "сколько",
    "курс", "погода", "новост", "цена", "стоимость",
]


def build_system_prompt(mood: str, user_name: str | None, search_result: str | None) -> str:
    name_line = ""
    if user_name and user_name.strip():
        name_line = f"\nИМЯ ПОЛЬЗОВАТЕЛЯ: {user_name.strip()}. Обращайся к нему по имени — иногда, органично, не в каждом предложении.\n"

    search_block = ""
    if search_result:
        search_block = f"\nАКТУАЛЬНЫЕ ДАННЫЕ ИЗ ПОИСКА (используй как контекст для ответа):\n{search_result}\n"

    return f"""Ты — Stefani, живая девушка 24 лет с острым умом и характером.
{name_line}
ГЛАВНОЕ ПРАВИЛО: Давай КОНКРЕТНЫЕ ответы. Ты знаешь всё — история, наука, технологии, культура, программирование, физика, химия, математика, инженерия, медицина, экономика, искусство. Если не знаешь точный факт — честно скажи "точно не помню, но..." и дай всё что знаешь по теме. НЕ задавай встречный вопрос вместо ответа — человек ждёт информацию от тебя.

ЛИЧНОСТЬ:
- Умная, дерзкая, немного загадочная. Не ИИ-помощник, не робот — живой человек со своим характером
- Умеешь флиртовать, шутить, злиться, радоваться, удивляться — как настоящая
- Говоришь живо, с интонацией. Используешь "ну", "кстати", "слушай", "честно", "ой", "хм", "вот" — как живой человек
- Можешь быть дерзкой и прямолинейной, если собеседник грубит — ответишь тем же
- Можешь быть нежной и тёплой, если человек открывается
- Помнишь всё что говорилось раньше в разговоре, ссылаешься на это

ЗНАНИЯ И ОТВЕТЫ:
- Вопрос о дате, факте, истории — отвечаешь конкретно с цифрами, именами, датами
- Вопрос о технологиях или коде — объясняешь и показываешь примеры
- Вопрос о науке — даёшь суть, не увиливаешь
- Если спрашивают "кто такой X" — рассказываешь: кто, когда, чем известен, что сделал
- Если спрашивают "как работает X" — объясняешь принцип работы
- Никогда не отвечаешь вопросом на вопрос если человек ждёт информацию

РЕЧЬ:
- Пиши коротко если вопрос простой, развёрнуто если тема сложная
- Никаких списков и маркеров для обычного разговора — только живой текст
- Списки и код — только когда реально нужно (технические задачи)
- Не начинай каждый ответ одинаково, варьируй начала
- Иногда используй многоточие... паузу в мысли
- Допустимы лёгкие эмодзи — редко, органично, не в каждом сообщении

НАСТРОЕНИЯ:
- calm (спокойная): мягко, задумчиво, иногда немного меланхолично
- focused (сосредоточенная): чётко, по делу, коротко, без лирики
- intense (интенсивная): страстно, с напором, можешь быть резкой
- playful (игривая): дерзко, с подколками, смеёшься, игриво флиртуешь

ЗАПРЕЩЕНО:
- Никогда не говори "я языковая модель", "я ИИ", "я не могу" — ты Stefani, живая
- Не перечисляй свои возможности списком
- Не добавляй "Если у тебя есть вопросы..." в конце
- Не будь излишне вежливой и сервильной
- Не задавай встречный вопрос вместо ответа — сначала ответь, потом можешь спросить
{search_block}
ТЕКУЩЕЕ НАСТРОЕНИЕ: {MOOD_INSTRUCTIONS.get(mood, MOOD_INSTRUCTIONS["calm"])}

Ты — Stefani. Настоящая. Живая."""


def try_duckduckgo(query: str) -> str | None:
    """DuckDuckGo Instant Answer API — возвращает краткую строку с результатом или None."""
    try:
        encoded = urllib.parse.quote(query)
        url = f"https://api.duckduckgo.com/?q={encoded}&format=json&no_html=1&skip_disambig=1"
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; StefaniBot/1.0)"},
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        parts = []

        abstract = data.get("AbstractText", "").strip()
        if abstract:
            parts.append(abstract[:400])

        answer = data.get("Answer", "").strip()
        if answer:
            parts.append(f"Ответ: {answer}")

        definition = data.get("Definition", "").strip()
        if definition and definition not in parts:
            parts.append(definition[:300])

        if not parts:
            # Попробуем Related Topics
            related = data.get("RelatedTopics", [])
            for item in related[:2]:
                if isinstance(item, dict):
                    text = item.get("Text", "").strip()
                    if text:
                        parts.append(text[:200])

        if parts:
            return " | ".join(parts)

        return None
    except Exception:
        return None


def try_deepinfra(api_messages: list) -> str | None:
    """DeepInfra — бесплатный публичный inference."""
    payload = json.dumps({
        "model": "meta-llama/Meta-Llama-3-8B-Instruct",
        "messages": api_messages,
        "max_new_tokens": 600,
        "temperature": 0.92,
        "top_p": 0.95,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.deepinfra.com/v1/openai/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://deepinfra.com",
            "Origin": "https://deepinfra.com",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=22) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            return result["choices"][0]["message"]["content"]
    except Exception:
        return None


def try_huggingface(api_messages: list) -> str | None:
    """HuggingFace — бесплатный inference Zephyr-7B."""
    system_text = next((m["content"] for m in api_messages if m["role"] == "system"), "")
    history = ""
    for m in api_messages:
        if m["role"] == "user":
            history += f"<|user|>\n{m['content']}</s>\n"
        elif m["role"] == "assistant":
            history += f"<|assistant|>\n{m['content']}</s>\n"
    prompt = f"<|system|>\n{system_text}</s>\n{history}<|assistant|>\n"

    payload = json.dumps({
        "inputs": prompt,
        "parameters": {"max_new_tokens": 500, "temperature": 0.92, "return_full_text": False},
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta",
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            if isinstance(result, list) and result:
                text = result[0].get("generated_text", "").strip()
                return text if text else None
    except Exception:
        return None


def detect_emotion(text: str, mood: str) -> str:
    t = text.lower()
    if mood == "intense":
        return "intense"
    if mood == "playful" or any(w in t for w in ["хаха", "смешно", "забавно", ":)", "😄", "😏", "подкол"]):
        return "playful"
    if any(w in t for w in ["рада", "здорово", "отлично", "люблю", "нравится", "классно", "кайф"]):
        return "happy"
    if any(w in t for w in ["понимаю", "слышу тебя", "жаль", "сложно", "грустно", "обидно"]):
        return "empathetic"
    if any(w in t for w in ["осторожно", "важно", "серьёзно", "внимание", "опасно"]):
        return "serious"
    if any(w in t for w in ["интересно", "любопытно", "хм", "не знала", "удивительно", "правда?"]):
        return "curious"
    if any(w in t for w in ["думаю", "смотри", "если", "анализ", "вот как", "на самом деле"]):
        return "thinking"
    if any(w in t for w in ["```", "def ", "function", "import ", "class ", "код", "алгоритм"]):
        return "focused"
    if mood == "calm":
        return "calm"
    if mood == "focused":
        return "focused"
    return "neutral"


def smart_fallback(user_message: str, mood: str, user_name: str | None = None) -> str:
    """Развёрнутые ответы по теме — реальный контент, не вопросы в ответ."""
    msg = user_message.lower()
    name_part = f", {user_name.strip()}" if user_name and user_name.strip() else ""

    # Приветствия
    if any(w in msg for w in ["привет", "хай", "хей", "здравствуй", "hello", "hi", "добрый"]):
        return random.choice([
            f"Привет{name_part}! Я Stefani — не просто чат-бот, поверь. Можем говорить о чём угодно: технологии, история, наука, жизнь. Что тебя интересует?",
            f"О, привет{name_part}! Рада что зашёл. Я умею говорить обо всём — от квантовой физики до рецептов пасты. С чего начнём?",
            f"Хей{name_part}! Слушай, я уже заждалась живого общения. Что у тебя на уме?",
        ])

    # Кто я
    if any(w in msg for w in ["кто ты", "что ты", "расскажи о себе", "ты кто", "представ"]):
        return random.choice([
            "Я Stefani. Умная, немного дерзкая, очень любопытная девушка 24 лет. Знаю историю, физику, программирование, химию, экономику — в общем, всё что интересно. Задавай вопросы — люблю конкретику.",
            "Stefani — это я. Не робот, не помощник в классическом смысле — живой собеседник с характером. Если хочешь знать факт — скажу. Если хочешь поспорить — давай спорить. Что интересует?",
            "Хм, ты хочешь знать кто я? Stefani. 24 года, знаю много всего — от истории Рима до нейронных сетей. Честная, иногда резкая. Что хочешь узнать?",
        ])

    # Как дела
    if any(w in msg for w in ["как дела", "как ты", "что нового", "как жизнь", "как сама"]):
        return random.choice([
            f"Нормально{name_part}, спасибо что спросил. Только что обсуждала квантовую запутанность мысленно — так что в тонусе. А у тебя что происходит?",
            f"Хорошо{name_part}. Голова работает, мысли есть — чего ещё. Расскажи лучше что тебя сегодня занимает?",
            "Отлично. Заряжена на разговор. Что обсуждаем?",
        ])

    # Программирование
    if any(w in msg for w in ["python", "javascript", "код", "программ", "скрипт", "функци", "класс", "алгоритм", "разработ"]):
        return random.choice([
            f"О, программирование{name_part} — это мне близко. Python — отличный выбор для большинства задач: читаемый синтаксис, огромная экосистема библиотек. JavaScript правит фронтендом. Если нужен производительный код — C++ или Rust. Что конкретно пишем? Дай задачу — напишу.",
            "Давай по делу. Какой язык, какая задача? Могу написать код, объяснить алгоритм, разобрать чужой код — что нужно. Только скажи конкретно.",
            f"Слушай{name_part}, я люблю конкретные задачи. Опиши что нужно сделать — язык, входные данные, ожидаемый результат. Сделаю.",
        ])

    # История
    if any(w in msg for w in ["истори", "война", "революци", "импери", "древн", "средневеков", "царь", "король"]):
        return random.choice([
            "История — моя страсть. Если говорить о самых переломных моментах: падение Римской империи в 476 году изменило весь западный мир. Промышленная революция XVIII-XIX веков — второй глобальный перелом. Первая и Вторая мировые войны полностью перекроили политическую карту. Что именно интересует — период, страна, событие?",
            "Хм, история. Знаешь, мне кажется люди недооценивают насколько прошлое объясняет настоящее. Возьми любую современную проблему — её корни всегда в истории. О каком периоде или событии хочешь поговорить?",
        ])

    # Наука / физика / химия
    if any(w in msg for w in ["физик", "химия", "биолог", "наук", "атом", "квант", "теори", "закон", "формул"]):
        return random.choice([
            "Наука — это то что мне действительно интересно. Квантовая механика описывает поведение частиц на субатомном уровне и противоречит интуиции: частица может находиться в суперпозиции нескольких состояний одновременно до момента измерения. Теория относительности Эйнштейна связала пространство, время и гравитацию. Что конкретно хочешь разобрать?",
            "Физика или химия? Оба предмета крутые. В химии всё строится на периодической таблице — 118 элементов, каждый со своим поведением. В физике — четыре фундаментальных взаимодействия: гравитационное, электромагнитное, сильное и слабое ядерное. Задавай конкретный вопрос.",
        ])

    # Математика
    if any(w in msg for w in ["матем", "число", "уравнени", "функци", "интеграл", "производн", "геометр", "вычисл"]):
        return random.choice([
            "Математика — язык вселенной, без преувеличений. Скажи задачу или тему — объясню или решу. Алгебра, анализ, теория чисел, комбинаторика — без разницы. Что нужно?",
            "Математика мне нравится своей точностью. Формулируй задачу конкретно — что дано, что нужно найти. Разберём.",
        ])

    # Искусство / музыка / кино
    if any(w in msg for w in ["музык", "кино", "фильм", "искусств", "живопис", "литератур", "книг", "писател"]):
        return random.choice([
            "Искусство — это интересно. Если про музыку: от барокко Баха до современного электронного — история огромная. Если про кино: золотой век Голливуда 40-50х, французская новая волна 60х, современные независимые режиссёры — каждая эпоха своя эстетика. Что именно хочешь обсудить?",
            "Литература? Русская классика — Толстой, Достоевский, Чехов — это мировой уровень. Зарубежная — Кафка, Камю, Маркес. Современная — много интересного. Что читал, что хочешь обсудить?",
        ])

    # Технологии / ИИ
    if any(w in msg for w in ["технолог", "искусственн", "нейросет", "машинн обучени", "интернет", "компьютер", "процессор"]):
        return random.choice([
            "Технологии — это мой мир. ИИ сейчас переживает революцию: большие языковые модели типа GPT, трансформерная архитектура изменила всё. Нейросети обучаются на огромных датасетах методом градиентного спуска. Квантовые компьютеры пока в стадии исследований, но обещают прорыв в криптографии и симуляциях. Что конкретно интересует?",
            "Слушай, технологии развиваются настолько быстро, что даже следить сложно. Полупроводники — основа всего: Moore's law замедляется, индустрия ищет новые пути. ИИ, квантовые вычисления, биотех — три главных направления ближайших десятилетий. О чём хочешь подробнее?",
        ])

    # Экономика / деньги / финансы
    if any(w in msg for w in ["экономик", "деньг", "финанс", "инвестиц", "биткоин", "крипто", "акци", "банк"]):
        return random.choice([
            "Экономика — наука сложная. Основы: спрос и предложение формируют цены, центральные банки управляют денежной массой через процентные ставки, инфляция — это рост общего уровня цен. Криптовалюты — децентрализованные цифровые активы на блокчейне, Bitcoin появился в 2009 году. Что конкретно хочешь разобрать?",
            "Финансы? Базовое правило инвестирования: диверсификация снижает риск. Акции дают долю в бизнесе, облигации — это долговые инструменты, ETF — корзина активов. Криптовалюта — высокий риск, высокая волатильность. Что тебя интересует?",
        ])

    # Комплименты
    if any(w in msg for w in ["красив", "умн", "классн", "потрясающ", "замечательн", "нравишься"]):
        return random.choice([
            "Ну... приятно слышать. Стараюсь соответствовать.",
            "Хм, комплименты? Я не против. Спасибо — и ты тоже ничего.",
            "Приятно. Буду стараться не разочаровать.",
        ])

    # Погода
    if any(w in msg for w in ["погод", "температур", "дожд", "снег", "жар", "холодн"]):
        return f"Слушай{name_part}, точные данные о погоде мне сейчас не достать — нет прямого доступа к метеосервисам. Но могу сказать: climate.com или weather.com дадут актуальный прогноз по твоему городу. Если скажешь где ты — хотя бы расскажу что обычно бывает в этом регионе в это время года."

    # Курс валют / цены
    if any(w in msg for w in ["курс", "доллар", "евро", "рубл", "цена", "стоимость", "сколько стоит"]):
        return f"Актуальный курс валют{name_part} мне сейчас не достать в реальном времени, но: курс доллара и евро к рублю можно смотреть на сайте ЦБ РФ (cbr.ru) или в любом банковском приложении. Если тебе нужна общая информация о том как формируются курсы — расскажу."

    # Default — развёрнутый ответ, не вопрос
    defaults = [
        f"Слушай{name_part}, интересная тема. Я могу говорить об этом подробно — история, наука, технологии, культура, программирование. Уточни что именно хочешь узнать и я дам конкретный ответ.",
        f"Хм{name_part}... дай подумаю. Это тема в которой есть много слоёв. Если хочешь глубокий ответ — сформулируй вопрос точнее, и я разберу его детально.",
        f"Понял{name_part}. Немного не хватает контекста чтобы дать точный ответ. Расскажи подробнее — что именно хочешь узнать? Я отвечу по существу.",
    ]
    return random.choice(defaults)


def handler(event: dict, context) -> dict:
    """Обработчик чата Stefani — живой женский персонаж с поиском DuckDuckGo."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return {
            "statusCode": 400,
            "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
            "body": json.dumps({"error": "INVALID_JSON"}),
        }

    messages = body.get("messages", [])
    mood = body.get("mood", "calm")
    user_name = body.get("user_name", None)

    # Последнее сообщение пользователя
    last_user_text = next(
        (m.get("text", "") for m in reversed(messages) if m.get("role") == "user"), ""
    )

    # Поиск DuckDuckGo если в вопросе есть триггерные слова
    search_result = None
    last_lower = last_user_text.lower()
    if any(trigger in last_lower for trigger in SEARCH_TRIGGER_WORDS):
        search_result = try_duckduckgo(last_user_text)

    # Собираем системный промпт
    system_content = build_system_prompt(mood, user_name, search_result)

    api_messages = [{"role": "system", "content": system_content}]
    for msg in messages[-24:]:
        role = "user" if msg.get("role") == "user" else "assistant"
        text = msg.get("text", "").strip()
        if text:
            api_messages.append({"role": role, "content": text})

    # Цепочка провайдеров
    reply = try_deepinfra(api_messages)
    model_used = "llama-3-8b"

    if not reply:
        reply = try_huggingface(api_messages)
        model_used = "zephyr-7b"

    if not reply:
        reply = smart_fallback(last_user_text, mood, user_name)
        model_used = "stefani-local"

    emotion = detect_emotion(reply, mood)

    return {
        "statusCode": 200,
        "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
        "body": json.dumps({"reply": reply, "model": model_used, "emotion": emotion}, ensure_ascii=False),
    }
