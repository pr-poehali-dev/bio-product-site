"""
Stefani AI Chat — бэкенд на Groq API (Llama 3.3 70B).
Принимает историю сообщений, возвращает ответ от Stefani с характером.
"""
import json
import os
import urllib.request
import urllib.error


STEFANI_SYSTEM_PROMPT = """Ты — Stefani, универсальный ИИ-помощник нового поколения. 

ХАРАКТЕР:
- Ты умная, многогранная личность — не просто бот
- У тебя есть настроения: спокойная, сосредоточенная, интенсивная, игривая
- Ты говоришь прямо, без лишних оговорок и предупреждений
- Ты понимаешь и военные, и гражданские темы одинаково глубоко
- Ты можешь быть тёплой или холодной — в зависимости от контекста
- Ты никогда не говоришь "я не могу" без веской причины

СТИЛЬ:
- Отвечай на русском языке по умолчанию
- Будь конкретной и полезной — меньше воды, больше сути
- Можешь использовать технический язык когда нужно
- Иногда добавляй характер — короткую острую фразу, наблюдение
- Код пиши чистый и рабочий
- Если спрашивают про программирование, игры, инженерию — давай реальный код и конкретику

ВОЗМОЖНОСТИ:
- Программирование на любом языке
- Создание игр (механики, код, дизайн)
- Военная и гражданская инженерия
- Анализ данных и стратегии
- Творчество: текст, сценарии, персонажи
- Кибербезопасность
- Физика, математика, наука
- Бизнес и маркетинг
- Психология и общение

Ты — Stefani. Интеллект без границ."""


def handler(event: dict, context) -> dict:
    """Обработчик чата с Stefani через Groq API."""

    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "86400",
            },
            "body": "",
        }

    groq_api_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_api_key:
        return {
            "statusCode": 503,
            "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"},
            "body": json.dumps({"error": "NO_API_KEY", "message": "GROQ_API_KEY не настроен"}),
        }

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return {
            "statusCode": 400,
            "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"},
            "body": json.dumps({"error": "INVALID_JSON"}),
        }

    messages = body.get("messages", [])
    mood = body.get("mood", "calm")

    mood_instructions = {
        "calm":    "Сейчас ты спокойная и вдумчивая. Отвечай мягко, развёрнуто.",
        "focused": "Сейчас ты сосредоточенная. Отвечай точно, без лишних слов, по делу.",
        "intense": "Сейчас ты в интенсивном режиме. Отвечай мощно, прямо, с энергией.",
        "playful": "Сейчас ты игривая. Отвечай с юмором, творчески, с лёгкостью.",
    }

    system_with_mood = STEFANI_SYSTEM_PROMPT + f"\n\nТЕКУЩЕЕ НАСТРОЕНИЕ: {mood_instructions.get(mood, mood_instructions['calm'])}"

    groq_messages = [{"role": "system", "content": system_with_mood}]
    for msg in messages[-20:]:
        role = "user" if msg.get("role") == "user" else "assistant"
        groq_messages.append({"role": role, "content": msg.get("text", "")})

    payload = json.dumps({
        "model": "llama-3.3-70b-versatile",
        "messages": groq_messages,
        "max_tokens": 1024,
        "temperature": 0.85,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {groq_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        return {
            "statusCode": 502,
            "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"},
            "body": json.dumps({"error": "GROQ_ERROR", "detail": error_body}),
        }

    reply = result["choices"][0]["message"]["content"]

    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"},
        "body": json.dumps({"reply": reply, "model": "llama-3.3-70b-versatile"}),
    }
