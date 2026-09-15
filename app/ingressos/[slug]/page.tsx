"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

type Ingresso = {
  id: number;
  nome: string;
  descricao: string;
  lote: string;
  preco: number;
};

const ingressos: Ingresso[] = [
  {
    id: 1,
    nome: "Pista",
    descricao: "Acesso à área de pista do evento.",
    lote: "1º Lote",
    preco: 50,
  },
  {
    id: 2,
    nome: "Área VIP",
    descricao: "Área exclusiva com acesso diferenciado.",
    lote: "1º Lote",
    preco: 90,
  },
  {
    id: 3,
    nome: "Camarote Brava",
    descricao: "Experiência premium em área reservada.",
    lote: "1º Lote",
    preco: 150,
  },
];

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function IngressosEventoPage() {
  const params = useParams();
  const slug =
    typeof params.slug === "string" ? params.slug : "brava-stage-festival";

  const [quantidades, setQuantidades] = useState<Record<number, number>>({});

  const quantidadeTotal = useMemo(
    () => Object.values(quantidades).reduce((total, qtd) => total + qtd, 0),
    [quantidades]
  );

  const valorTotal = useMemo(
    () =>
      ingressos.reduce(
        (total, ingresso) =>
          total + ingresso.preco * (quantidades[ingresso.id] || 0),
        0
      ),
    [quantidades]
  );

  function alterarQuantidade(id: number, diferenca: number) {
    setQuantidades((atual) => {
      const novaQuantidade = Math.max(
        0,
        Math.min(10, (atual[id] || 0) + diferenca)
      );

      return {
        ...atual,
        [id]: novaQuantidade,
      };
    });
  }

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
              <p className="font-black text-slate-950">Ingressos</p>
            </div>
          </Link>

          <Link
            href="/"
            className="text-sm font-bold text-slate-600 transition hover:text-blue-600"
          >
            ← Eventos
          </Link>
        </div>
      </header>

      <section className="bg-slate-950">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-[320px_1fr] md:items-center md:py-12">
          <img
            src="https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=900&q=85"
            alt="Brava Stage Festival"
            className="h-56 w-full rounded-3xl object-cover shadow-2xl md:h-72"
          />

          <div>
            <span className="inline-flex rounded-full bg-blue-600/20 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-blue-300">
              Venda aberta
            </span>

            <h1 className="mt-4 text-3xl font-black text-white sm:text-5xl">
              Brava Stage Festival
            </h1>

            <div className="mt-5 space-y-2 text-slate-300">
              <p>📅 12 de setembro de 2026</p>
              <p>🕘 A partir das 20h</p>
              <p>📍 Vitória - ES</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-6">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">
              Escolha seu ingresso
            </p>

            <h2 className="mt-2 text-3xl font-black text-slate-950">
              Ingressos disponíveis
            </h2>
          </div>

          <div className="space-y-4">
            {ingressos.map((ingresso) => {
              const quantidade = quantidades[ingresso.id] || 0;

              return (
                <article
                  key={ingresso.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black text-slate-950">
                          {ingresso.nome}
                        </h3>

                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                          {ingresso.lote}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        {ingresso.descricao}
                      </p>

                      <p className="mt-4 text-xl font-black text-blue-700">
                        {moeda(ingresso.preco)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-2 sm:justify-center">
                      <button
                        type="button"
                        onClick={() => alterarQuantidade(ingresso.id, -1)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl font-black shadow-sm transition hover:bg-slate-100"
                      >
                        −
                      </button>

                      <span className="min-w-8 text-center text-lg font-black">
                        {quantidade}
                      </span>

                      <button
                        type="button"
                        onClick={() => alterarQuantidade(ingresso.id, 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xl font-black text-white transition hover:bg-blue-500"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside>
          <div className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Resumo
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Sua compra
            </h2>

            <div className="mt-6 space-y-4 border-y border-slate-200 py-5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Ingressos</span>
                <span className="font-bold">{quantidadeTotal}</span>
              </div>

              <div className="flex items-end justify-between">
                <span className="font-bold text-slate-600">Total</span>
                <span className="text-2xl font-black text-slate-950">
                  {moeda(valorTotal)}
                </span>
              </div>
            </div>

            {quantidadeTotal > 0 ? (
              <Link
                href={{
                  pathname: `/checkout/${slug}`,
                  query: {
                    pista: quantidades[1] || 0,
                    vip: quantidades[2] || 0,
                    camarote: quantidades[3] || 0,
                  },
                }}
                className="mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl bg-blue-600 px-5 text-center font-black text-white transition hover:bg-blue-500"
              >
                Continuar compra
              </Link>
            ) : (
              <button
                disabled
                className="mt-6 min-h-14 w-full cursor-not-allowed rounded-2xl bg-slate-200 px-5 font-black text-slate-500"
              >
                Selecione um ingresso
              </button>
            )}

            <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
              🔒 Compra segura
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
