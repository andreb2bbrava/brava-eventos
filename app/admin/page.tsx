"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/app/components/AdminShell";
import { gerarSlugUnicoEvento } from "@/lib/slug";
import { primeiroNome, resolverNomeExibicaoUsuario } from "@/lib/usuarios";

type RoleUsuario = "super_admin" | "produtor" | "staff";

type Evento = {
  id: number;
  nome: string;
  slug: string | null;
  data_evento: string | null;
  hora_evento: string | null;
  local_evento: string | null;
  banner_url: string | null;
  banner_posicao: string | null;
  tipo_lista: string | null;
};

type ResumoOperacao = {
  eventosFuturos: number;
  usuarios: number | null;
  listas: number;
  participantes: number;
  checkins: number;
};

function roleAmigavel(role: string | null) {
  if (role === "super_admin") {
    return "Administrador Geral";
  }

  if (role === "produtor") {
    return "Produtor";
  }

  if (role === "staff") {
    return "Staff";
  }

  return "Usuario";
}

function obterSaudacaoAgora() {
  const hora = new Date().getHours();

  if (hora < 12) {
    return "Bom dia";
  }

  if (hora < 18) {
    return "Boa tarde";
  }

  return "Boa noite";
}

function dataInicioEvento(evento: Evento) {
  if (!evento.data_evento) {
    return null;
  }

  const horario = evento.hora_evento && evento.hora_evento.trim() ? evento.hora_evento : "00:00";
  const data = new Date(`${evento.data_evento}T${horario}`);

  if (Number.isNaN(data.getTime())) {
    return null;
  }

  return data;
}

function dataDiaEvento(evento: Evento) {
  if (!evento.data_evento) {
    return null;
  }

  const data = new Date(`${evento.data_evento}T00:00:00`);

  if (Number.isNaN(data.getTime())) {
    return null;
  }

  data.setHours(0, 0, 0, 0);
  return data;
}

function formatarData(data: string | null) {
  if (!data) {
    return "Data a definir";
  }

  const dataObj = new Date(`${data}T00:00:00`);

  if (Number.isNaN(dataObj.getTime())) {
    return data;
  }

  return dataObj.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatarDataCurta(data: string | null) {
  if (!data) {
    return "Data a definir";
  }

  const dataObj = new Date(`${data}T00:00:00`);

  if (Number.isNaN(dataObj.getTime())) {
    return data;
  }

  return dataObj.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function diasRestantes(evento: Evento) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const diaEvento = dataDiaEvento(evento);

  if (!diaEvento) {
    return "Data a definir";
  }

  const diffMs = diaEvento.getTime() - hoje.getTime();
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (dias <= 0) {
    return "Hoje";
  }

  if (dias === 1) {
    return "Falta 1 dia";
  }

  return `Faltam ${dias} dias`;
}

function capitalizarTexto(texto: string) {
  if (!texto) {
    return texto;
  }

  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function normalizarSlug(slug: string | null | undefined) {
  return (slug || "").trim().toLowerCase();
}

function slugValido(slug: string | null | undefined) {
  const slugNormalizado = normalizarSlug(slug);
  return Boolean(slugNormalizado && slugNormalizado !== "undefined" && slugNormalizado !== "null");
}

function eventoEmAndamento(evento: Evento) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const diaEvento = dataDiaEvento(evento);

  if (!diaEvento) {
    return false;
  }

  return diaEvento.getTime() === hoje.getTime();
}

export default function AdminPage() {
  const router = useRouter();
  const [eventosAtivos, setEventosAtivos] = useState<Evento[]>([]);
  const [eventosHistorico, setEventosHistorico] = useState<Evento[]>([]);
  const [roleUsuario, setRoleUsuario] = useState<RoleUsuario | null>(null);
  const [nomePrimeiro, setNomePrimeiro] = useState("Usuario");
  const [nomeCompleto, setNomeCompleto] = useState("Usuario Brava");
  const [excluindoEventoId, setExcluindoEventoId] = useState<number | null>(null);
  const [corrigindoSlugIds, setCorrigindoSlugIds] = useState<number[]>([]);
  const [buscaEventos, setBuscaEventos] = useState("");
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState<ResumoOperacao>({
    eventosFuturos: 0,
    usuarios: null,
    listas: 0,
    participantes: 0,
    checkins: 0,
  });

  const dataAtual = useMemo(
    () =>
      new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    []
  );

  const eventoPrincipal = useMemo(() => {
    const emAndamento = eventosAtivos.find((evento) => eventoEmAndamento(evento));

    if (emAndamento) {
      return {
        evento: emAndamento,
        tag: "Evento em andamento",
      };
    }

    const proximo = eventosAtivos[0];

    if (!proximo) {
      return null;
    }

    return {
      evento: proximo,
      tag: "Proximo evento",
    };
  }, [eventosAtivos]);

  const proximosEventos = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return eventosAtivos
      .filter((evento) => {
        const diaEvento = dataDiaEvento(evento);
        return diaEvento ? diaEvento.getTime() > hoje.getTime() : false;
      })
      .slice(0, 3);
  }, [eventosAtivos]);

  const temMaisQueTresEventosFuturos = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const totalFuturos = eventosAtivos.filter((evento) => {
      const diaEvento = dataDiaEvento(evento);
      return diaEvento ? diaEvento.getTime() > hoje.getTime() : false;
    }).length;

    return totalFuturos > 3;
  }, [eventosAtivos]);

  const podeCriarEvento = roleUsuario === "super_admin" || roleUsuario === "produtor";
  const slugEventoPrincipal = normalizarSlug(eventoPrincipal?.evento?.slug);
  const podeEntrarCentralEventoPrincipal = slugValido(slugEventoPrincipal);

  const tarefasProximas = useMemo(() => {
    const evento = eventoPrincipal?.evento;

    if (!evento) {
      return [
        "Crie um novo evento para iniciar a operacao",
        "Organize listas e acessos da equipe",
        "Prepare a pagina publica para divulgacao",
        "Revise o fluxo de check-in antes da abertura",
      ];
    }

    return [
      `Criar listas do evento ${evento.nome}`,
      "Confirmar equipe de staff",
      "Publicar pagina do evento",
      "Compartilhar links de divulgacao",
    ];
  }, [eventoPrincipal]);

  const eventosAtivosFiltrados = useMemo(() => {
    const termo = buscaEventos.trim().toLowerCase();

    if (!termo) {
      return eventosAtivos;
    }

    return eventosAtivos.filter((evento) => {
      const nome = evento.nome.toLowerCase();
      const local = (evento.local_evento || "").toLowerCase();
      return nome.includes(termo) || local.includes(termo);
    });
  }, [buscaEventos, eventosAtivos]);

  const eventosHistoricoFiltrados = useMemo(() => {
    const termo = buscaEventos.trim().toLowerCase();

    if (!termo) {
      return eventosHistorico;
    }

    return eventosHistorico.filter((evento) => {
      const nome = evento.nome.toLowerCase();
      const local = (evento.local_evento || "").toLowerCase();
      return nome.includes(termo) || local.includes(termo);
    });
  }, [buscaEventos, eventosHistorico]);

  async function corrigirEventosSemSlug(eventos: Evento[]) {
    const faltandoSlug = eventos.filter((evento) => !slugValido(evento.slug));

    if (faltandoSlug.length === 0) {
      return eventos;
    }

    const eventosCorrigidos = [...eventos];

    for (const evento of faltandoSlug) {
      const novoSlug = await gerarSlugUnicoEvento({
        supabase,
        titulo: evento.nome,
        eventoIdAtual: evento.id,
      });

      if (!novoSlug) {
        continue;
      }

      const { error } = await supabase.from("eventos").update({ slug: novoSlug }).eq("id", evento.id);

      if (error) {
        continue;
      }

      const indice = eventosCorrigidos.findIndex((item) => item.id === evento.id);

      if (indice >= 0) {
        eventosCorrigidos[indice] = {
          ...eventosCorrigidos[indice],
          slug: novoSlug,
        };
      }
    }

    return eventosCorrigidos;
  }

  async function carregarEventos() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: usuarioData } = await supabase
      .from("usuarios")
      .select("role, nome, email")
      .eq("id", user.id)
      .single();

    const nomeResolvido = resolverNomeExibicaoUsuario({
      nome: usuarioData?.nome,
      email: usuarioData?.email || user.email || null,
      metadata: user.user_metadata,
    });
    setNomeCompleto(nomeResolvido);
    setNomePrimeiro(primeiroNome(nomeResolvido) || nomeResolvido);

    if (!usuarioData) {
      setRoleUsuario(null);
      setEventosAtivos([]);
      setEventosHistorico([]);
      setResumo({
        eventosFuturos: 0,
        usuarios: null,
        listas: 0,
        participantes: 0,
        checkins: 0,
      });
      setLoading(false);
      return;
    }

    const role = usuarioData.role as RoleUsuario;
    setRoleUsuario(role);

    let eventosAcessiveis: Evento[] = [];

    if (role === "super_admin") {
      const { data } = await supabase
        .from("eventos")
        .select("id, nome, slug, data_evento, hora_evento, local_evento, banner_url, banner_posicao, tipo_lista")
        .order("data_evento", { ascending: true })
        .order("hora_evento", { ascending: true });

      eventosAcessiveis = (data || []) as Evento[];
    } else if (role === "staff") {
      const { data: vinculosData } = await supabase
        .from("evento_staff")
        .select("evento_id")
        .eq("usuario_id", user.id);

      const idsEventos = (vinculosData || []).map((item) => item.evento_id).filter(Boolean);

      if (idsEventos.length > 0) {
        const { data } = await supabase
          .from("eventos")
          .select("id, nome, slug, data_evento, hora_evento, local_evento, banner_url, banner_posicao, tipo_lista")
          .in("id", idsEventos)
          .order("data_evento", { ascending: true })
          .order("hora_evento", { ascending: true });

        eventosAcessiveis = (data || []) as Evento[];
      }
    } else {
      const { data: vinculosData } = await supabase
        .from("evento_produtores")
        .select("evento_id")
        .eq("usuario_id", user.id);

      const idsEventos = (vinculosData || []).map((item) => item.evento_id).filter(Boolean);

      if (idsEventos.length > 0) {
        const { data } = await supabase
          .from("eventos")
          .select("id, nome, slug, data_evento, hora_evento, local_evento, banner_url, banner_posicao, tipo_lista")
          .in("id", idsEventos)
          .order("data_evento", { ascending: true })
          .order("hora_evento", { ascending: true });

        eventosAcessiveis = (data || []) as Evento[];
      }
    }

    eventosAcessiveis = await corrigirEventosSemSlug(eventosAcessiveis);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const eventosOperacao = eventosAcessiveis
      .sort((a, b) => {
        const dataA = dataInicioEvento(a);
        const dataB = dataInicioEvento(b);

        if (!dataA && !dataB) {
          return 0;
        }

        if (!dataA) {
          return 1;
        }

        if (!dataB) {
          return -1;
        }

        return dataA.getTime() - dataB.getTime();
      });

    const eventosAtivosFiltrados = eventosOperacao.filter((evento) => {
      const diaEvento = dataDiaEvento(evento);
      return diaEvento ? diaEvento.getTime() >= hoje.getTime() : false;
    });

    const eventosHistoricoFiltrados = eventosOperacao
      .filter((evento) => {
        const diaEvento = dataDiaEvento(evento);
        return diaEvento ? diaEvento.getTime() < hoje.getTime() : false;
      })
      .sort((a, b) => {
        const dataA = dataInicioEvento(a);
        const dataB = dataInicioEvento(b);

        if (!dataA && !dataB) {
          return 0;
        }

        if (!dataA) {
          return 1;
        }

        if (!dataB) {
          return -1;
        }

        return dataB.getTime() - dataA.getTime();
      });

    setEventosAtivos(eventosAtivosFiltrados);
    setEventosHistorico(eventosHistoricoFiltrados);

    const idsOperacao = eventosAtivosFiltrados.map((evento) => evento.id);

    let usuariosCount: number | null = null;
    if (role === "super_admin") {
      const { count, error } = await supabase.from("usuarios").select("id", { count: "exact", head: true });
      if (!error) {
        usuariosCount = count ?? 0;
      }
    }

    if (idsOperacao.length === 0) {
      setResumo({
        eventosFuturos: eventosAtivosFiltrados.length,
        usuarios: usuariosCount,
        listas: 0,
        participantes: 0,
        checkins: 0,
      });
      setLoading(false);
      return;
    }

    const [{ count: listasCount }, { count: participantesCount }, { count: checkinsCount }] = await Promise.all([
      supabase.from("listas_evento").select("id", { count: "exact", head: true }).in("evento_id", idsOperacao),
      supabase.from("participantes").select("id", { count: "exact", head: true }).in("evento_id", idsOperacao),
      supabase
        .from("participantes")
        .select("id", { count: "exact", head: true })
        .in("evento_id", idsOperacao)
        .eq("presente", true),
    ]);

    setResumo({
      eventosFuturos: eventosAtivosFiltrados.length,
      usuarios: usuariosCount,
      listas: listasCount ?? 0,
      participantes: participantesCount ?? 0,
      checkins: checkinsCount ?? 0,
    });

    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function excluirEvento(eventoId: number) {
    if (roleUsuario === "staff") {
      alert("Staff nao possui permissao para excluir eventos.");
      return;
    }

    const confirmar = confirm("Tem certeza que deseja excluir este evento? Esta acao nao podera ser desfeita.");

    if (!confirmar) {
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert("Sua sessao expirou. Faca login novamente.");
      router.push("/login");
      return;
    }

    setExcluindoEventoId(eventoId);

    const response = await fetch("/api/excluir-evento", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        eventoId,
      }),
    });

    const result = await response.json();

    setExcluindoEventoId(null);

    if (!response.ok || result.error) {
      alert(result.error || "Erro ao excluir evento.");
      return;
    }

    const eraEventoAtivo = eventosAtivos.some((evento) => evento.id === eventoId);
    setEventosAtivos((prev) => prev.filter((evento) => evento.id !== eventoId));
    setEventosHistorico((prev) => prev.filter((evento) => evento.id !== eventoId));
    setResumo((prev) => ({
      ...prev,
      eventosFuturos: eraEventoAtivo ? Math.max(prev.eventosFuturos - 1, 0) : prev.eventosFuturos,
    }));
    alert("Evento excluido com sucesso!");
  }

  async function corrigirSlugEvento(evento: Evento) {
    setCorrigindoSlugIds((prev) => (prev.includes(evento.id) ? prev : [...prev, evento.id]));

    try {
      const novoSlug = await gerarSlugUnicoEvento({
        supabase,
        titulo: evento.nome,
        eventoIdAtual: evento.id,
      });

      if (!novoSlug) {
        alert("Nao foi possivel corrigir o slug deste evento.");
        return null;
      }

      const { error } = await supabase.from("eventos").update({ slug: novoSlug }).eq("id", evento.id);

      if (error) {
        console.error("Erro ao corrigir slug do evento:", error);
        alert("Nao foi possivel corrigir o slug deste evento.");
        return null;
      }

      setEventosAtivos((prev) => prev.map((item) => (item.id === evento.id ? { ...item, slug: novoSlug } : item)));
      setEventosHistorico((prev) => prev.map((item) => (item.id === evento.id ? { ...item, slug: novoSlug } : item)));

      return novoSlug;
    } finally {
      setCorrigindoSlugIds((prev) => prev.filter((id) => id !== evento.id));
    }
  }

  async function abrirCentralEvento(evento: Evento) {
    const slugAtual = normalizarSlug(evento.slug);

    if (slugValido(slugAtual)) {
      router.push(`/admin/eventos/${slugAtual}`);
      return;
    }

    const novoSlug = await corrigirSlugEvento(evento);

    if (novoSlug) {
      router.push(`/admin/eventos/${novoSlug}`);
    }
  }

  useEffect(() => {
    carregarEventos();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 overflow-x-hidden">
        <div className="mx-auto max-w-7xl rounded-3xl border border-blue-100 bg-white p-10 text-center text-slate-500">
          Carregando central de operacoes...
        </div>
      </main>
    );
  }

  return (
    <AdminShell
      role={roleUsuario}
      userName={nomeCompleto}
      title={`${obterSaudacaoAgora()}, ${nomePrimeiro}! 👋`}
      subtitle={capitalizarTexto(dataAtual)}
      breadcrumbs={[{ label: "Inicio" }]}
      actions={
        <>
          {podeCriarEvento ? (
            <Link
              href="/admin/criar-evento"
              className={`px-6 py-3 rounded-2xl font-bold transition min-h-11 inline-flex items-center shadow-sm ${
                roleUsuario === "super_admin"
                  ? "bg-blue-700 hover:bg-blue-600 text-white shadow-lg"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              + Novo Evento
            </Link>
          ) : null}
          <button
            onClick={logout}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-6 py-3 rounded-2xl font-bold transition min-h-11"
          >
            Sair
          </button>
        </>
      }
    >
      <div className="space-y-8">
        {roleUsuario === "staff" ? (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            Seu perfil possui foco operacional e mostra apenas os eventos vinculados ao seu check-in.
          </section>
        ) : null}

        {eventoPrincipal ? (
          <section
            role="button"
            tabIndex={0}
            onClick={() => abrirCentralEvento(eventoPrincipal.evento)}
            onKeyDown={
              (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  void abrirCentralEvento(eventoPrincipal.evento);
                }
              }
            }
            className="group relative cursor-pointer overflow-hidden rounded-[2rem] border border-blue-200 bg-slate-950 px-6 py-8 text-white shadow-[0_24px_80px_rgba(30,41,59,0.28)] sm:px-10 sm:py-12"
          >
            {eventoPrincipal.evento.banner_url ? (
              <img
                src={eventoPrincipal.evento.banner_url}
                alt={eventoPrincipal.evento.nome}
                className={`absolute inset-0 h-full w-full object-cover opacity-60 transition duration-500 group-hover:scale-[1.02] ${
                  eventoPrincipal.evento.banner_posicao === "top"
                    ? "object-top"
                    : eventoPrincipal.evento.banner_posicao === "bottom"
                    ? "object-bottom"
                    : "object-center"
                }`}
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.35),_transparent_28%),linear-gradient(135deg,_#0f172a_0%,_#1d4ed8_55%,_#0f172a_100%)]" />
            )}

            {!eventoPrincipal.evento.banner_url ? (
              <div className="absolute inset-y-0 right-4 hidden items-center md:flex">
                <img src="/logo.png" alt="Brava" className="h-48 w-48 opacity-[0.12] object-contain" />
              </div>
            ) : null}

            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-blue-950/90 to-blue-900/70" />
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-blue-300/20 blur-2xl" />

            <div className="relative z-10 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-4">
                <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-blue-50 backdrop-blur">
                  {eventoPrincipal.tag}
                </span>

                <div className="space-y-2">
                  <h2 className="max-w-3xl text-3xl font-extrabold break-words sm:text-4xl xl:text-5xl">{eventoPrincipal.evento.nome}</h2>
                  <p className="text-blue-100 text-base sm:text-lg">{formatarData(eventoPrincipal.evento.data_evento)}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-blue-50/90 sm:text-base">
                    <p>🕙 {eventoPrincipal.evento.hora_evento || "Horario a definir"}</p>
                    <p className="break-words">📍 {eventoPrincipal.evento.local_evento || "Local a definir"}</p>
                  </div>
                </div>

                <p className="max-w-2xl text-sm leading-6 text-blue-50/85 sm:text-base">
                  Gerencie listas, convidados e check-in em um so lugar.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-2xl bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur">{diasRestantes(eventoPrincipal.evento)}</span>
                  <span
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
                      eventoPrincipal.evento.tipo_lista ? "bg-emerald-500/20 text-emerald-100" : "bg-amber-500/20 text-amber-100"
                    }`}
                  >
                    {eventoPrincipal.evento.tipo_lista ? "Lista aberta" : "Ingressos em breve"}
                  </span>
                </div>
              </div>

              <div className="relative z-10 flex flex-col gap-3 justify-end">
                {podeEntrarCentralEventoPrincipal ? (
                  <Link
                    href={`/admin/eventos/${slugEventoPrincipal}`}
                    onClick={(event) => event.stopPropagation()}
                    className="w-full rounded-2xl bg-white text-blue-900 px-5 py-4 text-center font-extrabold transition hover:bg-blue-50 min-h-11"
                  >
                    Entrar na Central do Evento
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void abrirCentralEvento(eventoPrincipal.evento);
                    }}
                    disabled={corrigindoSlugIds.includes(eventoPrincipal.evento.id)}
                    className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70 min-h-11"
                  >
                    {corrigindoSlugIds.includes(eventoPrincipal.evento.id) ? "Corrigindo slug..." : "Corrigir slug e abrir Central"}
                  </button>
                )}

                {podeEntrarCentralEventoPrincipal ? (
                  <Link
                    href={`/evento/${slugEventoPrincipal}`}
                    target="_blank"
                    onClick={(event) => event.stopPropagation()}
                    className="w-full rounded-2xl border border-white/40 bg-blue-800/40 px-5 py-4 text-center font-bold transition hover:bg-blue-700 min-h-11"
                  >
                    Pagina Publica
                  </Link>
                ) : null}

                <button
                  type="button"
                  disabled
                  onClick={(event) => event.stopPropagation()}
                  className="w-full rounded-2xl border border-white/30 bg-white/10 px-5 py-4 text-center font-bold text-blue-100 opacity-80 cursor-not-allowed min-h-11"
                >
                  Ingressos em breve
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-blue-100 bg-white p-8 sm:p-10 shadow-[0_20px_60px_rgba(148,163,184,0.16)] text-center">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-blue-900">Voce ainda nao possui eventos futuros.</h2>
            <p className="mt-3 text-slate-600">Crie um novo evento para iniciar sua central de operacoes.</p>

            {podeCriarEvento ? (
              <Link
                href="/admin/criar-evento"
                className="mt-6 inline-flex items-center justify-center rounded-2xl bg-blue-600 px-6 py-4 text-white font-bold hover:bg-blue-500 transition min-h-11"
              >
                Novo Evento
              </Link>
            ) : null}
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(148,163,184,0.16)]">
            <p className="text-sm text-slate-500">Eventos ativos/futuros</p>
            <h3 className="mt-3 text-4xl font-extrabold text-blue-900">{resumo.eventosFuturos}</h3>
            <p className="mt-2 text-sm text-slate-500">Operacao atual monitorada em tempo real.</p>
          </article>

          <article className="rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(148,163,184,0.16)]">
            <p className="text-sm text-slate-500">Equipe</p>
            <h3 className="mt-3 text-4xl font-extrabold text-blue-900">{resumo.usuarios ?? 0}</h3>
            <p className="mt-2 text-sm text-slate-500">Pessoas com acesso a plataforma.</p>
          </article>

          <article className="rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(148,163,184,0.16)]">
            <p className="text-sm text-slate-500">Listas</p>
            <h3 className="mt-3 text-4xl font-extrabold text-blue-900">{resumo.listas}</h3>
            <p className="mt-2 text-sm text-slate-500">Estruturas prontas para organizar convidados.</p>
          </article>

          <article className="rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(148,163,184,0.16)]">
            <p className="text-sm text-slate-500">Convidados</p>
            <h3 className="mt-3 text-4xl font-extrabold text-blue-900">{resumo.participantes}</h3>
            <p className="mt-2 text-sm text-slate-500">Base carregada nas listas dos eventos ativos.</p>
          </article>

          <article className="rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(148,163,184,0.16)]">
            <p className="text-sm text-slate-500">Check-ins</p>
            <h3 className="mt-3 text-4xl font-extrabold text-blue-900">{resumo.checkins}</h3>
            <p className="mt-2 text-sm text-slate-500">Entradas confirmadas na operacao atual.</p>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <article className="rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(148,163,184,0.16)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Operacao</p>
                <h2 className="mt-2 text-2xl font-extrabold text-blue-900">Proximas Tarefas</h2>
                <p className="mt-2 text-sm text-slate-500">Organize os proximos passos para o evento mais relevante da operacao.</p>
              </div>
              <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 font-extrabold">4</div>
            </div>

            <div className="mt-6 space-y-3">
              {tarefasProximas.map((tarefa, index) => (
                <div key={`${tarefa}-${index}`} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800">{tarefa}</p>
                    <p className="mt-1 text-sm text-slate-500">{eventoPrincipal ? "Prioridade sugerida para manter o evento pronto para operacao." : "Atividade recomendada para iniciar sua rotina administrativa."}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(148,163,184,0.16)] sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Agenda</p>
                <h2 className="mt-2 text-2xl font-extrabold text-blue-900">Proximos Eventos</h2>
              </div>
              <Link
                href="#todos-eventos"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-900 hover:bg-blue-100 transition"
              >
                Ver todos
              </Link>
            </div>

            {proximosEventos.length === 0 ? (
              <p className="mt-6 text-slate-500">Nenhum proximo evento futuro no momento.</p>
            ) : (
              <div className="mt-6 space-y-3">
                {proximosEventos.map((evento) => {
                  const slugEvento = normalizarSlug(evento.slug);

                  if (slugValido(slugEvento)) {
                    return (
                      <Link
                        key={evento.id}
                        href={`/admin/eventos/${slugEvento}`}
                        className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-blue-200 hover:bg-blue-50"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-slate-900 break-words">{evento.nome}</h3>
                            <p className="mt-2 text-sm text-slate-600">{formatarDataCurta(evento.data_evento)} • {evento.hora_evento || "Horario a definir"}</p>
                            <p className="mt-1 text-sm text-slate-500 break-words">{evento.local_evento || "Local a definir"}</p>
                          </div>
                          <span className="shrink-0 rounded-2xl bg-white px-3 py-2 text-xs font-bold text-blue-800 border border-blue-100">
                            {diasRestantes(evento)}
                          </span>
                        </div>
                      </Link>
                    );
                  }

                  return (
                    <article key={evento.id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                      <h3 className="text-base font-bold text-amber-800 break-words">{evento.nome}</h3>
                      <p className="mt-2 text-sm text-amber-700">Evento sem slug publicado.</p>
                      <button
                        type="button"
                        onClick={() => void corrigirSlugEvento(evento)}
                        disabled={corrigindoSlugIds.includes(evento.id)}
                        className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {corrigindoSlugIds.includes(evento.id) ? "Corrigindo..." : "Corrigir slug"}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </article>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(148,163,184,0.16)] sm:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Explorar</p>
              <h2 className="mt-2 text-2xl font-extrabold text-blue-900">Meus Eventos</h2>
              <p className="mt-1 text-sm text-slate-500">Pesquise rapidamente um evento por nome ou local para abrir sua Central.</p>
            </div>

            <div className="w-full md:max-w-md">
              <input
                type="text"
                value={buscaEventos}
                onChange={(event) => setBuscaEventos(event.target.value)}
                placeholder="Buscar evento por nome ou local"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </section>

        <section id="todos-eventos" className="rounded-[2rem] border border-white/70 bg-white p-6 sm:p-8 shadow-[0_20px_60px_rgba(148,163,184,0.16)]">
          <h2 className="text-2xl font-extrabold text-blue-900 mb-5">Proximos Eventos</h2>

          {eventosAtivosFiltrados.length === 0 ? (
            <p className="text-slate-500">Nenhum evento futuro ou em andamento disponivel para o seu perfil.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {eventosAtivosFiltrados.map((evento) => {
                const slugEvento = normalizarSlug(evento.slug);

                return (
                <article key={evento.id} className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                  <div className="relative h-44 bg-gradient-to-br from-blue-100 to-blue-50">
                    {evento.banner_url ? (
                      <img
                        src={evento.banner_url}
                        alt={evento.nome}
                        className={`h-full w-full object-cover ${
                          evento.banner_posicao === "top"
                            ? "object-top"
                            : evento.banner_posicao === "bottom"
                            ? "object-bottom"
                            : "object-center"
                        }`}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[linear-gradient(135deg,_#dbeafe_0%,_#eff6ff_45%,_#bfdbfe_100%)]" />
                    )}

                    {!evento.banner_url ? (
                      <div className="absolute inset-0 flex items-center justify-end pr-4">
                        <img src="/logo.png" alt="Brava" className="h-24 w-24 opacity-15 object-contain" />
                      </div>
                    ) : null}
                  </div>

                  <div className="p-6">
                    <h3 className="text-2xl font-extrabold text-blue-900 break-words">{evento.nome}</h3>

                    <div className="mt-4 space-y-2 text-slate-600 text-sm">
                      <p>📅 {formatarData(evento.data_evento)}</p>
                      <p>🕙 {evento.hora_evento || "Horario a definir"}</p>
                      <p className="break-words">📍 {evento.local_evento || "Local a definir"}</p>
                    </div>

                    <div className="mt-5 flex flex-col gap-3">
                      {slugValido(slugEvento) ? (
                        <Link
                          href={`/admin/eventos/${slugEvento}`}
                          className="bg-blue-600 hover:bg-blue-500 text-center text-white py-3 rounded-2xl font-bold transition min-h-11"
                        >
                          Entrar na Central do Evento
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void abrirCentralEvento(evento)}
                          disabled={corrigindoSlugIds.includes(evento.id)}
                          className="bg-amber-50 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70 border border-amber-200 text-center text-amber-700 py-3 rounded-2xl font-semibold min-h-11"
                        >
                          {corrigindoSlugIds.includes(evento.id) ? "Corrigindo slug..." : "Corrigir slug e abrir Central"}
                        </button>
                      )}

                      {slugValido(slugEvento) ? (
                        <Link
                          href={`/evento/${slugEvento}`}
                          target="_blank"
                          className="bg-blue-100 hover:bg-blue-200 text-center text-blue-900 py-3 rounded-2xl font-bold transition min-h-11"
                        >
                          Pagina Publica
                        </Link>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 text-center text-amber-700 py-3 rounded-2xl font-semibold min-h-11">
                          Evento sem slug publicado.
                        </div>
                      )}

                      {podeCriarEvento && (
                        <button
                          onClick={() => excluirEvento(evento.id)}
                          disabled={excluindoEventoId === evento.id}
                          className="bg-red-500 hover:bg-red-400 disabled:bg-red-300 text-center text-white py-3 rounded-2xl font-bold transition min-h-11"
                        >
                          {excluindoEventoId === evento.id ? "Excluindo..." : "Excluir"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
              })}
            </div>
          )}
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-700 mb-4">Historico de Eventos</h2>

          {eventosHistoricoFiltrados.length === 0 ? (
            <p className="text-slate-500 text-sm">Sem eventos encerrados no historico.</p>
          ) : (
            <div className="space-y-3">
              {eventosHistoricoFiltrados.map((evento) => {
                const slugEvento = normalizarSlug(evento.slug);

                return (
                  <article
                    key={evento.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div>
                      <h3 className="text-base font-bold text-slate-800 break-words">{evento.nome}</h3>
                      <p className="text-sm text-slate-500 mt-1">{formatarDataCurta(evento.data_evento)} • {evento.local_evento || "Local a definir"}</p>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {slugValido(slugEvento) ? (
                        <>
                          <Link
                            href={`/admin/eventos/${slugEvento}`}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition min-h-11"
                          >
                            Abrir
                          </Link>
                          <Link
                            href={`/evento/${slugEvento}`}
                            target="_blank"
                            className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 transition min-h-11"
                          >
                            Pagina Publica
                          </Link>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void corrigirSlugEvento(evento)}
                          disabled={corrigindoSlugIds.includes(evento.id)}
                          className="inline-flex items-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70 min-h-11"
                        >
                          {corrigindoSlugIds.includes(evento.id) ? "Corrigindo slug..." : "Corrigir slug"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
