-- Teams table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Team members table
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_email TEXT,
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Add team_id to interviews (nullable for backward compat)
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) DEFAULT NULL;

-- Team invites table
CREATE TABLE team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('editor', 'viewer')),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup of user's teams
CREATE INDEX idx_team_members_user_id ON team_members(user_id);

-- Index for fast lookup of team's members
CREATE INDEX idx_team_members_team_id ON team_members(team_id);

-- Index for invite token lookups
CREATE INDEX idx_team_invites_token ON team_invites(token);

-- Index for interviews by team
CREATE INDEX idx_interviews_team_id ON interviews(team_id);

-- RLS policies
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- Teams: members can read their teams
CREATE POLICY "Team members can read team" ON teams
  FOR SELECT USING (
    id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- Teams: owner can update
CREATE POLICY "Team owner can update" ON teams
  FOR UPDATE USING (owner_id = auth.uid());

-- Teams: owner can delete
CREATE POLICY "Team owner can delete" ON teams
  FOR DELETE USING (owner_id = auth.uid());

-- Teams: any authenticated user can create
CREATE POLICY "Authenticated users can create teams" ON teams
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Team members: members can read their team's members
CREATE POLICY "Team members can read members" ON team_members
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM team_members AS tm WHERE tm.user_id = auth.uid())
  );

-- Team members: team owner or editor can insert
CREATE POLICY "Team owner can manage members" ON team_members
  FOR INSERT WITH CHECK (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
  );

-- Team members: team owner can delete members
CREATE POLICY "Team owner can remove members" ON team_members
  FOR DELETE USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    OR user_id = auth.uid()  -- members can remove themselves
  );

-- Team members: team owner can update roles
CREATE POLICY "Team owner can update roles" ON team_members
  FOR UPDATE USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
  );

-- Team invites: team owner can manage
CREATE POLICY "Team owner can manage invites" ON team_invites
  FOR ALL USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
  );

-- Team invites: anyone can read by token (for accepting)
CREATE POLICY "Anyone can read invite by token" ON team_invites
  FOR SELECT USING (true);

-- Allow service role full access (bypasses RLS)
-- This is handled by default in Supabase when using the service role key
