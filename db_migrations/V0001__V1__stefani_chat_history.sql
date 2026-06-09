CREATE TABLE IF NOT EXISTS stefani_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  mood TEXT DEFAULT 'calm',
  message_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stefani_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  emotion TEXT DEFAULT 'neutral',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stefani_messages_session ON stefani_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stefani_sessions_updated ON stefani_sessions(updated_at DESC);
