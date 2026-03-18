"use client";

import { useState, useEffect, useCallback } from "react";
import type { TeamRole, TeamMemberWithProfile } from "@/lib/supabase/types";
import Link from "next/link";

type TeamData = {
  team: { id: string; name: string; owner_id: string };
  members: TeamMemberWithProfile[];
  invites: { id: string; email: string; role: string; expires_at: string }[];
  currentUserRole: TeamRole;
};

export default function TeamPage() {
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");
  const [inviting, setInviting] = useState(false);

  // Editing team name
  const [editingName, setEditingName] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");

  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/teams");
      const data = await res.json();

      if (data.teams && data.teams.length > 0) {
        // Load the first team's details
        const teamRes = await fetch(`/api/teams/${data.teams[0].id}`);
        if (!teamRes.ok) throw new Error("Failed to load team details");
        const teamDetail = await teamRes.json();
        setTeamData(teamDetail);
      } else {
        setTeamData(null);
      }
    } catch {
      setError("Failed to load team data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create team");
        return;
      }

      setTeamName("");
      await loadTeams();
      setSuccess("Team created");
    } catch {
      setError("Failed to create team");
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamData) return;
    setInviting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/teams/${teamData.team.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send invite");
        return;
      }

      setInviteEmail("");
      setSuccess("Invite sent");
      await loadTeams();
    } catch {
      setError("Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!teamData) return;
    if (!confirm("Remove this member from the team?")) return;
    setError(null);

    try {
      const res = await fetch(`/api/teams/${teamData.team.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to remove member");
        return;
      }

      await loadTeams();
    } catch {
      setError("Failed to remove member");
    }
  };

  const handleChangeRole = async (userId: string, newRole: "editor" | "viewer") => {
    if (!teamData) return;
    setError(null);

    try {
      const res = await fetch(`/api/teams/${teamData.team.id}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to change role");
        return;
      }

      await loadTeams();
    } catch {
      setError("Failed to change role");
    }
  };

  const handleUpdateTeamName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamData) return;
    setError(null);

    try {
      const res = await fetch(`/api/teams/${teamData.team.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTeamName }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update team name");
        return;
      }

      setEditingName(false);
      await loadTeams();
    } catch {
      setError("Failed to update team name");
    }
  };

  const handleDeleteTeam = async () => {
    if (!teamData) return;
    if (!confirm("Delete this team? All team interviews will become personal interviews.")) return;
    setError(null);

    try {
      const res = await fetch(`/api/teams/${teamData.team.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete team");
        return;
      }

      await loadTeams();
    } catch {
      setError("Failed to delete team");
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "owner": return "Owner";
      case "editor": return "Editor";
      case "viewer": return "Viewer";
      default: return role;
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          &larr; Back
        </Link>
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    );
  }

  // No team yet — show create form
  if (!teamData) {
    return (
      <div className="max-w-md mx-auto space-y-8">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          &larr; Back
        </Link>

        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Create a Team</h1>
          <p className="text-gray-500 text-sm mt-1">
            Create a team to share interviews with your colleagues.
          </p>
        </div>

        <form onSubmit={handleCreateTeam} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-gray-700 bg-gray-100 rounded-lg border border-gray-200">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-2">
              Team name
            </label>
            <input
              id="teamName"
              type="text"
              placeholder="My Company"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? "Creating..." : "Create Team"}
          </button>
        </form>
      </div>
    );
  }

  const isOwner = teamData.currentUserRole === "owner";

  return (
    <div className="space-y-8">
      <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
        &larr; Back
      </Link>

      {/* Team Header */}
      <div className="flex items-center justify-between">
        {editingName ? (
          <form onSubmit={handleUpdateTeamName} className="flex items-center gap-3">
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              required
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-gray-900 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
            <button type="submit" className="text-sm text-gray-900 hover:text-black font-medium">
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingName(false)}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">{teamData.team.name}</h1>
            {isOwner && (
              <button
                onClick={() => {
                  setNewTeamName(teamData.team.name);
                  setEditingName(true);
                }}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        )}
        <span className="text-sm text-gray-500">
          {getRoleLabel(teamData.currentUserRole)}
        </span>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 text-sm text-gray-700 bg-gray-100 rounded-lg border border-gray-200">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 text-sm text-green-700 bg-green-50 rounded-lg border border-green-200">
          {success}
        </div>
      )}

      {/* Members */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Members ({teamData.members.length})
        </h2>
        <div className="space-y-2">
          {teamData.members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
            >
              <div className="min-w-0">
                <span className="font-medium text-gray-900">
                  {member.profile?.full_name || member.invited_email || "Unknown"}
                </span>
                {member.profile?.company_name && (
                  <>
                    <span className="text-gray-400 mx-2">&middot;</span>
                    <span className="text-gray-500 text-sm">{member.profile.company_name}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {isOwner && member.role !== "owner" ? (
                  <select
                    value={member.role}
                    onChange={(e) => handleChangeRole(member.user_id, e.target.value as "editor" | "viewer")}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                ) : (
                  <span className="text-sm text-gray-500">{getRoleLabel(member.role)}</span>
                )}
                {isOwner && member.role !== "owner" && (
                  <button
                    onClick={() => handleRemoveMember(member.user_id)}
                    className="text-sm text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invites */}
      {isOwner && teamData.invites.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Pending Invites ({teamData.invites.length})
          </h2>
          <div className="space-y-2">
            {teamData.invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
              >
                <div className="min-w-0">
                  <span className="text-gray-900">{invite.email}</span>
                  <span className="text-gray-400 mx-2">&middot;</span>
                  <span className="text-gray-500 text-sm">{getRoleLabel(invite.role)}</span>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  Expires {new Date(invite.expires_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Form */}
      {isOwner && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Invite a Member</h2>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
              className="px-4 py-3 border border-gray-200 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-colors"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="submit"
              disabled={inviting}
              className="px-6 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {inviting ? "Sending..." : "Send Invite"}
            </button>
          </form>
        </div>
      )}

      {/* Danger Zone */}
      {isOwner && (
        <div className="pt-8 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Danger Zone</h2>
          <p className="text-gray-500 text-sm mb-4">
            Deleting the team will remove all members. Interviews will be unlinked but not deleted.
          </p>
          <button
            onClick={handleDeleteTeam}
            className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete Team
          </button>
        </div>
      )}
    </div>
  );
}
