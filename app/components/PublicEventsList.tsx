"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type EventoPublico = {
  id: number;
  nome: string;
  slug: string;
  data_evento: string | null;
  local_evento: string | null;
  tipo_lista: string | null;
  banner_url?: string | null;
  banner_posicao?: string | null;
};

type PublicEventsListProps = {
  hideHeader?: boolean;
};

export default function PublicEventsList({ hideHeader }: PublicEventsListProps) {
  const [eventos, setEventos] = useState<EventoPublico[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarEventos() {
      setLoading(true);

      const response = await fetch("/api/eventos-publicos", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        setEventos([]);
        setLoading(false);
        return;
      }

      const result = await response.json();
      setEventos((result?.eventos || []) as EventoPublico[]);

      setLoading(false);
    }

    carregarEventos();
  }, []);

  const eventosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) {
      return eventos;
    }

    return eventos.filter((evento) =>
      evento.nome?.toLowerCase().includes(termo)
    );
  }, [busca, eventos]);

  function formatarData(data: string | null) {
    if (!data) {
      return "Data a definir";
    }

    const dataObj = new Date(`${data}T00:00:00`);

    if (Number.isNaN(dataObj.getTime())) {
      return data;
    }

    return dataObj.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {!hideHeader ? (
        <section className="border-b border-blue-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-24">
            <div className="max-w-3xl">
              <p className="text-xs sm:text-sm uppercase tracking-[0.2em] sm:tracking-[0.3em] text-blue-700 font-semibold break-words">
                Brava Entretenimento
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-blue-900 mt-3 break-words">
                Eventos disponiveis
              </h1>
              <p className="mt-4 text-base sm:text-lg text-slate-600">
                Encontre o evento e faca sua inscricao.
              </p>
            </div>

            <div className="mt-8 max-w-2xl">
              <label htmlFor="buscar-evento" className="block text-sm font-semibold text-slate-600 mb-2">
                Pesquisar evento
              </label>
              <input
                id="buscar-evento"
                type="text"
                placeholder="Pesquisar evento..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </section>
      ) : (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <div className="mt-8 max-w-2xl">
            <label htmlFor="buscar-evento" className="block text-sm font-semibold text-slate-600 mb-2">
              Pesquisar evento
            </label>
            <input
              id="buscar-evento"
              type="text"
              placeholder="Pesquisar evento..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-blue-500"
            />
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        {loading ? (
          <div className="rounded-3xl border border-blue-200 bg-white p-10 text-center text-slate-500">
            Carregando eventos...
          </div>
        ) : eventosFiltrados.length === 0 ? (
          <div className="rounded-3xl border border-blue-200 bg-white p-10 text-center text-slate-500">
            Nenhum evento futuro disponivel no momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {eventosFiltrados.map((evento) => (
              <article
                key={evento.id}
                className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm"
              >
                <div className="h-40 bg-gradient-to-br from-blue-100 to-blue-50">
                  {evento.banner_url ? (
                    <img
                      src={evento.banner_url}
                      alt={evento.nome}
                      className={`h-full w-full object-cover ${
                        evento.banner_posicao === "top"
                          ? "object-top"
                          : evento.banner_posicao === "bottom"
                          ? "object-bottom"
                          : "object-center"
                      }`}
                    />
                  ) : null}
                </div>

                <div className="p-6">
                  <h2 className="text-2xl font-bold text-blue-900">{evento.nome}</h2>
                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <p>📅 {formatarData(evento.data_evento)}</p>
                    <p>📍 {evento.local_evento || "Local a definir"}</p>
                    {evento.tipo_lista ? <p>🎟️ {evento.tipo_lista}</p> : null}
                  </div>

                  <Link
                    href={`/evento/${evento.slug}`}
                    className="mt-6 inline-flex w-full sm:w-auto items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-500 min-h-11"
                  >
                    Ver evento
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
