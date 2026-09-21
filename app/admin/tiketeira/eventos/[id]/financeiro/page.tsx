"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Evento = {
  id: number;
  nome: string;
  slug: string | null;
  data_evento: string | null;
  hora_evento: string | null;
  local_evento: string | null;
  inicio_evento: string | null;
  ativo: boolean;
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
  ativo?: boolean;
  capacidade: number;
  vendidos: number;
  pendentes: number;
  disponiveis: number;
  receita: number;
  percentual_vendido: number;
  lotes: LotePerformance[];
};

type FormaPagamento = {
  forma: string;
  pedidos: number;
  receita: number;
};

type Dashboard = {
  evento: Evento;
  resumo: Resumo;
  performance_tipos: TipoPerformance[];
  formas_pagamento: FormaPagamento[];
};

function formatarMoeda(valor: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor || 0));
}

function pagamentoAmigavel(valor: string | null | undefined) {
  const forma = (valor || "").trim().toLowerCase();

  if (forma === "pix") return "PIX";

  if (
    ["cartao", "cartão", "credit_card", "credit card"].includes(forma)
  ) {
    return "Cartão";
  }

  if (forma === "não informado") return "Não informado";

  return valor || "Não informado";
}

export default function FinanceiroEventoTiketeiraPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventoId = Number(params.id);

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregar() {
      if (eventoId !== 28) {
        setErro("Este evento ainda não está habilitado para a Tiketeira.");
        setLoading(false);
        return;
      }

      const {
        data: { session },
        error: erroSessao,
      } = await supabase.auth.getSession();

      if (erroSessao || !session?.user) {
        router.replace("/login");
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
        const resposta = await fetch("/api/admin/tiketeira/dashboard", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });

        const json = await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            json?.error || "Não foi possível carregar o financeiro."
          );
        }

        const dados = json as Dashboard;

        if (dados.evento.id !== eventoId) {
          throw new Error(
            "O evento retornado não corresponde ao evento solicitado."
          );
        }

        setDashboard(dados);
      } catch (error) {
        setErro(
          error instanceof Error
            ? error.message
            : "Erro inesperado ao carregar o financeiro."
        );
      } finally {
        setLoading(false);
      }
    }

    void carregar();
  }, [eventoId, router]);

  const receitaPotencial = useMemo(() => {
    if (!dashboard) return 0;

    return (
      Number(dashboard.resumo.receita_confirmada || 0) +
      Number(dashboard.resumo.receita_pendente || 0)
    );
  }, [dashboard]);

  const taxaConversao = useMemo(() => {
    if (!dashboard || dashboard.resumo.pedidos_total <= 0) {
      return 0;
    }

    return (
      (dashboard.resumo.pedidos_pagos /
        dashboard.resumo.pedidos_total) *
      100
    );
  }, [dashboard]);

  const receitaTiposTotal = useMemo(() => {
    if (!dashboard) return 0;

    return dashboard.performance_tipos.reduce(
      (total, tipo) => total + Number(tipo.receita || 0),
      0
    );
  }, [dashboard]);

  const formasPagamentoOrdenadas = useMemo(() => {
    if (!dashboard) return [];

    return [...dashboard.formas_pagamento].sort(
      (a, b) => Number(b.receita || 0) - Number(a.receita || 0)
    );
  }, [dashboard]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />
          <p className="mt-4 font-semibold text-slate-600">
            Carregando financeiro...
          </p>
        </div>
      </main>
    );
  }

  if (erro || !dashboard) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">⚠️</div>
          <h1 className="mt-4 text-2xl font-black text-slate-900">
            Financeiro indisponível
          </h1>
          <p className="mt-3 text-sm text-slate-500">{erro}</p>
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

  const { evento, resumo, performance_tipos } = dashboard;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
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
                Financeiro
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
              Financeiro
            </h2>

            <p className="mt-2 text-sm text-slate-500 sm:text-base">
              {evento.nome}
            </p>
          </div>

          <div className="rounded-2xl border border-violet-100 bg-violet-50 px-5 py-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-violet-600">
              Receita potencial
            </p>
            <p className="mt-1 text-2xl font-black text-violet-900">
              {formatarMoeda(receitaPotencial)}
            </p>
          </div>
        </section>

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

          <Link
            href={`/admin/tiketeira/eventos/${evento.id}/ingressos`}
            className="whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600"
          >
            Ingressos & Lotes
          </Link>

          <span className="whitespace-nowrap rounded-2xl bg-violet-700 px-5 py-3 text-sm font-extrabold text-white">
            Financeiro
          </span>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.75rem] border border-emerald-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Receita confirmada
            </p>
            <p className="mt-3 text-3xl font-black text-emerald-700">
              {formatarMoeda(resumo.receita_confirmada)}
            </p>
            <p className="mt-3 text-xs text-slate-400">
              {resumo.pedidos_pagos} pedido(s) pago(s)
            </p>
          </article>

          <article className="rounded-[1.75rem] border border-amber-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Receita pendente
            </p>
            <p className="mt-3 text-3xl font-black text-amber-600">
              {formatarMoeda(resumo.receita_pendente)}
            </p>
            <p className="mt-3 text-xs text-slate-400">
              {resumo.pedidos_pendentes} pedido(s) aguardando pagamento
            </p>
          </article>

          <article className="rounded-[1.75rem] border border-violet-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Receita potencial
            </p>
            <p className="mt-3 text-3xl font-black text-violet-700">
              {formatarMoeda(receitaPotencial)}
            </p>
            <p className="mt-3 text-xs text-slate-400">
              Confirmada + pendente
            </p>
          </article>

          <article className="rounded-[1.75rem] border border-blue-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Ticket médio
            </p>
            <p className="mt-3 text-3xl font-black text-blue-700">
              {formatarMoeda(resumo.ticket_medio)}
            </p>
            <p className="mt-3 text-xs text-slate-400">
              Média dos pedidos pagos
            </p>
          </article>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
          <article className="rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-300">
              Conversão financeira
            </p>

            <div className="mt-5">
              <p className="text-5xl font-black">
                {taxaConversao.toFixed(1)}%
              </p>
              <p className="mt-2 text-sm text-slate-400">
                dos pedidos registrados estão pagos
              </p>
            </div>

            <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${Math.min(taxaConversao, 100)}%` }}
              />
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs text-slate-400">Total</p>
                <p className="mt-1 text-2xl font-black">
                  {resumo.pedidos_total}
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-500/10 p-4">
                <p className="text-xs text-emerald-300">Pagos</p>
                <p className="mt-1 text-2xl font-black">
                  {resumo.pedidos_pagos}
                </p>
              </div>

              <div className="rounded-2xl bg-amber-500/10 p-4">
                <p className="text-xs text-amber-300">Pendentes</p>
                <p className="mt-1 text-2xl font-black">
                  {resumo.pedidos_pendentes}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-400">
                  Ingressos pagos
                </span>
                <span className="font-black">
                  {resumo.ingressos_vendidos}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-sm text-slate-400">
                  Aguardando pagamento
                </span>
                <span className="font-black text-amber-300">
                  {resumo.ingressos_pendentes}
                </span>
              </div>
            </div>
          </article>

          <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600">
              Receita
            </p>
            <h3 className="mt-2 text-2xl font-black">
              Receita por ingresso
            </h3>

            {performance_tipos.length === 0 ? (
              <div className="mt-6 rounded-2xl bg-slate-50 p-10 text-center text-sm text-slate-500">
                Nenhum ingresso cadastrado.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {performance_tipos.map((tipo) => {
                  const participacao =
                    receitaTiposTotal > 0
                      ? (Number(tipo.receita || 0) /
                          receitaTiposTotal) *
                        100
                      : 0;

                  return (
                    <div
                      key={tipo.tipo_ingresso_id}
                      className="rounded-2xl border border-slate-200 p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-black text-slate-900">
                              {tipo.nome}
                            </h4>
                            {typeof tipo.ativo === "boolean" ? (
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                                  tipo.ativo
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {tipo.ativo ? "Ativo" : "Inativo"}
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-1 text-xs text-slate-400">
                            {tipo.vendidos} vendido(s) • {tipo.pendentes} pendente(s)
                          </p>
                        </div>

                        <div className="sm:text-right">
                          <p className="text-xl font-black text-emerald-700">
                            {formatarMoeda(tipo.receita)}
                          </p>
                          <p className="text-xs text-slate-400">
                            {participacao.toFixed(1)}% da receita confirmada
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{
                            width: `${Math.min(participacao, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </section>

        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600">
                Comercial
              </p>
              <h3 className="mt-2 text-2xl font-black">
                Resultado por lote
              </h3>
            </div>

            <p className="text-sm text-slate-400">
              Valores confirmados em pedidos pagos
            </p>
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[950px] text-left">
              <thead className="bg-slate-50 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                <tr>
                  <th className="px-5 py-4">Ingresso</th>
                  <th className="px-5 py-4">Lote</th>
                  <th className="px-5 py-4">Preço</th>
                  <th className="px-5 py-4">Capacidade</th>
                  <th className="px-5 py-4">Vendidos</th>
                  <th className="px-5 py-4">Pendentes</th>
                  <th className="px-5 py-4">Disponíveis</th>
                  <th className="px-5 py-4">Receita</th>
                  <th className="px-5 py-4">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {performance_tipos.flatMap((tipo) =>
                  tipo.lotes.map((lote) => (
                    <tr key={`${tipo.tipo_ingresso_id}-${lote.lote_id}`}>
                      <td className="px-5 py-4 font-bold">
                        {tipo.nome}
                      </td>
                      <td className="px-5 py-4 font-black">
                        {lote.nome}
                      </td>
                      <td className="px-5 py-4">
                        {formatarMoeda(lote.preco)}
                      </td>
                      <td className="px-5 py-4">
                        {lote.capacidade}
                      </td>
                      <td className="px-5 py-4 font-bold text-emerald-700">
                        {lote.vendidos}
                      </td>
                      <td className="px-5 py-4 font-bold text-amber-600">
                        {lote.pendentes}
                      </td>
                      <td className="px-5 py-4">
                        {lote.disponiveis}
                      </td>
                      <td className="px-5 py-4 font-black text-emerald-700">
                        {formatarMoeda(lote.receita)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-extrabold ${
                            lote.ativo
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {lote.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600">
              Pagamentos
            </p>
            <h3 className="mt-2 text-2xl font-black">
              Formas de pagamento
            </h3>

            {formasPagamentoOrdenadas.length === 0 ? (
              <div className="mt-6 rounded-2xl bg-slate-50 p-10 text-center">
                <p className="font-extrabold text-slate-700">
                  Nenhum pagamento confirmado
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  As formas de pagamento aparecerão aqui após a confirmação dos pedidos.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {formasPagamentoOrdenadas.map((forma) => {
                  const participacao =
                    resumo.receita_confirmada > 0
                      ? (Number(forma.receita || 0) /
                          resumo.receita_confirmada) *
                        100
                      : 0;

                  return (
                    <div
                      key={forma.forma}
                      className="rounded-2xl border border-slate-200 p-5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-black">
                            {pagamentoAmigavel(forma.forma)}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {forma.pedidos} pedido(s) pago(s)
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-black text-emerald-700">
                            {formatarMoeda(forma.receita)}
                          </p>
                          <p className="text-xs text-slate-400">
                            {participacao.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-violet-600"
                          style={{
                            width: `${Math.min(participacao, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>

          <article className="rounded-[2rem] border border-violet-100 bg-gradient-to-br from-violet-700 to-slate-950 p-6 text-white shadow-sm sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-200">
              Resumo financeiro
            </p>
            <h3 className="mt-2 text-2xl font-black">
              Situação atual
            </h3>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
                <p className="text-xs text-violet-200">
                  Confirmado
                </p>
                <p className="mt-1 text-3xl font-black">
                  {formatarMoeda(resumo.receita_confirmada)}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
                <p className="text-xs text-violet-200">
                  Aguardando pagamento
                </p>
                <p className="mt-1 text-3xl font-black">
                  {formatarMoeda(resumo.receita_pendente)}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
                <p className="text-xs text-violet-200">
                  Potencial atual
                </p>
                <p className="mt-1 text-3xl font-black">
                  {formatarMoeda(receitaPotencial)}
                </p>
              </div>
            </div>

            <p className="mt-5 text-xs leading-5 text-violet-200">
              Receita confirmada considera somente pedidos com status de pagamento aprovado.
              Pedidos pendentes são apresentados separadamente.
            </p>
          </article>
        </section>

        <footer className="mt-10 border-t border-slate-200 py-6 text-center text-xs text-slate-400">
          Brava Entretenimento • Tiketeira • Financeiro • Evento #{evento.id}
        </footer>
      </div>
    </main>
  );
}
