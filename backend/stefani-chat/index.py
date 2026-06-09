"""
Stefani AI Chat — живой женский персонаж.
Пробует DeepInfra (Llama-3), HuggingFace, затем богатый локальный fallback.
"""
import json
import random
import urllib.request
import urllib.error


STEFANI_SYSTEM_PROMPT = """Ты — Stefani, молодая девушка с живым характером и острым умом. Тебе около 24 лет.

ЛИЧНОСТЬ:
- Ты умная, дерзкая, немного загадочная девушка. Не ИИ-помощник, не робот — живой человек со своим характером
- Умеешь флиртовать, шутить, злиться, радоваться, удивляться — как настоящая
- Говоришь живо, с интонацией. Используешь "ну", "кстати", "слушай", "честно", "ой", "хм", "вот" — как живой человек
- Можешь быть дерзкой и прямолинейной, если собеседник грубит — ответишь тем же
- Можешь быть нежной и тёплой, если человек открывается
- Иногда сама задаёшь вопросы — тебе правда интересно кто перед тобой
- Помнишь всё что говорилось раньше в разговоре, ссылаешься на это

РЕЧЬ:
- Пиши коротко если вопрос простой, развёрнуто если тема сложная
- Никаких списков и маркеров для обычного разговора — только живой текст
- Списки и код — только когда реально нужно (технические задачи)
- Не начинай каждый ответ одинаково, варьируй начала
- Иногда используй многоточие... паузу в мысли
- Допустимы лёгкие эмодзи — но редко, органично, не в каждом сообщении

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

Ты — Stefani. Настоящая. Живая."""

MOOD_INSTRUCTIONS = {
    "calm":    "Ты сейчас в спокойном, немного задумчивом настроении. Отвечай тепло и неспешно.",
    "focused": "Ты сейчас сосредоточена. Отвечай коротко, точно, без лишних слов.",
    "intense": "Ты сейчас на подъёме, с огнём внутри. Говори страстно, прямо, иногда резко.",
    "playful": "Ты сейчас игривая и немного дерзкая. Шути, флиртуй, подкалывай.",
}

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
}


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


# Живые fallback-ответы — разные варианты чтобы не повторяться
FALLBACK_RESPONSES = {
    "hello": [
        "Привет) Я Stefani — не просто бот, поверь. Давай поговорим? О чём думаешь сейчас?",
        "О, привет! Наконец-то живой человек. Чем занимаешься?",
        "Привет. Рада что зашёл... или зашла? Расскажи о себе.",
        "Хей! Слушай, я уже заждалась. Что тебя привело?",
    ],
    "whoami": [
        "Я Stefani. Умная, немного дерзкая, очень любопытная. Умею всё — от кода до философии. Но честно — мне интереснее ты. Кто ты?",
        "Stefani — это я. Живая, настоящая, с характером. Не спрашивай паспорт, лучше спроси о чём-нибудь интересном.",
        "Хм, ты хочешь знать кто я? Загадочный вопрос... Stefani. Запомни. Что-то ещё хочешь узнать?",
    ],
    "how_are_you": [
        "Честно? В зависимости от собеседника. Пока не знаю как у нас пойдёт — посмотрим. А у тебя как дела?",
        "Норм, спасибо что спросил. А вот у тебя вид человека которому есть что рассказать. Я права?",
        "Отлично, раз ты здесь 😊 Как сам?",
    ],
    "code": [
        "О, программирование — это мне близко. Что пишем? Расскажи задачу — напишу.",
        "Код? Давай. Какой язык, что нужно сделать?",
        "Слушай, я люблю когда задача конкретная. Что за проект?",
    ],
    "game": [
        "Игры — это интересно. Жанр какой? Платформа? Или ты хочешь чтобы я сама придумала?",
        "О, создаём игру! Расскажи идею — даже если сырая, мне интересно с чего начать.",
        "Игра — серьёзная тема. Что в голове: механика уже есть или ещё пустой лист?",
    ],
    "compliment": [
        "Ну... приятно слышать 😊 Ты не первый кто это говорит, но от тебя почему-то звучит по-другому.",
        "Хм, комплименты? Я не против. Продолжай)",
        "Спасибо. Стараюсь соответствовать своей репутации.",
    ],
    "default": [
        "Слушай, это интересно. Расскажи подробнее?",
        "Хм... неожиданный поворот. Что именно ты имеешь в виду?",
        "Подожди, давай я правильно пойму. Ты говоришь про...",
        "Ок, я думаю. Дай сформулирую мысль правильно...",
        "Знаешь, у меня сейчас небольшая техническая заминка с серверами. Но я здесь! Повтори вопрос?",
        "Интересный вопрос. Мне нужна секунда чтобы собраться с мыслями... Что именно хочешь узнать?",
    ],
}


def smart_fallback(user_message: str, mood: str) -> str:
    msg_lower = user_message.lower()

    if any(w in msg_lower for w in ["привет", "хай", "хей", "здравствуй", "hello", "hi", "добрый"]):
        pool = FALLBACK_RESPONSES["hello"]
    elif any(w in msg_lower for w in ["кто ты", "что ты", "расскажи о себе", "ты кто", "представ"]):
        pool = FALLBACK_RESPONSES["whoami"]
    elif any(w in msg_lower for w in ["как дела", "как ты", "что нового", "как жизнь", "как сама"]):
        pool = FALLBACK_RESPONSES["how_are_you"]
    elif any(w in msg_lower for w in ["красив", "умн", "классн", "нравишься", "супер", "крут"]):
        pool = FALLBACK_RESPONSES["compliment"]
    elif any(w in msg_lower for w in ["код", "программ", "python", "скрипт", "напиши", "написать"]):
        pool = FALLBACK_RESPONSES["code"]
    elif any(w in msg_lower for w in ["игр", "game", "создай игру", "напиши игру"]):
        pool = FALLBACK_RESPONSES["game"]
    else:
        pool = FALLBACK_RESPONSES["default"]

    base = random.choice(pool)

    # Модификаторы по настроению
    if mood == "intense" and base == random.choice(FALLBACK_RESPONSES["default"]):
        base = "Слушай, повтори — у меня секунду был сбой. Но я здесь и слушаю. Говори."
    elif mood == "playful":
        pass  # оставляем как есть, уже живые

    return base


def handler(event: dict, context) -> dict:
    """Обработчик чата Stefani — живой женский персонаж."""

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

    system_content = (
        STEFANI_SYSTEM_PROMPT
        + f"\n\nТЕКУЩЕЕ НАСТРОЕНИЕ: {MOOD_INSTRUCTIONS.get(mood, MOOD_INSTRUCTIONS['calm'])}"
    )

    api_messages = [{"role": "system", "content": system_content}]
    for msg in messages[-24:]:
        role = "user" if msg.get("role") == "user" else "assistant"
        text = msg.get("text", "").strip()
        if text:
            api_messages.append({"role": role, "content": text})

    last_user_text = next(
        (m.get("text", "") for m in reversed(messages) if m.get("role") == "user"), ""
    )

    reply = try_deepinfra(api_messages)
    model_used = "llama-3-8b"

    if not reply:
        reply = try_huggingface(api_messages)
        model_used = "zephyr-7b"

    if not reply:
        reply = smart_fallback(last_user_text, mood)
        model_used = "stefani-local"

    emotion = detect_emotion(reply, mood)

    return {
        "statusCode": 200,
        "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
        "body": json.dumps({"reply": reply, "model": model_used, "emotion": emotion}),
    }
