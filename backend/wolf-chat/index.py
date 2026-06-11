"""
Клан Волка — полный бэкенд.
Провайдеры ИИ: локальный Ollama (ноутбук) → Groq → OpenRouter.
Возможности: память разговоров, база знаний, генерация сайтов, хранение проектов.
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
CT = {"Content-Type": "application/json"}

def db():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def resp(body: dict, code: int = 200) -> dict:
    return {"statusCode": code, "headers": {**CORS, **CT},
            "body": json.dumps(body, ensure_ascii=False, default=str)}

# ── Настройки ────────────────────────────────────────────────────────────────

def get_setting(key: str, default: str = "") -> str:
    try:
        with db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT value FROM wolf_settings WHERE key=%s", (key,))
                row = cur.fetchone()
                return row[0] if row else default
    except Exception:
        return default

def set_setting(key: str, value: str):
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("""INSERT INTO wolf_settings(key,value) VALUES(%s,%s)
                           ON CONFLICT(key) DO UPDATE SET value=%s, updated_at=NOW()""",
                        (key, value, value))
        conn.commit()

# ── Память разговоров ────────────────────────────────────────────────────────

def save_memory(session_id: str, role: str, content: str):
    try:
        with db() as conn:
            with conn.cursor() as cur:
                cur.execute("INSERT INTO wolf_memory(session_id,role,content) VALUES(%s,%s,%s)",
                            (session_id, role, content))
            conn.commit()
    except Exception as e:
        print(f"[wolf] memory err: {e}")

def get_memory(session_id: str, limit: int = 20) -> list:
    try:
        with db() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""SELECT role, content FROM wolf_memory
                               WHERE session_id=%s ORDER BY created_at DESC LIMIT %s""",
                            (session_id, limit))
                rows = cur.fetchall()
                return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]
    except Exception:
        return []

def get_knowledge(hint: str = "", limit: int = 6) -> list:
    try:
        with db() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                if hint:
                    cur.execute("""SELECT topic, content FROM wolf_knowledge
                                   WHERE topic ILIKE %s OR content ILIKE %s
                                   ORDER BY used_count DESC, created_at DESC LIMIT %s""",
                                (f"%{hint}%", f"%{hint}%", limit))
                else:
                    cur.execute("SELECT topic,content FROM wolf_knowledge ORDER BY used_count DESC LIMIT %s", (limit,))
                return [dict(r) for r in cur.fetchall()]
    except Exception:
        return []


def auto_learn_from_conversation(session_id: str, user_msg: str, ai_reply: str):
    """Автоматически извлекает факты из разговора и сохраняет в базу знаний."""
    try:
        # Простая эвристика — ищем паттерны с личной информацией
        facts_to_save = []

        msg_lower = user_msg.lower()

        # Имя пользователя
        import re as _re
        name_match = _re.search(r"меня зовут (\w+)|я (\w+),|моё имя (\w+)", msg_lower)
        if name_match:
            name = next(g for g in name_match.groups() if g)
            facts_to_save.append(("имя пользователя", f"Пользователя зовут {name.capitalize()}"))

        # Бизнес/проект
        biz_match = _re.search(r"(мой бизнес|моя компания|мой проект|мой магазин|я продаю|я занимаюсь)[:\s]+(.{10,80})", msg_lower)
        if biz_match:
            facts_to_save.append(("бизнес пользователя", biz_match.group(0)[:100]))

        # Технический уровень
        if any(w in msg_lower for w in ["я новичок","не знаю программирование","никогда не программировал"]):
            facts_to_save.append(("уровень", "Пользователь — новичок в программировании"))
        elif any(w in msg_lower for w in ["я разработчик","я программист","работаю с react","знаю python"]):
            facts_to_save.append(("уровень", "Пользователь — опытный разработчик"))

        for topic, content in facts_to_save:
            # Проверяем что такого факта ещё нет
            with db() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT id FROM wolf_knowledge WHERE topic=%s AND session_id_ref=%s LIMIT 1",
                                (topic, session_id))
                    # Просто добавляем, дубли не страшны
                    cur.execute("INSERT INTO wolf_knowledge(topic,content,source) VALUES(%s,%s,%s)",
                                (topic, content, f"auto:{session_id[:8]}"))
                conn.commit()
    except Exception as e:
        print(f"[wolf] auto_learn err: {e}")

def add_knowledge(topic: str, content: str, source: str = "conversation"):
    try:
        with db() as conn:
            with conn.cursor() as cur:
                cur.execute("INSERT INTO wolf_knowledge(topic,content,source) VALUES(%s,%s,%s)",
                            (topic, content, source))
            conn.commit()
    except Exception as e:
        print(f"[wolf] knowledge err: {e}")

# ── ИИ провайдеры ────────────────────────────────────────────────────────────

def call_ollama(messages: list, model: str, url: str, max_tokens: int = 4000) -> str | None:
    if not url:
        return None
    try:
        payload = json.dumps({
            "model": model, "messages": messages, "stream": False,
            "options": {"num_predict": max_tokens, "temperature": 0.7}
        }).encode()
        req = urllib.request.Request(url.rstrip("/") + "/api/chat",
                                     data=payload, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=120) as r:
            text = json.loads(r.read()).get("message", {}).get("content", "")
            if text and len(text.strip()) > 2:
                print(f"[wolf] ✓ ollama/{model} len={len(text)}")
                return text.strip()
    except Exception as e:
        print(f"[wolf] ollama err: {e}")
    return None

def call_groq(messages: list, max_tokens: int = 6000) -> str | None:
    key = os.environ.get("GROQ_API_KEY", "").strip()
    if not key:
        return None
    for model in ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama3-70b-8192"]:
        try:
            payload = json.dumps({"model": model, "messages": messages,
                                  "max_tokens": max_tokens, "temperature": 0.7}).encode()
            req = urllib.request.Request("https://api.groq.com/openai/v1/chat/completions",
                                         data=payload,
                                         headers={"Content-Type": "application/json",
                                                  "Authorization": f"Bearer {key}"},
                                         method="POST")
            with urllib.request.urlopen(req, timeout=55) as r:
                text = json.loads(r.read())["choices"][0]["message"]["content"]
                if text and len(text.strip()) > 5:
                    print(f"[wolf] ✓ groq/{model} len={len(text)}")
                    return text.strip()
        except urllib.error.HTTPError as e:
            print(f"[wolf] groq/{model} HTTP {e.code}")
        except Exception as e:
            print(f"[wolf] groq/{model} exc: {e}")
    return None

def call_openrouter(messages: list, max_tokens: int = 6000) -> str | None:
    key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if not key:
        return None
    for model in ["nousresearch/hermes-3-llama-3.1-405b:free",
                  "meta-llama/llama-3.3-70b-instruct:free",
                  "meta-llama/llama-3.1-8b-instruct:free"]:
        try:
            payload = json.dumps({"model": model, "messages": messages,
                                  "max_tokens": max_tokens, "temperature": 0.7}).encode()
            req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions",
                                         data=payload,
                                         headers={"Content-Type": "application/json",
                                                  "Authorization": f"Bearer {key}",
                                                  "HTTP-Referer": "https://poehali.dev"},
                                         method="POST")
            with urllib.request.urlopen(req, timeout=55) as r:
                data = json.loads(r.read())
                if data.get("error"):
                    continue
                choices = data.get("choices") or []
                if not choices:
                    continue
                text = choices[0].get("message", {}).get("content", "")
                if text and len(text.strip()) > 5:
                    print(f"[wolf] ✓ or/{model} len={len(text)}")
                    return text.strip()
        except urllib.error.HTTPError as e:
            print(f"[wolf] or/{model} HTTP {e.code}")
        except Exception as e:
            print(f"[wolf] or/{model} exc: {e}")
    return None

def ai(messages: list, max_tokens: int = 4000) -> tuple[str | None, str]:
    ollama_url = get_setting("ollama_url")
    model      = get_setting("model_name", "llama3.2")
    if ollama_url and model:
        r = call_ollama(messages, model, ollama_url, max_tokens)
        if r: return r, "ollama"
    r = call_groq(messages, max_tokens)
    if r: return r, "groq"
    r = call_openrouter(messages, max_tokens)
    if r: return r, "openrouter"
    return None, "none"

# ── Промпты ──────────────────────────────────────────────────────────────────

def build_chat_system(personality: str, ai_name: str, knowledge: list) -> str:
    k_block = ""
    if knowledge:
        k_block = "\n\nИЗ ТВОЕЙ БАЗЫ ЗНАНИЙ:\n" + "\n".join(f"- {k['topic']}: {k['content'][:150]}" for k in knowledge)
    return f"""{personality}

Твоё имя: {ai_name}{k_block}

ПРАВИЛА:
- Отвечай на русском
- Если создаёшь сайт — полный HTML между [PREVIEW]...[/PREVIEW]
- Если пишешь код — между [CODE]...[/CODE]
- Запоминай что рассказывает пользователь"""

BUILD_PROMPT = """Ты — профессиональный веб-разработчик. Создаёшь готовые сайты.
Получил описание — сразу делаешь. Никаких вопросов.
Верни JSON: {"title":"...","description":"...","html":"<!DOCTYPE html>..."}
HTML: полный файл, CSS в <style>, JS в <script>, Google Fonts, адаптивный, реальный контент."""

EDIT_PROMPT = """Ты — веб-разработчик. Дорабатываешь сайт по запросу. Без вопросов.
Верни JSON: {"title":"...","description":"...","html":"...полный код..."}"""

def extract_json(raw: str) -> dict | None:
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
    for attempt in [raw, raw[raw.find("{"):raw.rfind("}")+1] if "{" in raw else ""]:
        try:
            return json.loads(attempt)
        except Exception:
            pass
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    return None

# ── Действия ─────────────────────────────────────────────────────────────────

def action_chat(body: dict) -> dict:
    session_id = body.get("session_id", "anon")
    user_msg   = body.get("message", "").strip()
    if not user_msg:
        return resp({"error": "Пустое сообщение"}, 400)

    personality = get_setting("ai_personality", "Ты — Волк, умный помощник платформы Клан Волка.")
    ai_name     = get_setting("ai_name", "Волк")
    memory      = get_memory(session_id, 20)
    knowledge   = get_knowledge(user_msg[:60], 3)

    system   = build_chat_system(personality, ai_name, knowledge)
    messages = [{"role": "system", "content": system}] + memory + [{"role": "user", "content": user_msg}]

    raw, source = ai(messages, 2000)
    if not raw:
        return resp({"reply": "no_key", "source": "none"})

    save_memory(session_id, "user",      user_msg)
    save_memory(session_id, "assistant", raw)

    # Автообучение — извлекаем факты из разговора
    auto_learn_from_conversation(session_id, user_msg, raw)

    pm = re.search(r"\[PREVIEW\](.*?)\[/PREVIEW\]", raw, re.DOTALL)
    if pm:
        html = pm.group(1).strip()
        text = re.sub(r"\[PREVIEW\].*?\[/PREVIEW\]", "Готово! Смотри превью →", raw, flags=re.DOTALL).strip()
        return resp({"reply": text, "type": "preview", "html": html, "source": source})

    cm = re.search(r"\[CODE\](.*?)\[/CODE\]", raw, re.DOTALL)
    if cm:
        code = cm.group(1).strip()
        text = re.sub(r"\[CODE\].*?\[/CODE\]", f"```\n{code}\n```", raw, flags=re.DOTALL).strip()
        return resp({"reply": text, "type": "code", "code": code, "source": source})

    return resp({"reply": raw, "type": "chat", "source": source})

def action_generate(body: dict) -> dict:
    prompt = body.get("prompt", "").strip()
    messages = [{"role": "system", "content": BUILD_PROMPT},
                {"role": "user",   "content": f"Создай сайт: {prompt}"}]
    raw, source = ai(messages, 8000)
    if not raw:
        return resp({"error": "no_key"})
    data = extract_json(raw)
    if data and data.get("html"):
        return resp({"title": data.get("title","Сайт"), "description": data.get("description",""),
                     "html": data["html"], "source": source})
    if "<!DOCTYPE" in raw:
        return resp({"title": "Сайт", "description": prompt, "html": raw[raw.find("<!DOCTYPE"):], "source": source})
    return resp({"error": "Не удалось сгенерировать. Попробуй ещё раз."})

def action_edit(body: dict) -> dict:
    prompt  = body.get("prompt", "").strip()
    current = body.get("html",   "").strip()
    messages = [{"role": "system", "content": EDIT_PROMPT},
                {"role": "user",   "content": f"Код:\n```html\n{current[:12000]}\n```\n\nЗапрос: {prompt}"}]
    raw, source = ai(messages, 8000)
    if not raw:
        return resp({"error": "no_key"})
    data = extract_json(raw)
    if data and data.get("html"):
        return resp({"title": data.get("title","Сайт"), "description": data.get("description",""),
                     "html": data["html"], "source": source})
    if "<!DOCTYPE" in raw:
        return resp({"title": "Сайт", "description": prompt, "html": raw[raw.find("<!DOCTYPE"):], "source": source})
    return resp({"error": "Не удалось обновить."})

def action_save(body: dict) -> dict:
    sid = body.get("session_id","anon"); title = body.get("title","Без названия")
    desc = body.get("description","");   html  = body.get("html","");  pid = body.get("id")
    if not html: return resp({"error": "Нет HTML"}, 400)
    with db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if pid:
                cur.execute("UPDATE wolf_projects SET title=%s,description=%s,html=%s,updated_at=NOW() WHERE id=%s AND session_id=%s RETURNING id",
                            (title,desc,html,pid,sid))
                row = cur.fetchone(); new_pid = row["id"] if row else pid
            else:
                cur.execute("INSERT INTO wolf_projects(session_id,title,description,html) VALUES(%s,%s,%s,%s) RETURNING id",
                            (sid,title,desc,html))
                new_pid = cur.fetchone()["id"]
        conn.commit()
    return resp({"id": new_pid, "saved": True})

def action_projects(body: dict) -> dict:
    sid = body.get("session_id","anon")
    with db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id,title,description,created_at,updated_at FROM wolf_projects WHERE session_id=%s ORDER BY updated_at DESC LIMIT 50", (sid,))
            rows = cur.fetchall()
    return resp({"projects": [dict(r) for r in rows]})

def action_get_project(body: dict) -> dict:
    pid = body.get("id"); sid = body.get("session_id","anon")
    if not pid: return resp({"error":"Нет id"},400)
    with db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM wolf_projects WHERE id=%s AND session_id=%s",(pid,sid))
            row = cur.fetchone()
    return resp(dict(row)) if row else resp({"error":"Не найден"},404)

def action_delete(body: dict) -> dict:
    pid = body.get("id"); sid = body.get("session_id","anon")
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM wolf_projects WHERE id=%s AND session_id=%s",(pid,sid))
        conn.commit()
    return resp({"deleted": True})

def action_settings(body: dict) -> dict:
    if body.get("update"):
        allowed = ("ollama_url","model_name","ai_name","ai_personality")
        for k, v in body["update"].items():
            if k in allowed: set_setting(k, str(v))
        return resp({"saved": True})
    with db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT key,value FROM wolf_settings")
            rows = cur.fetchall()
    return resp({r["key"]: r["value"] for r in rows})

def action_status(body: dict) -> dict:
    ollama_url = get_setting("ollama_url")
    base = {"has_groq": bool(os.environ.get("GROQ_API_KEY")),
            "has_openrouter": bool(os.environ.get("OPENROUTER_API_KEY")),
            "ollama_url": ollama_url}
    if not ollama_url:
        return resp({**base, "ollama": False})
    try:
        req = urllib.request.Request(ollama_url.rstrip("/") + "/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.loads(r.read())
            models = [m["name"] for m in data.get("models", [])]
            return resp({**base, "ollama": True, "models": models})
    except Exception as e:
        return resp({**base, "ollama": False, "error": str(e)})

def action_memory(body: dict) -> dict:
    sid = body.get("session_id","anon"); limit = int(body.get("limit",50))
    mem = get_memory(sid, limit)
    return resp({"memory": mem, "count": len(mem)})

def action_learn(body: dict) -> dict:
    topic = body.get("topic","").strip(); content = body.get("content","").strip()
    if not topic or not content: return resp({"error":"Нужны topic и content"},400)
    add_knowledge(topic, content, body.get("source","manual"))
    return resp({"saved": True})

def action_knowledge(body: dict) -> dict:
    with db() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id,topic,content,source,used_count,created_at FROM wolf_knowledge ORDER BY used_count DESC, created_at DESC LIMIT 100")
            rows = cur.fetchall()
    return resp({"knowledge": [dict(r) for r in rows]})

def action_clear_memory(body: dict) -> dict:
    sid = body.get("session_id","anon")
    with db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM wolf_memory WHERE session_id=%s",(sid,))
        conn.commit()
    return resp({"cleared": True})

# ── Handler ───────────────────────────────────────────────────────────────────

ACTIONS = {
    "chat": action_chat, "generate": action_generate, "edit": action_edit,
    "save": action_save, "projects": action_projects, "get": action_get_project,
    "delete": action_delete, "settings": action_settings, "status": action_status,
    "memory": action_memory, "learn": action_learn, "knowledge": action_knowledge,
    "clear_memory": action_clear_memory,
}

def handler(event: dict, context) -> dict:
    """Клан Волка — бэкенд с локальным ИИ, памятью и базой знаний."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return resp({"error": "INVALID_JSON"}, 400)
    action = body.get("action","")
    print(f"[wolf] action={action}")
    fn = ACTIONS.get(action)
    if not fn:
        return resp({"error": f"Неизвестное действие: {action}"}, 400)
    return fn(body)