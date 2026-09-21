"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Evento = {
  id: number;
  nome: string;
  slug: string | null;
};

type LotePerformance = {
  lote_id: number;
  nome: string;
  preco: number;
  capacidade: number;
  vendidos: number;
  pendentes: number;
  disponiveis: number;
  receita: number;
  ativo: boolean;
};

type TipoPerformance = {
  tipo_ingresso_id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  capacidade: number;
  vendidos: number;
  pendentes: number;
  disponiveis: number;
  receita: number;
  percentual_vendido: number;
  lotes: LotePerformance[];
};

type Resumo = {
  receita_confirmada: number;
  receita_pendente: number;
  pedidos_total: number;
  pedidos_pagos: number;
  pedidos_pendentes: number;
  ingressos_vendidos: number;
  ingressos_pendentes: number;
  ticket_medio: number;
  capacidade_total: number;
  disponiveis: number;
};

type DashboardResponse = {
  evento: Evento;
  resumo: Resumo;
  performance_tipos: TipoPerformance[];
};

function formatarMoeda(valor: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor || 0));
}

export default function IngressosEventoTiketeiraPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const eventoId = Number(params.id);

  const [dados, setDados] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // NOVO TIPO DE INGRESSO

  const [mostrarNovoTipo, setMostrarNovoTipo] = useState(false);
  const [nomeNovoTipo, setNomeNovoTipo] = useState("");
  const [descricaoNovoTipo, setDescricaoNovoTipo] = useState("");
  const [salvandoTipo, setSalvandoTipo] = useState(false);

  // EDITAR / STATUS DO TIPO

  const [tipoEditando, setTipoEditando] = useState<number | null>(null);
  const [nomeTipoEditando, setNomeTipoEditando] = useState("");
  const [descricaoTipoEditando, setDescricaoTipoEditando] = useState("");
  const [salvandoEdicaoTipo, setSalvandoEdicaoTipo] = useState(false);
  const [alterandoStatusTipo, setAlterandoStatusTipo] = useState<number | null>(null);

  // NOVO LOTE

  const [tipoNovoLote, setTipoNovoLote] = useState<number | null>(
    null
  );

  const [nomeNovoLote, setNomeNovoLote] = useState("");
  const [precoNovoLote, setPrecoNovoLote] = useState("");
  const [quantidadeNovoLote, setQuantidadeNovoLote] =
    useState("");

  const [inicioNovoLote, setInicioNovoLote] = useState("");
  const [fimNovoLote, setFimNovoLote] = useState("");
  const [salvandoLote, setSalvandoLote] = useState(false);

  // EDITAR / STATUS DO LOTE

  const [loteEditando, setLoteEditando] = useState<number | null>(null);
  const [nomeLoteEditando, setNomeLoteEditando] = useState("");
  const [precoLoteEditando, setPrecoLoteEditando] = useState("");
  const [quantidadeLoteEditando, setQuantidadeLoteEditando] = useState("");
  const [inicioLoteEditando, setInicioLoteEditando] = useState("");
  const [fimLoteEditando, setFimLoteEditando] = useState("");
  const [salvandoEdicaoLote, setSalvandoEdicaoLote] = useState(false);
  const [alterandoStatusLote, setAlterandoStatusLote] = useState<number | null>(null);

  // MENSAGENS

  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [mensagemOperacao, setMensagemOperacao] = useState("");

  async function obterSessao() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.user) {
      router.replace("/login");
      return null;
    }

    return session;
  }

  async function carregarDashboard(
    mostrarCarregamento = true
  ) {
    if (mostrarCarregamento) {
      setLoading(true);
    }

    setErro("");

    if (eventoId !== 28) {
      setErro(
        "Este evento ainda não está habilitado para a Tiketeira."
      );
      setLoading(false);
      return;
    }

    const session = await obterSessao();

    if (!session) {
      setLoading(false);
      return;
    }

    const { data: usuario, error: erroUsuario } = await supabase
      .from("usuarios")
      .select("acesso_listas,acesso_tiketeira")
      .eq("id", session.user.id)
      .single();

    if (erroUsuario || !usuario) {
      setErro("Não foi possível validar seu acesso.");
      setLoading(false);
      return;
    }

    if (usuario.acesso_tiketeira !== true) {
      if (usuario.acesso_listas === true) {
        router.replace("/admin");
        return;
      }

      await supabase.auth.signOut();
      router.replace("/login");
      return;
    }

    try {
      const resposta = await fetch(
        "/api/admin/tiketeira/dashboard",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        }
      );

      const json = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          json?.error ||
            "Não foi possível carregar os ingressos."
        );
      }

      const dashboard = json as DashboardResponse;

      if (dashboard.evento.id !== eventoId) {
        throw new Error(
          "O evento retornado não corresponde ao evento solicitado."
        );
      }

      setDados(dashboard);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao carregar os ingressos."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregarDashboard();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId]);

  // CRIAR TIPO DE INGRESSO

  async function criarTipoIngresso() {
    setMensagemOperacao("");
    setMensagemSucesso("");

    const nome = nomeNovoTipo.trim();

    if (!nome) {
      setMensagemOperacao(
        "Informe o nome do tipo de ingresso."
      );
      return;
    }

    setSalvandoTipo(true);

    try {
      const session = await obterSessao();

      if (!session) {
        return;
      }

      const resposta = await fetch(
        "/api/admin/tiketeira/ingressos",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            acao: "criar_tipo",
            evento_id: eventoId,
            nome,
            descricao: descricaoNovoTipo.trim() || null,
          }),
        }
      );

      const json = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          json?.error ||
            "Não foi possível criar o tipo de ingresso."
        );
      }

      setNomeNovoTipo("");
      setDescricaoNovoTipo("");
      setMostrarNovoTipo(false);

      setMensagemSucesso(
        json?.message ||
          "Tipo de ingresso criado com sucesso."
      );

      await carregarDashboard(false);
    } catch (error) {
      setMensagemOperacao(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao criar o tipo de ingresso."
      );
    } finally {
      setSalvandoTipo(false);
    }
  }

  function cancelarNovoTipo() {
    if (salvandoTipo) return;

    setMostrarNovoTipo(false);
    setNomeNovoTipo("");
    setDescricaoNovoTipo("");
    setMensagemOperacao("");
  }

  // EDITAR / ATIVAR / DESATIVAR TIPO

  function abrirEdicaoTipo(tipo: TipoPerformance) {
    setTipoEditando(tipo.tipo_ingresso_id);
    setNomeTipoEditando(tipo.nome);
    setDescricaoTipoEditando(tipo.descricao || "");
    setMensagemOperacao("");
    setMensagemSucesso("");
  }

  function cancelarEdicaoTipo() {
    if (salvandoEdicaoTipo) return;
    setTipoEditando(null);
    setNomeTipoEditando("");
    setDescricaoTipoEditando("");
    setMensagemOperacao("");
  }

  async function salvarEdicaoTipo(tipoId: number) {
    setMensagemOperacao("");
    setMensagemSucesso("");

    const nome = nomeTipoEditando.trim();

    if (!nome) {
      setMensagemOperacao("Informe o nome do tipo de ingresso.");
      return;
    }

    setSalvandoEdicaoTipo(true);

    try {
      const session = await obterSessao();
      if (!session) return;

      const resposta = await fetch("/api/admin/tiketeira/ingressos", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          acao: "editar_tipo",
          evento_id: eventoId,
          tipo_ingresso_id: tipoId,
          nome,
          descricao: descricaoTipoEditando.trim() || null,
        }),
      });

      const json = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          json?.error || "Não foi possível atualizar o tipo de ingresso."
        );
      }

      setTipoEditando(null);
      setNomeTipoEditando("");
      setDescricaoTipoEditando("");
      setMensagemSucesso(json?.message || "Tipo de ingresso atualizado.");
      await carregarDashboard(false);
    } catch (error) {
      setMensagemOperacao(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao atualizar o tipo de ingresso."
      );
    } finally {
      setSalvandoEdicaoTipo(false);
    }
  }

  async function alterarStatusTipo(tipo: TipoPerformance) {
    setMensagemOperacao("");
    setMensagemSucesso("");

    const novoStatus = !tipo.ativo;

    const confirmou = window.confirm(
      `${novoStatus ? "Ativar" : "Desativar"} "${tipo.nome}"?\n\n` +
        (novoStatus
          ? "O ingresso voltará a ficar disponível para venda conforme seus lotes ativos."
          : "O ingresso permanecerá no histórico, mas ficará indisponível para venda.")
    );

    if (!confirmou) return;

    setAlterandoStatusTipo(tipo.tipo_ingresso_id);

    try {
      const session = await obterSessao();
      if (!session) return;

      const resposta = await fetch("/api/admin/tiketeira/ingressos", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          acao: "alterar_status_tipo",
          evento_id: eventoId,
          tipo_ingresso_id: tipo.tipo_ingresso_id,
          ativo: novoStatus,
        }),
      });

      const json = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          json?.error || "Não foi possível alterar o status do tipo de ingresso."
        );
      }

      if (tipoEditando === tipo.tipo_ingresso_id) {
        setTipoEditando(null);
        setNomeTipoEditando("");
        setDescricaoTipoEditando("");
      }

      setMensagemSucesso(
        json?.message ||
          (novoStatus
            ? "Tipo de ingresso ativado."
            : "Tipo de ingresso desativado.")
      );

      await carregarDashboard(false);
    } catch (error) {
      setMensagemOperacao(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao alterar o status do tipo de ingresso."
      );
    } finally {
      setAlterandoStatusTipo(null);
    }
  }

  // NOVO LOTE

  function abrirNovoLote(tipoId: number) {
    setTipoNovoLote(tipoId);

    setNomeNovoLote("");
    setPrecoNovoLote("");
    setQuantidadeNovoLote("");
    setInicioNovoLote("");
    setFimNovoLote("");

    setMensagemOperacao("");
    setMensagemSucesso("");
  }

  function cancelarNovoLote() {
    if (salvandoLote) return;

    setTipoNovoLote(null);

    setNomeNovoLote("");
    setPrecoNovoLote("");
    setQuantidadeNovoLote("");
    setInicioNovoLote("");
    setFimNovoLote("");

    setMensagemOperacao("");
  }

  async function criarLote(tipoId: number) {
    setMensagemOperacao("");
    setMensagemSucesso("");

    const nome = nomeNovoLote.trim();

    const preco = Number(
      precoNovoLote.replace(",", ".")
    );

    const quantidade = Number(quantidadeNovoLote);

    if (!nome) {
      setMensagemOperacao("Informe o nome do lote.");
      return;
    }

    if (
      !precoNovoLote.trim() ||
      !Number.isFinite(preco) ||
      preco < 0
    ) {
      setMensagemOperacao("Informe um preço válido.");
      return;
    }

    if (
      !Number.isInteger(quantidade) ||
      quantidade <= 0
    ) {
      setMensagemOperacao(
        "Informe uma quantidade válida maior que zero."
      );
      return;
    }

    if (
      inicioNovoLote &&
      fimNovoLote &&
      new Date(fimNovoLote).getTime() <=
        new Date(inicioNovoLote).getTime()
    ) {
      setMensagemOperacao(
        "O fim das vendas deve ser posterior ao início."
      );
      return;
    }

    setSalvandoLote(true);

    try {
      const session = await obterSessao();

      if (!session) {
        return;
      }

      const resposta = await fetch(
        "/api/admin/tiketeira/ingressos",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            acao: "criar_lote",
            evento_id: eventoId,
            tipo_ingresso_id: tipoId,
            nome,
            preco,
            quantidade_total: quantidade,
            inicio_vendas: inicioNovoLote || null,
            fim_vendas: fimNovoLote || null,
          }),
        }
      );

      const json = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          json?.error ||
            "Não foi possível criar o lote."
        );
      }

      setTipoNovoLote(null);

      setNomeNovoLote("");
      setPrecoNovoLote("");
      setQuantidadeNovoLote("");
      setInicioNovoLote("");
      setFimNovoLote("");

      setMensagemSucesso(
        json?.message || "Lote criado com sucesso."
      );

      await carregarDashboard(false);
    } catch (error) {
      setMensagemOperacao(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao criar o lote."
      );
    } finally {
      setSalvandoLote(false);
    }
  }

  // EDITAR / ATIVAR / DESATIVAR LOTE

  function abrirEdicaoLote(lote: LotePerformance) {
    setLoteEditando(lote.lote_id);
    setNomeLoteEditando(lote.nome);
    setPrecoLoteEditando(String(lote.preco).replace(".", ","));
    setQuantidadeLoteEditando(String(lote.capacidade));
    setInicioLoteEditando("");
    setFimLoteEditando("");
    setMensagemOperacao("");
    setMensagemSucesso("");
  }

  function cancelarEdicaoLote() {
    if (salvandoEdicaoLote) return;

    setLoteEditando(null);
    setNomeLoteEditando("");
    setPrecoLoteEditando("");
    setQuantidadeLoteEditando("");
    setInicioLoteEditando("");
    setFimLoteEditando("");
    setMensagemOperacao("");
  }

  async function salvarEdicaoLote(loteId: number) {
    setMensagemOperacao("");
    setMensagemSucesso("");

    const nome = nomeLoteEditando.trim();
    const preco = Number(precoLoteEditando.replace(",", "."));
    const quantidade = Number(quantidadeLoteEditando);

    if (!nome) {
      setMensagemOperacao("Informe o nome do lote.");
      return;
    }

    if (
      !precoLoteEditando.trim() ||
      !Number.isFinite(preco) ||
      preco < 0
    ) {
      setMensagemOperacao("Informe um preço válido.");
      return;
    }

    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      setMensagemOperacao(
        "Informe uma quantidade válida maior que zero."
      );
      return;
    }

    if (
      inicioLoteEditando &&
      fimLoteEditando &&
      new Date(fimLoteEditando).getTime() <=
        new Date(inicioLoteEditando).getTime()
    ) {
      setMensagemOperacao(
        "O fim das vendas deve ser posterior ao início."
      );
      return;
    }

    setSalvandoEdicaoLote(true);

    try {
      const session = await obterSessao();
      if (!session) return;

      const resposta = await fetch("/api/admin/tiketeira/ingressos", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          acao: "editar_lote",
          evento_id: eventoId,
          lote_id: loteId,
          nome,
          preco,
          quantidade_total: quantidade,
          inicio_vendas: inicioLoteEditando || null,
          fim_vendas: fimLoteEditando || null,
        }),
      });

      const json = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          json?.error || "Não foi possível atualizar o lote."
        );
      }

      setLoteEditando(null);
      setNomeLoteEditando("");
      setPrecoLoteEditando("");
      setQuantidadeLoteEditando("");
      setInicioLoteEditando("");
      setFimLoteEditando("");
      setMensagemSucesso(json?.message || "Lote atualizado com sucesso.");

      await carregarDashboard(false);
    } catch (error) {
      setMensagemOperacao(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao atualizar o lote."
      );
    } finally {
      setSalvandoEdicaoLote(false);
    }
  }

  async function alterarStatusLote(lote: LotePerformance) {
    setMensagemOperacao("");
    setMensagemSucesso("");

    const novoStatus = !lote.ativo;

    const confirmou = window.confirm(
      `${novoStatus ? "Ativar" : "Desativar"} "${lote.nome}"?\n\n` +
        (novoStatus
          ? "O lote voltará a ficar disponível para venda conforme as demais regras."
          : "O lote permanecerá no histórico, mas ficará indisponível para venda.")
    );

    if (!confirmou) return;

    setAlterandoStatusLote(lote.lote_id);

    try {
      const session = await obterSessao();
      if (!session) return;

      const resposta = await fetch("/api/admin/tiketeira/ingressos", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          acao: "alterar_status_lote",
          evento_id: eventoId,
          lote_id: lote.lote_id,
          ativo: novoStatus,
        }),
      });

      const json = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          json?.error || "Não foi possível alterar o status do lote."
        );
      }

      if (loteEditando === lote.lote_id) {
        setLoteEditando(null);
        setNomeLoteEditando("");
        setPrecoLoteEditando("");
        setQuantidadeLoteEditando("");
        setInicioLoteEditando("");
        setFimLoteEditando("");
      }

      setMensagemSucesso(
        json?.message ||
          (novoStatus ? "Lote ativado." : "Lote desativado.")
      );

      await carregarDashboard(false);
    } catch (error) {
      setMensagemOperacao(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao alterar o status do lote."
      );
    } finally {
      setAlterandoStatusLote(null);
    }
  }

  // INDICADORES

  const totalTipos =
    dados?.performance_tipos.length || 0;

  const totalLotes = useMemo(() => {
    if (!dados) return 0;

    return dados.performance_tipos.reduce(
      (total, tipo) => total + tipo.lotes.length,
      0
    );
  }, [dados]);

  const precoMinimo = useMemo(() => {
    if (!dados) return 0;

    const precos = dados.performance_tipos.flatMap(
      (tipo) =>
        tipo.lotes.map((lote) =>
          Number(lote.preco || 0)
        )
    );

    if (precos.length === 0) return 0;

    return Math.min(...precos);
  }, [dados]);

  const precoMaximo = useMemo(() => {
    if (!dados) return 0;

    const precos = dados.performance_tipos.flatMap(
      (tipo) =>
        tipo.lotes.map((lote) =>
          Number(lote.preco || 0)
        )
    );

    if (precos.length === 0) return 0;

    return Math.max(...precos);
  }, [dados]);

  // LOADING

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />

          <p className="mt-4 font-semibold text-slate-600">
            Carregando ingressos...
          </p>
        </div>
      </main>
    );
  }

  // ERRO

  if (erro || !dados) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">⚠️</div>

          <h1 className="mt-4 text-2xl font-black text-slate-900">
            Ingressos indisponíveis
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            {erro}
          </p>

          <Link
            href={`/admin/tiketeira/eventos/${eventoId}`}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl bg-violet-700 px-6 py-3 font-bold text-white"
          >
            Voltar ao evento
          </Link>
        </div>
      </main>
    );
  }

  const {
    evento,
    resumo,
    performance_tipos,
  } = dados;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* TOPO */}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50">
              <img
                src="/logo.png"
                alt="Brava"
                className="h-10 w-10 object-contain"
              />
            </div>

            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-violet-600">
                Brava Tiketeira
              </p>

              <h1 className="text-lg font-black text-slate-950">
                Ingressos & Lotes
              </h1>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/admin/tiketeira/eventos/${evento.id}`}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600"
            >
              ← Evento
            </Link>

            <Link
              href="/admin/tiketeira/eventos"
              className="hidden min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 sm:inline-flex"
            >
              Eventos
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        {/* CABEÇALHO */}

        <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-violet-700">
                Evento #{evento.id}
              </span>

              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-amber-700">
                Homologação
              </span>
            </div>

            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Ingressos & Lotes
            </h2>

            <p className="mt-2 text-sm text-slate-500 sm:text-base">
              {evento.nome}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setMostrarNovoTipo(true);
              setMensagemOperacao("");
              setMensagemSucesso("");
            }}
            disabled={mostrarNovoTipo}
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-violet-700 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Novo tipo de ingresso
          </button>
        </section>

        {/* NAVEGAÇÃO */}

        <section className="mt-6 flex gap-2 overflow-x-auto pb-1">
          <Link
            href={`/admin/tiketeira/eventos/${evento.id}`}
            className="whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600"
          >
            Visão Geral
          </Link>

          <Link
            href={`/admin/tiketeira/eventos/${evento.id}/pedidos`}
            className="whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600"
          >
            Pedidos
          </Link>

          <span className="whitespace-nowrap rounded-2xl bg-violet-700 px-5 py-3 text-sm font-extrabold text-white">
            Ingressos & Lotes
          </span>

          <span className="whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-400">
            Financeiro
          </span>
        </section>

        {/* MENSAGENS */}

        {mensagemSucesso ? (
          <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="font-extrabold text-emerald-900">
              ✓ {mensagemSucesso}
            </p>
          </section>
        ) : null}

        {mensagemOperacao ? (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
            <p className="font-extrabold text-red-800">
              {mensagemOperacao}
            </p>
          </section>
        ) : null}

        {/* NOVO TIPO */}

        {mostrarNovoTipo ? (
          <section className="mt-6 overflow-hidden rounded-[2rem] border border-violet-200 bg-white shadow-sm">
            <div className="border-b border-violet-100 bg-violet-50 px-6 py-5 sm:px-8">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-violet-600">
                Novo ingresso
              </p>

              <h3 className="mt-1 text-xl font-black text-slate-950">
                Criar tipo de ingresso
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Primeiro criamos o setor ou categoria.
                Depois adicionamos os lotes e preços.
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <label
                    htmlFor="nome-novo-tipo"
                    className="mb-2 block text-sm font-extrabold text-slate-700"
                  >
                    Nome do ingresso *
                  </label>

                  <input
                    id="nome-novo-tipo"
                    type="text"
                    value={nomeNovoTipo}
                    onChange={(event) =>
                      setNomeNovoTipo(
                        event.target.value
                      )
                    }
                    disabled={salvandoTipo}
                    placeholder="Ex.: Pista, Área VIP, Camarote"
                    maxLength={120}
                    className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="descricao-novo-tipo"
                    className="mb-2 block text-sm font-extrabold text-slate-700"
                  >
                    Descrição
                  </label>

                  <input
                    id="descricao-novo-tipo"
                    type="text"
                    value={descricaoNovoTipo}
                    onChange={(event) =>
                      setDescricaoNovoTipo(
                        event.target.value
                      )
                    }
                    disabled={salvandoTipo}
                    placeholder="Ex.: Acesso à área de pista do evento"
                    maxLength={250}
                    className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={cancelarNovoTipo}
                  disabled={salvandoTipo}
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-extrabold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={criarTipoIngresso}
                  disabled={
                    salvandoTipo ||
                    !nomeNovoTipo.trim()
                  }
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-violet-700 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {salvandoTipo
                    ? "Criando ingresso..."
                    : "Criar ingresso"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {/* KPIs */}

        <section className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
              Tipos de ingresso
            </p>

            <p className="mt-2 text-3xl font-black text-violet-700">
              {totalTipos}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
              Lotes
            </p>

            <p className="mt-2 text-3xl font-black">
              {totalLotes}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
              Capacidade
            </p>

            <p className="mt-2 text-3xl font-black">
              {resumo.capacidade_total}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              {resumo.disponiveis} disponíveis
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
              Faixa de preço
            </p>

            <p className="mt-2 text-xl font-black text-emerald-700">
              {formatarMoeda(precoMinimo)}
            </p>

            <p className="mt-1 text-xs text-slate-400">
              até {formatarMoeda(precoMaximo)}
            </p>
          </article>
        </section>

        {/* AVISO */}

        <section className="mt-6 rounded-2xl border border-violet-100 bg-violet-50 px-5 py-4">
          <div className="flex gap-3">
            <span className="text-xl">🎟️</span>

            <div>
              <p className="font-extrabold text-violet-900">
                Estrutura comercial do evento
              </p>

              <p className="mt-1 text-sm leading-6 text-violet-700">
                Aqui você acompanha os setores e lotes
                cadastrados, preços, capacidade, vendas
                confirmadas e pedidos aguardando pagamento.
              </p>
            </div>
          </div>
        </section>

        {/* TIPOS */}

        <section className="mt-6 space-y-5">
          {performance_tipos.length === 0 ? (
            <div className="rounded-[2rem] border border-slate-200 bg-white p-12 text-center shadow-sm">
              <div className="text-4xl">🎫</div>

              <h3 className="mt-4 text-xl font-black">
                Nenhum ingresso cadastrado
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Este evento ainda não possui tipos de
                ingresso.
              </p>

              <button
                type="button"
                onClick={() =>
                  setMostrarNovoTipo(true)
                }
                className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-violet-700 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-violet-600"
              >
                + Criar primeiro ingresso
              </button>
            </div>
          ) : (
            performance_tipos.map((tipo) => {
              const percentual =
                tipo.capacidade > 0
                  ? Math.min(
                      (tipo.vendidos /
                        tipo.capacidade) *
                        100,
                      100
                    )
                  : 0;

              return (
                <article
                  key={tipo.tipo_ingresso_id}
                  className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm"
                >
                  {/* CABEÇALHO TIPO */}

                  <div className="border-b border-slate-100 p-6 sm:p-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-extrabold text-violet-700">
                            Ingresso #
                            {tipo.tipo_ingresso_id}
                          </span>

                          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
                            {tipo.lotes.length} lote(s)
                          </span>
                        </div>

                        <h3 className="mt-4 text-2xl font-black">
                          {tipo.nome}
                        </h3>

                        {tipo.descricao ? (
                          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                            {tipo.descricao}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                          <span
                            className={`inline-flex min-h-10 items-center rounded-xl px-4 py-2 text-xs font-extrabold ${
                              tipo.ativo
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {tipo.ativo ? "Ativo" : "Inativo"}
                          </span>

                          <button
                            type="button"
                            onClick={() => abrirEdicaoTipo(tipo)}
                            disabled={
                              tipoEditando !== null ||
                              salvandoEdicaoTipo ||
                              alterandoStatusTipo !== null
                            }
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            onClick={() => alterarStatusTipo(tipo)}
                            disabled={
                              salvandoEdicaoTipo ||
                              alterandoStatusTipo !== null
                            }
                            className={`inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              tipo.ativo
                                ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                : "bg-emerald-600 text-white hover:bg-emerald-500"
                            }`}
                          >
                            {alterandoStatusTipo === tipo.tipo_ingresso_id
                              ? "Alterando..."
                              : tipo.ativo
                                ? "Desativar"
                                : "Ativar"}
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-center">
                          <p className="text-xs font-bold text-emerald-700">
                            Vendidos
                          </p>

                          <p className="mt-1 text-xl font-black text-emerald-900">
                            {tipo.vendidos}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-center">
                          <p className="text-xs font-bold text-amber-700">
                            Pendentes
                          </p>

                          <p className="mt-1 text-xl font-black text-amber-900">
                            {tipo.pendentes}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-violet-50 px-4 py-3 text-center">
                          <p className="text-xs font-bold text-violet-700">
                            Disponíveis
                          </p>

                          <p className="mt-1 text-xl font-black text-violet-900">
                            {tipo.disponiveis}
                          </p>
                        </div>
                        </div>
                      </div>
                    </div>

                    {tipoEditando === tipo.tipo_ingresso_id ? (
                      <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
                        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-violet-600">
                          Editar ingresso
                        </p>

                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-xs font-extrabold text-slate-600">
                              Nome do ingresso *
                            </label>
                            <input
                              type="text"
                              value={nomeTipoEditando}
                              onChange={(event) =>
                                setNomeTipoEditando(event.target.value)
                              }
                              disabled={salvandoEdicaoTipo}
                              maxLength={120}
                              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-extrabold text-slate-600">
                              Descrição
                            </label>
                            <input
                              type="text"
                              value={descricaoTipoEditando}
                              onChange={(event) =>
                                setDescricaoTipoEditando(event.target.value)
                              }
                              disabled={salvandoEdicaoTipo}
                              maxLength={250}
                              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50"
                            />
                          </div>
                        </div>

                        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                          <button
                            type="button"
                            onClick={cancelarEdicaoTipo}
                            disabled={salvandoEdicaoTipo}
                            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-extrabold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            Cancelar
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              salvarEdicaoTipo(tipo.tipo_ingresso_id)
                            }
                            disabled={
                              salvandoEdicaoTipo || !nomeTipoEditando.trim()
                            }
                            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-700 px-5 text-sm font-extrabold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {salvandoEdicaoTipo
                              ? "Salvando..."
                              : "Salvar alterações"}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-6">
                      <div className="mb-2 flex items-center justify-between gap-4 text-xs">
                        <span className="font-bold text-slate-500">
                          Ocupação confirmada
                        </span>

                        <span className="font-black text-violet-700">
                          {percentual.toFixed(1)}%
                        </span>
                      </div>

                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-violet-600"
                          style={{
                            width: `${percentual}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* LOTES */}

                  <div className="p-6 sm:p-8">
                    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">
                          Lotes
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          Configuração comercial deste
                          ingresso
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500">
                          Capacidade {tipo.capacidade}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            abrirNovoLote(
                              tipo.tipo_ingresso_id
                            )
                          }
                          disabled={
                            tipoNovoLote !== null ||
                            salvandoLote
                          }
                          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-violet-700 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          + Novo lote
                        </button>
                      </div>
                    </div>

                    {/* FORMULÁRIO NOVO LOTE */}

                    {tipoNovoLote ===
                    tipo.tipo_ingresso_id ? (
                      <div className="mb-5 rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
                        <div>
                          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-violet-600">
                            Novo lote
                          </p>

                          <h4 className="mt-1 text-lg font-black text-slate-900">
                            {tipo.nome}
                          </h4>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <div>
                            <label className="mb-2 block text-xs font-extrabold text-slate-600">
                              Nome do lote *
                            </label>

                            <input
                              type="text"
                              value={nomeNovoLote}
                              onChange={(event) =>
                                setNomeNovoLote(
                                  event.target.value
                                )
                              }
                              disabled={salvandoLote}
                              placeholder="Ex.: 1º Lote"
                              maxLength={120}
                              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-extrabold text-slate-600">
                              Preço *
                            </label>

                            <input
                              type="text"
                              inputMode="decimal"
                              value={precoNovoLote}
                              onChange={(event) =>
                                setPrecoNovoLote(
                                  event.target.value
                                )
                              }
                              disabled={salvandoLote}
                              placeholder="Ex.: 25,00"
                              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-extrabold text-slate-600">
                              Quantidade *
                            </label>

                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={
                                quantidadeNovoLote
                              }
                              onChange={(event) =>
                                setQuantidadeNovoLote(
                                  event.target.value
                                )
                              }
                              disabled={salvandoLote}
                              placeholder="Ex.: 50"
                              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-extrabold text-slate-600">
                              Início das vendas
                            </label>

                            <input
                              type="datetime-local"
                              value={inicioNovoLote}
                              onChange={(event) =>
                                setInicioNovoLote(
                                  event.target.value
                                )
                              }
                              disabled={salvandoLote}
                              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-extrabold text-slate-600">
                              Fim das vendas
                            </label>

                            <input
                              type="datetime-local"
                              value={fimNovoLote}
                              onChange={(event) =>
                                setFimNovoLote(
                                  event.target.value
                                )
                              }
                              disabled={salvandoLote}
                              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50"
                            />
                          </div>
                        </div>

                        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                          <button
                            type="button"
                            onClick={
                              cancelarNovoLote
                            }
                            disabled={salvandoLote}
                            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-extrabold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            Cancelar
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              criarLote(
                                tipo.tipo_ingresso_id
                              )
                            }
                            disabled={
                              salvandoLote ||
                              !nomeNovoLote.trim() ||
                              !precoNovoLote.trim() ||
                              !quantidadeNovoLote.trim()
                            }
                            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-700 px-5 text-sm font-extrabold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {salvandoLote
                              ? "Criando lote..."
                              : "Criar lote"}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {/* LISTAGEM DOS LOTES */}

                    {tipo.lotes.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                        <p className="font-extrabold text-slate-700">
                          Nenhum lote cadastrado
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          Crie o primeiro lote para definir
                          preço e capacidade deste ingresso.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-4 xl:grid-cols-2">
                        {tipo.lotes.map((lote) => {
                          const percentualLote =
                            lote.capacidade > 0
                              ? Math.min(
                                  (lote.vendidos /
                                    lote.capacidade) *
                                    100,
                                  100
                                )
                              : 0;

                          return (
                            <div
                              key={lote.lote_id}
                              className="rounded-2xl border border-slate-200 p-5"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="font-black text-slate-900">
                                      {lote.nome}
                                    </h4>

                                    <span
                                      className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                                        lote.ativo
                                          ? "bg-emerald-50 text-emerald-700"
                                          : "bg-slate-100 text-slate-500"
                                      }`}
                                    >
                                      {lote.ativo
                                        ? "Ativo"
                                        : "Inativo"}
                                    </span>
                                  </div>

                                  <p className="mt-2 text-2xl font-black text-violet-700">
                                    {formatarMoeda(
                                      lote.preco
                                    )}
                                  </p>
                                </div>

                                <div className="flex flex-col items-end gap-3">
                                  <div className="text-right">
                                    <p className="text-xs font-bold text-slate-400">
                                      Capacidade
                                    </p>

                                    <p className="mt-1 text-xl font-black">
                                      {lote.capacidade}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => abrirEdicaoLote(lote)}
                                      disabled={
                                        loteEditando !== null ||
                                        salvandoEdicaoLote ||
                                        alterandoStatusLote !== null
                                      }
                                      className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Editar
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => alterarStatusLote(lote)}
                                      disabled={
                                        salvandoEdicaoLote ||
                                        alterandoStatusLote !== null
                                      }
                                      className={`inline-flex min-h-9 items-center justify-center rounded-xl px-3 py-2 text-[11px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                        lote.ativo
                                          ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                          : "bg-emerald-600 text-white hover:bg-emerald-500"
                                      }`}
                                    >
                                      {alterandoStatusLote === lote.lote_id
                                        ? "Alterando..."
                                        : lote.ativo
                                          ? "Desativar"
                                          : "Ativar"}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {loteEditando === lote.lote_id ? (
                                <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
                                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-violet-600">
                                    Editar lote
                                  </p>

                                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                                    <div>
                                      <label className="mb-2 block text-xs font-extrabold text-slate-600">
                                        Nome do lote *
                                      </label>
                                      <input
                                        type="text"
                                        value={nomeLoteEditando}
                                        onChange={(event) =>
                                          setNomeLoteEditando(event.target.value)
                                        }
                                        disabled={salvandoEdicaoLote}
                                        maxLength={120}
                                        className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-xs font-extrabold text-slate-600">
                                        Preço *
                                      </label>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={precoLoteEditando}
                                        onChange={(event) =>
                                          setPrecoLoteEditando(event.target.value)
                                        }
                                        disabled={salvandoEdicaoLote}
                                        className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-xs font-extrabold text-slate-600">
                                        Quantidade *
                                      </label>
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={quantidadeLoteEditando}
                                        onChange={(event) =>
                                          setQuantidadeLoteEditando(event.target.value)
                                        }
                                        disabled={salvandoEdicaoLote}
                                        className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-xs font-extrabold text-slate-600">
                                        Início das vendas
                                      </label>
                                      <input
                                        type="datetime-local"
                                        value={inicioLoteEditando}
                                        onChange={(event) =>
                                          setInicioLoteEditando(event.target.value)
                                        }
                                        disabled={salvandoEdicaoLote}
                                        className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50"
                                      />
                                    </div>

                                    <div>
                                      <label className="mb-2 block text-xs font-extrabold text-slate-600">
                                        Fim das vendas
                                      </label>
                                      <input
                                        type="datetime-local"
                                        value={fimLoteEditando}
                                        onChange={(event) =>
                                          setFimLoteEditando(event.target.value)
                                        }
                                        disabled={salvandoEdicaoLote}
                                        className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50"
                                      />
                                    </div>
                                  </div>

                                  <p className="mt-3 text-xs leading-5 text-slate-500">
                                    Datas são opcionais. Se ficarem vazias ao salvar,
                                    o lote ficará sem restrição de início/fim de vendas.
                                  </p>

                                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                    <button
                                      type="button"
                                      onClick={cancelarEdicaoLote}
                                      disabled={salvandoEdicaoLote}
                                      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                                    >
                                      Cancelar
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => salvarEdicaoLote(lote.lote_id)}
                                      disabled={
                                        salvandoEdicaoLote ||
                                        !nomeLoteEditando.trim() ||
                                        !precoLoteEditando.trim() ||
                                        !quantidadeLoteEditando.trim()
                                      }
                                      className="inline-flex min-h-10 items-center justify-center rounded-xl bg-violet-700 px-4 text-xs font-extrabold text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {salvandoEdicaoLote
                                        ? "Salvando..."
                                        : "Salvar alterações"}
                                    </button>
                                  </div>
                                </div>
                              ) : null}

                              <div className="mt-5 grid grid-cols-3 gap-2">
                                <div className="rounded-xl bg-emerald-50 p-3">
                                  <p className="text-[11px] font-bold text-emerald-700">
                                    Vendidos
                                  </p>

                                  <p className="mt-1 text-lg font-black text-emerald-900">
                                    {lote.vendidos}
                                  </p>
                                </div>

                                <div className="rounded-xl bg-amber-50 p-3">
                                  <p className="text-[11px] font-bold text-amber-700">
                                    Pendentes
                                  </p>

                                  <p className="mt-1 text-lg font-black text-amber-900">
                                    {lote.pendentes}
                                  </p>
                                </div>

                                <div className="rounded-xl bg-violet-50 p-3">
                                  <p className="text-[11px] font-bold text-violet-700">
                                    Disponíveis
                                  </p>

                                  <p className="mt-1 text-lg font-black text-violet-900">
                                    {lote.disponiveis}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-5">
                                <div className="mb-2 flex justify-between text-xs">
                                  <span className="font-semibold text-slate-400">
                                    Ocupação
                                  </span>

                                  <span className="font-black text-slate-600">
                                    {percentualLote.toFixed(
                                      1
                                    )}
                                    %
                                  </span>
                                </div>

                                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full bg-violet-600"
                                    style={{
                                      width: `${percentualLote}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="mt-5 border-t border-slate-100 pt-4">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-xs font-semibold text-slate-400">
                                    Receita confirmada
                                  </span>

                                  <span className="font-black text-emerald-700">
                                    {formatarMoeda(
                                      lote.receita
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>

        <footer className="mt-10 border-t border-slate-200 py-6 text-center text-xs text-slate-400">
          Brava Entretenimento • Tiketeira • Evento #
          {evento.id}
        </footer>
      </div>
    </main>
  );
}