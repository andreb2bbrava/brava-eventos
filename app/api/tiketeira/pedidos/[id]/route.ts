import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EVENTO_TESTE_ID = 28;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;

    const pedidoId = Number(id);

    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return NextResponse.json(
        { error: "Pedido inválido." },
        { status: 400 }
      );
    }

    const codigoInformado =
      request.nextUrl.searchParams.get("codigo")?.trim() || "";

    if (!codigoInformado) {
      return NextResponse.json(
        { error: "Código do pedido não informado." },
        { status: 400 }
      );
    }

    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from("pedidos")
      .select(`
        id,
        evento_id,
        codigo,
        comprador_nome,
        comprador_email,
        comprador_cpf,
        comprador_telefone,
        subtotal,
        taxa,
        total,
        status,
        forma_pagamento,
        gateway,
        gateway_id,
        pago_em,
        created_at,
        eventos!inner (
          id,
          nome,
          slug,
          data_evento,
          hora_evento,
          local_evento,
          inicio_evento
        )
      `)
      .eq("id", pedidoId)
      .eq("codigo", codigoInformado)
      .eq("evento_id", EVENTO_TESTE_ID)
      .maybeSingle();

    if (pedidoError) {
      console.error("ERRO AO CONSULTAR PEDIDO:", pedidoError);

      return NextResponse.json(
        { error: "Não foi possível consultar o pedido." },
        { status: 500 }
      );
    }

    if (!pedido) {
      return NextResponse.json(
        { error: "Pedido não encontrado." },
        { status: 404 }
      );
    }

    const { data: itens, error: itensError } = await supabaseAdmin
      .from("pedido_itens")
      .select(`
        id,
        tipo_ingresso_id,
        lote_id,
        quantidade,
        valor_unitario,
        valor_total,
        tipos_ingresso!inner (
          id,
          nome
        ),
        lotes_ingresso!inner (
          id,
          nome
        )
      `)
      .eq("pedido_id", pedidoId)
      .order("id", { ascending: true });

    if (itensError) {
      console.error("ERRO AO CONSULTAR ITENS:", itensError);

      return NextResponse.json(
        { error: "Não foi possível consultar os itens do pedido." },
        { status: 500 }
      );
    }

    const quantidade = (itens || []).reduce(
      (total, item) => total + Number(item.quantidade || 0),
      0
    );

    return NextResponse.json({
      pedido: {
        id: Number(pedido.id),
        codigo: String(pedido.codigo),
        eventoId: Number(pedido.evento_id),
        comprador: {
          nome: String(pedido.comprador_nome || ""),
          email: String(pedido.comprador_email || ""),
          cpf: pedido.comprador_cpf
            ? String(pedido.comprador_cpf)
            : null,
          telefone: pedido.comprador_telefone
            ? String(pedido.comprador_telefone)
            : null,
        },
        subtotal: Number(pedido.subtotal || 0),
        taxa: Number(pedido.taxa || 0),
        total: Number(pedido.total || 0),
        status: String(pedido.status || ""),
        formaPagamento: pedido.forma_pagamento
          ? String(pedido.forma_pagamento)
          : null,
        pagoEm: pedido.pago_em,
        createdAt: pedido.created_at,
        quantidade,
        evento: pedido.eventos,
        itens: (itens || []).map((item) => ({
          id: Number(item.id),
          tipoIngressoId: Number(item.tipo_ingresso_id),
          loteId: Number(item.lote_id),
          quantidade: Number(item.quantidade),
          valorUnitario: Number(item.valor_unitario),
          valorTotal: Number(item.valor_total),
          tipoIngresso: item.tipos_ingresso,
          lote: item.lotes_ingresso,
        })),
      },
    });
  } catch (error) {
    console.error("ERRO INTERNO AO CONSULTAR PEDIDO:", error);

    return NextResponse.json(
      { error: "Erro interno ao consultar pedido." },
      { status: 500 }
    );
  }
}