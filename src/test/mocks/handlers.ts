import { http, HttpResponse } from "msw";

// Mock data
export const mockInterview = {
  id: "test-interview-id",
  customer_company: "Acme Corp",
  product_name: "TestProduct",
  status: "in_progress",
  share_token: "test-token",
  extraction_state: {
    metrics: [],
    quotes: [],
    facts: {},
    question_count: 0,
  },
};

export const mockMessages = [
  { id: "1", role: "assistant", content: "Tell me about your role at Acme Corp?" },
  { id: "2", role: "user", content: "I'm the Head of Engineering." },
];

export const handlers = [
  // Get interview by token
  http.get("/api/interview/:token", () => {
    return HttpResponse.json({
      interview: mockInterview,
      messages: mockMessages,
    });
  }),

  // Get next question
  http.post("/api/interview/:token/next-question", () => {
    return HttpResponse.json({
      question: "What challenges were you facing before using TestProduct?",
      type: "context",
      should_end: false,
      question_count: 1,
    });
  }),

  // Submit answer
  http.post("/api/interview/:token/submit-answer", async ({ request }) => {
    const body = await request.json() as { answer: string };

    // Simulate extraction based on answer content
    const hasNumbers = /\d+/.test(body.answer);

    return HttpResponse.json({
      question: hasNumbers
        ? "That's impressive! Can you tell me more about the impact?"
        : "Can you put a number on that improvement?",
      type: hasNumbers ? "quote" : "metrics",
      should_end: false,
      extraction: {
        metrics: hasNumbers ? [{ name: "Time saved", delta: "50%", confidence: "medium" }] : [],
        quotes: [],
        facts: {},
        question_count: 2,
      },
    });
  }),

  // Transcribe audio
  http.post("/api/transcribe", () => {
    return HttpResponse.json({
      transcript: "This is a mock transcription of the audio.",
    });
  }),

  // Upload file
  http.post("/api/upload", () => {
    return HttpResponse.json({
      success: true,
      file: {
        name: "test-file.pdf",
        type: "application/pdf",
        size: 1024,
        url: "https://example.com/test-file.pdf",
        path: "test-token/test-file.pdf",
      },
    });
  }),

  // Export
  http.get("/api/interview/:token/export", ({ request }) => {
    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "md";

    const content = "# Test Case Study\n\nThis is a mock case study.";

    return new HttpResponse(content, {
      headers: {
        "Content-Type": format === "html" ? "text/html" : "text/markdown",
        "Content-Disposition": `attachment; filename="test-case-study.${format}"`,
      },
    });
  }),
];

// Error handlers for resilience testing
export const errorHandlers = {
  anthropicTimeout: http.post("/api/interview/:token/submit-answer", async () => {
    await new Promise((resolve) => setTimeout(resolve, 30000));
    return HttpResponse.json({ error: "Timeout" }, { status: 504 });
  }),

  anthropicError: http.post("/api/interview/:token/submit-answer", () => {
    return HttpResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }),

  transcriptionError: http.post("/api/transcribe", () => {
    return HttpResponse.json({ error: "Transcription failed" }, { status: 500 });
  }),

  rateLimited: http.post("/api/interview/:token/submit-answer", () => {
    return HttpResponse.json({ error: "Rate limited" }, { status: 429 });
  }),
};
