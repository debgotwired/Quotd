import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-keys/with-api-auth";
import { createApiKey, listApiKeys } from "@/lib/api-keys/manage";

export const GET = withApiAuth(async (_req, { userId }) => {
  const keys = await listApiKeys(userId);
  return NextResponse.json({ data: keys });
});

export const POST = withApiAuth(async (req, { userId }) => {
  let body: { name: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (body.name.trim().length > 100) {
    return NextResponse.json({ error: "Name must be 100 characters or less" }, { status: 400 });
  }

  try {
    const key = await createApiKey(userId, body.name.trim());
    return NextResponse.json({ data: key }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
});
