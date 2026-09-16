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

type Pedido = {
  id: number;
  codigo: string;
  comprador_nome: string;
  comprador_email: string;
  quantidade: number;
  total: number;
  status: string;
  forma_pagamento: string | null;
  pago_em: string | null;
  created_at: string;
};

type Dashboard = {
  evento: Evento;
  resumo: Resumo;
  performance_tipos: TipoPerformance[];
  formas_pagamento: FormaPagamento[];
  ultimos_pedidos: Pedido[];
};

function formatarMoeda(valor: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor || 0));
}

function formatarData(evento: Evento) {
  if (evento.inicio_evento) {
    const data = new Date(evento.inicio_evento);

    if (!Number.isNaN(data.getTime())) {
      return data.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    }
  }

  return evento.data_evento || "Data a definir";
}

function formatarDataHora(valor: string | null | undefined) {
  if (!valor) return "—";

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return valor;
  }

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusPago(status: string | null | undefined) {
  return ["pago", "paid", "aprovado", "approved"].includes(
    (status || "").trim().toLowerCase()
  );
}

function statusAmigavel(status: string | null | undefined) {
  const valor = (status || "").trim().toLowerCase();

  if (["pago", "paid", "aprovado", "approved"].includes(valor)) {
    return "Pago";
  }

  if (
    [
      "pendente",
      "pending",
      "aguardando_pagamento",
      "aguardando pagamento",
    ].includes(valor)
  ) {
    return "Pendente";
  }

  if (["cancelado", "cancelled", "canceled"].includes(valor)) {
    return "Cancelado";
  }

  if (["expirado", "expired"].includes(valor)) {
    return "Expirado";
  }

  return status || "Não informado";
}

function classeStatus(status: string | null | undefined) {
  if (statusPago(status)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  const valor = (status || "").trim().toLowerCase();

  if (
    [
      "pendente",
      "pending",
      "aguardando_pagamento",
      "aguardando pagamento",
    ].includes(valor)
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function pagamentoAmigavel(valor: string | null | undefined) {
  const forma = (valor || "").trim().toLowerCase();

  if (forma === "pix") return "PIX";

  if (
    ["cartao", "cartão", "credit_card", "credit card"].includes(forma)
  ) {
    return "Cartão";
  }

  return valor || "Não informado";
}

export default function EventoTiketeiraPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const eventoId = Number(params.id);

  useEffect(() => {
    async function carregar() {
      /*
       * PROTEÇÃO DE HOMOLOGAÇÃO
       *
       * Neste momento o dashboard individual da Tiketeira
       * só pode abrir o evento #28.
       */
      if (eventoId !== 28) {
        setErro(
          "Este evento ainda não está habilitado para a Tiketeira."
        );
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
            json?.error || "Não foi possível carregar o evento."
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
            : "Erro inesperado ao carregar o evento."
        );
      } finally {
        setLoading(false);
      }
    }

    void carregar();
  }, [eventoId, router]);

  const ocupacao = useMemo(() => {
    if (!dashboard || dashboard.resumo.capacidade_total <= 0) {
      return 0;
    }

    return Math.min(
      (dashboard.resumo.ingressos_vendidos /
        dashboard.resumo.capacidade_total) *
        100,
      100
    );
  }, [dashboard]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />

          <p className="mt-4 font-semibold text-slate-600">
            Carregando evento...
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
            Evento indisponível
          </h1>

          <p className="mt-3 text-sm text-slate-500">{erro}</p>

          <Link
            href="/admin/tiketeira/eventos"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl bg-violet-700 px-6 py-3 font-bold text-white"
          >
            Voltar aos eventos
          </Link>
        </div>
      </main>
    );
  }

  const { evento, resumo } = dashboard;

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
                Dashboard do Evento
              </h1>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href="/admin/tiketeira/eventos"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600"
            >
              ← Eventos
            </Link>

            <Link
              href="/admin/tiketeira"
              className="hidden min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 sm:inline-flex"
            >
              Dashboard Geral
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        {/* EVENTO */}

        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-violet-950 to-violet-700 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em]">
                  Evento #{evento.id}
                </span>

                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em]">
                  Homologação
                </span>
              </div>

              <h2 className="mt-5 text-3xl font-black sm:text-4xl">
                {evento.nome}
              </h2>

              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-violet-100">
                <span>📅 {formatarData(evento)}</span>
                <span>🕙 {evento.hora_evento || "A definir"}</span>
                <span>📍 {evento.local_evento || "A definir"}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-200">
                Capacidade
              </p>

              <p className="mt-1 text-4xl font-black">
                {resumo.capacidade_total}
              </p>

              <p className="mt-1 text-xs text-violet-200">
                ingressos cadastrados
              </p>
            </div>
          </div>
        </section>

        {/* NAVEGAÇÃO DO EVENTO */}

        <section className="mt-5 flex gap-2 overflow-x-auto pb-1">
          <button className="whitespace-nowrap rounded-2xl bg-violet-700 px-5 py-3 text-sm font-extrabold text-white">
            Visão Geral
          </button>

          <Link
            href={`/admin/tiketeira/eventos/${evento.id}/pedidos`}
            className="whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
          >
            Pedidos
          </Link>

          <Link
            href={`/admin/tiketeira/eventos/${evento.id}/ingressos`}
            className="whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
          >
            Ingressos & Lotes
          </Link>

          <button
            disabled
            className="whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-400"
          >
            Financeiro
          </button>
        </section>

        {/* KPIS */}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
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

          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Receita pendente
            </p>

            <p className="mt-3 text-3xl font-black text-amber-600">
              {formatarMoeda(resumo.receita_pendente)}
            </p>

            <p className="mt-3 text-xs text-slate-400">
              {resumo.pedidos_pendentes} pedido(s) pendente(s)
            </p>
          </article>

          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Ingressos vendidos
            </p>

            <p className="mt-3 text-3xl font-black text-violet-700">
              {resumo.ingressos_vendidos}
            </p>

            <p className="mt-3 text-xs text-slate-400">
              {resumo.ingressos_pendentes} aguardando pagamento
            </p>
          </article>

          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
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

        {/* INGRESSOS */}

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
          <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600">
              Ingressos
            </p>

            <h3 className="mt-2 text-2xl font-black">
              Performance por setor
            </h3>

            <div className="mt-6 space-y-4">
              {dashboard.performance_tipos.map((tipo) => (
                <div
                  key={tipo.tipo_ingresso_id}
                  className="rounded-2xl border border-slate-200 p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <div>
                      <h4 className="text-lg font-black">{tipo.nome}</h4>

                      <p className="mt-1 text-xs text-slate-500">
                        {tipo.vendidos} vendidos • {tipo.pendentes} pendentes •{" "}
                        {tipo.disponiveis} disponíveis
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <p className="font-black text-violet-700">
                        {formatarMoeda(tipo.receita)}
                      </p>

                      <p className="text-xs text-slate-400">
                        receita confirmada
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-violet-600"
                      style={{
                        width: `${Math.min(tipo.percentual_vendido, 100)}%`,
                      }}
                    />
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {tipo.lotes.map((lote) => (
                      <div
                        key={lote.lote_id}
                        className="rounded-xl bg-slate-50 p-4"
                      >
                        <div className="flex justify-between gap-3">
                          <div>
                            <p className="text-sm font-extrabold">
                              {lote.nome}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {formatarMoeda(lote.preco)}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-black">
                              {lote.vendidos}/{lote.capacidade}
                            </p>

                            <p className="text-xs text-slate-400">
                              vendidos
                            </p>
                          </div>
                        </div>

                        {lote.pendentes > 0 ? (
                          <p className="mt-3 text-xs font-bold text-amber-600">
                            {lote.pendentes} aguardando pagamento
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* OCUPAÇÃO */}

          <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600">
              Operação
            </p>

            <h3 className="mt-2 text-2xl font-black">Ocupação</h3>

            <div className="mt-6 rounded-[1.75rem] bg-slate-950 p-6 text-white">
              <p className="text-sm text-slate-400">
                Ocupação confirmada
              </p>

              <p className="mt-2 text-5xl font-black">
                {ocupacao.toFixed(1)}%
              </p>

              <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{
                    width: `${ocupacao}%`,
                  }}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-xs font-bold text-emerald-700">
                  Vendidos
                </p>

                <p className="mt-1 text-2xl font-black text-emerald-900">
                  {resumo.ingressos_vendidos}
                </p>
              </div>

              <div className="rounded-2xl bg-violet-50 p-4">
                <p className="text-xs font-bold text-violet-700">
                  Disponíveis
                </p>

                <p className="mt-1 text-2xl font-black text-violet-900">
                  {resumo.disponiveis}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-700">
                Aguardando pagamento
              </p>

              <p className="mt-1 text-2xl font-black text-amber-900">
                {resumo.ingressos_pendentes}
              </p>
            </div>
          </article>
        </section>

        {/* PEDIDOS */}

        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600">
                Vendas
              </p>

              <h3 className="mt-2 text-2xl font-black">
                Últimos pedidos
              </h3>
            </div>

            <span className="rounded-full bg-violet-50 px-4 py-2 text-xs font-extrabold text-violet-700">
              {resumo.pedidos_total} pedido(s)
            </span>
          </div>

          {dashboard.ultimos_pedidos.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-slate-50 p-10 text-center text-sm text-slate-500">
              Nenhum pedido registrado.
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-slate-50 text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Pedido</th>
                    <th className="px-5 py-4">Comprador</th>
                    <th className="px-5 py-4">Ingressos</th>
                    <th className="px-5 py-4">Pagamento</th>
                    <th className="px-5 py-4">Valor</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Data</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {dashboard.ultimos_pedidos.map((pedido) => (
                    <tr key={pedido.id}>
                      <td className="px-5 py-4">
                        <p className="font-black">#{pedido.id}</p>

                        <p className="mt-1 text-xs text-slate-400">
                          {pedido.codigo}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-bold">
                          {pedido.comprador_nome}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {pedido.comprador_email}
                        </p>
                      </td>

                      <td className="px-5 py-4 font-bold">
                        {pedido.quantidade}
                      </td>

                      <td className="px-5 py-4">
                        {pagamentoAmigavel(pedido.forma_pagamento)}
                      </td>

                      <td className="px-5 py-4 font-black">
                        {formatarMoeda(pedido.total)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-extrabold ${classeStatus(
                            pedido.status
                          )}`}
                        >
                          {statusAmigavel(pedido.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-xs text-slate-500">
                        {formatarDataHora(pedido.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-10 border-t border-slate-200 py-6 text-center text-xs text-slate-400">
          Brava Entretenimento • Tiketeira • Evento #{evento.id}
        </footer>
      </div>
    </main>
  );
}