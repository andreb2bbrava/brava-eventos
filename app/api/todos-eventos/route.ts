import { NextResponse } from "next/server";
import { isAdminRole, resolverRoleUsuario } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type EventoBase = {
  id: number;
  nome: string;
  slug: string | null;
  data_evento: string | null;
  hora_evento: string | null;
  local_evento: string | null;
  banner_url: string | null;
  criador_id: string | null;
};

type VinculoProdutor = {
  evento_id: number | null;
  usuario_id: string | null;
};

type UsuarioResumo = {
  id: string;
  nome: string | null;
  email: string | null;
};

function obterToken(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const [, token] = authHeader.split(" ");
  return token?.trim() || "";
}

function formatarNomeUsuario(usuario?: UsuarioResumo | null) {
  if (!usuario) {
    return "Sem produtor";
  }

  if (usuario.nome && usuario.nome.trim()) {
    return usuario.nome.trim();
  }

  if (usuario.email && usuario.email.trim()) {
    return usuario.email.trim();
  }

  return "Sem produtor";
}

function statusEvento(data: string | null, hora: string | null) {
  if (!data) {
    return "Sem data";
  }

  const horario = hora && hora.trim() ? hora : "00:00";
  const dataEvento = new Date(`${data}T${horario}`);

  if (Number.isNaN(dataEvento.getTime())) {
    return "Sem data";
  }

  const hoje = new Date();
  const inicioDiaAtual = new Date(hoje);
  inicioDiaAtual.setHours(0, 0, 0, 0);

  const fimDiaAtual = new Date(hoje);
  fimDiaAtual.setHours(23, 59, 59, 999);

  if (dataEvento > fimDiaAtual) {
    return "Agendado";
  }

  if (dataEvento < inicioDiaAtual) {
    return "Encerrado";
  }

  return "Em andamento";
}

export async function GET(request: Request) {
  try {
    const token = obterToken(request);

    if (!token) {
      return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData?.user?.id) {
      return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
    }

    const { data: usuarioData, error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .select("id, role")
      .eq("id", authData.user.id)
      .single();

    const role = resolverRoleUsuario(usuarioData?.role);

    if (usuarioError || !usuarioData?.id || !isAdminRole(role)) {
      return NextResponse.json({ error: "Usuario sem permissao." }, { status: 403 });
    }

    const { data: eventosData, error: eventosError } = await supabaseAdmin
      .from("eventos")
      .select("*")
      .order("data_evento", { ascending: true })
      .order("hora_evento", { ascending: true });

    if (eventosError) {
      return NextResponse.json({ error: "Nao foi possivel carregar eventos." }, { status: 400 });
    }

    const eventosLista = (eventosData || []) as EventoBase[];

    if (eventosLista.length === 0) {
      return NextResponse.json({ totalBanco: 0, eventos: [] });
    }

    const eventosIds = eventosLista.map((evento) => evento.id);

    const [{ data: vinculosProdutorData }, { data: listasData }, { data: participantesData }] = await Promise.all([
      supabaseAdmin.from("evento_produtores").select("evento_id, usuario_id").in("evento_id", eventosIds),
      supabaseAdmin.from("listas_evento").select("evento_id").in("evento_id", eventosIds),
      supabaseAdmin.from("participantes").select("evento_id").in("evento_id", eventosIds),
    ]);

    const vinculosProdutor = (vinculosProdutorData || []) as VinculoProdutor[];

    const idsProdutoresVinculados = Array.from(
      new Set(vinculosProdutor.map((item) => item.usuario_id).filter((id): id is string => Boolean(id)))
    );

    const idsCriadores = Array.from(
      new Set(eventosLista.map((evento) => evento.criador_id).filter((id): id is string => Boolean(id)))
    );

    const idsUsuariosResponsaveis = Array.from(new Set([...idsProdutoresVinculados, ...idsCriadores]));

    let usuariosResponsaveis: UsuarioResumo[] = [];

    if (idsUsuariosResponsaveis.length > 0) {
      const { data: usuariosData } = await supabaseAdmin
        .from("usuarios")
        .select("id, nome, email")
        .in("id", idsUsuariosResponsaveis);

      usuariosResponsaveis = (usuariosData || []) as UsuarioResumo[];
    }

    const usuarioPorId = new Map<string, UsuarioResumo>();
    usuariosResponsaveis.forEach((usuarioItem) => {
      usuarioPorId.set(usuarioItem.id, usuarioItem);
    });

    const produtoresPorEvento = new Map<number, string[]>();
    vinculosProdutor.forEach((vinculo) => {
      if (!vinculo.evento_id || !vinculo.usuario_id) {
        return;
      }

      const listaAtual = produtoresPorEvento.get(vinculo.evento_id) || [];
      if (!listaAtual.includes(vinculo.usuario_id)) {
        listaAtual.push(vinculo.usuario_id);
        produtoresPorEvento.set(vinculo.evento_id, listaAtual);
      }
    });

    const contagemListasPorEvento = new Map<number, number>();
    (listasData || []).forEach((listaItem: { evento_id: number | null }) => {
      if (!listaItem.evento_id) {
        return;
      }

      contagemListasPorEvento.set(
        listaItem.evento_id,
        (contagemListasPorEvento.get(listaItem.evento_id) || 0) + 1
      );
    });

    const contagemParticipantesPorEvento = new Map<number, number>();
    (participantesData || []).forEach((participanteItem: { evento_id: number | null }) => {
      if (!participanteItem.evento_id) {
        return;
      }

      contagemParticipantesPorEvento.set(
        participanteItem.evento_id,
        (contagemParticipantesPorEvento.get(participanteItem.evento_id) || 0) + 1
      );
    });

    const eventos = eventosLista.map((evento) => {
      const produtoresEvento = produtoresPorEvento.get(evento.id) || [];
      const primeiroProdutorId = produtoresEvento[0] || evento.criador_id || null;
      const produtor = primeiroProdutorId ? formatarNomeUsuario(usuarioPorId.get(primeiroProdutorId) || null) : "Sem produtor";

      return {
        id: evento.id,
        nome: evento.nome,
        slug: evento.slug,
        data_evento: evento.data_evento,
        hora_evento: evento.hora_evento,
        local_evento: evento.local_evento,
        banner_url: evento.banner_url,
        produtor,
        quantidadeListas: contagemListasPorEvento.get(evento.id) || 0,
        quantidadeParticipantes: contagemParticipantesPorEvento.get(evento.id) || 0,
        status: statusEvento(evento.data_evento, evento.hora_evento),
      };
    });

    return NextResponse.json({
      totalBanco: eventosLista.length,
      eventos,
    });
  } catch {
    return NextResponse.json({ error: "Erro interno ao carregar todos os eventos." }, { status: 500 });
  }
}
