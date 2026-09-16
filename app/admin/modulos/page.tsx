"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ModulosUsuario = {
  nome: string | null;
  email: string | null;
  role: string | null;
  acesso_listas: boolean;
  acesso_tiketeira: boolean;
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

export default function ModulosPage() {
  const router = useRouter();

  const [usuario, setUsuario] = useState<ModulosUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregarUsuario() {
      setLoading(true);
      setErro("");

      const {
        data: { user },
        error: erroAuth,
      } = await supabase.auth.getUser();

      if (erroAuth || !user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("usuarios")
        .select(
          "nome,email,role,acesso_listas,acesso_tiketeira"
        )
        .eq("id", user.id)
        .single();

      if (error || !data) {
        console.error("Erro ao carregar módulos do usuário:", error);
        setErro(
          "Não foi possível carregar seus acessos. Tente novamente."
        );
        setLoading(false);
        return;
      }

      setUsuario({
        nome: data.nome || null,
        email: data.email || user.email || null,
        role: data.role || null,
        acesso_listas: data.acesso_listas === true,
        acesso_tiketeira: data.acesso_tiketeira === true,
      });

      setLoading(false);
    }

    void carregarUsuario();
  }, [router]);

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />

          <p className="mt-5 font-semibold text-slate-600">
            Carregando Central Brava...
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
            Não foi possível carregar a Central
          </h1>

          <p className="mt-3 text-sm text-slate-500">
            {erro || "Usuário não identificado."}
          </p>

          <Link
            href="/admin"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-700 px-6 py-3 font-bold text-white transition hover:bg-blue-600"
          >
            Voltar
          </Link>
        </div>
      </main>
    );
  }

  const possuiListas = usuario.acesso_listas;
  const possuiTiketeira = usuario.acesso_tiketeira;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* TOPO */}

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-blue-50">
              <img
                src="/logo.png"
                alt="Brava"
                className="h-10 w-10 object-contain"
              />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-600">
                Brava Entretenimento
              </p>

              <h1 className="truncate text-lg font-black text-blue-950 sm:text-xl">
                Central de Operações
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={sair}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {/* APRESENTAÇÃO */}

        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 px-6 py-9 text-white shadow-[0_25px_80px_rgba(15,23,42,0.22)] sm:px-10 sm:py-12">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute -bottom-20 left-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

          <div className="relative z-10">
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-100">
              Central Brava
            </span>

            <h2 className="mt-5 max-w-3xl text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
              {saudacaoAgora()}, {primeiroNome(usuario.nome)}.
            </h2>

            <p className="mt-3 max-w-2xl text-base leading-7 text-blue-100 sm:text-lg">
              Escolha o ambiente que deseja acessar.
              Cada módulo possui sua própria operação, mantendo tudo
              organizado dentro da mesma plataforma.
            </p>
          </div>
        </section>

        {/* MÓDULOS */}

        <section className="mt-8">
          <div className="mb-5">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-600">
              Seus ambientes
            </p>

            <h2 className="mt-1 text-2xl font-black text-blue-950">
              Onde vamos trabalhar?
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* LISTAS */}

            {possuiListas ? (
              <Link
                href="/admin"
                className="group relative overflow-hidden rounded-[2rem] border border-blue-100 bg-white p-6 shadow-[0_18px_55px_rgba(148,163,184,0.14)] transition duration-300 hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_24px_70px_rgba(37,99,235,0.15)] sm:p-8"
              >
                <div className="flex items-start justify-between gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
                    📋
                  </div>

                  <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
                    Ativo
                  </span>
                </div>

                <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.16em] text-blue-600">
                  Gestão de Eventos
                </p>

                <h3 className="mt-2 text-3xl font-black text-blue-950">
                  Listas & Operação
                </h3>

                <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">
                  Gerencie eventos, listas de convidados, participantes,
                  inteligência operacional e entrada do público.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-2 text-sm font-semibold text-slate-600 sm:grid-cols-4">
                  <span className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                    Listas
                  </span>
                  <span className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                    Participantes
                  </span>
                  <span className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                    Check-in
                  </span>
                  <span className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                    Inteligência
                  </span>
                </div>

                <div className="mt-8 flex min-h-12 items-center justify-between rounded-2xl bg-blue-700 px-5 py-3 font-extrabold text-white transition group-hover:bg-blue-600">
                  <span>Acessar Gestão de Eventos</span>
                  <span className="text-xl transition group-hover:translate-x-1">
                    →
                  </span>
                </div>
              </Link>
            ) : null}

            {/* TIKETEIRA */}

            {possuiTiketeira ? (
              <Link
                href="/admin/tiketeira"
                className="group relative overflow-hidden rounded-[2rem] border border-violet-100 bg-white p-6 shadow-[0_18px_55px_rgba(148,163,184,0.14)] transition duration-300 hover:-translate-y-1 hover:border-violet-300 hover:shadow-[0_24px_70px_rgba(124,58,237,0.15)] sm:p-8"
              >
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-100/60 blur-3xl" />

                <div className="relative">
                  <div className="flex items-start justify-between gap-5">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-3xl">
                      🎟️
                    </div>

                    <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-extrabold text-violet-700">
                      Novo
                    </span>
                  </div>

                  <p className="mt-7 text-xs font-extrabold uppercase tracking-[0.16em] text-violet-600">
                    Brava Tiketeira
                  </p>

                  <h3 className="mt-2 text-3xl font-black text-slate-950">
                    Vendas & Ingressos
                  </h3>

                  <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">
                    Acompanhe vendas, pedidos, ingressos, lotes,
                    faturamento e indicadores financeiros dos eventos.
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-2 text-sm font-semibold text-slate-600 sm:grid-cols-4">
                    <span className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                      Vendas
                    </span>
                    <span className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                      Pedidos
                    </span>
                    <span className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                      Ingressos
                    </span>
                    <span className="rounded-xl bg-slate-50 px-3 py-2 text-center">
                      Financeiro
                    </span>
                  </div>

                  <div className="mt-8 flex min-h-12 items-center justify-between rounded-2xl bg-violet-700 px-5 py-3 font-extrabold text-white transition group-hover:bg-violet-600">
                    <span>Acessar Tiketeira</span>
                    <span className="text-xl transition group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                </div>
              </Link>
            ) : null}
          </div>

          {!possuiListas && !possuiTiketeira ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
              <h3 className="font-extrabold">
                Nenhum módulo disponível
              </h3>

              <p className="mt-2 text-sm">
                Seu usuário ainda não possui acesso a nenhum ambiente
                da plataforma.
              </p>
            </div>
          ) : null}
        </section>

        {/* RODAPÉ */}

        <footer className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
          Brava Entretenimento • Central de Operações
        </footer>
      </div>
    </main>
  );
}