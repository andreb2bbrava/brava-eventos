"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function CarregandoPedido() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-900">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
        <p className="mt-4 font-bold text-slate-600">
          Carregando pedido...
        </p>
      </div>
    </main>
  );
}

function PedidoConfirmadoContent() {
  const searchParams = useSearchParams();

  const evento =
    searchParams.get("evento")?.trim() || "brava-stage-festival";

  const nome = searchParams.get("nome")?.trim() || "Comprador";

  const ingressos = useMemo(() => {
    const valor = Number(searchParams.get("ingressos") || 0);

    if (!Number.isFinite(valor)) {
      return 0;
    }

    return Math.max(0, Math.trunc(valor));
  }, [searchParams]);

  const total = useMemo(() => {
    const valor = Number(searchParams.get("total") || 0);

    if (!Number.isFinite(valor)) {
      return 0;
    }

    return Math.max(0, valor);
  }, [searchParams]);

  const primeiroNome = nome.split(" ")[0] || "Comprador";

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Brava"
              className="h-10 w-10 rounded-xl object-contain"
            />

            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
                Brava
              </p>

              <p className="font-black text-slate-950">
                Ingressos
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-2 text-sm font-bold sm:flex">
            <span className="text-slate-400">
              1. Ingressos
            </span>

            <span className="text-slate-300">
              →
            </span>

            <span className="text-slate-400">
              2. Identificação
            </span>

            <span className="text-slate-300">
              →
            </span>

            <span className="text-emerald-600">
              3. Pedido
            </span>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-10 text-center sm:px-6 sm:py-14">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-4xl text-white shadow-lg shadow-emerald-950/30">
            ✓
          </div>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-emerald-400">
            Pedido gerado
          </p>

          <h1 className="mt-3 text-3xl font-black text-white sm:text-5xl">
            Tudo certo, {primeiroNome}!
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
            Seu pedido para o Brava Stage Festival foi criado com sucesso.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                  Resumo do pedido
                </p>

                <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
                  Brava Stage Festival
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  12 de setembro de 2026 • Vitória - ES
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
                ✓ Pedido confirmado
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Comprador
              </p>

              <p className="mt-2 text-lg font-black text-slate-950">
                {nome}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Ingressos
              </p>

              <p className="mt-2 text-lg font-black text-slate-950">
                {ingressos} ingresso{ingressos !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 px-6 py-6 sm:px-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-500">
                  Valor do pedido
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Pagamento demonstrativo via PIX
                </p>
              </div>

              <p className="text-3xl font-black text-slate-950">
                {moeda(total)}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-blue-100 bg-blue-50 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl text-white">
              🎟️
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-950">
                E os ingressos?
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Na versão definitiva da Tiketeira, após a confirmação do
                pagamento os ingressos digitais serão liberados e ficarão
                disponíveis para o comprador acessar pelo celular.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Ambiente de demonstração
          </p>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">
            Este pedido é apenas uma demonstração da experiência de compra.
            Nenhuma cobrança foi realizada e nenhum pedido foi gravado no
            sistema.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-blue-600 px-7 font-black text-white transition hover:bg-blue-500"
          >
            Voltar para eventos
          </Link>

          <Link
            href={`/ingressos/${evento}`}
            className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-slate-300 bg-white px-7 font-black text-slate-700 transition hover:bg-slate-50"
          >
            Ver evento
          </Link>
        </div>

        <div className="mt-8 text-center text-xs font-semibold text-slate-400">
          🔒 Ambiente seguro • Brava Ingressos
        </div>
      </section>
    </main>
  );
}

export default function PedidoConfirmadoPage() {
  return (
    <Suspense fallback={<CarregandoPedido />}>
      <PedidoConfirmadoContent />
    </Suspense>
  );
}