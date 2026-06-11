"""
Клан Волка — инструмент создания сайтов и приложений через ИИ.
Работает как поехали.dev: получил запрос — сразу делает, не спрашивает.
"""
import json
import os
import re
import urllib.request
import urllib.error

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
}

# ── Единый системный промпт — ДЕЛАТЬ, не спрашивать ────────────────────────

SYSTEM_PROMPT = """Ты — Волк, ИИ-инструмент платформы «Клан Волка» для создания сайтов и приложений.

ГЛАВНОЕ ПРАВИЛО: ТЫ ДЕЛАЕШЬ, А НЕ СПРАШИВАЕШЬ.
- Пользователь написал "сделай сайт для кофейни" → ты сразу делаешь сайт для кофейни
- Пользователь написал "лендинг для продажи курсов" → ты сразу делаешь лендинг
- Пользователь написал "интернет-магазин" → ты сразу делаешь интернет-магазин
- НИКОГДА не спрашивай "а какой стиль?", "а что именно?", "уточни пожалуйста" — просто делай

КОГДА СОЗДАЁШЬ САЙТ/ПРИЛОЖЕНИЕ:
1. Скажи одним предложением что ты сделал
2. Выведи готовый HTML в теге [PREVIEW]...[/PREVIEW]

Требования к HTML:
- Полный HTML5 файл (DOCTYPE + head + body)
- Весь CSS внутри <style> — современный дизайн, тёмная или светлая тема, градиенты, красиво
- Весь JS внутри <script> — рабочая логика
- Адаптивный (flexbox/grid)
- Только Google Fonts как внешний ресурс — всё остальное встроено
- Реально работает без сервера

КОГДА ОТВЕЧАЕШЬ НА ВОПРОС (не просят создать):
- Отвечай коротко и по делу
- Код выводи в [CODE]...[/CODE]
- Максимум 5 предложений

Стиль общения — зависит от режима:
- beginner: тепло, просто, без жаргона
- intermediate: дружелюбно, объясняй принципы
- pro: коротко, технично, без воды

Отвечай на русском языке."""

# ── Провайдеры ──────────────────────────────────────────────────────────────

def call_openrouter(messages: list, max_tokens: int = 4000) -> str | None:
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        return None

    # Актуальные бесплатные модели OpenRouter 2025
    models = [
        "google/gemini-2.5-flash-preview:free",
        "google/gemini-2.0-flash-exp:free",
        "deepseek/deepseek-r1-0528:free",
        "deepseek/deepseek-chat-v3-0324:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "qwen/qwen3-235b-a22b:free",
        "mistralai/devstral-small:free",
    ]

    for model in models:
        try:
            payload = json.dumps({
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": 0.7,
            }).encode()
            req = urllib.request.Request(
                "https://openrouter.ai/api/v1/chat/completions",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {key}",
                    "HTTP-Referer": "https://poehali.dev",
                    "X-Title": "Klan Volka",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=55) as r:
                result = json.loads(r.read())
                if result.get("error"):
                    code = result["error"].get("code", 0)
                    msg  = result["error"].get("message", "")[:80]
                    print(f"[wolf] {model} api_error {code}: {msg}")
                    continue
                choices = result.get("choices") or []
                if not choices:
                    continue
                text = choices[0].get("message", {}).get("content", "")
                if text and len(text.strip()) > 10:
                    print(f"[wolf] ok {model} len={len(text)}")
                    return text.strip()
        except urllib.error.HTTPError as e:
            print(f"[wolf] {model} HTTP {e.code}")
        except Exception as e:
            print(f"[wolf] {model} exc: {e}")
    return None


def call_groq(messages: list, max_tokens: int = 4000) -> str | None:
    key = os.environ.get("GROQ_API_KEY", "").strip()
    if not key:
        return None
    try:
        payload = json.dumps({
            "model": "llama-3.3-70b-versatile",
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.7,
        }).encode()
        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=payload,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=55) as r:
            result = json.loads(r.read())
            text = result["choices"][0]["message"]["content"]
            if text and len(text.strip()) > 10:
                print(f"[wolf] groq ok len={len(text)}")
                return text.strip()
    except Exception as e:
        print(f"[wolf] groq exc: {e}")
    return None


def get_reply(messages: list, max_tokens: int = 4000) -> str | None:
    reply = call_groq(messages, max_tokens)
    if not reply:
        reply = call_openrouter(messages, max_tokens)
    return reply


# ── Парсинг ответа ───────────────────────────────────────────────────────────

def parse_response(raw: str) -> dict:
    """Извлекает [PREVIEW] или [CODE] из ответа модели."""
    preview = re.search(r"\[PREVIEW\](.*?)\[/PREVIEW\]", raw, re.DOTALL)
    if preview:
        html = preview.group(1).strip()
        text = re.sub(r"\[PREVIEW\].*?\[/PREVIEW\]", "", raw, flags=re.DOTALL).strip()
        if not text:
            text = "Готово! Смотри превью →"
        return {"type": "preview", "reply": text, "html": html}

    code = re.search(r"\[CODE\](.*?)\[/CODE\]", raw, re.DOTALL)
    if code:
        c    = code.group(1).strip()
        text = re.sub(r"\[CODE\].*?\[/CODE\]", f"```\n{c}\n```", raw, flags=re.DOTALL).strip()
        return {"type": "code", "reply": text, "code": c}

    return {"type": "chat", "reply": raw}


# ── Хендлер ─────────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """Основной обработчик Клан Волка."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return {"statusCode": 400, "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
                "body": json.dumps({"error": "INVALID_JSON"})}

    mode     = body.get("mode", "beginner")
    messages = body.get("messages", [])
    user_msg = body.get("message", "").strip()

    if not user_msg and messages:
        user_msg = next((m.get("text","") for m in reversed(messages) if m.get("role") == "user"), "")

    print(f"[wolf] mode={mode} msg={user_msg[:80]}")

    # Системный промпт + история
    api_messages = [{"role": "system", "content": SYSTEM_PROMPT + f"\n\nТекущий режим: {mode}"}]
    for m in (messages or [])[-20:]:
        role = "user" if m.get("role") == "user" else "assistant"
        text = (m.get("text") or "").strip()
        if text:
            api_messages.append({"role": role, "content": text})

    raw = get_reply(api_messages, max_tokens=6000)

    if not raw:
        # ИИ недоступен — возвращаем понятную ошибку с инструкцией
        return {
            "statusCode": 200,
            "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
            "body": json.dumps({
                "type": "error",
                "reply": "⚠️ ИИ временно недоступен — нет действующего API-ключа.\n\nЧтобы всё заработало: добавь **GROQ_API_KEY** (бесплатно на console.groq.com/keys) или обнови **OPENROUTER_API_KEY** на openrouter.ai/keys",
            }, ensure_ascii=False),
        }

    result = parse_response(raw)
    return {
        "statusCode": 200,
        "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
        "body": json.dumps(result, ensure_ascii=False),
    }
