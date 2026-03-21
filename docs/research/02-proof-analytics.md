# Proof Analytics & Deal Attribution — Technical Research

**Author:** Staff Engineer (ex-Wistia, ex-Vidyard)
**Date:** 2026-03-20
**Status:** Research / Pre-RFC

---

## 1. Executive Summary

Quotd currently generates case studies from AI voice interviews and tracks interview completion funnels (created -> opened -> started -> completed -> reviewed). There is zero tracking of what happens *after* a case study is published — who reads it, how deeply they engage, whether that engagement correlates with revenue.

This document designs a **Proof Analytics** system that:
1. Tracks granular engagement on published case studies and proof assets (one-pagers, quote cards, email blurbs, etc.)
2. Associates views with specific prospects, deals, and contacts in Salesforce and HubSpot
3. Calculates pipeline influence and revenue attribution
4. Surfaces all of this through a dashboard that answers: *"This case study influenced $420K in pipeline this quarter."*

The architecture is informed by how Wistia and Vidyard built their content analytics and CRM integration layers — adapted for written/mixed-media content rather than video.

---

## 2. Current Architecture Audit

### What Exists Today

| Layer | Current State |
|-------|--------------|
| **Database** | Supabase (PostgreSQL). Tables: `interviews`, `messages`, `profiles`, `otp_tokens`, `teams`, `team_members`, `team_invites`, `clients`, `reminders`, `api_keys`, `webhooks`, `webhook_deliveries`. |
| **Content Output** | `draft_content` (Markdown), `generated_formats` (JSONB with one_pager, linkedin, twitter, sales_slide, quote_cards, email_blurb). |
| **Sharing** | `share_token` per interview. Public URLs at `/i/{token}`. Export via `/api/interview/{token}/export?format=md|txt|html|docx|pdf`. |
| **Analytics** | Interview funnel only (`/api/analytics`). Tracks: created/opened/started/completed/review stages. No post-publish tracking. |
| **Event System** | Webhook dispatch (`WEBHOOK_EVENTS`: interview.created, interview.completed, review.started, review.completed, draft.generated, format.generated, reminder.sent). |
| **Auth** | Supabase Auth with OTP. Middleware protects `/dashboard` routes. Public `/i/{token}` routes are unauthenticated. |
| **Stack** | Next.js 16, React 19, Supabase SSR, Vercel hosting, Resend email, Sentry monitoring. |

### Key Observations

1. **`share_token` is the existing unique identifier for sharing** — but it is tied to the interview, not the recipient. Every recipient gets the same URL. This is the single biggest gap.
2. **No charting library is currently installed.** The existing analytics page uses custom SVG/HTML for the funnel chart.
3. **The webhook system is well-designed** and can be extended for CRM sync events.
4. **Vercel cron jobs exist** (`/api/cron/reminders`, `/api/cron/webhooks`) — pattern is already established.
5. **The `generated_formats` JSONB field** means multiple proof assets per case study already exist. Each needs its own tracking.

### What Needs to Change

- **Trackable links**: Unique per-recipient, per-asset, per-deal link system
- **Event ingestion pipeline**: High-volume engagement events (scroll, time, clicks)
- **Analytics storage**: Separate from OLTP — PostgreSQL is wrong for billions of time-series events
- **CRM integration layer**: Bidirectional Salesforce + HubSpot sync
- **Attribution engine**: Multi-touch revenue attribution calculations
- **Dashboard**: New proof analytics pages with charts

---

## 3. Content Tracking & Analytics

### 3.1 Trackable Link Architecture

**Problem:** Today's `/i/{share_token}` gives every viewer the same URL. We cannot distinguish who is viewing.

**Solution: Proof Links**

```
/proof/{proof_id}?ref={tracking_ref}

Examples:
/proof/acme-case-study?ref=deal-4521
/proof/acme-case-study?ref=jsmith-acme
/proof/acme-case-study?ref=seq-hubspot-4521
```

**Data Model:**

```sql
-- Publishable proof assets (one per interview, many formats)
CREATE TABLE proof_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  slug TEXT NOT NULL,                    -- URL-friendly: "acme-case-study"
  format TEXT NOT NULL DEFAULT 'full',   -- full, one_pager, quote_cards, etc.
  title TEXT NOT NULL,
  content TEXT NOT NULL,                 -- rendered content
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(slug, format)
);

-- Trackable links — one per recipient/deal combination
CREATE TABLE proof_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_asset_id UUID REFERENCES proof_assets(id) ON DELETE CASCADE,
  tracking_ref TEXT NOT NULL UNIQUE,     -- short unique ref for URL params
  recipient_email TEXT,                  -- known email if available
  recipient_name TEXT,
  company_name TEXT,
  deal_id TEXT,                          -- CRM deal ID (Salesforce/HubSpot)
  deal_name TEXT,
  contact_id TEXT,                       -- CRM contact ID
  crm_type TEXT CHECK (crm_type IN ('salesforce', 'hubspot')),
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ                 -- optional link expiry
);

CREATE INDEX idx_proof_links_tracking_ref ON proof_links(tracking_ref);
CREATE INDEX idx_proof_links_proof_asset ON proof_links(proof_asset_id);
CREATE INDEX idx_proof_links_deal ON proof_links(deal_id);
CREATE INDEX idx_proof_links_contact ON proof_links(contact_id);
```

**Link generation flow:**
1. Sales rep opens case study in dashboard, clicks "Share with prospect"
2. Enters: recipient email, optional deal info (or auto-populated from CRM)
3. System generates unique `tracking_ref` (nanoid, 12 chars: `a7x9k2m4p1q8`)
4. Returns trackable URL: `https://app.quotd.io/proof/acme-case-study?ref=a7x9k2m4p1q8`

### 3.2 What to Track

Drawing from Wistia's video heatmap model adapted for written content:

| Event | Description | Priority | Implementation |
|-------|-------------|----------|----------------|
| `proof.opened` | Proof asset loaded by recipient | P0 | Page load event |
| `proof.time_on_page` | Total engaged time (not tab-hidden) | P0 | Heartbeat every 5s, pause when `document.hidden` |
| `proof.scroll_depth` | Max scroll percentage (25/50/75/100) | P0 | Intersection Observer on section markers |
| `proof.section_view` | Specific section entered viewport | P1 | Intersection Observer per `<section>` |
| `proof.section_dwell` | Time spent with section in viewport | P1 | Combine IO with timer |
| `proof.cta_click` | Clicked a CTA button/link | P0 | Click handler |
| `proof.download` | Downloaded PDF/DOCX version | P0 | Download button click |
| `proof.forwarded` | Recipient shared/forwarded (inferred) | P2 | New `ref` from same IP or referrer chain |
| `proof.metric_hover` | Hovered on a metric card | P2 | Mouseenter with 500ms threshold |
| `proof.quote_copy` | Copied a quote block | P2 | Copy event listener |
| `proof.link_click` | Clicked an outbound link | P1 | Click handler on `<a>` tags |

**Engagement scoring** (Wistia-inspired weighted model):

```
engagement_score = (
  opened * 10 +
  min(time_on_page_seconds / 30, 20) * 3 +    -- cap at 20 = 10 min
  scroll_25 * 5 +
  scroll_50 * 10 +
  scroll_75 * 15 +
  scroll_100 * 20 +
  cta_click * 25 +
  download * 30 +
  sections_viewed / total_sections * 20
)
```

This mirrors Wistia's "Video Qualified Lead" (VQL) concept — a **Proof Qualified Lead (PQL)** is a prospect who has deeply engaged with proof content (score > 60), indicating self-education and buying intent.

### 3.3 Client-Side Tracking Implementation

**Tracking beacon script** (embedded in proof pages):

```typescript
// src/lib/proof/tracker.ts

type ProofEvent = {
  type: string;
  proof_asset_id: string;
  tracking_ref: string;
  properties: Record<string, unknown>;
  timestamp: number;
};

class ProofTracker {
  private buffer: ProofEvent[] = [];
  private flushInterval: number;
  private sessionId: string;
  private startTime: number;
  private maxScrollDepth = 0;
  private sectionsViewed = new Set<string>();
  private isVisible = true;
  private engagedTime = 0;
  private lastTick: number;

  constructor(
    private proofAssetId: string,
    private trackingRef: string,
    private endpoint: string
  ) {
    this.sessionId = crypto.randomUUID();
    this.startTime = Date.now();
    this.lastTick = Date.now();

    // Flush buffer every 10 seconds
    this.flushInterval = window.setInterval(() => this.flush(), 10_000);

    // Track visibility
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.isVisible = false;
        this.flush(); // flush on hide
      } else {
        this.isVisible = true;
        this.lastTick = Date.now();
      }
    });

    // Flush on page unload via Beacon API
    window.addEventListener("pagehide", () => this.flush(true));

    // Start engaged time tracking
    this.tickEngagedTime();

    // Initial open event
    this.track("proof.opened", {});
  }

  private tickEngagedTime() {
    setInterval(() => {
      if (this.isVisible) {
        const now = Date.now();
        this.engagedTime += now - this.lastTick;
        this.lastTick = now;
      }
    }, 1_000);
  }

  track(type: string, properties: Record<string, unknown>) {
    this.buffer.push({
      type,
      proof_asset_id: this.proofAssetId,
      tracking_ref: this.trackingRef,
      properties: {
        ...properties,
        session_id: this.sessionId,
        engaged_time_ms: this.engagedTime,
        max_scroll_depth: this.maxScrollDepth,
      },
      timestamp: Date.now(),
    });

    // Flush immediately for high-value events
    if (["proof.cta_click", "proof.download"].includes(type)) {
      this.flush();
    }
  }

  trackScroll(depth: number) {
    if (depth > this.maxScrollDepth) {
      this.maxScrollDepth = depth;
      const milestone = Math.floor(depth / 25) * 25;
      if (milestone > 0 && milestone <= 100) {
        this.track("proof.scroll_depth", { depth: milestone });
      }
    }
  }

  trackSectionView(sectionId: string) {
    if (!this.sectionsViewed.has(sectionId)) {
      this.sectionsViewed.add(sectionId);
      this.track("proof.section_view", { section_id: sectionId });
    }
  }

  private flush(useBeacon = false) {
    if (this.buffer.length === 0) return;

    const payload = JSON.stringify({
      events: this.buffer,
      metadata: {
        user_agent: navigator.userAgent,
        referrer: document.referrer,
        url: window.location.href,
        screen_width: window.innerWidth,
      },
    });

    this.buffer = [];

    if (useBeacon) {
      navigator.sendBeacon(this.endpoint, payload);
    } else {
      fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // Silent fail — analytics should never break the page
      });
    }
  }

  destroy() {
    clearInterval(this.flushInterval);
    this.track("proof.time_on_page", {
      total_engaged_ms: this.engagedTime,
      total_elapsed_ms: Date.now() - this.startTime,
      sections_viewed: Array.from(this.sectionsViewed),
      max_scroll_depth: this.maxScrollDepth,
    });
    this.flush(true);
  }
}
```

**Key design decisions:**

1. **Beacon API for `pagehide`** — `navigator.sendBeacon()` guarantees delivery even when the page is closing. Fetch with `keepalive: true` is the fallback. This is the same approach Wistia uses for video completion events.

2. **10-second flush interval** — balances real-time visibility with request volume. At scale (1000 concurrent viewers), this means ~100 req/s to the ingest endpoint.

3. **Engaged time, not wall-clock time** — uses `document.visibilityState` to only count time when the tab is active. This is how Wistia distinguishes "watched" from "had the tab open." Critical for accurate engagement scoring.

4. **Intersection Observer for scroll/section tracking** — no scroll event listeners (which cause jank). Each section `<div>` gets an IO observer:

```typescript
// In the proof page React component
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          tracker.trackSectionView(entry.target.id);
        }
      });
    },
    { threshold: 0.5 } // 50% visible = "viewed"
  );

  document.querySelectorAll("[data-proof-section]").forEach((el) => {
    observer.observe(el);
  });

  return () => observer.disconnect();
}, [tracker]);
```

### 3.4 Privacy Compliance

**The B2B content tracking landscape in 2026:**

| Regulation | Requirement | Implication for Quotd |
|-----------|-------------|----------------------|
| **GDPR** (EU) | Requires prior opt-in consent for non-essential cookies/tracking. Legitimate interest *may* apply for B2B but is contested. | Must show consent banner for EU recipients. Store consent status per proof_link. |
| **CCPA/CPRA** (CA) | Requires "Do Not Sell/Share" opt-out notice. Does not require opt-in for B2B contact data used for business purposes. | Display privacy notice. Honor opt-out requests. |
| **ePrivacy** (EU) | Cookie consent required regardless of GDPR basis. | First-party cookies need consent in EU. |
| **US State Laws** (IN, KY, RI effective Jan 2026) | Varying opt-out requirements. | Privacy notice with opt-out mechanism. |

**Recommended approach:**

1. **No third-party cookies or fingerprinting.** All tracking is first-party, URL-parameter based (`?ref=`). The `tracking_ref` is the identity mechanism — no cookies needed for attribution.

2. **First-party session cookie** (optional, for repeat visit detection) — `quotd_session` with 30-day expiry. Only set after page load (not pre-consent). This is a strictly necessary functional cookie in most interpretations.

3. **Lightweight consent banner** for EU traffic (detect via `Accept-Language` header or Cloudflare `cf-ipcountry`):
   - **Essential tracking** (always on): page open, link ref association, download
   - **Enhanced tracking** (requires consent): scroll depth, section dwell time, engaged time, click tracking
   - Store consent in `proof_link_consent` table

4. **Data minimization:**
   - No PII stored in events table — only `tracking_ref` (which links to `proof_links` where email is stored separately)
   - IP addresses hashed (SHA-256 + salt) before storage — used only for approximate geo and company matching, never stored raw
   - Auto-delete raw events after 90 days, keep only aggregated metrics

5. **Legitimate interest basis for B2B:** When a sales rep sends a trackable link to a known business contact at a company they have a business relationship with, legitimate interest is the appropriate GDPR basis. Document this in the privacy policy. The key legal point: the recipient's email address was provided by the sales rep (their existing contact), not collected by tracking.

---

## 4. CRM Integration Architecture

### 4.1 Salesforce Integration

**OAuth 2.0 Flow:**

Salesforce uses the Web Server OAuth flow (Authorization Code Grant). Quotd needs a Connected App in the customer's Salesforce org.

```
User clicks "Connect Salesforce" in Quotd Settings
  -> Redirect to Salesforce authorize URL
  -> User grants access
  -> Callback to /api/integrations/salesforce/callback with auth code
  -> Exchange code for access_token + refresh_token
  -> Store encrypted tokens in crm_connections table
```

**Data model for CRM connections:**

```sql
CREATE TABLE crm_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  crm_type TEXT NOT NULL CHECK (crm_type IN ('salesforce', 'hubspot')),
  instance_url TEXT,                     -- Salesforce instance URL
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  connected_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'error', 'revoked')),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, crm_type)
);
```

**What to write to Salesforce — and where:**

Based on how Wistia and Vidyard implement their Salesforce integrations, there are three viable approaches:

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Task/Activity** | Native to Salesforce. Shows in Activity Timeline on Contact/Lead. Familiar to reps. | Limited custom fields. Archived after 1 year. Cannot run aggregate reports easily. | **Use for individual view notifications** |
| **Custom Object (`Proof_View__c`)** | Full control over fields. Unlimited custom fields. Permanent storage. Full reporting. | Requires admin to create object. More complex setup. | **Use for detailed engagement data** |
| **Engagement History (CampaignMember)** | Native attribution. Works with Salesforce Campaign Influence. | Requires Campaigns feature. Heavy setup. | **Phase 2 — for multi-touch attribution** |

**Recommended hybrid approach (matches Vidyard's model):**

1. **Create a Task** when a prospect opens a proof asset for the first time:
   - Subject: `"Viewed: {Case Study Title}"`
   - Description: Engagement summary (time spent, scroll depth, sections viewed)
   - WhoId: Contact/Lead ID
   - WhatId: Opportunity ID (if deal is known)
   - Status: "Completed"
   - Type: "Proof View"

2. **Create/update a Custom Object `Proof_Engagement__c`** for detailed analytics:
   - Fields: `Proof_Asset_Name__c`, `Recipient_Email__c`, `Total_Views__c`, `Total_Engaged_Time__c`, `Max_Scroll_Depth__c`, `Engagement_Score__c`, `First_Viewed__c`, `Last_Viewed__c`, `Sections_Viewed__c`, `Downloads__c`
   - Lookup relationships to Contact, Lead, Opportunity, Account
   - This is the "video views" related list equivalent from Vidyard

3. **Update Opportunity (Deal) custom fields** for pipeline dashboards:
   - `Proof_Assets_Viewed__c` (Number)
   - `Proof_Total_Engagement_Score__c` (Number)
   - `Last_Proof_View_Date__c` (DateTime)

**Salesforce API limits consideration:**

| Edition | Daily API Limit | Per-User Addition |
|---------|----------------|-------------------|
| Enterprise | 100,000 | +1,000/user |
| Unlimited | 250,000 | +5,000/user |

At 1,000 proof views/day, if each view generates 2 API calls (1 Task + 1 Custom Object upsert), that is 2,000 calls/day — well within limits. However, if a single proof asset gets 500 views in one hour (viral sharing), we need to **batch and deduplicate**.

**Batching strategy:**
- Queue CRM writes via Inngest (event-driven, with built-in retry)
- Aggregate views per contact per proof asset per hour
- Use Salesforce Composite API to batch up to 25 operations in a single request
- Use Salesforce Bulk API 2.0 for daily full syncs (up to 150,000,000 records/24h)

### 4.2 HubSpot Integration

**OAuth 2.0 Flow:**

HubSpot uses standard OAuth 2.0 Authorization Code flow. Similar to Salesforce but simpler — single instance URL (`api.hubapi.com`).

**What to write to HubSpot:**

1. **Timeline Events** (via Timeline API):
   - Create a custom Timeline Event Template for "Proof View"
   - Template fields: asset name, engagement score, time spent, scroll depth
   - Events appear on Contact timeline, associated with Deals
   - Requires a HubSpot app (Developer Portal) with Timeline Events scope

2. **Custom Behavioral Events** (available to Pro+ customers as of March 2026):
   - Up to 500 unique event types
   - Pro: 10M event occurrences/month, Enterprise: 30M/month
   - Events: `proof_opened`, `proof_engaged`, `proof_downloaded`
   - Can trigger workflows, lead scoring, segmentation

3. **Deal Association:**
   - When creating a timeline event, include `objectId` (contact ID) + deal association
   - Use HubSpot Associations API to link proof engagement to deals
   - HubSpot natively supports multi-object associations (Contact -> Deal -> Company)

**HubSpot API limits:**
- 100 requests per 10 seconds (OAuth apps)
- 500,000 requests per day
- Much more generous than Salesforce — less batching needed

### 4.3 Contact/Deal Matching

The critical challenge: **how do you associate an anonymous proof view with a specific CRM contact and deal?**

**Matching hierarchy (highest confidence first):**

| Method | Confidence | How It Works | When Available |
|--------|-----------|--------------|----------------|
| **Tracking ref** | 100% | Sales rep created the link for a specific deal/contact. `proof_links.deal_id` and `proof_links.contact_id` are pre-populated. | Always (when link was created with deal context) |
| **Email parameter** | 95% | URL includes `&email=jsmith@acme.com`. Match against CRM contacts. | When sent via email sequence with merge tags |
| **UTM parameters** | 80% | `utm_campaign=deal-4521` maps to a known deal/campaign. | When used with marketing automation |
| **Reverse IP lookup** | 60% | Use Clearbit Reveal API (`$99/mo`) or 6sense to match IP -> company. Then fuzzy-match company to CRM accounts. | Fallback for unknown visitors |
| **Email open tracking** | 70% | If proof link was sent via Resend (Quotd's email provider), Resend's tracking pixel fires first, giving us the recipient email. Associate subsequent proof view with that email. | When proof was shared via Quotd email |
| **Cookie-based** | 50% | If viewer previously identified themselves (clicked a different tracked link), first-party cookie links sessions. | Repeat visitors only |

**Recommended implementation order:**
1. **Phase 1:** Tracking ref (covers 80%+ of use cases since sales reps create links)
2. **Phase 2:** Email parameter + Resend open tracking integration
3. **Phase 3:** Reverse IP (Clearbit Reveal API — $0.01-0.05/lookup, ~$99/mo for 10K lookups)

### 4.4 Bidirectional Sync Architecture

```
Quotd -> CRM (Push):
  proof.opened event        -> Create Task + Upsert Proof_Engagement__c
  proof.engaged (score > 40) -> Update Proof_Engagement__c + Deal fields
  proof.download             -> Create Task + Update Proof_Engagement__c

CRM -> Quotd (Pull):
  Deal stage changes         -> Update proof_links.deal_stage, recalculate attribution
  Deal amount changes        -> Update attribution calculations
  Deal closed won/lost       -> Finalize attribution, trigger dashboard update
  Contact created/updated    -> Sync contact data for matching
```

**Sync mechanism:**

| Direction | Method | Frequency | Justification |
|-----------|--------|-----------|---------------|
| Quotd -> CRM | **Event-driven via Inngest** | Real-time (within 30s) | Sales reps need to see proof engagement immediately on the deal record. Delayed sync loses the "just viewed" urgency. |
| CRM -> Quotd | **Webhook + daily polling** | Webhooks for real-time deal changes, daily full sync for reconciliation | Salesforce Outbound Messages / HubSpot Webhooks for stage changes. Daily poll catches anything webhooks missed. |

```
┌─────────────┐    events     ┌──────────┐    batch     ┌─────────────┐
│  Proof Page  │ ──────────> │  Tinybird │ ──────────> │  Supabase   │
│  (tracker)   │             │  (events) │             │  (agg data) │
└─────────────┘              └──────────┘              └──────┬──────┘
                                                              │
                                                        Inngest jobs
                                                              │
                              ┌──────────┐              ┌─────▼──────┐
                              │  CRM     │ <──────────> │  CRM Sync  │
                              │  (SF/HS) │   webhook/   │  Service   │
                              └──────────┘   polling     └────────────┘
```

---

## 5. Attribution Modeling

### 5.1 Attribution Models

Content attribution is fundamentally different from ad attribution. A case study view is not a "touchpoint" in the marketing-mix sense — it is a **sales enablement touchpoint** within an existing deal cycle.

**Supported models (configurable per team):**

| Model | Formula | Best For |
|-------|---------|----------|
| **Binary influence** (default) | If anyone on the deal viewed any proof asset before close: deal is "proof-influenced." Full deal value attributed. | Simple "did proof help?" reporting. Industry standard (used by Vidyard, Gong, Chorus). |
| **First-touch** | 100% credit to the first proof asset viewed by anyone on the deal. | Understanding which case studies open doors. |
| **Last-touch** | 100% credit to the last proof asset viewed before deal closed. | Understanding which case studies close deals. |
| **Linear** | Equal credit split across all proof assets viewed on the deal. | Fair distribution when multiple assets used. |
| **Time-decay** | More credit to views closer to close date. Half-life = 14 days. | Rewarding recency. |
| **Engagement-weighted** | Credit proportional to engagement score of each view. | Rewarding depth of engagement, not just opens. |

**Recommended default: Binary influence.** This is what Vidyard, Wistia, Gong, and most sales enablement tools use. It is the easiest to explain to stakeholders: "12 deals worth $1.2M were influenced by proof content this quarter."

### 5.2 Pipeline Influence Calculation

**Core formula:**

```
Content-Influenced Pipeline = SUM(deal_value)
  WHERE deal has at least one proof view
    AND proof view occurred BEFORE deal close date
    AND proof view was by a contact associated with the deal
```

**Required data points per attribution:**

1. **Proof view event** with `tracking_ref`
2. **`tracking_ref` -> `proof_link`** with `deal_id` and `contact_id`
3. **Deal data from CRM**: `amount`, `stage`, `close_date`, `is_won`
4. **Contact-to-deal association** from CRM (multiple contacts per deal)

**Edge cases and how to handle them:**

| Scenario | Handling |
|----------|----------|
| Multiple case studies viewed per deal | Binary: attribute full deal value to each asset (sum > total, which is expected and industry-standard). Linear/time-decay: split credit. |
| Multiple contacts per deal viewed different assets | Union of all views across buying committee. Any view by any deal contact counts. |
| View after deal closed | Exclude from pipeline influence. Track separately as "post-sale engagement" (useful for expansion/upsell reporting). |
| Deal reopened after close | Recalculate: include views between original close and re-close. |
| No deal associated with view | Track as "unattributed engagement." Surface in dashboard so reps can manually associate. |
| View by unknown visitor (no tracking ref) | Track engagement metrics. Attempt reverse-IP matching. Flag for manual review. |

### 5.3 Data Model for Attribution

```sql
-- Materialized view, rebuilt daily (or triggered by deal stage change)
CREATE TABLE proof_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  proof_asset_id UUID REFERENCES proof_assets(id) ON DELETE CASCADE,
  deal_id TEXT NOT NULL,                 -- CRM deal ID
  deal_name TEXT,
  deal_amount DECIMAL(12,2),
  deal_stage TEXT,
  deal_close_date DATE,
  deal_is_won BOOLEAN,
  crm_type TEXT,
  attribution_model TEXT DEFAULT 'binary',
  attributed_amount DECIMAL(12,2),       -- amount credited to this asset
  total_views INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  total_engaged_time_seconds INTEGER DEFAULT 0,
  max_engagement_score DECIMAL(5,2) DEFAULT 0,
  first_view_at TIMESTAMPTZ,
  last_view_at TIMESTAMPTZ,
  contacts JSONB DEFAULT '[]',           -- [{contact_id, email, views, score}]
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(proof_asset_id, deal_id, attribution_model)
);

CREATE INDEX idx_attribution_team ON proof_attribution(team_id);
CREATE INDEX idx_attribution_deal ON proof_attribution(deal_id);
CREATE INDEX idx_attribution_asset ON proof_attribution(proof_asset_id);
CREATE INDEX idx_attribution_close_date ON proof_attribution(deal_close_date);
```

### 5.4 Attribution Calculation Job

This runs as an **Inngest cron function** (daily at 2 AM UTC) and also triggered by CRM webhook on deal stage change:

```
1. For each team with active CRM connection:
2.   Fetch all deals updated in last 24h from CRM (or all deals if first run)
3.   For each deal:
4.     Get all contacts associated with the deal
5.     For each contact:
6.       Find all proof_links where contact_id matches
7.       For each proof_link:
8.         Query Tinybird for engagement events before deal close_date
9.         Calculate engagement_score
10.    Aggregate: total views, unique viewers, time, score per asset per deal
11.    Apply attribution model (binary/linear/time-decay)
12.    Upsert into proof_attribution table
```

---

## 6. Dashboard & Reporting

### 6.1 Key Metrics

**Top-level dashboard cards:**

| Metric | Calculation | Update Frequency |
|--------|------------|------------------|
| **Pipeline Influenced** | SUM(deal_amount) WHERE proof_viewed AND deal.stage != 'Closed Lost' | Daily |
| **Revenue Attributed** | SUM(deal_amount) WHERE proof_viewed AND deal.is_won = true | Daily |
| **Total Proof Views** | COUNT(proof.opened events) | Real-time |
| **Unique Viewers** | COUNT(DISTINCT tracking_ref WHERE proof.opened) | Real-time |
| **Avg Engagement Score** | AVG(engagement_score) across all views | Daily |
| **Avg Time on Proof** | AVG(engaged_time) | Daily |
| **Proof Qualified Leads** | COUNT(viewers WHERE engagement_score > 60) | Daily |

**Per-asset reporting (which case studies perform best):**

| Metric | Purpose |
|--------|---------|
| Total views | Raw reach |
| Unique viewers | Deduplicated reach |
| Avg engagement score | Content quality signal |
| Avg scroll depth | "Did they read it?" |
| Pipeline influenced | Revenue impact |
| Deals influenced | Count of deals |
| Download rate | Offline sharing signal |
| Forward rate | Viral coefficient |

**Per-rep reporting (which sales reps use proof most effectively):**

| Metric | Purpose |
|--------|---------|
| Proof links created | Adoption measurement |
| Proof links clicked | Are their prospects engaging? |
| Avg engagement score of their sends | Are they sending the right proof to the right prospects? |
| Pipeline influenced through their proof links | Revenue tie-back |
| Win rate on proof-influenced deals vs. non-influenced | Uplift measurement |

### 6.2 Dashboard Pages

**New routes under `/dashboard`:**

```
/dashboard/proof                   -- Overview: pipeline influenced, top assets, trends
/dashboard/proof/[assetId]         -- Per-asset detail: viewer list, engagement heatmap
/dashboard/proof/[assetId]/viewers -- Who viewed, engagement per person
/dashboard/proof/links             -- All trackable links, click status
/dashboard/proof/attribution       -- Revenue attribution table
/dashboard/proof/reps              -- Per-rep adoption and effectiveness
```

### 6.3 Charting Library Recommendation

**Recommendation: Recharts.**

Justification:
- Already in the React/Next.js ecosystem (zero config friction)
- Composable component API matches Quotd's existing component patterns
- Lightweight (~45KB gzipped) — Quotd is performance-sensitive on Vercel
- Sufficient for the chart types needed: bar charts (pipeline by month), line charts (engagement trends), area charts (views over time), pie/donut (attribution breakdown)
- Used by shadcn/ui's chart components — and Quotd already uses shadcn patterns (`components.json`, `class-variance-authority`, `clsx`, `tailwind-merge`)
- Tremor would be a strong alternative if deeper Tailwind integration is desired, but it adds another abstraction layer on top of Recharts

**Not recommended:**
- Nivo: Heavier, more complex API than needed. Better for data-dense scientific visualization.
- D3 direct: Too low-level for a product dashboard. Wastes engineering time.
- Chart.js: Canvas-based, harder to theme with Tailwind, less React-native.

### 6.4 Engagement Heatmap (Wistia-Inspired)

Wistia's signature feature is the video engagement graph — a second-by-second visualization of where viewers watched, rewatched, and dropped off.

For written content, the equivalent is a **section engagement heatmap**:

```
┌─────────────────────────────────────────────────┐
│  Section Engagement Heatmap                     │
│                                                 │
│  Executive Summary   ████████████████████  95%  │
│  Challenge           ███████████████████   90%  │
│  Solution            ████████████████      78%  │
│  Key Metrics         ████████████████████  92%  │
│  Implementation      ██████████████       65%   │
│  ROI / Results       █████████████████    82%   │
│  Customer Quote      ████████████████████  88%  │
│  Call to Action      ████████████          58%  │
│                                                 │
│  ▓ = % of viewers who scrolled to this section  │
└─────────────────────────────────────────────────┘
```

This tells the creator: "92% of viewers read the Key Metrics section, but only 58% reached the CTA. Consider moving the CTA higher."

---

## 7. Technical Architecture

### 7.1 Event Ingestion: Tinybird (Managed ClickHouse)

**Why not Supabase (PostgreSQL) for events?**

Quotd's Supabase instance handles OLTP workloads (interviews, messages, teams, auth). Adding high-volume analytics events to the same database creates:
- Write amplification on indexes (every INSERT updates multiple B-tree indexes)
- Table bloat requiring frequent VACUUM
- Lock contention during analytical queries (aggregations) blocking transactional queries
- Cost scaling: PostgreSQL row storage is ~10x less efficient than columnar for analytics

At 1,000 proof views/day with ~10 events per view session = 10,000 events/day. That is fine for PostgreSQL. But at 10,000 views/day (growth target), that is 100,000 events/day, 3M/month, 36M/year. PostgreSQL analytics queries on 36M rows will be slow and expensive.

**Why Tinybird specifically:**

| Factor | Tinybird | Self-hosted ClickHouse | Supabase (Postgres) |
|--------|---------|----------------------|---------------------|
| Setup time | 30 minutes | 2-4 days | Already exists |
| Maintenance | Zero (managed) | Significant | Managed |
| Ingestion API | Built-in HTTP Events API | Custom | Custom |
| Query speed on 10M+ rows | Sub-second | Sub-second | 5-30 seconds |
| Free tier | 10 GB, 1000 req/day | None | Included |
| Cost at scale | ~$99/mo (Developer plan) | $200-500/mo (compute) | Included but slow |
| Next.js integration | HTTP API, fetch-compatible | HTTP API | Supabase SDK |

**Tinybird data sources (tables):**

```sql
-- Tinybird Data Source: proof_events
-- Ingested via HTTP POST to /v0/events?name=proof_events

SCHEMA >
  event_type String,
  proof_asset_id String,
  tracking_ref String,
  session_id String,
  properties String,            -- JSON string
  user_agent String,
  referrer String,
  url String,
  screen_width UInt16,
  ip_hash String,               -- SHA-256 of IP + daily salt
  country_code String,
  timestamp DateTime64(3),
  received_at DateTime DEFAULT now()

ENGINE MergeTree
ORDER BY (proof_asset_id, tracking_ref, timestamp)
PARTITION BY toYYYYMM(timestamp)
TTL timestamp + INTERVAL 1 YEAR
```

**Tinybird pipes (API endpoints):**

```sql
-- Pipe: proof_asset_summary
-- Endpoint: GET /v0/pipes/proof_asset_summary.json?proof_asset_id=xxx

SELECT
  proof_asset_id,
  count() as total_events,
  countIf(event_type = 'proof.opened') as total_opens,
  uniq(tracking_ref) as unique_viewers,
  uniq(session_id) as unique_sessions,
  avg(JSONExtractFloat(properties, 'engaged_time_ms')) / 1000 as avg_engaged_seconds,
  max(JSONExtractFloat(properties, 'max_scroll_depth')) as max_scroll_depth,
  quantile(0.5)(JSONExtractFloat(properties, 'max_scroll_depth')) as median_scroll_depth
FROM proof_events
WHERE proof_asset_id = {{String(proof_asset_id, '')}}
  AND event_type IN ('proof.opened', 'proof.time_on_page')
GROUP BY proof_asset_id

-- Pipe: proof_viewer_detail
-- Endpoint: GET /v0/pipes/proof_viewer_detail.json?proof_asset_id=xxx

SELECT
  tracking_ref,
  min(timestamp) as first_viewed,
  max(timestamp) as last_viewed,
  count() as total_events,
  countIf(event_type = 'proof.opened') as opens,
  max(JSONExtractFloat(properties, 'engaged_time_ms')) / 1000 as engaged_seconds,
  max(JSONExtractFloat(properties, 'max_scroll_depth')) as max_scroll_depth,
  countIf(event_type = 'proof.download') as downloads,
  countIf(event_type = 'proof.cta_click') as cta_clicks,
  groupArrayIf(JSONExtractString(properties, 'section_id'), event_type = 'proof.section_view') as sections_viewed
FROM proof_events
WHERE proof_asset_id = {{String(proof_asset_id, '')}}
GROUP BY tracking_ref
ORDER BY last_viewed DESC

-- Pipe: proof_engagement_trends
-- Endpoint: GET /v0/pipes/proof_engagement_trends.json?team_id=xxx&period=30d

SELECT
  toDate(timestamp) as date,
  count() as events,
  countIf(event_type = 'proof.opened') as opens,
  uniq(tracking_ref) as unique_viewers,
  countIf(event_type = 'proof.download') as downloads,
  countIf(event_type = 'proof.cta_click') as cta_clicks
FROM proof_events
WHERE proof_asset_id IN (
  SELECT id FROM proof_assets WHERE team_id = {{String(team_id, '')}}
)
AND timestamp >= now() - INTERVAL {{Int32(days, 30)}} DAY
GROUP BY date
ORDER BY date
```

### 7.2 Ingestion API Route

```
POST /api/proof/track

Body: {
  events: ProofEvent[],
  metadata: { user_agent, referrer, url, screen_width }
}
```

This Next.js API route:
1. Validates the payload (schema check, rate limit by IP)
2. Enriches with server-side data (geo from Vercel headers `x-vercel-ip-country`, hashed IP)
3. Forwards to Tinybird Events API (`POST https://api.tinybird.co/v0/events?name=proof_events`)
4. Returns 202 Accepted (non-blocking)

The route itself is stateless and fast. Tinybird handles all persistence and aggregation.

**Rate limiting:** 100 requests/10 seconds per IP (using the existing `rate-limit.ts` pattern in the codebase). This prevents abuse while allowing legitimate high-frequency tracking.

### 7.3 Data Flow Architecture

```
                                    ┌─────────────────┐
                                    │   Proof Page     │
                                    │   (React)        │
                                    │                  │
                                    │  ProofTracker    │
                                    │  - scroll        │
                                    │  - time          │
                                    │  - clicks        │
                                    └────────┬─────────┘
                                             │
                                    POST /api/proof/track
                                             │
                                    ┌────────▼─────────┐
                                    │  Next.js Route   │
                                    │  (validate,      │
                                    │   enrich, forward)│
                                    └────────┬─────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              │              │              │
                    ┌─────────▼────┐  ┌──────▼───────┐  ┌──▼──────────┐
                    │   Tinybird   │  │   Inngest    │  │  Supabase   │
                    │   (events)   │  │   (CRM sync) │  │  (proof_    │
                    │              │  │              │  │   links,    │
                    │  proof_events│  │  sf.sync     │  │   assets)   │
                    │  table       │  │  hs.sync     │  │             │
                    └──────┬───────┘  └──────┬───────┘  └──────┬──────┘
                           │                 │                 │
                    Tinybird Pipes    Salesforce/HubSpot  proof_attribution
                    (real-time        API calls           (daily rollup)
                     aggregation)
                           │                 │                 │
                    ┌──────▼─────────────────▼─────────────────▼──────┐
                    │                   Dashboard                     │
                    │   /dashboard/proof                               │
                    │   - Pipeline influenced (Supabase)              │
                    │   - Engagement trends (Tinybird API)            │
                    │   - Viewer detail (Tinybird + Supabase join)    │
                    │   - Attribution table (Supabase)                │
                    └─────────────────────────────────────────────────┘
```

### 7.4 Proof Page Rendering

The proof page (`/proof/[slug]`) is a **new public route** (no auth required, similar to `/i/[token]`):

```
/proof/[slug]/page.tsx

1. Look up proof_asset by slug
2. If ?ref= param exists, look up proof_link by tracking_ref
3. Render the case study content with:
   - Branding from the creator's profile/client
   - Section markers (data-proof-section attributes)
   - ProofTracker client component
   - Optional consent banner (if EU detected)
4. Middleware: no auth redirect for /proof/* routes
```

### 7.5 Background Job Architecture (Inngest)

Inngest is the recommended event queue because:
- First-class Vercel integration (functions deploy as API routes)
- Step functions for multi-step CRM sync (retry individual steps)
- Built-in scheduling (replaces custom cron for attribution calculation)
- Already used in Quotd's conceptual architecture (see memory notes on Skrypt)

**Functions to create:**

| Function | Trigger | Description |
|----------|---------|-------------|
| `proof/sync-to-crm` | `proof.opened` event (with engagement threshold) | Create/update Task + Custom Object in Salesforce/HubSpot |
| `proof/calculate-attribution` | Cron: daily 2 AM UTC | Rebuild proof_attribution table |
| `proof/sync-deals-from-crm` | Cron: every 6 hours | Pull deal stage/amount updates from CRM |
| `proof/aggregate-daily` | Cron: daily 3 AM UTC | Query Tinybird for daily aggregates, store in Supabase for dashboard |
| `proof/alert-high-engagement` | `proof.engaged` event (score > 80) | Notify sales rep via email/webhook that a prospect is deeply engaged |

### 7.6 Scale Considerations

**Current:** 0 proof views/day (feature does not exist).
**Year 1 target:** 1,000-5,000 views/day.
**Year 2 target:** 10,000-50,000 views/day.

| Component | Year 1 Load | Year 2 Load | Bottleneck? |
|-----------|------------|------------|-------------|
| Tinybird ingestion | 10K-50K events/day | 100K-500K events/day | No. Free tier handles 10K. Developer plan handles 1M+. |
| Supabase (proof_links, attribution) | ~5K rows/day writes | ~50K rows/day | No. Well within Postgres capability. |
| Inngest CRM sync | ~1K jobs/day | ~10K jobs/day | No. Free tier: 50K runs/month. |
| Salesforce API | ~2K calls/day | ~20K calls/day | Maybe. Enterprise: 100K/day limit. Batch aggressively. |
| HubSpot API | ~2K calls/day | ~20K calls/day | No. 500K/day limit. |
| Vercel API routes | ~5K req/day (tracking) | ~50K req/day | No. Pro plan: 1M serverless function invocations/month. |

**Cost projection:**

| Component | Year 1/month | Year 2/month | Notes |
|-----------|-------------|-------------|-------|
| Tinybird | $0 (free tier) | $99 (Developer) | 10GB free, then $0.07/GB |
| Inngest | $0 (free tier) | $25 (Basic) | 50K runs free, then $0.001/run |
| Clearbit Reveal | $0 (Phase 3) | $99 | Optional, 10K lookups/mo |
| Supabase | $0 (existing) | $0 (existing) | Additional tables, minimal impact |
| Vercel | $0 (existing) | $0 (existing) | Within existing Pro plan |
| **Total incremental** | **$0/mo** | **$223/mo** | |

---

## 8. Recommended Stack Summary

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **Event ingestion** | Tinybird (managed ClickHouse) | Purpose-built for high-volume event analytics. Free tier for launch. Sub-second queries on millions of rows. HTTP API compatible with Vercel serverless. |
| **Event transport** | Direct HTTP POST from client -> Next.js route -> Tinybird Events API | Simplest possible path. No Kafka/Redis needed at this scale. Beacon API for reliability. |
| **Background jobs** | Inngest | Event-driven step functions. First-class Vercel integration. Built-in retry, scheduling, observability. Handles CRM sync complexity. |
| **CRM sync** | Custom Salesforce/HubSpot clients via Inngest functions | OAuth 2.0 token management. Composite/Bulk API for Salesforce batching. Timeline Events API for HubSpot. |
| **Attribution storage** | Supabase (PostgreSQL) | Low-volume aggregated data. Joins with existing tables (teams, interviews, proof_assets). Row-level security for multi-tenancy. |
| **Client tracking** | Custom ProofTracker (TypeScript) | Lightweight (~3KB gzipped). No third-party dependencies. Intersection Observer + Beacon API. |
| **Charts** | Recharts | React-native. Composable. Lightweight. Matches shadcn/Tailwind patterns. |
| **Visitor identification** | Tracking ref (primary) + Clearbit Reveal (Phase 3) | Tracking ref covers the primary use case. Clearbit adds company-level identification for unknown visitors. |
| **Privacy** | First-party only, consent banner for EU, IP hashing | GDPR/CCPA compliant. No third-party cookies. Data minimization by design. |

---

## 9. Database Schema — Complete

### New Supabase Tables

```sql
-- ============================================================
-- Migration: add_proof_analytics
-- ============================================================

-- 1. Proof assets (publishable content)
CREATE TABLE proof_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'full',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(slug, format)
);

CREATE INDEX idx_proof_assets_interview ON proof_assets(interview_id);
CREATE INDEX idx_proof_assets_team ON proof_assets(team_id);
CREATE INDEX idx_proof_assets_slug ON proof_assets(slug);

ALTER TABLE proof_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own proof assets"
  ON proof_assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Team members can view team proof assets"
  ON proof_assets FOR SELECT USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can insert own proof assets"
  ON proof_assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own proof assets"
  ON proof_assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view published proof assets"
  ON proof_assets FOR SELECT USING (published = true);

-- 2. Trackable links
CREATE TABLE proof_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proof_asset_id UUID REFERENCES proof_assets(id) ON DELETE CASCADE,
  tracking_ref TEXT NOT NULL UNIQUE,
  recipient_email TEXT,
  recipient_name TEXT,
  company_name TEXT,
  deal_id TEXT,
  deal_name TEXT,
  deal_amount DECIMAL(12,2),
  deal_stage TEXT,
  contact_id TEXT,
  crm_type TEXT CHECK (crm_type IN ('salesforce', 'hubspot')),
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_by UUID REFERENCES auth.users(id),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  first_opened_at TIMESTAMPTZ,
  total_opens INTEGER DEFAULT 0,
  last_opened_at TIMESTAMPTZ,
  engagement_score DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_proof_links_tracking_ref ON proof_links(tracking_ref);
CREATE INDEX idx_proof_links_proof_asset ON proof_links(proof_asset_id);
CREATE INDEX idx_proof_links_deal ON proof_links(deal_id);
CREATE INDEX idx_proof_links_team ON proof_links(team_id);
CREATE INDEX idx_proof_links_created_by ON proof_links(created_by);

ALTER TABLE proof_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators can view own proof links"
  ON proof_links FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Team members can view team proof links"
  ON proof_links FOR SELECT USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can insert proof links"
  ON proof_links FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own proof links"
  ON proof_links FOR UPDATE USING (auth.uid() = created_by);

-- 3. CRM connections
CREATE TABLE crm_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  crm_type TEXT NOT NULL CHECK (crm_type IN ('salesforce', 'hubspot')),
  instance_url TEXT,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  connected_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'error', 'revoked')),
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, crm_type)
);

ALTER TABLE crm_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can view CRM connections"
  ON crm_connections FOR SELECT USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );
-- Insert/update/delete restricted to team owners via service role

-- 4. Attribution (aggregated, computed daily)
CREATE TABLE proof_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  proof_asset_id UUID REFERENCES proof_assets(id) ON DELETE CASCADE,
  proof_link_id UUID REFERENCES proof_links(id) ON DELETE SET NULL,
  deal_id TEXT NOT NULL,
  deal_name TEXT,
  deal_amount DECIMAL(12,2),
  deal_stage TEXT,
  deal_close_date DATE,
  deal_is_won BOOLEAN,
  crm_type TEXT,
  attribution_model TEXT DEFAULT 'binary',
  attributed_amount DECIMAL(12,2),
  total_views INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  total_engaged_time_seconds INTEGER DEFAULT 0,
  max_engagement_score DECIMAL(5,2) DEFAULT 0,
  first_view_at TIMESTAMPTZ,
  last_view_at TIMESTAMPTZ,
  contacts JSONB DEFAULT '[]',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(proof_asset_id, deal_id, attribution_model)
);

CREATE INDEX idx_attribution_team ON proof_attribution(team_id);
CREATE INDEX idx_attribution_deal ON proof_attribution(deal_id);
CREATE INDEX idx_attribution_close_date ON proof_attribution(deal_close_date);

ALTER TABLE proof_attribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can view attribution"
  ON proof_attribution FOR SELECT USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- 5. Daily aggregates (computed from Tinybird, cached in Supabase for dashboard)
CREATE TABLE proof_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  proof_asset_id UUID REFERENCES proof_assets(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_opens INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  avg_engaged_seconds DECIMAL(8,2) DEFAULT 0,
  avg_scroll_depth DECIMAL(5,2) DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  cta_clicks INTEGER DEFAULT 0,
  pql_count INTEGER DEFAULT 0,           -- viewers with score > 60
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(proof_asset_id, date)
);

CREATE INDEX idx_daily_stats_team_date ON proof_daily_stats(team_id, date);

ALTER TABLE proof_daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can view daily stats"
  ON proof_daily_stats FOR SELECT USING (
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
  );

-- 6. Consent tracking (GDPR compliance)
CREATE TABLE proof_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_ref TEXT REFERENCES proof_links(tracking_ref) ON DELETE CASCADE,
  consent_given BOOLEAN DEFAULT false,
  consent_scope TEXT[] DEFAULT '{}',     -- ['essential', 'engagement', 'identification']
  ip_hash TEXT,
  user_agent TEXT,
  consented_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### New Tinybird Data Sources

```
proof_events (ClickHouse, MergeTree)
  - event_type: String
  - proof_asset_id: String
  - tracking_ref: String
  - session_id: String
  - properties: String (JSON)
  - user_agent: String
  - referrer: String
  - url: String
  - screen_width: UInt16
  - ip_hash: String
  - country_code: String
  - timestamp: DateTime64(3)
  - received_at: DateTime
```

---

## 10. API Design

### New API Routes

```
-- Public (no auth)
POST  /api/proof/track                    -- Event ingestion (from client tracker)
GET   /proof/[slug]                       -- Render proof page (new page route)

-- Authenticated (dashboard)
GET   /api/proof/assets                   -- List team's proof assets
POST  /api/proof/assets                   -- Create proof asset from interview
PUT   /api/proof/assets/[id]              -- Update proof asset
POST  /api/proof/assets/[id]/publish      -- Publish proof asset
DELETE /api/proof/assets/[id]             -- Delete proof asset

GET   /api/proof/links                    -- List proof links for an asset
POST  /api/proof/links                    -- Create trackable link
DELETE /api/proof/links/[id]              -- Revoke a link

GET   /api/proof/analytics                -- Dashboard analytics (pipeline, trends)
GET   /api/proof/analytics/[assetId]      -- Per-asset analytics
GET   /api/proof/analytics/viewers        -- Viewer list with engagement
GET   /api/proof/attribution              -- Attribution table

-- CRM Integration
GET   /api/integrations/salesforce/connect     -- OAuth redirect
GET   /api/integrations/salesforce/callback    -- OAuth callback
POST  /api/integrations/salesforce/disconnect  -- Revoke connection
GET   /api/integrations/hubspot/connect
GET   /api/integrations/hubspot/callback
POST  /api/integrations/hubspot/disconnect
GET   /api/integrations/status                 -- Connection status

-- Inngest webhook receiver
POST  /api/inngest                        -- Inngest function handler

-- Webhook events (extend existing)
-- New events: proof.opened, proof.engaged, proof.downloaded, attribution.calculated
```

---

## 11. Implementation Phases

### Phase 1: Foundation (2-3 weeks)

**Goal:** Trackable links + basic engagement tracking + proof dashboard

- [ ] Database migration: `proof_assets`, `proof_links` tables
- [ ] `/proof/[slug]` public page route (renders case study)
- [ ] "Publish as Proof" button on interview detail page
- [ ] "Create Trackable Link" modal (recipient email, name, optional deal info)
- [ ] ProofTracker client component (opens, scroll, time, sections)
- [ ] `POST /api/proof/track` ingestion route -> Tinybird
- [ ] Tinybird data source + 3 core pipes (summary, viewers, trends)
- [ ] `/dashboard/proof` overview page with Recharts
- [ ] Install `recharts` dependency
- [ ] Extend webhook events: `proof.opened`, `proof.engaged`

### Phase 2: CRM Integration (2-3 weeks)

**Goal:** Salesforce + HubSpot OAuth + bidirectional sync

- [ ] Database migration: `crm_connections` table
- [ ] Salesforce OAuth flow (connect/callback/disconnect)
- [ ] HubSpot OAuth flow (connect/callback/disconnect)
- [ ] Inngest setup: `/api/inngest` handler route
- [ ] `proof/sync-to-crm` Inngest function (Task + Custom Object creation)
- [ ] CRM settings page in dashboard (`/dashboard/settings/integrations`)
- [ ] Token encryption (AES-256-GCM with env var key)
- [ ] CRM -> Quotd deal sync (polling, 6-hour interval)
- [ ] Contact matching logic (tracking_ref primary, email fallback)

### Phase 3: Attribution Engine (1-2 weeks)

**Goal:** Pipeline influence + revenue attribution dashboard

- [ ] Database migration: `proof_attribution`, `proof_daily_stats` tables
- [ ] Attribution calculation Inngest cron job (daily)
- [ ] Support for binary, first-touch, last-touch, linear models
- [ ] `/dashboard/proof/attribution` page
- [ ] Pipeline influence cards on main proof dashboard
- [ ] Per-asset "Deals Influenced" section
- [ ] Per-rep reporting view

### Phase 4: Advanced Features (2-3 weeks)

**Goal:** High-engagement alerts, PQLs, Clearbit, polish

- [ ] PQL (Proof Qualified Lead) scoring and alerting
- [ ] Real-time "prospect is viewing right now" notification (via Inngest + email/webhook)
- [ ] Clearbit Reveal integration for unknown visitor company identification
- [ ] Section engagement heatmap visualization
- [ ] Consent management (EU banner, consent table, scope-gated tracking)
- [ ] Link expiry enforcement
- [ ] Forward detection (heuristic: new session on same proof_link from different IP)
- [ ] API v1 endpoints for proof analytics (extend existing REST API)

### Phase 5: Scale & Polish (1-2 weeks)

**Goal:** Performance, edge cases, documentation

- [ ] Tinybird materialized views for hot queries
- [ ] Supabase query optimization (partial indexes, materialized views)
- [ ] Rate limiting hardening on /api/proof/track
- [ ] Dashboard loading states, error boundaries, empty states
- [ ] E2E tests (Playwright) for proof viewing + tracking flow
- [ ] CRM sync error handling and retry UI
- [ ] Privacy policy updates and consent flow testing
- [ ] Webhook delivery for attribution events

---

## 12. Open Questions

1. **Proof page hosting:** Should proof pages live on the main app domain (`app.quotd.io/proof/...`) or a separate domain (`proof.quotd.io/...`)? Separate domain allows for CDN-only hosting and isolates analytics traffic from the app.

2. **White-label proof pages:** Should proof pages be brandable with the creator's domain? E.g., `proof.acme.com/case-study`. This would require CNAME/custom domain support.

3. **Real-time "viewing now" notifications:** How aggressive should these be? A Slack/email notification every time a prospect opens a proof page could be noisy. Consider: only notify on first open per deal, or only when engagement score exceeds threshold.

4. **Multi-format proof pages:** A single interview produces multiple formats (full case study, one-pager, quote cards). Should each format be a separate proof asset with its own URL, or should the proof page show format tabs?

5. **Offline/PDF tracking:** When a prospect downloads a PDF, tracking stops. Should we embed a tracking pixel in the PDF? (Technically possible with an `<img>` tag that pings the server when the PDF is opened in a reader that loads images.)

6. **Pricing tier:** Proof Analytics is a premium feature. Which plan does it gate to? The engagement tracking could be free (drives adoption), while CRM integration + attribution is paid.

---

## 13. References

**Wistia Analytics & Integration:**
- [Wistia Product Analytics](https://wistia.com/product/analytics) — Engagement graphs, heatmaps, attention spans
- [Wistia + Salesforce Integration](https://wistia.com/integrations/salesforce) — CampaignMember, multi-touch attribution, VQL
- [Tracking Average User Engagement](https://support.wistia.com/en/articles/8228871-tracking-average-user-engagement)

**Vidyard Analytics & Integration:**
- [Vidyard Salesforce Sales Cloud Integration](https://www.vidyard.com/integrations/sales-cloud/) — Video views related list, pipeline ROI
- [Vidyard for Salesforce Setup](https://knowledge.vidyard.com/hc/en-us/articles/360009995913)

**Salesforce API:**
- [Salesforce REST API Guide (v66.0, Spring '26)](https://resources.docs.salesforce.com/latest/latest/en-us/sfdc/pdf/api_rest.pdf)
- [API Limits and Monitoring](https://developer.salesforce.com/blogs/2024/11/api-limits-and-monitoring-your-api-usage)

**HubSpot API:**
- [CRM API Timeline Events](https://developers.hubspot.com/docs/api/crm/timeline)
- [Custom Events (March 2026)](https://knowledge.hubspot.com/reports/create-custom-events)

**Privacy & Compliance:**
- [GDPR vs CCPA Compliance 2026](https://usercentrics.com/knowledge-hub/gdpr-vs-ccpa-compliance/)
- [Cookie Consent Management 2026 Guide](https://www.cookiehub.com/blog/cookie-consent-management-guide-2026)
- [B2B Data Compliance Checklist 2026](https://www.sparkdbi.com/blogs/gdpr-hipaa-can-spam-b2b-data-compliance-checklist-2026)

**Attribution:**
- [Multi-Touch Attribution 2026 Guide (Improvado)](https://improvado.io/blog/multi-touch-attribution)
- [First-Touch vs Multi-Touch Attribution 2026 (Heeet)](https://www.heeet.io/blog/first-touch-or-multi-touch-attribution-which-model-fits-your-b2b-marketing-in-2026)

**Analytics Infrastructure:**
- [Tinybird Pricing](https://www.tinybird.co/pricing) — Free tier: 10GB, 1000 req/day
- [Can I Use Supabase for Analytics?](https://www.tinybird.co/blog/can-i-use-supabase-for-user-facing-analytics)
- [Tinybird Events API Reference](https://www.tinybird.co/docs/api-reference/events-api)

**Event Queuing:**
- [Inngest + Vercel Integration](https://www.inngest.com/blog/vercel-integration)
- [QStash Alternatives 2026](https://www.buildmvpfast.com/alternatives/qstash)

**Visitor Identification:**
- [Clearbit Reveal IP Intelligence](https://clearbit.com/blog/ip-intelligence-for-remote-work)
- [B2B Website Visitor Identification 2026](https://salesmotion.io/blog/identify-website-visitors)

**Beacon API:**
- [MDN Beacon API Reference](https://developer.mozilla.org/en-US/docs/Web/API/Beacon_API)

**Charting:**
- [Nivo vs Recharts Comparison (Speakeasy)](https://www.speakeasy.com/blog/nivo-vs-recharts)
- [shadcn/ui Chart Discussion](https://github.com/shadcn-ui/ui/discussions/4133)
