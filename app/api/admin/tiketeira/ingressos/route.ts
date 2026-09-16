import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const EVENTO_TESTE_ID = 28;

function criarSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Variáveis do Supabase não configuradas.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

type SupabaseAdmin = ReturnType<typeof criarSupabaseAdmin>;

async function autenticar(
  request: NextRequest,
  supabaseAdmin: SupabaseAdmin
) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      erro: NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }

  const accessToken = authorization.slice(7).trim();

  if (!accessToken) {
    return {
      erro: NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: erroAuth,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (erroAuth || !user) {
    return {
      erro: NextResponse.json(
        { error: "Sessão inválida ou expirada." },
        { status: 401 }
      ),
    };
  }

  const { data: usuario, error: erroUsuario } = await supabaseAdmin
    .from("usuarios")
    .select("id,nome,email,role,acesso_tiketeira")
    .eq("id", user.id)
    .single();

  if (erroUsuario || !usuario) {
    return {
      erro: NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 403 }
      ),
    };
  }

  if (usuario.acesso_tiketeira !== true) {
    return {
      erro: NextResponse.json(
        { error: "Usuário sem acesso à Tiketeira." },
        { status: 403 }
      ),
    };
  }

  return {
    usuario,
    user,
  };
}

function textoObrigatorio(valor: unknown) {
  if (typeof valor !== "string") {
    return "";
  }

  return valor.trim();
}

function textoOpcional(valor: unknown) {
  if (valor === null || valor === undefined) {
    return null;
  }

  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();

  return texto || null;
}

function numeroInteiro(valor: unknown) {
  const numero = Number(valor);

  if (!Number.isInteger(numero)) {
    return null;
  }

  return numero;
}

function numeroDecimal(valor: unknown) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return null;
  }

  return numero;
}

function booleano(valor: unknown) {
  return typeof valor === "boolean" ? valor : null;
}

function dataOpcional(valor: unknown) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  if (typeof valor !== "string") {
    return undefined;
  }

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return undefined;
  }

  return data.toISOString();
}

async function validarEventoTeste(
  supabaseAdmin: SupabaseAdmin,
  eventoId: number
) {
  if (eventoId !== EVENTO_TESTE_ID) {
    return {
      erro: NextResponse.json(
        {
          error:
            "Este evento ainda não está habilitado para alterações na Tiketeira.",
        },
        { status: 403 }
      ),
    };
  }

  const { data: evento, error } = await supabaseAdmin
    .from("eventos")
    .select("id,nome,slug,ativo")
    .eq("id", EVENTO_TESTE_ID)
    .single();

  if (error || !evento) {
    return {
      erro: NextResponse.json(
        { error: "Evento de homologação não encontrado." },
        { status: 404 }
      ),
    };
  }

  return { evento };
}

async function buscarTipo(
  supabaseAdmin: SupabaseAdmin,
  tipoId: number
) {
  const { data, error } = await supabaseAdmin
    .from("tipos_ingresso")
    .select(
      "id,evento_id,nome,descricao,ordem,ativo,created_at,updated_at"
    )
    .eq("id", tipoId)
    .eq("evento_id", EVENTO_TESTE_ID)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

async function buscarLote(
  supabaseAdmin: SupabaseAdmin,
  loteId: number
) {
  const { data, error } = await supabaseAdmin
    .from("lotes_ingresso")
    .select(
      "id,tipo_ingresso_id,nome,preco,quantidade_total,quantidade_vendida,inicio_vendas,fim_vendas,ativo,created_at,updated_at,tipos_ingresso!inner(evento_id)"
    )
    .eq("id", loteId)
    .eq("tipos_ingresso.evento_id", EVENTO_TESTE_ID)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/*
 * GET
 *
 * Retorna a configuração comercial completa do evento #28.
 * Esta rota é administrativa.
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = criarSupabaseAdmin();

    const autenticacao = await autenticar(
      request,
      supabaseAdmin
    );

    if ("erro" in autenticacao) {
      return autenticacao.erro;
    }

    const validacaoEvento = await validarEventoTeste(
      supabaseAdmin,
      EVENTO_TESTE_ID
    );

    if ("erro" in validacaoEvento) {
      return validacaoEvento.erro;
    }

    const { data: tipos, error: erroTipos } = await supabaseAdmin
      .from("tipos_ingresso")
      .select(
        "id,evento_id,nome,descricao,ordem,ativo,created_at,updated_at"
      )
      .eq("evento_id", EVENTO_TESTE_ID)
      .order("ordem", { ascending: true })
      .order("id", { ascending: true });

    if (erroTipos) {
      console.warn(
        "Tiketeira ingressos - erro ao carregar tipos:",
        erroTipos.message
      );

      return NextResponse.json(
        {
          error:
            "Não foi possível carregar os tipos de ingresso.",
        },
        { status: 500 }
      );
    }

    const idsTipos = (tipos || []).map((tipo) => tipo.id);

    let lotes: unknown[] = [];

    if (idsTipos.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("lotes_ingresso")
        .select(
          "id,tipo_ingresso_id,nome,preco,quantidade_total,quantidade_vendida,inicio_vendas,fim_vendas,ativo,created_at,updated_at"
        )
        .in("tipo_ingresso_id", idsTipos)
        .order("id", { ascending: true });

      if (error) {
        console.warn(
          "Tiketeira ingressos - erro ao carregar lotes:",
          error.message
        );

        return NextResponse.json(
          {
            error:
              "Não foi possível carregar os lotes de ingresso.",
          },
          { status: 500 }
        );
      }

      lotes = data || [];
    }

    return NextResponse.json(
      {
        evento: validacaoEvento.evento,
        tipos: tipos || [],
        lotes,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const mensagem =
      error instanceof Error
        ? error.message
        : "Erro inesperado.";

    console.warn(
      "Erro ao carregar administração de ingressos:",
      mensagem
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível carregar a administração de ingressos.",
      },
      { status: 500 }
    );
  }
}

/*
 * POST
 *
 * Ações permitidas:
 *
 * criar_tipo
 * criar_lote
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = criarSupabaseAdmin();

    const autenticacao = await autenticar(
      request,
      supabaseAdmin
    );

    if ("erro" in autenticacao) {
      return autenticacao.erro;
    }

    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Corpo da requisição inválido." },
        { status: 400 }
      );
    }

    const acao = textoObrigatorio(body.acao);
    const eventoId = numeroInteiro(body.evento_id);

    if (eventoId === null) {
      return NextResponse.json(
        { error: "Evento inválido." },
        { status: 400 }
      );
    }

    const validacaoEvento = await validarEventoTeste(
      supabaseAdmin,
      eventoId
    );

    if ("erro" in validacaoEvento) {
      return validacaoEvento.erro;
    }

    /*
     * CRIAR TIPO
     */

    if (acao === "criar_tipo") {
      const nome = textoObrigatorio(body.nome);
      const descricao = textoOpcional(body.descricao);

      if (!nome) {
        return NextResponse.json(
          {
            error:
              "Informe o nome do tipo de ingresso.",
          },
          { status: 400 }
        );
      }

      let ordem = numeroInteiro(body.ordem);

      if (ordem === null) {
        const { data: ultimoTipo } = await supabaseAdmin
          .from("tipos_ingresso")
          .select("ordem")
          .eq("evento_id", EVENTO_TESTE_ID)
          .order("ordem", { ascending: false })
          .limit(1)
          .maybeSingle();

        ordem = Number(ultimoTipo?.ordem || 0) + 1;
      }

      if (ordem < 0) {
        return NextResponse.json(
          { error: "A ordem não pode ser negativa." },
          { status: 400 }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("tipos_ingresso")
        .insert({
          evento_id: EVENTO_TESTE_ID,
          nome,
          descricao,
          ordem,
          ativo: true,
        })
        .select(
          "id,evento_id,nome,descricao,ordem,ativo,created_at,updated_at"
        )
        .single();

      if (error || !data) {
        console.warn(
          "Tiketeira ingressos - erro ao criar tipo:",
          error?.message
        );

        return NextResponse.json(
          {
            error:
              "Não foi possível criar o tipo de ingresso.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          message: "Tipo de ingresso criado com sucesso.",
          tipo: data,
        },
        { status: 201 }
      );
    }

    /*
     * CRIAR LOTE
     */

    if (acao === "criar_lote") {
      const tipoId = numeroInteiro(body.tipo_ingresso_id);
      const nome = textoObrigatorio(body.nome);
      const preco = numeroDecimal(body.preco);
      const quantidadeTotal = numeroInteiro(
        body.quantidade_total
      );

      const inicioVendas = dataOpcional(
        body.inicio_vendas
      );

      const fimVendas = dataOpcional(
        body.fim_vendas
      );

      if (tipoId === null || tipoId <= 0) {
        return NextResponse.json(
          { error: "Tipo de ingresso inválido." },
          { status: 400 }
        );
      }

      const tipo = await buscarTipo(
        supabaseAdmin,
        tipoId
      );

      if (!tipo) {
        return NextResponse.json(
          {
            error:
              "Tipo de ingresso não encontrado neste evento.",
          },
          { status: 404 }
        );
      }

      if (!nome) {
        return NextResponse.json(
          { error: "Informe o nome do lote." },
          { status: 400 }
        );
      }

      if (preco === null || preco < 0) {
        return NextResponse.json(
          { error: "Informe um preço válido." },
          { status: 400 }
        );
      }

      if (
        quantidadeTotal === null ||
        quantidadeTotal <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "A quantidade total deve ser maior que zero.",
          },
          { status: 400 }
        );
      }

      if (inicioVendas === undefined) {
        return NextResponse.json(
          {
            error:
              "A data inicial de vendas é inválida.",
          },
          { status: 400 }
        );
      }

      if (fimVendas === undefined) {
        return NextResponse.json(
          {
            error:
              "A data final de vendas é inválida.",
          },
          { status: 400 }
        );
      }

      if (
        inicioVendas &&
        fimVendas &&
        new Date(fimVendas).getTime() <=
          new Date(inicioVendas).getTime()
      ) {
        return NextResponse.json(
          {
            error:
              "O fim das vendas deve ser posterior ao início.",
          },
          { status: 400 }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("lotes_ingresso")
        .insert({
          tipo_ingresso_id: tipoId,
          nome,
          preco,
          quantidade_total: quantidadeTotal,
          quantidade_vendida: 0,
          inicio_vendas: inicioVendas,
          fim_vendas: fimVendas,
          ativo: true,
        })
        .select(
          "id,tipo_ingresso_id,nome,preco,quantidade_total,quantidade_vendida,inicio_vendas,fim_vendas,ativo,created_at,updated_at"
        )
        .single();

      if (error || !data) {
        console.warn(
          "Tiketeira ingressos - erro ao criar lote:",
          error?.message
        );

        return NextResponse.json(
          {
            error:
              "Não foi possível criar o lote.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          message: "Lote criado com sucesso.",
          lote: data,
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { error: "Ação inválida." },
      { status: 400 }
    );
  } catch (error) {
    const mensagem =
      error instanceof Error
        ? error.message
        : "Erro inesperado.";

    console.warn(
      "Erro ao criar ingresso/lote:",
      mensagem
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível concluir a operação.",
      },
      { status: 500 }
    );
  }
}

/*
 * PATCH
 *
 * Ações permitidas:
 *
 * editar_tipo
 * alterar_status_tipo
 * editar_lote
 * alterar_status_lote
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabaseAdmin = criarSupabaseAdmin();

    const autenticacao = await autenticar(
      request,
      supabaseAdmin
    );

    if ("erro" in autenticacao) {
      return autenticacao.erro;
    }

    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Corpo da requisição inválido." },
        { status: 400 }
      );
    }

    const acao = textoObrigatorio(body.acao);
    const eventoId = numeroInteiro(body.evento_id);

    if (eventoId === null) {
      return NextResponse.json(
        { error: "Evento inválido." },
        { status: 400 }
      );
    }

    const validacaoEvento = await validarEventoTeste(
      supabaseAdmin,
      eventoId
    );

    if ("erro" in validacaoEvento) {
      return validacaoEvento.erro;
    }

    /*
     * EDITAR TIPO
     */

    if (acao === "editar_tipo") {
      const tipoId = numeroInteiro(body.tipo_ingresso_id);

      if (tipoId === null || tipoId <= 0) {
        return NextResponse.json(
          { error: "Tipo de ingresso inválido." },
          { status: 400 }
        );
      }

      const tipoAtual = await buscarTipo(
        supabaseAdmin,
        tipoId
      );

      if (!tipoAtual) {
        return NextResponse.json(
          { error: "Tipo de ingresso não encontrado." },
          { status: 404 }
        );
      }

      const atualizacao: Record<string, unknown> = {};

      if (body.nome !== undefined) {
        const nome = textoObrigatorio(body.nome);

        if (!nome) {
          return NextResponse.json(
            {
              error:
                "O nome do tipo de ingresso não pode ficar vazio.",
            },
            { status: 400 }
          );
        }

        atualizacao.nome = nome;
      }

      if (body.descricao !== undefined) {
        atualizacao.descricao = textoOpcional(
          body.descricao
        );
      }

      if (body.ordem !== undefined) {
        const ordem = numeroInteiro(body.ordem);

        if (ordem === null || ordem < 0) {
          return NextResponse.json(
            { error: "Ordem inválida." },
            { status: 400 }
          );
        }

        atualizacao.ordem = ordem;
      }

      if (Object.keys(atualizacao).length === 0) {
        return NextResponse.json(
          { error: "Nenhuma alteração informada." },
          { status: 400 }
        );
      }

      atualizacao.updated_at = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from("tipos_ingresso")
        .update(atualizacao)
        .eq("id", tipoId)
        .eq("evento_id", EVENTO_TESTE_ID)
        .select(
          "id,evento_id,nome,descricao,ordem,ativo,created_at,updated_at"
        )
        .single();

      if (error || !data) {
        console.warn(
          "Tiketeira ingressos - erro ao editar tipo:",
          error?.message
        );

        return NextResponse.json(
          {
            error:
              "Não foi possível atualizar o tipo de ingresso.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: "Tipo de ingresso atualizado.",
        tipo: data,
      });
    }

    /*
     * ATIVAR / DESATIVAR TIPO
     */

    if (acao === "alterar_status_tipo") {
      const tipoId = numeroInteiro(body.tipo_ingresso_id);
      const ativo = booleano(body.ativo);

      if (tipoId === null || tipoId <= 0) {
        return NextResponse.json(
          { error: "Tipo de ingresso inválido." },
          { status: 400 }
        );
      }

      if (ativo === null) {
        return NextResponse.json(
          { error: "Status inválido." },
          { status: 400 }
        );
      }

      const tipoAtual = await buscarTipo(
        supabaseAdmin,
        tipoId
      );

      if (!tipoAtual) {
        return NextResponse.json(
          { error: "Tipo de ingresso não encontrado." },
          { status: 404 }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("tipos_ingresso")
        .update({
          ativo,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tipoId)
        .eq("evento_id", EVENTO_TESTE_ID)
        .select(
          "id,evento_id,nome,descricao,ordem,ativo,created_at,updated_at"
        )
        .single();

      if (error || !data) {
        return NextResponse.json(
          {
            error:
              "Não foi possível alterar o status do ingresso.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: ativo
          ? "Tipo de ingresso ativado."
          : "Tipo de ingresso desativado.",
        tipo: data,
      });
    }

    /*
     * EDITAR LOTE
     */

    if (acao === "editar_lote") {
      const loteId = numeroInteiro(body.lote_id);

      if (loteId === null || loteId <= 0) {
        return NextResponse.json(
          { error: "Lote inválido." },
          { status: 400 }
        );
      }

      const loteAtual = await buscarLote(
        supabaseAdmin,
        loteId
      );

      if (!loteAtual) {
        return NextResponse.json(
          {
            error:
              "Lote não encontrado neste evento.",
          },
          { status: 404 }
        );
      }

      const atualizacao: Record<string, unknown> = {};

      if (body.nome !== undefined) {
        const nome = textoObrigatorio(body.nome);

        if (!nome) {
          return NextResponse.json(
            {
              error:
                "O nome do lote não pode ficar vazio.",
            },
            { status: 400 }
          );
        }

        atualizacao.nome = nome;
      }

      if (body.preco !== undefined) {
        const preco = numeroDecimal(body.preco);

        if (preco === null || preco < 0) {
          return NextResponse.json(
            { error: "Preço inválido." },
            { status: 400 }
          );
        }

        atualizacao.preco = preco;
      }

      if (body.quantidade_total !== undefined) {
        const quantidadeTotal = numeroInteiro(
          body.quantidade_total
        );

        if (
          quantidadeTotal === null ||
          quantidadeTotal <= 0
        ) {
          return NextResponse.json(
            {
              error:
                "A quantidade total deve ser maior que zero.",
            },
            { status: 400 }
          );
        }

        /*
         * Não permitimos reduzir a capacidade abaixo do
         * contador operacional já registrado na tabela.
         */
        const quantidadeVendida = Number(
          loteAtual.quantidade_vendida || 0
        );

        if (quantidadeTotal < quantidadeVendida) {
          return NextResponse.json(
            {
              error:
                "A capacidade não pode ser menor que a quantidade já vendida.",
            },
            { status: 400 }
          );
        }

        atualizacao.quantidade_total =
          quantidadeTotal;
      }

      let inicioVendasAtualizado:
        | string
        | null
        | undefined;

      let fimVendasAtualizado:
        | string
        | null
        | undefined;

      if (body.inicio_vendas !== undefined) {
        inicioVendasAtualizado = dataOpcional(
          body.inicio_vendas
        );

        if (inicioVendasAtualizado === undefined) {
          return NextResponse.json(
            {
              error:
                "A data inicial de vendas é inválida.",
            },
            { status: 400 }
          );
        }

        atualizacao.inicio_vendas =
          inicioVendasAtualizado;
      }

      if (body.fim_vendas !== undefined) {
        fimVendasAtualizado = dataOpcional(
          body.fim_vendas
        );

        if (fimVendasAtualizado === undefined) {
          return NextResponse.json(
            {
              error:
                "A data final de vendas é inválida.",
            },
            { status: 400 }
          );
        }

        atualizacao.fim_vendas =
          fimVendasAtualizado;
      }

      const inicioFinal =
        body.inicio_vendas !== undefined
          ? inicioVendasAtualizado
          : loteAtual.inicio_vendas;

      const fimFinal =
        body.fim_vendas !== undefined
          ? fimVendasAtualizado
          : loteAtual.fim_vendas;

      if (
        inicioFinal &&
        fimFinal &&
        new Date(fimFinal).getTime() <=
          new Date(inicioFinal).getTime()
      ) {
        return NextResponse.json(
          {
            error:
              "O fim das vendas deve ser posterior ao início.",
          },
          { status: 400 }
        );
      }

      if (Object.keys(atualizacao).length === 0) {
        return NextResponse.json(
          { error: "Nenhuma alteração informada." },
          { status: 400 }
        );
      }

      atualizacao.updated_at = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from("lotes_ingresso")
        .update(atualizacao)
        .eq("id", loteId)
        .select(
          "id,tipo_ingresso_id,nome,preco,quantidade_total,quantidade_vendida,inicio_vendas,fim_vendas,ativo,created_at,updated_at"
        )
        .single();

      if (error || !data) {
        console.warn(
          "Tiketeira ingressos - erro ao editar lote:",
          error?.message
        );

        return NextResponse.json(
          {
            error:
              "Não foi possível atualizar o lote.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: "Lote atualizado.",
        lote: data,
      });
    }

    /*
     * ATIVAR / DESATIVAR LOTE
     */

    if (acao === "alterar_status_lote") {
      const loteId = numeroInteiro(body.lote_id);
      const ativo = booleano(body.ativo);

      if (loteId === null || loteId <= 0) {
        return NextResponse.json(
          { error: "Lote inválido." },
          { status: 400 }
        );
      }

      if (ativo === null) {
        return NextResponse.json(
          { error: "Status inválido." },
          { status: 400 }
        );
      }

      const loteAtual = await buscarLote(
        supabaseAdmin,
        loteId
      );

      if (!loteAtual) {
        return NextResponse.json(
          {
            error:
              "Lote não encontrado neste evento.",
          },
          { status: 404 }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("lotes_ingresso")
        .update({
          ativo,
          updated_at: new Date().toISOString(),
        })
        .eq("id", loteId)
        .select(
          "id,tipo_ingresso_id,nome,preco,quantidade_total,quantidade_vendida,inicio_vendas,fim_vendas,ativo,created_at,updated_at"
        )
        .single();

      if (error || !data) {
        return NextResponse.json(
          {
            error:
              "Não foi possível alterar o status do lote.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: ativo
          ? "Lote ativado."
          : "Lote desativado.",
        lote: data,
      });
    }

    return NextResponse.json(
      { error: "Ação inválida." },
      { status: 400 }
    );
  } catch (error) {
    const mensagem =
      error instanceof Error
        ? error.message
        : "Erro inesperado.";

    console.warn(
      "Erro ao atualizar ingresso/lote:",
      mensagem
    );

    return NextResponse.json(
      {
        error:
          "Não foi possível concluir a operação.",
      },
      { status: 500 }
    );
  }
}