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

type EventoComBanner = {
  id: number;
  nome: string;
  data_evento: string;
  banner_url: string;
};

function obterToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const [, token] = authHeader.split(" ");
  return token?.trim() || "";
}

async function autenticarAdmin(
  request: Request
): Promise<AuthOk | AuthErro> {
  const token = obterToken(request);

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sessao invalida." },
        { status: 401 }
      ),
    };
  }

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !authData?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sessao invalida." },
        { status: 401 }
      ),
    };
  }

  const { data: usuarioData, error: usuarioError } =
    await supabaseAdmin
      .from("usuarios")
      .select("id, role")
      .eq("id", authData.user.id)
      .single();

  const role = resolverRoleUsuario(usuarioData?.role || null);

  if (
    usuarioError ||
    !usuarioData?.id ||
    !role ||
    !isAdminRole(role)
  ) {
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

function obterDataLimite() {
  const limite = new Date();
  limite.setDate(limite.getDate() - 30);
  return limite.toISOString().slice(0, 10);
}

async function buscarEventosElegiveis() {
  const dataLimite = obterDataLimite();

  const { data, error } = await supabaseAdmin
    .from("eventos")
    .select("id,nome,data_evento,banner_url")
    .not("banner_url", "is", null)
    .neq("banner_url", "")
    .lt("data_evento", dataLimite)
    .order("data_evento", { ascending: true });

  return {
    dataLimite,
    eventos: (data || []) as EventoComBanner[],
    error,
  };
}

function extrairCaminhoBanner(bannerUrl: string) {
  try {
    const url = new URL(bannerUrl);
    const marcador = "/storage/v1/object/public/banners/";
    const indice = url.pathname.indexOf(marcador);

    if (indice === -1) {
      return null;
    }

    const caminhoCodificado = url.pathname.slice(indice + marcador.length);

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
    const auth = await autenticarAdmin(request);

    if (!auth.ok) {
      return auth.response;
    }

    const { dataLimite, eventos, error } =
      await buscarEventosElegiveis();

    if (error) {
      console.error("ERRO AO BUSCAR BANNERS PARA LIMPEZA:", error);

      return NextResponse.json(
        { error: "Nao foi possivel consultar os banners." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      modo: "preview",
      regra: "Eventos com mais de 30 dias e banner_url preenchido.",
      data_limite: dataLimite,
      quantidade: eventos.length,
      eventos,
    });
  } catch (error) {
    console.error(
      "ERRO INTERNO NA PREVIA DE LIMPEZA DE BANNERS:",
      error
    );

    return NextResponse.json(
      { error: "Erro interno ao consultar banners para limpeza." },
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

    const { dataLimite, eventos, error } =
      await buscarEventosElegiveis();

    if (error) {
      console.error("ERRO AO BUSCAR BANNERS PARA LIMPEZA:", error);

      return NextResponse.json(
        { error: "Nao foi possivel consultar os banners." },
        { status: 400 }
      );
    }

    if (eventos.length === 0) {
      return NextResponse.json({
        success: true,
        modo: "execucao",
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
          motivo: "URL do banner nao pertence ao bucket publico banners.",
        });
        continue;
      }

      const { error: storageError } = await supabaseAdmin.storage
        .from("banners")
        .remove([caminho]);

      if (storageError) {
        console.error(
          `ERRO AO REMOVER BANNER DO EVENTO ${evento.id}:`,
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
          `BANNER REMOVIDO, MAS FALHOU AO LIMPAR URL DO EVENTO ${evento.id}:`,
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
      modo: "execucao",
      data_limite: dataLimite,
      encontrados: eventos.length,
      removidos,
      falhas: eventos.length - removidos,
      resultados,
    });
  } catch (error) {
    console.error(
      "ERRO INTERNO NA LIMPEZA DE BANNERS:",
      error
    );

    return NextResponse.json(
      { error: "Erro interno ao executar limpeza de banners." },
      { status: 500 }
    );
  }
}
