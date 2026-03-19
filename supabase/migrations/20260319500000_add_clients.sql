-- Clients table (agency multi-client workspaces)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT DEFAULT NULL,
  primary_color TEXT DEFAULT NULL,
  welcome_message TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, name)
);

-- Add client_id to interviews (nullable for backward compat)
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) DEFAULT NULL;

-- Indexes
CREATE INDEX idx_clients_team_id ON clients(team_id);
CREATE INDEX idx_interviews_client_id ON interviews(client_id);

-- RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON clients
  FOR ALL USING (true) WITH CHECK (true);
