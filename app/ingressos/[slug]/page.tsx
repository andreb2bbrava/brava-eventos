"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Evento = {
  id: number;
  nome: string | null;
  slug: string | null;
  descricao: string | null;
  data_evento: string | null;
  hora_evento: string | null;
  local_evento: string | null;
  banner_url: string | null;
  inicio_evento: string | null;
};

type Ingresso = {
  id: number;
  tipoIngressoId: number;
  nome: string;
  descricao: string;
  lote: string;
  preco: number;
  disponivel: number;
};

type IngressoApi = {
  lote_id: number;
  tipo_ingresso_id: number;
  nome: string;
  descricao?: string | null;
  lote: string;
  preco: number;
  disponivel: number;
};

type RespostaTiketeira = {
  evento?: Evento;
  ingressos?: IngressoApi[];
  error?: string;
};

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(evento: Evento | null) {
  if (!evento) return "";

  const valor = evento.inicio_evento || evento.data_evento;

  if (!valor) return "Data a definir";

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return evento.data_evento || "Data a definir";
  }

  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatarHora(evento: Evento | null) {
  if (!evento) return "";

  if (evento.inicio_evento) {
    const data = new Date(evento.inicio_evento);

    if (!Number.isNaN(data.getTime())) {
      return data.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }

  return evento.hora_evento || "Horário a definir";
}

export default function IngressosEventoPage() {
  const params = useParams();

  const slug = typeof params.slug === "string" ? params.slug : "";

  const [evento, setEvento] = useState<Evento | null>(null);
  const [ingressos, setIngressos] = useState<Ingresso[]>([]);
  const [quantidades, setQuantidades] = useState<Record<number, number>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarEvento() {
      if (!slug) {
        if (ativo) {
          setErro("Evento não encontrado.");
          setCarregando(false);
        }

        return;
      }

      setCarregando(true);
      setErro("");

      try {
        const resposta = await fetch(
          `/api/tiketeira/eventos/${encodeURIComponent(slug)}`,
          {
            cache: "no-store",
          }
        );

        const dados = (await resposta.json()) as RespostaTiketeira;

        if (!resposta.ok) {
          throw new Error(
            dados.error || "Não foi possível carregar o evento."
          );
        }

        if (!dados.evento) {
          throw new Error("Evento não encontrado.");
        }

        if (!ativo) {
          return;
        }

        const ingressosRecebidos: Ingresso[] = (
          Array.isArray(dados.ingressos) ? dados.ingressos : []
        ).map((item) => ({
          id: Number(item.lote_id),
          tipoIngressoId: Number(item.tipo_ingresso_id),
          nome: String(item.nome || ""),
          descricao: String(item.descricao || ""),
          lote: String(item.lote || ""),
          preco: Number(item.preco || 0),
          disponivel: Number(item.disponivel || 0),
        }));

        setEvento(dados.evento);
        setIngressos(ingressosRecebidos);
        setQuantidades({});
      } catch (error) {
        console.error("Erro ao carregar ingressos:", error);

        if (ativo) {
          setEvento(null);
          setIngressos([]);
          setErro(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os ingressos deste evento."
          );
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    carregarEvento();

    return () => {
      ativo = false;
    };
  }, [slug]);

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
    [ingressos, quantidades]
  );

  function alterarQuantidade(ingresso: Ingresso, diferenca: number) {
    setQuantidades((atual) => {
      const atualQuantidade = atual[ingresso.id] || 0;
      const limite = Math.min(10, ingresso.disponivel);

      const novaQuantidade = Math.max(
        0,
        Math.min(limite, atualQuantidade + diferenca)
      );

      return {
        ...atual,
        [ingresso.id]: novaQuantidade,
      };
    });
  }

  const itensSelecionados = ingressos
    .filter((ingresso) => (quantidades[ingresso.id] || 0) > 0)
    .map((ingresso) => ({
      loteId: ingresso.id,
      tipoIngressoId: ingresso.tipoIngressoId,
      quantidade: quantidades[ingresso.id] || 0,
    }));

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
          <p className="font-black text-slate-950">Carregando ingressos...</p>

          <p className="mt-2 text-sm text-slate-500">
            Aguarde enquanto buscamos o evento.
          </p>
        </div>
      </main>
    );
  }

  if (erro || !evento) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-red-600">
            Evento indisponível
          </p>

          <h1 className="mt-3 text-3xl font-black text-slate-950">
            Não encontramos este evento
          </h1>

          <p className="mt-3 text-slate-500">
            {erro || "O evento solicitado não está disponível."}
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-6 font-black text-white transition hover:bg-blue-500"
          >
            Ver eventos
          </Link>
        </div>
      </main>
    );
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
          {evento.banner_url ? (
            <img
              src={evento.banner_url}
              alt={evento.nome || "Evento"}
              className="h-56 w-full rounded-3xl object-cover shadow-2xl md:h-72"
            />
          ) : (
            <div className="flex h-56 w-full items-center justify-center rounded-3xl bg-slate-800 text-5xl shadow-2xl md:h-72">
              🎟️
            </div>
          )}

          <div>
            <span className="inline-flex rounded-full bg-blue-600/20 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-blue-300">
              Venda de ingressos
            </span>

            <h1 className="mt-4 text-3xl font-black text-white sm:text-5xl">
              {evento.nome || "Evento"}
            </h1>

            <div className="mt-5 space-y-2 text-slate-300">
              <p>📅 {formatarData(evento)}</p>
              <p>🕘 {formatarHora(evento)}</p>
              <p>📍 {evento.local_evento || "Local a definir"}</p>
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

          {ingressos.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <div className="text-4xl">🎟️</div>

              <h3 className="mt-4 text-xl font-black text-slate-950">
                Nenhum ingresso disponível
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                A venda de ingressos para este evento ainda não foi configurada
                ou não possui lote disponível.
              </p>
            </div>
          ) : (
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

                        {ingresso.descricao ? (
                          <p className="mt-2 text-sm text-slate-500">
                            {ingresso.descricao}
                          </p>
                        ) : null}

                        <p className="mt-4 text-xl font-black text-blue-700">
                          {moeda(ingresso.preco)}
                        </p>

                        {ingresso.disponivel <= 10 ? (
                          <p className="mt-2 text-xs font-bold text-amber-600">
                            Restam {ingresso.disponivel} ingresso
                            {ingresso.disponivel === 1 ? "" : "s"} neste lote
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-2 sm:justify-center">
                        <button
                          type="button"
                          onClick={() => alterarQuantidade(ingresso, -1)}
                          disabled={quantidade === 0}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl font-black shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          −
                        </button>

                        <span className="min-w-8 text-center text-lg font-black">
                          {quantidade}
                        </span>

                        <button
                          type="button"
                          onClick={() => alterarQuantidade(ingresso, 1)}
                          disabled={
                            quantidade >= Math.min(10, ingresso.disponivel)
                          }
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xl font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
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
                    itens: JSON.stringify(itensSelecionados),
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