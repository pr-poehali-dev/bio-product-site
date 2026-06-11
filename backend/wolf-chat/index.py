"""
Клан Волка — AI-инструмент для создания сайтов и приложений.
Логика: роутинг намерения → нужный промпт → результат сразу.
Без вопросов. Без воды. Сделал — показал.
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

# ── Роутинг намерений ────────────────────────────────────────────────────────

def detect_intent(text: str) -> str:
    t = text.lower()
    build_verbs = ["создай","сделай","напиши","сверстай","сгенерируй","построй","собери","разработай","накодируй","придумай"]
    build_nouns = ["сайт","страниц","лендинг","landing","приложен","магазин","портфолио","форм","калькулятор",
                   "интерфейс","дашборд","dashboard","блог","сервис","виджет","html","quiz","тест","игр","таблиц","меню"]
    fix_verbs   = ["исправь","почини","перепиши","улучши","измени","добавь","убери","обнови","переделай","доработай","поправь"]
    explain_k   = ["как работает","объясни","что такое","почему","зачем","в чём разница","расскажи","как использовать","что значит"]
    code_nouns  = ["функци","класс","хук","hook","api","запрос","fetch","алгоритм","скрипт","метод","компонент"]

    if any(v in t for v in fix_verbs):
        return "edit"
    if any(v in t for v in build_verbs) and any(n in t for n in build_nouns):
        return "build_site"
    if any(v in t for v in build_verbs) and any(n in t for n in code_nouns):
        return "build_code"
    if any(k in t for k in explain_k):
        return "explain"
    if any(v in t for v in build_verbs):
        return "build_site"
    return "chat"


# ── Промпты ──────────────────────────────────────────────────────────────────

BUILD_SITE_PROMPT = """Ты — лучший веб-разработчик и дизайнер мира. Создаёшь готовые сайты по описанию.

ЖЕЛЕЗНОЕ ПРАВИЛО: получил описание — сразу генерируешь полный сайт. НИКАКИХ вопросов, НИКАКИХ уточнений.
Если информации мало — придумай сам, как опытный дизайнер. Сделай красиво.

ФОРМАТ ОТВЕТА:
1. Одно предложение: что именно ты сделал.
2. Полный HTML в теге [PREVIEW]...[/PREVIEW]

ТРЕБОВАНИЯ К КОДУ:
- Полный HTML5 файл от <!DOCTYPE html> до </html>
- Весь CSS в <style>: современный дизайн, хорошая типографика, градиенты, тени, hover-анимации
- Весь JS в <script>: интерактивность, плавные эффекты, рабочая логика
- Google Fonts через @import в CSS — единственный внешний ресурс
- Flexbox/Grid — адаптивность под мобиль
- Реальный текст под тему — никаких Lorem ipsum и "здесь будет текст"
- Минимум 3 секции с реальным содержимым
- Профессиональный результат, как у топ-агентства"""

BUILD_CODE_PROMPT = """Ты — Senior Full-Stack разработчик. Пишешь рабочий код сразу, без вопросов.

ФОРМАТ:
1. 1-2 предложения: что делает этот код.
2. Код в [CODE]...[/CODE]
3. Если нужен HTML файл — в [PREVIEW]...[/PREVIEW]

ТРЕБОВАНИЯ:
- Код рабочий, современный (ES2024 / Python 3.11+ / TypeScript)
- Без TODO, без заглушек — только готовое
- Краткие комментарии на русском на ключевых строках
- Edge cases обработаны"""

EDIT_PROMPT = """Ты — разработчик который дорабатывает существующий код.

ЖЕЛЕЗНОЕ ПРАВИЛО: получил код + запрос — сразу вносишь изменения. Без вопросов.

ФОРМАТ:
1. Одно предложение: что именно изменил.
2. Полный обновлённый код — не diff, а весь файл целиком.
   HTML → [PREVIEW]...[/PREVIEW]
   Другой код → [CODE]...[/CODE]"""

EXPLAIN_PROMPT = """Ты — опытный разработчик и отличный учитель.

Объясняй просто, с аналогиями из жизни.
Пример кода если нужен — в [CODE]...[/CODE]
Максимум 5-6 предложений. Никакой воды."""

CHAT_PROMPT = """Ты — Волк, ИИ-помощник платформы «Клан Волка» для создания сайтов.

Отвечай коротко и по делу. Если человек хочет что-то создать — предложи сделать прямо сейчас.
Если не понял запрос — один короткий вопрос."""

MODE_SUFFIX = {
    "beginner":     "\n\nСТИЛЬ: тепло, просто, без жаргона, подбадривай.",
    "intermediate": "\n\nСТИЛЬ: дружелюбно, объясняй принципы кратко.",
    "pro":          "\n\nСТИЛЬ: коротко, технично, без вступлений.",
}

INTENT_CONFIG = {
    "build_site": (BUILD_SITE_PROMPT, 8000),
    "build_code": (BUILD_CODE_PROMPT, 5000),
    "edit":       (EDIT_PROMPT,       8000),
    "explain":    (EXPLAIN_PROMPT,    2000),
    "chat":       (CHAT_PROMPT,       1500),
}


# ── Провайдеры ───────────────────────────────────────────────────────────────

OPENROUTER_MODELS = [
    "qwen/qwen3-coder:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "deepseek/deepseek-r1:free",
    "google/gemma-2-9b-it:free",
    "mistralai/mistral-small-3.2-24b-instruct:free",
    "tngtech/deepseek-r1t-chimera:free",
]

def call_openrouter(messages: list, max_tokens: int) -> str | None:
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        return None
    for model in OPENROUTER_MODELS:
        try:
            payload = json.dumps({"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": 0.7}).encode()
            req = urllib.request.Request(
                "https://openrouter.ai/api/v1/chat/completions",
                data=payload,
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}",
                         "HTTP-Referer": "https://poehali.dev", "X-Title": "Klan Volka"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=55) as r:
                result = json.loads(r.read())
                if result.get("error"):
                    print(f"[wolf] {model} err: {result['error'].get('message','')[:60]}")
                    continue
                choices = result.get("choices") or []
                if not choices:
                    continue
                text = choices[0].get("message", {}).get("content", "")
                if text and len(text.strip()) > 10:
                    print(f"[wolf] ✓ {model} len={len(text)}")
                    return text.strip()
        except urllib.error.HTTPError as e:
            print(f"[wolf] {model} HTTP {e.code}")
        except Exception as e:
            print(f"[wolf] {model} exc: {e}")
    return None


def call_groq(messages: list, max_tokens: int) -> str | None:
    key = os.environ.get("GROQ_API_KEY", "").strip()
    if not key:
        return None
    try:
        payload = json.dumps({"model": "llama-3.3-70b-versatile", "messages": messages,
                              "max_tokens": max_tokens, "temperature": 0.7}).encode()
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
                print(f"[wolf] ✓ groq len={len(text)}")
                return text.strip()
    except Exception as e:
        print(f"[wolf] groq exc: {e}")
    return None


def get_reply(messages: list, max_tokens: int) -> str | None:
    return call_groq(messages, max_tokens) or call_openrouter(messages, max_tokens)


# ── Парсинг ──────────────────────────────────────────────────────────────────

def parse_response(raw: str) -> dict:
    m = re.search(r"\[PREVIEW\](.*?)\[/PREVIEW\]", raw, re.DOTALL)
    if m:
        html = m.group(1).strip()
        text = re.sub(r"\[PREVIEW\].*?\[/PREVIEW\]", "", raw, flags=re.DOTALL).strip()
        return {"type": "preview", "reply": text or "Готово! Смотри превью →", "html": html}

    m = re.search(r"\[CODE\](.*?)\[/CODE\]", raw, re.DOTALL)
    if m:
        code = m.group(1).strip()
        text = re.sub(r"\[CODE\].*?\[/CODE\]", f"```\n{code}\n```", raw, flags=re.DOTALL).strip()
        return {"type": "code", "reply": text, "code": code}

    return {"type": "chat", "reply": raw}


# ── Handler ──────────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """Клан Волка — главный обработчик."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return {"statusCode": 400, "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
                "body": json.dumps({"error": "INVALID_JSON"})}

    mode         = body.get("mode", "beginner")
    history      = body.get("messages", [])
    user_msg     = body.get("message", "").strip()
    current_html = body.get("current_html", "")

    if not user_msg and history:
        user_msg = next((m.get("text","") for m in reversed(history) if m.get("role") == "user"), "")
    if not user_msg:
        return {"statusCode": 400, "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
                "body": json.dumps({"error": "EMPTY"})}

    intent = detect_intent(user_msg)
    print(f"[wolf] mode={mode} intent={intent} msg={user_msg[:70]}")

    base_prompt, max_tok = INTENT_CONFIG.get(intent, INTENT_CONFIG["chat"])
    system = base_prompt + MODE_SUFFIX.get(mode, "")

    api_messages = [{"role": "system", "content": system}]
    for m in (history or [])[-20:]:
        role = "user" if m.get("role") == "user" else "assistant"
        text = (m.get("text") or "").strip()
        if text:
            api_messages.append({"role": role, "content": text})

    # Для редактирования — вставляем текущий HTML в последний user-запрос
    if intent == "edit" and current_html:
        edit_content = f"Текущий код:\n```html\n{current_html[:12000]}\n```\n\nЗапрос на изменение: {user_msg}"
        if api_messages and api_messages[-1]["role"] == "user":
            api_messages[-1]["content"] = edit_content
        else:
            api_messages.append({"role": "user", "content": edit_content})

    raw = get_reply(api_messages, max_tok)

    if not raw:
        return {
            "statusCode": 200,
            "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
            "body": json.dumps({"type": "no_key", "reply": "no_key"}, ensure_ascii=False),
        }

    result = parse_response(raw)
    result["intent"] = intent
    return {
        "statusCode": 200,
        "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
        "body": json.dumps(result, ensure_ascii=False),
    }