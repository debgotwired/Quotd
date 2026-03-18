import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File must be PNG, JPEG, WebP, or SVG" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File must be under 2MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "png";
  const path = `branding/${user.id}/logo.${ext}`;

  const serviceClient = await createServiceClient();

  // Upload (upsert to overwrite existing logo)
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await serviceClient.storage
    .from("interview-files")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("Logo upload failed:", uploadError);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data: { publicUrl } } = serviceClient.storage
    .from("interview-files")
    .getPublicUrl(path);

  // Save to profile
  await serviceClient
    .from("profiles")
    .update({ logo_url: publicUrl })
    .eq("user_id", user.id);

  return NextResponse.json({ logo_url: publicUrl });
}
