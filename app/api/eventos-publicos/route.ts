import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type EventoRegistro = Record<string, unknown> & {
  id?: number;
  nome?: string;
  slug?: string;
  data_evento?: string | null;
  hora_evento?: string | null;
  local_evento?: string | null;
  tipo_lista?: string | null;
  banner_url?: string | null;
  banner_posicao?: string | null;
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function dataHojeISO() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function eventoPublicadoOuAtivo(evento: EventoRegistro) {
  const temAtivo = Object.prototype.hasOwnProperty.call(evento, "ativo");
  const temPublicado = Object.prototype.hasOwnProperty.call(evento, "publicado");
  const temStatus = Object.prototype.hasOwnProperty.call(evento, "status");

  if (!temAtivo && !temPublicado && !temStatus) {
    return true;
  }

  if (temAtivo) {
    const ativo = evento.ativo;
    if (!(ativo === true || ativo === 1 || ativo === "1" || ativo === "true" || ativo === "t")) {
      return false;
    }
  }

  if (temPublicado) {
    const publicado = evento.publicado;
    if (!(publicado === true || publicado === 1 || publicado === "1" || publicado === "true" || publicado === "t")) {
      return false;
    }
  }

  if (temStatus) {
    const status = String(evento.status || "").toLowerCase().trim();
    const statusAtivos = new Set(["ativo", "publicado", "aberto", "em_andamento", "andamento", "agendado"]);
    if (status && !statusAtivos.has(status)) {
      return false;
    }
  }

  return true;
}

export async function GET() {
  try {
    const hoje = dataHojeISO();

    const { data, error } = await supabaseAdmin
      .from("eventos")
      .select("*")
      .gte("data_evento", hoje)
      .order("data_evento", { ascending: true })
      .order("hora_evento", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Erro ao carregar eventos publicos." }, { status: 500 });
    }

    const eventos = ((data || []) as EventoRegistro[])
      .filter((evento) => eventoPublicadoOuAtivo(evento))
      .map((evento) => ({
        id: Number(evento.id),
        nome: String(evento.nome || ""),
        slug: String(evento.slug || ""),
        data_evento: (evento.data_evento as string | null) || null,
        hora_evento: (evento.hora_evento as string | null) || null,
        local_evento: (evento.local_evento as string | null) || null,
        tipo_lista: (evento.tipo_lista as string | null) || null,
        banner_url: (evento.banner_url as string | null) || null,
        banner_posicao: (evento.banner_posicao as string | null) || null,
      }))
      .filter((evento) => evento.id > 0 && evento.nome && evento.slug);

    return NextResponse.json({ eventos });
  } catch (error) {
    console.log("ERRO AO LISTAR EVENTOS PUBLICOS:", error);
    return NextResponse.json({ error: "Erro interno ao carregar eventos publicos." }, { status: 500 });
  }
}
