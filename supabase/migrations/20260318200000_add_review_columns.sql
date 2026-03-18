-- Add review-related columns to interviews table
ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS review_state JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS customer_email TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS customer_draft_content TEXT DEFAULT NULL;

-- Migrate existing completed interviews to review_pending
UPDATE interviews SET status = 'review_pending' WHERE status = 'completed';

-- Update status constraint to include new review statuses
ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_status_check;
ALTER TABLE interviews ADD CONSTRAINT interviews_status_check
  CHECK (status IN ('draft', 'in_progress', 'review_pending', 'review_in_progress', 'review_complete'));
