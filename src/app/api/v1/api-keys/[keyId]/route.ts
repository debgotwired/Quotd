import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-keys/with-api-auth";
import { revokeApiKey } from "@/lib/api-keys/manage";

export const DELETE = withApiAuth(async (_req, { userId, params }) => {
  const { keyId } = params;

  try {
    await revokeApiKey(userId, keyId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 });
  }
});
