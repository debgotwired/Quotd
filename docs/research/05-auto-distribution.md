# 05 — Auto-Distribution: Publish Everywhere with One Click

> Technical plan for turning Quotd from a case study *generator* into a case study *distribution engine*.

---

## Current State

Quotd already generates six content formats per interview (`FormatKey` in `src/lib/supabase/types.ts`):

| Key | Output | Format |
|-----|--------|--------|
| `one_pager` | Executive briefing (~300 words) | Markdown |
| `linkedin` | LinkedIn post (~150 words) | Plain text |
| `twitter` | Tweet (280 chars) | Plain text |
| `sales_slide` | Before/after slide content | Markdown |
| `quote_cards` | Structured quote array | JSON (`{text, tag}[]`) |
| `email_blurb` | 2-3 paragraph sales email | Plain text |

Export pipeline supports: `.md`, `.docx`, `.pdf`, `.html`, `.txt` via `src/lib/export/`.

All content lives in `interviews.generated_formats` (JSONB) and is editable in-dashboard. Webhooks already fire `format.generated` events. The existing v1 API (`/api/v1/interviews/[id]/formats`) supports programmatic access via API keys.

**What's missing:** The content sits in Quotd. Users must manually copy-paste into their CMS, social accounts, and review sites. Auto-distribution closes this gap.

---

## 1. CMS Integrations

### 1.1 WordPress (REST API v2)

**Auth:** Application Passwords (shipped in WP 5.6+). User generates a password in wp-admin > Users > Application Passwords. We store `{site_url, username, app_password}`. Auth is Basic Auth over HTTPS: `Authorization: Basic base64(username:app_password)`.

No OAuth flow needed. This is the simplest CMS integration by far.

**Create post:**
```
POST {site_url}/wp-json/wp/v2/posts
Content-Type: application/json

{
  "title": "How Acme Cut Onboarding Time by 60%",
  "content": "<p>...</p>",   // HTML — convert from markdown via marked
  "status": "draft",          // or "publish"
  "categories": [12],         // optional
  "tags": [5, 8],             // optional
  "featured_media": 42        // optional — media ID from upload
}
```

**Content format:** HTML. Use the existing `marked` dependency (already in `to-html.ts`) to convert the markdown draft/one-pager to HTML. Strip the `<html>/<head>/<body>` wrapper — WP only wants the inner HTML.

**Media upload:**
```
POST {site_url}/wp-json/wp/v2/media
Content-Type: image/png
Content-Disposition: attachment; filename="quote-card.png"
```
Returns a media ID that can be set as `featured_media` on the post.

**Rate limits:** None enforced by default in self-hosted WP. WordPress.com has 60 req/min. Not a concern for single-post publishing.

**What we build:**
- `src/lib/distribution/wordpress.ts` — `publishToWordPress(interview, config)` function
- Convert one_pager or full draft to HTML body
- Optionally render quote_cards as images, upload as media, set as featured image
- Always publish as `draft` first (user can change to `publish` in settings)

### 1.2 Webflow (CMS API v2)

**Auth:** OAuth 2.0 authorization code flow. Requires a Webflow App registered in the Webflow dashboard. Scopes needed: `cms:write`, `sites:read`.

Alternatively: site-level API tokens (simpler but less secure, cannot be scoped per-user in a multi-tenant SaaS). **Recommendation: OAuth for production, API token for MVP.**

**Create collection item:**
```
POST https://api.webflow.com/v2/collections/{collection_id}/items
Authorization: Bearer {access_token}

{
  "fieldData": {
    "name": "Acme Case Study",
    "slug": "acme-case-study",
    "body": "<p>Rich text HTML here</p>",
    "metric-headline": "60% faster onboarding",
    "customer-quote": "It changed everything"
  },
  "isDraft": true
}
```

**Rich text:** Webflow accepts a subset of HTML in rich text fields. No raw markdown. Allowed tags: `<h1>`-`<h6>`, `<p>`, `<a>`, `<strong>`, `<em>`, `<ul>`, `<ol>`, `<li>`, `<blockquote>`, `<figure>`, `<img>`. Tables are NOT supported in rich text — must be converted to styled divs or omitted.

**Images:** Must be hosted at a public URL. Webflow does not accept binary uploads for CMS items — you provide a URL and Webflow downloads it. This means we need to host quote card images on Supabase Storage (public bucket) first.

**Rate limits:** 60 requests/minute for OAuth apps, 120 req/min for site tokens. Single-post publishing is fine.

**Gotcha:** Webflow CMS collections have user-defined schemas. We cannot know field names ahead of time. Solution: a one-time "map fields" step where the user selects their collection and maps Quotd fields (title, body, metric, quote) to Webflow collection fields.

**What we build:**
- `src/lib/distribution/webflow.ts`
- OAuth flow with PKCE (Webflow supports it)
- Field mapping UI in settings
- HTML conversion with table-to-div fallback
- Images hosted on Supabase Storage with public URLs

### 1.3 HubSpot (CMS Blog Post API)

**Auth:** OAuth 2.0 or Private App access tokens. For a SaaS integration, OAuth is required. Scopes: `content`.

**Create blog post:**
```
POST https://api.hubapi.com/cms/v3/blogs/posts
Authorization: Bearer {access_token}

{
  "name": "Acme Case Study",
  "slug": "acme-case-study",
  "postBody": "<div>HTML content</div>",
  "contentGroupId": "{blog_id}",
  "state": "DRAFT",
  "metaDescription": "How Acme cut onboarding by 60%",
  "featuredImage": "https://..."
}
```

**Content format:** HTML in `postBody`. HubSpot supports full HTML including tables, images, and custom modules.

**Media:** Upload via File Manager API (`/filemanager/api/v3/files/upload`), returns a hosted URL to use in `featuredImage`.

**Rate limits:** 100 requests per 10 seconds (private app), 150/10s (OAuth). Generous for our use case.

**What we build:**
- `src/lib/distribution/hubspot.ts`
- OAuth flow (HubSpot has good OAuth docs and a mature app marketplace)
- Blog selection (user picks which blog to publish to)
- HTML conversion + featured image upload

### 1.4 Contentful (Content Management API)

**Auth:** Content Management API tokens (personal access tokens) or OAuth. For SaaS: OAuth via Contentful App Framework.

**Create entry:**
```
PUT https://api.contentful.com/spaces/{space}/environments/{env}/entries
Authorization: Bearer {cma_token}
Content-Type: application/vnd.contentful.management.v1+json
X-Contentful-Content-Type: {content_type_id}

{
  "fields": {
    "title": { "en-US": "Acme Case Study" },
    "body": {
      "en-US": {
        "nodeType": "document",
        "content": [...]  // Contentful Rich Text AST
      }
    }
  }
}
```

**Content format:** Contentful uses its own Rich Text AST format — NOT HTML, NOT Markdown. Converting from markdown requires building an AST with node types like `paragraph`, `heading-1`, `blockquote`, `embedded-asset-block`, etc. The `@contentful/rich-text-from-markdown` npm package handles this, but it is imperfect with tables.

**Media:** Assets must be uploaded separately, then linked. Two-step process: (1) create asset with upload URL, (2) process asset, (3) publish asset, (4) reference in entry.

**Rate limits:** 10 requests/second for CMA. Adequate.

**Complexity:** HIGH. Contentful's content model is fully custom (like Webflow), so we need field mapping. Plus the Rich Text AST conversion adds a layer of complexity. **Recommend: Phase 2.**

### 1.5 Ghost (Admin API)

**Auth:** Admin API key (format: `{id}:{secret}`). Auth uses a short-lived JWT signed with the secret portion. No OAuth — just key-based.

```javascript
const jwt = require('jsonwebtoken');
const [id, secret] = apiKey.split(':');
const token = jwt.sign({}, Buffer.from(secret, 'hex'), {
  keyid: id,
  algorithm: 'HS256',
  expiresIn: '5m',
  audience: '/admin/'
});
```

**Create post:**
```
POST {ghost_url}/ghost/api/admin/posts/
Authorization: Ghost {jwt_token}

{
  "posts": [{
    "title": "Acme Case Study",
    "html": "<p>Full HTML content</p>",
    "status": "draft",
    "tags": [{"name": "case-study"}],
    "feature_image": "https://...",
    "meta_title": "...",
    "meta_description": "..."
  }]
}
```

**Content format:** `html` field accepts full HTML. Ghost also supports Lexical (its native editor format) via the `lexical` field, but HTML is the practical choice for external integrations.

**Media:** Upload via `/ghost/api/admin/images/upload/` (multipart form data). Returns a URL to use in `feature_image` or inline `<img>` tags.

**Rate limits:** Not formally documented. In practice, self-hosted Ghost has no rate limiting. Ghost(Pro) may throttle at very high volumes.

**What we build:**
- `src/lib/distribution/ghost.ts`
- JWT generation from Admin API key
- HTML conversion + image upload
- Simple setup: just ghost_url + admin_api_key

### CMS Priority Matrix

| CMS | Market Share | Auth Complexity | Content Format | Build Effort | Priority |
|-----|-------------|-----------------|----------------|-------------|----------|
| WordPress | ~43% of web | Low (App Password) | HTML (easy) | 2 days | **P0** |
| Ghost | Growing in B2B | Low (API key + JWT) | HTML (easy) | 2 days | **P1** |
| HubSpot | Massive in B2B SaaS | Medium (OAuth) | HTML (easy) | 3 days | **P1** |
| Webflow | Popular in marketing | Medium (OAuth) | HTML subset + field mapping | 4 days | **P2** |
| Contentful | Developer-heavy | High (OAuth + Rich Text AST) | Custom AST (hard) | 5 days | **P3** |

---

## 2. Social Media Publishing

### 2.1 LinkedIn

**API:** LinkedIn Marketing API (formerly Share API). This is the only way to programmatically post to LinkedIn.

**Auth:** OAuth 2.0 with 3-legged flow. Scopes needed:
- `w_member_social` — post as the authenticated member
- `r_liteprofile` — read basic profile (needed for author URN)

**Create a share (text post):**
```
POST https://api.linkedin.com/v2/ugcPosts
Authorization: Bearer {access_token}

{
  "author": "urn:li:person:{person_id}",
  "lifecycleState": "PUBLISHED",
  "specificContent": {
    "com.linkedin.ugc.ShareContent": {
      "shareCommentary": { "text": "The LinkedIn post content..." },
      "shareMediaCategory": "NONE"
    }
  },
  "visibility": {
    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
  }
}
```

**With image:**
```
// Step 1: Register upload
POST https://api.linkedin.com/v2/assets?action=registerUpload

// Step 2: Upload binary to the returned URL
PUT {uploadUrl}
Content-Type: image/png
[binary]

// Step 3: Create post with asset URN
{
  "specificContent": {
    "com.linkedin.ugc.ShareContent": {
      "shareCommentary": { "text": "..." },
      "shareMediaCategory": "IMAGE",
      "media": [{
        "status": "READY",
        "media": "urn:li:digitalmediaAsset:{asset_id}",
        "title": { "text": "Case Study: Acme" }
      }]
    }
  }
}
```

**Articles:** LinkedIn articles (long-form) are NOT available via API. Only share posts (short-form with optional media). This is fine — our `linkedin` format already generates ~150 word posts, which is ideal for shares.

**Video:** Supported via the same register-upload flow with `VIDEO` media category. Not relevant for case studies initially.

**Rate limits:**
- 100 API calls per day per member per app (for posting)
- 100,000 API calls per day per app (for reads)
- The 100/day posting limit is generous — users won't publish 100 case studies per day

**Company pages:** Posting to a company page requires `w_organization_social` scope and the user must be an admin of the page. The `author` URN changes to `urn:li:organization:{org_id}`. Worth supporting in V2.

**Token expiry:** Access tokens expire in 60 days. Refresh tokens last 365 days. We MUST implement token refresh or users will need to re-authenticate every 2 months.

**Important caveat:** LinkedIn API access requires app review for `w_member_social`. New apps get a 90-day trial with limited usage. Full access requires submitting an app review to LinkedIn. **This is the biggest friction point.** Plan for 2-4 weeks of review time.

**What we build:**
- `src/lib/distribution/linkedin.ts`
- OAuth flow with token storage + refresh
- Text post creation (from `linkedin` format content)
- Optional: render a quote card as an image, upload + attach
- Company page support in V2

### 2.2 Twitter/X (API v2)

**API:** Twitter API v2. Endpoint: `POST /2/tweets`.

**Auth:** OAuth 2.0 with PKCE (user context) for posting on behalf of users. Scopes: `tweet.read`, `tweet.write`, `users.read`.

**Pricing tiers (this is the big problem):**
| Tier | Price | Tweet creation | Read |
|------|-------|---------------|------|
| Free | $0 | 1,500 tweets/month (app-wide) | 0 |
| Basic | $100/month | 3,000 tweets/month per user | 10,000 reads/month |
| Pro | $5,000/month | 300,000 tweets/month | 1,000,000 reads/month |

**For Quotd:** Free tier gives 1,500 tweets/month across ALL users. That is extremely limiting. Basic at $100/month gives 3,000/month which is workable but adds a hard cost. **Recommendation: start with Basic tier.**

**Create tweet:**
```
POST https://api.twitter.com/2/tweets
Authorization: Bearer {user_access_token}

{
  "text": "We cut onboarding time by 60%. Here's how..."
}
```

**Threads:** Create first tweet, get tweet ID, then create replies:
```
{
  "text": "Thread continued...",
  "reply": { "in_reply_to_tweet_id": "{first_tweet_id}" }
}
```

**Media:** Upload via v1.1 media endpoint (still required even with v2):
```
POST https://upload.twitter.com/1.1/media/upload.json
Content-Type: multipart/form-data
```
Returns `media_id` to attach to tweet via `"media": {"media_ids": ["..."]}`.

**Rate limits:** 200 tweets per 15-minute window per user. Plus the monthly caps above.

**Character limit:** 280 characters for Free/Basic. X Premium users get 25,000 chars. Our `twitter` format enforces 280 chars with truncation in `formats.ts`, which is correct.

**What we build:**
- `src/lib/distribution/twitter.ts`
- OAuth 2.0 with PKCE flow
- Single tweet from `twitter` format
- Optional: thread mode for `one_pager` (split into ~280 char chunks)
- Quote card image upload + attachment

### Social Media Priority Matrix

| Platform | API Access | Auth | Cost to Quotd | User Value | Priority |
|----------|-----------|------|---------------|------------|----------|
| LinkedIn | Requires app review | OAuth 2.0 | Free (after review) | **Very High** (B2B audience) | **P0** |
| Twitter/X | Immediate | OAuth 2.0 + PKCE | $100/month min | Medium | **P2** |

LinkedIn is the clear P0 for B2B case study distribution. Twitter has high API costs and lower B2B relevance.

---

## 3. Review Site Integration

### 3.1 Reality Check: No Review Site Has a Public Write API

**G2:** No public API for submitting reviews. G2 has a Review API for *reading* reviews (requires partnership), and a Review Request API for *sending email invitations* to leave a review. But you cannot programmatically submit review content. Reviews must be submitted through G2's web interface (for fraud prevention).

**Capterra:** No API at all. Reviews are submitted through Capterra/Gartner's web portal only.

**TrustRadius:** No public write API. They have a content syndication API for *reading* reviews, but submissions go through their web form.

**Trustpilot:** Has a Business API with an invitation endpoint (`POST /v1/private/business-units/{id}/email-invitations`) but no direct review submission API.

### 3.2 What We Can Actually Build: Review-Ready Text Generation

Since no review site accepts programmatic submissions, we generate review-ready text that users can copy-paste. This is still high value — writing a G2 review from scratch takes 15-20 minutes; having AI-generated text from the actual interview takes 30 seconds.

**New format: `review_ready`**

Add a new `FormatKey` that generates text structured for review sites:

```
Title: [Product] helped us [key outcome]
Rating guidance: Based on interview sentiment, suggest 4-5 stars

What do you like best about [Product]?
[2-3 sentences from solution + praise quotes]

What do you dislike about [Product]?
[1 sentence — hedge with "minor" or "nothing significant" if interview had no negatives]

What problems is [Product] solving and how is that benefiting you?
[2-3 sentences from challenge + impact facts]

Recommendations to others:
[1-2 sentences]
```

This maps directly to the G2 and Capterra review form fields.

**What we build:**
- New `FORMAT_REVIEW_READY_PROMPT` in `src/lib/ai/prompts.ts`
- Add `"review_ready"` to `FormatKey` union
- Copy button in FormatCard that opens a new tab to G2/Capterra review page with the text on clipboard
- Deep link to the product's review page: `https://www.g2.com/products/{slug}/reviews/new`

**Effort:** 1 day. High ROI because it fills a gap no one else automates.

---

## 4. Embeddable Widgets

### 4.1 Widget Types

**Quote Carousel:** Rotates through extracted quotes with customer name/company. Auto-advances every 5 seconds.

**Metrics Banner:** Horizontal strip showing 2-4 key metrics. Example: "60% faster | $200K saved | 4.8/5 rating". Designed for homepage hero sections.

**Case Study Card:** Compact card with headline metric, company logo, one-liner, and "Read more" link. Grid-friendly for a testimonials section.

### 4.2 Delivery Method: Script Tag (Not iframe, Not Web Component)

**Why not iframe:**
- Cannot inherit parent page styles
- Fixed dimensions — responsive behavior requires postMessage communication
- SEO invisible (content not crawlable)
- Looks janky on mobile

**Why not Web Components:**
- Shadow DOM style isolation is actually a *downside* here — users want widgets to feel native
- Browser support gaps in Safari for some Shadow DOM features
- Custom Elements v1 works, but the DX for styling is poor
- Adds complexity for a simple content display

**Why script tag wins:**
- Injects HTML directly into the page — inherits parent styles by default
- Can be themed with CSS variables for easy customization
- SEO friendly (real DOM nodes, crawlable content)
- Tiny payload (no framework needed — vanilla JS + CSS)
- This is how Intercom, Drift, HubSpot, Wistia, and Loom all deliver their embeds

**Implementation:**
```html
<!-- User pastes this -->
<div id="quotd-widget" data-interview="{id}" data-type="carousel"></div>
<script src="https://quotd.ai/widget.js" async></script>
```

The script:
1. Reads `data-interview` and `data-type` from the container div
2. Fetches widget data from `GET /api/widget/{interview_id}?type=carousel` (public endpoint, no auth — content is already customer-approved)
3. Renders HTML + scoped CSS into the container
4. Applies CSS variable theming

### 4.3 CSS Variable Theming

```css
/* Defaults — user overrides via CSS variables */
#quotd-widget {
  --quotd-font: inherit;
  --quotd-text: #1a1a1a;
  --quotd-bg: #ffffff;
  --quotd-accent: #2563eb;       /* or pulled from branding.primary_color */
  --quotd-border: #e5e5e5;
  --quotd-radius: 12px;
  --quotd-quote-style: italic;
}
```

Users override by adding CSS:
```css
#quotd-widget {
  --quotd-accent: #ff6b00;
  --quotd-radius: 0;
}
```

### 4.4 Widget Data API

New public endpoint (no auth, rate-limited):

```
GET /api/widget/{interview_id}?type=carousel|banner|card
```

Response:
```json
{
  "company": "Acme Corp",
  "product": "Quotd",
  "type": "carousel",
  "branding": {
    "logo_url": "...",
    "primary_color": "#1a1a1a"
  },
  "quotes": [
    { "text": "It changed everything", "tag": "impact" }
  ],
  "metrics": [
    { "name": "Onboarding time", "delta": "-60%", "unit": "%" }
  ],
  "headline": "How Acme Cut Onboarding by 60%",
  "link": "https://quotd.ai/cs/acme-case-study"
}
```

**Security:** Only return data for interviews with `status = "review_complete"`. The interview owner must explicitly enable widget access (new boolean column `widget_enabled` on interviews).

### 4.5 Widget Bundle

The widget JS file should be:
- Vanilla JS, no React — target <5KB gzipped
- Built as a separate entry point (`src/widget/index.ts`) with its own build step
- Served from a CDN (Vercel Edge or Cloudflare)
- Cached aggressively (widget data fetched with `stale-while-revalidate`)

**What we build:**
- `src/widget/index.ts` — widget loader
- `src/widget/carousel.ts` — quote carousel renderer
- `src/widget/banner.ts` — metrics banner renderer
- `src/widget/card.ts` — case study card renderer
- `src/widget/styles.css` — base styles with CSS variables
- `GET /api/widget/[id]/route.ts` — public data endpoint
- Dashboard UI: toggle widget access, copy embed code, preview
- Separate build config (esbuild or tsup, output to `public/widget.js`)

**Effort:** 5 days for all three widget types + API + dashboard UI.

---

## 5. Architecture

### 5.1 Distribution Service Layer

```
src/lib/distribution/
  types.ts              — DistributionTarget, DistributionResult, ConnectionConfig
  manager.ts            — orchestrates publish to multiple targets
  wordpress.ts          — WordPress REST API client
  ghost.ts              — Ghost Admin API client
  hubspot.ts            — HubSpot CMS API client
  webflow.ts            — Webflow CMS API client
  linkedin.ts           — LinkedIn Marketing API client
  twitter.ts            — Twitter/X API v2 client
  review-ready.ts       — review text generator (uses existing AI format pipeline)
```

### 5.2 Database Schema Additions

```sql
-- OAuth connections for CMS and social platforms
CREATE TABLE distribution_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,  -- 'wordpress' | 'ghost' | 'hubspot' | 'webflow' | 'linkedin' | 'twitter'

  -- Connection config (encrypted at rest via Supabase Vault or app-level encryption)
  credentials JSONB NOT NULL,  -- {access_token, refresh_token, site_url, ...}

  -- Platform-specific metadata
  metadata JSONB,  -- {blog_id, collection_id, field_mapping, org_urn, ...}

  label TEXT,  -- user-defined label: "Marketing Blog", "Company LinkedIn"
  active BOOLEAN NOT NULL DEFAULT true,

  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dist_conn_user ON distribution_connections(user_id);
CREATE UNIQUE INDEX idx_dist_conn_unique ON distribution_connections(user_id, platform, label);

-- Distribution log — tracks every publish attempt
CREATE TABLE distribution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES distribution_connections(id) ON DELETE CASCADE,

  platform TEXT NOT NULL,
  format_key TEXT NOT NULL,  -- which FormatKey was published

  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'success' | 'failed' | 'draft_created'

  -- Result data
  external_id TEXT,       -- post ID / tweet ID on the target platform
  external_url TEXT,      -- URL of the published content
  error_message TEXT,

  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dist_log_interview ON distribution_log(interview_id);

-- Widget access control
ALTER TABLE interviews ADD COLUMN widget_enabled BOOLEAN NOT NULL DEFAULT false;
```

### 5.3 Core Types

```typescript
// src/lib/distribution/types.ts

export type Platform =
  | "wordpress"
  | "ghost"
  | "hubspot"
  | "webflow"
  | "linkedin"
  | "twitter";

export type ConnectionCredentials = {
  // WordPress
  site_url?: string;
  username?: string;
  app_password?: string;

  // Ghost
  ghost_url?: string;
  admin_api_key?: string;

  // OAuth-based (HubSpot, Webflow, LinkedIn, Twitter)
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
};

export type DistributionTarget = {
  connectionId: string;
  platform: Platform;
  formatKey: FormatKey;
  publishAsDraft: boolean;
};

export type DistributionResult = {
  connectionId: string;
  platform: Platform;
  status: "success" | "failed" | "draft_created";
  externalId?: string;
  externalUrl?: string;
  error?: string;
};
```

### 5.4 API Routes

```
POST /api/interviews/[id]/distribute
  Body: { targets: DistributionTarget[] }
  Response: { results: DistributionResult[] }

GET  /api/interviews/[id]/distributions
  Response: { distributions: DistributionLog[] }

-- Connection management
GET    /api/settings/connections
POST   /api/settings/connections           — save API key connections (WP, Ghost)
DELETE /api/settings/connections/[id]
GET    /api/settings/connections/[id]/test  — test connectivity

-- OAuth callbacks
GET /api/auth/callback/hubspot
GET /api/auth/callback/webflow
GET /api/auth/callback/linkedin
GET /api/auth/callback/twitter
```

### 5.5 Dashboard UX Flow

1. **Settings > Connections** — user connects platforms (API keys for WP/Ghost, OAuth for others)
2. **Interview detail page** — new "Distribute" button next to existing "Export" buttons
3. **Distribute modal** — shows connected platforms, each with:
   - Toggle on/off
   - Format selector (e.g., WordPress gets `one_pager`, LinkedIn gets `linkedin`)
   - "Publish as draft" checkbox (default: on)
4. **Click "Distribute"** — parallel publish, progress shown per platform
5. **Distribution log** — shows history of all publishes with external links

### 5.6 Content Conversion Pipeline

The key insight: we already generate platform-specific formats. Distribution is mostly a transport layer.

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Generated   │     │  Content         │     │  Platform        │
│  Format      │────>│  Converter       │────>│  Client          │
│  (markdown/  │     │  (md→HTML for    │     │  (API call)      │
│   plain text │     │   CMS, passthru  │     │                  │
│   /JSON)     │     │   for social)    │     │                  │
└──────────────┘     └──────────────────┘     └──────────────────┘
```

| Target Platform | Input Format | Conversion | Notes |
|----------------|-------------|-----------|-------|
| WordPress | `one_pager` or `draft_content` | Markdown → HTML via `marked` | Reuse logic from `to-html.ts`, strip wrapper |
| Ghost | `one_pager` or `draft_content` | Markdown → HTML via `marked` | Same as WP |
| HubSpot | `one_pager` or `draft_content` | Markdown → HTML via `marked` | Same as WP |
| Webflow | `one_pager` or `draft_content` | Markdown → filtered HTML | Strip tables, map to allowed tags |
| LinkedIn | `linkedin` | Passthrough (plain text) | Already generated in correct format |
| Twitter | `twitter` | Passthrough (plain text) | Already 280 chars |

### 5.7 Credential Security

Credentials stored in `distribution_connections.credentials` contain access tokens and API keys. These MUST be encrypted.

**Option A: Supabase Vault** — Supabase has a built-in Vault extension (`pgsodium`) for column-level encryption. Use `vault.create_secret()` and store the vault secret ID instead of raw credentials.

**Option B: Application-level encryption** — Encrypt credentials with AES-256-GCM before storing in JSONB. Key stored in `DISTRIBUTION_ENCRYPTION_KEY` env var.

**Recommendation:** Option B is simpler and doesn't depend on Supabase-specific features. Use `crypto.createCipheriv` from Node's built-in crypto module.

### 5.8 Token Refresh Strategy

LinkedIn and Twitter tokens expire. HubSpot tokens expire every 6 hours.

**Approach:** Check `token_expires_at` before each API call. If within 5 minutes of expiry, refresh first. Store updated tokens.

```typescript
async function getValidToken(connection: DistributionConnection): Promise<string> {
  const creds = decrypt(connection.credentials);
  const expiresAt = new Date(creds.token_expires_at);

  if (expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
    return creds.access_token;  // still valid
  }

  // Refresh
  const newTokens = await refreshToken(connection.platform, creds.refresh_token);
  await updateConnectionCredentials(connection.id, newTokens);
  return newTokens.access_token;
}
```

Also: a background cron (`/api/cron/refresh-tokens`) runs daily to proactively refresh tokens expiring within 24 hours. This prevents failures when users publish after a long gap.

---

## 6. Prioritized Build Plan

### Phase 1: Foundation + WordPress + LinkedIn (3 weeks)

**Week 1: Infrastructure**
- Distribution service types + manager (`src/lib/distribution/`)
- Database tables (`distribution_connections`, `distribution_log`, `widget_enabled` column)
- Credential encryption utility
- Settings > Connections page (UI for adding/removing connections)
- `review_ready` format (new FormatKey + prompt)

**Week 2: WordPress + Ghost**
- WordPress client (HTML conversion + publish)
- Ghost client (JWT auth + HTML publish)
- "Distribute" button + modal on interview detail page
- Distribution log display
- Test connection endpoint

**Week 3: LinkedIn**
- LinkedIn OAuth flow (app registration, callback)
- LinkedIn share post creation
- Token refresh logic
- Background token refresh cron

### Phase 2: Widgets + HubSpot (2 weeks)

**Week 4: Embeddable Widgets**
- Widget data API (`/api/widget/[id]`)
- Quote carousel (vanilla JS)
- Metrics banner
- Case study card
- Widget builder UI in dashboard (toggle, copy embed code, preview)
- Separate build pipeline for `widget.js`

**Week 5: HubSpot**
- HubSpot OAuth flow
- Blog post creation client
- File upload for featured images
- Blog selector in connection settings

### Phase 3: Webflow + Twitter (2 weeks)

**Week 6: Webflow**
- Webflow OAuth flow
- Collection discovery + field mapping UI
- Filtered HTML conversion (no tables)
- Collection item creation

**Week 7: Twitter/X**
- Twitter OAuth 2.0 + PKCE
- Tweet creation from `twitter` format
- Optional thread mode for longer content
- Media upload for quote cards

### Phase 4: Contentful + Polish (1 week)

**Week 8:**
- Contentful OAuth + Rich Text AST conversion
- Distribution analytics (publish counts, click-throughs if widgets are used)
- Batch distribution (publish multiple interviews at once)
- Webhook event: `distribution.published`

---

## 7. Risk Register

| Risk | Impact | Mitigation |
|------|--------|-----------|
| LinkedIn app review takes weeks | Blocks LinkedIn publishing | Apply immediately; offer "copy to clipboard + open LinkedIn" as fallback |
| Twitter API costs ($100/mo minimum) | Ongoing cost even with low usage | Defer Twitter to Phase 3; evaluate ROI after LinkedIn |
| Webflow field mapping is fragile | Users change their CMS schema and break integration | Validate field mapping before each publish; graceful error |
| OAuth token refresh fails silently | Publishing fails with cryptic errors | Proactive refresh cron + clear "reconnect" UI state |
| CMS APIs change without notice | Integration breaks | Pin API versions; monitor for deprecation notices; error alerting |
| Widget script blocked by CSP | Widget doesn't load on customer's site | Document required CSP directive; offer iframe fallback |
| Credential storage breach | Tokens leaked | AES-256-GCM encryption + key rotation support |

---

## 8. Non-Goals (Explicitly Out of Scope)

- **Scheduling/queuing:** No "publish at 9am Tuesday" scheduling. Ship now, schedule later.
- **Analytics from platforms:** No pulling LinkedIn impressions or WordPress views back into Quotd. That's a separate feature.
- **Multi-language:** Content is published in the language it was generated. No auto-translation.
- **Notion/Google Docs:** No document editor integrations. These are not CMS platforms — they're collaboration tools with different publishing semantics.
- **Custom webhook destinations as "distribution":** Already have webhooks. Distribution is purpose-built for known platforms.

---

## 9. Key Implementation Notes

### Reuse What Exists

- **`marked` library** — already a dependency for `to-html.ts`. Reuse for all CMS HTML conversion.
- **Webhook dispatch pattern** — `src/lib/webhooks/dispatch.ts` is a clean model for fire-and-forget publishing. Distribution follows the same pattern.
- **Format generation pipeline** — `generateFormat()` in `src/lib/ai/formats.ts` already produces platform-ready content. Distribution adds transport, not transformation.
- **Branding** — `getBrandingForInterview()` in `src/lib/branding/get-branding.ts` provides logo/color for widgets.
- **API auth pattern** — `withApiAuth` in `src/lib/api-keys/with-api-auth.ts` for the v1 distribution API.

### Content Flow Integrity

The distribution pipeline MUST use the same content that's displayed in the dashboard. Never re-generate content during distribution. Read from `interviews.generated_formats[key].content` and convert/transport it as-is. If the user has edited the content (`edited: true`), their edits are what gets published.

### Idempotency

Each publish creates a `distribution_log` entry. If the same interview + connection + format_key combo already has a `success` entry, warn the user ("This was already published to WordPress on March 15. Publish again?") but don't block them. Some users will want to update a published post — support PUT/update where the platform API allows it (WordPress, Ghost, HubSpot all support post updates via ID).
