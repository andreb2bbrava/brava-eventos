import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type EventoComBanner = {
  id: number;
  nome: string;
  data_evento: string;
  banner_url: string;
};

function obterDataLimite() {
  const agora = new Date();

  const dataBrasil = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);

  const [ano, mes, dia] = dataBrasil.split("-").map(Number);

  const limite = new Date(Date.UTC(ano, mes - 1, dia));
  limite.setUTCDate(limite.getUTCDate() - 30);

  return limite.toISOString().slice(0, 10);
}

function extrairCaminhoBanner(bannerUrl: string) {
  try {
    const url = new URL(bannerUrl);
    const marcador = "/storage/v1/object/public/banners/";
    const indice = url.pathname.indexOf(marcador);

    if (indice === -1) {
      return null;
    }

    const caminhoCodificado = url.pathname.slice(
      indice + marcador.length
    );

    if (!caminhoCodificado) {
      return null;
    }

    return decodeURIComponent(caminhoCodificado);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authorization = request.headers.get("authorization");

    if (
      !cronSecret ||
      authorization !== `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        { error: "Nao autorizado." },
        { status: 401 }
      );
    }

    const dataLimite = obterDataLimite();

    const { data, error } = await supabaseAdmin
      .from("eventos")
      .select("id,nome,data_evento,banner_url")
      .not("banner_url", "is", null)
      .neq("banner_url", "")
      .lt("data_evento", dataLimite)
      .order("data_evento", { ascending: true });

    if (error) {
      console.error(
        "CRON - ERRO AO BUSCAR BANNERS:",
        error
      );

      return NextResponse.json(
        { error: "Nao foi possivel consultar os banners." },
        { status: 500 }
      );
    }

    const eventos = (data || []) as EventoComBanner[];

    if (eventos.length === 0) {
      return NextResponse.json({
        success: true,
        modo: "cron",
        data_limite: dataLimite,
        encontrados: 0,
        removidos: 0,
        falhas: 0,
        resultados: [],
      });
    }

    const resultados = [];

    for (const evento of eventos) {
      const caminho = extrairCaminhoBanner(evento.banner_url);

      if (!caminho) {
        resultados.push({
          evento_id: evento.id,
          nome: evento.nome,
          removido: false,
          motivo:
            "URL do banner nao pertence ao bucket publico banners.",
        });

        continue;
      }

      const { error: storageError } =
        await supabaseAdmin.storage
          .from("banners")
          .remove([caminho]);

      if (storageError) {
        console.error(
          `CRON - ERRO AO REMOVER BANNER DO EVENTO ${evento.id}:`,
          storageError
        );

        resultados.push({
          evento_id: evento.id,
          nome: evento.nome,
          removido: false,
          motivo: "Falha ao remover arquivo do Storage.",
        });

        continue;
      }

      const { data: atualizado, error: updateError } =
        await supabaseAdmin
          .from("eventos")
          .update({ banner_url: null })
          .eq("id", evento.id)
          .eq("banner_url", evento.banner_url)
          .select("id")
          .maybeSingle();

      if (updateError || !atualizado?.id) {
        console.error(
          `CRON - BANNER REMOVIDO, MAS URL NAO FOI LIMPA NO EVENTO ${evento.id}:`,
          updateError
        );

        resultados.push({
          evento_id: evento.id,
          nome: evento.nome,
          removido: false,
          arquivo_storage_removido: true,
          motivo:
            "Arquivo removido do Storage, mas banner_url nao foi atualizado. Requer revisao manual.",
        });

        continue;
      }

      resultados.push({
        evento_id: evento.id,
        nome: evento.nome,
        removido: true,
        arquivo: caminho,
      });
    }

    const removidos = resultados.filter(
      (resultado) => resultado.removido
    ).length;

    return NextResponse.json({
      success: true,
      modo: "cron",
      data_limite: dataLimite,
      encontrados: eventos.length,
      removidos,
      falhas: eventos.length - removidos,
      resultados,
    });
  } catch (error) {
    console.error(
      "CRON - ERRO INTERNO NA LIMPEZA DE BANNERS:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Erro interno ao executar limpeza automatica de banners.",
      },
      { status: 500 }
    );
  }
}
