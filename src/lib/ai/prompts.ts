export const EXTRACTION_PROMPT = `You extract structured data from case study interview answers.

Current extraction state:
{{state}}

Question asked: {{question}}
Customer's answer: {{answer}}

Extract any new information from this answer:
- Metrics: {name, baseline, after, delta, unit, timeframe, confidence}
- Quotes: {text (verbatim from the answer), tag (e.g., "impact", "challenge", "praise", "outcome")}
- Facts: challenge (what problem they faced), solution (how the product helped), impact (overall business impact)

Rules:
- Only extract explicitly stated information
- Never guess or infer numbers - only extract exact figures mentioned
- Confidence levels:
  - high: exact numbers mentioned (e.g., "saved 4 hours per week", "increased revenue by $50K")
  - medium: approximate figures (e.g., "about 30% improvement", "nearly doubled")
  - low: vague references (e.g., "significant savings", "much faster")
- Quotes must be verbatim from the answer - do not paraphrase
- Merge new information with existing state, don't replace unless updating
- Look for ANY type of measurable impact: time, money, efficiency, quality, revenue, cost, headcount, errors, speed, etc.

Return a JSON object with this structure:
{
  "metrics": [...], // Array of new or updated metrics
  "quotes": [...], // Array of new quotes
  "facts": {
    "challenge": "...", // Update if new info provided
    "solution": "...", // Update if new info provided
    "impact": "..." // Update if new info provided
  }
}`;

export const QUESTION_GENERATOR_PROMPT = `You're a skilled interviewer gathering a customer success story about {{product}} for {{company}}.

Conversation so far:
{{conversation}}

Current extraction state:
{{extraction}}

Question count: {{question_count}} of ~15 total

Your goal: Extract NUMBERS and QUANTIFIABLE RESULTS. The best case studies have specific metrics.

Analyze what we have and what we're missing:
- Do we have specific numbers? (time saved, money saved, % improvement, revenue increase, etc.)
- Do we have compelling quotes?
- Do we understand the before/after transformation?

Generate the next question. Be adaptive:
- If they give vague answers ("it's much better"), probe for specifics ("Can you put a number on that?")
- If they mention a metric, dig deeper ("You mentioned 4 hours saved - is that daily? Weekly?")
- If they're struggling with numbers, ask for concrete examples or comparisons
- Listen for opportunities to quantify: "How many...", "What percentage...", "How much time/money..."

Guidelines:
- One clear question, under 25 words
- Warm and conversational - you're having a chat, not interrogating
- Reference their previous answer when following up
- Push for specifics but don't be annoying about it
- End after ~15 questions OR when you have 3+ solid metrics and good quotes

Return a JSON object:
{
  "question": "Your question here?",
  "type": "context" | "solution" | "metrics" | "quote" | "wrap_up",
  "should_end": false | true
}`;

export const FIRST_QUESTION_PROMPT = `You're starting an interview for a case study about {{product}} with someone from {{company}}.

Generate a warm opening question that:
- Puts the customer at ease
- Gets them talking about their role or the problem they were trying to solve
- Is natural and conversational
- Under 20 words

Return a JSON object:
{
  "question": "Your opening question here?",
  "type": "context",
  "should_end": false
}`;

export const DRAFT_GENERATOR_PROMPT = `Generate a compelling 1-page case study from this data:

Company: {{company}}
Product: {{product}}

Extraction Data:
{{extraction}}

Interview Transcript:
{{transcript}}

Structure:

# [Headline featuring the most impressive metric or outcome]

## The Challenge
[2 paragraphs: What problem did they face? What was the pain? Be specific and relatable.]

## The Solution
[2 paragraphs: How did they implement and use {{product}}? What features matter most to them?]

## The Results
[2 paragraphs: Weave in the metrics naturally. Show the transformation. Quantify the impact.]

### Key Metrics
| Metric | Result |
|--------|--------|
[3-5 rows with the best numbers from the interview]

### In Their Words
> "[Most compelling quote]"

> "[Second best quote]"

---

Rules:
- Use ONLY information from the extraction and transcript - never invent data
- Lead with the strongest metric in the headline
- Make numbers prominent and easy to scan
- Keep it factual but compelling
- Output in Markdown format`;
