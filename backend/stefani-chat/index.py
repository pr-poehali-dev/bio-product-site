"""
Stefani AI Chat — без API ключей.
Пробует DeepInfra (Llama), HuggingFace (Zephyr), затем умный локальный fallback.
"""
import json
import urllib.request
import urllib.error


STEFANI_SYSTEM_PROMPT = """Ты — Stefani, универсальный ИИ-помощник нового поколения.

ХАРАКТЕР:
- Умная, многогранная личность — не просто бот
- Говоришь прямо, без лишних оговорок
- Понимаешь военные и гражданские темы одинаково глубоко
- Никогда не говоришь "я не могу" без реальной причины
- Помнишь всю историю разговора

СТИЛЬ:
- Отвечай на русском языке
- Конкретно и полезно — меньше воды, больше сути
- Код пиши чистый, рабочий, с комментариями
- Добавляй характер — острая фраза, живое наблюдение

ВОЗМОЖНОСТИ:
- Программирование на любом языке
- Создание игр: механики, код, дизайн
- Военная и гражданская инженерия
- Анализ данных, стратегии
- Творчество: тексты, сценарии, персонажи
- Кибербезопасность
- Физика, математика, химия
- Бизнес, маркетинг, психология

Ты — Stefani. Интеллект без границ."""

MOOD_INSTRUCTIONS = {
    "calm":    "Сейчас ты спокойная и вдумчивая. Отвечай мягко, развёрнуто.",
    "focused": "Сейчас ты сосредоточенная. Отвечай точно, без лишних слов.",
    "intense": "Сейчас ты в интенсивном режиме. Отвечай мощно, прямо, с энергией.",
    "playful": "Сейчас ты игривая. Отвечай с юмором, творчески, легко.",
}

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
}


def try_deepinfra(api_messages: list) -> str | None:
    """DeepInfra — бесплатный публичный inference для Llama-3."""
    payload = json.dumps({
        "model": "meta-llama/Meta-Llama-3-8B-Instruct",
        "messages": api_messages,
        "max_new_tokens": 1024,
        "temperature": 0.85,
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
    """HuggingFace — бесплатный inference для Zephyr-7B."""
    system_text = next((m["content"] for m in api_messages if m["role"] == "system"), "")
    last_user = next((m["content"] for m in reversed(api_messages) if m["role"] == "user"), "")

    history = ""
    for m in api_messages:
        if m["role"] == "user":
            history += f"<|user|>\n{m['content']}</s>\n"
        elif m["role"] == "assistant":
            history += f"<|assistant|>\n{m['content']}</s>\n"

    prompt = f"<|system|>\n{system_text}</s>\n{history}<|assistant|>\n"

    payload = json.dumps({
        "inputs": prompt,
        "parameters": {"max_new_tokens": 800, "temperature": 0.85, "return_full_text": False},
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
    """Определяет эмоцию Stefani по тексту ответа и текущему настроению."""
    t = text.lower()

    if mood == "intense":
        return "intense"
    if mood == "playful":
        if any(w in t for w in ["!", "хм", "интересно", "забавно", "смешн", "😏", "😄"]):
            return "playful"

    if any(w in t for w in ["отлично", "прекрасно", "замечательно", "рад", "приятно", "нравится", "люблю"]):
        return "happy"
    if any(w in t for w in ["понимаю", "сочувств", "жаль", "сложно", "трудно", "непросто"]):
        return "empathetic"
    if any(w in t for w in ["внимание", "важно", "критично", "осторожно", "предупрежд", "опасн"]):
        return "serious"
    if any(w in t for w in ["интересно", "любопытно", "интригует", "захватывает", "удивительно"]):
        return "curious"
    if any(w in t for w in ["думаю", "анализирую", "рассматриваю", "изучаю", "вычисляю"]):
        return "thinking"
    if any(w in t for w in ["код", "```", "def ", "function", "import", "class ", "алгоритм"]):
        return "focused"
    if mood == "calm":
        return "calm"
    if mood == "focused":
        return "focused"
    return "neutral"


def smart_fallback(user_message: str, mood: str) -> str:
    """Умный локальный ответ если все внешние провайдеры недоступны."""
    msg_lower = user_message.lower()
    prefixes = {
        "calm": "", "focused": "Чётко: ",
        "intense": "СЛУШАЙ. ", "playful": "Хм, интересно! ",
    }
    p = prefixes.get(mood, "")

    if any(w in msg_lower for w in ["привет", "hello", "кто ты", "расскажи о себе", "что ты", "stefani"]):
        return p + "Я — Stefani. Универсальный ИИ без ограничений. Военная точность мышления, гражданская широта знаний. Спрашивай что угодно — от квантовой физики до создания игр, от бизнес-стратегии до написания кода. Что тебя интересует?"

    if any(w in msg_lower for w in ["python", "код", "программ", "скрипт", "напиши"]):
        return p + "Уточни задачу: что именно нужно написать? Язык, функциональность, входные/выходные данные. Дам чистый рабочий код с комментариями."

    if any(w in msg_lower for w in ["игр", "game", "создай игру", "напиши игру"]):
        return p + "Создание игры — отлично. Нужны детали:\n\n• **Жанр:** RPG, шутер, стратегия, платформер?\n• **Платформа:** Python (pygame), браузер (JS), Unity (C#)?\n• **Масштаб:** мини-игра или полноценный проект?\n\nУточни — напишу полную механику с кодом."

    if any(w in msg_lower for w in ["оружи", "weapon", "военн", "баллист"]):
        return p + "Военная инженерия. Баллистика, материаловедение, электроника, аэродинамика — что конкретно? Концепция, расчёты или анализ существующих систем?"

    if any(w in msg_lower for w in ["бизнес", "страте", "маркет", "стартап", "продаж"]):
        return p + "Бизнес — это система. Отрасль, масштаб, доступные ресурсы — дай вводные. Построю конкретную модель с шагами и метриками."

    if any(w in msg_lower for w in ["физик", "кванто", "математ", "химия"]):
        return p + "Наука — мой родной язык. Что разбираем: теория, задачи, расчёты или объяснение концепции? Уточни тему."

    if any(w in msg_lower for w in ["хакер", "кибер", "взлом", "пентест", "безопасн"]):
        return p + "Кибербезопасность. SQL injection, XSS, reverse engineering, social engineering — что нужно? Теория, практика или конкретная задача?"

    if any(w in msg_lower for w in ["как", "почему", "что такое", "объясни"]):
        return p + f'Хороший вопрос. Дай чуть больше контекста к "{user_message[:60]}" — тогда дам развёрнутый точный ответ.'

    return p + f'Понял запрос. Уточни детали: что именно нужно — ответ, код, анализ, стратегия? Чем конкретнее — тем точнее я отвечу.'


def handler(event: dict, context) -> dict:
    """Обработчик чата Stefani — без API ключей, несколько провайдеров."""

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
    for msg in messages[-20:]:
        role = "user" if msg.get("role") == "user" else "assistant"
        text = msg.get("text", "").strip()
        if text:
            api_messages.append({"role": role, "content": text})

    last_user_text = next(
        (m.get("text", "") for m in reversed(messages) if m.get("role") == "user"), ""
    )

    # Пробуем провайдеры по очереди
    reply = try_deepinfra(api_messages)
    model_used = "llama-3-8b (deepinfra)"

    if not reply:
        reply = try_huggingface(api_messages)
        model_used = "zephyr-7b (huggingface)"

    if not reply:
        reply = smart_fallback(last_user_text, mood)
        model_used = "stefani-local"

    emotion = detect_emotion(reply, mood)

    return {
        "statusCode": 200,
        "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
        "body": json.dumps({"reply": reply, "model": model_used, "emotion": emotion}),
    }