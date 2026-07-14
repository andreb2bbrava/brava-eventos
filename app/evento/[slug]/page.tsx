"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function normalizarVisibilidade(valor: string | null | undefined) {
  return (valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function visibilidadeEhPublica(valor: string | null | undefined) {
  const normalizado = normalizarVisibilidade(valor);
  return normalizado === "publica" || normalizado === "lista publica";
}

type ListaPublicaEvento = {
  id: number;
  nome: string;
  regra: string | null;
  slug: string | null;
  tipo_visibilidade: string | null;
  visibilidade: string | null;
  ativa: boolean;
};

function formatarDataHora(valor: string | null | undefined) {
  if (!valor) {
    return "-";
  }

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) {
    return valor;
  }

  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function obterInicioEvento(evento: any) {
  return evento?.inicio_evento || (evento?.data_evento && evento?.hora_evento ? `${evento.data_evento}T${evento.hora_evento}` : null);
}

export default function EventoPage() {
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";

  const [evento, setEvento] = useState<any>(null);
  const [listasPublicas, setListasPublicas] = useState<ListaPublicaEvento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarEvento() {
      if (!slug) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("eventos")
        .select("*")
        .eq("slug", slug)
        .single();

      setEvento(data);

      if (!data?.id) {
        setListasPublicas([]);
        setLoading(false);
        return;
      }

      const { data: listasData } = await supabase
        .from("listas_evento")
        .select("*")
        .eq("evento_id", data.id)
        .eq("ativa", true)
        .order("created_at", { ascending: false });

      const listasFiltradas = (listasData || []).filter((lista) => {
        return visibilidadeEhPublica(lista.tipo_visibilidade || lista.visibilidade) && !!lista.slug;
      });

      setListasPublicas(listasFiltradas as ListaPublicaEvento[]);
      setLoading(false);
    }

    carregarEvento();
  }, [slug]);

  if (loading) {

    return (

      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-4">

        <h1 className="text-2xl sm:text-4xl font-bold text-blue-900 text-center">
          Carregando evento...
        </h1>

      </main>
    );
  }

  if (!evento) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-4">
        <h1 className="text-2xl sm:text-4xl font-bold text-blue-900 text-center">Evento não encontrado.</h1>
      </main>
    );
  }

  return (

    <main className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden">
      <section className="w-full border-b border-blue-100 bg-white">
        {evento.banner_url ? (
          <img
            src={evento.banner_url}
            alt={evento.nome}
            className={`w-full h-auto max-h-[600px] object-cover ${
              evento.banner_posicao === "top"
                ? "object-top"
                : evento.banner_posicao === "bottom"
                ? "object-bottom"
                : "object-center"
            }`}
          />
        ) : (
          <div className="h-[220px] sm:h-[320px] w-full bg-blue-100" />
        )}
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="text-center text-3xl sm:text-5xl font-extrabold text-blue-900 leading-tight break-words">
          {evento.nome}
        </h1>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="rounded-3xl border border-blue-100 bg-white p-5 sm:p-7 shadow-sm space-y-2">
          <p className="text-base sm:text-lg text-slate-700">Início: {formatarDataHora(obterInicioEvento(evento))}</p>
          <p className="text-base sm:text-lg text-slate-700">Término: {formatarDataHora(evento.termino_evento)}</p>
          <p className="text-base sm:text-lg text-slate-700 break-words">Local: {evento.local_evento || "-"}</p>

          {evento.maps_url ? (
            <a
              href={evento.maps_url}
              target="_blank"
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 text-sm sm:text-base font-bold text-white transition hover:bg-blue-500"
            >
              Ver no Google Maps
            </a>
          ) : null}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-10">
        <div className="rounded-3xl border border-blue-100 bg-white p-5 sm:p-7 shadow-sm">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">Sobre o evento</h2>
          <p className="mt-4 whitespace-pre-line text-slate-700 leading-relaxed text-base sm:text-lg text-left">
            {evento.descricao || "Descrição não informada."}
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        {listasPublicas.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm sm:text-base text-slate-600 shadow-sm">
            Nenhuma lista disponível para este evento.
          </p>
        ) : (
          <div className="space-y-4">
            {listasPublicas.map((lista) => (
              <article key={lista.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xl sm:text-2xl font-bold text-blue-900 break-words">{lista.nome}</p>
                <p className="mt-2 text-slate-600 text-base">{lista.regra || "Regra não informada."}</p>

                <Link
                  href={`/evento/${evento.slug}/${lista.slug}`}
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-sm sm:text-base font-bold text-white transition hover:bg-emerald-500"
                >
                  Inscreva-se
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}