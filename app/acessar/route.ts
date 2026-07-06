import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const origin = new URL(request.url).origin;

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const { data: usuario, error: usuarioError } = await supabase
    .from("usuarios")
    .select("role")
    .eq("id", user.id)
    .single();

  if (usuarioError || !usuario?.role) {
    return NextResponse.redirect(`${origin}/login`);
  }

  if (
    usuario.role === "super_admin" ||
    usuario.role === "produtor" ||
    usuario.role === "staff"
  ) {
    return NextResponse.redirect(`${origin}/admin`);
  }

  return NextResponse.redirect(`${origin}/login`);
}
