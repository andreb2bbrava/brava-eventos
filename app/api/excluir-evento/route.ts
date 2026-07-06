import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const body = await request.json();
    const eventoId = Number(body?.eventoId);

    if (!Number.isFinite(eventoId) || eventoId <= 0) {
      return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
    }

    const { data: usuarioData, error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .select("role")
      .eq("id", user.id)
      .single();

    if (usuarioError || !usuarioData) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 403 });
    }

    const role = usuarioData.role as string;

    if (role === "staff") {
      return NextResponse.json({ error: "Staff não possui permissão para excluir eventos." }, { status: 403 });
    }

    const { data: eventoData, error: eventoError } = await supabaseAdmin
      .from("eventos")
      .select("id, criador_id")
      .eq("id", eventoId)
      .maybeSingle();

    if (eventoError || !eventoData) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    let autorizado = false;

    if (role === "super_admin") {
      autorizado = true;
    }

    if (role === "produtor") {
      const { data: vinculoData, error: vinculoError } = await supabaseAdmin
        .from("evento_produtores")
        .select("id")
        .eq("evento_id", eventoId)
        .eq("usuario_id", user.id)
        .maybeSingle();

      if (!vinculoError && vinculoData) {
        autorizado = true;
      }

      if (!autorizado && eventoData.criador_id && String(eventoData.criador_id) === String(user.id)) {
        autorizado = true;
      }
    }

    if (!autorizado) {
      return NextResponse.json({ error: "Você não possui permissão para excluir este evento." }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin.from("eventos").delete().eq("id", eventoId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("ERRO AO EXCLUIR EVENTO:", error);
    return NextResponse.json({ error: "Erro interno ao excluir evento." }, { status: 500 });
  }
}
