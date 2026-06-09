"""
Stefani History — сохранение и загрузка истории разговоров.
GET /?session_id=xxx — загрузить историю
POST / — сохранить сообщения
"""
import json
import os
import psycopg2
import psycopg2.extras


CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def handler(event: dict, context) -> dict:
    """Загрузка и сохранение истории чата Stefani."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    method = event.get("httpMethod", "GET")

    if method == "GET":
        params = event.get("queryStringParameters") or {}
        session_id = params.get("session_id", "").strip()
        if not session_id:
            return {
                "statusCode": 400,
                "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
                "body": json.dumps({"error": "session_id required"}),
            }

        conn = get_conn()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            "SELECT role, text, emotion, created_at FROM stefani_messages "
            "WHERE session_id = %s ORDER BY created_at ASC LIMIT 100",
            (session_id,)
        )
        rows = cur.fetchall()
        cur.execute(
            "SELECT mood FROM stefani_sessions WHERE session_id = %s",
            (session_id,)
        )
        session = cur.fetchone()
        conn.close()

        messages = [
            {
                "role": r["role"],
                "text": r["text"],
                "emotion": r["emotion"],
                "time": r["created_at"].strftime("%H:%M") if r["created_at"] else "",
            }
            for r in rows
        ]
        return {
            "statusCode": 200,
            "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
            "body": json.dumps({
                "messages": messages,
                "mood": session["mood"] if session else "calm",
            }),
        }

    if method == "POST":
        try:
            body = json.loads(event.get("body") or "{}")
        except Exception:
            return {
                "statusCode": 400,
                "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
                "body": json.dumps({"error": "INVALID_JSON"}),
            }

        session_id = body.get("session_id", "").strip()
        messages = body.get("messages", [])
        mood = body.get("mood", "calm")

        if not session_id or not messages:
            return {
                "statusCode": 400,
                "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
                "body": json.dumps({"error": "session_id and messages required"}),
            }

        conn = get_conn()
        cur = conn.cursor()

        cur.execute(
            """INSERT INTO stefani_sessions (session_id, mood, message_count, updated_at)
               VALUES (%s, %s, %s, NOW())
               ON CONFLICT (session_id) DO UPDATE
               SET mood = EXCLUDED.mood,
                   message_count = EXCLUDED.message_count,
                   updated_at = NOW()""",
            (session_id, mood, len(messages))
        )

        cur.execute(
            "SELECT COUNT(*) FROM stefani_messages WHERE session_id = %s",
            (session_id,)
        )
        existing_count = cur.fetchone()[0]

        new_messages = messages[existing_count:]
        for msg in new_messages:
            cur.execute(
                "INSERT INTO stefani_messages (session_id, role, text, emotion) VALUES (%s, %s, %s, %s)",
                (session_id, msg.get("role", "user"), msg.get("text", ""), msg.get("emotion", "neutral"))
            )

        conn.commit()
        conn.close()

        return {
            "statusCode": 200,
            "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
            "body": json.dumps({"saved": len(new_messages)}),
        }

    return {
        "statusCode": 405,
        "headers": {**CORS_HEADERS, "Content-Type": "application/json"},
        "body": json.dumps({"error": "Method not allowed"}),
    }
