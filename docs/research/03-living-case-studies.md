# 03 — Living Case Studies (Auto-Refresh)

Technical plan for keeping case studies fresh through automated micro-interviews,
content versioning, and trust signals.

**Problem:** Case studies go stale. A "30% improvement" metric from 6 months ago
may now be 80% — or it may have regressed. Stale case studies erode buyer trust
and become a sales liability rather than an asset.

**Solution:** After a configurable cadence (default 6 months), auto-send the
customer a 3-5 minute micro-interview pre-filled with their previous answers.
AI merges new data into the existing narrative. Version history tracks every
refresh. A "Last verified: 2 weeks ago" badge embeds on external sites.

---

## 1. Scheduling & Triggers

### 1.1 Architecture Decision: Inngest over Vercel Cron / QStash

| Criterion | Vercel Cron | QStash | Inngest |
|-----------|------------|--------|---------|
| Retry on failure | None (manual) | 3 retries, backoff | Per-step retries, configurable |
| Concurrency control | None | None | Built-in, prevents overlap |
| Durable steps | No | No | Yes — checkpoint after each step |
| Scheduling granularity | Hobby: 1x/day; Pro: unlimited | CRON + delay up to 90d | CRON + event-driven + sleep |
| Observability | Vercel logs only | Upstash dashboard | Full execution history, alerting |
| Cost | Free (included in Vercel plan) | $1/100K requests | Free tier: 25K runs/mo |
| Existing usage in Quotd | Yes (`/api/cron/reminders`, `/api/cron/webhooks`) | No | No |

**Recommendation: Inngest.**

The refresh workflow is a multi-step durable pipeline (send email -> wait for
response -> extract data -> merge content -> update DB -> notify creator). If
step 3 fails after email is sent, Inngest retries only step 3 without
re-sending the email. Vercel Cron cannot express this; QStash is simpler but
lacks step-level durability.

The existing Vercel Cron routes (`/api/cron/reminders`, `/api/cron/webhooks`)
remain untouched — they are simple fetch-and-process loops that work fine as
cron. The refresh pipeline is fundamentally different: it is long-running
(days between steps) and multi-phase.

**Migration path:** Add Inngest alongside existing cron. No need to migrate
reminders or webhook retries. Inngest functions deploy as standard Next.js API
routes (`/api/inngest`), so zero infrastructure change on Vercel.

### 1.2 Refresh Cadence Configuration

Add a `refresh_cadence` column to the `interviews` table:

```sql
ALTER TABLE interviews
  ADD COLUMN refresh_cadence TEXT DEFAULT 'semi_annual'
    CHECK (refresh_cadence IN ('quarterly', 'semi_annual', 'annual', 'custom', 'disabled')),
  ADD COLUMN refresh_interval_days INTEGER DEFAULT 180,
  ADD COLUMN next_refresh_at TIMESTAMPTZ,
  ADD COLUMN last_refreshed_at TIMESTAMPTZ,
  ADD COLUMN refresh_count INTEGER DEFAULT 0;
```

Cadence options:
- `quarterly` — 90 days
- `semi_annual` — 180 days (default)
- `annual` — 365 days
- `custom` — uses `refresh_interval_days`
- `disabled` — no auto-refresh

**When is `next_refresh_at` set?** On `review_complete`, compute
`completed_at + interval_days` and write to `next_refresh_at`.
Each successful refresh recomputes the next date from the refresh timestamp.

### 1.3 Smart Timing

The daily Inngest cron (runs once at 14:00 UTC, matching existing reminder cron
pattern) queries for interviews where `next_refresh_at <= NOW()`:

```typescript
// src/inngest/functions/refresh-scan.ts
export const refreshScan = inngest.createFunction(
  { id: "refresh-scan", name: "Scan for due refreshes" },
  { cron: "0 14 * * *" },
  async ({ step }) => {
    const interviews = await step.run("fetch-due", async () => {
      const supabase = await createServiceClient();
      const { data } = await supabase
        .from("interviews")
        .select("id, customer_email, customer_company, share_token, user_id")
        .eq("status", "review_complete")
        .neq("refresh_cadence", "disabled")
        .lte("next_refresh_at", new Date().toISOString())
        .limit(50);
      return data ?? [];
    });

    // Fan out: send one event per interview
    for (const interview of interviews) {
      await step.sendEvent("refresh-interview", {
        name: "refresh/interview.due",
        data: { interviewId: interview.id },
      });
    }
  }
);
```

**Avoiding spam and bad timing:**

1. **Timezone-aware send window.** Store customer timezone (inferred from
   browser at interview time, or from profile). Only dispatch the refresh
   email if current time is within 9 AM - 5 PM in their timezone. If outside
   window, Inngest `step.sleep()` until next valid window.

2. **Holiday avoidance.** Maintain a small holidays list (US federal + common
   international). If `next_refresh_at` falls on a holiday or weekend, bump
   to the next business day.

3. **Snooze support.** Reuse existing snooze infrastructure
   (`src/lib/reminders/snooze.ts`). Customer can snooze the refresh email by
   7, 14, or 30 days. The snooze handler updates `next_refresh_at`.

4. **Backoff on no-response.** If the customer does not respond within 14
   days, send one follow-up (reuse the tier-based reminder pattern). If still
   no response after 28 days, mark `refresh_status = 'skipped'` and schedule
   the next refresh at the regular interval. Never send more than 2 emails
   per refresh cycle.

### 1.4 Event-Driven Triggers (Beyond Cron)

In addition to time-based refresh, support manual triggers:

- **Creator-initiated:** Dashboard button "Request Updated Numbers" sends the
  micro-interview immediately.
- **Webhook-triggered:** External CRM or CSM tool calls
  `POST /api/v1/interviews/:id/refresh` to trigger a refresh (useful for
  enterprise integrations where CS teams manage renewal cycles).
- **Milestone-based:** If the creator updates the interview's
  `extraction_state` with a note like "Customer renewed for 2 more years",
  auto-schedule a refresh 30 days out to capture fresh impact data.

---

## 2. Micro-Interview UX

### 2.1 Design Principle: Confirm or Update, Not Re-Interview

The refresh micro-interview is fundamentally different from the original
interview. The customer has already given us their story. We need to:

1. Show them what they said before
2. Ask if it has changed
3. Capture any new numbers

This is a **"confirm or update" pattern**, not a blank-slate interview.

### 2.2 Flow Architecture

```
Email (branded, personal)
  -> /i/{token}/refresh (new page, reuses token)
    -> 3-5 pre-filled cards, one per data point
    -> Customer taps "Still accurate" or edits
    -> Optional: one open-ended "Anything new?" at the end
    -> Submit -> AI merge -> Creator notified
```

**New route:** `src/app/i/[token]/refresh/page.tsx`

This page is separate from the original interview chat (`/i/[token]/q`). The
chat UX is wrong for quick updates — customers do not want another 15-question
conversation. The refresh page is a card-based form.

### 2.3 Card-Based UI

Each card shows one extractable data point pre-filled from `extraction_state`:

```
+------------------------------------------+
| Revenue Impact                           |
|                                          |
| Last time you said:                      |
| "30% increase in quarterly revenue"      |
|                                          |
| [Still accurate]  [Update ->]            |
|                                          |
| (if Update tapped:)                      |
| +--------------------------------------+ |
| | Now it's actually 45% because we...  | |
| +--------------------------------------+ |
| [  Voice input  ]  [Save]               |
+------------------------------------------+
```

Cards are generated from `extraction_state`:

1. **Metric cards** — one per metric in `extraction_state.metrics[]`. Shows
   `name`, `delta` or `after` value, and `timeframe`. "Still accurate" sets
   `confirmed_at` on the metric. "Update" opens an inline text/voice input.

2. **Quote cards** — shows top 2 quotes from `extraction_state.quotes[]`.
   Customer can confirm, edit, or replace.

3. **Facts cards** — one each for challenge, solution, impact from
   `extraction_state.facts`. Shows the current text. Customer confirms or
   updates.

4. **Open-ended card** — final card: "Anything else to add? New milestones,
   team growth, awards?" with a text/voice input. This is the only
   free-form question.

**Target:** 3-5 cards total. Metrics and facts are the priority. Quotes only
if there are fewer than 3 metrics.

### 2.4 Voice vs. Text

Reuse the existing `VoiceFirstInput` component
(`src/components/chat/voice-first-input.tsx`) for the update fields. The
component already handles Deepgram transcription and audio upload. On mobile,
voice is the default input mode (tap-to-record). On desktop, text input is
primary with a mic icon.

The refresh page must be fully mobile-optimized:
- Cards are full-width, stacked vertically
- Large tap targets for "Still accurate" (min 48px)
- Sticky progress bar at top showing "2 of 5 reviewed"
- No scroll-jacking, no modals

### 2.5 API Endpoint

```
POST /api/interview/{token}/refresh/submit
Body: {
  metrics: [
    { name: "Revenue Impact", confirmed: true },
    { name: "Time Saved", confirmed: false, updated_value: "Now saving 8 hours/week instead of 4" }
  ],
  quotes: [
    { text: "...", confirmed: true }
  ],
  facts: {
    challenge: { confirmed: true },
    impact: { confirmed: false, updated_value: "..." }
  },
  open_ended: "We also won the industry award for..."
}
```

This endpoint:
1. Runs AI extraction on any updated/new text (reuses `extractFromAnswer`)
2. Merges into existing `extraction_state` (see section 3.3)
3. Triggers AI content merge (see section 3.3)
4. Creates a new version snapshot (see section 3.1)
5. Updates `last_refreshed_at`, increments `refresh_count`
6. Computes and sets `next_refresh_at`
7. Dispatches `refresh.completed` webhook event

---

## 3. Content Versioning & Diffing

### 3.1 Storage Model: Separate `case_study_versions` Table

A JSONB array on the `interviews` table would work for < 5 versions but
becomes unwieldy for querying, indexing, and size. A separate table is the
right call — it lets us index by `created_at`, query specific versions, and
keeps the `interviews` row lean.

```sql
CREATE TABLE case_study_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('initial', 'refresh', 'manual_edit', 'ai_regenerate')),

  -- Content snapshots
  draft_content TEXT NOT NULL,
  extraction_state JSONB NOT NULL,

  -- Diff metadata
  changes_summary TEXT,          -- AI-generated human-readable summary
  metrics_changed JSONB,         -- Array of {metric_name, old_value, new_value}
  quotes_changed JSONB,          -- Array of {action: 'added'|'removed'|'updated', text}
  facts_changed JSONB,           -- {field: {old, new}}

  -- Provenance
  created_by TEXT NOT NULL CHECK (created_by IN ('customer', 'creator', 'system')),
  refresh_response JSONB,        -- Raw micro-interview submission (null for initial)

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_versions_interview_id ON case_study_versions(interview_id);
CREATE INDEX idx_versions_created_at ON case_study_versions(created_at);
CREATE UNIQUE INDEX idx_versions_unique ON case_study_versions(interview_id, version_number);
```

**Row Level Security:** Inherit from parent interview — if user can see the
interview, they can see its versions.

```sql
ALTER TABLE case_study_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions of own interviews"
  ON case_study_versions FOR SELECT
  USING (
    interview_id IN (
      SELECT id FROM interviews WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage versions"
  ON case_study_versions FOR ALL USING (true);
```

### 3.2 Version Lifecycle

1. **Version 1 (initial):** Created when the first draft is generated
   (`submit-answer` endpoint, `should_end = true`). Trigger = `initial`.

2. **Version N+1 (refresh):** Created after a micro-interview submission is
   processed. Trigger = `refresh`. Contains the merged content and a diff
   summary.

3. **Version N+1 (manual_edit):** Created when the creator edits the draft
   in the dashboard. Trigger = `manual_edit`. Debounced — only snapshot after
   30 seconds of inactivity, not on every keystroke.

4. **Version N+1 (ai_regenerate):** Created when the creator clicks
   "Regenerate draft" in the dashboard. Trigger = `ai_regenerate`.

### 3.3 AI-Powered Content Merge

This is the core technical challenge. When a customer updates "30% revenue
increase" to "45% revenue increase", we do not want to regenerate the entire
case study. We want to surgically update the number in context.

**Approach: Section-level targeted merge.**

The existing `splitMarkdownIntoSections()` function
(`src/lib/review/sections.ts`) already decomposes drafts into H2 sections.
The merge operates at the section level:

```typescript
// src/lib/ai/merge.ts
export async function mergeRefreshIntoCase(
  currentDraft: string,
  currentExtraction: ExtractionState,
  refreshData: RefreshSubmission,
  newExtraction: ExtractionState
): Promise<{ mergedDraft: string; changesSummary: string }> {
  const sections = splitMarkdownIntoSections(currentDraft);
  const changedMetrics = findChangedMetrics(currentExtraction, newExtraction);
  const changedFacts = findChangedFacts(currentExtraction, newExtraction);

  // Only re-generate sections that contain changed data
  const sectionsToUpdate = identifyAffectedSections(
    sections, changedMetrics, changedFacts
  );

  for (const section of sectionsToUpdate) {
    section.content = await regenerateSection(
      section,
      currentExtraction,
      newExtraction,
      changedMetrics,
      changedFacts
    );
  }

  // Reconstruct the full document
  const mergedDraft = reassembleSections(sections);
  const changesSummary = await generateChangesSummary(
    changedMetrics, changedFacts
  );

  return { mergedDraft, changesSummary };
}
```

**New prompt** (`SECTION_MERGE_PROMPT`):

```
You are updating a single section of a case study with fresh data.

Current section:
{{current_section}}

Changes:
{{changes}}

Rules:
- Update ONLY the specific numbers/facts that changed
- Preserve the existing writing style, tone, and structure
- Do NOT rewrite sentences that are unaffected by the changes
- If a metric changed, update it in context (e.g., "30% improvement" -> "45% improvement")
- Add a brief note about growth trajectory if the number improved significantly
- Keep the section approximately the same length
- Output the updated section in Markdown
```

**Why section-level, not document-level?**

- Cheaper (fewer tokens — only changed sections go through AI)
- More predictable (unchanged sections are byte-identical)
- Preserves creator edits in unaffected sections
- Easier to diff and review

### 3.4 Diff Visualization

The dashboard interview detail page (`/dashboard/[id]`) gets a new
"Version History" tab showing:

1. **Timeline view** — vertical list of versions with timestamp, trigger
   type, and AI-generated summary ("Revenue metric updated from 30% to 45%.
   New quote added about team scaling.")

2. **Side-by-side diff** — for any two versions, show a split-pane diff
   with additions highlighted in green, removals in red. Use a client-side
   diff library (e.g., `diff` npm package) operating on the markdown text.

3. **Metric changelog** — a structured table showing each metric's value
   across all versions:

   ```
   | Metric          | v1 (Jan 2026) | v2 (Jul 2026) | v3 (Jan 2027) |
   |-----------------|---------------|---------------|----------------|
   | Revenue Impact  | +30%          | +45%          | +62%           |
   | Time Saved      | 4 hrs/week    | 8 hrs/week    | 8 hrs/week     |
   | Team Size       | 5 people      | 5 people      | 12 people      |
   ```

   This is the most powerful view for sales teams — it shows the
   **trajectory** of results over time, which is more compelling than any
   single snapshot.

---

## 4. Trust Signals & Freshness Badges

### 4.1 "Last Verified" Badge

A small, embeddable badge that shows when the case study data was last
confirmed by the customer.

**Badge states:**
- **Fresh** (< 90 days since last refresh): Green dot + "Verified [date]"
- **Current** (90-180 days): Yellow dot + "Verified [date]"
- **Stale** (> 180 days, or never refreshed): Gray dot + "Published [date]"

**Database:** The badge reads from `last_refreshed_at` (or `review_completed_at`
for v1 case studies that have never been refreshed).

### 4.2 Embeddable Widget

Two embedding options for external sites:

**Option A: Script tag (recommended)**

```html
<script
  src="https://app.quotd.com/widget/badge.js"
  data-interview-id="abc123"
  data-theme="light"
></script>
```

The script injects a small DOM element (not an iframe — avoids layout issues)
styled with shadow DOM for CSS isolation. It fetches badge data from a public
endpoint:

```
GET /api/v1/interviews/{id}/badge
Response: {
  status: "fresh" | "current" | "stale",
  verified_at: "2026-07-15T...",
  customer_company: "Acme Corp",
  product_name: "Quotd",
  version_count: 3,
  metric_highlights: ["62% revenue increase", "8 hrs/week saved"]
}
```

**Option B: Image badge (for sites that block scripts)**

```
![Verified by Quotd](https://app.quotd.com/api/v1/interviews/{id}/badge.svg)
```

Returns a dynamically generated SVG with the verification date. Cached with
`Cache-Control: public, max-age=3600` (1 hour) to avoid hot-linking abuse.

Both options include a link back to the full case study on Quotd, driving
traffic and reinforcing trust.

### 4.3 In-Dashboard Badge

The dashboard interview detail page shows the badge inline:

```tsx
<FreshnessBadge
  lastRefreshedAt={interview.last_refreshed_at}
  reviewCompletedAt={interview.review_completed_at}
  refreshCount={interview.refresh_count}
/>
```

Clicking the badge expands to show the version timeline (section 3.4).

### 4.4 SEO Implications

Regularly updated case study content improves search performance:

1. **Freshness signal.** Google's freshness algorithm favors content that is
   periodically updated with substantive changes (not just timestamp bumps).
   Metric updates count as substantive.

2. **Structured data.** Add `dateModified` to the case study's JSON-LD
   schema markup, updating it on each refresh.

3. **"Last updated" text.** Visible on the public case study page, e.g.,
   "Originally published January 2026. Last verified with updated metrics
   July 2026." This signals freshness to both search engines and readers.

4. **Canonical URL stability.** The URL does not change between versions.
   Only the content updates, preserving link equity.

---

## 5. Architecture: How It Fits Into Existing Quotd

### 5.1 Current Flow (Unchanged)

```
Creator sends link -> Customer does interview (/i/{token}/q)
  -> AI extracts metrics/quotes/facts (extraction_state)
  -> AI generates draft (draft_content)
  -> Customer reviews (/i/{token}/review)
  -> Review complete -> reminders cancelled
```

### 5.2 Extended Flow (Living Case Studies)

```
Review complete
  -> Schedule first refresh (next_refresh_at = completed_at + cadence)
  -> Create version 1 snapshot in case_study_versions

[cadence elapses]

Inngest cron fires daily
  -> Finds interviews where next_refresh_at <= NOW()
  -> For each: send refresh email to customer

Customer clicks link
  -> /i/{token}/refresh (card-based confirm/update UI)
  -> Submits updates

Server processes submission
  -> AI extracts new data from updates
  -> AI merges changed sections into existing draft
  -> Creates version N+1 snapshot with diff metadata
  -> Updates extraction_state, draft_content, last_refreshed_at
  -> Computes next_refresh_at
  -> Dispatches refresh.completed webhook
  -> Notifies creator via email

Creator views in dashboard
  -> Sees "Last verified" badge
  -> Can view version history + metric trajectory
  -> Can embed freshness widget on external sites
```

### 5.3 New Files

```
src/
  inngest/
    client.ts                          # Inngest client init
    functions/
      refresh-scan.ts                  # Daily cron: find due refreshes
      refresh-pipeline.ts             # Multi-step: email -> wait -> merge
  app/
    api/
      inngest/
        route.ts                       # Inngest serve endpoint
      interview/
        [token]/
          refresh/
            route.ts                   # GET: fetch refresh data
            submit/
              route.ts                 # POST: process refresh submission
      v1/
        interviews/
          [id]/
            refresh/
              route.ts                 # POST: manual trigger refresh
            versions/
              route.ts                 # GET: list versions
            badge/
              route.ts                 # GET: badge JSON
              badge.svg/
                route.ts               # GET: SVG badge image
    i/
      [token]/
        refresh/
          page.tsx                     # Customer-facing refresh UI
  components/
    refresh/
      metric-card.tsx                  # Confirm/update card for metrics
      fact-card.tsx                    # Confirm/update card for facts
      quote-card.tsx                   # Confirm/update card for quotes
      open-ended-card.tsx              # Free-form final question
      refresh-progress.tsx             # Progress bar (2 of 5 reviewed)
    dashboard/
      freshness-badge.tsx              # Badge component
      version-timeline.tsx             # Version history timeline
      metric-trajectory.tsx            # Metric-over-time table
      version-diff.tsx                 # Side-by-side diff viewer
  lib/
    ai/
      merge.ts                         # Section-level content merge
      merge-prompts.ts                 # SECTION_MERGE_PROMPT, SUMMARY_PROMPT
    refresh/
      schedule.ts                      # Cadence computation helpers
      holidays.ts                      # Holiday/weekend avoidance
      types.ts                         # RefreshSubmission, RefreshConfig types
    email/
      templates/
        refresh-request-email.tsx       # "Time to update your case study" email
        refresh-complete-email.tsx      # "Case study updated" notification
  public/
    widget/
      badge.js                         # Embeddable widget script
```

### 5.4 New Webhook Events

Add to `src/lib/events.ts`:

```typescript
export const WEBHOOK_EVENTS = [
  // ... existing events
  "refresh.requested",   // Refresh email sent to customer
  "refresh.completed",   // Customer submitted refresh, content updated
  "refresh.skipped",     // Customer did not respond within window
] as const;
```

### 5.5 New Database Objects

```sql
-- Migration: Living Case Studies

-- 1. New columns on interviews table
ALTER TABLE interviews
  ADD COLUMN refresh_cadence TEXT DEFAULT 'semi_annual'
    CHECK (refresh_cadence IN (
      'quarterly', 'semi_annual', 'annual', 'custom', 'disabled'
    )),
  ADD COLUMN refresh_interval_days INTEGER DEFAULT 180,
  ADD COLUMN next_refresh_at TIMESTAMPTZ,
  ADD COLUMN last_refreshed_at TIMESTAMPTZ,
  ADD COLUMN refresh_count INTEGER DEFAULT 0,
  ADD COLUMN customer_timezone TEXT;

CREATE INDEX idx_interviews_next_refresh ON interviews(next_refresh_at)
  WHERE status = 'review_complete' AND refresh_cadence != 'disabled';

-- 2. Version history table
CREATE TABLE case_study_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  trigger TEXT NOT NULL
    CHECK (trigger IN ('initial', 'refresh', 'manual_edit', 'ai_regenerate')),
  draft_content TEXT NOT NULL,
  extraction_state JSONB NOT NULL,
  changes_summary TEXT,
  metrics_changed JSONB,
  quotes_changed JSONB,
  facts_changed JSONB,
  created_by TEXT NOT NULL
    CHECK (created_by IN ('customer', 'creator', 'system')),
  refresh_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_versions_interview_id ON case_study_versions(interview_id);
CREATE UNIQUE INDEX idx_versions_unique
  ON case_study_versions(interview_id, version_number);

ALTER TABLE case_study_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions of own interviews"
  ON case_study_versions FOR SELECT
  USING (
    interview_id IN (
      SELECT id FROM interviews WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage versions"
  ON case_study_versions FOR ALL USING (true);

-- 3. Refresh tracking table (audit trail for refresh emails)
CREATE TABLE refresh_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'sent', 'opened', 'completed', 'expired', 'snoozed'
    )),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  snooze_token TEXT UNIQUE,
  snooze_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_requests_interview
  ON refresh_requests(interview_id);
ALTER TABLE refresh_requests ENABLE ROW LEVEL SECURITY;
```

### 5.6 Dependencies to Add

```json
{
  "inngest": "^3.x",
  "diff": "^7.x"
}
```

`inngest` for durable workflow orchestration. `diff` for client-side text
diffing in the version comparison UI. No other new dependencies required —
the existing stack (Anthropic AI SDK, Resend, Deepgram, Supabase) covers
everything else.

---

## 6. Build Order

| Phase | Scope | Effort |
|-------|-------|--------|
| **P0** | Schema migration + `case_study_versions` table + version 1 snapshot on draft generation | 2 days |
| **P1** | Inngest setup + refresh scan cron + refresh email template | 2 days |
| **P2** | Micro-interview refresh UI (`/i/[token]/refresh`) + submit endpoint | 3 days |
| **P3** | AI merge engine (`src/lib/ai/merge.ts`) + extraction update | 3 days |
| **P4** | Dashboard: version history timeline + metric trajectory + diff viewer | 3 days |
| **P5** | Freshness badge component + embeddable widget (script + SVG) | 2 days |
| **P6** | Smart timing (timezone, holidays, snooze) + backoff logic | 1 day |
| **P7** | Manual refresh trigger (dashboard button + API endpoint) | 1 day |
| **P8** | New webhook events + badge API endpoint for external consumers | 1 day |

**Total: ~18 days of focused work.**

P0 should ship first and independently — it gives version history for free
with zero user-facing changes. P1-P3 are the core loop. P4-P5 are the
trust/visibility layer. P6-P8 are polish.

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI merge produces inconsistent tone | Medium | Section-level merge (not full rewrite) preserves existing style. Add style-matching instruction to prompt. Human review notification to creator. |
| Customer ignores refresh emails | High | Cap at 2 emails per cycle. Graceful degradation — badge shows "Published [date]" instead of "Verified". Creator notified to follow up manually. |
| Version table grows large | Low | Only ~2-4 versions/year per interview. Retention policy: keep all versions for 3 years, then archive to cold storage. |
| Inngest adds complexity | Low | Inngest functions are plain TypeScript. Fallback: if Inngest is down, the daily Vercel Cron can trigger the same logic (degrade to non-durable execution). |
| Metric regression embarrassment | Medium | If a metric goes down (30% -> 15%), flag for creator review before publishing. Do not auto-publish regressions. |

---

## 8. Open Questions

1. **Should refreshed case studies auto-publish, or require creator approval?**
   Recommendation: auto-publish for confirmations (no changes), require
   creator review for any metric that changed by > 20% or any regression.

2. **Pricing tier.** Living Case Studies is a clear Pro/Enterprise feature.
   Free tier could get one refresh per case study. Pro gets unlimited.

3. **Multi-format refresh.** When the case study updates, should all derived
   formats (LinkedIn post, email blurb, sales slide) auto-regenerate? Yes,
   but lazily — regenerate on next view, not eagerly on refresh.

4. **Public version history.** Should the embedded badge link to a public
   version history? This could be a powerful trust signal ("See how results
   have grown over 18 months") but may expose data the creator wants private.
   Make it opt-in per interview.
