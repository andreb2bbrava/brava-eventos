"use server";

import { NextResponse } from "next/server";
import { isAdminRole, resolverRoleUsuario } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AuthOk = {
  ok: true;
  usuario: {
    id: string;
    role: string;
  };
};

type AuthErro = {
  ok: false;
  response: NextResponse;
};

function obterToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const [, token] = authHeader.split(" ");
  return token?.trim() || "";
}

async function autenticarAdmin(request: Request): Promise<AuthOk | AuthErro> {
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

  const role = resolverRoleUsuario(usuarioData?.role || null);

  if (usuarioError || !usuarioData?.id || !role || !isAdminRole(role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Usuario sem permissao." },
        { status: 403 }
      ),
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

function gerarSlug(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(request: Request) {
  try {
    const auth = await autenticarAdmin(request);

    if (!auth.ok) {
      return auth.response;
    }

    const { data: operacoes, error: operacoesError } = await supabaseAdmin
      .from("operacoes")
      .select(`
        id,
        nome,
        slug,
        descricao,
        responsavel_id,
        ativa,
        created_at
      `)
      .order("nome", { ascending: true });

    if (operacoesError) {
      return NextResponse.json(
        { error: operacoesError.message },
        { status: 400 }
      );
    }

    const { data: projetos, error: projetosError } = await supabaseAdmin
      .from("projetos")
      .select(`
        id,
        operacao_id,
        nome,
        slug,
        descricao,
        responsavel_id,
        ativo,
        created_at
      `)
      .order("nome", { ascending: true });

    if (projetosError) {
      return NextResponse.json(
        { error: projetosError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      operacoes: operacoes || [],
      projetos: projetos || [],
      role: auth.usuario.role,
    });
  } catch (error) {
    console.error("ERRO AO CARREGAR OPERACOES:", error);

    return NextResponse.json(
      { error: "Erro interno ao carregar operacoes." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await autenticarAdmin(request);

    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json();
    const nome = String(body?.nome || "").trim();
    const descricao = String(body?.descricao || "").trim();

    if (!nome) {
      return NextResponse.json(
        { error: "Informe o nome da operacao." },
        { status: 400 }
      );
    }

    const slug = gerarSlug(nome);

    if (!slug) {
      return NextResponse.json(
        { error: "Nao foi possivel gerar o identificador da operacao." },
        { status: 400 }
      );
    }

    const { data: existente } = await supabaseAdmin
      .from("operacoes")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existente?.id) {
      return NextResponse.json(
        { error: "Ja existe uma operacao com este nome." },
        { status: 409 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("operacoes")
      .insert({
        nome,
        slug,
        descricao: descricao || null,
        criada_por: auth.usuario.id,
        ativa: true,
      })
      .select("id, nome, slug, descricao, responsavel_id, ativa, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, operacao: data });
  } catch (error) {
    console.error("ERRO AO CRIAR OPERACAO:", error);

    return NextResponse.json(
      { error: "Erro interno ao criar operacao." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await autenticarAdmin(request);

    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json();
    const id = Number(body?.id);
    const nome = String(body?.nome || "").trim();
    const descricao = String(body?.descricao || "").trim();
    const ativa =
      typeof body?.ativa === "boolean" ? body.ativa : undefined;

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { error: "Operacao invalida." },
        { status: 400 }
      );
    }

    const updatePayload: {
      nome?: string;
      slug?: string;
      descricao?: string | null;
      ativa?: boolean;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (nome) {
      const slug = gerarSlug(nome);

      const { data: conflito } = await supabaseAdmin
        .from("operacoes")
        .select("id")
        .eq("slug", slug)
        .neq("id", id)
        .maybeSingle();

      if (conflito?.id) {
        return NextResponse.json(
          { error: "Ja existe outra operacao com este nome." },
          { status: 409 }
        );
      }

      updatePayload.nome = nome;
      updatePayload.slug = slug;
    }

    if (typeof body?.descricao !== "undefined") {
      updatePayload.descricao = descricao || null;
    }

    if (typeof ativa !== "undefined") {
      updatePayload.ativa = ativa;
    }

    const { data, error } = await supabaseAdmin
      .from("operacoes")
      .update(updatePayload)
      .eq("id", id)
      .select("id, nome, slug, descricao, responsavel_id, ativa, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, operacao: data });
  } catch (error) {
    console.error("ERRO AO ATUALIZAR OPERACAO:", error);

    return NextResponse.json(
      { error: "Erro interno ao atualizar operacao." },
      { status: 500 }
    );
  }
}
