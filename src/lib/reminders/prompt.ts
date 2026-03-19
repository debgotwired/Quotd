export const REMINDER_PROMPT = `You are writing a follow-up email to a customer who completed a case study interview but hasn't reviewed the draft yet.

Company: {{company}}
Product: {{product}}
Interview facts: {{facts}}
Reminder tier: {{tier}} of 3

{{toneDirective}}

Write a short, personalized email. Reference specific details from the interview to show this isn't a generic reminder. The body should be 2-4 sentences in plain text (no HTML, no markdown). The subject line should be concise and compelling.

Do NOT include a greeting (like "Hi [Name]") or a sign-off. Just the core message.`;

export function buildReminderPrompt(
  company: string,
  product: string,
  facts: string,
  tier: number
): string {
  const toneDirectives: Record<number, string> = {
    1: "Tone: Warm and casual. 'Just checking in' energy. Reference something specific from the interview to make it personal.",
    2: "Tone: Slightly more direct. Mention the draft is waiting and ready. Add light urgency — the sooner they review, the sooner it can be published.",
    3: "IMPORTANT: This email goes to the CREATOR (the person who set up the interview), NOT the customer. Tell them their customer hasn't reviewed yet. Include a suggestion to follow up directly. Keep it helpful, not alarming.",
  };

  return REMINDER_PROMPT.replace("{{company}}", company)
    .replace("{{product}}", product)
    .replace("{{facts}}", facts)
    .replace("{{tier}}", String(tier))
    .replace("{{toneDirective}}", toneDirectives[tier] || toneDirectives[1]);
}
