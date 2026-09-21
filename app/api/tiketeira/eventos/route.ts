import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type EventoRegistro = {
  id: number;
  nome: string;
  slug: string;
  descricao: string | null;
  data_evento: string | null;
  hora_evento: string | null;
  local_evento: string | null;
  banner_url: string | null;
};

type TipoRegistro = {
  id: number;
  evento_id: number;
};

type LoteRegistro = {
  id: number;
  tipo_ingresso_id: number;
  preco: number | string;
  quantidade_total: number;
  quantidade_vendida: number;
  inicio_vendas: string | null;
  fim_vendas: string | null;
  ativo: boolean;
};

function loteDisponivel(lote: LoteRegistro) {
  const agora = new Date();

  if (!lote.ativo) return false;

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

function dataHojeISO() {
  const agora = new Date();

  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

export async function GET() {
  try {
    const { data: eventos, error: eventosError } = await supabaseAdmin
      .from("eventos")
      .select(
        "id,nome,slug,descricao,data_evento,hora_evento,local_evento,banner_url"
      )
      .eq("ativo", true)
      .gte("data_evento", dataHojeISO())
      .order("data_evento", { ascending: true })
      .order("hora_evento", { ascending: true });

    if (eventosError) {
      console.error("ERRO TIKETEIRA - VITRINE EVENTOS:", eventosError);

      return NextResponse.json(
        { error: "Erro ao carregar eventos da Tiketeira." },
        { status: 500 }
      );
    }

    const eventosAtivos = (eventos || []) as EventoRegistro[];

    if (eventosAtivos.length === 0) {
      return NextResponse.json({ eventos: [] });
    }

    const eventoIds = eventosAtivos.map((evento) => evento.id);

    const { data: tipos, error: tiposError } = await supabaseAdmin
      .from("tipos_ingresso")
      .select("id,evento_id")
      .in("evento_id", eventoIds)
      .eq("ativo", true);

    if (tiposError) {
      console.error("ERRO TIKETEIRA - VITRINE TIPOS:", tiposError);

      return NextResponse.json(
        { error: "Erro ao carregar ingressos da Tiketeira." },
        { status: 500 }
      );
    }

    const tiposAtivos = (tipos || []) as TipoRegistro[];

    if (tiposAtivos.length === 0) {
      return NextResponse.json({ eventos: [] });
    }

    const tipoIds = tiposAtivos.map((tipo) => tipo.id);

    const { data: lotes, error: lotesError } = await supabaseAdmin
      .from("lotes_ingresso")
      .select(
        "id,tipo_ingresso_id,preco,quantidade_total,quantidade_vendida,inicio_vendas,fim_vendas,ativo"
      )
      .in("tipo_ingresso_id", tipoIds)
      .eq("ativo", true);

    if (lotesError) {
      console.error("ERRO TIKETEIRA - VITRINE LOTES:", lotesError);

      return NextResponse.json(
        { error: "Erro ao carregar lotes da Tiketeira." },
        { status: 500 }
      );
    }

    const lotesDisponiveis = ((lotes || []) as LoteRegistro[]).filter(
      loteDisponivel
    );

    const eventosTiketeira = eventosAtivos.flatMap((evento) => {
      const tiposDoEvento = tiposAtivos.filter(
        (tipo) => tipo.evento_id === evento.id
      );

      const idsTiposDoEvento = new Set(
        tiposDoEvento.map((tipo) => tipo.id)
      );

      const lotesDoEvento = lotesDisponiveis.filter((lote) =>
        idsTiposDoEvento.has(lote.tipo_ingresso_id)
      );

      if (lotesDoEvento.length === 0) {
        return [];
      }

      const precos = lotesDoEvento
        .map((lote) => Number(lote.preco))
        .filter((preco) => Number.isFinite(preco));

      const menorPreco =
        precos.length > 0 ? Math.min(...precos) : 0;

      return [
        {
          id: evento.id,
          nome: evento.nome,
          slug: evento.slug,
          descricao: evento.descricao,
          data_evento: evento.data_evento,
          hora_evento: evento.hora_evento,
          local_evento: evento.local_evento,
          banner_url: evento.banner_url,
          menor_preco: menorPreco,
        },
      ];
    });

    return NextResponse.json({
      eventos: eventosTiketeira,
    });
  } catch (error) {
    console.error("ERRO INTERNO - VITRINE TIKETEIRA:", error);

    return NextResponse.json(
      { error: "Erro interno ao carregar eventos da Tiketeira." },
      { status: 500 }
    );
  }
}
