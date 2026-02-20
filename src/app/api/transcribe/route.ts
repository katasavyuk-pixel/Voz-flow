export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as Blob;

        if (!file) {
            return NextResponse.json({ error: "No se proporcionó ningún archivo de audio" }, { status: 400 });
        }

        // 1. Transcribir con Groq Whisper
        const transcription = await groq.audio.transcriptions.create({
            file: file as any,
            model: "whisper-large-v3", // O distil-whisper-large-v3-en para máxima velocidad
            response_format: "verbose_json",
            language: "es", // Forzar español para mayor precisión
        });

        const originalText = transcription.text;

        // 2. Refinar con Llama 3 (El "Flow")
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "Eres un transcriptor de alta fidelidad. Tu objetivo es convertir el audio en texto EXACTAMENTE como fue dicho. REGLAS: 1. Mantén todas las palabras originales, incluso si hay errores gramaticales o de dicción del hablante. 2. Respeta estrictamente todos los acentos y puntuación natural. 3. Elimina ÚNICAMENTE las muletillas extremas (eh, am, um) si ensucian demasiado, pero mantén el estilo y las pausas del usuario. 4. NO resumas, NO parafrasees y NO mejores el estilo. Queremos fidelidad total. 5. Responde solo con el texto transcrito."
                },
                {
                    role: "user",
                    content: originalText
                }
            ],
            model: "llama-3.3-70b-versatile", // El modelo más capaz de Groq actualmente
            temperature: 0.1,
        });

        const refinedText = chatCompletion.choices[0]?.message?.content || originalText;

        return NextResponse.json({
            original: originalText,
            refined: refinedText,
        });

    } catch (error: any) {
        console.error("Error en /api/transcribe:", error);
        return NextResponse.json({ error: "Error al procesar el audio: " + error.message }, { status: 500 });
    }
}
