import { NextResponse } from "next/server";
import { isAdminRole, resolverRoleUsuario } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type TipoVinculo = "produtor" | "staff";

function obterToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const [, token] = authHeader.split(" ");
  return token?.trim() || "";
}

function nomeExibicaoUsuario(usuario: { nome?: string | null; email?: string | null }) {
  if (usuario.nome && usuario.nome.trim()) {
    return usuario.nome.trim();
  }

  if (usuario.email && usuario.email.trim()) {
    return usuario.email.trim();
  }

  return "Usuario sem nome";
}

async function autenticar(request: Request) {
  const token = obterToken(request);

  if (!token) {
    return { ok: false as const, response: NextResponse.json({ error: "Sessao invalida." }, { status: 401 }) };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authData?.user?.id) {
    return { ok: false as const, response: NextResponse.json({ error: "Sessao invalida." }, { status: 401 }) };
  }

  const { data: usuarioData, error: usuarioError } = await supabaseAdmin
    .from("usuarios")
    .select("id, role")
    .eq("id", authData.user.id)
    .single();

  const role = resolverRoleUsuario(usuarioData?.role || null);

  if (usuarioError || !usuarioData?.id || !role) {
    return { ok: false as const, response: NextResponse.json({ error: "Usuario sem permissao." }, { status: 403 }) };
  }

  return {
    ok: true as const,
    usuario: {
      id: usuarioData.id,
      role,
    },
  };
}

async function buscarEventoPorSlug(slug: string) {
  const { data, error } = await supabaseAdmin
    .from("eventos")
    .select("id, nome, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

async function usuarioTemAcessoEvento(usuarioId: string, role: string, eventoId: number) {
  if (isAdminRole(role)) {
    return true;
  }

  if (role === "produtor") {
    const { data: vinculoProdutor } = await supabaseAdmin
      .from("evento_produtores")
      .select("id")
      .eq("evento_id", eventoId)
      .eq("usuario_id", usuarioId)
      .maybeSingle();

    return !!vinculoProdutor;
  }

  const { data: vinculoStaff } = await supabaseAdmin
    .from("evento_staff")
    .select("id")
    .eq("evento_id", eventoId)
    .eq("usuario_id", usuarioId)
    .maybeSingle();

  return !!vinculoStaff;
}

function podeGerenciarProdutores(role: string) {
  return isAdminRole(role);
}

function podeGerenciarStaff(role: string) {
  return isAdminRole(role) || role === "produtor";
}

function logErroSupabase(error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
} | null | undefined) {
  if (!error) {
    return;
  }

  console.error({
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });
}

async function montarPayloadEquipe(eventoId: number) {
  const [
    { data: produtoresVinculadosData },
    { data: staffsVinculadosData },
    { data: usuariosData },
  ] = await Promise.all([
    supabaseAdmin.from("evento_produtores").select("id, usuario_id").eq("evento_id", eventoId),
    supabaseAdmin.from("evento_staff").select("id, usuario_id").eq("evento_id", eventoId),
    supabaseAdmin.from("usuarios").select("id, nome, email, role").in("role", ["produtor", "staff", "super_admin", "platform_owner"]),
  ]);

  const usuarios = (usuariosData || []) as Array<{
    id: string;
    nome: string | null;
    email: string | null;
    role: string | null;
  }>;

  const usuarioPorId = new Map<string, (typeof usuarios)[number]>();
  usuarios.forEach((usuario) => {
    usuarioPorId.set(usuario.id, usuario);
  });

  const produtoresVinculados = ((produtoresVinculadosData || []) as Array<{ id: number; usuario_id: string | null }>)
    .map((vinculo) => {
      if (!vinculo.usuario_id) {
        return null;
      }

      const usuario = usuarioPorId.get(vinculo.usuario_id);
      if (!usuario) {
        return null;
      }

      return {
        idVinculo: vinculo.id,
        usuarioId: usuario.id,
        nome: nomeExibicaoUsuario(usuario),
        email: usuario.email || "-",
        role: usuario.role || "-",
      };
    })
    .filter(Boolean);

  const staffsVinculados = ((staffsVinculadosData || []) as Array<{ id: number; usuario_id: string | null }>)
    .map((vinculo) => {
      if (!vinculo.usuario_id) {
        return null;
      }

      const usuario = usuarioPorId.get(vinculo.usuario_id);
      if (!usuario) {
        return null;
      }

      return {
        idVinculo: vinculo.id,
        usuarioId: usuario.id,
        nome: nomeExibicaoUsuario(usuario),
        email: usuario.email || "-",
        role: usuario.role || "-",
      };
    })
    .filter(Boolean);

  const usuariosProdutores = usuarios
    .filter((usuario) => usuario.role === "produtor" || usuario.role === "super_admin" || usuario.role === "platform_owner")
    .map((usuario) => ({
      id: usuario.id,
      nome: nomeExibicaoUsuario(usuario),
      email: usuario.email || "-",
      role: usuario.role || "-",
    }));

  const usuariosStaff = usuarios
    .filter((usuario) => usuario.role === "staff")
    .map((usuario) => ({
      id: usuario.id,
      nome: nomeExibicaoUsuario(usuario),
      email: usuario.email || "-",
      role: usuario.role || "-",
    }));

  return {
    produtoresVinculados,
    staffsVinculados,
    usuariosProdutores,
    usuariosStaff,
  };
}

export async function GET(request: Request) {
  try {
    const auth = await autenticar(request);
    if (!auth.ok) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const slug = String(searchParams.get("slug") || "").trim();

    if (!slug) {
      return NextResponse.json({ error: "Evento nao encontrado." }, { status: 400 });
    }

    const evento = await buscarEventoPorSlug(slug);

    if (!evento) {
      return NextResponse.json({ error: "Evento nao encontrado." }, { status: 404 });
    }

    const autorizado = await usuarioTemAcessoEvento(auth.usuario.id, auth.usuario.role, Number(evento.id));

    if (!autorizado) {
      return NextResponse.json({ error: "Voce nao possui permissao para acessar este evento." }, { status: 403 });
    }

    const equipe = await montarPayloadEquipe(Number(evento.id));

    return NextResponse.json({
      evento,
      role: auth.usuario.role,
      podeGerenciarProdutores: podeGerenciarProdutores(auth.usuario.role),
      podeGerenciarStaff: podeGerenciarStaff(auth.usuario.role),
      ...equipe,
    });
  } catch {
    return NextResponse.json({ error: "Erro interno ao carregar equipe do evento." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await autenticar(request);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as {
      slug?: string;
      tipo?: TipoVinculo;
      usuarioId?: string;
    };

    const slug = String(body?.slug || "").trim();
    const tipo = body?.tipo;
    const usuarioId = String(body?.usuarioId || "").trim();

    if (!slug || (tipo !== "produtor" && tipo !== "staff") || !usuarioId) {
      return NextResponse.json({ error: "Dados invalidos para vincular membro." }, { status: 400 });
    }

    const evento = await buscarEventoPorSlug(slug);

    if (!evento) {
      return NextResponse.json({ error: "Evento nao encontrado." }, { status: 404 });
    }

    const autorizado = await usuarioTemAcessoEvento(auth.usuario.id, auth.usuario.role, Number(evento.id));

    if (!autorizado) {
      return NextResponse.json({ error: "Voce nao possui permissao para acessar este evento." }, { status: 403 });
    }

    if (tipo === "produtor" && !podeGerenciarProdutores(auth.usuario.role)) {
      return NextResponse.json({ error: "Seu perfil nao pode vincular produtores." }, { status: 403 });
    }

    if (tipo === "staff" && !podeGerenciarStaff(auth.usuario.role)) {
      return NextResponse.json({ error: "Seu perfil nao pode vincular staff." }, { status: 403 });
    }

    const { data: usuarioAlvo } = await supabaseAdmin
      .from("usuarios")
      .select("id, role")
      .eq("id", usuarioId)
      .maybeSingle();

    if (!usuarioAlvo?.id) {
      return NextResponse.json({ error: "Usuario nao encontrado." }, { status: 404 });
    }

    if (tipo === "produtor" && usuarioAlvo.role !== "produtor" && usuarioAlvo.role !== "super_admin" && usuarioAlvo.role !== "platform_owner") {
      return NextResponse.json({ error: "Usuario invalido para vinculo de produtor." }, { status: 400 });
    }

    if (tipo === "staff" && usuarioAlvo.role !== "staff") {
      return NextResponse.json({ error: "Usuario invalido para vinculo de staff." }, { status: 400 });
    }

    if (tipo === "produtor") {
      const { data: existente } = await supabaseAdmin
        .from("evento_produtores")
        .select("id")
        .eq("evento_id", evento.id)
        .eq("usuario_id", usuarioId)
        .maybeSingle();

      if (existente) {
        return NextResponse.json({ error: "Este produtor ja esta vinculado ao evento." }, { status: 409 });
      }

      const { error: insertError } = await supabaseAdmin.from("evento_produtores").insert({ evento_id: evento.id, usuario_id: usuarioId });

      if (insertError) {
        console.error("ERRO VINCULAR MEMBRO:", insertError);
        logErroSupabase(insertError);
        return NextResponse.json(
          { error: "Nao foi possivel vincular produtor.", message: insertError.message || "Erro ao vincular produtor." },
          { status: 400 }
        );
      }
    } else {
      const { data: existente } = await supabaseAdmin
        .from("evento_staff")
        .select("id")
        .eq("evento_id", evento.id)
        .eq("usuario_id", usuarioId)
        .maybeSingle();

      if (existente) {
        return NextResponse.json({ error: "Este staff ja esta vinculado ao evento." }, { status: 409 });
      }

      const { error: insertError } = await supabaseAdmin.from("evento_staff").insert({ evento_id: evento.id, usuario_id: usuarioId });

      if (insertError) {
        console.error("ERRO VINCULAR MEMBRO:", insertError);
        logErroSupabase(insertError);
        return NextResponse.json(
          { error: "Nao foi possivel vincular staff.", message: insertError.message || "Erro ao vincular staff." },
          { status: 400 }
        );
      }
    }

    const equipe = await montarPayloadEquipe(Number(evento.id));

    return NextResponse.json({
      evento,
      role: auth.usuario.role,
      podeGerenciarProdutores: podeGerenciarProdutores(auth.usuario.role),
      podeGerenciarStaff: podeGerenciarStaff(auth.usuario.role),
      ...equipe,
    });
  } catch (error) {
    console.error("ERRO VINCULAR MEMBRO:", error);
    const erroNormalizado =
      error && typeof error === "object"
        ? (error as { message?: string; details?: string; hint?: string; code?: string })
        : null;
    logErroSupabase(erroNormalizado);

    return NextResponse.json(
      {
        error: "Erro interno ao vincular membro.",
        message: erroNormalizado?.message || "Erro interno ao vincular membro.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await autenticar(request);
    if (!auth.ok) {
      return auth.response;
    }

    const body = (await request.json()) as {
      slug?: string;
      tipo?: TipoVinculo;
      usuarioId?: string;
    };

    const slug = String(body?.slug || "").trim();
    const tipo = body?.tipo;
    const usuarioId = String(body?.usuarioId || "").trim();

    if (!slug || (tipo !== "produtor" && tipo !== "staff") || !usuarioId) {
      return NextResponse.json({ error: "Dados invalidos para remover vinculo." }, { status: 400 });
    }

    const evento = await buscarEventoPorSlug(slug);

    if (!evento) {
      return NextResponse.json({ error: "Evento nao encontrado." }, { status: 404 });
    }

    const autorizado = await usuarioTemAcessoEvento(auth.usuario.id, auth.usuario.role, Number(evento.id));

    if (!autorizado) {
      return NextResponse.json({ error: "Voce nao possui permissao para acessar este evento." }, { status: 403 });
    }

    if (tipo === "produtor" && !podeGerenciarProdutores(auth.usuario.role)) {
      return NextResponse.json({ error: "Seu perfil nao pode remover produtores." }, { status: 403 });
    }

    if (tipo === "staff" && !podeGerenciarStaff(auth.usuario.role)) {
      return NextResponse.json({ error: "Seu perfil nao pode remover staff." }, { status: 403 });
    }

    if (tipo === "produtor") {
      const { error: deleteError } = await supabaseAdmin
        .from("evento_produtores")
        .delete()
        .eq("evento_id", evento.id)
        .eq("usuario_id", usuarioId);

      if (deleteError) {
        return NextResponse.json({ error: "Nao foi possivel remover produtor." }, { status: 400 });
      }
    } else {
      const { error: deleteError } = await supabaseAdmin
        .from("evento_staff")
        .delete()
        .eq("evento_id", evento.id)
        .eq("usuario_id", usuarioId);

      if (deleteError) {
        return NextResponse.json({ error: "Nao foi possivel remover staff." }, { status: 400 });
      }
    }

    const equipe = await montarPayloadEquipe(Number(evento.id));

    return NextResponse.json({
      evento,
      role: auth.usuario.role,
      podeGerenciarProdutores: podeGerenciarProdutores(auth.usuario.role),
      podeGerenciarStaff: podeGerenciarStaff(auth.usuario.role),
      ...equipe,
    });
  } catch {
    return NextResponse.json({ error: "Erro interno ao remover vinculo." }, { status: 500 });
  }
}
