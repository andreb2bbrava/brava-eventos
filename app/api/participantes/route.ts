import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RoleUsuario = "super_admin" | "produtor" | "staff";

type UsuarioAutenticado = {
  id: string;
  role: RoleUsuario;
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function obterToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const [, token] = authHeader.split(" ");
  return token?.trim() || "";
}

async function autenticarUsuario(request: Request): Promise<{ ok: true; usuario: UsuarioAutenticado } | { ok: false; response: NextResponse }> {
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

  const role = usuarioData?.role as RoleUsuario | undefined;

  if (usuarioError || !usuarioData?.id || !role || (role !== "super_admin" && role !== "produtor" && role !== "staff")) {
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

async function validarAcessoEvento(usuario: UsuarioAutenticado, eventoId: number) {
  if (usuario.role === "super_admin") {
    return true;
  }

  if (usuario.role === "produtor") {
    const { data } = await supabaseAdmin
      .from("evento_produtores")
      .select("id")
      .eq("evento_id", eventoId)
      .eq("usuario_id", usuario.id)
      .maybeSingle();

    return !!data;
  }

  const { data } = await supabaseAdmin
    .from("evento_staff")
    .select("id")
    .eq("evento_id", eventoId)
    .eq("usuario_id", usuario.id)
    .maybeSingle();

  return !!data;
}

async function buscarParticipanteNoEvento(participanteId: number, eventoId: number) {
  const { data } = await supabaseAdmin
    .from("participantes")
    .select("id, nome, evento_id")
    .eq("id", participanteId)
    .eq("evento_id", eventoId)
    .maybeSingle();

  return data;
}

export async function PATCH(request: Request) {
  try {
    const authResult = await autenticarUsuario(request);
    if (!authResult.ok) {
      return authResult.response;
    }

    const body = (await request.json()) as {
      participanteId?: number;
      eventoId?: number;
      action?: "checkin" | "undo-checkin";
    };

    const participanteId = Number(body?.participanteId);
    const eventoId = Number(body?.eventoId);
    const action = body?.action;

    if (!Number.isFinite(participanteId) || !Number.isFinite(eventoId) || (action !== "checkin" && action !== "undo-checkin")) {
      return NextResponse.json({ error: "Dados invalidos para atualizar participante." }, { status: 400 });
    }

    const autorizado = await validarAcessoEvento(authResult.usuario, eventoId);
    if (!autorizado) {
      return NextResponse.json({ error: "Voce nao possui acesso a este evento." }, { status: 403 });
    }

    const participante = await buscarParticipanteNoEvento(participanteId, eventoId);
    if (!participante) {
      return NextResponse.json({ error: "Participante nao encontrado neste evento." }, { status: 404 });
    }

    const updatePayload =
      action === "checkin"
        ? {
            presente: true,
            entrada_confirmada_em: new Date().toISOString(),
          }
        : {
            presente: false,
            entrada_confirmada_em: null,
          };

    const { data: participanteAtualizado, error: updateError } = await supabaseAdmin
      .from("participantes")
      .update(updatePayload)
      .eq("id", participanteId)
      .eq("evento_id", eventoId)
      .select("id, nome, presente, entrada_confirmada_em")
      .single();

    if (updateError || !participanteAtualizado) {
      return NextResponse.json({ error: "Nao foi possivel atualizar o check-in." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      participante: participanteAtualizado,
    });
  } catch {
    return NextResponse.json({ error: "Erro interno ao atualizar participante." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = await autenticarUsuario(request);
    if (!authResult.ok) {
      return authResult.response;
    }

    const body = (await request.json()) as {
      participanteId?: number;
      eventoId?: number;
    };

    const participanteId = Number(body?.participanteId);
    const eventoId = Number(body?.eventoId);

    if (!Number.isFinite(participanteId) || !Number.isFinite(eventoId)) {
      return NextResponse.json({ error: "Dados invalidos para excluir participante." }, { status: 400 });
    }

    const autorizado = await validarAcessoEvento(authResult.usuario, eventoId);
    if (!autorizado) {
      return NextResponse.json({ error: "Voce nao possui acesso a este evento." }, { status: 403 });
    }

    const participante = await buscarParticipanteNoEvento(participanteId, eventoId);
    if (!participante) {
      return NextResponse.json({ error: "Participante nao encontrado neste evento." }, { status: 404 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("participantes")
      .delete()
      .eq("id", participanteId)
      .eq("evento_id", eventoId);

    if (deleteError) {
      return NextResponse.json({ error: "Nao foi possivel excluir participante." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      participante: {
        id: participante.id,
        nome: participante.nome,
      },
    });
  } catch {
    return NextResponse.json({ error: "Erro interno ao excluir participante." }, { status: 500 });
  }
}
