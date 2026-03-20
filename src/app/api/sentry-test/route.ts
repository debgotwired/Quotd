import { NextResponse } from "next/server";

export async function GET() {
  throw new Error("Sentry test error — this is intentional! Delete this route after verifying.");
  return NextResponse.json({ ok: true });
}
