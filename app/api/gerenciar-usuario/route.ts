import { NextResponse } from "next/server";
import { registrarAuditLog } from "@/lib/auditoria";
import { isAdminRole, isPlatformOwner, isRoleUsuario, type RoleUsuario } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function roleValida(role: string): role is RoleUsuario {
  return isRoleUsuario(role);
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
    const admin = isAdminRole(solicitante.role);
    const platformOwner = isPlatformOwner(solicitante.role);
    const editandoProprioUsuario = solicitante.id === userId;

    if (!admin) {
      const tentandoAlterarCamposRestritos = typeof email !== "undefined" || typeof role !== "undefined" || !!(password && password.trim());
      if (!editandoProprioUsuario || tentandoAlterarCamposRestritos) {
        return NextResponse.json({ error: "Usuario sem permissao para atualizar estes dados." }, { status: 403 });
      }
    }

    if (admin && typeof role !== "undefined" && !roleValida(role)) {
      return NextResponse.json({ error: "Role invalida." }, { status: 400 });
    }

    const { data: usuarioAtual, error: usuarioAtualError } = await supabaseAdmin
      .from("usuarios")
      .select("id, nome, email, role")
      .eq("id", userId)
      .maybeSingle();

    if (usuarioAtualError || !usuarioAtual?.id || !roleValida(usuarioAtual.role)) {
      return NextResponse.json({ error: "Usuario alvo nao encontrado." }, { status: 404 });
    }

    if (!platformOwner && usuarioAtual.role === "platform_owner") {
      return NextResponse.json({ error: "Somente o Proprietario da Plataforma pode alterar este usuario." }, { status: 403 });
    }

    if (!platformOwner && role === "platform_owner") {
      return NextResponse.json({ error: "Somente o Proprietario da Plataforma pode atribuir este perfil." }, { status: 403 });
    }

    if (admin && (typeof email !== "undefined" || (password && password.trim()))) {
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
      if (password && password.trim()) {
        await registrarAuditLog(
          {
            acao: "senha_redefinida",
            entidade: "usuario",
            entidadeId: userId,
            descricao: `Redefiniu a senha do usuario ${email || usuarioAtual.email || userId}.`,
          },
          { request }
        );
      }
    }

    const updatePayload: { email?: string; role?: RoleUsuario; nome?: string | null } = {};

    if (admin && typeof email !== "undefined") {
      updatePayload.email = email;
    }

    if (admin && typeof role !== "undefined" && roleValida(role)) {
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

    if (typeof role !== "undefined" && role !== usuarioAtual.role) {
      await registrarAuditLog(
        {
          acao: "role_alterado",
          entidade: "usuario",
          entidadeId: userId,
          descricao: `Alterou o perfil do usuario ${updatePayload.email || usuarioAtual.email || userId} para ${role}.`,
          dadosAnteriores: { role: usuarioAtual.role },
          dadosNovos: { role },
        },
        { request }
      );
    }

    if (Object.keys(updatePayload).length > 0) {
      await registrarAuditLog(
        {
          acao: "usuario_editado",
          entidade: "usuario",
          entidadeId: userId,
          descricao: `Editou o usuario ${updatePayload.email || usuarioAtual.email || userId}.`,
          dadosAnteriores: {
            nome: usuarioAtual.nome,
            email: usuarioAtual.email,
            role: usuarioAtual.role,
          },
          dadosNovos: {
            nome: typeof updatePayload.nome === "undefined" ? usuarioAtual.nome : updatePayload.nome,
            email: typeof updatePayload.email === "undefined" ? usuarioAtual.email : updatePayload.email,
            role: typeof updatePayload.role === "undefined" ? usuarioAtual.role : updatePayload.role,
          },
        },
        { request }
      );
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

    if (!isAdminRole(auth.usuario.role)) {
      return NextResponse.json({ error: "Usuario sem permissao." }, { status: 403 });
    }

    const body = await request.json();
    const userId = body?.userId as string | undefined;

    if (!userId) {
      return NextResponse.json({ error: "Usuario invalido para exclusao." }, { status: 400 });
    }

    const { data: usuarioAlvo, error: usuarioAlvoError } = await supabaseAdmin
      .from("usuarios")
      .select("id, nome, email, role")
      .eq("id", userId)
      .maybeSingle();

    if (usuarioAlvoError || !usuarioAlvo?.id || !roleValida(usuarioAlvo.role)) {
      return NextResponse.json({ error: "Usuario alvo nao encontrado." }, { status: 404 });
    }

    if (!isPlatformOwner(auth.usuario.role) && usuarioAlvo.role === "platform_owner") {
      return NextResponse.json({ error: "Somente o Proprietario da Plataforma pode excluir este usuario." }, { status: 403 });
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

    await registrarAuditLog(
      {
        acao: "usuario_excluido",
        entidade: "usuario",
        entidadeId: userId,
        descricao: `Excluiu o usuario ${usuarioAlvo.email || userId}.`,
        dadosAnteriores: {
          nome: usuarioAlvo.nome,
          email: usuarioAlvo.email,
          role: usuarioAlvo.role,
        },
      },
      { request }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("ERRO AO EXCLUIR USUARIO:", error);
    return NextResponse.json({ error: "Erro interno ao excluir usuario." }, { status: 500 });
  }
}
