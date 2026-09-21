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

function numero(valor: unknown) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function statusPago(status: string | null | undefined) {
  const valor = (status || "").trim().toLowerCase();

  return ["pago", "paid", "aprovado", "approved"].includes(valor);
}

function statusPendente(status: string | null | undefined) {
  const valor = (status || "").trim().toLowerCase();

  return [
    "pendente",
    "pending",
    "aguardando_pagamento",
    "aguardando pagamento",
  ].includes(valor);
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = criarSupabaseAdmin();

    /*
     * 1. AUTENTICAÇÃO
     *
     * O navegador precisa enviar o access token atual.
     * Não confiamos apenas na proteção visual da página.
     */

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const accessToken = authorization.slice(7).trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: erroAuth,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (erroAuth || !user) {
      return NextResponse.json(
        { error: "Sessão inválida ou expirada." },
        { status: 401 }
      );
    }

    /*
     * 2. PERMISSÃO DO MÓDULO
     */

    const { data: usuario, error: erroUsuario } = await supabaseAdmin
      .from("usuarios")
      .select(
        "id,nome,email,role,acesso_listas,acesso_tiketeira"
      )
      .eq("id", user.id)
      .single();

    if (erroUsuario || !usuario) {
      console.warn(
        "Tiketeira dashboard - usuário não encontrado:",
        erroUsuario?.message
      );

      return NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 403 }
      );
    }

    if (usuario.acesso_tiketeira !== true) {
      return NextResponse.json(
        { error: "Usuário sem acesso à Tiketeira." },
        { status: 403 }
      );
    }

    /*
     * 3. EVENTO
     *
     * Homologação travada exclusivamente no evento #28.
     */

    const { data: evento, error: erroEvento } = await supabaseAdmin
      .from("eventos")
      .select(
        "id,nome,slug,data_evento,hora_evento,local_evento,inicio_evento,ativo"
      )
      .eq("id", EVENTO_TESTE_ID)
      .single();

    if (erroEvento || !evento) {
      console.warn(
        "Tiketeira dashboard - evento não encontrado:",
        erroEvento?.message
      );

      return NextResponse.json(
        { error: "Evento da Tiketeira não encontrado." },
        { status: 404 }
      );
    }

    /*
     * 4. TIPOS DE INGRESSO
     */

    const { data: tiposData, error: erroTipos } = await supabaseAdmin
      .from("tipos_ingresso")
      .select("id,nome,descricao,ordem,ativo")
      .eq("evento_id", EVENTO_TESTE_ID)
      .order("ordem", { ascending: true })
      .order("id", { ascending: true });

    if (erroTipos) {
      console.warn(
        "Tiketeira dashboard - erro nos tipos:",
        erroTipos.message
      );

      return NextResponse.json(
        { error: "Não foi possível carregar os tipos de ingresso." },
        { status: 500 }
      );
    }

    /*
     * 5. LOTES
     */

    const idsTipos = (tiposData || []).map((tipo) => tipo.id);

    let lotesData: Array<{
      id: number;
      tipo_ingresso_id: number;
      nome: string;
      preco: number | string;
      quantidade_total: number;
      quantidade_vendida: number;
      inicio_vendas: string | null;
      fim_vendas: string | null;
      ativo: boolean;
    }> = [];

    if (idsTipos.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("lotes_ingresso")
        .select(
          "id,tipo_ingresso_id,nome,preco,quantidade_total,quantidade_vendida,inicio_vendas,fim_vendas,ativo"
        )
        .in("tipo_ingresso_id", idsTipos)
        .order("id", { ascending: true });

      if (error) {
        console.warn(
          "Tiketeira dashboard - erro nos lotes:",
          error.message
        );

        return NextResponse.json(
          { error: "Não foi possível carregar os lotes." },
          { status: 500 }
        );
      }

      lotesData = data || [];
    }

    /*
     * 6. PEDIDOS DO EVENTO
     */

    const { data: pedidosData, error: erroPedidos } = await supabaseAdmin
      .from("pedidos")
      .select(
        "id,codigo,comprador_nome,comprador_email,subtotal,taxa,total,status,forma_pagamento,pago_em,created_at"
      )
      .eq("evento_id", EVENTO_TESTE_ID)
      .order("created_at", { ascending: false });

    if (erroPedidos) {
      console.warn(
        "Tiketeira dashboard - erro nos pedidos:",
        erroPedidos.message
      );

      return NextResponse.json(
        { error: "Não foi possível carregar os pedidos." },
        { status: 500 }
      );
    }

    const pedidos = pedidosData || [];
    const idsPedidos = pedidos.map((pedido) => pedido.id);

    /*
     * 7. ITENS DOS PEDIDOS
     */

    let itensData: Array<{
      id: number;
      pedido_id: number;
      tipo_ingresso_id: number;
      lote_id: number;
      quantidade: number;
      valor_unitario: number | string;
      valor_total: number | string;
    }> = [];

    if (idsPedidos.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("pedido_itens")
        .select(
          "id,pedido_id,tipo_ingresso_id,lote_id,quantidade,valor_unitario,valor_total"
        )
        .in("pedido_id", idsPedidos);

      if (error) {
        console.warn(
          "Tiketeira dashboard - erro nos itens:",
          error.message
        );

        return NextResponse.json(
          { error: "Não foi possível carregar os itens dos pedidos." },
          { status: 500 }
        );
      }

      itensData = data || [];
    }

    /*
     * 8. CLASSIFICAÇÃO DOS PEDIDOS
     */

    const idsPedidosPagos = new Set<number>();
    const idsPedidosPendentes = new Set<number>();

    let receitaConfirmada = 0;
    let receitaPendente = 0;

    for (const pedido of pedidos) {
      if (statusPago(pedido.status)) {
        idsPedidosPagos.add(pedido.id);
        receitaConfirmada += numero(pedido.total);
      } else if (statusPendente(pedido.status)) {
        idsPedidosPendentes.add(pedido.id);
        receitaPendente += numero(pedido.total);
      }
    }

    /*
     * 9. INGRESSOS
     *
     * "Vendidos" = somente itens pertencentes a pedidos pagos.
     * Pedidos pendentes ficam separados como aguardando pagamento.
     */

    let ingressosVendidos = 0;
    let ingressosPendentes = 0;

    for (const item of itensData) {
      if (idsPedidosPagos.has(item.pedido_id)) {
        ingressosVendidos += numero(item.quantidade);
      }

      if (idsPedidosPendentes.has(item.pedido_id)) {
        ingressosPendentes += numero(item.quantidade);
      }
    }

    /*
     * 10. TICKET MÉDIO
     */

    const pedidosPagos = idsPedidosPagos.size;
    const pedidosPendentes = idsPedidosPendentes.size;

    const ticketMedio =
      pedidosPagos > 0
        ? receitaConfirmada / pedidosPagos
        : 0;

    /*
     * 11. CAPACIDADE
     */

    const capacidadeTotal = lotesData.reduce(
      (total, lote) => total + numero(lote.quantidade_total),
      0
    );

    /*
     * Como ainda não temos reserva transacional de estoque,
     * a disponibilidade comercial continua baseada nos ingressos
     * efetivamente pagos.
     *
     * Pendentes são apresentados separadamente.
     */

    const disponiveis = Math.max(
      capacidadeTotal - ingressosVendidos,
      0
    );

    /*
     * 12. PERFORMANCE POR TIPO / LOTE
     */

    const performanceTipos = (tiposData || []).map((tipo) => {
      const lotesTipo = lotesData.filter(
        (lote) => lote.tipo_ingresso_id === tipo.id
      );

      const capacidade = lotesTipo.reduce(
        (total, lote) => total + numero(lote.quantidade_total),
        0
      );

      const idsLotesTipo = new Set(
        lotesTipo.map((lote) => lote.id)
      );

      let vendidos = 0;
      let pendentes = 0;
      let receita = 0;

      for (const item of itensData) {
        if (!idsLotesTipo.has(item.lote_id)) {
          continue;
        }

        if (idsPedidosPagos.has(item.pedido_id)) {
          vendidos += numero(item.quantidade);
          receita += numero(item.valor_total);
        }

        if (idsPedidosPendentes.has(item.pedido_id)) {
          pendentes += numero(item.quantidade);
        }
      }

      return {
        tipo_ingresso_id: tipo.id,
        nome: tipo.nome,
        descricao: tipo.descricao,
        ativo: tipo.ativo,
        capacidade,
        vendidos,
        pendentes,
        disponiveis: Math.max(capacidade - vendidos, 0),
        receita,
        percentual_vendido:
          capacidade > 0
            ? Number(
                ((vendidos / capacidade) * 100).toFixed(2)
              )
            : 0,
        lotes: lotesTipo.map((lote) => {
          let vendidosLote = 0;
          let pendentesLote = 0;
          let receitaLote = 0;

          for (const item of itensData) {
            if (item.lote_id !== lote.id) {
              continue;
            }

            if (idsPedidosPagos.has(item.pedido_id)) {
              vendidosLote += numero(item.quantidade);
              receitaLote += numero(item.valor_total);
            }

            if (idsPedidosPendentes.has(item.pedido_id)) {
              pendentesLote += numero(item.quantidade);
            }
          }

          return {
            lote_id: lote.id,
            nome: lote.nome,
            preco: numero(lote.preco),
            capacidade: numero(lote.quantidade_total),
            vendidos: vendidosLote,
            pendentes: pendentesLote,
            disponiveis: Math.max(
              numero(lote.quantidade_total) - vendidosLote,
              0
            ),
            receita: receitaLote,
            ativo: lote.ativo,
          };
        }),
      };
    });

    /*
     * 13. FORMAS DE PAGAMENTO
     */

    const formasPagamento = new Map<
      string,
      {
        forma: string;
        pedidos: number;
        receita: number;
      }
    >();

    for (const pedido of pedidos) {
      if (!statusPago(pedido.status)) {
        continue;
      }

      const forma =
        (pedido.forma_pagamento || "não informado")
          .trim()
          .toLowerCase();

      const atual = formasPagamento.get(forma) || {
        forma,
        pedidos: 0,
        receita: 0,
      };

      atual.pedidos += 1;
      atual.receita += numero(pedido.total);

      formasPagamento.set(forma, atual);
    }

    /*
     * 14. ÚLTIMOS PEDIDOS
     *
     * Não devolvemos CPF ou telefone neste dashboard.
     */

    const ultimosPedidos = pedidos.slice(0, 10).map((pedido) => {
      const quantidade = itensData
        .filter((item) => item.pedido_id === pedido.id)
        .reduce(
          (total, item) => total + numero(item.quantidade),
          0
        );

      return {
        id: pedido.id,
        codigo: pedido.codigo,
        comprador_nome: pedido.comprador_nome,
        comprador_email: pedido.comprador_email,
        quantidade,
        total: numero(pedido.total),
        status: pedido.status,
        forma_pagamento: pedido.forma_pagamento,
        pago_em: pedido.pago_em,
        created_at: pedido.created_at,
      };
    });

    /*
     * 15. RESPOSTA
     */

    return NextResponse.json(
      {
        evento: {
          id: evento.id,
          nome: evento.nome,
          slug: evento.slug,
          data_evento: evento.data_evento,
          hora_evento: evento.hora_evento,
          local_evento: evento.local_evento,
          inicio_evento: evento.inicio_evento,
          ativo: evento.ativo,
        },

        resumo: {
          receita_confirmada: receitaConfirmada,
          receita_pendente: receitaPendente,

          pedidos_total: pedidos.length,
          pedidos_pagos: pedidosPagos,
          pedidos_pendentes: pedidosPendentes,

          ingressos_vendidos: ingressosVendidos,
          ingressos_pendentes: ingressosPendentes,

          ticket_medio: ticketMedio,

          capacidade_total: capacidadeTotal,
          disponiveis,
        },

        performance_tipos: performanceTipos,

        formas_pagamento: Array.from(
          formasPagamento.values()
        ),

        ultimos_pedidos: ultimosPedidos,
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
      "Erro no dashboard administrativo da Tiketeira:",
      mensagem
    );

    return NextResponse.json(
      {
        error: "Não foi possível carregar o Dashboard Tiketeira.",
      },
      { status: 500 }
    );
  }
}