CREATE TABLE IF NOT EXISTS wolf_projects (
  id          SERIAL PRIMARY KEY,
  session_id  TEXT NOT NULL,
  title       TEXT NOT NULL DEFAULT 'Без названия',
  description TEXT,
  html        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wolf_projects_session ON wolf_projects(session_id);
CREATE INDEX IF NOT EXISTS idx_wolf_projects_created ON wolf_projects(created_at DESC);
