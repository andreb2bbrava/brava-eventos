"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type EventoTiketeira = {
  id: number;
  nome: string;
  slug: string;
  descricao: string | null;
  data_evento: string | null;
  hora_evento: string | null;
  local_evento: string | null;
  banner_url: string | null;
  menor_preco: number;
};

type EventosResponse = {
  eventos?: EventoTiketeira[];
  error?: string;
};

const imagemFallback =
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=85";

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function formatarData(data: string | null) {
  if (!data) {
    return {
      dia: "--",
      mes: "---",
      completa: "Data a definir",
    };
  }

  const partes = data.split("-");

  if (partes.length !== 3) {
    return {
      dia: "--",
      mes: "---",
      completa: data,
    };
  }

  const [ano, mes, dia] = partes;

  const meses = [
    "JAN",
    "FEV",
    "MAR",
    "ABR",
    "MAI",
    "JUN",
    "JUL",
    "AGO",
    "SET",
    "OUT",
    "NOV",
    "DEZ",
  ];

  const nomesMeses = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];

  const indiceMes = Number(mes) - 1;

  return {
    dia,
    mes: meses[indiceMes] || "---",
    completa:
      indiceMes >= 0 && indiceMes <= 11
        ? `${Number(dia)} de ${nomesMeses[indiceMes]} de ${ano}`
        : data,
  };
}

function formatarHora(hora: string | null) {
  if (!hora) return "";

  return hora.slice(0, 5);
}

export default function Home() {
  const [eventos, setEventos] = useState<EventoTiketeira[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarEventos() {
      try {
        setCarregando(true);
        setErro("");

        const resposta = await fetch("/api/tiketeira/eventos", {
          cache: "no-store",
        });

        const dados = (await resposta.json()) as EventosResponse;

        if (!resposta.ok) {
          throw new Error(
            dados.error || "Não foi possível carregar os eventos."
          );
        }

        if (!ativo) return;

        setEventos(Array.isArray(dados.eventos) ? dados.eventos : []);
      } catch (error) {
        console.error("ERRO HOME TIKETEIRA:", error);

        if (!ativo) return;

        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os eventos."
        );
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    carregarEventos();

    return () => {
      ativo = false;
    };
  }, []);

  const eventosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) {
      return eventos;
    }

    return eventos.filter((evento) => {
      const texto = [
        evento.nome,
        evento.local_evento || "",
        evento.descricao || "",
      ]
        .join(" ")
        .toLowerCase();

      return texto.includes(termo);
    });
  }, [eventos, busca]);

  const eventoDestaque = eventos[0] || null;

  const dataDestaque = eventoDestaque
    ? formatarData(eventoDestaque.data_evento)
    : null;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Brava Eventos"
              className="h-11 w-11 rounded-xl object-contain"
            />

            <div className="leading-tight">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">
                Brava
              </p>

              <p className="text-lg font-black text-slate-950">
                Ingressos
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-700 md:flex">
            <Link href="/" className="transition hover:text-blue-600">
              Eventos
            </Link>

            <Link href="/listas" className="transition hover:text-blue-600">
              Listas
            </Link>

            <Link href="/acessar" className="transition hover:text-blue-600">
              Área Administrativa
            </Link>
          </nav>

          <Link
            href="/listas"
            className="rounded-xl border border-blue-600 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50 md:hidden"
          >
            Listas
          </Link>
        </div>
      </header>

      <section className="bg-slate-950">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 md:items-center md:py-20">
          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.24em] text-blue-400">
              Brava Entretenimento
            </p>

            <h1 className="max-w-xl text-4xl font-black leading-tight text-white sm:text-5xl md:text-6xl">
              Viva o evento.
              <span className="block text-blue-400">
                Comece pelo ingresso.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Encontre os melhores eventos, compre seus ingressos e acompanhe
              tudo em um só lugar.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="#eventos"
                className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-6 py-4 font-extrabold text-white transition hover:bg-blue-500"
              >
                Explorar eventos
              </Link>

              <Link
                href="/listas"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-700 px-6 py-4 font-extrabold text-white transition hover:bg-slate-900"
              >
                Ver listas
              </Link>
            </div>
          </div>

          {carregando ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
              <p className="font-bold text-slate-400">
                Carregando evento...
              </p>
            </div>
          ) : eventoDestaque ? (
            <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
              <img
                src={eventoDestaque.banner_url || imagemFallback}
                alt={eventoDestaque.nome}
                className="h-[320px] w-full object-cover sm:h-[420px]"
              />

              <div className="p-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
                  Em destaque
                </p>

                <h2 className="mt-2 text-2xl font-black text-white">
                  {eventoDestaque.nome}
                </h2>

                <p className="mt-2 text-sm text-slate-300">
                  {eventoDestaque.local_evento || "Local a definir"}
                  {dataDestaque ? ` • ${dataDestaque.completa}` : ""}
                  {eventoDestaque.hora_evento
                    ? ` • ${formatarHora(eventoDestaque.hora_evento)}`
                    : ""}
                </p>

                <p className="mt-3 text-sm font-bold text-blue-300">
                  A partir de {formatarMoeda(eventoDestaque.menor_preco)}
                </p>

                <Link
                  href={`/ingressos/${eventoDestaque.slug}`}
                  className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-blue-50"
                >
                  Comprar ingresso
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-400">
                  Brava Ingressos
                </p>

                <h2 className="mt-3 text-2xl font-black text-white">
                  Novos eventos em breve
                </h2>

                <p className="mt-3 text-sm text-slate-400">
                  Aguarde as próximas vendas da Brava Entretenimento.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="-mt-6 relative z-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xl sm:p-5">
            <label
              htmlFor="busca"
              className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-slate-500"
            >
              Pesquisar eventos
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="busca"
                type="text"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Qual evento você procura?"
                className="min-h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
              />

              <Link
                href="#eventos"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-6 font-extrabold text-white transition hover:bg-blue-500"
              >
                Buscar
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        id="eventos"
        className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6"
      >
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
              Próximos eventos
            </p>

            <h2 className="mt-2 text-3xl font-black text-slate-950">
              Eventos disponíveis
            </h2>
          </div>
        </div>

        {erro ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
            <p className="font-bold text-red-800">{erro}</p>
          </div>
        ) : carregando ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="font-bold text-slate-500">
              Carregando eventos...
            </p>
          </div>
        ) : eventosFiltrados.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-xl font-black text-slate-900">
              Nenhum evento encontrado
            </p>

            <p className="mt-2 text-sm text-slate-500">
              {busca
                ? "Tente pesquisar por outro nome ou local."
                : "Não existem eventos com ingressos disponíveis no momento."}
            </p>
          </div>
        ) : (
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {eventosFiltrados.map((evento) => {
              const data = formatarData(evento.data_evento);

              return (
                <article
                  key={evento.id}
                  className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <Link
                    href={`/ingressos/${evento.slug}`}
                    className="relative block overflow-hidden"
                  >
                    <img
                      src={evento.banner_url || imagemFallback}
                      alt={evento.nome}
                      className="h-52 w-full object-cover transition duration-500 group-hover:scale-105"
                    />

                    <div className="absolute left-4 top-4 rounded-2xl bg-white px-3 py-2 text-center shadow-lg">
                      <span className="block text-xs font-black text-blue-700">
                        {data.mes}
                      </span>

                      <span className="block text-xl font-black text-slate-950">
                        {data.dia}
                      </span>
                    </div>

                    <div className="absolute right-4 top-4 rounded-full bg-slate-950/85 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                      🎟️ Ingressos
                    </div>
                  </Link>

                  <div className="p-6">
                    <p className="text-sm font-semibold text-slate-500">
                      {evento.local_evento || "Local a definir"}
                      {evento.hora_evento
                        ? ` • ${formatarHora(evento.hora_evento)}`
                        : ""}
                    </p>

                    <h3 className="mt-2 text-2xl font-black text-slate-950">
                      {evento.nome}
                    </h3>

                    {evento.descricao ? (
                      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-500">
                        {evento.descricao}
                      </p>
                    ) : null}

                    <p className="mt-4 text-sm font-bold text-blue-700">
                      A partir de {formatarMoeda(evento.menor_preco)}
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <Link
                        href={`/ingressos/${evento.slug}`}
                        className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-blue-500"
                      >
                        Comprar
                      </Link>

                      <Link
                        href="/listas"
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50"
                      >
                        Ver listas
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div>
            <p className="text-2xl font-black text-slate-950">
              Compra simples
            </p>

            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Escolha seu evento, seu ingresso e finalize em poucos passos.
            </p>
          </div>

          <div>
            <p className="text-2xl font-black text-slate-950">
              Ingresso digital
            </p>

            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Seu ingresso ficará disponível no celular para acesso ao evento.
            </p>
          </div>

          <div>
            <p className="text-2xl font-black text-slate-950">
              Tudo na Brava
            </p>

            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Ingressos, listas e gestão de eventos integrados em uma única
              plataforma.
            </p>
          </div>
        </div>
      </section>

      <footer className="bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-400 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>© 2026 Brava Entretenimento</p>

          <div className="flex flex-wrap gap-5">
            <Link href="/listas" className="hover:text-white">
              Listas
            </Link>

            <Link
              href="/politica-de-privacidade"
              className="hover:text-white"
            >
              Privacidade
            </Link>

            <Link href="/acessar" className="hover:text-white">
              Área Administrativa
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}