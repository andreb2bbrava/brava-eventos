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

export async function POST(request: Request) {
  try {
    const auth = await autenticarAdmin(request);

    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json();
    const operacaoId = Number(body?.operacaoId);
    const nome = String(body?.nome || "").trim();
    const descricao = String(body?.descricao || "").trim();

    if (!Number.isFinite(operacaoId) || operacaoId <= 0) {
      return NextResponse.json(
        { error: "Selecione uma operacao valida." },
        { status: 400 }
      );
    }

    if (!nome) {
      return NextResponse.json(
        { error: "Informe o nome do projeto." },
        { status: 400 }
      );
    }

    const { data: operacao } = await supabaseAdmin
      .from("operacoes")
      .select("id")
      .eq("id", operacaoId)
      .maybeSingle();

    if (!operacao?.id) {
      return NextResponse.json(
        { error: "Operacao nao encontrada." },
        { status: 404 }
      );
    }

    const slug = gerarSlug(nome);

    const { data: existente } = await supabaseAdmin
      .from("projetos")
      .select("id")
      .eq("operacao_id", operacaoId)
      .eq("slug", slug)
      .maybeSingle();

    if (existente?.id) {
      return NextResponse.json(
        { error: "Ja existe um projeto com este nome nesta operacao." },
        { status: 409 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("projetos")
      .insert({
        operacao_id: operacaoId,
        nome,
        slug,
        descricao: descricao || null,
        criado_por: auth.usuario.id,
        ativo: true,
      })
      .select(
        "id, operacao_id, nome, slug, descricao, responsavel_id, ativo, created_at"
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, projeto: data });
  } catch (error) {
    console.error("ERRO AO CRIAR PROJETO:", error);

    return NextResponse.json(
      { error: "Erro interno ao criar projeto." },
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
    const operacaoId = Number(body?.operacaoId);
    const nome = String(body?.nome || "").trim();
    const descricao = String(body?.descricao || "").trim();
    const ativo =
      typeof body?.ativo === "boolean" ? body.ativo : undefined;

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { error: "Projeto invalido." },
        { status: 400 }
      );
    }

    const { data: projetoAtual, error: projetoAtualError } = await supabaseAdmin
      .from("projetos")
      .select("id, operacao_id, nome, slug")
      .eq("id", id)
      .maybeSingle();

    if (projetoAtualError || !projetoAtual?.id) {
      return NextResponse.json(
        { error: "Projeto nao encontrado." },
        { status: 404 }
      );
    }

    const operacaoFinal =
      Number.isFinite(operacaoId) && operacaoId > 0
        ? operacaoId
        : Number(projetoAtual.operacao_id);

    const updatePayload: {
      operacao_id?: number;
      nome?: string;
      slug?: string;
      descricao?: string | null;
      ativo?: boolean;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (operacaoFinal !== Number(projetoAtual.operacao_id)) {
      const { data: operacao } = await supabaseAdmin
        .from("operacoes")
        .select("id")
        .eq("id", operacaoFinal)
        .maybeSingle();

      if (!operacao?.id) {
        return NextResponse.json(
          { error: "Operacao nao encontrada." },
          { status: 404 }
        );
      }

      updatePayload.operacao_id = operacaoFinal;
    }

    if (nome) {
      const slug = gerarSlug(nome);

      const { data: conflito } = await supabaseAdmin
        .from("projetos")
        .select("id")
        .eq("operacao_id", operacaoFinal)
        .eq("slug", slug)
        .neq("id", id)
        .maybeSingle();

      if (conflito?.id) {
        return NextResponse.json(
          { error: "Ja existe outro projeto com este nome nesta operacao." },
          { status: 409 }
        );
      }

      updatePayload.nome = nome;
      updatePayload.slug = slug;
    }

    if (typeof body?.descricao !== "undefined") {
      updatePayload.descricao = descricao || null;
    }

    if (typeof ativo !== "undefined") {
      updatePayload.ativo = ativo;
    }

    const { data, error } = await supabaseAdmin
      .from("projetos")
      .update(updatePayload)
      .eq("id", id)
      .select(
        "id, operacao_id, nome, slug, descricao, responsavel_id, ativo, created_at"
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, projeto: data });
  } catch (error) {
    console.error("ERRO AO ATUALIZAR PROJETO:", error);

    return NextResponse.json(
      { error: "Erro interno ao atualizar projeto." },
      { status: 500 }
    );
  }
}
