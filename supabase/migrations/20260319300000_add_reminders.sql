CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  tier INT NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 3),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'snoozed')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  snooze_token TEXT,
  ai_subject TEXT,
  ai_body TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_reminders_due ON reminders(scheduled_for, status) WHERE status = 'pending';
CREATE INDEX idx_reminders_interview ON reminders(interview_id);
CREATE INDEX idx_reminders_snooze ON reminders(snooze_token) WHERE snooze_token IS NOT NULL;

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON reminders
  FOR ALL USING (true) WITH CHECK (true);
