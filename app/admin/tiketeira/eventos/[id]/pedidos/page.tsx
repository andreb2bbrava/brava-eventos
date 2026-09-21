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

type DashboardResponse = {
  evento: Evento;
  ultimos_pedidos: Pedido[];
};

type FiltroStatus =
  | "todos"
  | "pago"
  | "pendente"
  | "cancelado"
  | "expirado";

type FiltroPagamento =
  | "todos"
  | "pix"
  | "cartao";

function formatarMoeda(valor: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor || 0));
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

function normalizarStatus(status: string | null | undefined) {
  const valor = (status || "").trim().toLowerCase();

  if (
    ["pago", "paid", "aprovado", "approved"].includes(valor)
  ) {
    return "pago";
  }

  if (
    [
      "pendente",
      "pending",
      "aguardando_pagamento",
      "aguardando pagamento",
    ].includes(valor)
  ) {
    return "pendente";
  }

  if (
    ["cancelado", "cancelled", "canceled"].includes(valor)
  ) {
    return "cancelado";
  }

  if (["expirado", "expired"].includes(valor)) {
    return "expirado";
  }

  return valor;
}

function statusAmigavel(status: string | null | undefined) {
  const valor = normalizarStatus(status);

  if (valor === "pago") return "Pago";
  if (valor === "pendente") return "Pendente";
  if (valor === "cancelado") return "Cancelado";
  if (valor === "expirado") return "Expirado";

  return status || "Não informado";
}

function classeStatus(status: string | null | undefined) {
  const valor = normalizarStatus(status);

  if (valor === "pago") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (valor === "pendente") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (
    valor === "cancelado" ||
    valor === "expirado"
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function normalizarPagamento(
  forma: string | null | undefined
) {
  const valor = (forma || "").trim().toLowerCase();

  if (valor === "pix") {
    return "pix";
  }

  if (
    [
      "cartao",
      "cartão",
      "credit_card",
      "credit card",
    ].includes(valor)
  ) {
    return "cartao";
  }

  return valor;
}

function pagamentoAmigavel(
  forma: string | null | undefined
) {
  const valor = normalizarPagamento(forma);

  if (valor === "pix") return "PIX";
  if (valor === "cartao") return "Cartão";

  return forma || "Não informado";
}

export default function PedidosEventoTiketeiraPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const eventoId = Number(params.id);

  const [evento, setEvento] =
    useState<Evento | null>(null);

  const [pedidos, setPedidos] =
    useState<Pedido[]>([]);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] =
    useState<FiltroStatus>("todos");

  const [filtroPagamento, setFiltroPagamento] =
    useState<FiltroPagamento>("todos");

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      setErro("");

      // Proteção temporária da homologação.
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

      const { data: usuario, error: erroUsuario } =
        await supabase
          .from("usuarios")
          .select(
            "acesso_listas,acesso_tiketeira"
          )
          .eq("id", session.user.id)
          .single();

      if (erroUsuario || !usuario) {
        setErro(
          "Não foi possível validar seu acesso."
        );
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
            method: "GET",
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
              "Não foi possível carregar os pedidos."
          );
        }

        const dados =
          json as DashboardResponse;

        if (dados.evento.id !== eventoId) {
          throw new Error(
            "O evento retornado não corresponde ao evento solicitado."
          );
        }

        setEvento(dados.evento);
        setPedidos(
          Array.isArray(dados.ultimos_pedidos)
            ? dados.ultimos_pedidos
            : []
        );
      } catch (error) {
        setErro(
          error instanceof Error
            ? error.message
            : "Erro inesperado ao carregar os pedidos."
        );
      } finally {
        setLoading(false);
      }
    }

    void carregar();
  }, [eventoId, router]);

  const pedidosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return pedidos.filter((pedido) => {
      const correspondeBusca =
        !termo ||
        pedido.comprador_nome
          .toLowerCase()
          .includes(termo) ||
        pedido.comprador_email
          .toLowerCase()
          .includes(termo) ||
        pedido.codigo
          .toLowerCase()
          .includes(termo) ||
        String(pedido.id).includes(termo);

      const correspondeStatus =
        filtroStatus === "todos" ||
        normalizarStatus(pedido.status) ===
          filtroStatus;

      const correspondePagamento =
        filtroPagamento === "todos" ||
        normalizarPagamento(
          pedido.forma_pagamento
        ) === filtroPagamento;

      return (
        correspondeBusca &&
        correspondeStatus &&
        correspondePagamento
      );
    });
  }, [
    pedidos,
    busca,
    filtroStatus,
    filtroPagamento,
  ]);

  const resumo = useMemo(() => {
    const total = pedidos.length;

    const pagos = pedidos.filter(
      (pedido) =>
        normalizarStatus(pedido.status) ===
        "pago"
    ).length;

    const pendentes = pedidos.filter(
      (pedido) =>
        normalizarStatus(pedido.status) ===
        "pendente"
    ).length;

    const receitaConfirmada = pedidos
      .filter(
        (pedido) =>
          normalizarStatus(pedido.status) ===
          "pago"
      )
      .reduce(
        (soma, pedido) =>
          soma + Number(pedido.total || 0),
        0
      );

    return {
      total,
      pagos,
      pendentes,
      receitaConfirmada,
    };
  }, [pedidos]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />

          <p className="mt-4 font-semibold text-slate-600">
            Carregando pedidos...
          </p>
        </div>
      </main>
    );
  }

  if (erro || !evento) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">⚠️</div>

          <h1 className="mt-4 text-2xl font-black text-slate-900">
            Pedidos indisponíveis
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
                Pedidos
              </h1>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/admin/tiketeira/eventos/${evento.id}`}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
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

        <section>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-violet-700">
              Evento #{evento.id}
            </span>

            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-amber-700">
              Homologação
            </span>
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Pedidos
          </h2>

          <p className="mt-2 text-sm text-slate-500 sm:text-base">
            {evento.nome}
          </p>
        </section>

        {/* NAVEGAÇÃO */}

        <section className="mt-6 flex gap-2 overflow-x-auto pb-1">
          <Link
            href={`/admin/tiketeira/eventos/${evento.id}`}
            className="whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600"
          >
            Visão Geral
          </Link>

          <span className="whitespace-nowrap rounded-2xl bg-violet-700 px-5 py-3 text-sm font-extrabold text-white">
            Pedidos
          </span>

          <Link
            href={`/admin/tiketeira/eventos/${evento.id}/ingressos`}
            className="whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
          >
            Ingressos & Lotes
          </Link>

          <Link
            href={`/admin/tiketeira/eventos/${evento.id}/financeiro`}
            className="whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
          >
            Financeiro
          </Link>
        </section>

        {/* RESUMO */}

        <section className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400">
              Total de pedidos
            </p>

            <p className="mt-2 text-3xl font-black">
              {resumo.total}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-600">
              Pagos
            </p>

            <p className="mt-2 text-3xl font-black text-emerald-700">
              {resumo.pagos}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-amber-600">
              Pendentes
            </p>

            <p className="mt-2 text-3xl font-black text-amber-700">
              {resumo.pendentes}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-violet-600">
              Receita confirmada
            </p>

            <p className="mt-2 text-2xl font-black text-violet-700">
              {formatarMoeda(
                resumo.receitaConfirmada
              )}
            </p>
          </article>
        </section>

        {/* FILTROS */}

        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
            <div>
              <label className="mb-2 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                Buscar pedido
              </label>

              <input
                type="text"
                value={busca}
                onChange={(e) =>
                  setBusca(e.target.value)
                }
                placeholder="Nome, e-mail, código ou número..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-50"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                Status
              </label>

              <select
                value={filtroStatus}
                onChange={(e) =>
                  setFiltroStatus(
                    e.target.value as FiltroStatus
                  )
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm outline-none"
              >
                <option value="todos">Todos</option>
                <option value="pago">Pago</option>
                <option value="pendente">Pendente</option>
                <option value="cancelado">Cancelado</option>
                <option value="expirado">Expirado</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                Pagamento
              </label>

              <select
                value={filtroPagamento}
                onChange={(e) =>
                  setFiltroPagamento(
                    e.target.value as FiltroPagamento
                  )
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm outline-none"
              >
                <option value="todos">Todos</option>
                <option value="pix">PIX</option>
                <option value="cartao">Cartão</option>
              </select>
            </div>
          </div>
        </section>

        {/* TABELA */}

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <h3 className="text-xl font-black">
                Pedidos do evento
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {pedidosFiltrados.length} resultado(s)
              </p>
            </div>

            <span className="rounded-full bg-violet-50 px-4 py-2 text-xs font-extrabold text-violet-700">
              Somente leitura
            </span>
          </div>

          {pedidosFiltrados.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="text-4xl">🔎</div>

              <h4 className="mt-4 text-lg font-black">
                Nenhum pedido encontrado
              </h4>

              <p className="mt-2 text-sm text-slate-500">
                Tente alterar os filtros da pesquisa.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left">
                <thead className="bg-slate-50">
                  <tr className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                    <th className="px-6 py-4">Pedido</th>
                    <th className="px-6 py-4">Comprador</th>
                    <th className="px-6 py-4">Ingressos</th>
                    <th className="px-6 py-4">Pagamento</th>
                    <th className="px-6 py-4">Total</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Criado em</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {pedidosFiltrados.map(
                    (pedido) => (
                      <tr
                        key={pedido.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-6 py-5">
                          <p className="font-black text-slate-900">
                            #{pedido.id}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {pedido.codigo}
                          </p>
                        </td>

                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-800">
                            {pedido.comprador_nome}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {pedido.comprador_email}
                          </p>
                        </td>

                        <td className="px-6 py-5 font-bold">
                          {pedido.quantidade}
                        </td>

                        <td className="px-6 py-5">
                          {pagamentoAmigavel(
                            pedido.forma_pagamento
                          )}
                        </td>

                        <td className="px-6 py-5 font-black">
                          {formatarMoeda(
                            pedido.total
                          )}
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-extrabold ${classeStatus(
                              pedido.status
                            )}`}
                          >
                            {statusAmigavel(
                              pedido.status
                            )}
                          </span>
                        </td>

                        <td className="px-6 py-5 text-xs text-slate-500">
                          {formatarDataHora(
                            pedido.created_at
                          )}
                        </td>
                      </tr>
                    )
                  )}
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