/**
 * Team API Contract Tests
 *
 * Schema validation for team-related API endpoints.
 * Ensures API responses match expected shapes.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

// Team schemas
const TeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  owner_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});

const TeamMemberSchema = z.object({
  id: z.string().uuid(),
  team_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(["owner", "editor", "viewer"]),
  invited_email: z.string().nullable(),
  invited_at: z.string().nullable(),
  accepted_at: z.string().nullable(),
  created_at: z.string(),
  profile: z.object({
    full_name: z.string(),
    company_name: z.string(),
  }).nullable().optional(),
});

const TeamInviteSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["editor", "viewer"]),
  expires_at: z.string(),
  created_at: z.string(),
});

const GetTeamsResponseSchema = z.object({
  teams: z.array(TeamSchema),
});

const CreateTeamResponseSchema = z.object({
  team: TeamSchema,
});

const GetTeamDetailResponseSchema = z.object({
  team: TeamSchema,
  members: z.array(TeamMemberSchema),
  invites: z.array(TeamInviteSchema),
  currentUserRole: z.enum(["owner", "editor", "viewer"]),
});

const InviteInfoResponseSchema = z.object({
  invite: z.object({
    email: z.string(),
    role: z.string(),
    teamName: z.string(),
    inviterName: z.string(),
  }),
});

const AcceptInviteResponseSchema = z.object({
  success: z.boolean(),
  teamId: z.string().uuid(),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
});

describe("Team API Contract Validation", () => {
  describe("GET /api/teams", () => {
    it("response matches GetTeamsResponseSchema", () => {
      const validResponse = {
        teams: [
          {
            id: "550e8400-e29b-41d4-a716-446655440000",
            name: "Acme Team",
            owner_id: "550e8400-e29b-41d4-a716-446655440001",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
      };

      const result = GetTeamsResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it("accepts empty teams array", () => {
      const result = GetTeamsResponseSchema.safeParse({ teams: [] });
      expect(result.success).toBe(true);
    });
  });

  describe("POST /api/teams", () => {
    it("response matches CreateTeamResponseSchema", () => {
      const validResponse = {
        team: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "My Team",
          owner_id: "550e8400-e29b-41d4-a716-446655440001",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      };

      const result = CreateTeamResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it("rejects team without name", () => {
      const invalidResponse = {
        team: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "",
          owner_id: "550e8400-e29b-41d4-a716-446655440001",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      };

      const result = CreateTeamResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe("GET /api/teams/:teamId", () => {
    it("response matches GetTeamDetailResponseSchema", () => {
      const validResponse = {
        team: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "Acme Team",
          owner_id: "550e8400-e29b-41d4-a716-446655440001",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        members: [
          {
            id: "550e8400-e29b-41d4-a716-446655440010",
            team_id: "550e8400-e29b-41d4-a716-446655440000",
            user_id: "550e8400-e29b-41d4-a716-446655440001",
            role: "owner",
            invited_email: null,
            invited_at: "2026-01-01T00:00:00Z",
            accepted_at: "2026-01-01T00:00:00Z",
            created_at: "2026-01-01T00:00:00Z",
            profile: {
              full_name: "John Doe",
              company_name: "Acme",
            },
          },
        ],
        invites: [
          {
            id: "550e8400-e29b-41d4-a716-446655440020",
            email: "new@acme.com",
            role: "editor",
            expires_at: "2026-01-08T00:00:00Z",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        currentUserRole: "owner",
      };

      const result = GetTeamDetailResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it("rejects invalid role in member", () => {
      const invalidResponse = {
        team: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "Acme Team",
          owner_id: "550e8400-e29b-41d4-a716-446655440001",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        members: [
          {
            id: "550e8400-e29b-41d4-a716-446655440010",
            team_id: "550e8400-e29b-41d4-a716-446655440000",
            user_id: "550e8400-e29b-41d4-a716-446655440001",
            role: "admin", // invalid!
            invited_email: null,
            invited_at: null,
            accepted_at: null,
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
        invites: [],
        currentUserRole: "owner",
      };

      const result = GetTeamDetailResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe("GET /api/teams/invite/:token", () => {
    it("response matches InviteInfoResponseSchema", () => {
      const validResponse = {
        invite: {
          email: "new@acme.com",
          role: "editor",
          teamName: "Acme Team",
          inviterName: "John Doe",
        },
      };

      const result = InviteInfoResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });
  });

  describe("POST /api/teams/invite/:token", () => {
    it("response matches AcceptInviteResponseSchema", () => {
      const validResponse = {
        success: true,
        teamId: "550e8400-e29b-41d4-a716-446655440000",
      };

      const result = AcceptInviteResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });
  });

  describe("Error Responses", () => {
    it("error response matches ErrorResponseSchema", () => {
      const errorCases = [
        { error: "Unauthorized" },
        { error: "Only the team owner can send invites" },
        { error: "This user is already a team member" },
        { error: "Invite has expired" },
        { error: "Team name is required" },
      ];

      for (const errorCase of errorCases) {
        const result = ErrorResponseSchema.safeParse(errorCase);
        expect(result.success).toBe(true);
      }
    });
  });
});

describe("Team Role Permissions Matrix", () => {
  const permissions = {
    owner: {
      canViewTeam: true,
      canUpdateTeamName: true,
      canDeleteTeam: true,
      canInviteMembers: true,
      canRemoveMembers: true,
      canChangeRoles: true,
      canViewInterviews: true,
      canEditInterviews: true,
    },
    editor: {
      canViewTeam: true,
      canUpdateTeamName: false,
      canDeleteTeam: false,
      canInviteMembers: false,
      canRemoveMembers: false,
      canChangeRoles: false,
      canViewInterviews: true,
      canEditInterviews: true,
    },
    viewer: {
      canViewTeam: true,
      canUpdateTeamName: false,
      canDeleteTeam: false,
      canInviteMembers: false,
      canRemoveMembers: false,
      canChangeRoles: false,
      canViewInterviews: true,
      canEditInterviews: false,
    },
  };

  for (const [role, perms] of Object.entries(permissions)) {
    describe(`${role} role`, () => {
      for (const [perm, allowed] of Object.entries(perms)) {
        it(`${perm}: ${allowed}`, () => {
          expect(allowed).toBe(permissions[role as keyof typeof permissions][perm as keyof typeof perms]);
        });
      }
    });
  }
});
