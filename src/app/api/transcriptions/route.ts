export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("transcriptions")
      .select("id, original_text, refined_text, status, metadata, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return NextResponse.json({ items: data ?? [] });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error en GET /api/transcriptions:", error);
    return NextResponse.json(
      { error: "Error al listar transcripciones: " + message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { original_text, refined_text, metadata } = await req.json();

    if (!original_text || !refined_text) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("transcriptions")
      .insert([
        {
          user_id: user.id,
          original_text,
          refined_text,
          status: "refined",
          metadata: metadata || {},
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error al guardar transcripción:", error);
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    console.error("Error en POST /api/transcriptions:", error);
    return NextResponse.json(
      { error: "Error al guardar la transcripción: " + message },
      { status: 500 },
    );
  }
}
