"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type UsuarioTiketeira = {
  nome: string | null;
  email: string | null;
  role: string | null;
  acesso_listas: boolean;
  acesso_tiketeira: boolean;
};

type EventoDashboard = {
  id: number;
  nome: string;
  slug: string | null;
  data_evento: string | null;
  hora_evento: string | null;
  local_evento: string | null;
  inicio_evento: string | null;
  ativo: boolean;
};

type ResumoDashboard = {
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

type PedidoDashboard = {
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

type DashboardData = {
  evento: EventoDashboard;
  resumo: ResumoDashboard;
  performance_tipos: TipoPerformance[];
  formas_pagamento: FormaPagamento[];
  ultimos_pedidos: PedidoDashboard[];
};

function primeiroNome(nome: string | null | undefined) {
  const nomeLimpo = (nome || "").trim();

  if (!nomeLimpo) {
    return "Usuário";
  }

  return nomeLimpo.split(/\s+/)[0];
}

function saudacaoAgora() {
  const hora = new Date().getHours();

  if (hora < 12) {
    return "Bom dia";
  }

  if (hora < 18) {
    return "Boa tarde";
  }

  return "Boa noite";
}

function formatarMoeda(valor: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor || 0));
}

function formatarDataEvento(evento: EventoDashboard | null) {
  if (!evento) {
    return "Data a definir";
  }

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

  if (evento.data_evento) {
    const data = new Date(`${evento.data_evento}T00:00:00`);

    if (!Number.isNaN(data.getTime())) {
      return data.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    }

    return evento.data_evento;
  }

  return "Data a definir";
}

function formatarDataHora(valor: string | null | undefined) {
  if (!valor) {
    return "—";
  }

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
  const valor = (status || "").trim().toLowerCase();

  if (["pago", "paid", "aprovado", "approved"].includes(valor)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (
    [
      "pendente",
      "pending",
      "aguardando_pagamento",
      "aguardando pagamento",
    ].includes(valor)
  ) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (
    ["cancelado", "cancelled", "canceled", "expirado", "expired"].includes(
      valor
    )
  ) {
    return "bg-red-50 text-red-700 border-red-200";
  }

  return "bg-slate-50 text-slate-600 border-slate-200";
}

function formaPagamentoAmigavel(
  forma: string | null | undefined
) {
  const valor = (forma || "").trim().toLowerCase();

  if (valor === "pix") {
    return "PIX";
  }

  if (
    valor === "cartao" ||
    valor === "cartão" ||
    valor === "credit_card" ||
    valor === "credit card"
  ) {
    return "Cartão";
  }

  if (!valor) {
    return "Não informado";
  }

  return forma || "Não informado";
}

export default function TiketeiraAdminPage() {
  const router = useRouter();

  const [usuario, setUsuario] =
    useState<UsuarioTiketeira | null>(null);

  const [dashboard, setDashboard] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregarDashboard() {
      setLoading(true);
      setErro("");

      const {
        data: { session },
        error: erroSessao,
      } = await supabase.auth.getSession();

      if (erroSessao || !session?.user) {
        router.replace("/login");
        return;
      }

      const user = session.user;

      const { data: usuarioData, error: erroUsuario } =
        await supabase
          .from("usuarios")
          .select(
            "nome,email,role,acesso_listas,acesso_tiketeira"
          )
          .eq("id", user.id)
          .single();

      if (erroUsuario || !usuarioData) {
        console.warn(
          "Não foi possível carregar o usuário da Tiketeira:",
          erroUsuario?.message
        );

        setErro(
          "Não foi possível carregar suas permissões."
        );
        setLoading(false);
        return;
      }

      if (usuarioData.acesso_tiketeira !== true) {
        if (usuarioData.acesso_listas === true) {
          router.replace("/admin");
          return;
        }

        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      setUsuario({
        nome: usuarioData.nome || null,
        email: usuarioData.email || user.email || null,
        role: usuarioData.role || null,
        acesso_listas:
          usuarioData.acesso_listas === true,
        acesso_tiketeira: true,
      });

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

        const respostaJson = await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            respostaJson?.error ||
              "Não foi possível carregar o Dashboard."
          );
        }

        setDashboard(respostaJson as DashboardData);
      } catch (error) {
        const mensagem =
          error instanceof Error
            ? error.message
            : "Erro inesperado.";

        console.warn(
          "Falha ao carregar Dashboard Tiketeira:",
          mensagem
        );

        setErro(mensagem);
      } finally {
        setLoading(false);
      }
    }

    void carregarDashboard();
  }, [router]);

  const percentualOcupacao = useMemo(() => {
    if (
      !dashboard ||
      dashboard.resumo.capacidade_total <= 0
    ) {
      return 0;
    }

    return Math.min(
      (dashboard.resumo.ingressos_vendidos /
        dashboard.resumo.capacidade_total) *
        100,
      100
    );
  }, [dashboard]);

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-violet-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />

          <p className="mt-5 font-semibold text-slate-600">
            Carregando Dashboard Tiketeira...
          </p>
        </div>
      </main>
    );
  }

  if (erro || !usuario || !dashboard) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">⚠️</div>

          <h1 className="mt-4 text-2xl font-black text-slate-900">
            Não foi possível abrir a Tiketeira
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            {erro || "Dashboard indisponível."}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {usuario?.acesso_listas ? (
              <Link
                href="/admin/modulos"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Trocar ambiente
              </Link>
            ) : null}

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-violet-700 px-6 py-3 font-bold text-white transition hover:bg-violet-600"
            >
              Tentar novamente
            </button>
          </div>
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
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-violet-50">
              <img
                src="/logo.png"
                alt="Brava"
                className="h-10 w-10 object-contain"
              />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-violet-600">
                Brava Tiketeira
              </p>

              <h1 className="truncate text-lg font-black text-slate-950 sm:text-xl">
                Central de Vendas
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {usuario.acesso_listas ? (
              <Link
                href="/admin/modulos"
                className="hidden min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 sm:inline-flex"
              >
                Trocar ambiente
              </Link>
            ) : null}

            <button
              type="button"
              onClick={sair}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-8">
        {/* CABEÇALHO */}

        <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold text-violet-600">
              {saudacaoAgora()}, {primeiroNome(usuario.nome)} 👋
            </p>

            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Dashboard Tiketeira
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Acompanhe vendas, pedidos, ingressos, lotes e
              resultados financeiros dos seus eventos.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled
              className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-400"
            >
              Pedidos
            </button>

            <button
              type="button"
              disabled
              className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-2xl bg-violet-700 px-5 py-3 text-sm font-bold text-white opacity-60"
            >
              Ingressos & Lotes
            </button>
          </div>
        </section>

        {/* EVENTO */}

        <section className="mt-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-violet-950 to-violet-700 p-6 text-white shadow-[0_22px_70px_rgba(30,41,59,0.18)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-violet-100">
                Ambiente de homologação
              </span>

              <h3 className="mt-4 text-2xl font-black sm:text-3xl">
                {evento.nome}
              </h3>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-violet-100">
                <span>
                  📅 {formatarDataEvento(evento)}
                </span>

                <span>
                  🕙 {evento.hora_evento || "Horário a definir"}
                </span>

                <span>
                  📍 {evento.local_evento || "Local a definir"}
                </span>
              </div>
            </div>

            <div className="shrink-0 rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-200">
                Evento
              </p>

              <p className="mt-1 text-2xl font-black">
                #{evento.id}
              </p>
            </div>
          </div>
        </section>

        {/* INDICADORES PRINCIPAIS */}

        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-500">
                  Receita confirmada
                </p>

                <h3 className="mt-3 text-3xl font-black text-emerald-700">
                  {formatarMoeda(resumo.receita_confirmada)}
                </h3>
              </div>

              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-xl">
                💰
              </span>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              {resumo.pedidos_pagos} pedido(s) com pagamento confirmado.
            </p>
          </article>

          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-500">
                  Receita pendente
                </p>

                <h3 className="mt-3 text-3xl font-black text-amber-600">
                  {formatarMoeda(resumo.receita_pendente)}
                </h3>
              </div>

              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-xl">
                ⏳
              </span>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              {resumo.pedidos_pendentes} pedido(s) aguardando pagamento.
            </p>
          </article>

          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-500">
                  Ingressos vendidos
                </p>

                <h3 className="mt-3 text-3xl font-black text-violet-700">
                  {resumo.ingressos_vendidos}
                </h3>
              </div>

              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-xl">
                🎟️
              </span>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              {resumo.ingressos_pendentes} ingresso(s) aguardando pagamento.
            </p>
          </article>

          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-500">
                  Ticket médio
                </p>

                <h3 className="mt-3 text-3xl font-black text-blue-700">
                  {formatarMoeda(resumo.ticket_medio)}
                </h3>
              </div>

              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-xl">
                📊
              </span>
            </div>

            <p className="mt-4 text-xs text-slate-400">
              Média calculada somente sobre pedidos pagos.
            </p>
          </article>
        </section>

        {/* INDICADORES SECUNDÁRIOS */}

        <section className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
              Pedidos
            </p>

            <p className="mt-2 text-2xl font-black text-slate-900">
              {resumo.pedidos_total}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-600">
              Pagos
            </p>

            <p className="mt-2 text-2xl font-black text-emerald-700">
              {resumo.pedidos_pagos}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-600">
              Pendentes
            </p>

            <p className="mt-2 text-2xl font-black text-amber-700">
              {resumo.pedidos_pendentes}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-600">
              Ocupação
            </p>

            <p className="mt-2 text-2xl font-black text-violet-700">
              {percentualOcupacao.toFixed(1)}%
            </p>
          </article>
        </section>

        {/* PERFORMANCE + ESTOQUE */}

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600">
                Performance
              </p>

              <h3 className="mt-2 text-2xl font-black text-slate-950">
                Vendas por ingresso
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Resultado real por tipo de ingresso e lote.
              </p>
            </div>

            {dashboard.performance_tipos.length === 0 ? (
              <p className="mt-7 text-sm text-slate-500">
                Nenhum ingresso cadastrado para este evento.
              </p>
            ) : (
              <div className="mt-7 space-y-5">
                {dashboard.performance_tipos.map((tipo) => (
                  <div
                    key={tipo.tipo_ingresso_id}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-lg font-extrabold text-slate-900">
                          {tipo.nome}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Capacidade: {tipo.capacidade} • Vendidos:{" "}
                          {tipo.vendidos} • Pendentes:{" "}
                          {tipo.pendentes}
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-lg font-black text-violet-700">
                          {formatarMoeda(tipo.receita)}
                        </p>

                        <p className="text-xs text-slate-400">
                          receita confirmada
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-violet-600 transition-all"
                        style={{
                          width: `${Math.min(
                            tipo.percentual_vendido,
                            100
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="mt-2 flex justify-between text-xs text-slate-400">
                      <span>
                        {tipo.percentual_vendido.toFixed(1)}% vendido
                      </span>

                      <span>
                        {tipo.disponiveis} disponíveis
                      </span>
                    </div>

                    {tipo.lotes.length > 0 ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {tipo.lotes.map((lote) => (
                          <div
                            key={lote.lote_id}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-slate-800">
                                  {lote.nome}
                                </p>

                                <p className="mt-1 text-xs text-slate-400">
                                  {formatarMoeda(lote.preco)}
                                </p>
                              </div>

                              <div className="text-right">
                                <p className="text-sm font-black text-slate-800">
                                  {lote.vendidos}/{lote.capacidade}
                                </p>

                                <p className="text-xs text-slate-400">
                                  vendidos
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600">
              Capacidade
            </p>

            <h3 className="mt-2 text-2xl font-black text-slate-950">
              Estoque de ingressos
            </h3>

            <div className="mt-7 rounded-[1.75rem] bg-slate-950 p-6 text-white">
              <p className="text-sm font-semibold text-slate-400">
                Capacidade cadastrada
              </p>

              <p className="mt-2 text-5xl font-black">
                {resumo.capacidade_total}
              </p>

              <p className="mt-2 text-sm text-slate-400">
                ingressos cadastrados nos lotes do evento
              </p>
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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-amber-700">
                    Aguardando pagamento
                  </p>

                  <p className="mt-1 text-2xl font-black text-amber-900">
                    {resumo.ingressos_pendentes}
                  </p>
                </div>

                <span className="text-2xl">
                  ⏳
                </span>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>Ocupação confirmada</span>
                <span>{percentualOcupacao.toFixed(1)}%</span>
              </div>

              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-violet-600"
                  style={{
                    width: `${percentualOcupacao}%`,
                  }}
                />
              </div>
            </div>
          </article>
        </section>

        {/* FORMAS DE PAGAMENTO */}

        {dashboard.formas_pagamento.length > 0 ? (
          <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600">
              Financeiro
            </p>

            <h3 className="mt-2 text-2xl font-black text-slate-950">
              Formas de pagamento
            </h3>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {dashboard.formas_pagamento.map((forma) => (
                <article
                  key={forma.forma}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <p className="font-extrabold text-slate-900">
                    {formaPagamentoAmigavel(forma.forma)}
                  </p>

                  <p className="mt-3 text-2xl font-black text-violet-700">
                    {formatarMoeda(forma.receita)}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {forma.pedidos} pedido(s) pago(s)
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {/* PEDIDOS */}

        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600">
                Operação
              </p>

              <h3 className="mt-2 text-2xl font-black text-slate-950">
                Últimos pedidos
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Pedidos reais registrados na Tiketeira.
              </p>
            </div>

            <span className="inline-flex w-fit rounded-full bg-violet-50 px-4 py-2 text-xs font-extrabold text-violet-700">
              {resumo.pedidos_total} pedido(s)
            </span>
          </div>

          {dashboard.ultimos_pedidos.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-center">
              <div className="text-3xl">🎟️</div>

              <p className="mt-3 font-bold text-slate-700">
                Nenhum pedido registrado
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-slate-50">
                  <tr className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
                    <th className="px-5 py-4">
                      Pedido
                    </th>

                    <th className="px-5 py-4">
                      Comprador
                    </th>

                    <th className="px-5 py-4">
                      Ingressos
                    </th>

                    <th className="px-5 py-4">
                      Pagamento
                    </th>

                    <th className="px-5 py-4">
                      Valor
                    </th>

                    <th className="px-5 py-4">
                      Status
                    </th>

                    <th className="px-5 py-4">
                      Criado em
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {dashboard.ultimos_pedidos.map((pedido) => (
                    <tr
                      key={pedido.id}
                      className="bg-white text-sm"
                    >
                      <td className="px-5 py-4">
                        <p className="font-extrabold text-slate-900">
                          #{pedido.id}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {pedido.codigo}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-800">
                          {pedido.comprador_nome}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {pedido.comprador_email}
                        </p>
                      </td>

                      <td className="px-5 py-4 font-bold text-slate-700">
                        {pedido.quantidade}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {formaPagamentoAmigavel(
                          pedido.forma_pagamento
                        )}
                      </td>

                      <td className="px-5 py-4 font-extrabold text-slate-900">
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
                        {formatarDataHora(
                          pedido.created_at
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-10 border-t border-slate-200 py-6 text-center text-xs text-slate-400">
          Brava Entretenimento • Tiketeira
        </footer>
      </div>
    </main>
  );
}