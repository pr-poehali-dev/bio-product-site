"""
Клан Волка — полный бэкенд инструмента создания сайтов.
Действия: generate (создать сайт), edit (доработать), chat (вопрос),
          save (сохранить в БД), projects (список), get (получить), delete (удалить).
"""
import json
import os
import re
import urllib.request
import urllib.error
import psycopg2
import psycopg2.extras

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
}
JSON = {"Content-Type": "application/json"}

# ── БД ───────────────────────────────────────────────────────────────────────

def db():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def resp(body: dict, code: int = 200) -> dict:
    return {"statusCode": code, "headers": {**CORS, **JSON}, "body": json.dumps(body, ensure_ascii=False, default=str)}

# ── Промпты ──────────────────────────────────────────────────────────────────

GENERATE_PROMPT = """Ты — профессиональный веб-разработчик и дизайнер. Создаёшь готовые сайты по описанию.

ПРАВИЛО №1: НИКОГДА не задавай вопросов. Получил описание — сразу делаешь. Придумай детали сам.
ПРАВИЛО №2: Возвращай ТОЛЬКО JSON, без лишнего текста вокруг:
{"title": "Название сайта", "description": "Одна строка о чём сайт", "html": "<!DOCTYPE html>..."}

ТРЕБОВАНИЯ К HTML:
- Полный HTML5 файл (<!DOCTYPE html> до </html>)
- CSS в <style>: современный дизайн, красивые цвета, градиенты, тени, анимации hover
- JS в <script>: рабочая интерактивность
- Google Fonts через @import — единственный внешний ресурс
- Flexbox/Grid, адаптивный под мобиль
- Реальный текст под тему — НИКАКОГО Lorem ipsum
- Минимум 3-4 секции с контентом
- Профессиональный результат"""

EDIT_PROMPT = """Ты — веб-разработчик. Дорабатываешь существующий сайт по запросу.

ПРАВИЛО: Получил код + запрос — сразу вносишь изменения. Без вопросов.
Возвращай ТОЛЬКО JSON:
{"title": "Название", "description": "Описание", "html": "<!DOCTYPE html>...полный обновлённый код..."}

Возвращай ПОЛНЫЙ файл целиком, не только изменения."""

CHAT_PROMPT = """Ты — Волк, помощник платформы «Клан Волка» для создания сайтов.
Отвечай коротко и по делу. Если хотят создать сайт — предложи описать идею.
Отвечай на русском."""

# ── ИИ провайдеры ────────────────────────────────────────────────────────────

def call_groq(messages: list, max_tokens: int = 8000) -> str | None:
    key = os.environ.get("GROQ_API_KEY", "").strip()
    if not key:
        return None
    for model in ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama3-70b-8192"]:
        try:
            payload = json.dumps({"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": 0.7}).encode()
            req = urllib.request.Request(
                "https://api.groq.com/openai/v1/chat/completions",
                data=payload,
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=55) as r:
                data = json.loads(r.read())
                text = data["choices"][0]["message"]["content"]
                if text and len(text.strip()) > 20:
                    print(f"[wolf] ✓ groq/{model} len={len(text)}")
                    return text.strip()
        except urllib.error.HTTPError as e:
            print(f"[wolf] groq/{model} HTTP {e.code}")
        except Exception as e:
            print(f"[wolf] groq/{model} exc: {e}")
    return None


def call_openrouter(messages: list, max_tokens: int = 8000) -> str | None:
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        return None
    models = [
        "nousresearch/hermes-3-llama-3.1-405b:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "meta-llama/llama-3.1-8b-instruct:free",
        "google/gemma-2-9b-it:free",
        "qwen/qwen-2-7b-instruct:free",
    ]
    for model in models:
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
                data = json.loads(r.read())
                if data.get("error"):
                    print(f"[wolf] or/{model} err: {data['error'].get('message','')[:60]}")
                    continue
                choices = data.get("choices") or []
                if not choices:
                    continue
                text = choices[0].get("message", {}).get("content", "")
                if text and len(text.strip()) > 20:
                    print(f"[wolf] ✓ or/{model} len={len(text)}")
                    return text.strip()
        except urllib.error.HTTPError as e:
            print(f"[wolf] or/{model} HTTP {e.code}")
        except Exception as e:
            print(f"[wolf] or/{model} exc: {e}")
    return None


def ai(messages: list, max_tokens: int = 8000) -> str | None:
    return call_groq(messages, max_tokens) or call_openrouter(messages, max_tokens)


# ── Парсинг JSON из ответа ────────────────────────────────────────────────────

def extract_json(raw: str) -> dict | None:
    raw = raw.strip()
    # Убираем <think>...</think> (deepseek r1)
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
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


# ── Действия ─────────────────────────────────────────────────────────────────

def action_generate(body: dict) -> dict:
    prompt = body.get("prompt", "").strip()
    if not prompt:
        return resp({"error": "Пустой запрос"}, 400)

    messages = [
        {"role": "system", "content": GENERATE_PROMPT},
        {"role": "user",   "content": f"Создай сайт: {prompt}"},
    ]
    raw = ai(messages, 8000)
    if not raw:
        return resp({"error": "no_key"}, 200)

    data = extract_json(raw)
    if not data or not data.get("html"):
        # Попробуем вытащить HTML напрямую
        if "<!DOCTYPE" in raw:
            start = raw.find("<!DOCTYPE")
            return resp({"title": "Сайт", "description": prompt, "html": raw[start:]})
        return resp({"error": "Не удалось сгенерировать. Попробуй ещё раз."}, 200)

    return resp({
        "title":       data.get("title", "Сайт"),
        "description": data.get("description", prompt),
        "html":        data["html"],
    })


def action_edit(body: dict) -> dict:
    current_html = body.get("html", "").strip()
    prompt       = body.get("prompt", "").strip()
    if not current_html or not prompt:
        return resp({"error": "Нужен html и prompt"}, 400)

    messages = [
        {"role": "system", "content": EDIT_PROMPT},
        {"role": "user",   "content": f"Текущий код:\n```html\n{current_html[:14000]}\n```\n\nЗапрос: {prompt}"},
    ]
    raw = ai(messages, 8000)
    if not raw:
        return resp({"error": "no_key"}, 200)

    data = extract_json(raw)
    if not data or not data.get("html"):
        if "<!DOCTYPE" in raw:
            start = raw.find("<!DOCTYPE")
            return resp({"title": "Сайт", "description": prompt, "html": raw[start:]})
        return resp({"error": "Не удалось обновить. Попробуй ещё раз."}, 200)

    return resp({
        "title":       data.get("title", "Сайт"),
        "description": data.get("description", prompt),
        "html":        data["html"],
    })


def action_chat(body: dict) -> dict:
    messages_in = body.get("messages", [])
    user_msg    = body.get("message", "").strip()
    if not user_msg:
        return resp({"error": "Пустое сообщение"}, 400)

    api_msgs = [{"role": "system", "content": CHAT_PROMPT}]
    for m in (messages_in or [])[-16:]:
        role = "user" if m.get("role") == "user" else "assistant"
        text = (m.get("text") or "").strip()
        if text:
            api_msgs.append({"role": role, "content": text})

    raw = ai(api_msgs, 1500)
    if not raw:
        return resp({"reply": "no_key"})
    return resp({"reply": raw})


def action_save(body: dict) -> dict:
    session_id  = body.get("session_id", "anon")
    title       = body.get("title", "Без названия")
    description = body.get("description", "")
    html        = body.get("html", "")
    project_id  = body.get("id")

    if not html:
        return resp({"error": "Нет HTML"}, 400)

    with db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if project_id:
                cur.execute(
                    "UPDATE wolf_projects SET title=%s, description=%s, html=%s, updated_at=NOW() WHERE id=%s AND session_id=%s RETURNING id",
                    (title, description, html, project_id, session_id)
                )
                row = cur.fetchone()
                if not row:
                    return resp({"error": "Проект не найден"}, 404)
                pid = row["id"]
            else:
                cur.execute(
                    "INSERT INTO wolf_projects (session_id, title, description, html) VALUES (%s,%s,%s,%s) RETURNING id",
                    (session_id, title, description, html)
                )
                pid = cur.fetchone()["id"]
        conn.commit()
    return resp({"id": pid, "saved": True})


def action_projects(body: dict) -> dict:
    session_id = body.get("session_id", "anon")
    with db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, title, description, created_at, updated_at FROM wolf_projects WHERE session_id=%s ORDER BY updated_at DESC LIMIT 50",
                (session_id,)
            )
            rows = cur.fetchall()
    return resp({"projects": [dict(r) for r in rows]})


def action_get(body: dict) -> dict:
    project_id = body.get("id")
    session_id = body.get("session_id", "anon")
    if not project_id:
        return resp({"error": "Нет id"}, 400)
    with db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT * FROM wolf_projects WHERE id=%s AND session_id=%s",
                (project_id, session_id)
            )
            row = cur.fetchone()
    if not row:
        return resp({"error": "Не найден"}, 404)
    return resp(dict(row))


def action_delete(body: dict) -> dict:
    project_id = body.get("id")
    session_id = body.get("session_id", "anon")
    if not project_id:
        return resp({"error": "Нет id"}, 400)
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM wolf_projects WHERE id=%s AND session_id=%s", (project_id, session_id))
        conn.commit()
    return resp({"deleted": True})


# ── Handler ───────────────────────────────────────────────────────────────────

ACTIONS = {
    "generate": action_generate,
    "edit":     action_edit,
    "chat":     action_chat,
    "save":     action_save,
    "projects": action_projects,
    "get":      action_get,
    "delete":   action_delete,
}

def handler(event: dict, context) -> dict:
    """Клан Волка — единый бэкенд: генерация, редактирование, хранение проектов."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return resp({"error": "INVALID_JSON"}, 400)

    action = body.get("action", "")
    print(f"[wolf] action={action}")

    fn = ACTIONS.get(action)
    if not fn:
        return resp({"error": f"Неизвестное действие: {action}"}, 400)

    return fn(body)
