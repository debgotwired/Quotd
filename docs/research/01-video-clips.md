# Video Clip Capabilities for Quotd — Technical Research & Architecture Plan

**Author:** Staff Engineer (ex-Vidyard, ex-OpusClip)
**Date:** 2026-03-20
**Status:** Research Complete — Ready for Implementation Planning

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Analysis](#2-current-architecture-analysis)
3. [Browser-Side Video Capture](#3-browser-side-video-capture)
4. [Video Storage & Processing Pipeline](#4-video-storage--processing-pipeline)
5. [AI-Powered Moment Detection & Clip Extraction](#5-ai-powered-moment-detection--clip-extraction)
6. [Video Editing & Output](#6-video-editing--output)
7. [Delivery & Embedding](#7-delivery--embedding)
8. [Architecture Recommendation](#8-architecture-recommendation)
9. [Cost Analysis](#9-cost-analysis)
10. [Migration & Rollout Plan](#10-migration--rollout-plan)
11. [Open Questions & Risks](#11-open-questions--risks)

---

## 1. Executive Summary

Quotd currently runs voice-only AI interviews at `/i/[token]/q/`. The interview flow uses `MediaRecorder` to capture audio, uploads it to Supabase Storage (`interview-files` bucket), transcribes via Deepgram Nova-2, and uses Claude Sonnet 4 for extraction and question generation. The entire pipeline runs on Vercel serverless functions with Supabase as the persistence layer.

Adding video clip capabilities means:

1. **Capture**: Record webcam video alongside audio during the interview (opt-in).
2. **Store**: Upload raw video chunks to object storage during recording.
3. **Detect**: After interview completion, use AI to find the best 30-60 second moments.
4. **Cut & Render**: Extract clips with branded overlays, captions, and multi-format output.
5. **Deliver**: Host finished clips for embedding, download, and social sharing.

The core constraint is that Vercel functions have a 60-second timeout (Pro) and 4.5 MB request body limit. Video processing (transcoding, clip extraction, rendering) cannot run on Vercel. We need an off-platform compute layer.

**Recommended stack (detailed justification below):**

| Layer | Technology | Why |
|-------|-----------|-----|
| Browser capture | Native `MediaRecorder` API | Already used for audio; no SDK dependency needed |
| Chunk upload | Mux Direct Upload (tus-based) | Resumable, handles large files, zero server-side proxying |
| Raw storage | Mux (ingest + storage) | Handles transcoding automatically; $0.025/min encoding |
| Moment detection | Claude Sonnet 4 + Deepgram sentiment | Already in stack; word-level timestamps + sentiment per utterance |
| Clip rendering | Remotion + AWS Lambda | React-based overlays, branded templates, distributed rendering |
| Video delivery | Mux (HLS streaming + player) | Adaptive bitrate, embeddable React player, analytics built-in |
| Orchestration | Inngest | Background job queue that runs on Vercel without infra setup |

---

## 2. Current Architecture Analysis

### 2.1 Interview Flow (as-is)

```
Browser (/i/[token]/q/)
  └── VoiceFirstInput component
        ├── MediaRecorder (audio/webm;codecs=opus, 24kbps)
        ├── AudioContext + AnalyserNode (visual audio level)
        ├── On stop → FormData POST to /api/transcribe
        │     ├── Upload audio blob to Supabase Storage (interview-files/audio/{token}/{ts}.webm)
        │     └── Call Deepgram /v1/listen (nova-2-general, smart_format, punctuate)
        │           └── Return transcript + audioUrl + audioPath
        └── POST /api/interview/[token]/submit-answer
              ├── Insert user message (with audio_url, audio_path)
              ├── AI extraction (Claude Sonnet 4 via @ai-sdk/anthropic)
              ├── AI question generation
              └── On interview end:
                    ├── Generate draft (Claude)
                    ├── Split into review sections
                    ├── Send emails (Resend)
                    ├── Init reminders
                    └── Dispatch webhooks
```

### 2.2 Key Integration Points for Video

The video feature touches these exact files:

| File | Change |
|------|--------|
| `src/components/chat/voice-first-input.tsx` | Add webcam stream, dual MediaRecorder (audio + video), camera preview UI |
| `src/app/i/[token]/q/page.tsx` | Add video toggle state, pass video data through `handleSendMessage` |
| `src/app/api/transcribe/route.ts` | Accept video alongside audio, upload video chunks to Mux |
| `src/app/api/interview/[token]/submit-answer/route.ts` | Store video metadata per message, trigger clip pipeline on interview end |
| `src/lib/supabase/types.ts` | Add video-related types (VideoClip, VideoAsset) |
| `supabase-schema.sql` | Add `video_clips` table, add `video_url`/`video_asset_id` columns to messages |
| New: `src/app/api/interview/[token]/clips/route.ts` | Retrieve generated clips for a completed interview |
| New: `src/lib/video/moments.ts` | AI moment detection logic |
| New: `src/lib/video/render.ts` | Remotion render trigger (calls Remotion Lambda) |

### 2.3 Constraints

- **Vercel Pro function timeout**: 60 seconds (800 seconds with Fluid Compute, but best to avoid)
- **Vercel request body limit**: 4.5 MB (video CANNOT be proxied through Vercel functions)
- **Supabase Storage**: 50 MB file limit per upload (current setting in upload route)
- **Current Deepgram call**: Uses `nova-2-general` without word-level timestamps — needs `utterances=true` and `smart_format=true` params
- **No GPU compute**: Current stack is entirely serverless/edge; video processing needs GPU or at minimum heavy CPU

---

## 3. Browser-Side Video Capture

### 3.1 MediaRecorder API vs. Third-Party SDKs

| Option | Pros | Cons | Cost |
|--------|------|------|------|
| **Native MediaRecorder** | Already in codebase; zero dependency; full control; works offline | Cross-browser codec differences; no cloud recording fallback; DIY chunked upload | Free |
| **Mux Uploader (`<mux-uploader>`)** | Handles chunked upload, resumable (tus), progress UI; React component available | Does not handle recording — only upload | Free (upload SDK) |
| **Daily.co SDK** | Cloud recording; SFU architecture; handles poor connectivity | Overkill for single-person recording; $0.04/min cloud recording; adds 200KB+ SDK | $$$ |
| **LiveKit SDK** | Open-source; self-hostable; composite recording | Server infra required; overkill for 1-person webcam | $$$ (infra) |
| **Whereby Embedded** | Drop-in iframe; recording built in | Not suitable — this is an interview with an AI, not a 2-person call | $$$ |

**Recommendation: Native MediaRecorder for capture + Mux Direct Upload for upload.**

Rationale: Quotd is a single-person webcam recording (the customer talks to an AI). There is no second participant, no SFU needed, no WebRTC peer connection. The current codebase already uses `MediaRecorder` for audio. Extending it to capture video is a small incremental change. Daily.co and LiveKit are designed for multi-party real-time communication and would add unnecessary complexity and cost.

### 3.2 Codec Selection

```
Browser Support Matrix (2025-2026):

                    Chrome  Firefox  Safari  Edge
VP8 + Opus (webm)    Yes     Yes      No     Yes
VP9 + Opus (webm)    Yes     No       No     Yes
H.264 + AAC (mp4)    Yes*    No       Yes    Yes*
AV1 + Opus (webm)    Yes**   No       No     Yes**

* Chrome MP4 support via MediaRecorder is limited/buggy
** AV1 encoding is slow in software; needs hardware support
```

**Recommendation: VP8 + Opus in WebM container as primary, with H.264 + AAC fallback for Safari.**

VP8 is the most universally supported codec for `MediaRecorder` across Chrome, Firefox, and Edge. Safari does not support WebM recording but does support H.264 in MP4 (via `MediaRecorder` since Safari 14.1). The codec detection pattern already exists in `voice-first-input.tsx` — extend it:

```typescript
function getVideoMimeType(): string {
  const types = [
    'video/webm;codecs=vp8,opus',    // Chrome, Firefox, Edge
    'video/webm;codecs=vp9,opus',    // Chrome, Edge (better quality)
    'video/webm',                     // Fallback webm
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // Safari
    'video/mp4',                      // Safari fallback
  ];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
}
```

VP9 offers ~30% better compression than VP8 at same quality, but Firefox does not support it. Since Mux transcodes all uploads to HLS (H.264 + AAC) server-side anyway, the browser codec choice only affects upload size, not final delivery quality.

### 3.3 Simultaneous Audio Transcription + Video Recording — Timestamp Sync

This is the critical technical challenge. The current flow records audio, stops, uploads the full blob, and gets a transcript. For video clips, we need word-level timestamps aligned to the video timeline.

**Architecture:**

```
getUserMedia({ audio: true, video: true })
  │
  ├── Stream → MediaRecorder (video/webm;codecs=vp8,opus)
  │     └── Records audio + video together (single file, synced)
  │
  ├── Stream → Audio-only track → MediaRecorder (audio/webm;codecs=opus)
  │     └── Sent to /api/transcribe for Deepgram (as today)
  │
  └── Stream → AudioContext → AnalyserNode (visual level, as today)
```

Two parallel `MediaRecorder` instances from the same `MediaStream`:

1. **Video recorder**: Captures video+audio in WebM. Uploads chunks to Mux via Direct Upload.
2. **Audio recorder**: Captures audio-only. On stop, sends to Deepgram for transcription (same as today).

Because both recorders derive from the same `MediaStream` and start at the same `performance.now()` timestamp, their timelines are inherently synchronized. Deepgram returns word-level timestamps relative to audio start; these map 1:1 to video timestamps.

**Deepgram API changes needed:**

Current call:
```
/v1/listen?model=nova-2-general&language=en-US&smart_format=true&punctuate=true
```

Updated call (add utterances + word-level timestamps + sentiment):
```
/v1/listen?model=nova-2-general&language=en-US&smart_format=true&punctuate=true
  &utterances=true&detect_language=false&sentiment=true
```

This returns:
- `results.utterances[]` — each with `.start`, `.end`, `.transcript`, `.sentiment`, `.sentiment_score`
- `results.channels[0].alternatives[0].words[]` — each with `.word`, `.start`, `.end`, `.confidence`

Cost: Sentiment analysis is included in Deepgram's pay-as-you-go pricing at no additional charge for Nova-2.

### 3.4 Chunk Upload Strategy

A 10-minute interview at 720p/VP8/1.5Mbps produces ~110 MB. This cannot be uploaded as a single blob (Vercel body limit is 4.5 MB, Supabase Storage limit is 50 MB per upload).

**Solution: Client-side direct upload to Mux using `@mux/mux-uploader-react`.**

Flow:
1. Before recording starts, call `POST /api/video/create-upload` — this hits Mux's "Create Direct Upload" API and returns a signed upload URL.
2. The browser uses Mux's Upchunk library (tus-based resumable upload) to stream video chunks directly to Mux. No data passes through Vercel.
3. `MediaRecorder.start(5000)` — emit 5-second chunks via `ondataavailable`.
4. Each chunk is appended to the tus upload in-flight.
5. On `MediaRecorder.stop()`, finalize the upload.
6. Mux sends a webhook (`video.asset.ready`) when transcoding is complete.

This approach:
- Avoids Vercel's body size limit entirely (upload goes directly to Mux's GCS bucket)
- Handles network interruptions (tus is resumable)
- Works on mobile browsers (chunked upload keeps memory stable)
- Lets recording and upload happen concurrently (no waiting for recording to finish before uploading)

### 3.5 Camera/Mic Permission UX Best Practices

Lessons from building at Vidyard and studying Loom, mmhmm:

1. **Progressive permission request**: Do NOT ask for camera on page load. Show the interview in voice-only mode first (as today). Add a "Turn on camera" toggle. Only request `getUserMedia({ video: true })` when the user explicitly opts in.

2. **Pre-permission prompt**: Before triggering the browser permission dialog, show a custom UI explaining why camera access is needed: "Your video helps create authentic case study clips. You can review everything before it's shared."

3. **Graceful degradation**: If camera is denied, fall back to voice-only seamlessly. If camera stops mid-interview (lid closed, tab backgrounded), continue audio-only recording. Resume video when camera returns.

4. **Camera preview**: Show a small self-view (picture-in-picture style) in the bottom-right corner so the user can see themselves. Loom and Vidyard both do this. Use a `<video>` element with `srcObject={stream}` and `muted autoPlay playsInline`.

5. **Recording indicator**: Show a clear red dot + "REC" indicator during video recording. This is both a UX best practice and a legal consideration (users must know they're being recorded).

6. **Permission state persistence**: Check `navigator.permissions.query({ name: 'camera' })` to detect if permission was previously granted. If so, skip the pre-permission prompt on subsequent visits.

---

## 4. Video Storage & Processing Pipeline

### 4.1 Storage: Where to Put Raw Video

| Option | Storage Cost | Egress Cost | Transcoding | Max File Size | Integration Effort |
|--------|-------------|-------------|-------------|---------------|-------------------|
| **Supabase Storage** | Included in plan (250 GB) | 1 TB included, then $0.09/GB | None — DIY | 50 MB (configurable) | Already in stack |
| **Cloudflare R2** | $0.015/GB/mo | **Free** | None — DIY | 5 GB per upload | New integration |
| **AWS S3** | $0.023/GB/mo | $0.09/GB | None — DIY | 5 TB | New integration |
| **Mux** | $0.003/min stored | Included in delivery price | **Automatic** (HLS, multiple resolutions) | Unlimited (tus upload) | New integration |

**Recommendation: Mux for video, keep Supabase Storage for audio and files.**

Rationale:
- Mux handles the entire video lifecycle: upload, transcode, store, deliver via HLS, embed via player. One vendor instead of stitching together S3 + ffmpeg + CDN + player.
- Mux Direct Upload means video never touches Vercel (critical given the 4.5 MB body limit).
- Mux's "Basic" quality tier has **no encoding cost** — you only pay for storage ($0.003/min) and delivery ($0.00096/min).
- Supabase Storage stays for audio recordings and file attachments (unchanged).
- R2 is excellent for static assets but would require building a separate transcoding pipeline.

### 4.2 Transcoding Pipeline

With Mux, transcoding is fully managed:

1. Video uploaded via Direct Upload (browser → Mux GCS bucket).
2. Mux automatically creates:
   - HLS manifest with multiple renditions (360p, 540p, 720p, 1080p)
   - MP4 static rendition (for download)
   - Thumbnail sprites
   - Storyboard for seek preview
3. Asset becomes `ready` in ~1-2x real-time (a 10-minute video is ready in 10-20 minutes).
4. Webhook `video.asset.ready` fires → our API stores the `playbackId` and `assetId`.

For **clip extraction** (cutting a 30-60s segment from the full interview), Mux does not offer server-side clip extraction as of 2026. Two options:

**Option A: Mux Clip URL (client-side)**
Mux supports playback start/end parameters: `https://stream.mux.com/{playbackId}.m3u8?start=30&end=90`. This "clips" at the HLS level — no re-encoding needed, instant. However, it is not a standalone file — it requires the Mux player.

**Option B: Remotion Lambda for standalone clips**
For downloadable clips with overlays, branded lower thirds, and burned-in captions, use Remotion to compose the clip:
- Fetch the Mux MP4 static rendition URL for the source video
- Remotion renders the clip segment with overlays
- Output: standalone MP4 files in multiple aspect ratios

This is the approach we recommend — detailed in Section 6.

### 4.3 Vercel's Limitations — What Runs Where

| Task | Where It Runs | Why |
|------|--------------|-----|
| Camera permission + recording | Browser | Native API |
| Chunk upload to Mux | Browser → Mux (direct) | Bypass Vercel body limit |
| Audio transcription (Deepgram) | Vercel function | Small payload (~100KB audio blob); < 10s |
| Answer extraction (Claude) | Vercel function | Text-only; < 30s |
| Create Mux upload URL | Vercel function | Simple API call; < 2s |
| Moment detection (Claude) | Inngest step function | Runs after interview ends; may take 30-60s |
| Clip rendering (Remotion) | AWS Lambda (Remotion Lambda) | CPU-intensive; 30-120s per clip |
| Webhook receipt (Mux asset ready) | Vercel function | Simple payload; < 2s |
| Clip metadata storage | Vercel function | DB write; < 2s |

**Inngest** is the orchestration layer. When the interview completes (`submit-answer` sets status to `review_pending`), dispatch an Inngest event. Inngest calls back to Vercel functions in steps:

```
Step 1: Wait for Mux asset.ready webhook (or poll)
Step 2: Call moment detection (Claude analysis of transcript + sentiment data)
Step 3: For each identified moment, trigger Remotion Lambda render
Step 4: Wait for all renders to complete
Step 5: Store clip URLs in database, send notification email
```

Each step is individually retried and has its own timeout. The total pipeline can take 5-15 minutes, far beyond any single Vercel function timeout.

---

## 5. AI-Powered Moment Detection & Clip Extraction

### 5.1 Signal Stack for Finding Best Moments

At OpusClip, the moment detection pipeline uses a multi-signal approach. Here is the adapted version for Quotd:

| Signal | Source | Weight | What It Captures |
|--------|--------|--------|-----------------|
| **Sentiment peaks** | Deepgram utterance-level sentiment | High | Emotional moments — enthusiasm, conviction, gratitude |
| **Metric mentions** | Claude extraction (already in `ExtractionState.metrics`) | High | "We increased revenue by 40%" — hard numbers are gold for case studies |
| **Quote quality** | Claude extraction (already in `ExtractionState.quotes`) | High | Quotable one-liners tagged by the extraction AI |
| **Speech energy** | Deepgram word confidence + speaking rate | Medium | Fast/confident speech indicates emphasis and passion |
| **Keyword density** | Transcript analysis | Medium | Product name mentions, competitor names, transformation words ("before/after", "changed", "transformed") |
| **Narrative arc** | Claude structured analysis | Medium | Challenge → Solution → Impact structure within a single answer |
| **Pause patterns** | Deepgram word timestamps (gaps > 1s) | Low | Dramatic pauses before key statements |

### 5.2 Moment Detection Algorithm

Input: Full transcript with word-level timestamps, utterance-level sentiment, extraction state.

```typescript
// src/lib/video/moments.ts

type MomentCandidate = {
  start_time: number;      // seconds into video
  end_time: number;
  transcript: string;
  score: number;           // 0-100
  signals: string[];       // which signals fired
  category: 'metric' | 'quote' | 'narrative' | 'emotion';
};

async function detectMoments(
  transcript: DeepgramTranscript,
  extractionState: ExtractionState,
  targetClipCount: number = 3
): Promise<MomentCandidate[]> {
  // Step 1: Score each utterance using the signal stack
  // Step 2: Merge adjacent high-scoring utterances into moment windows
  // Step 3: Snap boundaries to sentence boundaries (using word timestamps)
  // Step 4: Filter to 30-60 second duration range
  // Step 5: De-duplicate overlapping moments, keep highest score
  // Step 6: Use Claude to validate/rank top candidates
  // Step 7: Return top N moments
}
```

### 5.3 Claude-Powered Moment Validation

After algorithmic scoring, pass the top 8-10 candidates to Claude for final ranking:

```
You are a video editor for B2B case studies. Given these candidate moments
from a customer interview, rank them by how compelling they would be as
standalone video clips for LinkedIn, sales decks, and website hero sections.

For each candidate, score 1-10 on:
- Standalone clarity: Does it make sense without context?
- Emotional impact: Would a viewer feel something?
- Business credibility: Does it contain specific results or authority?
- Shareability: Would someone repost this on LinkedIn?

Return the top 3 moments with adjusted start/end times if the boundaries
should be tightened or expanded for narrative completeness.
```

This is a single Claude call (~2K input tokens, ~500 output tokens) — fast and cheap.

### 5.4 Clip Boundary Detection

Finding natural start/end points is critical. A clip that starts mid-sentence or cuts off a punchline is unusable.

**Rules:**
1. Start boundary: Snap to the beginning of the sentence containing the moment start. Use Deepgram's word timestamps to find the previous period/question-mark.
2. End boundary: Snap to the end of the sentence containing the moment end. Include a 0.5-second padding after the last word.
3. Minimum duration: 15 seconds (shorter clips lack context).
4. Maximum duration: 90 seconds (longer clips lose attention).
5. Target duration: 30-60 seconds (optimal for LinkedIn and social).
6. Add 1 second of padding at start (visual breathing room before speaker begins).

### 5.5 What OpusClip and Vizard Do Under the Hood

Based on public information and reverse engineering from my time in the space:

**OpusClip:**
- Transcribes with Whisper-large-v3 (or equivalent)
- Runs a proprietary "ClipAnything" model that scores moments on multiple axes
- Uses an "AI B-Roll" detector for visual scene changes
- Generates a "Virality Score" (0-100) combining hook quality, emotional peaks, and topic relevance
- Renders clips with auto-captions using a template engine (likely custom, not Remotion)
- Outputs 9:16, 1:1, and 16:9 simultaneously

**Vizard:**
- Transcribes and segments into "scenes" using speech pauses and topic shifts
- AI analyzes hooks (first 3 seconds of each candidate), sentiment peaks, and pacing
- Proprietary "Vitality Score" for engagement prediction
- Auto-reframe: Uses face detection to keep the speaker centered when cropping to 9:16
- Built-in caption editor with word-level highlighting

**Key insight:** Both tools fundamentally rely on transcript analysis + sentiment for moment selection. The video-specific analysis (face detection, scene changes) is secondary and mostly used for reframing, not moment selection. For Quotd's use case (single-person webcam interview with static framing), transcript-based detection is sufficient.

### 5.6 Optional: Advanced Signals

These are not needed for v1 but can differentiate the product later:

**Hume AI Speech Prosody ($0.064/min audio-only):**
- Measures 48 dimensions of emotional meaning from voice tone, rhythm, timbre
- Could detect excitement, confidence, nostalgia — signals that pure text analysis misses
- API is simple: send audio, get per-second emotion scores
- Add as a scoring signal in moment detection

**Facial Expression Analysis (Hume AI, $0.083/min video+audio):**
- Detect smiling, emphasis, engagement from face
- Useful for thumbnail selection (pick a frame where speaker is smiling + engaged)
- Not needed for moment detection (transcript signals are sufficient)

---

## 6. Video Editing & Output

### 6.1 Programmatic Video Editing: Remotion vs. FFmpeg vs. Creatomate

| Feature | Remotion | FFmpeg (fluent-ffmpeg) | Creatomate |
|---------|----------|----------------------|------------|
| Overlay design | React components (full design control) | CLI filters (limited, ugly) | Template editor (drag & drop) |
| Caption styles | Custom React components with animations | Basic ASS/SRT burn-in | Pre-built styles |
| Branded templates | Full React/Tailwind/CSS | Not practical | Template library |
| Serverless rendering | AWS Lambda (Remotion Lambda) | Modal/Lambda + ffmpeg binary | Cloud API |
| Multi-format output | Render separately per aspect ratio | Single ffmpeg command per format | API parameter |
| Cost per render | ~$0.001-0.01 per clip (Lambda compute) | ~$0.01-0.05 per clip (compute) | $0.25-2.00 per credit |
| Learning curve | React developers = zero | ffmpeg expertise needed | Low (templates) |
| Source code control | Full (open source, self-hosted) | Full | None (SaaS) |

**Recommendation: Remotion + Remotion Lambda.**

Rationale:
- Quotd is a React/Next.js app. The team already writes React. Remotion compositions are React components — same language, same tooling, same design system.
- Remotion Lambda renders clips on AWS Lambda with distributed parallelization. A 60-second clip renders in 10-30 seconds. Cost is ~$0.001-0.01.
- Full design control for branded overlays: company logo, speaker name, lower thirds, animated captions. These are just React components.
- FFmpeg is a viable alternative for pure clip extraction (no overlays), but the moment you need branded overlays, ffmpeg becomes a nightmare of filter chains.
- Creatomate is a good alternative if the team doesn't want to manage Remotion Lambda infrastructure, but at $41-249/month with credit-based pricing, it becomes expensive at scale.

### 6.2 Branded Overlay System

Each clip gets these overlay layers (all React components in Remotion):

```
┌──────────────────────────────────┐
│  ┌─────────────────────────┐     │
│  │                         │     │
│  │      Video Frame        │     │
│  │    (from Mux MP4)       │     │
│  │                         │     │
│  │                         │     │
│  │                         │     │
│  ├─────────────────────────┤     │
│  │ ▪ Speaker Name          │     │  ← Lower third (slide in, 3s)
│  │   VP Engineering, Acme  │     │
│  ├─────────────────────────┤     │
│  │                         │     │
│  │  "We reduced deploy     │     │  ← Animated captions
│  │   time by 75%"          │     │    (word-by-word highlight)
│  │                         │     │
│  └─────────────────────────┘     │
│  [Company Logo]      [quotd.ai]  │  ← Branding bar
└──────────────────────────────────┘
```

The branding data (logo, primary color, company name) already exists in Quotd's `profiles` table and `getBrandingForInterview()` function. The Remotion composition receives these as input props.

### 6.3 Output Formats

| Format | Aspect Ratio | Resolution | Use Case |
|--------|-------------|-----------|----------|
| LinkedIn / TikTok | 9:16 (vertical) | 1080x1920 | Social feed, Stories, Shorts |
| Instagram / X | 1:1 (square) | 1080x1080 | Social feed, carousel |
| Website / Sales Deck | 16:9 (horizontal) | 1920x1080 | Hero section, presentations |

For vertical (9:16) output from a horizontal webcam recording, the video frame is centered and scaled to fill width, with overlay space above/below. This is the standard approach used by OpusClip, Vizard, and Headliner.

Each format is a separate Remotion composition that takes the same input props but arranges the layout differently. All three render in parallel on Remotion Lambda.

### 6.4 Caption/Subtitle Rendering

Two approaches:

**Burned-in captions (recommended for social clips):**
- Word-by-word highlighting synced to Deepgram timestamps
- TikTok/Reels-style animated text (pop-in, highlight current word)
- Remotion's `@remotion/captions` package handles SRT parsing and frame-level sync
- Font: Bold sans-serif, white text with black outline/background

**Soft subtitles (for embeddable player):**
- Generate VTT file from Deepgram transcript
- Mux Player supports VTT tracks natively
- User can toggle on/off

For social clips, burned-in captions are non-negotiable — 85% of LinkedIn video is watched without sound.

### 6.5 Thumbnail Generation

Three approaches, in order of quality:

1. **AI-selected best frame**: Use Deepgram's word timestamps to find the frame at the emotional peak of the clip (highest sentiment score). Extract that frame from the Mux static rendition using `Mux Image API`: `https://image.mux.com/{playbackId}/thumbnail.jpg?time=42.5&width=1280`. Free and instant.

2. **Branded thumbnail**: Render a Remotion still frame with the quote text overlaid on a blurred background of the speaker. This is what LinkedIn native video does for preview thumbnails.

3. **FFmpeg frame extraction**: `ffmpeg -ss 42.5 -i input.mp4 -frames:v 1 -q:v 2 thumbnail.jpg`. Simple but requires compute.

**Recommendation: Use Mux's Image API for v1 (free, instant, no compute). Add Remotion-rendered branded thumbnails in v2.**

---

## 7. Delivery & Embedding

### 7.1 Video Hosting & CDN

| Option | Pricing | HLS | Player | Analytics | CDN |
|--------|---------|-----|--------|-----------|-----|
| **Mux** | $0.003/min stored + $0.00096/min delivered | Yes (auto) | `@mux/mux-player-react` | Built-in (Mux Data) | Global |
| **Cloudflare Stream** | $5/mo + $1/1K min delivered | Yes | `<stream>` element | Basic | Cloudflare |
| **Bunny Stream** | $60/year flat | Yes | Custom player | Basic | 100+ PoPs |
| **Self-hosted (R2 + HLS.js)** | $0.015/GB/mo storage | DIY (ffmpeg) | HLS.js / Video.js | DIY | R2 (free egress) |

**Recommendation: Mux for full-interview playback and clip delivery.**

Since we already use Mux for upload and transcoding, using Mux for delivery is the natural choice:
- Single vendor for the entire video pipeline
- `@mux/mux-player-react` is a drop-in React component with adaptive bitrate, quality selector, and built-in analytics
- No CDN configuration needed — Mux handles global delivery
- Signed URLs for access control (only interview owner + customer can view)

For **rendered clips** (the Remotion output), store the MP4 files on Cloudflare R2 ($0.015/GB/mo, free egress) and serve via R2's public URL. These are small files (30-60s MP4, ~5-15 MB each) that don't need HLS streaming. Progressive download is fine.

### 7.2 Embeddable Video Player

For the dashboard (`/dashboard/[id]`), add a "Video Clips" section:

```tsx
import MuxPlayer from '@mux/mux-player-react';

// Full interview replay
<MuxPlayer
  playbackId={interview.mux_playback_id}
  metadata={{ video_title: `${interview.customer_company} Interview` }}
  accent-color={branding.primary_color}
/>

// Individual clip (rendered MP4 from R2)
<video
  src={clip.mp4_url}
  controls
  poster={clip.thumbnail_url}
  className="rounded-lg"
/>
```

### 7.3 Shareable Clip Pages

Create a public clip page at `/c/[clipId]` with:
- Embedded video player (progressive MP4)
- "Download" button (direct R2 link)
- "Share to LinkedIn" button (pre-filled post with video)
- "Embed" button (copy iframe/embed code)
- Branding: creator's logo, company name

### 7.4 Social Media Direct Upload

**LinkedIn Videos API:**
- OAuth 2.0 required (user must connect LinkedIn account)
- Upload flow: `registerUpload` → upload video binary → `createShare`
- Supports custom thumbnails, captions (VTT)
- Requires LinkedIn Marketing API access (applied for separately)

**X (Twitter) API:**
- Media upload via chunked upload endpoint
- 140-second max video length (our clips are 30-60s, fits perfectly)
- Requires Twitter Developer account

**Implementation approach:** v1 ships with download + copy-to-clipboard share link. v2 adds direct social publish via OAuth connections managed in the dashboard settings.

---

## 8. Architecture Recommendation

### 8.1 Full Pipeline Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BROWSER                                       │
│                                                                         │
│  getUserMedia({ audio, video })                                         │
│       │                                                                 │
│       ├── Audio track ──→ MediaRecorder (opus) ──→ POST /api/transcribe │
│       │                                             ├── Supabase Storage│
│       │                                             └── Deepgram API    │
│       │                                                  (+ sentiment   │
│       │                                                   + utterances) │
│       │                                                                 │
│       ├── Video+Audio ──→ MediaRecorder (vp8+opus)                      │
│       │                       │                                         │
│       │                       └── Upchunk (tus) ──→ Mux Direct Upload   │
│       │                            (5s chunks)       (no Vercel proxy)  │
│       │                                                                 │
│       └── Video track ──→ <video> self-view (PiP)                       │
│                                                                         │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      VERCEL FUNCTIONS                                   │
│                                                                         │
│  /api/transcribe                                                        │
│    └── Deepgram → transcript + word timestamps + sentiment              │
│                                                                         │
│  /api/interview/[token]/submit-answer                                   │
│    └── Claude extraction + question generation (unchanged)              │
│    └── On interview end: dispatch Inngest event "video.process"         │
│                                                                         │
│  /api/video/create-upload                                               │
│    └── Mux API: create direct upload → return signed URL                │
│                                                                         │
│  /api/webhooks/mux (POST)                                               │
│    └── Receive Mux asset.ready → store playbackId in DB                 │
│                                                                         │
│  /api/interview/[token]/clips (GET)                                     │
│    └── Return generated clips for completed interview                   │
│                                                                         │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      INNGEST (Orchestration)                            │
│                                                                         │
│  Event: "video.process"                                                 │
│                                                                         │
│  Step 1: Wait for Mux asset to be ready (poll or webhook signal)        │
│  Step 2: Fetch full transcript with timestamps + sentiment              │
│  Step 3: Run moment detection (Claude + scoring algorithm)              │
│  Step 4: For each moment (typically 3):                                 │
│     ├── Trigger Remotion Lambda render (9:16)                           │
│     ├── Trigger Remotion Lambda render (1:1)                            │
│     └── Trigger Remotion Lambda render (16:9)                           │
│  Step 5: Wait for all renders to complete                               │
│  Step 6: Upload rendered clips to Cloudflare R2                         │
│  Step 7: Generate thumbnails (Mux Image API)                            │
│  Step 8: Store clip metadata in video_clips table                       │
│  Step 9: Send notification email (clips ready)                          │
│  Step 10: Dispatch webhook event "clips.generated"                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                                    │
│                                                                         │
│  Mux:                                                                   │
│    ├── Direct Upload (browser → Mux)                                    │
│    ├── Transcoding (automatic, HLS + MP4)                               │
│    ├── Storage ($0.003/min)                                             │
│    ├── Delivery via HLS ($0.00096/min)                                  │
│    ├── Image API (thumbnails)                                           │
│    └── Player (@mux/mux-player-react)                                   │
│                                                                         │
│  Remotion Lambda (AWS):                                                 │
│    ├── Render clips with React overlays                                 │
│    ├── Output: MP4 files (3 aspect ratios x N clips)                    │
│    └── Cost: ~$0.001-0.01 per render                                    │
│                                                                         │
│  Cloudflare R2:                                                         │
│    ├── Store rendered clip MP4s                                         │
│    └── Serve via public URL (free egress)                               │
│                                                                         │
│  Deepgram (enhanced):                                                   │
│    └── Word timestamps + utterance sentiment                            │
│                                                                         │
│  Claude Sonnet 4 (existing):                                            │
│    └── Moment validation/ranking                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Database Schema Additions

```sql
-- Video assets (one per interview, represents full recording)
CREATE TABLE video_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
  mux_asset_id TEXT NOT NULL,
  mux_playback_id TEXT,
  mux_upload_id TEXT,
  status TEXT DEFAULT 'uploading', -- uploading, processing, ready, errored
  duration_seconds NUMERIC,
  resolution TEXT,                 -- e.g., '1280x720'
  transcript_with_timestamps JSONB, -- Deepgram full response
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_video_assets_interview ON video_assets(interview_id);
CREATE INDEX idx_video_assets_mux_asset ON video_assets(mux_asset_id);

-- Video clips (multiple per interview, generated by AI)
CREATE TABLE video_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
  video_asset_id UUID REFERENCES video_assets(id) ON DELETE CASCADE,
  title TEXT,                       -- AI-generated title
  description TEXT,                 -- AI-generated description
  category TEXT,                    -- 'metric', 'quote', 'narrative', 'emotion'
  score INTEGER,                    -- 0-100 moment score
  start_time NUMERIC NOT NULL,      -- seconds into original video
  end_time NUMERIC NOT NULL,
  transcript TEXT,                  -- clip transcript text
  signals TEXT[],                   -- signals that identified this moment

  -- Rendered outputs (one URL per aspect ratio)
  mp4_16x9_url TEXT,               -- 1920x1080 horizontal
  mp4_1x1_url TEXT,                -- 1080x1080 square
  mp4_9x16_url TEXT,               -- 1080x1920 vertical
  thumbnail_url TEXT,

  -- Rendering metadata
  render_status TEXT DEFAULT 'pending', -- pending, rendering, ready, failed
  rendered_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_video_clips_interview ON video_clips(interview_id);
CREATE INDEX idx_video_clips_status ON video_clips(render_status);

-- Add video columns to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS video_asset_id UUID REFERENCES video_assets(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS video_timestamp_start NUMERIC;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS video_timestamp_end NUMERIC;

-- Add video flag to interviews table
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS video_enabled BOOLEAN DEFAULT false;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS video_asset_id UUID REFERENCES video_assets(id);
```

### 8.3 Build vs. Buy Decision Matrix

| Capability | Build | Buy | Decision | Justification |
|-----------|-------|-----|----------|---------------|
| Browser recording | MediaRecorder (build) | Daily.co ($0.04/min) | **Build** | Single-person recording; API already used for audio |
| Upload | Upchunk + Mux Direct Upload | — | **Buy (Mux)** | Resumable upload is complex to build; Mux handles it |
| Transcoding | ffmpeg on Modal/Lambda | Mux (automatic) | **Buy (Mux)** | Transcoding is solved; build = months of ffmpeg pain |
| Moment detection | Claude + Deepgram (build) | OpusClip API (none exists) | **Build** | Core differentiator; no API exists for B2B-specific moment detection |
| Clip rendering | Remotion Lambda (build) | Creatomate ($41-249/mo) | **Build** | Full design control; React-native; <1 cent per render |
| Video delivery | Mux Player (buy) | — | **Buy (Mux)** | Best-in-class React player with analytics |
| Clip storage | R2 (buy) | — | **Buy (R2)** | Cheapest storage with free egress |
| Orchestration | Inngest (buy) | — | **Buy** | Already designed for Vercel + Next.js; free tier generous |

---

## 9. Cost Analysis

### 9.1 Per-Interview Cost (10-minute video interview)

| Component | Calculation | Cost |
|-----------|------------|------|
| Mux encoding (Basic quality) | 10 min x $0.00/min | $0.00 |
| Mux storage (30 days) | 10 min x $0.003/min | $0.03 |
| Mux delivery (3 views) | 30 min delivered x $0.00096/min | $0.03 |
| Deepgram transcription | 10 min x $0.0043/min (Nova-2 pay-as-you-go) | $0.04 |
| Deepgram sentiment | Included with transcription | $0.00 |
| Claude moment detection | ~3K tokens | $0.02 |
| Remotion Lambda renders | 3 clips x 3 formats = 9 renders x $0.005 | $0.05 |
| R2 clip storage | 9 clips x ~10 MB = 90 MB x $0.015/GB/mo | $0.001 |
| R2 clip delivery | Free egress | $0.00 |
| Inngest orchestration | Free tier (25K events/mo) | $0.00 |
| **Total per interview** | | **~$0.17** |

### 9.2 Monthly Cost Projections

| Scale | Interviews/mo | Video Cost/mo | Current Cost (voice-only) | Delta |
|-------|--------------|---------------|--------------------------|-------|
| Early | 50 | $8.50 | ~$5 | +$3.50 |
| Growth | 500 | $85 | ~$50 | +$35 |
| Scale | 5,000 | $850 | ~$500 | +$350 |

### 9.3 Fixed Monthly Costs

| Service | Plan | Monthly Cost |
|---------|------|-------------|
| Mux | Pay-as-you-go | $0 base |
| Remotion | Company license (>$10M ARR: $500/mo; <$10M: free) | $0 (startup) |
| Cloudflare R2 | Pay-as-you-go | $0 base |
| Inngest | Free tier (25K events, 5 concurrent) | $0 |
| AWS Lambda (Remotion) | Pay-per-invocation | ~$0 (covered in per-interview) |

**Bottom line:** Video clips add roughly $0.17 per interview. At the $199/mo Pro tier, customers would need to do 1,170+ interviews/month before the video cost exceeds the subscription revenue per customer. This is a highly profitable feature.

---

## 10. Migration & Rollout Plan

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Mux account and API keys
- [ ] Create `/api/video/create-upload` endpoint
- [ ] Create `/api/webhooks/mux` endpoint
- [ ] Add `video_assets` and `video_clips` tables to Supabase
- [ ] Set up Inngest account and integration
- [ ] Deploy Remotion Lambda to AWS (one-time setup)

### Phase 2: Browser Capture (Week 2-3)
- [ ] Extend `VoiceFirstInput` with camera toggle and dual-recorder
- [ ] Add camera preview (PiP self-view)
- [ ] Implement Mux Direct Upload with Upchunk
- [ ] Update `/api/transcribe` to request utterances + sentiment from Deepgram
- [ ] Store `video_asset_id` on interview and messages

### Phase 3: Moment Detection (Week 3-4)
- [ ] Build `src/lib/video/moments.ts` — scoring algorithm
- [ ] Build Claude validation prompt for moment ranking
- [ ] Create Inngest function for the post-interview pipeline
- [ ] Wire up Mux `asset.ready` webhook to trigger pipeline
- [ ] Test with real interview recordings

### Phase 4: Clip Rendering (Week 4-5)
- [ ] Build Remotion compositions (3 aspect ratios)
- [ ] Implement branded overlay system (logo, lower third, captions)
- [ ] Implement animated caption rendering from Deepgram word timestamps
- [ ] Test Remotion Lambda renders end-to-end
- [ ] Upload rendered clips to R2, store URLs in DB

### Phase 5: Dashboard & Delivery (Week 5-6)
- [ ] Add "Video Clips" section to `/dashboard/[id]` page
- [ ] Add full-interview replay with Mux Player
- [ ] Build `/c/[clipId]` shareable clip page
- [ ] Add download buttons for all formats
- [ ] Add clip notification email template
- [ ] Add `clips.generated` webhook event

### Phase 6: Polish & GA (Week 6-7)
- [ ] Mobile browser testing (iOS Safari, Android Chrome)
- [ ] Error handling: camera denied, upload interrupted, render failed
- [ ] Loading states and progress indicators throughout pipeline
- [ ] Rate limiting on video uploads
- [ ] Analytics: track video opt-in rate, clip view count, download count
- [ ] Documentation updates

---

## 11. Open Questions & Risks

### Technical Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Safari MediaRecorder video support is inconsistent | Medium | Feature-detect and gracefully degrade to audio-only on unsupported browsers |
| Mux Direct Upload fails mid-interview (network) | Medium | Upchunk handles retries; worst case = audio-only interview (no data loss) |
| Remotion Lambda cold starts add latency | Low | Pre-warm with a scheduled invocation; clips are async anyway |
| Deepgram sentiment accuracy on B2B content | Medium | Combine with Claude validation; sentiment is one signal among many |
| Large videos (30+ min interviews) cost more | Low | Set a recording time limit (e.g., 30 min max); warn user at 25 min |

### Product Questions

1. **Opt-in vs. opt-out**: Should video be on by default or off by default? Recommendation: Off by default with a prominent "Enable video" toggle. The customer should feel zero pressure.

2. **Customer consent**: The customer is being recorded on video. The interview landing page (`/i/[token]`) should include a consent notice: "This interview may include video recording. You can turn off your camera at any time."

3. **Review before publish**: Should the customer be able to review/approve clips before they're shared? Recommendation: Yes — extend the existing review flow (`/i/[token]/review`) to include clip previews with approve/reject per clip.

4. **Creator vs. customer recording**: In v1, only the customer (interviewee) is recorded. In the future, could support a two-way video interview where both parties are on camera.

5. **Pricing tier**: Video clips should be a Pro feature ($199/mo). The per-interview cost ($0.17) is negligible, but video is a significant value differentiator.

### Deferred to v2

- Direct social media publishing (LinkedIn, X, Instagram)
- Hume AI prosody analysis for advanced moment detection
- AI-generated B-roll overlays (stock footage, data visualizations)
- Custom Remotion templates (user-uploadable brand kits)
- Video chapters / full interview highlights reel
- Multi-language caption support
- Real-time video preview during interview (live transcription overlay)
- Video analytics dashboard (view counts, engagement, social shares)

---

## References

### MediaRecorder & Browser Capture
- [MediaRecorder API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [MediaRecorder API Support — Can I Use](https://caniuse.com/mediarecorder)
- [HTML5 Media Recorder API in Action — AddPipe](https://blog.addpipe.com/mediarecorder-api/)
- [MediaRecorder MIME Types — TutorialPedia](https://www.tutorialpedia.org/blog/all-mime-types-supported-by-mediarecorder-in-firefox-and-chrome/)
- [Record Audio and Video with MediaRecorder — Chrome Developers](https://developer.chrome.com/blog/mediarecorder)
- [Dealing with Huge MediaRecorder Chunks — AddPipe](https://blog.addpipe.com/dealing-with-huge-mediarecorder-slices/)
- [Best Recording SDKs 2025 — Velt](https://velt.dev/blog/best-recording-sdks-2025-loom-style-video)

### Mux
- [Mux Pricing](https://www.mux.com/pricing)
- [Mux Pricing Calculator](https://www.mux.com/pricing/calculator)
- [Upload Files Directly — Mux Docs](https://www.mux.com/docs/guides/upload-files-directly)
- [Mux Uploader for Web — Mux Docs](https://www.mux.com/docs/guides/mux-uploader)
- [Direct Uploads with Mux — Blog](https://www.mux.com/blog/direct-uploads-with-mux-upload-button)
- [Adding Video to Next.js with Mux](https://www.mux.com/articles/adding-video-to-your-next-js-application)
- [Mux Player Core Functionality](https://www.mux.com/docs/guides/player-core-functionality)

### Deepgram
- [Working with Timestamps, Utterances, and Speaker Diarization — Deepgram](https://deepgram.com/learn/working-with-timestamps-utterances-and-speaker-diarization-in-deepgram)
- [Sentiment Analysis — Deepgram Docs](https://developers.deepgram.com/docs/sentiment-analysis)
- [Utterances — Deepgram Docs](https://developers.deepgram.com/docs/utterances)

### Hume AI
- [Hume AI Pricing](https://www.hume.ai/pricing)
- [Expression Measurement Overview — Hume Docs](https://dev.hume.ai/docs/expression-measurement/overview)
- [Hume AI — The AI Toolkit for Voice and Emotion](https://www.hume.ai/expression-measurement)

### Remotion
- [Remotion Lambda — Docs](https://www.remotion.dev/docs/lambda)
- [Remotion Lambda Cost Example](https://www.remotion.dev/docs/lambda/cost-example)
- [Creating Overlays — Remotion Docs](https://www.remotion.dev/docs/overlay)
- [Captions — Remotion Docs](https://www.remotion.dev/docs/captions/)
- [Comparison of Server-Side Rendering Options](https://www.remotion.dev/docs/compare-ssr)

### Storage & CDN
- [Supabase vs R2 (2026) — BuildMVPFast](https://www.buildmvpfast.com/compare/supabase-vs-r2)
- [Video Streaming Pricing Comparison (2026) — BuildMVPFast](https://www.buildmvpfast.com/api-costs/video)
- [Best Cloudflare Stream Alternatives (2026)](https://www.buildmvpfast.com/alternatives/cloudflare-stream)
- [Coconut.co Pricing](https://www.coconut.co/pricing)
- [Creatomate Pricing](https://creatomate.com/pricing)

### Vercel Limitations
- [Vercel Functions Limitations](https://vercel.com/docs/functions/limitations)
- [How to Bypass Vercel Body Size Limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)
- [Vercel Limits](https://vercel.com/docs/limits)

### Inngest
- [Long-Running Background Functions on Vercel — Inngest Blog](https://www.inngest.com/blog/vercel-long-running-background-functions)
- [Run Next.js Functions in Background — Inngest Blog](https://www.inngest.com/blog/run-nextjs-functions-in-the-background)
- [Inngest for Vercel — Vercel Marketplace](https://vercel.com/marketplace/inngest)
- [Background Jobs — Inngest Docs](https://www.inngest.com/docs/guides/background-jobs)

### Social Media APIs
- [LinkedIn Videos API — Microsoft Learn](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api)
- [How to Post to LinkedIn via API — Upload-Post](https://www.upload-post.com/how-to/post-to-linkedin-api)

### AI Clip Extraction (Competitors)
- [OpusClip](https://www.opus.pro/)
- [Vizard AI — Best AI Video Clipping Tools 2026](https://vizard.ai/blog/best-ai-video-clipping-tools-2026)
- [OpusClip vs Vizard — Wavel AI](https://wavel.ai/compare/opusclip-vs-vizard)
- [Video Sentiment Analysis Best Practices — Insight7](https://insight7.io/video-sentiment-analysis-best-practices/)

### FFmpeg
- [FFmpeg Subtitles — Cloudinary](https://cloudinary.com/guides/video-effects/ffmpeg-subtitles)
- [How to Add Subtitles to Video with FFmpeg — Bannerbear](https://www.bannerbear.com/blog/how-to-add-subtitles-to-a-video-file-using-ffmpeg/)
- [Faster Thumbnail Generation with FFmpeg Seeking](https://sebi.io/posts/2024-12-21-faster-thumbnail-generation-with-ffmpeg-seeking/)

### Modal Labs
- [Modal Pricing](https://modal.com/pricing)
