"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { validarAcessoEvento } from "@/lib/permissoes";
import AdminShell from "@/app/components/AdminShell";
import { type RoleUsuario } from "@/lib/roles";

type ListaResumo = {
  id: number;
  nome: string;
  regra: string | null;
};

type Participante = {
  id: number;
  nome: string;
  whatsapp: string | null;
  lista_id: number | null;
  presente: boolean;
  entrada_confirmada_em: string | null;
  sexo_estimado?: string | null;
};

function normalizarTextoBusca(valor: unknown) {
  return String(valor || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function sexoParticipanteFiltro(valor: unknown) {
  const sexo = normalizarTextoBusca(valor);

  if (sexo === "masculino") return "masculino" as const;
  if (sexo === "feminino") return "feminino" as const;
  return "indeterminado" as const;
}

export default function PortariaCheckinPage() {
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";

  const [loading, setLoading] = useState(true);
  const [acessoNegado, setAcessoNegado] = useState(false);
  const [evento, setEvento] = useState<any>(null);
  const [roleUsuario, setRoleUsuario] = useState<string | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [listasEvento, setListasEvento] = useState<ListaResumo[]>([]);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] =
    useState<"todos" | "presentes" | "pendentes">("todos");
  const [filtroSexo, setFiltroSexo] =
    useState<"todos" | "homens" | "mulheres" | "indeterminados">("todos");
  const [filtroListaAtivo, setFiltroListaAtivo] = useState(false);
  const [filtroListaId, setFiltroListaId] = useState<number | null>(null);
  const [ordenacaoParticipantes, setOrdenacaoParticipantes] =
    useState<"cadastro_antigos" | "cadastro_recentes" | "nome_az" | "nome_za">(
      "cadastro_recentes"
    );

  const [processandoParticipanteId, setProcessandoParticipanteId] =
    useState<number | null>(null);
  const [mensagemParticipante, setMensagemParticipante] = useState<{
    tipo: "sucesso" | "erro";
    texto: string;
  } | null>(null);
  const [ultimoCheckin, setUltimoCheckin] = useState<Participante | null>(null);

  async function carregarDados() {
    if (!slug) return;

    setLoading(true);

    const { autorizado, evento: eventoData, role } =
      await validarAcessoEvento(slug);

    if (!autorizado || !eventoData) {
      setAcessoNegado(true);
      setEvento(null);
      setRoleUsuario(role ?? null);
      setLoading(false);
      return;
    }

    setAcessoNegado(false);
    setEvento(eventoData);
    setRoleUsuario(role ?? null);

    const [participantesResult, listasResult] = await Promise.all([
      supabase
        .from("participantes")
        .select(
          "id,nome,whatsapp,lista_id,presente,entrada_confirmada_em,sexo_estimado"
        )
        .eq("evento_id", eventoData.id)
        .order("id", { ascending: false }),
      supabase
        .from("listas_evento")
        .select("id,nome,regra")
        .eq("evento_id", eventoData.id),
    ]);

    if (participantesResult.error) {
      console.error(
        "Erro ao carregar participantes da portaria:",
        participantesResult.error
      );
      setMensagemParticipante({
        tipo: "erro",
        texto: "Não foi possível carregar os convidados.",
      });
    } else {
      setParticipantes((participantesResult.data || []) as Participante[]);
    }

    if (listasResult.error) {
      console.error("Erro ao carregar listas:", listasResult.error);
    } else {
      setListasEvento((listasResult.data || []) as ListaResumo[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void carregarDados();
  }, [slug]);

  function infoLista(participante: Participante) {
    const lista = listasEvento.find(
      (item) => Number(item.id) === Number(participante.lista_id)
    );

    return {
      nome: lista?.nome || "Sem lista",
      regra: (lista?.regra || "").trim() || "Sem regra definida",
    };
  }

  const participantesFiltrados = useMemo(() => {
    const termoBusca = normalizarTextoBusca(busca);

    const filtrados = participantes.filter((participante) => {
      const nome = normalizarTextoBusca(participante.nome);
      const whatsapp = normalizarTextoBusca(participante.whatsapp);

      const passaBusca =
        !termoBusca ||
        nome.includes(termoBusca) ||
        whatsapp.includes(termoBusca);

      if (!passaBusca) return false;

      if (filtroStatus === "presentes" && !participante.presente) return false;
      if (filtroStatus === "pendentes" && participante.presente) return false;

      const sexo = sexoParticipanteFiltro(participante.sexo_estimado);

      if (filtroSexo === "homens" && sexo !== "masculino") return false;
      if (filtroSexo === "mulheres" && sexo !== "feminino") return false;
      if (filtroSexo === "indeterminados" && sexo !== "indeterminado")
        return false;

      if (
        filtroListaAtivo &&
        filtroListaId !== null &&
        Number(participante.lista_id) !== Number(filtroListaId)
      ) {
        return false;
      }

      return true;
    });

    return filtrados.sort((a, b) => {
      if (ordenacaoParticipantes === "cadastro_antigos") {
        return Number(a.id) - Number(b.id);
      }

      if (ordenacaoParticipantes === "cadastro_recentes") {
        return Number(b.id) - Number(a.id);
      }

      const nomeA = String(a.nome || "").localeCompare(
        String(b.nome || ""),
        "pt-BR",
        { sensitivity: "base" }
      );

      return ordenacaoParticipantes === "nome_az" ? nomeA : nomeA * -1;
    });
  }, [
    busca,
    filtroStatus,
    filtroSexo,
    filtroListaAtivo,
    filtroListaId,
    ordenacaoParticipantes,
    participantes,
  ]);

  async function atualizarCheckinParticipante(
    participante: Participante,
    action: "checkin" | "undo-checkin"
  ) {
    if (!evento?.id) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setMensagemParticipante({
        tipo: "erro",
        texto: "Sua sessão expirou. Faça login novamente.",
      });
      return;
    }

    setProcessandoParticipanteId(participante.id);
    setMensagemParticipante(null);

    try {
      const response = await fetch("/api/participantes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          participanteId: participante.id,
          eventoId: evento.id,
          action,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        setMensagemParticipante({
          tipo: "erro",
          texto: result.error || "Não foi possível atualizar o check-in.",
        });
        return;
      }

      const participanteAtualizado = result.participante as {
        id: number;
        presente: boolean;
        entrada_confirmada_em: string | null;
      };

      setParticipantes((prev) =>
        prev.map((item) =>
          item.id === participanteAtualizado.id
            ? {
                ...item,
                presente: participanteAtualizado.presente,
                entrada_confirmada_em:
                  participanteAtualizado.entrada_confirmada_em,
              }
            : item
        )
      );

      if (action === "checkin") {
        setUltimoCheckin(participante);
        setMensagemParticipante({
          tipo: "sucesso",
          texto: `${participante.nome}: entrada confirmada.`,
        });
      } else {
        if (ultimoCheckin?.id === participante.id) {
          setUltimoCheckin(null);
        }

        setMensagemParticipante({
          tipo: "sucesso",
          texto: `${participante.nome}: check-in desfeito.`,
        });
      }
    } catch (error) {
      console.error("Erro de rede no check-in:", error);
      setMensagemParticipante({
        tipo: "erro",
        texto: "Falha de conexão. Tente novamente.",
      });
    } finally {
      setProcessandoParticipanteId(null);
    }
  }

  async function fazerCheckin(participante: Participante) {
    await atualizarCheckinParticipante(participante, "checkin");
  }

  async function desfazerCheckin(participante: Participante) {
    const confirmou = window.confirm(
      `Deseja desfazer o check-in de ${participante.nome}?`
    );

    if (!confirmou) return;

    await atualizarCheckinParticipante(participante, "undo-checkin");
  }

  if (acessoNegado) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-3xl font-black text-slate-900">Acesso negado</h1>
          <p className="mt-2 text-slate-600">
            Você não possui permissão para acessar a portaria deste evento.
          </p>
        </div>
      </main>
    );
  }

  if (loading || !evento) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
        <h1 className="text-2xl font-bold">Carregando portaria...</h1>
      </main>
    );
  }

  return (
    <AdminShell
      role={(roleUsuario as RoleUsuario | null) ?? null}
      title="Portaria / Check-in"
      subtitle={`Convidados e check-in de ${evento.nome}.`}
      breadcrumbs={[
        { label: "Início", href: "/admin" },
        { label: evento.nome, href: `/admin/eventos/${evento.slug}` },
        { label: "Portaria" },
      ]}
      backLink={{
        href: `/admin/eventos/${evento.slug}`,
        label: "Voltar para Central do Evento",
      }}
      aside={{
        title: "Portaria",
        description:
          "Tela exclusiva para busca de convidados, conferência da regra da lista e confirmação de entrada.",
      }}
    >
      <div className="space-y-6">
        <div className="flex justify-end">
          <Link
            href={`/admin/eventos/${evento.slug}`}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Central do Evento
          </Link>
        </div>

        <div
          id="convidados"
          className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-blue-900">
                Convidados e check-in
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Busque um participante para agilizar o atendimento na porta.
              </p>
            </div>

            <input
              type="text"
              placeholder="Buscar por nome, sobrenome ou WhatsApp"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="ui-field text-base md:max-w-md"
            />
          </div>

          <div className="mt-4 md:max-w-md">
            <label className="mb-2 block text-sm font-semibold text-blue-900">
              Ordenar por
            </label>
            <select
              value={ordenacaoParticipantes}
              onChange={(e) =>
                setOrdenacaoParticipantes(
                  e.target.value as
                    | "cadastro_antigos"
                    | "cadastro_recentes"
                    | "nome_az"
                    | "nome_za"
                )
              }
              className="ui-field"
            >
              <option value="cadastro_antigos">
                Ordem de cadastro (Mais antigos)
              </option>
              <option value="cadastro_recentes">
                Ordem de cadastro (Mais recentes)
              </option>
              <option value="nome_az">Nome A → Z</option>
              <option value="nome_za">Nome Z → A</option>
            </select>
          </div>
        </div>

        {mensagemParticipante ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              mensagemParticipante.tipo === "erro"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{mensagemParticipante.texto}</span>

              {mensagemParticipante.tipo === "sucesso" && ultimoCheckin ? (
                <button
                  type="button"
                  onClick={() => void desfazerCheckin(ultimoCheckin)}
                  disabled={processandoParticipanteId !== null}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-green-300 bg-white px-4 py-2 text-sm font-bold text-green-700 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Desfazer este check-in
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => {
              setFiltroStatus("todos");
              setFiltroSexo("todos");
              setFiltroListaAtivo(false);
              setFiltroListaId(null);
            }}
            className={`ui-toggle-btn px-4 sm:px-5 py-3 rounded-xl font-bold transition min-h-11 ${
              filtroStatus === "todos" &&
              filtroSexo === "todos" &&
              !filtroListaAtivo
                ? "ui-toggle-btn-active"
                : ""
            }`}
          >
            Todos
          </button>

          <button
            onClick={() => setFiltroStatus("presentes")}
            className={`ui-toggle-btn px-4 sm:px-5 py-3 rounded-xl font-bold transition min-h-11 ${
              filtroStatus === "presentes" ? "ui-toggle-btn-active" : ""
            }`}
          >
            Presentes
          </button>

          <button
            onClick={() => setFiltroStatus("pendentes")}
            className={`ui-toggle-btn px-4 sm:px-5 py-3 rounded-xl font-bold transition min-h-11 ${
              filtroStatus === "pendentes" ? "ui-toggle-btn-active" : ""
            }`}
          >
            Pendentes
          </button>

          <button
            onClick={() => setFiltroSexo("homens")}
            className={`ui-toggle-btn px-4 sm:px-5 py-3 rounded-xl font-bold transition min-h-11 ${
              filtroSexo === "homens" ? "ui-toggle-btn-active" : ""
            }`}
          >
            Homens
          </button>

          <button
            onClick={() => setFiltroSexo("mulheres")}
            className={`ui-toggle-btn px-4 sm:px-5 py-3 rounded-xl font-bold transition min-h-11 ${
              filtroSexo === "mulheres" ? "ui-toggle-btn-active" : ""
            }`}
          >
            Mulheres
          </button>

          <button
            onClick={() => setFiltroSexo("indeterminados")}
            className={`ui-toggle-btn px-4 sm:px-5 py-3 rounded-xl font-bold transition min-h-11 ${
              filtroSexo === "indeterminados" ? "ui-toggle-btn-active" : ""
            }`}
          >
            Indeterminados
          </button>

          <button
            onClick={() => {
              const proximoAtivo = !filtroListaAtivo;
              setFiltroListaAtivo(proximoAtivo);

              if (!proximoAtivo) {
                setFiltroListaId(null);
                return;
              }

              if (filtroListaId === null && listasEvento.length > 0) {
                setFiltroListaId(listasEvento[0].id);
              }
            }}
            className={`ui-toggle-btn px-4 sm:px-5 py-3 rounded-xl font-bold transition min-h-11 ${
              filtroListaAtivo ? "ui-toggle-btn-active" : ""
            }`}
          >
            Por Lista
          </button>
        </div>

        {filtroListaAtivo ? (
          <div className="max-w-md">
            <label className="mb-2 block text-sm font-semibold text-blue-900">
              Selecionar Lista
            </label>
            <select
              value={filtroListaId ?? ""}
              onChange={(e) =>
                setFiltroListaId(e.target.value ? Number(e.target.value) : null)
              }
              className="ui-field"
            >
              {listasEvento.length === 0 ? (
                <option value="">Sem listas</option>
              ) : null}
              {listasEvento.map((lista) => (
                <option key={lista.id} value={lista.id}>
                  {lista.nome}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {/* MOBILE */}
        <div className="space-y-3 md:hidden">
          {participantesFiltrados.map((participante) => {
            const lista = infoLista(participante);

            return (
              <article
                key={participante.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm ${
                  participante.presente
                    ? "border-green-200 bg-green-50"
                    : "border-slate-200"
                }`}
              >
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 break-words">
                    {participante.nome}
                  </h3>

                  <p className="text-sm text-slate-600">
                    <span className="font-bold">Lista:</span> {lista.nome}
                  </p>

                  <p className="text-sm text-slate-600">
                    <span className="font-bold">Regra da Lista:</span>{" "}
                    {lista.regra}
                  </p>

                  <p className="text-sm text-slate-600">
                    <span className="font-bold">WhatsApp:</span>{" "}
                    {participante.whatsapp || "-"}
                  </p>

                  <p className="text-sm text-slate-600">
                    <span className="font-bold">Horário:</span>{" "}
                    {participante.entrada_confirmada_em
                      ? new Date(
                          participante.entrada_confirmada_em
                        ).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </p>
                </div>

                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p
                    className={
                      participante.presente
                        ? "text-green-600 font-bold"
                        : "text-amber-600 font-bold"
                    }
                  >
                    {participante.presente ? "PRESENTE" : "PENDENTE"}
                  </p>

                  {!participante.presente ? (
                    <button
                      onClick={() => void fazerCheckin(participante)}
                      disabled={
                        processandoParticipanteId === participante.id
                      }
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-bold min-h-11"
                    >
                      {processandoParticipanteId === participante.id
                        ? "Confirmando..."
                        : "Fazer Check-in"}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-bold">
                        ✓ Confirmado
                      </span>

                      <button
                        onClick={() => void desfazerCheckin(participante)}
                        disabled={
                          processandoParticipanteId === participante.id
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        Desfazer Check-in
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* DESKTOP */}
        <div className="hidden md:block overflow-x-auto rounded-3xl border border-blue-100 bg-white shadow-sm">
          <table className="w-full min-w-[1050px] table-fixed">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[16%]" />
              <col className="w-[25%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[13%]" />
            </colgroup>

            <thead className="bg-blue-50 text-slate-700">
              <tr>
                <th className="p-4 text-left">Nome</th>
                <th className="p-4 text-left">WhatsApp</th>
                <th className="p-4 text-left">Regra da Lista</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-left whitespace-nowrap">
                  Horário Entrada
                </th>
                <th className="p-4 text-left">Ação</th>
              </tr>
            </thead>

            <tbody>
              {participantesFiltrados.map((participante) => {
                const lista = infoLista(participante);

                return (
                  <tr
                    key={participante.id}
                    className={`border-t border-slate-200 ${
                      participante.presente ? "bg-green-50" : ""
                    }`}
                  >
                    <td className="p-4 break-words">
                      <div className="font-medium">{participante.nome}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {lista.nome}
                      </div>
                    </td>

                    <td className="p-4">
                      {participante.whatsapp || "-"}
                    </td>

                    <td className="p-4 break-words">{lista.regra}</td>

                    <td className="p-4">
                      {participante.presente ? (
                        <span className="text-green-600 font-bold">
                          PRESENTE
                        </span>
                      ) : (
                        <span className="text-amber-600 font-bold">
                          PENDENTE
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      {participante.entrada_confirmada_em
                        ? new Date(
                            participante.entrada_confirmada_em
                          ).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </td>

                    <td className="p-4">
                      {!participante.presente ? (
                        <button
                          onClick={() => void fazerCheckin(participante)}
                          disabled={
                            processandoParticipanteId === participante.id
                          }
                          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {processandoParticipanteId === participante.id
                            ? "Confirmando..."
                            : "Fazer Check-in"}
                        </button>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <span className="text-green-600 font-bold text-center">
                            ✓ Confirmado
                          </span>

                          <button
                            onClick={() => void desfazerCheckin(participante)}
                            disabled={
                              processandoParticipanteId === participante.id
                            }
                            className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                          >
                            Desfazer Check-in
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {participantesFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            Nenhum participante encontrado.
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
