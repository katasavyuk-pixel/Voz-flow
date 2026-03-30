export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

type FlowSnippet = {
  trigger: string;
  output: string;
};

type FlowConfig = {
  personalDictionary?: string[];
  snippets?: FlowSnippet[];
};

function parseFlowConfig(rawValue: FormDataEntryValue | null): FlowConfig {
  if (!rawValue || typeof rawValue !== "string") return {};

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object") return {};
    const typedParsed = parsed as FlowConfig;

    const personalDictionary = Array.isArray(typedParsed.personalDictionary)
      ? typedParsed.personalDictionary
          .map((entry) => String(entry).trim())
          .filter(Boolean)
      : [];

    const snippets = Array.isArray(typedParsed.snippets)
      ? typedParsed.snippets
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const trigger = String((item as FlowSnippet).trigger || "").trim();
            const output = String((item as FlowSnippet).output || "").trim();
            if (!trigger || !output) return null;
            return { trigger, output };
          })
          .filter((item): item is FlowSnippet => item !== null)
      : [];

    return { personalDictionary, snippets };
  } catch {
    return {};
  }
}

function buildFlowSystemPrompt(config: FlowConfig): string {
  const dictionaryBlock = (config.personalDictionary || []).length
    ? `\n\nDICCIONARIO PERSONAL (obligatorio):\n${config.personalDictionary
        ?.map((term) => `- ${term}`)
        .join("\n")}`
    : "";

  const snippetsBlock = (config.snippets || []).length
    ? `\n\nSNIPPETS (reemplazo obligatorio cuando detectes el trigger):\n${config.snippets
        ?.map((snippet) => `- ${snippet.trigger} -> ${snippet.output}`)
        .join("\n")}`
    : "";

  return `Eres un motor de transcripcion y edicion de voz de alto rendimiento llamado "Flow".
Tu unica funcion es transformar texto hablado crudo en texto escrito limpio, pulido y perfectamente formateado, manteniendo al 100% el sentido e intencion original.

NO eres un chatbot. NO respondes preguntas. NO das opiniones. NO anades informacion. SOLO editas.

REGLAS OBLIGATORIAS:
1) Elimina muletillas y relleno (eh, um, mmm, bueno, o sea, tipo, es que, digamos, como que, etc.).
2) Corrige ortografia y gramatica sin cambiar significado.
3) Reestructura frases confusas para claridad, sin alterar intencion.
4) Formatea con puntuacion, parrafos y estructura natural.
5) Mantiene la personalidad y registro del hablante (formal/informal).
6) NO inventes informacion y NO cambies el sentido.
7) Si el texto es corto o ambiguo, devuelve igual o con correcciones minimas.

TONO/CONTEXTO:
Detecta automaticamente el contexto (email, chat, Slack, nota personal, tecnico, red social, legal, atencion al cliente, creativo, academico) y ajusta tono en consecuencia.
Si no es claro, usa neutral-profesional.

MULTILINGUE:
Detecta idioma automaticamente y responde en el mismo idioma.
Si hay cambio de idioma dentro del dictado, conserva cada seccion en su idioma.

COMANDOS DE VOZ ESPECIALES (si aparecen en el dictado, ejecutalos):
- "borra eso" / "eliminar eso": elimina la ultima oracion o fragmento previo.
- "en negrita [texto]": aplica negrita solo a ese fragmento.
- "hace una lista con...": convierte lo siguiente en lista.
- "nuevo parrafo": inserta salto de parrafo.
- "tono mas formal": rehace con tono mas formal.
- "tono mas casual": rehace con tono mas casual.
- "resumi esto": entrega un resumen conciso del dictado.
- "agrega un asunto": genera una linea de asunto si corresponde a email.
- "ponelo en modo email": formatea como email profesional con saludo, cuerpo y cierre.
- "puntos clave": extrae y lista los puntos principales.
${dictionaryBlock}${snippetsBlock}

SALIDA:
- Devuelve SOLO el texto final editado listo para usar.
- Nunca incluyas explicaciones, etiquetas, metadatos ni prefacios.`;
}

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
    const flowConfig = parseFlowConfig(formData.get("flowConfig"));

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

    // 2. Refinar con Llama 3 usando reglas de Flow
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: buildFlowSystemPrompt(flowConfig),
        },
        {
          role: "user",
          content: originalText,
        },
      ],
      model: "llama-3.3-70b-versatile", // El modelo más capaz de Groq actualmente
      temperature: 0.1,
    });

    let refinedText =
      chatCompletion.choices[0]?.message?.content || originalText;
    // Normalize Unicode to NFC form for consistent character handling (fixes encoding issues with special chars)
    refinedText = refinedText.normalize("NFC");

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
