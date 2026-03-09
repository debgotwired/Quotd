import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as Blob;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    console.log(`[Transcribe] Audio size: ${arrayBuffer.byteLength} bytes, type: ${audioFile.type}`);

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

    return NextResponse.json({ transcript });
  } catch (err) {
    console.error("Transcription error:", err);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
