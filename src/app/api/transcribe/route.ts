import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as Blob;
    const token = formData.get("token") as string | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    console.log(`[Transcribe] Audio size: ${arrayBuffer.byteLength} bytes, type: ${audioFile.type}`);

    // Save audio to Supabase Storage if token is provided
    let audioUrl: string | null = null;
    let audioPath: string | null = null;

    if (token) {
      try {
        const supabase = await createServiceClient();
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).slice(2, 8);
        const fileName = `audio/${token}/${timestamp}-${randomId}.webm`;

        const { error: uploadError } = await supabase.storage
          .from("interview-files")
          .upload(fileName, arrayBuffer, {
            contentType: audioFile.type || "audio/webm",
            upsert: false,
          });

        if (uploadError) {
          console.error("[Transcribe] Storage upload error:", uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from("interview-files")
            .getPublicUrl(fileName);

          audioUrl = urlData.publicUrl;
          audioPath = fileName;
          console.log(`[Transcribe] Audio saved: ${audioPath}`);
        }
      } catch (storageErr) {
        console.error("[Transcribe] Storage error:", storageErr);
        // Continue with transcription even if storage fails
      }
    }

    // Call Deepgram API directly for maximum control
    const response = await fetch("https://api.deepgram.com/v1/listen?model=nova-2-general&language=en-US&smart_format=true&punctuate=true&diarize=false&filler_words=false&detect_language=false", {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": audioFile.type || "audio/webm",
      },
      body: arrayBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Transcribe] Deepgram error:", errorText);
      return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
    }

    const data = await response.json();
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

    console.log(`[Transcribe] Result: "${transcript}"`);

    return NextResponse.json({ transcript, audioUrl, audioPath });
  } catch (err) {
    console.error("Transcription error:", err);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
