import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const interviewToken = formData.get("token") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!interviewToken) {
      return NextResponse.json({ error: "No interview token provided" }, { status: 400 });
    }

    // Validate interview token exists
    const supabaseCheck = await createServiceClient();
    const { data: interview } = await supabaseCheck
      .from("interviews")
      .select("id")
      .eq("share_token", interviewToken)
      .single();

    if (!interview) {
      return NextResponse.json({ error: "Invalid interview token" }, { status: 403 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 50 MB.` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed. Supported: images, PDFs, documents.` },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Generate unique filename with sanitized extension
    const timestamp = Date.now();
    const rawExt = file.name.split(".").pop() || "bin";
    const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "bin";
    const fileName = `${interviewToken}/${timestamp}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const { data, error } = await supabase.storage
      .from("interview-files")
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("[Upload] Storage error:", error);
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("interview-files")
      .getPublicUrl(data.path);

    // Sanitize display name
    const safeName = file.name.replace(/[^\w.\-() ]/g, "_").slice(0, 255);

    return NextResponse.json({
      success: true,
      file: {
        name: safeName,
        type: file.type,
        size: file.size,
        url: urlData.publicUrl,
        path: data.path,
      },
    });
  } catch (err) {
    console.error("[Upload] Error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
