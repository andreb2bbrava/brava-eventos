import { NextResponse } from "next/server";
import { registrarAuditLog } from "@/lib/auditoria";
import { classificarParticipante } from "@/lib/inteligencia";
import { canEditEventRole, isAdminRole, resolverRoleUsuario, type RoleUsuario } from "@/lib/roles";
import { erroEhDuplicidadeParticipante, normalizarNomeParticipante } from "@/lib/participantes";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type UsuarioAutenticado = {
  id: string;
  role: RoleUsuario;
};

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

  const role = resolverRoleUsuario(usuarioData?.role);

  if (usuarioError || !usuarioData?.id || !role) {
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
  if (isAdminRole(usuario.role)) {
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
    .select("id, nome, evento_id, lista_id")
    .eq("id", participanteId)
    .eq("evento_id", eventoId)
    .maybeSingle();

  return data;
}

async function buscarEventoResumo(eventoId: number) {
  const { data } = await supabaseAdmin.from("eventos").select("id, nome").eq("id", eventoId).maybeSingle();
  return data;
}

export async function POST(request: Request) {
  try {
    const authResult = await autenticarUsuario(request);
    if (!authResult.ok) {
      return authResult.response;
    }

    if (!canEditEventRole(authResult.usuario.role)) {
      return NextResponse.json({ error: "Usuario sem permissao para cadastrar participantes." }, { status: 403 });
    }

    const body = (await request.json()) as {
      modo?: "single" | "bulk";
      eventoId?: number;
      listaId?: number;
      participante?: {
        nome?: string;
        whatsapp?: string | null;
        email?: string | null;
      };
      nomes?: string[];
    };

    const modo = body?.modo;
    const eventoId = Number(body?.eventoId);
    const listaId = Number(body?.listaId);

    if (!Number.isFinite(eventoId) || !Number.isFinite(listaId) || (modo !== "single" && modo !== "bulk")) {
      return NextResponse.json({ error: "Dados invalidos para cadastro de participante." }, { status: 400 });
    }

    const autorizado = await validarAcessoEvento(authResult.usuario, eventoId);
    if (!autorizado) {
      return NextResponse.json({ error: "Voce nao possui acesso a este evento." }, { status: 403 });
    }

    const evento = await buscarEventoResumo(eventoId);

    if (modo === "single") {
      const nome = String(body?.participante?.nome || "").trim();
      const whatsapp = String(body?.participante?.whatsapp || "").trim();
      const email = String(body?.participante?.email || "").trim();

      if (!nome) {
        return NextResponse.json({ error: "Nome obrigatorio." }, { status: 400 });
      }

      const nomeNormalizado = normalizarNomeParticipante(nome);
      const classificacao = classificarParticipante(nome);

      const { data: novoParticipante, error } = await supabaseAdmin
        .from("participantes")
        .insert([
          {
            evento_id: eventoId,
            lista_id: listaId,
            nome,
            nome_normalizado: nomeNormalizado,
            whatsapp: whatsapp || null,
            email: email || null,
            sexo_estimado: classificacao.sexoEstimado,
            confianca_sexo: classificacao.confiancaSexo,
            metodo_classificacao: classificacao.metodoClassificacao,
            motor_inteligencia: classificacao.motorInteligencia,
            versao_motor: classificacao.versaoMotor,
            classificado_em: classificacao.classificadoEm,
            presente: false,
          },
        ])
        .select("id, nome, whatsapp, email, presente, entrada_confirmada_em")
        .single();

      if (error || !novoParticipante) {
        if (erroEhDuplicidadeParticipante(error)) {
          return NextResponse.json({ error: "Participante já cadastrado nesta lista." }, { status: 409 });
        }

        return NextResponse.json({ error: "Nao foi possivel adicionar participante." }, { status: 400 });
      }

      await registrarAuditLog(
        {
          acao: "participante_adicionado",
          entidade: "participante",
          entidadeId: String(novoParticipante.id),
          eventoId,
          listaId,
          participanteId: novoParticipante.id,
          descricao: `Adicionou o participante ${nome}${evento?.nome ? ` no evento ${evento.nome}.` : "."}`,
          dadosNovos: {
            nome,
            whatsapp: whatsapp || null,
            email: email || null,
          },
        },
        { request }
      );

      return NextResponse.json({ success: true, participante: novoParticipante });
    }

    const nomesRaw = Array.isArray(body?.nomes) ? body.nomes : [];
    const nomes = nomesRaw.map((item) => String(item || "").trim()).filter(Boolean);

    if (nomes.length === 0) {
      return NextResponse.json({ error: "Informe ao menos um nome para importacao." }, { status: 400 });
    }

    const payload: Array<{
      evento_id: number;
      lista_id: number;
      nome: string;
      nome_normalizado: string;
      sexo_estimado: string;
      confianca_sexo: number;
      metodo_classificacao: string;
      motor_inteligencia: string;
      versao_motor: string;
      classificado_em: string;
      presente: boolean;
    }> = [];

    for (const nome of nomes) {
      const nomeNormalizado = normalizarNomeParticipante(nome);
      if (!nomeNormalizado) {
        continue;
      }

      const classificacao = classificarParticipante(nome);

      payload.push({
        evento_id: eventoId,
        lista_id: listaId,
        nome,
        nome_normalizado: nomeNormalizado,
        sexo_estimado: classificacao.sexoEstimado,
        confianca_sexo: classificacao.confiancaSexo,
        metodo_classificacao: classificacao.metodoClassificacao,
        motor_inteligencia: classificacao.motorInteligencia,
        versao_motor: classificacao.versaoMotor,
        classificado_em: classificacao.classificadoEm,
        presente: false,
      });
    }

    if (payload.length === 0) {
      return NextResponse.json({ success: true, inseridos: 0, ignorados: nomes.length });
    }

    const { error: insertError } = await supabaseAdmin.from("participantes").insert(payload);

    if (insertError) {
      if (erroEhDuplicidadeParticipante(insertError)) {
        return NextResponse.json({ error: "Participante já cadastrado nesta lista." }, { status: 409 });
      }

      return NextResponse.json({ error: "Nao foi possivel importar participantes." }, { status: 400 });
    }

    await registrarAuditLog(
      {
        acao: "importacao_massa_participantes",
        entidade: "participante",
        eventoId,
        listaId,
        descricao: `Adicionou ${payload.length} participantes em massa${evento?.nome ? ` no evento ${evento.nome}.` : "."}`,
        dadosNovos: {
          quantidade_inserida: payload.length,
          quantidade_ignorada: nomes.length - payload.length,
        },
      },
      { request }
    );

    return NextResponse.json({
      success: true,
      inseridos: payload.length,
      ignorados: nomes.length - payload.length,
    });
  } catch {
    return NextResponse.json({ error: "Erro interno ao cadastrar participantes." }, { status: 500 });
  }
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

    const evento = await buscarEventoResumo(eventoId);

    await registrarAuditLog(
      {
        acao: action === "checkin" ? "checkin_realizado" : "checkin_desfeito",
        entidade: "participante",
        entidadeId: String(participanteId),
        eventoId,
        listaId: participante.lista_id || null,
        participanteId,
        descricao:
          action === "checkin"
            ? `Realizou check-in de ${participante.nome}${evento?.nome ? ` no evento ${evento.nome}.` : "."}`
            : `Desfez o check-in de ${participante.nome}${evento?.nome ? ` no evento ${evento.nome}.` : "."}`,
        dadosAnteriores: {
          presente: action !== "checkin",
        },
        dadosNovos: {
          presente: action === "checkin",
        },
      },
      { request }
    );

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

    const evento = await buscarEventoResumo(eventoId);

    await registrarAuditLog(
      {
        acao: "participante_excluido",
        entidade: "participante",
        entidadeId: String(participanteId),
        eventoId,
        listaId: participante.lista_id || null,
        participanteId,
        descricao: `Excluiu o participante ${participante.nome}${evento?.nome ? ` do evento ${evento.nome}.` : "."}`,
        dadosAnteriores: {
          nome: participante.nome,
        },
      },
      { request }
    );

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
