import { NextResponse } from "next/server";
import {
  canCreateListRole,
  canDeleteListRole,
  canEditListRole,
  isAdminRole,
  resolverRoleUsuario,
  type RoleUsuario,
} from "@/lib/roles";
import { sanitizeMetaPixelId } from "@/lib/metaPixel";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type UsuarioAutenticado = {
  id: string;
  role: RoleUsuario;
};

type ListaPayloadEntrada = {
  eventoId?: number;
  listaId?: number;
  nome?: string;
  regra?: string | null;
  tipoVisibilidade?: string | null;
  tipoLista?: string | null;
  metaPixelId?: string | null;
  ativa?: boolean;
  slug?: string | null;
};

function obterToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const [, token] = authHeader.split(" ");
  return token?.trim() || "";
}

async function autenticarUsuario(
  request: Request
): Promise<
  | { ok: true; usuario: UsuarioAutenticado }
  | { ok: false; response: NextResponse }
> {
  const token = obterToken(request);

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sessao invalida." }, { status: 401 }),
    };
  }

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !authData?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sessao invalida." }, { status: 401 }),
    };
  }

  const { data: usuarioData, error: usuarioError } = await supabaseAdmin
    .from("usuarios")
    .select("id, role")
    .eq("id", authData.user.id)
    .single();

  const role = resolverRoleUsuario(usuarioData?.role);

  if (usuarioError || !usuarioData?.id || !role) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Usuario sem permissao." }, { status: 403 }),
    };
  }

  return {
    ok: true,
    usuario: {
      id: usuarioData.id,
      role,
    },
  };
}

async function buscarEvento(eventoId: number) {
  const { data, error } = await supabaseAdmin
    .from("eventos")
    .select("id, nome, criador_id")
    .eq("id", eventoId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

async function usuarioTemAcessoEvento(
  usuario: UsuarioAutenticado,
  eventoId: number
) {
  if (isAdminRole(usuario.role)) {
    return true;
  }

  const evento = await buscarEvento(eventoId);

  if (!evento) {
    return false;
  }

  if (
    usuario.role === "produtor" &&
    evento.criador_id &&
    String(evento.criador_id) === String(usuario.id)
  ) {
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

  if (usuario.role === "staff") {
    const { data } = await supabaseAdmin
      .from("evento_staff")
      .select("id")
      .eq("evento_id", eventoId)
      .eq("usuario_id", usuario.id)
      .maybeSingle();

    return !!data;
  }

  return false;
}

function normalizarNomeLista(valor: string) {
  return valor.trim().toLowerCase();
}

function normalizarTipoLista(valor: string | null | undefined) {
  const tipo = String(valor || "simples").trim().toLowerCase();
  return tipo === "vip" ? "vip" : "simples";
}

function normalizarVisibilidade(valor: string | null | undefined) {
  const visibilidade = String(valor || "privada").trim().toLowerCase();
  return visibilidade === "publica" ? "publica" : "privada";
}

function slugEhValido(valor: string | null | undefined) {
  const slug = String(valor || "").trim();

  if (!slug) {
    return true;
  }

  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

async function validarDuplicidadeNome(
  eventoId: number,
  nome: string,
  listaIdAtual?: number
) {
  const { data, error } = await supabaseAdmin
    .from("listas_evento")
    .select("id, nome")
    .eq("evento_id", eventoId);

  if (error) {
    return {
      ok: false as const,
      error: "Nao foi possivel validar o nome da lista.",
    };
  }

  const nomeNormalizado = normalizarNomeLista(nome);

  const duplicada = (data || []).some((lista) => {
    const mesmoNome =
      normalizarNomeLista(String(lista.nome || "")) === nomeNormalizado;
    const mesmaLista =
      listaIdAtual != null && Number(lista.id) === Number(listaIdAtual);

    return mesmoNome && !mesmaLista;
  });

  if (duplicada) {
    return {
      ok: false as const,
      error: "Ja existe uma lista com esse nome neste evento.",
    };
  }

  return { ok: true as const };
}

function montarDadosLista(body: ListaPayloadEntrada) {
  const nome = String(body?.nome || "").trim();
  const regra = String(body?.regra || "").trim() || null;
  const tipoLista = normalizarTipoLista(body?.tipoLista);
  const tipoVisibilidade = normalizarVisibilidade(body?.tipoVisibilidade);
  const slug = String(body?.slug || "").trim() || null;
  const ativa = typeof body?.ativa === "boolean" ? body.ativa : true;

  const pixelInformado = String(body?.metaPixelId || "")
    .replace(/\s+/g, "")
    .trim();

  const pixelValido = sanitizeMetaPixelId(pixelInformado);

  if (!nome) {
    return {
      ok: false as const,
      error: "Informe o nome da lista.",
    };
  }

  if (pixelInformado && !pixelValido) {
    return {
      ok: false as const,
      error: "Informe um ID de Pixel valido.",
    };
  }

  if (!slugEhValido(slug)) {
    return {
      ok: false as const,
      error: "Slug da lista invalido.",
    };
  }

  return {
    ok: true as const,
    dados: {
      nome,
      regra,
      tipo_lista: tipoLista,
      tipo_visibilidade: tipoVisibilidade,
      meta_pixel_id: pixelValido || null,
      ativa,
      slug,
    },
  };
}

export async function POST(request: Request) {
  try {
    const authResult = await autenticarUsuario(request);

    if (!authResult.ok) {
      return authResult.response;
    }

    if (!canCreateListRole(authResult.usuario.role)) {
      return NextResponse.json(
        { error: "Seu perfil nao pode criar listas." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as ListaPayloadEntrada;
    const eventoId = Number(body?.eventoId);

    if (!Number.isFinite(eventoId)) {
      return NextResponse.json(
        { error: "Evento invalido." },
        { status: 400 }
      );
    }

    const autorizado = await usuarioTemAcessoEvento(
      authResult.usuario,
      eventoId
    );

    if (!autorizado) {
      return NextResponse.json(
        { error: "Voce nao possui acesso a este evento." },
        { status: 403 }
      );
    }

    const dadosResult = montarDadosLista(body);

    if (!dadosResult.ok) {
      return NextResponse.json(
        { error: dadosResult.error },
        { status: 400 }
      );
    }

    const duplicidade = await validarDuplicidadeNome(
      eventoId,
      dadosResult.dados.nome
    );

    if (!duplicidade.ok) {
      return NextResponse.json(
        { error: duplicidade.error },
        { status: 409 }
      );
    }

    const { data: lista, error } = await supabaseAdmin
      .from("listas_evento")
      .insert([
        {
          evento_id: eventoId,
          ...dadosResult.dados,
          criado_por: authResult.usuario.id,
        },
      ])
      .select("*")
      .single();

    if (error || !lista) {
      console.error("Erro ao criar lista:", error);

      return NextResponse.json(
        { error: "Nao foi possivel criar a lista." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      lista,
    });
  } catch (error) {
    console.error("Erro interno ao criar lista:", error);

    return NextResponse.json(
      { error: "Erro interno ao criar lista." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await autenticarUsuario(request);

    if (!authResult.ok) {
      return authResult.response;
    }

    if (!canEditListRole(authResult.usuario.role)) {
      return NextResponse.json(
        { error: "Seu perfil nao pode editar listas." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as ListaPayloadEntrada;
    const eventoId = Number(body?.eventoId);
    const listaId = Number(body?.listaId);

    if (!Number.isFinite(eventoId) || !Number.isFinite(listaId)) {
      return NextResponse.json(
        { error: "Dados invalidos para editar a lista." },
        { status: 400 }
      );
    }

    const autorizado = await usuarioTemAcessoEvento(
      authResult.usuario,
      eventoId
    );

    if (!autorizado) {
      return NextResponse.json(
        { error: "Voce nao possui acesso a este evento." },
        { status: 403 }
      );
    }

    const { data: listaAtual } = await supabaseAdmin
      .from("listas_evento")
      .select("id")
      .eq("id", listaId)
      .eq("evento_id", eventoId)
      .maybeSingle();

    if (!listaAtual) {
      return NextResponse.json(
        { error: "Lista nao encontrada neste evento." },
        { status: 404 }
      );
    }

    const dadosResult = montarDadosLista(body);

    if (!dadosResult.ok) {
      return NextResponse.json(
        { error: dadosResult.error },
        { status: 400 }
      );
    }

    const duplicidade = await validarDuplicidadeNome(
      eventoId,
      dadosResult.dados.nome,
      listaId
    );

    if (!duplicidade.ok) {
      return NextResponse.json(
        { error: duplicidade.error },
        { status: 409 }
      );
    }

    const { data: lista, error } = await supabaseAdmin
      .from("listas_evento")
      .update(dadosResult.dados)
      .eq("id", listaId)
      .eq("evento_id", eventoId)
      .select("*")
      .single();

    if (error || !lista) {
      console.error("Erro ao editar lista:", error);

      return NextResponse.json(
        { error: "Nao foi possivel editar a lista." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      lista,
    });
  } catch (error) {
    console.error("Erro interno ao editar lista:", error);

    return NextResponse.json(
      { error: "Erro interno ao editar lista." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = await autenticarUsuario(request);

    if (!authResult.ok) {
      return authResult.response;
    }

    if (!canDeleteListRole(authResult.usuario.role)) {
      return NextResponse.json(
        { error: "Somente administradores podem excluir listas." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as ListaPayloadEntrada;
    const eventoId = Number(body?.eventoId);
    const listaId = Number(body?.listaId);

    if (!Number.isFinite(eventoId) || !Number.isFinite(listaId)) {
      return NextResponse.json(
        { error: "Dados invalidos para excluir a lista." },
        { status: 400 }
      );
    }

    const { data: listaAtual, error: listaError } = await supabaseAdmin
      .from("listas_evento")
      .select("id, nome, evento_id")
      .eq("id", listaId)
      .eq("evento_id", eventoId)
      .maybeSingle();

    if (listaError || !listaAtual) {
      return NextResponse.json(
        { error: "Lista nao encontrada neste evento." },
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from("listas_evento")
      .delete()
      .eq("id", listaId)
      .eq("evento_id", eventoId);

    if (deleteError) {
      console.error("Erro ao excluir lista:", deleteError);

      return NextResponse.json(
        { error: "Nao foi possivel excluir a lista." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      lista: {
        id: listaAtual.id,
        nome: listaAtual.nome,
      },
    });
  } catch (error) {
    console.error("Erro interno ao excluir lista:", error);

    return NextResponse.json(
      { error: "Erro interno ao excluir lista." },
      { status: 500 }
    );
  }
}
