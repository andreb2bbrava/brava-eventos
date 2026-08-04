import { NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canEditEventRole, isAdminRole, isRoleUsuario, type RoleUsuario } from "@/lib/roles";
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
  listas_evento?: { nome: string | null } | Array<{ nome: string | null }> | null;
  eventos?: { nome: string | null } | Array<{ nome: string | null }> | null;
};

const CAMINHO_NOMES_MASCULINOS = join(process.cwd(), "lib", "inteligencia", "dados", "nomesMasculinos.json");
const CAMINHO_NOMES_FEMININOS = join(process.cwd(), "lib", "inteligencia", "dados", "nomesFemininos.json");

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

function obterNomeRelacionamento(relacao?: { nome: string | null } | Array<{ nome: string | null }> | null) {
  if (!relacao) {
    return "-";
  }

  if (Array.isArray(relacao)) {
    return relacao[0]?.nome || "-";
  }

  return relacao.nome || "-";
}

async function autenticarUsuario(request: Request): Promise<{ ok: true; usuario: UsuarioAutenticado } | { ok: false; response: NextResponse }> {
  const token = obterToken(request);

  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "Sessao invalida." }, { status: 401 }) };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authData?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Sessao invalida." }, { status: 401 }) };
  }

  const { data: usuarioData, error: usuarioError } = await supabaseAdmin
    .from("usuarios")
    .select("id, role")
    .eq("id", authData.user.id)
    .single();

  const role = usuarioData?.role as RoleUsuario | undefined;

  if (usuarioError || !usuarioData?.id || !role || !isRoleUsuario(role)) {
    return { ok: false, response: NextResponse.json({ error: "Usuario sem permissao." }, { status: 403 }) };
  }

  if (!canEditEventRole(role)) {
    return { ok: false, response: NextResponse.json({ error: "Usuario sem permissao para revisar inteligencia." }, { status: 403 }) };
  }

  return {
    ok: true,
    usuario: {
      id: usuarioData.id,
      role,
    },
  };
}

async function listarEventosPermitidos(usuario: UsuarioAutenticado) {
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

  return data.map((item) => Number(item.evento_id)).filter((id) => Number.isFinite(id));
}

function adicionarNomeNaBase(caminhoArquivo: string, nome: string) {
  const primeiroNome = extrairPrimeiroNome(nome);

  if (!primeiroNome) {
    return;
  }

  const listaAtual = JSON.parse(readFileSync(caminhoArquivo, "utf8")) as string[];
  const nomesNormalizados = new Set(listaAtual.map((item) => normalizarNome(item)));

  if (!nomesNormalizados.has(primeiroNome)) {
    listaAtual.push(primeiroNome);
  }

  const nomesFinais = Array.from(new Set(listaAtual.map((item) => normalizarNome(item)).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );

  writeFileSync(caminhoArquivo, `${JSON.stringify(nomesFinais, null, 2)}\n`, "utf8");
}

export async function GET(request: Request) {
  try {
    const authResult = await autenticarUsuario(request);
    if (!authResult.ok) {
      return authResult.response;
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") || "20")));
    const search = (searchParams.get("search") || "").trim();

    const eventosPermitidos = await listarEventosPermitidos(authResult.usuario);

    if (eventosPermitidos && eventosPermitidos.length === 0) {
      return NextResponse.json({ items: [], total: 0, page, pageSize, totalPages: 0 });
    }

    let query = supabaseAdmin
      .from("participantes")
      .select("id, nome, whatsapp, evento_id, created_at, listas_evento(nome), eventos(nome)", { count: "exact" })
      .eq("sexo_estimado", "Indeterminado")
      .order("id", { ascending: false });

    if (eventosPermitidos) {
      query = query.in("evento_id", eventosPermitidos);
    }

    if (search) {
      query = query.ilike("nome", `%${search}%`);
    }

    const inicio = (page - 1) * pageSize;
    const fim = inicio + pageSize - 1;

    const { data, error, count } = await query.range(inicio, fim);

    if (error) {
      return NextResponse.json({ error: "Nao foi possivel carregar participantes indeterminados." }, { status: 400 });
    }

    const items = ((data || []) as ParticipanteRevisaoRow[]).map((item) => ({
      id: item.id,
      nome: item.nome || "-",
      whatsapp: item.whatsapp || "-",
      lista: obterNomeRelacionamento(item.listas_evento),
      evento: obterNomeRelacionamento(item.eventos),
      dataCadastro: item.created_at,
    }));

    const total = Number(count || 0);
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

    return NextResponse.json({ items, total, page, pageSize, totalPages });
  } catch {
    return NextResponse.json({ error: "Erro interno ao consultar revisao de inteligencia." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await autenticarUsuario(request);
    if (!authResult.ok) {
      return authResult.response;
    }

    const body = (await request.json()) as {
      participanteId?: number;
      sexo?: "Masculino" | "Feminino";
    };

    const participanteId = Number(body?.participanteId);
    const sexo = body?.sexo;

    if (!Number.isFinite(participanteId) || (sexo !== "Masculino" && sexo !== "Feminino")) {
      return NextResponse.json({ error: "Dados invalidos para correcao manual." }, { status: 400 });
    }

    const { data: participante, error: participanteError } = await supabaseAdmin
      .from("participantes")
      .select("id, nome, evento_id")
      .eq("id", participanteId)
      .maybeSingle();

    if (participanteError || !participante) {
      return NextResponse.json({ error: "Participante nao encontrado." }, { status: 404 });
    }

    if (!isAdminRole(authResult.usuario.role)) {
      const { data: vinculo } = await supabaseAdmin
        .from("evento_produtores")
        .select("id")
        .eq("usuario_id", authResult.usuario.id)
        .eq("evento_id", participante.evento_id)
        .maybeSingle();

      if (!vinculo) {
        return NextResponse.json({ error: "Sem permissao para alterar este participante." }, { status: 403 });
      }
    }

    const agora = new Date().toISOString();

    const { data: atualizado, error: updateError } = await supabaseAdmin
      .from("participantes")
      .update({
        sexo_estimado: sexo,
        confianca_sexo: 100,
        metodo_classificacao: "Correção Manual",
        motor_inteligencia: "Administrador",
        versao_motor: "1.0",
        classificado_em: agora,
      })
      .eq("id", participanteId)
      .select("id, nome, sexo_estimado")
      .single();

    if (updateError || !atualizado) {
      return NextResponse.json({ error: "Nao foi possivel aplicar correcao manual." }, { status: 400 });
    }

    const caminhoBase = sexo === "Masculino" ? CAMINHO_NOMES_MASCULINOS : CAMINHO_NOMES_FEMININOS;
    adicionarNomeNaBase(caminhoBase, participante.nome || "");

    return NextResponse.json({ success: true, participante: atualizado });
  } catch {
    return NextResponse.json({ error: "Erro interno ao atualizar correcao manual." }, { status: 500 });
  }
}
