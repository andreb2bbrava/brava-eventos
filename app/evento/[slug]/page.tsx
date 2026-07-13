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

export default function EventoPage() {
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";

  const [evento, setEvento] =
    useState<any>(null);

  const [listasPublicas, setListasPublicas] = useState<any[]>([]);

  const [nome, setNome] =
    useState("");

  const [telefone, setTelefone] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [listaNomes, setListaNomes] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {

    async function carregarEvento() {
      if (!slug) {
        return;
      }

      const {
        data,
      } = await supabase
        .from("eventos")
        .select("*")
        .eq("slug", slug)
        .single();

      setEvento(data);

      if (!data?.id) {
        setListasPublicas([]);
        return;
      }

      const { data: listasData } = await supabase
        .from("listas_evento")
        .select("id, nome, regra, slug, tipo_visibilidade, visibilidade, ativa")
        .eq("evento_id", data.id)
        .eq("ativa", true)
        .order("created_at", { ascending: false });

      const listasFiltradas = (listasData || []).filter((lista) => {
        return visibilidadeEhPublica(lista.tipo_visibilidade || lista.visibilidade) && !!lista.slug;
      });

      setListasPublicas(listasFiltradas);
    }

    carregarEvento();

  }, [slug]);

  async function confirmarPresenca() {

    if (!evento) return;

    setLoading(true);

    const convidados =
      listaNomes
        .split("\n")
        .map((nome) =>
          nome.trim()
        )
        .filter(Boolean);

    const participantes = [

      {
        nome,
        whatsapp: telefone,
        email,
        presente: false,
        evento_id: evento.id,
      },

      ...convidados.map(
        (nome) => ({
          nome,
          presente: false,
          evento_id: evento.id,
        })
      ),
    ];

    const { error } =
      await supabase
        .from("participantes")
        .insert(participantes);

    setLoading(false);

    if (error) {

      console.log(error);

      alert(
        "Erro ao confirmar presença"
      );

      return;
    }

    alert(
      "Presença confirmada!"
    );

    setNome("");
    setTelefone("");
    setEmail("");
    setListaNomes("");
  }

  if (!evento) {

    return (

      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-4">

        <h1 className="text-2xl sm:text-4xl font-bold text-blue-900 text-center">
          Carregando evento...
        </h1>

      </main>
    );
  }

  return (

    <main className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden">

      {/* BANNER */}

      <div className="relative min-h-[360px] md:h-[500px] border-b border-blue-100 bg-white">

        <img
          src={evento.banner_url}
          alt={evento.nome}
          className={`w-full h-full object-cover ${
            evento.banner_posicao === "top"
              ? "object-top"
              : evento.banner_posicao === "bottom"
              ? "object-bottom"
              : "object-center"
          }`}
        />

        <div className="absolute inset-0 bg-white/60" />

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 sm:p-6">

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-blue-900 mb-4 break-words">
            {evento.nome}
          </h1>

          <p className="text-base sm:text-xl md:text-2xl mb-2 text-slate-700">
            📅 {evento.data_evento}
          </p>

          <p className="text-base sm:text-xl md:text-2xl mb-2 text-slate-700">
            🕒 {evento.hora_evento}
          </p>

          <p className="text-base sm:text-xl md:text-2xl mb-6 text-slate-700 break-words">
            📍 {evento.local_evento}
          </p>

          {evento.maps_url && (

            <a
              href={evento.maps_url}
              target="_blank"
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold text-base sm:text-lg transition min-h-11"
            >
              VER LOCALIZAÇÃO
            </a>

          )}

        </div>

      </div>

      {/* FORMULÁRIO */}

      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white border border-blue-100 rounded-3xl p-5 sm:p-8 shadow-sm">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">Listas Públicas</h2>
          <p className="mt-2 text-sm sm:text-base text-slate-600">
            Selecione uma lista pública para realizar cadastro de participantes.
          </p>

          {listasPublicas.length === 0 ? (
            <p className="mt-5 text-sm text-slate-500">Nenhuma lista pública ativa disponível no momento.</p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {listasPublicas.map((lista) => (
                <Link
                  key={lista.id}
                  href={`/evento/${evento.slug}/${lista.slug}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-300 hover:bg-blue-50"
                >
                  <p className="text-base font-bold text-blue-900">{lista.nome}</p>
                  <p className="mt-1 text-sm text-slate-600">Regra: {lista.regra || "-"}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">

        <div className="bg-white border border-blue-100 rounded-3xl p-5 sm:p-8 shadow-sm">

          <h2 className="text-2xl sm:text-4xl font-bold text-center text-blue-900 mb-6 sm:mb-8">
            Confirmar Presença
          </h2>

          <div className="space-y-5">

            <input
              type="text"
              placeholder="Seu nome"
              value={nome}
              onChange={(e) =>
                setNome(
                  e.target.value
                )
              }
              className="w-full p-4 rounded-xl border border-slate-200 bg-white text-slate-900"
            />

            <input
              type="text"
              placeholder="Telefone"
              value={telefone}
              onChange={(e) =>
                setTelefone(
                  e.target.value
                )
              }
              className="w-full p-4 rounded-xl border border-slate-200 bg-white text-slate-900"
            />

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              className="w-full p-4 rounded-xl border border-slate-200 bg-white text-slate-900"
            />

            <textarea
              placeholder="Digite o nome dos amigos (1 por linha)"
              value={listaNomes}
              onChange={(e) =>
                setListaNomes(
                  e.target.value
                )
              }
              className="w-full p-4 rounded-xl border border-slate-200 bg-white text-slate-900 h-36 sm:h-40"
            />

            <button
              onClick={
                confirmarPresenca
              }
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white p-4 sm:p-5 rounded-xl font-extrabold text-base sm:text-lg min-h-11"
            >

              {loading
                ? "CONFIRMANDO..."
                : "CONFIRMAR PRESENÇA"}

            </button>

          </div>

        </div>

      </section>

    </main>
  );
}