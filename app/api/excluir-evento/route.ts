import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { registrarAuditLog } from "@/lib/auditoria";

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
      return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const eventoId = Number(body?.eventoId);
    const confirmacaoNome = String(body?.confirmacaoNome || "");

    if (!Number.isFinite(eventoId) || eventoId <= 0) {
      return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
    }

    const supabaseWithAuth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data, error } = await supabaseWithAuth.rpc("excluir_evento_definitivo", {
      p_evento_id: eventoId,
      p_confirmacao_nome: confirmacaoNome,
    });

    if (error) {
      return NextResponse.json(
        {
          error: error.message || "Não foi possível excluir o evento. Nenhum dado foi removido.",
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
        },
      },
      { request }
    );

    return NextResponse.json({ success: true, result: data });
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
