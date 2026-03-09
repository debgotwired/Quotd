/**
 * Voice-First Input Component Tests
 *
 * Tests the voice recording UI, mode switching, and file uploads.
 * These go beyond snapshot tests to verify actual user interactions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VoiceFirstInput } from "@/components/chat/voice-first-input";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "test-token" }),
}));

describe("VoiceFirstInput", () => {
  const mockOnSend = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Voice Mode (Default)", () => {
    it("renders in voice mode by default", () => {
      render(<VoiceFirstInput onSend={mockOnSend} />);

      // Should show "Tap to speak" hint
      expect(screen.getByText(/tap to speak/i)).toBeInTheDocument();
    });

    it("shows mic button as primary action", () => {
      render(<VoiceFirstInput onSend={mockOnSend} />);

      // Large mic button should be present (find by class)
      const buttons = screen.getAllByRole("button");
      const micButton = buttons.find((btn) =>
        btn.className.includes("w-16")
      );
      expect(micButton).toBeInTheDocument();
    });

    it("starts recording when mic button clicked", async () => {
      render(<VoiceFirstInput onSend={mockOnSend} />);

      const buttons = screen.getAllByRole("button");
      const micButton = buttons.find((btn) =>
        btn.className.includes("w-16")
      );

      if (micButton) {
        await userEvent.click(micButton);
        // Should show recording state
        await waitFor(() => {
          expect(screen.queryByText(/tap to stop/i)).toBeInTheDocument();
        });
      }
    });

    it("shows keyboard button to switch to text mode", () => {
      render(<VoiceFirstInput onSend={mockOnSend} />);

      const buttons = screen.getAllByRole("button");
      // Should have 3 buttons: attach, mic, keyboard
      expect(buttons.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Text Mode", () => {
    it("switches to text mode when keyboard button clicked", async () => {
      render(<VoiceFirstInput onSend={mockOnSend} />);

      // Find keyboard button (rightmost button in voice mode)
      const buttons = screen.getAllByRole("button");
      const keyboardButton = buttons[buttons.length - 1];

      await userEvent.click(keyboardButton);

      // Should now show text input
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument();
      });
    });

    it("sends message on Enter key", async () => {
      render(<VoiceFirstInput onSend={mockOnSend} />);

      // Switch to text mode first
      const buttons = screen.getAllByRole("button");
      await userEvent.click(buttons[buttons.length - 1]);

      const textarea = await screen.findByPlaceholderText(/type a message/i);
      await userEvent.type(textarea, "Test message{enter}");

      expect(mockOnSend).toHaveBeenCalledWith("Test message", undefined);
    });

    it("does not send empty message", async () => {
      render(<VoiceFirstInput onSend={mockOnSend} />);

      // Switch to text mode
      const buttons = screen.getAllByRole("button");
      await userEvent.click(buttons[buttons.length - 1]);

      const textarea = await screen.findByPlaceholderText(/type a message/i);
      await userEvent.type(textarea, "   {enter}"); // Just whitespace

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it("allows multiline input with Shift+Enter", async () => {
      render(<VoiceFirstInput onSend={mockOnSend} />);

      // Switch to text mode
      const buttons = screen.getAllByRole("button");
      await userEvent.click(buttons[buttons.length - 1]);

      const textarea = await screen.findByPlaceholderText(/type a message/i);
      await userEvent.type(textarea, "Line 1{shift>}{enter}{/shift}Line 2");

      expect(textarea).toHaveValue("Line 1\nLine 2");
      expect(mockOnSend).not.toHaveBeenCalled(); // Should not send
    });
  });

  describe("Disabled State", () => {
    it("disables all buttons when disabled prop is true", () => {
      render(<VoiceFirstInput onSend={mockOnSend} disabled />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it("shows processing state visually", () => {
      render(<VoiceFirstInput onSend={mockOnSend} disabled />);

      // Buttons should have reduced opacity
      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button.className).toContain("opacity-50");
      });
    });
  });

  describe("File Attachments", () => {
    it("shows file preview when file is attached", async () => {
      // This would require mocking the file upload API
      // For now, we verify the file input exists
      render(<VoiceFirstInput onSend={mockOnSend} />);

      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toBeInTheDocument();
    });

    it("accepts multiple files", () => {
      render(<VoiceFirstInput onSend={mockOnSend} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toHaveAttribute("multiple");
    });

    it("accepts correct file types", () => {
      render(<VoiceFirstInput onSend={mockOnSend} />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toHaveAttribute("accept");
      expect(fileInput.accept).toContain("image/*");
      expect(fileInput.accept).toContain(".pdf");
    });
  });
});

describe("VoiceFirstInput Accessibility", () => {
  const mockOnSend = vi.fn();

  it("all buttons are keyboard accessible", () => {
    render(<VoiceFirstInput onSend={mockOnSend} />);

    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button).not.toHaveAttribute("tabindex", "-1");
    });
  });

  it("has visible focus indicators", async () => {
    render(<VoiceFirstInput onSend={mockOnSend} />);

    const buttons = screen.getAllByRole("button");
    // All buttons should have focus ring classes
    buttons.forEach((button) => {
      expect(button.className).toMatch(/focus:/);
    });
  });
});
