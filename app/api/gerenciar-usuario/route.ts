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

function obterToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const [, token] = authHeader.split(" ");
  return token?.trim() || "";
}

async function autenticarSolicitante(request: Request): Promise<
  | { ok: true; usuario: { id: string; role: RoleUsuario } }
  | { ok: false; response: NextResponse }
> {
  const token = obterToken(request);

  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "Sessao invalida." }, { status: 401 }) };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authData?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Sessao invalida." }, { status: 401 }) };
  }

  const { data: usuarioData, error: usuarioError } = await supabaseAdmin
    .from("usuarios")
    .select("id, role")
    .eq("id", authData.user.id)
    .single();

  const role = usuarioData?.role;
  if (usuarioError || !usuarioData?.id || !roleValida(role)) {
    return { ok: false, response: NextResponse.json({ error: "Usuario sem permissao." }, { status: 403 }) };
  }

  return {
    ok: true,
    usuario: {
      id: usuarioData.id,
      role,
    },
  };
}

export async function PATCH(request: Request) {
  try {
    const auth = await autenticarSolicitante(request);
    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json();
    const userId = body?.userId as string | undefined;
    const email = typeof body?.email === "string" ? body.email.trim() : undefined;
    const password = body?.password as string | null | undefined;
    const role = body?.role as string | undefined;
    const nome = typeof body?.nome === "string" ? body.nome.trim() : undefined;

    if (!userId) {
      return NextResponse.json({ error: "Dados invalidos para atualizar usuario." }, { status: 400 });
    }

    const solicitante = auth.usuario;
    const superAdmin = solicitante.role === "super_admin";
    const editandoProprioUsuario = solicitante.id === userId;

    if (!superAdmin) {
      const tentandoAlterarCamposRestritos = typeof email !== "undefined" || typeof role !== "undefined" || !!(password && password.trim());
      if (!editandoProprioUsuario || tentandoAlterarCamposRestritos) {
        return NextResponse.json({ error: "Usuario sem permissao para atualizar estes dados." }, { status: 403 });
      }
    }

    if (superAdmin && typeof role !== "undefined" && !roleValida(role)) {
      return NextResponse.json({ error: "Role invalida." }, { status: 400 });
    }

    if (superAdmin && (typeof email !== "undefined" || (password && password.trim()))) {
      const authPayload: { email?: string; password?: string } = {};

      if (typeof email !== "undefined") {
        if (!email) {
          return NextResponse.json({ error: "Email invalido." }, { status: 400 });
        }
        authPayload.email = email;
      }

      if (password && password.trim()) {
        authPayload.password = password.trim();
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authPayload);

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    }

    const updatePayload: { email?: string; role?: RoleUsuario; nome?: string | null } = {};

    if (superAdmin && typeof email !== "undefined") {
      updatePayload.email = email;
    }

    if (superAdmin && typeof role !== "undefined" && roleValida(role)) {
      updatePayload.role = role;
    }

    if (typeof nome !== "undefined") {
      updatePayload.nome = nome || null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ success: true });
    }

    const { error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .update(updatePayload)
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
    const auth = await autenticarSolicitante(request);
    if (!auth.ok) {
      return auth.response;
    }

    if (auth.usuario.role !== "super_admin") {
      return NextResponse.json({ error: "Usuario sem permissao." }, { status: 403 });
    }

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
