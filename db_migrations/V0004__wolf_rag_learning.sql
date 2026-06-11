-- Документы для обучения Волка
CREATE TABLE IF NOT EXISTS wolf_documents (
  id         SERIAL PRIMARY KEY,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  category   TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Факты извлечённые из разговоров (автообучение)
CREATE TABLE IF NOT EXISTS wolf_learned_facts (
  id         SERIAL PRIMARY KEY,
  session_id TEXT,
  fact       TEXT NOT NULL,
  confidence FLOAT DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wolf_docs_category ON wolf_documents(category);
CREATE INDEX IF NOT EXISTS idx_wolf_facts_session ON wolf_learned_facts(session_id);
