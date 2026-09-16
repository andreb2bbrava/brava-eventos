"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type UsuarioTiketeira = {
  nome: string | null;
  email: string | null;
  acesso_listas: boolean;
  acesso_tiketeira: boolean;
};

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

type DashboardResponse = {
  evento: Evento;
  resumo: Resumo;
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
        month: "short",
        year: "numeric",
      });
    }
  }

  if (evento.data_evento) {
    const data = new Date(`${evento.data_evento}T00:00:00`);

    if (!Number.isNaN(data.getTime())) {
      return data.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

    return evento.data_evento;
  }

  return "Data a definir";
}

export default function EventosTiketeiraPage() {
  const router = useRouter();

  const [usuario, setUsuario] =
    useState<UsuarioTiketeira | null>(null);

  const [evento, setEvento] = useState<Evento | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregar() {
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

      const { data: usuarioData, error: erroUsuario } =
        await supabase
          .from("usuarios")
          .select(
            "nome,email,acesso_listas,acesso_tiketeira"
          )
          .eq("id", session.user.id)
          .single();

      if (erroUsuario || !usuarioData) {
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
        email:
          usuarioData.email ||
          session.user.email ||
          null,
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

        const json = await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            json?.error ||
              "Não foi possível carregar os eventos."
          );
        }

        const dados = json as DashboardResponse;

        setEvento(dados.evento);
        setResumo(dados.resumo);
      } catch (error) {
        const mensagem =
          error instanceof Error
            ? error.message
            : "Erro inesperado.";

        console.warn(
          "Erro ao carregar eventos da Tiketeira:",
          mensagem
        );

        setErro(mensagem);
      } finally {
        setLoading(false);
      }
    }

    void carregar();
  }, [router]);

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
            Carregando eventos...
          </p>
        </div>
      </main>
    );
  }

  if (erro || !usuario) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">⚠️</div>

          <h1 className="mt-4 text-2xl font-black text-slate-900">
            Não foi possível carregar os eventos
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            {erro}
          </p>

          <Link
            href="/admin/tiketeira"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl bg-violet-700 px-6 py-3 font-bold text-white transition hover:bg-violet-600"
          >
            Voltar ao Dashboard
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

              <h1 className="text-lg font-black text-slate-950 sm:text-xl">
                Eventos
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/tiketeira"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              Dashboard
            </Link>

            {usuario.acesso_listas ? (
              <Link
                href="/admin/modulos"
                className="hidden min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 md:inline-flex"
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

      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        {/* CABEÇALHO */}

        <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-violet-600">
              Gestão da Tiketeira
            </p>

            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Eventos
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Acompanhe os eventos que utilizam a Tiketeira e
              acesse os resultados individuais de cada operação.
            </p>
          </div>

          <button
            type="button"
            disabled
            className="inline-flex min-h-12 cursor-not-allowed items-center justify-center rounded-2xl bg-violet-700 px-6 py-3 text-sm font-extrabold text-white opacity-60"
          >
            + Novo evento
          </button>
        </section>

        {/* HOMOLOGAÇÃO */}

        <section className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex gap-3">
            <span className="text-xl">🧪</span>

            <div>
              <p className="font-extrabold text-amber-900">
                Homologação da Tiketeira
              </p>

              <p className="mt-1 text-sm leading-6 text-amber-700">
                Nesta etapa somente o evento #28 está conectado
                ao módulo de vendas.
              </p>
            </div>
          </div>
        </section>

        {/* EVENTOS */}

        <section className="mt-7">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-950">
                Seus eventos
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                1 evento conectado à Tiketeira
              </p>
            </div>
          </div>

          {evento && resumo ? (
            <div className="grid gap-5 xl:grid-cols-2">
              <article className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                {/* CAPA */}

                <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-violet-950 to-violet-700 p-6 text-white sm:p-7">
                  <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-400/20 blur-3xl" />

                  <div className="relative">
                    <div className="flex items-start justify-between gap-4">
                      <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-violet-100">
                        Tiketeira ativa
                      </span>

                      <span className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black">
                        #{evento.id}
                      </span>
                    </div>

                    <h4 className="mt-6 text-2xl font-black sm:text-3xl">
                      {evento.nome}
                    </h4>

                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-violet-100">
                      <span>
                        📅 {formatarData(evento)}
                      </span>

                      <span>
                        🕙{" "}
                        {evento.hora_evento ||
                          "Horário a definir"}
                      </span>

                      <span>
                        📍{" "}
                        {evento.local_evento ||
                          "Local a definir"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* MÉTRICAS */}

                <div className="p-6 sm:p-7">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="rounded-2xl bg-emerald-50 p-4">
                      <p className="text-xs font-bold text-emerald-700">
                        Receita
                      </p>

                      <p className="mt-2 text-lg font-black text-emerald-900">
                        {formatarMoeda(
                          resumo.receita_confirmada
                        )}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-violet-50 p-4">
                      <p className="text-xs font-bold text-violet-700">
                        Vendidos
                      </p>

                      <p className="mt-2 text-lg font-black text-violet-900">
                        {resumo.ingressos_vendidos}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-amber-50 p-4">
                      <p className="text-xs font-bold text-amber-700">
                        Pendentes
                      </p>

                      <p className="mt-2 text-lg font-black text-amber-900">
                        {resumo.pedidos_pendentes}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-100 p-4">
                      <p className="text-xs font-bold text-slate-600">
                        Capacidade
                      </p>

                      <p className="mt-2 text-lg font-black text-slate-900">
                        {resumo.capacidade_total}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                        Receita pendente
                      </p>

                      <p className="mt-1 text-lg font-black text-amber-600">
                        {formatarMoeda(
                          resumo.receita_pendente
                        )}
                      </p>
                    </div>

                    <Link
                      href={`/admin/tiketeira/eventos/${evento.id}`}
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-violet-700 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-violet-600"
                    >
                      Abrir evento →
                    </Link>
                  </div>
                </div>
              </article>
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <div className="text-4xl">🎟️</div>

              <h3 className="mt-4 text-xl font-black text-slate-800">
                Nenhum evento conectado
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Ainda não existem eventos disponíveis na
                Tiketeira.
              </p>
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