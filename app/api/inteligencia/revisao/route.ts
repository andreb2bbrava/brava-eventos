import { NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  canEditEventRole,
  isAdminRole,
  resolverRoleUsuario,
  type RoleUsuario,
} from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type UsuarioAutenticado = {
  id: string;
  role: RoleUsuario;
};

type ParticipanteRevisaoRow = {
  id: number;
  nome: string | null;
  whatsapp: string | null;
  evento_id: number | null;
  created_at: string | null;
  listas_evento?:
    | { nome: string | null }
    | Array<{ nome: string | null }>
    | null;
  eventos?:
    | { nome: string | null }
    | Array<{ nome: string | null }>
    | null;
};

type ParticipanteCorrecaoRow = {
  id: number;
  nome: string | null;
  evento_id: number | null;
};

type Sexo = "Masculino" | "Feminino";

const LIMITE_CORRECAO_MASSA = 100;

const CAMINHO_NOMES_MASCULINOS = join(
  process.cwd(),
  "lib",
  "inteligencia",
  "dados",
  "nomesMasculinos.json"
);

const CAMINHO_NOMES_FEMININOS = join(
  process.cwd(),
  "lib",
  "inteligencia",
  "dados",
  "nomesFemininos.json"
);

function obterToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const [, token] = authHeader.split(" ");

  return token?.trim() || "";
}

function normalizarNome(valor: string) {
  return String(valor || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function extrairPrimeiroNome(nomeCompleto: string | null) {
  const nomeLimpo = String(nomeCompleto || "").trim();

  if (!nomeLimpo) {
    return "";
  }

  const primeiroNome = nomeLimpo.split(/\s+/)[0] || "";

  return normalizarNome(primeiroNome);
}

function obterNomeRelacionamento(
  relacao?:
    | { nome: string | null }
    | Array<{ nome: string | null }>
    | null
) {
  if (!relacao) {
    return "-";
  }

  if (Array.isArray(relacao)) {
    return relacao[0]?.nome || "-";
  }

  return relacao.nome || "-";
}

function normalizarIdsParticipantes(
  participanteId?: number,
  participanteIds?: number[]
) {
  const idsRecebidos: number[] = [];

  if (Number.isFinite(Number(participanteId))) {
    idsRecebidos.push(Number(participanteId));
  }

  if (Array.isArray(participanteIds)) {
    for (const id of participanteIds) {
      const numero = Number(id);

      if (Number.isFinite(numero)) {
        idsRecebidos.push(numero);
      }
    }
  }

  return Array.from(
    new Set(
      idsRecebidos
        .filter((id) => Number.isInteger(id))
        .filter((id) => id > 0)
    )
  );
}

async function autenticarUsuario(
  request: Request
): Promise<
  | {
      ok: true;
      usuario: UsuarioAutenticado;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  const token = obterToken(request);

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Sessao invalida.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.getUser(token);

  if (authError || !authData?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Sessao invalida.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  const { data: usuarioData, error: usuarioError } =
    await supabaseAdmin
      .from("usuarios")
      .select("id, role")
      .eq("id", authData.user.id)
      .single();

  const role = resolverRoleUsuario(usuarioData?.role);

  if (usuarioError || !usuarioData?.id || !role) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Usuario sem permissao.",
        },
        {
          status: 403,
        }
      ),
    };
  }

  if (!canEditEventRole(role)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Usuario sem permissao para revisar inteligencia.",
        },
        {
          status: 403,
        }
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

async function listarEventosPermitidos(
  usuario: UsuarioAutenticado
) {
  if (isAdminRole(usuario.role)) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("evento_produtores")
    .select("evento_id")
    .eq("usuario_id", usuario.id);

  if (error || !data) {
    return [] as number[];
  }

  return data
    .map((item) => Number(item.evento_id))
    .filter((id) => Number.isFinite(id));
}

function adicionarNomeNaBase(
  caminhoArquivo: string,
  nome: string
) {
  const primeiroNome = extrairPrimeiroNome(nome);

  if (!primeiroNome) {
    return;
  }

  const listaAtual = JSON.parse(
    readFileSync(caminhoArquivo, "utf8")
  ) as string[];

  const nomesNormalizados = new Set(
    listaAtual.map((item) => normalizarNome(item))
  );

  if (!nomesNormalizados.has(primeiroNome)) {
    listaAtual.push(primeiroNome);
  }

  const nomesFinais = Array.from(
    new Set(
      listaAtual
        .map((item) => normalizarNome(item))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  writeFileSync(
    caminhoArquivo,
    `${JSON.stringify(nomesFinais, null, 2)}\n`,
    "utf8"
  );
}

function tentarAdicionarNomeNaBase(
  sexo: Sexo,
  nome: string | null
) {
  try {
    const caminhoBase =
      sexo === "Masculino"
        ? CAMINHO_NOMES_MASCULINOS
        : CAMINHO_NOMES_FEMININOS;

    adicionarNomeNaBase(
      caminhoBase,
      nome || ""
    );
  } catch (erroArquivo) {
    console.warn(
      "Nao foi possivel atualizar a base local de nomes. A correcao manual foi mantida no banco.",
      erroArquivo
    );
  }
}

export async function GET(request: Request) {
  try {
    const authResult =
      await autenticarUsuario(request);

    if (!authResult.ok) {
      return authResult.response;
    }

    const { searchParams } =
      new URL(request.url);

    const page = Math.max(
      1,
      Number(
        searchParams.get("page") || "1"
      )
    );

    const pageSize = Math.min(
      100,
      Math.max(
        10,
        Number(
          searchParams.get("pageSize") ||
            "20"
        )
      )
    );

    const search = (
      searchParams.get("search") || ""
    ).trim();

    const eventosPermitidos =
      await listarEventosPermitidos(
        authResult.usuario
      );

    if (
      eventosPermitidos &&
      eventosPermitidos.length === 0
    ) {
      return NextResponse.json({
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      });
    }

    let query = supabaseAdmin
      .from("participantes")
      .select(
        "id, nome, whatsapp, evento_id, created_at, listas_evento(nome), eventos(nome)",
        {
          count: "exact",
        }
      )
      .eq(
        "sexo_estimado",
        "Indeterminado"
      )
      .order("id", {
        ascending: false,
      });

    if (eventosPermitidos) {
      query = query.in(
        "evento_id",
        eventosPermitidos
      );
    }

    if (search) {
      query = query.ilike(
        "nome",
        `%${search}%`
      );
    }

    const inicio =
      (page - 1) * pageSize;

    const fim =
      inicio + pageSize - 1;

    const {
      data,
      error,
      count,
    } = await query.range(
      inicio,
      fim
    );

    if (error) {
      console.error(
        "Erro ao carregar participantes indeterminados:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Nao foi possivel carregar participantes indeterminados.",
        },
        {
          status: 400,
        }
      );
    }

    const items = (
      (data ||
        []) as ParticipanteRevisaoRow[]
    ).map((item) => ({
      id: item.id,
      nome: item.nome || "-",
      whatsapp:
        item.whatsapp || "-",
      lista:
        obterNomeRelacionamento(
          item.listas_evento
        ),
      evento:
        obterNomeRelacionamento(
          item.eventos
        ),
      dataCadastro:
        item.created_at,
    }));

    const total =
      Number(count || 0);

    const totalPages =
      total > 0
        ? Math.ceil(
            total / pageSize
          )
        : 0;

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error(
      "Erro ao consultar revisao de inteligencia:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Erro interno ao consultar revisao de inteligencia.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(
  request: Request
) {
  try {
    const authResult =
      await autenticarUsuario(request);

    if (!authResult.ok) {
      return authResult.response;
    }

    const body =
      (await request.json()) as {
        participanteId?: number;
        participanteIds?: number[];
        sexo?: Sexo;
      };

    const sexo = body?.sexo;

    if (
      sexo !== "Masculino" &&
      sexo !== "Feminino"
    ) {
      return NextResponse.json(
        {
          error:
            "Sexo invalido para correcao manual.",
        },
        {
          status: 400,
        }
      );
    }

    const participanteIds =
      normalizarIdsParticipantes(
        body?.participanteId,
        body?.participanteIds
      );

    if (
      participanteIds.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Nenhum participante valido foi informado.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      participanteIds.length >
      LIMITE_CORRECAO_MASSA
    ) {
      return NextResponse.json(
        {
          error: `O limite e de ${LIMITE_CORRECAO_MASSA} participantes por operacao.`,
        },
        {
          status: 400,
        }
      );
    }

    const {
      data: participantes,
      error: participantesError,
    } = await supabaseAdmin
      .from("participantes")
      .select(
        "id, nome, evento_id"
      )
      .in("id", participanteIds);

    if (
      participantesError
    ) {
      console.error(
        "Erro ao consultar participantes para correcao:",
        participantesError
      );

      return NextResponse.json(
        {
          error:
            "Nao foi possivel consultar os participantes selecionados.",
        },
        {
          status: 400,
        }
      );
    }

    const participantesEncontrados =
      (participantes ||
        []) as ParticipanteCorrecaoRow[];

    if (
      participantesEncontrados.length !==
      participanteIds.length
    ) {
      return NextResponse.json(
        {
          error:
            "Um ou mais participantes selecionados nao foram encontrados.",
        },
        {
          status: 404,
        }
      );
    }

    if (
      !isAdminRole(
        authResult.usuario.role
      )
    ) {
      const eventosPermitidos =
        await listarEventosPermitidos(
          authResult.usuario
        );

      if (
        !eventosPermitidos ||
        eventosPermitidos.length === 0
      ) {
        return NextResponse.json(
          {
            error:
              "Sem permissao para alterar os participantes selecionados.",
          },
          {
            status: 403,
          }
        );
      }

      const eventosPermitidosSet =
        new Set(
          eventosPermitidos.map(
            (id) => Number(id)
          )
        );

      const possuiParticipanteSemPermissao =
        participantesEncontrados.some(
          (participante) => {
            const eventoId =
              Number(
                participante.evento_id
              );

            return (
              !Number.isFinite(
                eventoId
              ) ||
              !eventosPermitidosSet.has(
                eventoId
              )
            );
          }
        );

      if (
        possuiParticipanteSemPermissao
      ) {
        return NextResponse.json(
          {
            error:
              "Voce nao possui permissao para alterar um ou mais participantes selecionados.",
          },
          {
            status: 403,
          }
        );
      }
    }

    const agora =
      new Date().toISOString();

    const {
      data: atualizados,
      error: updateError,
    } = await supabaseAdmin
      .from("participantes")
      .update({
        sexo_estimado: sexo,
        confianca_sexo: 100,
        metodo_classificacao:
          "Correção Manual",
        motor_inteligencia:
          "Administrador",
        versao_motor: "1.0",
        classificado_em:
          agora,
      })
      .in(
        "id",
        participanteIds
      )
      .select(
        "id, nome, sexo_estimado"
      );

    if (
      updateError ||
      !atualizados
    ) {
      console.error(
        "Erro ao atualizar participantes:",
        updateError
      );

      return NextResponse.json(
        {
          error:
            participanteIds.length ===
            1
              ? "Nao foi possivel aplicar correcao manual."
              : "Nao foi possivel aplicar a correcao em massa.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      atualizados.length !==
      participanteIds.length
    ) {
      console.error(
        "Quantidade de participantes atualizados diferente da quantidade solicitada.",
        {
          solicitados:
            participanteIds.length,
          atualizados:
            atualizados.length,
        }
      );

      return NextResponse.json(
        {
          error:
            "Nem todos os participantes selecionados puderam ser atualizados.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * A classificacao principal ja foi salva no Supabase.
     *
     * A atualizacao dos JSON locais permanece apenas como
     * recurso complementar para o mecanismo legado de nomes.
     *
     * Em ambientes serverless, como Vercel, a escrita desses
     * arquivos pode falhar. Essa falha nao pode desfazer nem
     * transformar em erro uma correcao ja gravada no banco.
     */
    for (
      const participante of participantesEncontrados
    ) {
      tentarAdicionarNomeNaBase(
        sexo,
        participante.nome
      );
    }

    /*
     * Mantemos compatibilidade total com a tela antiga.
     * Quando apenas um participante for enviado, a resposta
     * continua trazendo "participante".
     */
    if (
      participanteIds.length === 1
    ) {
      return NextResponse.json({
        success: true,
        participante:
          atualizados[0],
        atualizados: 1,
      });
    }

    return NextResponse.json({
      success: true,
      atualizados:
        atualizados.length,
      participantes:
        atualizados,
    });
  } catch (error) {
    console.error(
      "Erro interno ao atualizar correcao manual:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Erro interno ao atualizar correcao manual.",
      },
      {
        status: 500,
      }
    );
  }
}