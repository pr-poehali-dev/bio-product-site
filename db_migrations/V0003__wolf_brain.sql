-- Память разговоров ИИ
CREATE TABLE IF NOT EXISTS wolf_memory (
  id         SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- База знаний (самообучение)
CREATE TABLE IF NOT EXISTS wolf_knowledge (
  id         SERIAL PRIMARY KEY,
  topic      TEXT NOT NULL,
  content    TEXT NOT NULL,
  source     TEXT DEFAULT 'conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_count INTEGER DEFAULT 0
);

-- Настройки ИИ (URL локального Ollama и др.)
CREATE TABLE IF NOT EXISTS wolf_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO wolf_settings (key, value) VALUES
  ('ollama_url', ''),
  ('model_name', 'llama3.2'),
  ('ai_name', 'Волк'),
  ('ai_personality', 'Ты — Волк, умный ИИ-помощник. Ты помогаешь создавать сайты и отвечаешь на вопросы. С каждым разговором ты узнаёшь больше о пользователе и становишься полезнее.')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_wolf_memory_session ON wolf_memory(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wolf_knowledge_topic ON wolf_knowledge(topic);
