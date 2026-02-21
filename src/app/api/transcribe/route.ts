export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY no está configurada" },
        { status: 500 },
      );
    }

    const groq = new Groq({ apiKey });

    const formData = await req.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó ningún archivo de audio" },
        { status: 400 },
      );
    }

    // 1. Transcribir con Groq Whisper (auto-detecta idioma: español, inglés, etc.)
    const transcription = await groq.audio.transcriptions.create({
      file: file as any,
      model: "whisper-large-v3",
      response_format: "verbose_json",
    });

    const originalText = transcription.text;

    // 2. Refinar con Llama 3 (El "Flow")
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a high-fidelity transcription assistant. Your goal is to convert audio into polished text. RULES: 1. Detect the language (Spanish or English) and respond in the SAME language. 2. Remove filler words (um, uh, eh, am) but keep the speaker's style and personality. 3. Fix grammar and punctuation naturally. 4. Do NOT summarize or paraphrase - keep all the meaning and content. 5. Format into clear, readable text. 6. Output ONLY the cleaned transcription, no explanations.",
        },
        {
          role: "user",
          content: originalText,
        },
      ],
      model: "llama-3.3-70b-versatile", // El modelo más capaz de Groq actualmente
      temperature: 0.1,
    });

    const refinedText =
      chatCompletion.choices[0]?.message?.content || originalText;

    return NextResponse.json({
      original: originalText,
      refined: refinedText,
    });
  } catch (error: any) {
    console.error("Error en /api/transcribe:", error);
    return NextResponse.json(
      { error: "Error al procesar el audio: " + error.message },
      { status: 500 },
    );
  }
}
