/**
 * Chat Message Component Tests
 *
 * Tests the message display, styling, and content rendering.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatMessage } from "@/components/chat/chat-message";

describe("ChatMessage", () => {
  describe("Role-based Styling", () => {
    it("renders assistant messages with light background", () => {
      render(<ChatMessage role="assistant" content="Hello!" />);

      const message = screen.getByText("Hello!");
      const container = message.closest("div");

      expect(container?.className).toContain("bg-gray-100");
    });

    it("renders user messages with dark background", () => {
      render(<ChatMessage role="user" content="Hi there" />);

      const message = screen.getByText("Hi there");
      const container = message.closest("div");

      expect(container?.className).toContain("bg-gray-900");
    });

    it("user messages have white text", () => {
      render(<ChatMessage role="user" content="Test message" />);

      const message = screen.getByText("Test message");
      const container = message.closest("div");

      expect(container?.className).toContain("text-white");
    });

    it("assistant messages have dark text", () => {
      render(<ChatMessage role="assistant" content="Test message" />);

      const message = screen.getByText("Test message");
      const container = message.closest("div");

      expect(container?.className).toContain("text-gray-900");
    });
  });

  describe("Content Rendering", () => {
    it("renders plain text content", () => {
      render(<ChatMessage role="assistant" content="Plain text message" />);

      expect(screen.getByText("Plain text message")).toBeInTheDocument();
    });

    it("renders long content without truncation", () => {
      const longContent = "A".repeat(500);
      render(<ChatMessage role="assistant" content={longContent} />);

      expect(screen.getByText(longContent)).toBeInTheDocument();
    });

    it("preserves whitespace in content", () => {
      const contentWithSpaces = "Line 1\n\nLine 2";
      render(<ChatMessage role="user" content={contentWithSpaces} />);

      const element = screen.getByText(/Line 1/);
      expect(element).toBeInTheDocument();
    });

    it("handles empty content gracefully", () => {
      render(<ChatMessage role="assistant" content="" />);

      // Should render container even with empty content
      const messages = document.querySelectorAll("[class*='bg-gray']");
      expect(messages.length).toBeGreaterThan(0);
    });

    it("escapes HTML in content", () => {
      render(<ChatMessage role="user" content="<script>alert('xss')</script>" />);

      // Should show escaped text, not execute script
      expect(screen.getByText(/<script>/)).toBeInTheDocument();
    });
  });

  describe("Layout", () => {
    it("assistant messages align left", () => {
      render(<ChatMessage role="assistant" content="Left aligned" />);

      const wrapper = screen.getByText("Left aligned").closest("div")?.parentElement;
      expect(wrapper?.className).toContain("justify-start");
    });

    it("user messages align right", () => {
      render(<ChatMessage role="user" content="Right aligned" />);

      const wrapper = screen.getByText("Right aligned").closest("div")?.parentElement;
      expect(wrapper?.className).toContain("justify-end");
    });

    it("has consistent padding", () => {
      render(<ChatMessage role="assistant" content="Padded" />);

      const container = screen.getByText("Padded").closest("div");
      expect(container?.className).toMatch(/p-\d|px-\d|py-\d/);
    });

    it("has rounded corners", () => {
      render(<ChatMessage role="assistant" content="Rounded" />);

      const container = screen.getByText("Rounded").closest("div");
      expect(container?.className).toContain("rounded");
    });
  });

  describe("Accessibility", () => {
    it("content is screen reader accessible", () => {
      render(<ChatMessage role="assistant" content="Accessible content" />);

      const message = screen.getByText("Accessible content");
      expect(message).toBeVisible();
    });

    it("has sufficient color contrast", () => {
      // User messages: white text on gray-900 (high contrast)
      render(<ChatMessage role="user" content="High contrast" />);

      const message = screen.getByText("High contrast");
      const container = message.closest("div");

      // Verify dark background with light text
      expect(container?.className).toContain("bg-gray-900");
      expect(container?.className).toContain("text-white");
    });
  });
});

describe("ChatMessage Edge Cases", () => {
  it("handles special characters", () => {
    const specialContent = "Price: $100 (€85) — 50% off!";
    render(<ChatMessage role="user" content={specialContent} />);

    expect(screen.getByText(specialContent)).toBeInTheDocument();
  });

  it("handles unicode and emojis", () => {
    const unicodeContent = "Great results! 🎉 Revenue: ¥10M";
    render(<ChatMessage role="assistant" content={unicodeContent} />);

    expect(screen.getByText(unicodeContent)).toBeInTheDocument();
  });

  it("handles URLs in content", () => {
    const urlContent = "Check out https://example.com for more";
    render(<ChatMessage role="user" content={urlContent} />);

    expect(screen.getByText(urlContent)).toBeInTheDocument();
  });

  it("handles multiple consecutive messages", () => {
    render(
      <>
        <ChatMessage role="assistant" content="Question 1" />
        <ChatMessage role="user" content="Answer 1" />
        <ChatMessage role="assistant" content="Question 2" />
        <ChatMessage role="user" content="Answer 2" />
      </>
    );

    expect(screen.getByText("Question 1")).toBeInTheDocument();
    expect(screen.getByText("Answer 1")).toBeInTheDocument();
    expect(screen.getByText("Question 2")).toBeInTheDocument();
    expect(screen.getByText("Answer 2")).toBeInTheDocument();
  });
});
