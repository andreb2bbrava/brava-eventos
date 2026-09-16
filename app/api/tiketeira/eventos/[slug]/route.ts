import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type LoteRegistro = {
  id: number;
  tipo_ingresso_id: number;
  nome: string;
  preco: number | string;
  quantidade_total: number;
  quantidade_vendida: number;
  inicio_vendas: string | null;
  fim_vendas: string | null;
  ativo: boolean;
};

function loteDisponivel(lote: LoteRegistro) {
  const agora = new Date();

  if (!lote.ativo) {
    return false;
  }

  if (lote.inicio_vendas) {
    const inicio = new Date(lote.inicio_vendas);

    if (!Number.isNaN(inicio.getTime()) && agora < inicio) {
      return false;
    }
  }

  if (lote.fim_vendas) {
    const fim = new Date(lote.fim_vendas);

    if (!Number.isNaN(fim.getTime()) && agora > fim) {
      return false;
    }
  }

  return lote.quantidade_vendida < lote.quantidade_total;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;

    if (!slug) {
      return NextResponse.json(
        { error: "Evento não informado." },
        { status: 400 }
      );
    }

    // =====================================================
    // EVENTO
    // =====================================================

    const { data: evento, error: eventoError } = await supabaseAdmin
      .from("eventos")
      .select(
        "id,nome,slug,descricao,data_evento,hora_evento,local_evento,banner_url,inicio_evento,ativo"
      )
      .eq("slug", slug)
      .eq("ativo", true)
      .maybeSingle();

    if (eventoError) {
      console.error("ERRO TIKETEIRA - EVENTO:", eventoError);

      return NextResponse.json(
        { error: "Erro ao carregar evento." },
        { status: 500 }
      );
    }

    if (!evento) {
      return NextResponse.json(
        { error: "Evento não encontrado." },
        { status: 404 }
      );
    }

    // =====================================================
    // TIPOS DE INGRESSO
    // =====================================================

    const { data: tipos, error: tiposError } = await supabaseAdmin
      .from("tipos_ingresso")
      .select("id,nome,descricao,ordem,ativo")
      .eq("evento_id", evento.id)
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .order("id", { ascending: true });

    if (tiposError) {
      console.error("ERRO TIKETEIRA - TIPOS:", tiposError);

      return NextResponse.json(
        { error: "Erro ao carregar tipos de ingresso." },
        { status: 500 }
      );
    }

    const tiposAtivos = tipos || [];

    if (tiposAtivos.length === 0) {
      return NextResponse.json({
        evento,
        ingressos: [],
      });
    }

    // =====================================================
    // LOTES
    // =====================================================

    const tipoIds = tiposAtivos.map((tipo) => tipo.id);

    const { data: lotes, error: lotesError } = await supabaseAdmin
      .from("lotes_ingresso")
      .select(
        "id,tipo_ingresso_id,nome,preco,quantidade_total,quantidade_vendida,inicio_vendas,fim_vendas,ativo"
      )
      .in("tipo_ingresso_id", tipoIds)
      .eq("ativo", true)
      .order("id", { ascending: true });

    if (lotesError) {
      console.error("ERRO TIKETEIRA - LOTES:", lotesError);

      return NextResponse.json(
        { error: "Erro ao carregar lotes." },
        { status: 500 }
      );
    }

    const lotesAtivos = (lotes || []) as LoteRegistro[];

    // =====================================================
    // ESCOLHE O PRIMEIRO LOTE DISPONÍVEL DE CADA TIPO
    // =====================================================

    const ingressos = tiposAtivos.flatMap((tipo) => {
      const lote = lotesAtivos.find(
        (item) =>
          item.tipo_ingresso_id === tipo.id &&
          loteDisponivel(item)
      );

      if (!lote) {
        return [];
      }

      return [
        {
          lote_id: lote.id,
          tipo_ingresso_id: tipo.id,

          nome: tipo.nome,
          descricao: tipo.descricao || "",

          lote: lote.nome,
          preco: Number(lote.preco),

          quantidade_total: lote.quantidade_total,
          quantidade_vendida: lote.quantidade_vendida,

          disponivel: Math.max(
            0,
            lote.quantidade_total - lote.quantidade_vendida
          ),
        },
      ];
    });

    return NextResponse.json({
      evento: {
        id: evento.id,
        nome: evento.nome,
        slug: evento.slug,
        descricao: evento.descricao,
        data_evento: evento.data_evento,
        hora_evento: evento.hora_evento,
        local_evento: evento.local_evento,
        banner_url: evento.banner_url,
        inicio_evento: evento.inicio_evento,
      },

      ingressos,
    });
  } catch (error) {
    console.error("ERRO INTERNO TIKETEIRA:", error);

    return NextResponse.json(
      { error: "Erro interno ao carregar Tiketeira." },
      { status: 500 }
    );
  }
}