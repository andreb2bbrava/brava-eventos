import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EVENTO_TESTE_ID = 28;
const EVENTO_TESTE_SLUG = "teste-tiketeira";

type ItemRecebido = {
  loteId?: unknown;
  tipoIngressoId?: unknown;
  quantidade?: unknown;
};

type ItemValidado = {
  loteId: number;
  tipoIngressoId: number;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
};

function texto(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function gerarCodigoPedido() {
  const agora = Date.now().toString(36).toUpperCase();
  const aleatorio = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `BRV-${agora}-${aleatorio}`;
}

export async function POST(request: NextRequest) {
  let pedidoCriadoId: number | null = null;

  try {
    const body = await request.json();

    const slug = texto(body?.slug);
    const compradorNome = texto(body?.compradorNome);
    const compradorEmail = texto(body?.compradorEmail).toLowerCase();
    const compradorCpf = texto(body?.compradorCpf);
    const compradorTelefone = texto(body?.compradorTelefone);

    const itensRecebidos: ItemRecebido[] = Array.isArray(body?.itens)
      ? body.itens
      : [];

    if (slug !== EVENTO_TESTE_SLUG) {
      return NextResponse.json(
        {
          error:
            "Criação de pedidos liberada somente para o evento de teste.",
        },
        { status: 403 }
      );
    }

    if (!compradorNome || !compradorEmail) {
      return NextResponse.json(
        { error: "Nome e e-mail do comprador são obrigatórios." },
        { status: 400 }
      );
    }

    if (itensRecebidos.length === 0) {
      return NextResponse.json(
        { error: "Nenhum ingresso foi informado." },
        { status: 400 }
      );
    }

    const { data: evento, error: eventoError } = await supabaseAdmin
      .from("eventos")
      .select("id,nome,slug,ativo")
      .eq("id", EVENTO_TESTE_ID)
      .eq("slug", EVENTO_TESTE_SLUG)
      .eq("ativo", true)
      .maybeSingle();

    if (eventoError) {
      console.error("ERRO AO VALIDAR EVENTO:", eventoError);

      return NextResponse.json(
        { error: "Não foi possível validar o evento." },
        { status: 500 }
      );
    }

    if (!evento) {
      return NextResponse.json(
        { error: "Evento de teste não encontrado ou indisponível." },
        { status: 404 }
      );
    }

    const itensNormalizados = itensRecebidos
      .map((item) => ({
        loteId: Number(item?.loteId),
        tipoIngressoId: Number(item?.tipoIngressoId),
        quantidade: Math.trunc(Number(item?.quantidade)),
      }))
      .filter(
        (item) =>
          Number.isInteger(item.loteId) &&
          item.loteId > 0 &&
          Number.isInteger(item.tipoIngressoId) &&
          item.tipoIngressoId > 0 &&
          Number.isInteger(item.quantidade) &&
          item.quantidade > 0 &&
          item.quantidade <= 10
      );

    if (itensNormalizados.length !== itensRecebidos.length) {
      return NextResponse.json(
        { error: "Há ingressos inválidos no pedido." },
        { status: 400 }
      );
    }

    const loteIds = [
      ...new Set(itensNormalizados.map((item) => item.loteId)),
    ];

    if (loteIds.length !== itensNormalizados.length) {
      return NextResponse.json(
        { error: "O pedido contém lotes duplicados." },
        { status: 400 }
      );
    }

    const { data: lotes, error: lotesError } = await supabaseAdmin
      .from("lotes_ingresso")
      .select(`
        id,
        tipo_ingresso_id,
        nome,
        preco,
        quantidade_total,
        quantidade_vendida,
        inicio_vendas,
        fim_vendas,
        ativo,
        tipos_ingresso!inner (
          id,
          evento_id,
          nome,
          ativo
        )
      `)
      .in("id", loteIds)
      .eq("ativo", true)
      .eq("tipos_ingresso.evento_id", EVENTO_TESTE_ID)
      .eq("tipos_ingresso.ativo", true);

    if (lotesError) {
      console.error("ERRO AO VALIDAR LOTES:", lotesError);

      return NextResponse.json(
        { error: "Não foi possível validar os ingressos." },
        { status: 500 }
      );
    }

    if (!lotes || lotes.length !== itensNormalizados.length) {
      return NextResponse.json(
        {
          error:
            "Um ou mais ingressos não pertencem ao evento ou estão indisponíveis.",
        },
        { status: 400 }
      );
    }

    const agora = new Date();
    const itensValidados: ItemValidado[] = [];

    for (const item of itensNormalizados) {
      const lote = lotes.find(
        (registro) => Number(registro.id) === item.loteId
      );

      if (!lote) {
        return NextResponse.json(
          { error: "Ingresso selecionado não encontrado." },
          { status: 400 }
        );
      }

      if (Number(lote.tipo_ingresso_id) !== item.tipoIngressoId) {
        return NextResponse.json(
          { error: "Tipo de ingresso inválido." },
          { status: 400 }
        );
      }

      if (lote.inicio_vendas) {
        const inicio = new Date(lote.inicio_vendas);

        if (!Number.isNaN(inicio.getTime()) && agora < inicio) {
          return NextResponse.json(
            { error: "A venda de um dos ingressos ainda não começou." },
            { status: 400 }
          );
        }
      }

      if (lote.fim_vendas) {
        const fim = new Date(lote.fim_vendas);

        if (!Number.isNaN(fim.getTime()) && agora > fim) {
          return NextResponse.json(
            { error: "A venda de um dos ingressos já foi encerrada." },
            { status: 400 }
          );
        }
      }

      const quantidadeTotal = Number(lote.quantidade_total || 0);
      const quantidadeVendida = Number(lote.quantidade_vendida || 0);
      const disponivel = Math.max(
        0,
        quantidadeTotal - quantidadeVendida
      );

      if (item.quantidade > disponivel) {
        return NextResponse.json(
          {
            error:
              "A quantidade solicitada de um dos ingressos não está mais disponível.",
          },
          { status: 409 }
        );
      }

      const valorUnitario = Number(lote.preco);

      if (!Number.isFinite(valorUnitario) || valorUnitario < 0) {
        return NextResponse.json(
          { error: "Preço inválido para um dos ingressos." },
          { status: 500 }
        );
      }

      itensValidados.push({
        loteId: item.loteId,
        tipoIngressoId: item.tipoIngressoId,
        quantidade: item.quantidade,
        valorUnitario,
        valorTotal: valorUnitario * item.quantidade,
      });
    }

    const subtotal = itensValidados.reduce(
      (total, item) => total + item.valorTotal,
      0
    );

    const taxa = 0;
    const total = subtotal + taxa;
    const codigo = gerarCodigoPedido();

    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from("pedidos")
      .insert({
        evento_id: EVENTO_TESTE_ID,
        codigo,
        comprador_nome: compradorNome,
        comprador_email: compradorEmail,
        comprador_cpf: compradorCpf || null,
        comprador_telefone: compradorTelefone || null,
        subtotal,
        taxa,
        total,
        status: "pendente",
        forma_pagamento: "pix",
        gateway: null,
        gateway_id: null,
        pago_em: null,
      })
      .select("id,codigo,total,status,created_at")
      .single();

    if (pedidoError || !pedido) {
      console.error("ERRO AO CRIAR PEDIDO:", pedidoError);

      return NextResponse.json(
        { error: "Não foi possível criar o pedido." },
        { status: 500 }
      );
    }

    pedidoCriadoId = Number(pedido.id);

    const itensParaInserir = itensValidados.map((item) => ({
      pedido_id: pedidoCriadoId,
      tipo_ingresso_id: item.tipoIngressoId,
      lote_id: item.loteId,
      quantidade: item.quantidade,
      valor_unitario: item.valorUnitario,
      valor_total: item.valorTotal,
    }));

    const { error: itensError } = await supabaseAdmin
      .from("pedido_itens")
      .insert(itensParaInserir);

    if (itensError) {
      console.error("ERRO AO CRIAR ITENS DO PEDIDO:", itensError);

      // Compensação nesta primeira versão:
      // se os itens falharem, removemos o pedido recém-criado.
      await supabaseAdmin
        .from("pedidos")
        .delete()
        .eq("id", pedidoCriadoId);

      return NextResponse.json(
        { error: "Não foi possível registrar os itens do pedido." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        pedido: {
          id: pedidoCriadoId,
          codigo: String(pedido.codigo),
          eventoId: EVENTO_TESTE_ID,
          eventoSlug: EVENTO_TESTE_SLUG,
          quantidade: itensValidados.reduce(
            (soma, item) => soma + item.quantidade,
            0
          ),
          subtotal,
          taxa,
          total,
          status: String(pedido.status),
          formaPagamento: "pix",
          createdAt: pedido.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("ERRO INTERNO AO CRIAR PEDIDO:", error);

    return NextResponse.json(
      { error: "Erro interno ao criar pedido." },
      { status: 500 }
    );
  }
}