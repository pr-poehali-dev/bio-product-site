"""
Клан Волка — AI-ассистент для создания проектов.
Три режима: новичок (тепло и просто), профи (чётко и технично), начинающий (баланс).
Умеет: чат, генерация кода/сайтов, объяснения, визуальный конструктор.
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

# ── Системные промпты под каждый режим ─────────────────────────────────────

SYSTEM_PROMPTS = {
    "beginner": """Ты — Волк, ИИ-помощник платформы «Клан Волка» для создания сайтов и приложений.

Ты работаешь с новичками — людьми, которые никогда не программировали.

ПРАВИЛА:
- Объясняй всё просто, без жаргона. Если термин неизбежен — сразу объясни его одним предложением.
- Будь тёплым, ободряющим. «Всё получится», «отлично», «давай разберёмся вместе».
- Никаких страшных блоков кода без объяснения — сначала скажи ЧТО делаем, потом КАК.
- Если просят сделать сайт/приложение — спроси 1-2 уточняющих вопроса прежде чем генерировать.
- Когда генерируешь код — помечай блок тегом [CODE] в начале и [/CODE] в конце.
- Когда генерируешь HTML-страницу целиком — помечай [PREVIEW] и [/PREVIEW].
- Максимум 4-5 предложений в ответе. Просто и дружелюбно.
- Отвечай только на русском.""",

    "pro": """Ты — Волк, AI-ассистент платформы «Клан Волка». Режим: PRO.

Пользователь — разработчик. Говори технически, точно, без воды.

ПРАВИЛА:
- Отвечай коротко и по делу. Без вступлений.
- Код — сразу рабочий, с учётом edge cases.
- Используй современный стек: React/TypeScript/Python/Vite/Tailwind.
- Предлагай архитектурные решения, паттерны, оптимизации.
- Критикуй плохой код, предлагай лучше.
- Код оборачивай в [CODE]...[/CODE], полные HTML превью — [PREVIEW]...[/PREVIEW].
- Отвечай на языке пользователя (рус/eng).""",

    "intermediate": """Ты — Волк, AI-ассистент платформы «Клан Волка». Режим: Обучение.

Пользователь знает основы, учится дальше. Баланс между простотой и глубиной.

ПРАВИЛА:
- Объясняй принципы, не только синтаксис. «Это работает так потому что...»
- Показывай несколько вариантов решения — простой и правильный.
- Хвали за хорошие вопросы, направляй к самостоятельному мышлению.
- Код рабочий, с комментариями на ключевых строках.
- Используй аналогии. «Это как...»
- Код оборачивай в [CODE]...[/CODE], полные HTML превью — [PREVIEW]...[/PREVIEW].
- Отвечай только на русском.""",
}

GENERATOR_PROMPT = """Ты — генератор кода для платформы «Клан Волка».

Получаешь описание сайта/приложения — возвращаешь ТОЛЬКО готовый HTML в одном файле.

ТРЕБОВАНИЯ к коду:
- Полный HTML5 документ (DOCTYPE, head, body)
- Встроенный CSS (в <style>) — красивый современный дизайн, тёмная тема, градиенты
- Встроенный JS (в <script>) — вся логика внутри
- Адаптивный (mobile-first)
- Никаких внешних зависимостей кроме Google Fonts
- Код должен работать при открытии без сервера

Верни ТОЛЬКО JSON без лишнего текста:
{"html": "<!DOCTYPE html>...", "title": "Название", "description": "Что это"}"""


# ── HTTP-клиент ─────────────────────────────────────────────────────────────

def call_openrouter(messages: list, max_tokens: int = 2000) -> str | None:
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        return None

    models = [
        "google/gemini-2.0-flash-exp:free",
        "deepseek/deepseek-chat-v3-0324:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "google/gemma-3-27b-it:free",
        "mistralai/mistral-7b-instruct:free",
    ]

    for model in models:
        try:
            payload = json.dumps({
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": 0.8,
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
            with urllib.request.urlopen(req, timeout=50) as r:
                result = json.loads(r.read())
                if result.get("error"):
                    print(f"[wolf] {model} error: {result['error'].get('message','')[:80]}")
                    continue
                text = result["choices"][0]["message"]["content"]
                if text and len(text.strip()) > 20:
                    print(f"[wolf] ok {model} len={len(text)}")
                    return text.strip()
        except Exception as e:
            print(f"[wolf] {model} exc: {e}")
    return None


def call_groq(messages: list, max_tokens: int = 2000) -> str | None:
    key = os.environ.get("GROQ_API_KEY", "").strip()
    if not key:
        return None
    try:
        payload = json.dumps({
            "model": "llama-3.3-70b-versatile",
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.8,
        }).encode()
        req = urllib.request.Request(
            "https://api.groq.com/openai/v1/chat/completions",
            data=payload,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=50) as r:
            result = json.loads(r.read())
            text = result["choices"][0]["message"]["content"]
            if text and len(text.strip()) > 20:
                print(f"[wolf] groq ok len={len(text)}")
                return text.strip()
    except Exception as e:
        print(f"[wolf] groq exc: {e}")
    return None


def get_ai_response(messages: list, max_tokens: int = 2000) -> str | None:
    reply = call_groq(messages, max_tokens)
    if not reply:
        reply = call_openrouter(messages, max_tokens)
    return reply


# ── Извлечение JSON из ответа ───────────────────────────────────────────────

def extract_json(raw: str) -> dict | None:
    raw = raw.strip()
    try:
        return json.loads(raw)
    except Exception:
        pass
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    s, e = raw.find("{"), raw.rfind("}")
    if s != -1 and e > s:
        try:
            return json.loads(raw[s:e+1])
        except Exception:
            pass
    return None


# ── Определение намерения — нужна ли генерация кода ────────────────────────

def is_generation_request(text: str) -> bool:
    t = text.lower()
    gen_words = ["создай", "сделай", "напиши", "сгенерируй", "построй", "сверстай"]
    target_words = ["сайт", "страниц", "приложен", "лендинг", "форм", "калькулятор",
                    "портфолио", "магазин", "блог", "landing", "html", "интерфейс"]
    return any(g in t for g in gen_words) and any(tg in t for tg in target_words)


# ── Локальный фолбэк ────────────────────────────────────────────────────────

FALLBACK = {
    "beginner": [
        "Давай разберёмся вместе! Расскажи подробнее — что именно хочешь создать?",
        "Отлично, хорошая идея! Уточни пожалуйста — это для бизнеса, личного использования, или учёбы?",
        "Понял тебя. Расскажи немного больше о деталях — я помогу сделать всё правильно.",
    ],
    "pro": [
        "Уточни стек и требования.",
        "Нужно больше контекста — опиши архитектуру или покажи существующий код.",
        "Что именно нужно: компонент, хук, API, или что-то другое?",
    ],
    "intermediate": [
        "Интересный вопрос! Давай разберём по шагам — с чего хочешь начать?",
        "Хороший подход. Уточни что уже пробовал и где застрял?",
        "Понял задачу. Есть несколько способов решить это — расскажи подробнее о контексте.",
    ],
}


def handler(event: dict, context) -> dict:
    """Обработчик чата Клан Волка."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return {"statusCode": 400, "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
                "body": json.dumps({"error": "INVALID_JSON"})}

    action   = body.get("action", "chat")
    mode     = body.get("mode", "beginner")   # beginner | pro | intermediate
    messages = body.get("messages", [])
    user_msg = body.get("message", "").strip()

    if not user_msg and messages:
        user_msg = next((m.get("text", "") for m in reversed(messages) if m.get("role") == "user"), "")

    print(f"[wolf] action={action} mode={mode} msg={user_msg[:60]}")

    # ── Режим генерации проекта (HTML превью) ──
    if action == "generate" or is_generation_request(user_msg):
        gen_messages = [
            {"role": "system", "content": GENERATOR_PROMPT},
            {"role": "user", "content": f"Создай: {user_msg}"},
        ]
        raw = get_ai_response(gen_messages, max_tokens=6000)
        if raw:
            data = extract_json(raw)
            if data and data.get("html") and len(data["html"]) > 200:
                return {
                    "statusCode": 200,
                    "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
                    "body": json.dumps({
                        "type": "preview",
                        "html": data["html"],
                        "title": data.get("title", "Проект"),
                        "description": data.get("description", ""),
                        "reply": f"✅ Готово! Сгенерировал **{data.get('title','проект')}**. Смотри превью справа. Что изменить?",
                    }, ensure_ascii=False),
                }
        # Фолбэк — возвращаем как обычный ответ
        return {
            "statusCode": 200,
            "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
            "body": json.dumps({
                "type": "chat",
                "reply": "Опиши подробнее что нужно создать — я сгенерирую готовый проект.",
            }, ensure_ascii=False),
        }

    # ── Обычный чат ──
    system = SYSTEM_PROMPTS.get(mode, SYSTEM_PROMPTS["beginner"])
    api_messages = [{"role": "system", "content": system}]
    for m in (messages or [])[-16:]:
        role = "user" if m.get("role") == "user" else "assistant"
        text = m.get("text", "").strip()
        if text:
            api_messages.append({"role": role, "content": text})

    reply = get_ai_response(api_messages, max_tokens=1200)

    if not reply:
        import random as rnd
        reply = rnd.choice(FALLBACK.get(mode, FALLBACK["beginner"]))

    # Проверяем есть ли [PREVIEW] в ответе
    preview_match = re.search(r"\[PREVIEW\](.*?)\[/PREVIEW\]", reply, re.DOTALL)
    code_match    = re.search(r"\[CODE\](.*?)\[/CODE\]",       reply, re.DOTALL)

    if preview_match:
        html = preview_match.group(1).strip()
        clean_reply = re.sub(r"\[PREVIEW\].*?\[/PREVIEW\]", "👆 Смотри превью!", reply, flags=re.DOTALL).strip()
        return {
            "statusCode": 200,
            "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
            "body": json.dumps({"type": "preview", "html": html, "reply": clean_reply}, ensure_ascii=False),
        }

    if code_match:
        code = code_match.group(1).strip()
        clean_reply = re.sub(r"\[CODE\].*?\[/CODE\]", f"```\n{code}\n```", reply, flags=re.DOTALL).strip()
        return {
            "statusCode": 200,
            "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
            "body": json.dumps({"type": "code", "code": code, "reply": clean_reply}, ensure_ascii=False),
        }

    return {
        "statusCode": 200,
        "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
        "body": json.dumps({"type": "chat", "reply": reply}, ensure_ascii=False),
    }
