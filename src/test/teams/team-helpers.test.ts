/**
 * Team Helpers Unit Tests
 *
 * Tests for team role checking utilities and invite token generation.
 */

import { describe, it, expect } from "vitest";
import { canEditTeam, isTeamOwner, generateInviteToken } from "@/lib/teams/helpers";

describe("Team Helpers", () => {
  describe("canEditTeam", () => {
    it("returns true for owner", () => {
      expect(canEditTeam("owner")).toBe(true);
    });

    it("returns true for editor", () => {
      expect(canEditTeam("editor")).toBe(true);
    });

    it("returns false for viewer", () => {
      expect(canEditTeam("viewer")).toBe(false);
    });

    it("returns false for null (not a member)", () => {
      expect(canEditTeam(null)).toBe(false);
    });
  });

  describe("isTeamOwner", () => {
    it("returns true for owner", () => {
      expect(isTeamOwner("owner")).toBe(true);
    });

    it("returns false for editor", () => {
      expect(isTeamOwner("editor")).toBe(false);
    });

    it("returns false for viewer", () => {
      expect(isTeamOwner("viewer")).toBe(false);
    });

    it("returns false for null", () => {
      expect(isTeamOwner(null)).toBe(false);
    });
  });

  describe("generateInviteToken", () => {
    it("generates a 64-character hex string", () => {
      const token = generateInviteToken();
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });

    it("generates unique tokens", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateInviteToken());
      }
      expect(tokens.size).toBe(100);
    });
  });
});
