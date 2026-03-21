# Smart Proof Matching — Technical Research & Architecture Plan

**Author:** Staff Engineer (Wistia background — content recommendation, CRM widgets, Slack integrations)
**Date:** 2026-03-20
**Feature:** Tier 3A from Quotd product plan — Sales Enablement Integration
**Status:** RESEARCH COMPLETE — ready for implementation planning

---

## Executive Summary

Smart Proof Matching turns Quotd's library of completed case studies into a sales weapon. When a rep is working a deal, the system auto-surfaces the 3 most relevant case studies based on the prospect's industry, company size, use case, and deal stage. Delivered through three channels: CRM sidebar widget (Salesforce + HubSpot), Slack bot, and branded deal rooms.

This document covers: matching algorithm design, CRM integration architecture, Slack bot implementation, deal room UX, schema changes, and build estimates.

---

## Table of Contents

1. [Current Architecture Review](#1-current-architecture-review)
2. [Matching & Ranking Algorithm](#2-matching--ranking-algorithm)
3. [Schema Changes](#3-schema-changes)
4. [CRM Sidebar Widgets](#4-crm-sidebar-widgets)
5. [Slack Bot](#5-slack-bot)
6. [Deal Rooms](#6-deal-rooms)
7. [API Surface](#7-api-surface)
8. [Build Plan & Effort Estimates](#8-build-plan--effort-estimates)

---

## 1. Current Architecture Review

### What Exists

Quotd already captures rich structured data during every interview that is directly usable for matching:

**Interview table** (`interviews`):
- `customer_company` — company name (text)
- `product_name` — product being discussed (text)
- `category` — defaults to "Time Savings" (text)
- `extraction_state` — JSONB containing:
  - `metrics[]` — `{name, baseline, after, delta, unit, timeframe, confidence}`
  - `quotes[]` — `{text, tag}` where tag is `impact|challenge|praise|outcome|transformation`
  - `facts` — `{challenge, solution, impact}` (free-text summaries)
- `interview_tone` — `formal|conversational|technical`
- `interview_focus` — `balanced|roi|technical|storytelling`
- `target_audience` — `general|c_suite|technical_buyer|end_user|board`
- `draft_content` — full markdown case study
- `generated_formats` — JSONB with `one_pager`, `linkedin`, `twitter`, `sales_slide`, `quote_cards`, `email_blurb`
- `customer_email`, `linkedin_profile_url`, `company_website_url` — context URLs
- `client_id` — links to agency client workspace

**Clients table** (`clients`):
- `name`, `team_id`, `logo_url`, `primary_color`, `welcome_message`

**Teams/API infrastructure:**
- API key auth (`api_keys` table, `withApiAuth` middleware)
- Webhook system with event dispatch (`interview.created`, `interview.completed`, `review.completed`, `draft.generated`, etc.)
- MCP server with tool registration (already has `list_interviews`, `get_interview`, `get_draft`, `get_messages`, `get_analytics`, `generate_format`, `export_draft`)
- V1 REST API with pagination, status filtering

### What's Missing for Matching

1. **No structured metadata** — industry, company size, use case, pain points, and product category are not stored as queryable fields. They exist only as unstructured text inside `extraction_state.facts` and `draft_content`.
2. **No embeddings** — no vector column, no pgvector extension enabled, no embedding generation pipeline.
3. **No CRM integration** — no OAuth flows, no connected app registrations, no sidebar widget code.
4. **No Slack bot** — no Bolt SDK integration, no slash command handlers.
5. **No deal room concept** — no prospect-facing curated proof page.

---

## 2. Matching & Ranking Algorithm

### Recommendation: Hybrid Approach (Metadata Filters + Semantic Reranking)

Pure metadata matching is brittle (requires perfect tagging). Pure semantic search is noisy at small corpus sizes. The hybrid approach combines the precision of metadata filters with the recall of semantic similarity.

### 2.1 Attribute Extraction Pipeline

When a case study reaches `review_complete` status (or `draft_content` is generated), run an extraction job that produces structured matching attributes from existing interview data.

**Input sources:**
- `extraction_state.facts.challenge` — maps to pain point / use case
- `extraction_state.facts.solution` — maps to product capabilities
- `extraction_state.facts.impact` — maps to outcomes
- `extraction_state.metrics[]` — maps to quantified results
- `extraction_state.quotes[].tag` — signals what type of proof this is
- `customer_company` — can be enriched to get industry + company size
- `company_website_url` — enrichment source for industry classification
- `draft_content` — full text for embedding generation
- `interview_focus` / `target_audience` — signals what type of buyer this resonates with

**Extraction prompt (Claude Sonnet 4):**

```
Given this case study data, extract structured matching attributes:

Company: {{customer_company}}
Website: {{company_website_url}}
Draft: {{draft_content}}
Extraction: {{extraction_state}}

Return:
{
  "industry": "one of: fintech, healthtech, edtech, ecommerce, saas, martech, ...",
  "company_size_bucket": "one of: startup_1_50, smb_51_200, mid_market_201_1000, enterprise_1001_plus",
  "use_cases": ["churn_reduction", "revenue_growth", "cost_savings", ...],
  "pain_points": ["manual_processes", "data_silos", "scaling_challenges", ...],
  "product_capabilities": ["automation", "analytics", "integration", ...],
  "deal_stages_relevant_to": ["discovery", "evaluation", "negotiation", "close"],
  "buyer_personas": ["cto", "cmo", "vp_sales", "ic_engineer", ...],
  "headline_metric": "40% reduction in churn",
  "strength_tags": ["strong_roi", "technical_depth", "executive_quote", "before_after"]
}
```

This runs once per case study at completion time and stores the result in a new `proof_attributes` JSONB column. Re-run on draft edits.

### 2.2 Embedding Generation

**Model recommendation: OpenAI `text-embedding-3-small`**

| Model | Dimensions | Cost/MTok | Context | Why/Why Not |
|---|---|---|---|---|
| OpenAI `text-embedding-3-small` | 1536 | $0.02 | 8K | Best cost/quality ratio for <1M docs. Already using AI SDK. |
| OpenAI `text-embedding-3-large` | 3072 | $0.13 | 8K | Overkill for case study corpus size |
| Voyage `voyage-3` | 1024 | $0.06 | 32K | Better retrieval quality, 3x cost. Worth it at scale. |
| Cohere `embed-v4.0` | 1024 | $0.12 | 512 | Short context window is limiting |

**Recommendation:** Start with `text-embedding-3-small` at $0.02/MTok. A corpus of 1,000 case studies (~500 words each) costs ~$0.01 to embed. Switch to Voyage `voyage-3` if retrieval quality becomes an issue at scale.

**What gets embedded:**

Concatenate into a single embedding input per case study:
```
Industry: {industry}
Company Size: {company_size_bucket}
Use Cases: {use_cases.join(", ")}
Pain Points: {pain_points.join(", ")}
Challenge: {facts.challenge}
Solution: {facts.solution}
Impact: {facts.impact}
Key Metric: {headline_metric}
Draft Summary: {first 500 words of draft_content}
```

This structured embedding text ensures the vector captures both metadata semantics and content meaning.

### 2.3 Vector Storage: Supabase pgvector

**Recommendation: Use Supabase pgvector. Do NOT add Pinecone or Weaviate.**

Rationale:
- Quotd's corpus will be <100K case studies for years. pgvector handles this easily (benchmarks show 471 QPS at 99% recall on 50M vectors with pgvectorscale).
- Data stays in the same Postgres database — no sync pipeline, no additional vendor, no network hops.
- Supabase has first-class pgvector support with HNSW indexing.
- Cost: $0/month additional (already paying for Supabase).
- Pinecone only makes sense at >10M vectors or when you need sub-10ms P99 latency on dedicated infrastructure. Neither applies here.

**Setup:**

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to interviews
ALTER TABLE interviews ADD COLUMN embedding vector(1536);

-- HNSW index for fast similarity search
CREATE INDEX idx_interviews_embedding ON interviews
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### 2.4 Hybrid Search Function

The matching query combines metadata filters (hard constraints) with semantic similarity (soft ranking).

```sql
CREATE OR REPLACE FUNCTION match_proof(
  query_embedding vector(1536),
  filter_industry text DEFAULT NULL,
  filter_company_size text DEFAULT NULL,
  filter_use_cases text[] DEFAULT NULL,
  filter_team_id uuid DEFAULT NULL,
  match_count int DEFAULT 3,
  similarity_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  id uuid,
  customer_company text,
  product_name text,
  proof_attributes jsonb,
  draft_content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.customer_company,
    i.product_name,
    i.proof_attributes,
    i.draft_content,
    1 - (i.embedding <=> query_embedding) AS similarity
  FROM interviews i
  WHERE i.status = 'review_complete'
    AND i.embedding IS NOT NULL
    AND i.proof_published = true
    AND (filter_team_id IS NULL OR i.team_id = filter_team_id)
    AND (filter_industry IS NULL OR i.proof_attributes->>'industry' = filter_industry)
    AND (filter_company_size IS NULL OR i.proof_attributes->>'company_size_bucket' = filter_company_size)
    AND (filter_use_cases IS NULL OR i.proof_attributes->'use_cases' ?| filter_use_cases)
    AND 1 - (i.embedding <=> query_embedding) > similarity_threshold
  ORDER BY 1 - (i.embedding <=> query_embedding) DESC
  LIMIT match_count;
END;
$$;
```

### 2.5 Match Request Flow

```
1. Caller provides deal context (free text, or structured fields from CRM)
   e.g., "200-person fintech struggling with churn, Series B, evaluating analytics tools"

2. Generate embedding from deal context text using text-embedding-3-small

3. Extract metadata filters from deal context using Claude:
   { industry: "fintech", company_size: "smb_51_200", use_cases: ["churn_reduction"] }

4. Call match_proof() RPC with embedding + metadata filters

5. Return top 3 matches with:
   - Case study title (headline from draft)
   - Company name + industry + size
   - Headline metric
   - Best quote
   - Relevance score
   - Link to full case study / deal room
```

### 2.6 Scoring Breakdown

Final score = `(0.6 * semantic_similarity) + (0.25 * metadata_overlap) + (0.15 * recency_boost)`

- **Semantic similarity (60%):** cosine distance from pgvector
- **Metadata overlap (25%):** count of matching attributes (industry, size, use case, persona) / total possible matches
- **Recency boost (15%):** exponential decay — case studies from last 6 months get full boost, decaying to 0 at 24 months

This can be computed in application code after the pgvector query returns candidates (fetch top 10 from pgvector, rerank in Node.js, return top 3).

---

## 3. Schema Changes

### New Columns on `interviews`

```sql
-- Structured matching attributes (extracted by AI at draft generation)
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS proof_attributes JSONB DEFAULT NULL;

-- Vector embedding of case study content
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Whether this case study is "published" / available for matching
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS proof_published BOOLEAN DEFAULT false;
```

### New Tables

```sql
-- Deal rooms: curated proof pages per prospect
CREATE TABLE deal_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  prospect_name TEXT NOT NULL,
  prospect_company TEXT NOT NULL,
  prospect_industry TEXT,
  prospect_company_size TEXT,
  slug TEXT NOT NULL UNIQUE,
  branding JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Junction: which case studies are in which deal room
CREATE TABLE deal_room_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_room_id UUID NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  custom_headline TEXT,
  custom_blurb TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(deal_room_id, interview_id)
);

-- Analytics: track deal room views
CREATE TABLE deal_room_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_room_id UUID NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
  viewer_ip TEXT,
  viewer_email TEXT,
  user_agent TEXT,
  viewed_at TIMESTAMPTZ DEFAULT now()
);

-- Analytics: track individual proof views within a deal room
CREATE TABLE deal_room_item_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_room_item_id UUID NOT NULL REFERENCES deal_room_items(id) ON DELETE CASCADE,
  deal_room_id UUID NOT NULL REFERENCES deal_rooms(id) ON DELETE CASCADE,
  time_spent_seconds INTEGER,
  viewed_at TIMESTAMPTZ DEFAULT now()
);

-- CRM connections (OAuth tokens for Salesforce/HubSpot)
CREATE TABLE crm_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('salesforce', 'hubspot')),
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  instance_url TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  connected_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, provider)
);

-- Slack workspace connections
CREATE TABLE slack_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  slack_team_id TEXT NOT NULL,
  slack_team_name TEXT,
  bot_token_encrypted TEXT NOT NULL,
  connected_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, slack_team_id)
);

-- Indexes
CREATE INDEX idx_deal_rooms_team_id ON deal_rooms(team_id);
CREATE INDEX idx_deal_rooms_slug ON deal_rooms(slug);
CREATE INDEX idx_deal_room_items_room ON deal_room_items(deal_room_id);
CREATE INDEX idx_deal_room_views_room ON deal_room_views(deal_room_id);
CREATE INDEX idx_deal_room_item_views_room ON deal_room_item_views(deal_room_id);
CREATE INDEX idx_crm_connections_team ON crm_connections(team_id);
CREATE INDEX idx_slack_connections_team ON slack_connections(team_id);
CREATE INDEX idx_interviews_proof_published ON interviews(proof_published) WHERE proof_published = true;

-- RLS
ALTER TABLE deal_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_room_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_room_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_room_item_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON deal_rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON deal_room_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON deal_room_views FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON deal_room_item_views FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON crm_connections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON slack_connections FOR ALL USING (true) WITH CHECK (true);
```

---

## 4. CRM Sidebar Widgets

### 4.1 Architecture Decision: Canvas App vs. LWC vs. Connected App

| Approach | Salesforce | HubSpot | Verdict |
|---|---|---|---|
| **Canvas App (iframe)** | Embed external web app in Salesforce UI via signed request or OAuth. Full control over rendering. | N/A (HubSpot doesn't have Canvas). | Best for Salesforce — renders our Next.js app directly in the CRM sidebar with zero Salesforce-native code. |
| **Lightning Web Component** | Native Salesforce component. Requires Apex backend, SFDX packaging, ISV partner program. | N/A | Overkill. Requires maintaining Salesforce-native code. Only needed if you want to appear in AppExchange. |
| **CRM Cards (serverless)** | N/A | React-based UI extensions with serverless backend. HubSpot's recommended approach for partner integrations. | Best for HubSpot — native-feeling card in the deal/contact sidebar. |

**Recommendation:**
- **Salesforce:** Canvas App. Renders our Next.js widget as an iframe in the Opportunity/Account record page sidebar. Minimal Salesforce-side code. OAuth via JWT bearer flow for server-to-server data access.
- **HubSpot:** CRM Card (UI Extension). React component using HubSpot's UI extensions SDK. Serverless function calls our API to fetch matching proof.

### 4.2 Salesforce Integration

**Connected App setup:**
1. Create a Connected App in Salesforce with Canvas App enabled
2. Canvas App URL points to `https://app.quotd.sh/widgets/salesforce/proof`
3. Auth: Signed Request flow (Salesforce signs the request with client secret; our app verifies)
4. The widget receives the current record context (Account ID, Opportunity ID) via Canvas SDK

**Data pulled from Salesforce deal/contact/account:**
- **Account:** Industry, NumberOfEmployees, Name, Website, Description
- **Opportunity:** StageName, Amount, Type, CloseDate, Description
- **Contact:** Title, Department, Email

**Widget behavior:**
1. On load, Canvas SDK provides record context
2. Widget calls Salesforce REST API (using the access token from signed request) to fetch Account + Opportunity fields
3. Widget calls Quotd `/api/v1/proof/match` with extracted deal context
4. Renders top 3 matches as cards with: company name, headline metric, relevance score, "View Full Study" link, "Add to Deal Room" button, "Copy Link" button

**OAuth flow for Salesforce:**
- JWT Bearer Flow (server-to-server, no user interaction needed after initial setup)
- Admin authorizes the Connected App once
- Server generates JWT signed with private key, exchanges for access token
- No refresh token — re-generate JWT when access token expires (typical 2-hour TTL)
- Store encrypted access token in `crm_connections` table

**Salesforce package:**
- Ship as an unmanaged package containing: Canvas App configuration, a minimal Aura/LWC wrapper component for the App Builder, and a permission set
- Admin drags the component onto the Account or Opportunity record page in Lightning App Builder

### 4.3 HubSpot Integration

**Architecture:**

```
HubSpot CRM Card (React UI Extension)
  |-- calls HubSpot serverless function
       |-- calls Quotd API /api/v1/proof/match
            |-- returns top 3 matches
```

**CRM Card placement:** Deal record sidebar, Company record sidebar

**Data pulled from HubSpot deal/contact/company:**
- **Company:** industry, numberofemployees, name, domain, description
- **Deal:** dealstage, amount, dealname, dealtype, pipeline
- **Contact:** jobtitle, email, firstname, lastname

**Required OAuth scopes:**
- `crm.objects.companies.read`
- `crm.objects.deals.read`
- `crm.objects.contacts.read`

**UI Extension implementation:**

```jsx
// hubspot-card/src/app/extensions/ProofMatcher.jsx
import { useState, useEffect } from "react";
import {
  hubspot, Text, Link, Flex, Button, LoadingSpinner, Tag
} from "@hubspot/ui-extensions";

hubspot.extend(({ context, runServerlessFunction }) => (
  <ProofMatcher context={context} runServerless={runServerlessFunction} />
));

function ProofMatcher({ context, runServerless }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runServerless({
      name: "fetchProof",
      parameters: {
        objectId: context.crm.objectId,
        objectType: context.crm.objectType,
      },
    }).then((result) => {
      setMatches(result.response.matches);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <Flex direction="column" gap="sm">
      {matches.map((m) => (
        <Flex key={m.id} direction="column" gap="xs">
          <Text format={{ fontWeight: "bold" }}>{m.customer_company}</Text>
          <Tag>{m.industry}</Tag>
          <Text>{m.headline_metric}</Text>
          <Text variant="microcopy">
            Match: {Math.round(m.similarity * 100)}%
          </Text>
          <Link href={m.deal_room_url}>View Proof</Link>
        </Flex>
      ))}
    </Flex>
  );
}
```

**Serverless function:**

```js
// hubspot-card/src/app/extensions/fetchProof.js
const axios = require("axios");

exports.main = async (context) => {
  const { objectId, objectType } = context.parameters;

  // Fetch deal/company data from HubSpot using context
  // (HubSpot serverless functions have access to the HubSpot API client)

  // Call Quotd matching API
  const response = await axios.post(
    "https://app.quotd.sh/api/v1/proof/match",
    {
      context_text: buildContextText(properties),
      industry: properties.industry,
      company_size: sizeFromEmployees(properties.numberofemployees),
    },
    {
      headers: { Authorization: `Bearer ${process.env.QUOTD_API_KEY}` },
    }
  );

  return { matches: response.data.matches };
};
```

### 4.4 CRM Integration Settings UI

In the Quotd dashboard settings, add a CRM integrations page:
- "Connect Salesforce" button — initiates OAuth JWT Bearer setup (upload certificate or enter client credentials)
- "Connect HubSpot" button — initiates OAuth 2.0 authorization code flow
- Show connected status, last sync time, disconnect option
- Configure which team's case studies to surface (for multi-team setups)

---

## 5. Slack Bot

### 5.1 Technology: Slack Bolt SDK (Node.js)

Bolt for JavaScript (`@slack/bolt`) is the official Slack framework. It handles:
- Slash commands
- Interactive messages (buttons, selects)
- Block Kit rendering
- OAuth token management
- Socket Mode for development (no public URL needed)

### 5.2 Commands

**Primary command:** `/quotd proof <query>`

Examples:
```
/quotd proof fintech series-b churn-reduction
/quotd proof 200-person ecommerce company struggling with cart abandonment
/quotd proof enterprise healthcare HIPAA compliance
```

**Secondary commands:**
```
/quotd room create <prospect-name>     -- create a deal room
/quotd room add <room-slug> <study-id> -- add a study to a deal room
/quotd library                         -- list all published case studies
/quotd help                            -- show available commands
```

### 5.3 Slash Command Flow

```
1. Rep types: /quotd proof fintech series-b churn-reduction
2. Slack sends POST to our endpoint
3. ack() immediately (within 3 seconds — Slack timeout)
4. Background:
   a. Parse query text
   b. Generate embedding from query text
   c. Extract metadata filters via Claude (optional — only if structured keywords detected)
   d. Call match_proof() RPC
   e. Rerank results
5. respond() with Block Kit message containing top 3 matches
```

### 5.4 Block Kit Response

```json
{
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "Top 3 Proof Matches" }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Acme Corp* — Fintech, 180 employees\n_\"Reduced churn by 40% in 6 months\"_\nMatch: 94%"
      },
      "accessory": {
        "type": "button",
        "text": { "type": "plain_text", "text": "View Study" },
        "url": "https://app.quotd.sh/proof/abc123"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "Send to Prospect" },
          "action_id": "send_proof_to_prospect",
          "value": "abc123",
          "style": "primary"
        },
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "Add to Deal Room" },
          "action_id": "add_to_deal_room",
          "value": "abc123"
        },
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "Copy Link" },
          "action_id": "copy_proof_link",
          "value": "abc123"
        }
      ]
    }
  ]
}
```

### 5.5 Interactive Actions

| Action | Behavior |
|---|---|
| **"View Study"** | Opens case study in browser (URL button — no server roundtrip) |
| **"Send to Prospect"** | Opens modal: enter prospect email. Sends branded email with case study link via Resend. |
| **"Add to Deal Room"** | Opens modal: select or create deal room. Adds case study to room. |
| **"Copy Link"** | Returns ephemeral message with shareable link |

### 5.6 Deployment

**Production:** HTTP mode — Slack sends events to `https://app.quotd.sh/api/slack/events`

Route structure:
```
/api/slack/events     — event subscriptions + slash commands
/api/slack/interact   — interactive message actions
/api/slack/oauth      — OAuth install flow
```

**Development:** Socket Mode via `@slack/bolt` — no public URL needed, WebSocket connection.

### 5.7 Slack App Configuration

- **Bot Token Scopes:** `commands`, `chat:write`, `users:read`
- **Slash Command:** `/quotd` pointing to `https://app.quotd.sh/api/slack/events`
- **Interactivity URL:** `https://app.quotd.sh/api/slack/interact`
- **OAuth Redirect URL:** `https://app.quotd.sh/api/slack/oauth`
- **Distribution:** "Add to Slack" button on Quotd settings page

### 5.8 Implementation: Next.js API Route Adapter

Since Quotd runs on Next.js/Vercel, the Slack Bolt app cannot run as a standalone long-lived server. Two options:

**Option A: Raw API routes (recommended for Vercel)**

Handle Slack verification and dispatch manually in Next.js API routes. No Bolt dependency. Lighter weight, no Express adapter complexity, works naturally with Vercel serverless functions.

```typescript
// src/app/api/slack/events/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function verifySlackSignature(req: NextRequest, body: string): boolean {
  const timestamp = req.headers.get("x-slack-request-timestamp");
  const signature = req.headers.get("x-slack-signature");
  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = "v0=" +
    crypto.createHmac("sha256", process.env.SLACK_SIGNING_SECRET!)
      .update(sigBasestring).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(mySignature), Buffer.from(signature || "")
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  if (!verifySlackSignature(req, body)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = new URLSearchParams(body);
  const command = payload.get("command");
  const text = payload.get("text") || "";
  const responseUrl = payload.get("response_url");

  // Ack immediately
  // Then process match in background via fetch to response_url
  // (Vercel supports waitUntil for background work after response)

  return NextResponse.json({ text: "Searching..." });
}
```

**Option B: Bolt with custom receiver**

Use `@slack/bolt` with a custom receiver that adapts to Next.js request/response. More boilerplate but gives access to Bolt's middleware chain and conversation utilities.

Recommendation: Option A. Quotd only needs slash commands and interactive actions — Bolt's abstraction layer adds complexity without proportional benefit on Vercel serverless.

---

## 6. Deal Rooms

### 6.1 Concept

A deal room is a branded, shareable page that curates the most relevant proof for a specific prospect. It is the "leave-behind" that a rep sends after a call or includes in a follow-up email.

### 6.2 Competitive Landscape & UX Patterns

Research into Dock, Aligned, and DealHub reveals these winning patterns:

| Pattern | Dock | Aligned | DealHub | Quotd Implementation |
|---|---|---|---|---|
| **Branded workspace** | Full white-label per deal | Simple branded page | Fully customizable | Use team branding (logo, colors) from existing `profiles` table |
| **Content sections** | Drag-and-drop sections | Linear feed | Template-based | Ordered list of case study cards with custom headlines |
| **Engagement tracking** | Per-content view time, stakeholder activity | Basic view tracking | Detailed analytics | Track page views, per-study views, time spent |
| **Stakeholder mapping** | See who viewed what | Basic | Advanced | Track by email (if shared via email) or anonymous |
| **Mutual action plan** | Built-in checklists | Yes | Yes | NOT in v1 — scope to proof only |
| **Interactive elements** | Comments, reactions | Chat | Full collaboration | NOT in v1 — read-only proof page |

Key takeaway from Dock: the best deal rooms are simple, branded, and trackable. Prospects do not want another login or complex tool. They want a clean page with relevant content that loads fast.

### 6.3 Deal Room Page Structure

```
+---------------------------------------------------+
|  [Logo]  Prepared for {Prospect Company}           |
|  by {Sender Company}                               |
+---------------------------------------------------+
|                                                     |
|  Case Study 1: Acme Corp                           |
|  +-----------------------------------------------+ |
|  | "Reduced churn by 40% in 6 months"             | |
|  |                                                 | |
|  | Fintech - 180 employees - Series B              | |
|  |                                                 | |
|  | > "The impact was immediate..."                 | |
|  |                                                 | |
|  | [Read Full Study ->]                            | |
|  +-----------------------------------------------+ |
|                                                     |
|  Case Study 2: BetaCo                              |
|  +-----------------------------------------------+ |
|  | ...                                             | |
|  +-----------------------------------------------+ |
|                                                     |
|  Case Study 3: GammaTech                           |
|  +-----------------------------------------------+ |
|  | ...                                             | |
|  +-----------------------------------------------+ |
|                                                     |
|  --- Key Metrics Across All Studies ---             |
|  +---------+  +---------+  +---------+             |
|  |  40%    |  |  3x     |  |  $2.1M  |             |
|  | churn   |  | faster  |  | saved   |             |
|  +---------+  +---------+  +---------+             |
|                                                     |
+---------------------------------------------------+
|  Powered by Quotd - {Sender Company} (c) 2026      |
+---------------------------------------------------+
```

### 6.4 Deal Room Features (v1)

1. **Auto-generated:** Rep runs `/quotd proof` or uses CRM widget, clicks "Create Deal Room" — room auto-populates with top 3 matches
2. **Manually curated:** Rep can add/remove/reorder case studies, override headlines and blurbs
3. **Shareable link:** `https://app.quotd.sh/room/{slug}` — no auth required for viewing
4. **Branded:** Uses team branding (logo, primary color) from profiles table. "Powered by Quotd" footer (removable on enterprise plan)
5. **Tracking:** Every page view logged with timestamp, IP, user-agent. If prospect was sent the link via email (through Quotd), tie the view to their email
6. **Notifications:** When prospect views the deal room, notify the rep via:
   - Slack DM (if Slack connected)
   - Webhook event `deal_room.viewed`
   - Dashboard notification

### 6.5 Deal Room Analytics (Dashboard View)

For the rep/manager dashboard:
- Total views per deal room
- Unique visitors
- Time spent per case study (which proof resonated?)
- Most-viewed case study across all deal rooms (portfolio-level insight)
- "Hot" indicator: prospect viewed 3+ times in 24 hours

### 6.6 Deal Room Page Implementation

The deal room page is a public Next.js page (no auth). Route: `/room/[slug]/page.tsx`.

```typescript
// src/app/room/[slug]/page.tsx
import { notFound } from "next/navigation";

export default async function DealRoomPage({
  params,
}: {
  params: { slug: string };
}) {
  const room = await getDealRoom(params.slug);
  if (!room || !room.is_active) return notFound();

  // Log view (fire-and-forget via waitUntil or edge function)
  logDealRoomView(room.id, headers());

  const items = await getDealRoomItems(room.id);
  const branding = await getTeamBranding(room.team_id);

  return <DealRoomView room={room} items={items} branding={branding} />;
}
```

The page is server-rendered for fast load and link preview (Open Graph tags). No client-side auth. A tracking pixel or `navigator.sendBeacon` call on the client side tracks time-on-page per case study card.

---

## 7. API Surface

### New V1 API Endpoints

```
POST   /api/v1/proof/match           — Match proof against deal context
GET    /api/v1/proof/library         — List all published proof (paginated, filterable)

POST   /api/v1/deal-rooms            — Create a deal room
GET    /api/v1/deal-rooms            — List deal rooms for team
GET    /api/v1/deal-rooms/:id        — Get deal room with items
PATCH  /api/v1/deal-rooms/:id        — Update deal room (name, branding, active)
DELETE /api/v1/deal-rooms/:id        — Delete deal room
POST   /api/v1/deal-rooms/:id/items  — Add item to deal room
DELETE /api/v1/deal-rooms/:id/items/:itemId — Remove item
PATCH  /api/v1/deal-rooms/:id/items/:itemId — Reorder/update item
GET    /api/v1/deal-rooms/:id/analytics — Get deal room view analytics

POST   /api/v1/integrations/salesforce/connect   — Store SF OAuth credentials
POST   /api/v1/integrations/hubspot/connect      — Store HS OAuth credentials
DELETE /api/v1/integrations/:provider/disconnect  — Remove connection
GET    /api/v1/integrations                       — List active integrations

POST   /api/slack/events      — Slack event subscriptions + slash commands
POST   /api/slack/interact    — Slack interactive actions
GET    /api/slack/oauth       — Slack OAuth callback
```

### Match API Request/Response

```typescript
// POST /api/v1/proof/match
// Request
{
  "context_text": "200-person fintech company struggling with customer churn, Series B, evaluating analytics platforms",
  "industry": "fintech",           // optional hard filter
  "company_size": "smb_51_200",   // optional hard filter
  "use_cases": ["churn_reduction"], // optional hard filter
  "match_count": 3                 // optional, default 3, max 10
}

// Response
{
  "matches": [
    {
      "id": "uuid",
      "customer_company": "Acme Corp",
      "product_name": "ChurnGuard",
      "industry": "fintech",
      "company_size": "smb_51_200",
      "headline_metric": "40% reduction in churn within 6 months",
      "best_quote": {
        "text": "The impact on our retention was immediate and measurable.",
        "tag": "impact"
      },
      "use_cases": ["churn_reduction", "customer_analytics"],
      "similarity": 0.94,
      "proof_url": "https://app.quotd.sh/proof/abc123",
      "deal_room_eligible": true
    }
  ],
  "query_embedding_cached": false,
  "filters_applied": {
    "industry": "fintech",
    "company_size": "smb_51_200"
  }
}
```

### New Webhook Events

Add to `src/lib/webhooks/events.ts`:

```typescript
"proof.published",      // case study marked as published proof
"proof.matched",        // proof match query executed
"deal_room.created",
"deal_room.viewed",
"deal_room.item_added",
```

### MCP Server Extensions

Add to `packages/mcp-server/src/tools.ts`:

```typescript
server.tool(
  "match_proof",
  "Find the most relevant case studies for a deal context",
  {
    context: z.string().describe("Deal context description"),
    industry: z.string().optional(),
    company_size: z.string().optional(),
    match_count: z.number().optional(),
  },
  async ({ context, industry, company_size, match_count }) => {
    const result = await client.matchProof({
      context_text: context,
      industry,
      company_size,
      match_count,
    });
    return {
      content: [
        { type: "text", text: JSON.stringify(result.matches, null, 2) },
      ],
    };
  }
);

server.tool(
  "create_deal_room",
  "Create a branded deal room for a prospect",
  {
    prospect_name: z.string(),
    prospect_company: z.string(),
    interview_ids: z.array(z.string()).optional(),
  },
  async ({ prospect_name, prospect_company, interview_ids }) => {
    const result = await client.createDealRoom({
      prospect_name,
      prospect_company,
      interview_ids,
    });
    return {
      content: [
        { type: "text", text: JSON.stringify(result.data, null, 2) },
      ],
    };
  }
);
```

---

## 8. Build Plan & Effort Estimates

### Phase 1: Matching Engine (Core) — 2 weeks

| Task | Effort | Details |
|---|---|---|
| Enable pgvector extension in Supabase | 1 hour | SQL migration |
| Add `proof_attributes`, `embedding`, `proof_published` columns | 2 hours | Migration + types update |
| Build attribute extraction pipeline | 1 day | Claude prompt, runs on `review_complete` webhook |
| Build embedding generation pipeline | 1 day | OpenAI `text-embedding-3-small`, runs after attribute extraction |
| Implement `match_proof()` RPC function | 4 hours | SQL function + Supabase RPC |
| Build `/api/v1/proof/match` endpoint | 1 day | Request parsing, embed query, call RPC, rerank, respond |
| Build `/api/v1/proof/library` endpoint | 4 hours | Paginated list of published proof |
| Backfill existing completed interviews | 4 hours | One-time script to extract attributes + generate embeddings for existing data |
| Add "Publish as Proof" toggle to dashboard | 4 hours | UI + API for `proof_published` |
| Tests | 1 day | Unit tests for extraction, matching, reranking |
| MCP server: `match_proof` tool | 2 hours | Add tool registration |

**Phase 1 total: ~2 weeks (1 engineer)**

### Phase 2: Slack Bot — 1 week

| Task | Effort | Details |
|---|---|---|
| Slack app creation + configuration | 2 hours | App manifest, scopes, commands |
| `/quotd proof` slash command handler | 1 day | Parse, match, respond with Block Kit |
| Interactive actions (Send, Add to Room, Copy) | 1 day | Modal flows, button handlers |
| Slack OAuth install flow | 4 hours | "Add to Slack" button, token storage |
| `slack_connections` table + migration | 2 hours | Schema + RLS |
| Dashboard: Slack settings page | 4 hours | Connect/disconnect UI |
| Tests | 4 hours | Command parsing, Block Kit output |

**Phase 2 total: ~1 week (1 engineer)**

### Phase 3: Deal Rooms — 2 weeks

| Task | Effort | Details |
|---|---|---|
| Schema: `deal_rooms`, `deal_room_items`, views tables | 4 hours | Migration |
| CRUD API endpoints for deal rooms | 1 day | Create, list, get, update, delete |
| Deal room items API (add, remove, reorder) | 4 hours | Junction table management |
| Public deal room page (`/room/[slug]`) | 2 days | Server-rendered, branded, responsive |
| View tracking (page + per-item) | 4 hours | Fire-and-forget logging |
| Deal room analytics API + dashboard view | 1 day | Aggregated stats |
| Auto-generate deal room from match results | 4 hours | "Create Deal Room" button in Slack + CRM |
| Webhook events for deal room activity | 2 hours | `deal_room.created`, `deal_room.viewed` |
| Tests | 1 day | API contracts, view tracking |

**Phase 3 total: ~2 weeks (1 engineer)**

### Phase 4: CRM Integrations — 2 weeks

| Task | Effort | Details |
|---|---|---|
| Salesforce Connected App setup | 4 hours | App registration, Canvas config |
| Salesforce Canvas widget (Next.js page) | 2 days | Widget UI, Canvas SDK integration, data fetching |
| Salesforce JWT Bearer OAuth flow | 1 day | Token exchange, encrypted storage |
| HubSpot CRM Card (UI Extension) | 2 days | React extension + serverless function |
| HubSpot OAuth flow | 4 hours | Authorization code flow, token refresh |
| `crm_connections` table + migration | 2 hours | Schema + encryption |
| Dashboard: CRM settings page | 1 day | Connect/disconnect, status display |
| Tests | 1 day | OAuth flows, widget rendering |

**Phase 4 total: ~2 weeks (1 engineer)**

### Summary

| Phase | Feature | Effort | Dependencies |
|---|---|---|---|
| Phase 1 | Matching Engine | 2 weeks | None — start here |
| Phase 2 | Slack Bot | 1 week | Phase 1 (needs matching API) |
| Phase 3 | Deal Rooms | 2 weeks | Phase 1 (needs matching for auto-populate) |
| Phase 4 | CRM Widgets | 2 weeks | Phase 1 (needs matching API) |

**Total: ~7 weeks for 1 engineer. Phases 2-4 can parallelize across 2-3 engineers to ship in ~3 weeks after Phase 1.**

### Recommended Build Order

```
Week 1-2:  Phase 1 — Matching Engine (everything else depends on this)
Week 3:    Phase 2 — Slack Bot (fastest ROI, sales reps use it daily)
Week 3-4:  Phase 3 — Deal Rooms (the "send to prospect" destination)
Week 5-6:  Phase 4 — CRM Widgets (requires CRM vendor partnerships/approvals)
```

Slack bot ships first after the engine because: (a) it is the fastest to build, (b) it delivers value without any prospect-facing infrastructure, (c) it validates matching quality before building CRM integrations. Deal rooms ship second because the Slack bot's "Send to Prospect" and "Add to Deal Room" actions need a destination. CRM widgets ship last because Salesforce and HubSpot app review processes add calendar time regardless of engineering effort.

---

## Appendix A: Token/Secret Management

All CRM and Slack tokens must be encrypted at rest. Use AES-256-GCM encryption with a key stored in Vercel environment variables (`ENCRYPTION_KEY`).

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(process.env.ENCRYPTION_KEY!, "hex"),
    iv
  );
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(data: string): string {
  const [ivHex, tagHex, encryptedHex] = data.split(":");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(process.env.ENCRYPTION_KEY!, "hex"),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return (
    decipher.update(Buffer.from(encryptedHex, "hex"), undefined, "utf8") +
    decipher.final("utf8")
  );
}
```

## Appendix B: Embedding Cost Projections

| Scale | Case Studies | Embedding Cost | Storage (pgvector) | Monthly Query Cost |
|---|---|---|---|---|
| Launch | 100 | $0.001 | ~600KB | ~$0.01 (1K queries) |
| Year 1 | 5,000 | $0.05 | ~30MB | ~$0.50 (50K queries) |
| Year 2 | 50,000 | $0.50 | ~300MB | ~$5.00 (500K queries) |
| Scale | 500,000 | $5.00 | ~3GB | ~$50.00 (5M queries) |

At all projected scales, embedding costs are negligible. The switch to a dedicated vector database (Pinecone) is only warranted if query latency at 500K+ vectors degrades below acceptable thresholds (~100ms P95), which pgvector with HNSW indexing should handle without issue.

## Appendix C: Proof Attribute Taxonomy

These are the controlled vocabularies for structured matching attributes. Start with these and expand based on actual case study data.

**Industries:**
`fintech`, `healthtech`, `edtech`, `ecommerce`, `saas`, `martech`, `proptech`, `insurtech`, `legaltech`, `hr_tech`, `cybersecurity`, `devtools`, `logistics`, `manufacturing`, `media`, `nonprofit`, `government`, `professional_services`, `retail`, `telecom`, `other`

**Company Size Buckets:**
`startup_1_50`, `smb_51_200`, `mid_market_201_1000`, `enterprise_1001_5000`, `large_enterprise_5001_plus`

**Use Cases:**
`churn_reduction`, `revenue_growth`, `cost_savings`, `time_savings`, `process_automation`, `data_analytics`, `customer_experience`, `team_productivity`, `compliance`, `security`, `scaling`, `migration`, `integration`, `onboarding`, `support_efficiency`, `other`

**Pain Points:**
`manual_processes`, `data_silos`, `scaling_challenges`, `high_churn`, `slow_time_to_value`, `compliance_risk`, `poor_visibility`, `tool_fragmentation`, `talent_shortage`, `legacy_systems`, `other`

**Buyer Personas:**
`ceo`, `cto`, `cfo`, `cmo`, `vp_sales`, `vp_engineering`, `vp_product`, `vp_customer_success`, `director_marketing`, `director_operations`, `ic_engineer`, `ic_marketer`, `ic_analyst`, `other`

**Deal Stages:**
`awareness`, `discovery`, `evaluation`, `negotiation`, `close`, `expansion`

**Strength Tags:**
`strong_roi`, `technical_depth`, `executive_quote`, `before_after`, `quick_win`, `enterprise_scale`, `implementation_detail`, `industry_specific`, `competitive_displacement`

---

## Sources

- [Supabase Hybrid Search Documentation](https://supabase.com/docs/guides/ai/hybrid-search)
- [Supabase pgvector Extension](https://supabase.com/docs/guides/database/extensions/pgvector)
- [Supabase Semantic Search](https://supabase.com/docs/guides/ai/semantic-search)
- [PostgreSQL as a Vector Database: pgvector vs Pinecone vs Weaviate](https://dev.to/polliog/postgresql-as-a-vector-database-when-to-use-pgvector-vs-pinecone-vs-weaviate-4kfi)
- [Vector Database Comparison: pgvector vs Pinecone vs Weaviate](https://backendbytes.com/articles/vector-databases-comparison/)
- [Dock Digital Sales Rooms](https://www.dock.us/solutions/sales)
- [DealHub DealRoom](https://dealhub.io/platform/dealroom/)
- [Digital Sales Room Software Comparison](https://www.flowla.com/blog/digital-sales-room-software-comparison)
- [Best Vector Databases in 2025](https://www.firecrawl.dev/blog/best-vector-databases)
- [Top 9 Vector Databases 2026](https://www.shakudo.io/blog/top-9-vector-databases)
