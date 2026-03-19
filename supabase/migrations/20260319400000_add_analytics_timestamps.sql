-- Analytics timestamp columns for funnel tracking
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS review_started_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS review_completed_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_interviews_created_at ON interviews(created_at);

-- Backfill started_at from first message per interview
UPDATE interviews i SET started_at = (
  SELECT MIN(m.created_at) FROM messages m WHERE m.interview_id = i.id AND m.role = 'assistant'
) WHERE i.status != 'draft' AND i.started_at IS NULL;

-- Backfill completed_at from last assistant message for completed interviews
UPDATE interviews i SET completed_at = (
  SELECT MAX(m.created_at) FROM messages m WHERE m.interview_id = i.id AND m.role = 'assistant'
) WHERE i.status IN ('review_pending', 'review_in_progress', 'review_complete') AND i.completed_at IS NULL;

-- Backfill review timestamps from JSONB
UPDATE interviews SET review_started_at = (review_state->>'started_at')::timestamptz
WHERE review_state->>'started_at' IS NOT NULL AND review_started_at IS NULL;

UPDATE interviews SET review_completed_at = (review_state->>'completed_at')::timestamptz
WHERE review_state->>'completed_at' IS NOT NULL AND review_completed_at IS NULL;
