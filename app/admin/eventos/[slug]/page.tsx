"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { podeEditarEvento, validarAcessoEvento } from "@/lib/permissoes";
import AdminShell from "@/app/components/AdminShell";
import AdminEventTabs from "@/app/components/AdminEventTabs";
import { gerarSlugUnicoLista } from "@/lib/slug";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

type ListaEventoResumo = {
  id: number;
  nome: string;
  tipo_lista: string | null;
  tipo_visibilidade?: string | null;
  visibilidade?: string | null;
  regra: string | null;
  ativa: boolean;
  slug: string | null;
  created_at?: string | null;
};

function rotuloTipoLista(tipoLista: string | null) {
  return tipoLista === "vip" ? "Lista Completa" : "Lista Simples";
}

function rotuloVisibilidadeLista(lista: ListaEventoResumo) {
  return visibilidadeEhPublica(lista.tipo_visibilidade || lista.visibilidade) ? "Pública" : "Privada";
}

function normalizarVisibilidadeLista(valor: string | null | undefined) {
  return (valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function visibilidadeEhPublica(valor: string | null | undefined) {
  const normalizado = normalizarVisibilidadeLista(valor);
  return normalizado === "publica" || normalizado === "lista publica";
}

function normalizarNomeLista(valor: string) {
  return valor.trim().toLowerCase();
}

export default function EventoDashboard() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";

  const [evento, setEvento] =
    useState<any>(null);

  const [participantes, setParticipantes] =
    useState<any[]>([]);

  const [busca, setBusca] =
    useState("");

  const [filtro, setFiltro] =
    useState("todos");

  const [acessoNegado, setAcessoNegado] =
    useState(false);

  const [roleUsuario, setRoleUsuario] =
    useState<string | null>(null);

  const [listasEvento, setListasEvento] =
    useState<ListaEventoResumo[]>([]);

  const [mostrarCriarLista, setMostrarCriarLista] = useState(false);
  const [listaNome, setListaNome] = useState("");
  const [listaRegra, setListaRegra] = useState("");
  const [listaTipo, setListaTipo] = useState("simples");
  const [listaVisibilidade, setListaVisibilidade] = useState("privada");
  const [listaAtiva, setListaAtiva] = useState(true);
  const [listaEditandoId, setListaEditandoId] = useState<number | null>(null);
  const [salvandoLista, setSalvandoLista] = useState(false);
  const [mensagemLista, setMensagemLista] = useState("");

  const mostrarMensagemCriacao = useMemo(() => searchParams.get("criado") === "1", [searchParams]);

  async function carregarListas(eventoId: number) {
    const { data: listasData } = await supabase
      .from("listas_evento")
      .select("*")
      .eq("evento_id", eventoId)
      .order("created_at", { ascending: false });

    if (listasData) {
      setListasEvento(listasData as ListaEventoResumo[]);
    }
  }

  async function carregarDados() {
    if (!slug) {
      return;
    }

    const { autorizado, evento: eventoData, erro, role } =
      await validarAcessoEvento(slug);

    if (!autorizado || !eventoData) {
      setAcessoNegado(true);
      setEvento(null);
      setRoleUsuario(role ?? null);
      return;
    }

    setAcessoNegado(false);
    setRoleUsuario(role ?? null);
    setEvento(eventoData);

    // PARTICIPANTES

    const { data } =
      await supabase
        .from("participantes")
        .select("*")
        .eq(
          "evento_id",
          eventoData.id
        )
        .order("id", {
          ascending: false,
        });

    if (data) {

      setParticipantes(data);
    }

    await carregarListas(eventoData.id);
  }

  async function salvarListaEvento(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSalvandoLista(true);
    setMensagemLista("");

    try {
      if (!evento?.id) {
        setMensagemLista("Evento não identificado. Recarregue a página e tente novamente.");
        return;
      }

      if (!listaNome.trim()) {
        setMensagemLista("Informe o nome da lista para continuar.");
        return;
      }

      const nomeNormalizado = normalizarNomeLista(listaNome);

      const { data: listasMesmoEvento, error: erroBuscaDuplicidade } = await supabase
        .from("listas_evento")
        .select("id, nome")
        .eq("evento_id", evento.id);

      if (erroBuscaDuplicidade) {
        console.error("Erro ao validar duplicidade de lista:", erroBuscaDuplicidade);
        setMensagemLista("Não foi possível criar a lista. Verifique os dados e tente novamente.");
        return;
      }

      const duplicada = (listasMesmoEvento || []).some((listaExistente) => {
        const mesmoNome = normalizarNomeLista(listaExistente.nome || "") === nomeNormalizado;
        const mesmaLista = listaEditandoId && listaExistente.id === listaEditandoId;
        return mesmoNome && !mesmaLista;
      });

      if (duplicada) {
        setMensagemLista("Já existe uma lista com esse nome neste evento.");
        return;
      }

      const {
        data: { user },
        error: erroAuth,
      } = await supabase.auth.getUser();

      if (erroAuth || !user?.id) {
        console.error("Erro capturado no catch:", erroAuth || { message: "Usuário não autenticado." });
        setMensagemLista("Usuário não autenticado.");
        return;
      }

      const permissaoCriar = await podeEditarEvento(slug);
      if (!permissaoCriar.autorizado) {
        console.error("Erro capturado no catch:", {
          message: "Usuário sem permissão para criar listas neste evento.",
          details: permissaoCriar.erro || null,
          code: "APP_FORBIDDEN_CREATE_LISTA",
          error: permissaoCriar,
        });
        setMensagemLista("Não foi possível criar a lista. Verifique os dados e tente novamente.");
        return;
      }

      const listaAtual = listaEditandoId ? listasEvento.find((item) => item.id === listaEditandoId) : null;
      const slugExistente = (listaAtual?.slug || "").trim();
      const precisaGerarSlug = !slugExistente;

      const slugGerado = precisaGerarSlug
        ? (await gerarSlugUnicoLista({
            supabase,
            titulo: listaNome,
            eventoId: evento.id,
            listaIdAtual: listaEditandoId,
          })) || null
        : slugExistente;

      const payload: Record<string, unknown> = {
        evento_id: evento.id,
        nome: listaNome.trim(),
        regra: listaRegra.trim() || null,
        tipo_visibilidade: (listaVisibilidade || "privada").trim() || "privada",
        tipo_lista: (listaTipo || "simples").trim() || "simples",
        ativa: typeof listaAtiva === "boolean" ? listaAtiva : true,
        slug: slugGerado,
        criado_por: user.id,
      };

      if (!payload.evento_id) {
        setMensagemLista("Evento não identificado. Recarregue a página e tente novamente.");
        return;
      }

      console.log("Payload enviado para listas_evento:", payload);

      const operacaoLista = listaEditandoId
        ? await supabase
            .from("listas_evento")
            .update(payload)
            .eq("id", listaEditandoId)
            .eq("evento_id", evento.id)
            .select("*")
            .single()
        : await supabase.from("listas_evento").insert([payload]).select("*").single();

      const erroSupabase = operacaoLista.error;

      if (erroSupabase) {
        console.error("Erro bruto Supabase:", erroSupabase);
        console.error("Erro Supabase message:", erroSupabase?.message);
        console.error("Erro Supabase details:", erroSupabase?.details);
        console.error("Erro Supabase hint:", erroSupabase?.hint);
        console.error("Erro Supabase code:", erroSupabase?.code);
        console.error("Erro Supabase JSON:", JSON.stringify(erroSupabase, null, 2));

        setMensagemLista("Não foi possível criar a lista. Verifique os dados e tente novamente.");
        return;
      }

      const listaPersistida = operacaoLista.data as ListaEventoResumo;

      if (listaPersistida) {
        if (listaEditandoId) {
          setListasEvento((prev) => prev.map((item) => (item.id === listaEditandoId ? listaPersistida : item)));
        } else {
          setListasEvento((prev) => [listaPersistida, ...prev]);
        }
      } else {
        await carregarListas(evento.id);
      }

      setListaNome("");
      setListaRegra("");
      setListaTipo("simples");
      setListaVisibilidade("privada");
      setListaAtiva(true);
      setListaEditandoId(null);
      setMostrarCriarLista(false);
      setMensagemLista(listaEditandoId ? "Lista atualizada com sucesso." : "Lista criada com sucesso.");
    } catch (erroCatch) {
      console.error("Erro capturado no catch:", erroCatch);
      setMensagemLista("Não foi possível criar a lista. Verifique os dados e tente novamente.");
    } finally {
      setSalvandoLista(false);
    }
  }

  function abrirCriacaoLista() {
    setMostrarCriarLista(true);
    setMensagemLista("");
    setListaEditandoId(null);
    setListaNome("");
    setListaRegra("");
    setListaTipo("simples");
    setListaVisibilidade("privada");
    setListaAtiva(true);

    requestAnimationFrame(() => {
      const secao = document.getElementById("listas-evento");
      if (secao) {
        secao.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  function abrirEdicaoLista(lista: ListaEventoResumo) {
    setMostrarCriarLista(true);
    setMensagemLista("");
    setListaEditandoId(lista.id);
    setListaNome(lista.nome || "");
    setListaRegra(lista.regra || "");
    setListaTipo(lista.tipo_lista || "simples");
    setListaVisibilidade((lista.tipo_visibilidade || lista.visibilidade || "privada").toLowerCase());
    setListaAtiva(lista.ativa);

    requestAnimationFrame(() => {
      const secao = document.getElementById("listas-evento");
      if (secao) {
        secao.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  async function excluirListaCentral(listaId: number) {
    if (!confirm("Deseja remover esta lista do evento?")) {
      return;
    }

    const { error } = await supabase.from("listas_evento").delete().eq("id", listaId);

    if (error) {
      console.error("Erro ao excluir lista:", error);
      setMensagemLista("Não foi possível excluir a lista. Tente novamente.");
      return;
    }

    setListasEvento((prev) => prev.filter((lista) => lista.id !== listaId));
    if (listaEditandoId === listaId) {
      setListaEditandoId(null);
      setListaNome("");
      setListaRegra("");
      setListaTipo("simples");
      setListaVisibilidade("privada");
      setListaAtiva(true);
      setMostrarCriarLista(false);
    }
  }

  async function fazerCheckin(
  id: number
) {
  console.log(
    "CHECK-IN INICIADO:",
    id
  );

  const { data, error } =
    await supabase
      .from("participantes")
      .update({
        presente: true,
        entrada_confirmada_em:
          new Date().toISOString(),
      })
      .eq("id", id)
      .select();

  console.log(
    "CHECK-IN DATA:",
    data
  );

  console.log(
    "CHECK-IN ERROR:",
    error
  );

  if (error) {
    console.error(
      "Erro ao realizar check-in:",
      error
    );

    alert(
      "Erro ao fazer check-in: " +
      error.message
    );

    return;
  }

  if (!data || data.length === 0) {
    alert(
      "Nenhum participante foi atualizado. Pode ser RLS/permissão ou ID inválido."
    );

    return;
  }

  await carregarDados();

  alert(
    "Check-in realizado com sucesso!"
  );
}

  // EXPORTAR EXCEL

  function exportarExcel() {

    const dados =
      participantes.map((p) => ({

        Nome: p.nome,

        WhatsApp:
          p.whatsapp || "",

        Email:
          p.email || "",

        Status:
          p.presente
            ? "PRESENTE"
            : "PENDENTE",

        Entrada:
          p.entrada_confirmada_em
            ? new Date(
                p.entrada_confirmada_em
              ).toLocaleTimeString(
                "pt-BR"
              )
            : "",

      }));

    const worksheet =
      XLSX.utils.json_to_sheet(
        dados
      );

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Participantes"
    );

    const excelBuffer =
      XLSX.write(
        workbook,
        {
          bookType: "xlsx",
          type: "array",
        }
      );

    const fileData =
      new Blob(
        [excelBuffer],
        {
          type:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
        }
      );

    saveAs(
      fileData,
      `${evento.slug}.xlsx`
    );
  }

  // EXPORTAR XML

  function exportarXML() {

    let xml =
      `<?xml version="1.0" encoding="UTF-8"?>`;

    xml += `<participantes>`;

    participantes.forEach((p) => {

      xml += `
        <participante>
          <nome>${p.nome}</nome>
          <whatsapp>${p.whatsapp || ""}</whatsapp>
          <email>${p.email || ""}</email>
          <status>${
            p.presente
              ? "PRESENTE"
              : "PENDENTE"
          }</status>
        </participante>
      `;
    });

    xml += `</participantes>`;

    const blob =
      new Blob(
        [xml],
        {
          type:
            "application/xml",
        }
      );

    saveAs(
      blob,
      `${evento.slug}.xml`
    );
  }

  useEffect(() => {
    if (slug) {
      carregarDados();
    }
  }, [slug]);

  useEffect(() => {
    if (mostrarMensagemCriacao) {
      setMostrarCriarLista(true);
    }
  }, [mostrarMensagemCriacao]);

  // FILTRO + BUSCA

  const participantesFiltrados =
    participantes.filter((p) => {

      const buscaMatch =
        p.nome
          ?.toLowerCase()
          .includes(
            busca.toLowerCase()
          );

      if (
        filtro === "presentes"
      ) {

        return (
          buscaMatch &&
          p.presente
        );
      }

      if (
        filtro === "pendentes"
      ) {

        return (
          buscaMatch &&
          !p.presente
        );
      }

      return buscaMatch;
    });

  function infoLista(participante: any) {
    const lista = listasEvento.find((item) => item.id === participante.lista_id);

    return {
      nome: lista?.nome || "Sem lista",
      tipo: lista?.tipo_lista || "simples",
    };
  }

  // ANALÍTICOS

  const totalConfirmados =
    participantes.length;

  const totalPresentes =
    participantes.filter(
      (p) => p.presente
    ).length;

  const totalPendentes =
    totalConfirmados -
    totalPresentes;

  const porcentagemComparecimento =
    totalConfirmados > 0
      ? Math.round(
          (
            totalPresentes /
            totalConfirmados
          ) * 100
        )
      : 0;

  // HORÁRIO MAIS QUENTE

  const horarios: Record<
    string,
    number
  > = {};

  participantes.forEach((p) => {

    if (
      p.entrada_confirmada_em
    ) {

      const hora =
        new Date(
          p.entrada_confirmada_em
        ).getHours();

      const label =
        `${hora}:00`;

      horarios[label] =
        (horarios[label] || 0)
        + 1;
    }
  });

  let horarioMaisQuente =
    "-";

  let maiorQuantidade = 0;

  Object.entries(horarios)
    .forEach(([hora, qtd]) => {

      if (
        qtd > maiorQuantidade
      ) {

        maiorQuantidade =
          qtd;

        horarioMaisQuente =
          hora;
      }
    });

  if (acessoNegado) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
        <h1 className="text-4xl font-bold">
          Você não possui permissão para acessar este evento.
        </h1>
      </main>
    );
  }

  if (!evento) {

    return (

      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">

        <h1 className="text-4xl font-bold">
          Carregando evento...
        </h1>

      </main>
    );
  }

  return (

    <AdminShell
      role={(roleUsuario as "super_admin" | "produtor" | "staff" | null) ?? null}
      title="Central do Evento"
      subtitle={evento ? `Acompanhe convidados, check-in e performance operacional de ${evento.nome}.` : "Acompanhe o evento em tempo real."}
      breadcrumbs={[
        { label: "Inicio", href: "/admin" },
        { label: "Meus Eventos", href: "/admin#todos-eventos" },
        { label: evento?.nome || "Evento" },
      ]}
      backLink={{ href: "/admin#todos-eventos", label: "Voltar para Meus Eventos" }}
      aside={{
        title: "Central do Evento",
        description:
          "Use esta central para acompanhar convidados, validar entradas, navegar para listas e manter a operacao do evento organizada em um unico lugar.",
      }}
    >
      <div className="space-y-6">
        <AdminEventTabs slug={evento.slug} current="visao-geral" />

        {mostrarMensagemCriacao ? (
          <section className="rounded-3xl border border-green-200 bg-green-50 px-5 py-4 text-green-700 shadow-sm">
            <p className="font-semibold">Evento criado com sucesso. Agora crie suas listas.</p>
          </section>
        ) : null}

      {/* HERO */}

      <section className="relative min-h-[300px] md:h-[320px] border-b border-blue-100 bg-white">

        <img
          src={evento.banner_url}
          alt={evento.nome}
          className={`w-full h-full object-cover ${
            evento.banner_posicao ===
            "top"
              ? "object-top"
              : evento.banner_posicao ===
                "bottom"
              ? "object-bottom"
              : "object-center"
          } opacity-35`}
        />

        <div className="absolute inset-0 bg-white/55" />

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 md:p-6">

          <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold text-blue-900 break-words">
            {evento.nome}
          </h1>

          <p className="mt-3 text-lg sm:text-2xl">
  Central do Evento
</p>

<div className="flex gap-3 mt-5 flex-wrap justify-center w-full px-2">

  {(roleUsuario === "super_admin" || roleUsuario === "produtor") && (
    <>
      <Link
        href={`/admin/eventos/${evento.slug}/editar`}
        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-2xl font-bold transition min-h-11"
      >
        Editar Evento
      </Link>

      <button
        type="button"
        onClick={abrirCriacaoLista}
        className="bg-blue-800 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-extrabold shadow-lg shadow-blue-200 transition min-h-11"
      >
        Criar Lista
      </button>
    </>
  )}

  {roleUsuario === "staff" && (
    <span className="bg-orange-100 text-orange-700 px-4 py-3 rounded-2xl font-semibold">
      Acesso de check-in apenas
    </span>
  )}

  <a
    href={`/evento/${evento.slug}`}
    target="_blank"
    className="bg-blue-100 hover:bg-blue-200 text-blue-900 px-5 py-3 rounded-2xl font-bold transition min-h-11"
  >
    Página Pública
  </a>

  <button
    onClick={() => {

      navigator.clipboard.writeText(
        `${window.location.origin}/evento/${evento.slug}`
      );

      alert("Link copiado!");
    }}
    className="bg-green-500 hover:bg-green-400 text-white px-5 py-3 rounded-2xl font-bold transition min-h-11"
  >
    Copiar Link
  </button>

</div>

        </div>

      </section>

      <section id="listas-evento" className="rounded-3xl border border-blue-100 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-blue-900">Listas do Evento</h2>
            <p className="mt-1 text-sm text-slate-500">Crie e abra listas diretamente da Central do Evento.</p>
          </div>

          {(roleUsuario === "super_admin" || roleUsuario === "produtor") && !mostrarCriarLista ? (
            <button
              type="button"
              onClick={abrirCriacaoLista}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-700 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-blue-600"
            >
              Criar Lista
            </button>
          ) : null}
        </div>

        {(roleUsuario === "super_admin" || roleUsuario === "produtor") && mostrarCriarLista ? (
          <form onSubmit={salvarListaEvento} className="mt-5 rounded-3xl border border-blue-100 bg-blue-50/40 p-4 sm:p-5">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-blue-900">Nome da Lista</label>
                <input
                  type="text"
                  value={listaNome}
                  onChange={(e) => setListaNome(e.target.value)}
                  placeholder="Nome da lista"
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-black"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-blue-900">Tipo da Lista</label>
                <select
                  value={listaTipo}
                  onChange={(e) => setListaTipo(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-black"
                >
                  <option value="simples">Lista Simples</option>
                  <option value="vip">Lista Completa</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-blue-900">Visibilidade</label>
                <select
                  value={listaVisibilidade}
                  onChange={(e) => setListaVisibilidade(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-black"
                >
                  <option value="publica">Lista Pública</option>
                  <option value="privada">Lista Privada</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-blue-900">Regra da Lista</label>
                <input
                  type="text"
                  value={listaRegra}
                  onChange={(e) => setListaRegra(e.target.value)}
                  placeholder="Ex: VIP, Entrada ate 22h"
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-black"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={listaAtiva}
                  onChange={(e) => setListaAtiva(e.target.checked)}
                />
                Lista ativa
              </label>

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="submit"
                  disabled={salvandoLista}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-700 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {salvandoLista ? "Salvando..." : listaEditandoId ? "Salvar Alterações" : "Salvar Lista"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarCriarLista(false);
                    setListaEditandoId(null);
                    setListaNome("");
                    setListaRegra("");
                    setListaTipo("simples");
                    setListaVisibilidade("privada");
                    setListaAtiva(true);
                  }}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
            </div>

            {mensagemLista ? (
              <p className={`mt-4 text-sm font-semibold ${mensagemLista.includes("Não foi possível") ? "text-red-600" : "text-green-700"}`}>
                {mensagemLista}
              </p>
            ) : null}
          </form>
        ) : null}

        {roleUsuario === "staff" ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
            Seu perfil possui acesso focado em check-in e nao permite criar listas.
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {listasEvento.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma lista criada para este evento.</p>
          ) : (
            listasEvento.map((lista) => (
              <article key={lista.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {(() => {
                  const visibilidade = (lista.tipo_visibilidade || lista.visibilidade || "privada").toLowerCase();
                  const listaPublica = visibilidadeEhPublica(lista.tipo_visibilidade || lista.visibilidade);
                  const listaPublicaAtivaComSlug = listaPublica && !!lista.ativa && !!lista.slug;

                  return (
                    <>
                <h3 className="text-base font-bold text-blue-900 break-words">{lista.nome}</h3>
                <p className="mt-1 text-sm text-slate-500">Tipo: {rotuloTipoLista(lista.tipo_lista ?? null)}</p>
                <p className="mt-1 text-sm text-slate-500">Visibilidade: {rotuloVisibilidadeLista(lista)}</p>
                <p className="mt-1 text-sm text-slate-500">Regra: {lista.regra || "-"}</p>
                <p className="mt-1 text-sm text-slate-500">Status: {lista.ativa ? "Ativa" : "Inativa"}</p>

                <div className="mt-2">
                  {listaPublicaAtivaComSlug ? (
                    <button
                      type="button"
                      onClick={() => {
                        const linkPublico = `${window.location.origin}/evento/${evento.slug}/${lista.slug}`;
                        navigator.clipboard.writeText(linkPublico);
                        setMensagemLista("Link público copiado com sucesso.");
                      }}
                      className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-200"
                    >
                      Copiar Link Público
                    </button>
                  ) : listaPublica && !!lista.ativa && !lista.slug ? (
                    <p className="text-sm font-semibold text-amber-700">Esta lista ainda não possui link público.</p>
                  ) : !listaPublica ? (
                    <span className="inline-flex rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                      Lista privada
                    </span>
                  ) : (
                    <span className="inline-flex rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                      Lista inativa
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/eventos/${evento.slug}/listas/${lista.id}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-green-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-400"
                  >
                    Abrir Lista
                  </Link>

                  {(roleUsuario === "super_admin" || roleUsuario === "produtor") ? (
                    <>
                      <button
                        type="button"
                        onClick={() => abrirEdicaoLista(lista)}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-100 px-4 py-2 text-sm font-bold text-blue-900 transition hover:bg-blue-200"
                      >
                        Editar Lista
                      </button>

                      <button
                        type="button"
                        onClick={() => void excluirListaCentral(lista.id)}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-400"
                      >
                        Excluir Lista
                      </button>
                    </>
                  ) : null}
                </div>
                    </>
                  );
                })()}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="p-4 sm:p-6" id="check-in">

        {/* CARDS */}

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 sm:gap-5">

          <div className="flex min-h-[168px] h-full flex-col items-center justify-center rounded-3xl border border-blue-100 bg-white p-6 text-center shadow-sm">

            <p className="min-h-6 text-slate-500">
              Total Confirmados
            </p>

            <h2 className="mt-3 text-4xl font-bold text-blue-900 sm:text-5xl">
              {totalConfirmados}
            </h2>

          </div>

          <div className="flex min-h-[168px] h-full flex-col items-center justify-center rounded-3xl border border-green-200 bg-white p-6 text-center shadow-sm">

            <p className="min-h-6 text-slate-500">
              Presentes
            </p>

            <h2 className="mt-3 text-4xl font-bold text-green-600 sm:text-5xl">
              {totalPresentes}
            </h2>

          </div>

          <div className="flex min-h-[168px] h-full flex-col items-center justify-center rounded-3xl border border-amber-200 bg-white p-6 text-center shadow-sm">

            <p className="min-h-6 text-slate-500">
              Pendentes
            </p>

            <h2 className="mt-3 text-4xl font-bold text-amber-600 sm:text-5xl">
              {totalPendentes}
            </h2>

          </div>

          <div className="flex min-h-[168px] h-full flex-col items-center justify-center rounded-3xl border border-blue-100 bg-white p-6 text-center shadow-sm">

            <p className="min-h-6 text-slate-500">
              Comparecimento
            </p>

            <h2 className="mt-3 text-4xl font-bold text-blue-500 sm:text-5xl">
              {porcentagemComparecimento}%
            </h2>

          </div>

          <div className="flex min-h-[168px] h-full flex-col items-center justify-center rounded-3xl border border-orange-200 bg-white p-6 text-center shadow-sm">

            <p className="min-h-6 text-slate-500">
              Horário Mais Quente
            </p>

            <h2 className="mt-3 text-3xl font-bold text-orange-500 sm:text-4xl">
              🔥 {horarioMaisQuente}
            </h2>

          </div>

        </div>

        {/* EXPORTAÇÃO */}

        <div className="flex gap-3 mb-6 flex-wrap">

          <button
            onClick={exportarExcel}
            className="bg-green-500 hover:bg-green-400 text-white px-5 py-3 rounded-2xl font-bold transition min-h-11"
          >
            Exportar Excel
          </button>

          <button
            onClick={exportarXML}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-2xl font-bold transition min-h-11"
          >
            Exportar XML
          </button>

        </div>

        {/* BUSCA */}

        <div id="convidados" className="mb-6 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-blue-900">Convidados e check-in</h2>
              <p className="mt-1 text-sm text-slate-500">Busque um participante para agilizar o atendimento na porta.</p>
            </div>

            <input
              type="text"
              placeholder="Buscar participante..."
              value={busca}
              onChange={(e) =>
                setBusca(
                  e.target.value
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-white p-4 text-black text-base md:max-w-md"
            />
          </div>
        </div>

        {/* FILTROS */}

        <div className="flex gap-3 mb-6 flex-wrap">

          <button
            onClick={() =>
              setFiltro("todos")
            }
            className={`px-4 sm:px-5 py-3 rounded-xl font-bold transition min-h-11 ${
              filtro === "todos"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-700 border border-slate-200"
            }`}
          >
            Todos
          </button>

          <button
            onClick={() =>
              setFiltro("presentes")
            }
            className={`px-4 sm:px-5 py-3 rounded-xl font-bold transition min-h-11 ${
              filtro === "presentes"
                ? "bg-green-500 text-white"
                : "bg-white text-slate-700 border border-slate-200"
            }`}
          >
            Presentes
          </button>

          <button
            onClick={() =>
              setFiltro("pendentes")
            }
            className={`px-4 sm:px-5 py-3 rounded-xl font-bold transition min-h-11 ${
              filtro === "pendentes"
                ? "bg-amber-500 text-white"
                : "bg-white text-slate-700 border border-slate-200"
            }`}
          >
            Pendentes
          </button>

        </div>

        {/* CHECK-IN MOBILE */}

        <div className="space-y-3 md:hidden">
          {participantesFiltrados.map((participante) => {
            const lista = infoLista(participante);

            return (
              <article
                key={participante.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 break-words">{participante.nome}</h3>
                  <p className="text-sm text-slate-600">Lista: {lista.nome}</p>
                  <p className="text-sm text-slate-600">Tipo: {lista.tipo}</p>
                  <p className="text-sm text-slate-600">WhatsApp: {participante.whatsapp || "-"}</p>
                  <p className="text-sm text-slate-600">Horário: {participante.entrada_confirmada_em
                    ? new Date(participante.entrada_confirmada_em).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"}</p>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className={participante.presente ? "text-green-600 font-bold" : "text-amber-600 font-bold"}>
                    {participante.presente ? "PRESENTE" : "PENDENTE"}
                  </p>

                  {!participante.presente ? (
                    <button
                      onClick={() => fazerCheckin(participante.id)}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-bold min-h-11"
                    >
                      Confirmar Entrada
                    </button>
                  ) : (
                    <span className="text-green-600 font-bold">✔ Confirmado</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* TABELA DESKTOP */}

        <div className="hidden md:block overflow-auto rounded-3xl border border-blue-100 bg-white shadow-sm">

          <table className="w-full">

            <thead className="bg-blue-50 text-slate-700">

              <tr>

                <th className="p-4 text-left">
                  Nome
                </th>

                <th className="p-4 text-left">
                  WhatsApp
                </th>

                <th className="p-4 text-left">
                  Status
                </th>

                <th className="p-4 text-left">
                  Horário Entrada
                </th>

                <th className="p-4 text-left">
                  Check-in
                </th>

              </tr>

            </thead>

            <tbody>

              {participantesFiltrados.map(
                (participante) => (

                  <tr
                    key={
                      participante.id
                    }
                    className={`border-t border-slate-200 ${
                      participante.presente
                        ? "bg-green-50"
                        : ""
                    }`}
                  >

                    <td className="p-4">
                      {participante.nome}
                    </td>

                    <td className="p-4">
                      {participante.whatsapp || "-"}
                    </td>

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
                          ).toLocaleTimeString(
                            "pt-BR",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : "-"}

                    </td>

                    <td className="p-4">

                      {!participante.presente ? (

                        <button
                          onClick={() =>
                            fazerCheckin(
                              participante.id
                            )
                          }
                          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl font-bold transition"
                        >
                          Fazer Check-in
                        </button>

                      ) : (

                        <span className="text-green-600 font-bold">
                          ✔ Confirmado
                        </span>

                      )}

                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>

      </section>

      </div>
    </AdminShell>
  );
}