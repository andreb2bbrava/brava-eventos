import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RoleUsuario = "super_admin" | "produtor" | "staff";

function roleValida(role: string): role is RoleUsuario {
  return role === "super_admin" || role === "produtor" || role === "staff";
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const userId = body?.userId as string | undefined;
    const email = body?.email as string | undefined;
    const password = body?.password as string | null | undefined;
    const role = body?.role as string | undefined;

    if (!userId || !email || !role || !roleValida(role)) {
      return NextResponse.json({ error: "Dados invalidos para atualizar usuario." }, { status: 400 });
    }

    const authPayload: { email: string; password?: string } = { email };

    if (password && password.trim()) {
      authPayload.password = password.trim();
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authPayload);

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const { error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .update({
        email,
        role,
      })
      .eq("id", userId);

    if (usuarioError) {
      return NextResponse.json({ error: usuarioError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("ERRO AO ATUALIZAR USUARIO:", error);
    return NextResponse.json({ error: "Erro interno ao atualizar usuario." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const userId = body?.userId as string | undefined;

    if (!userId) {
      return NextResponse.json({ error: "Usuario invalido para exclusao." }, { status: 400 });
    }

    await supabaseAdmin.from("evento_produtores").delete().eq("usuario_id", userId);
    await supabaseAdmin.from("evento_staff").delete().eq("usuario_id", userId);

    const { error: usuarioError } = await supabaseAdmin.from("usuarios").delete().eq("id", userId);

    if (usuarioError) {
      return NextResponse.json({ error: usuarioError.message }, { status: 400 });
    }

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("ERRO AO EXCLUIR USUARIO:", error);
    return NextResponse.json({ error: "Erro interno ao excluir usuario." }, { status: 500 });
  }
}
