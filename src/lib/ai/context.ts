export function buildCustomerContext(
  linkedinProfileUrl?: string | null,
  companyWebsiteUrl?: string | null
): string {
  const parts: string[] = [];
  if (linkedinProfileUrl) parts.push(`LinkedIn profile: ${linkedinProfileUrl}`);
  if (companyWebsiteUrl) parts.push(`Company website: ${companyWebsiteUrl}`);
  if (parts.length === 0) return "";
  return `\nCustomer Context:\n${parts.join("\n")}\n`;
}

const TONE_LABELS: Record<string, string> = {
  formal: "formal and professional",
  conversational: "warm and conversational",
  technical: "technical and precise",
};

const FOCUS_LABELS: Record<string, string> = {
  balanced: "balanced across ROI, technical details, and storytelling",
  roi: "heavily focused on ROI, cost savings, and revenue impact",
  technical: "focused on technical depth, implementation details, and architecture",
  storytelling: "focused on emotional storytelling, transformation narrative, and human impact",
};

const AUDIENCE_LABELS: Record<string, string> = {
  general: "a general business audience",
  c_suite: "C-suite executives (CEO, CFO, CTO) — focus on strategic impact and business outcomes",
  technical_buyer: "technical buyers (engineers, architects) — focus on implementation and technical merit",
  end_user: "end users and practitioners — focus on day-to-day experience and usability",
  board: "board members and investors — focus on market position, growth, and strategic value",
};

export function buildInterviewSettings(
  tone?: string | null,
  focus?: string | null,
  audience?: string | null
): string {
  const t = tone && TONE_LABELS[tone] ? tone : "conversational";
  const f = focus && FOCUS_LABELS[focus] ? focus : "balanced";
  const a = audience && AUDIENCE_LABELS[audience] ? audience : "general";

  // If all defaults, return empty — no need to clutter prompts
  if (t === "conversational" && f === "balanced" && a === "general") return "";

  const lines: string[] = [];
  lines.push(`Tone: ${TONE_LABELS[t]}`);
  lines.push(`Focus: ${FOCUS_LABELS[f]}`);
  lines.push(`Target audience: ${AUDIENCE_LABELS[a]}`);
  return `\nInterview Settings:\n${lines.join("\n")}\n`;
}
