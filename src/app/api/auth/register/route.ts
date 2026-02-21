import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    const formData = await request.formData();
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;

    const supabase = await createClient();

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: name,
            },
        },
    });

    if (error) {
        return NextResponse.redirect(
            new URL(`/register?error=${encodeURIComponent(error.message)}`, request.url)
        );
    }

    return NextResponse.redirect(
        new URL("/login?message=Revisa tu email para confirmar tu cuenta", request.url)
    );
}
