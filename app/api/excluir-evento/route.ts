import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { registrarAuditLog } from "@/lib/auditoria";
import { isAdminRole, resolverRoleUsuario } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";

  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authHeader.slice(7).trim();
}

export async function DELETE(request: Request) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        { error: "Usuário não autenticado." },
        { status: 401 }
      );
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.getUser(token);

    if (authError || !authData?.user?.id) {
      return NextResponse.json(
        { error: "Sessão inválida." },
        { status: 401 }
      );
    }

    const { data: usuarioData, error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .select("id, role")
      .eq("id", authData.user.id)
      .single();

    const role = resolverRoleUsuario(usuarioData?.role);

    if (usuarioError || !usuarioData?.id || !role) {
      return NextResponse.json(
        { error: "Usuário sem permissão." },
        { status: 403 }
      );
    }

    if (!isAdminRole(role)) {
      return NextResponse.json(
        {
          error: "Somente administradores podem excluir eventos.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const eventoId = Number(body?.eventoId);
    const confirmacaoNome = String(body?.confirmacaoNome || "").trim();

    if (!Number.isFinite(eventoId) || eventoId <= 0) {
      return NextResponse.json(
        { error: "Evento inválido." },
        { status: 400 }
      );
    }

    const supabaseWithAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data, error } = await supabaseWithAuth.rpc(
      "excluir_evento_definitivo",
      {
        p_evento_id: eventoId,
        p_confirmacao_nome: confirmacaoNome,
      }
    );

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message ||
            "Não foi possível excluir o evento. Nenhum dado foi removido.",
          details: error.details || null,
          hint: error.hint || null,
          code: error.code || null,
        },
        { status: 400 }
      );
    }

    await registrarAuditLog(
      {
        acao: "evento_excluido",
        entidade: "evento",
        entidadeId: String(eventoId),
        eventoId,
        descricao: `Excluiu o evento ${confirmacaoNome || eventoId}.`,
        dadosAnteriores: {
          confirmacao_nome: confirmacaoNome || null,
          excluido_por: authData.user.id,
          role,
        },
      },
      { request }
    );

    return NextResponse.json({
      success: true,
      result: data,
    });
  } catch (error) {
    console.error("ERRO AO EXCLUIR EVENTO:", error);

    return NextResponse.json(
      {
        error: "Erro interno ao excluir evento.",
        details: null,
        hint: null,
        code: "APP_DELETE_EVENT_INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}