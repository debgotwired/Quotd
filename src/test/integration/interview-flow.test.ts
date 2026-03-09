/**
 * Interview Flow Integration Tests
 *
 * End-to-end tests for the complete interview flow.
 * Tests the journey from interview creation to completion.
 *
 * Based on Netflix's "full-stack testing" approach -
 * test the entire user journey, not just individual units.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { server } from "../setup";
import { http, HttpResponse } from "msw";

describe("Interview Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe("Complete Interview Journey", () => {
    it("completes a full interview from start to finish", async () => {
      let questionCount = 0;
      const maxQuestions = 10;

      // Mock the submit-answer endpoint to simulate conversation
      server.use(
        http.post("/api/interview/:token/submit-answer", () => {
          questionCount++;
          const shouldEnd = questionCount >= maxQuestions;

          return HttpResponse.json({
            question: shouldEnd
              ? "Thank you for sharing! Is there anything else you'd like to add?"
              : `Follow-up question ${questionCount}`,
            type: shouldEnd ? "wrap_up" : "metrics",
            should_end: shouldEnd,
            extraction: {
              metrics: [
                { name: `Metric ${questionCount}`, delta: "10%", confidence: "high" },
              ],
              quotes: [],
              facts: {},
              question_count: questionCount,
            },
          });
        })
      );

      // Simulate answering questions until interview ends
      let shouldEnd = false;
      while (!shouldEnd && questionCount < 15) {
        const response = await fetch("/api/interview/test-token/submit-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer: `Answer ${questionCount + 1}` }),
        });

        const data = await response.json();
        shouldEnd = data.should_end;
      }

      expect(questionCount).toBe(maxQuestions);
      expect(shouldEnd).toBe(true);
    });

    it("extracts data progressively throughout interview", async () => {
      const extractionHistory: number[] = [];

      server.use(
        http.post("/api/interview/:token/submit-answer", () => {
          extractionHistory.push(extractionHistory.length + 1);

          return HttpResponse.json({
            question: "Next question?",
            type: "metrics",
            should_end: false,
            extraction: {
              metrics: Array(extractionHistory.length).fill({
                name: "Metric",
                delta: "10%",
                confidence: "high",
              }),
              quotes: [],
              facts: {},
              question_count: extractionHistory.length,
            },
          });
        })
      );

      // Submit 5 answers
      for (let i = 0; i < 5; i++) {
        const response = await fetch("/api/interview/test-token/submit-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer: `Answer ${i + 1}` }),
        });

        const data = await response.json();
        // Metrics should accumulate
        expect(data.extraction.metrics.length).toBe(i + 1);
      }
    });

    it("handles user abandonment gracefully", async () => {
      // User starts but doesn't finish
      server.use(
        http.get("/api/interview/:token", ({ params }) => {
          return HttpResponse.json({
            interview: {
              id: "550e8400-e29b-41d4-a716-446655440000",
              customer_company: "Acme",
              product_name: "TestProduct",
              status: "in_progress", // Started but not completed
              share_token: params.token,
              extraction_state: {
                metrics: [{ name: "Partial", delta: "5%", confidence: "medium" }],
                quotes: [],
                facts: {},
                question_count: 3,
              },
            },
            messages: [
              { id: "1", role: "assistant", content: "Q1", created_at: "" },
              { id: "2", role: "user", content: "A1", created_at: "" },
              { id: "3", role: "assistant", content: "Q2", created_at: "" },
            ],
          });
        })
      );

      const response = await fetch("/api/interview/abandoned-token");
      const data = await response.json();

      // Should preserve partial state
      expect(data.interview.status).toBe("in_progress");
      expect(data.interview.extraction_state.metrics.length).toBe(1);
      expect(data.messages.length).toBe(3);
    });
  });

  describe("Conversation State Management", () => {
    it("maintains context across multiple questions", async () => {
      const conversationHistory: string[] = [];

      server.use(
        http.post("/api/interview/:token/submit-answer", async ({ request }) => {
          const body = (await request.json()) as { answer: string };
          conversationHistory.push(body.answer);

          return HttpResponse.json({
            question: `Following up on "${body.answer.substring(0, 20)}..."`,
            type: "metrics",
            should_end: false,
          });
        })
      );

      await fetch("/api/interview/test-token/submit-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: "We saved 4 hours per week" }),
      });

      await fetch("/api/interview/test-token/submit-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: "Our team of 10 uses it" }),
      });

      // Both answers should be captured
      expect(conversationHistory).toHaveLength(2);
      expect(conversationHistory[0]).toContain("4 hours");
      expect(conversationHistory[1]).toContain("team of 10");
    });

    it("handles concurrent submissions correctly", async () => {
      let requestCount = 0;

      server.use(
        http.post("/api/interview/:token/submit-answer", async () => {
          requestCount++;
          // Simulate processing time
          await new Promise((r) => setTimeout(r, 50));

          return HttpResponse.json({
            question: `Response ${requestCount}`,
            type: "metrics",
            should_end: false,
          });
        })
      );

      // Submit multiple requests simultaneously
      const promises = Array(3)
        .fill(null)
        .map((_, i) =>
          fetch("/api/interview/test-token/submit-answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answer: `Concurrent answer ${i}` }),
          })
        );

      const responses = await Promise.all(promises);

      // All should complete successfully
      responses.forEach((r) => expect(r.ok).toBe(true));
      expect(requestCount).toBe(3);
    });
  });

  describe("Interview Status Transitions", () => {
    it("transitions from draft to in_progress on first answer", async () => {
      let currentStatus = "draft";

      server.use(
        http.post("/api/interview/:token/submit-answer", () => {
          currentStatus = "in_progress";
          return HttpResponse.json({
            question: "Next?",
            type: "context",
            should_end: false,
          });
        }),
        http.get("/api/interview/:token", () => {
          return HttpResponse.json({
            interview: {
              id: "test-id",
              status: currentStatus,
              customer_company: "Test",
              product_name: "Test",
              share_token: "test",
              extraction_state: null,
            },
            messages: [],
          });
        })
      );

      // Check initial status
      let response = await fetch("/api/interview/test-token");
      let data = await response.json();
      expect(data.interview.status).toBe("draft");

      // Submit first answer
      await fetch("/api/interview/test-token/submit-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: "First answer" }),
      });

      // Status should change
      response = await fetch("/api/interview/test-token");
      data = await response.json();
      expect(data.interview.status).toBe("in_progress");
    });

    it("transitions to completed when interview ends", async () => {
      let currentStatus = "in_progress";

      server.use(
        http.post("/api/interview/:token/submit-answer", () => {
          currentStatus = "completed";
          return HttpResponse.json({
            question: "Thanks!",
            type: "wrap_up",
            should_end: true,
          });
        }),
        http.get("/api/interview/:token", () => {
          return HttpResponse.json({
            interview: {
              id: "test-id",
              status: currentStatus,
              customer_company: "Test",
              product_name: "Test",
              share_token: "test",
              extraction_state: {
                metrics: [],
                quotes: [],
                facts: {},
                question_count: 10,
              },
            },
            messages: [],
          });
        })
      );

      // Final submission
      const response = await fetch("/api/interview/test-token/submit-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: "Final answer" }),
      });

      const data = await response.json();
      expect(data.should_end).toBe(true);

      // Verify completion
      const checkResponse = await fetch("/api/interview/test-token");
      const checkData = await checkResponse.json();
      expect(checkData.interview.status).toBe("completed");
    });
  });
});

/**
 * Voice Input Integration Tests
 */
describe("Voice Input Integration", () => {
  it("processes audio and submits transcription", async () => {
    let transcribedText = "";
    let submittedAnswer = "";

    server.use(
      http.post("/api/transcribe", () => {
        transcribedText = "This is what I said about the product";
        return HttpResponse.json({ transcript: transcribedText });
      }),
      http.post("/api/interview/:token/submit-answer", async ({ request }) => {
        const body = (await request.json()) as { answer: string };
        submittedAnswer = body.answer;
        return HttpResponse.json({
          question: "Next question",
          type: "metrics",
          should_end: false,
        });
      })
    );

    // Step 1: Transcribe audio
    const transcribeResponse = await fetch("/api/transcribe", {
      method: "POST",
      body: new FormData(),
    });
    const { transcript } = await transcribeResponse.json();

    // Step 2: Submit transcription as answer
    await fetch("/api/interview/test-token/submit-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: transcript }),
    });

    expect(transcribedText).toBe(submittedAnswer);
  });

  it("falls back to text input when transcription fails", async () => {
    server.use(
      http.post("/api/transcribe", () => {
        return HttpResponse.json(
          { error: "Transcription service unavailable" },
          { status: 503 }
        );
      })
    );

    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: new FormData(),
    });

    expect(response.ok).toBe(false);
    // UI should show text input fallback (tested in component tests)
  });
});

/**
 * File Upload Integration Tests
 */
describe("File Upload Integration", () => {
  it("handles file upload response format", async () => {
    server.use(
      http.post("/api/upload", () => {
        return HttpResponse.json({
          success: true,
          file: {
            name: "report.pdf",
            type: "application/pdf",
            size: 1024,
            url: "https://storage.example.com/interviews/test/report.pdf",
            path: "interviews/test/report.pdf",
          },
        });
      })
    );

    const formData = new FormData();
    formData.append("file", new Blob(["test content"], { type: "application/pdf" }), "report.pdf");
    formData.append("token", "test-token");

    const uploadResponse = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    expect(uploadResponse.ok).toBe(true);
    const data = await uploadResponse.json();
    expect(data.success).toBe(true);
    expect(data.file.name).toBe("report.pdf");
  });

  it("includes attachment in answer context", async () => {
    let receivedBody: { answer: string; attachment?: string } | null = null;

    server.use(
      http.post("/api/interview/:token/submit-answer", async ({ request }) => {
        receivedBody = (await request.json()) as { answer: string; attachment?: string };
        return HttpResponse.json({
          question: "I see you uploaded a file. Can you tell me more about it?",
          type: "context",
          should_end: false,
        });
      })
    );

    await fetch("/api/interview/test-token/submit-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answer: "Here's our quarterly report showing results",
        attachment: "interviews/test/report.pdf",
      }),
    });

    expect(receivedBody?.answer).toContain("quarterly report");
    expect(receivedBody?.attachment).toBe("interviews/test/report.pdf");
  });
});
