ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS interview_tone TEXT DEFAULT 'conversational',
  ADD COLUMN IF NOT EXISTS interview_focus TEXT DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS question_limit INTEGER DEFAULT 15;
