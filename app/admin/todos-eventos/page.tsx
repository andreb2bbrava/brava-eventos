"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminShell from "@/app/components/AdminShell";
import { supabase } from "@/lib/supabase";
import { isAdminRole, resolverRoleUsuario, type RoleUsuario } from "@/lib/roles";

type EventoBase = {
  id: number;
  nome: string;
  slug: string | null;
  data_evento: string | null;
  hora_evento: string | null;
  local_evento: string | null;
  banner_url: string | null;
  criador_id: string | null;
};

type EventoLinha = {
  id: number;
  nome: string;
  slug: string | null;
  data_evento: string | null;
  hora_evento: string | null;
  local_evento: string | null;
  banner_url: string | null;
  produtor: string;
  quantidadeListas: number;
  quantidadeParticipantes: number;
  status: string;
};

type RespostaTodosEventos = {
  totalBanco: number;
  eventos: EventoLinha[];
};

function ehRespostaTodosEventos(valor: unknown): valor is RespostaTodosEventos {
  if (!valor || typeof valor !== "object") {
    return false;
  }

  const payload = valor as { totalBanco?: unknown; eventos?: unknown };
  return typeof payload.totalBanco === "number" && Array.isArray(payload.eventos);
}

function normalizarSlug(slug: string | null | undefined) {
  return String(slug || "").trim();
}

function formatarDataHora(data: string | null, hora: string | null) {
  if (!data) {
    return "Data a definir";
  }

  const horario = hora && hora.trim() ? hora : "00:00";
  const dataObj = new Date(`${data}T${horario}`);

  if (Number.isNaN(dataObj.getTime())) {
    return data;
  }

  return dataObj.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function TodosEventosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [acessoNegado, setAcessoNegado] = useState(false);
  const [roleUsuario, setRoleUsuario] = useState<RoleUsuario | null>(null);
  const [eventos, setEventos] = useState<EventoLinha[]>([]);

  useEffect(() => {
    async function carregarDados() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: usuarioData } = await supabase
        .from("usuarios")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const role = resolverRoleUsuario(usuarioData?.role || null);
      setRoleUsuario(role);

      if (!isAdminRole(role)) {
        setAcessoNegado(true);
        setLoading(false);
        return;
      }

      setAcessoNegado(false);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setAcessoNegado(true);
        setLoading(false);
        return;
      }

      const response = await fetch("/api/todos-eventos", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = (await response.json()) as unknown;

      if (!response.ok || !ehRespostaTodosEventos(result)) {
        setAcessoNegado(true);
        setLoading(false);
        return;
      }

      const eventosLinha = result.eventos;
      const totalBanco = result.totalBanco;

      console.log("Quantidade de eventos encontrados no banco:", totalBanco);
      console.log("Quantidade exibida na tela:", eventosLinha.length);

      setEventos(eventosLinha);
      setLoading(false);
    }

    carregarDados();
  }, [router]);

  const totalEventos = useMemo(() => eventos.length, [eventos]);

  if (acessoNegado) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <div className="max-w-xl text-center">
          <h1 className="text-3xl font-bold">Acesso negado</h1>
          <p className="text-slate-600 mt-3">Apenas Administrador Geral e Proprietario da Plataforma podem acessar esta tela.</p>
          <Link
            href="/admin"
            className="inline-block mt-6 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold"
          >
            Voltar ao painel
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <h1 className="text-3xl font-bold">Carregando eventos...</h1>
      </main>
    );
  }

  return (
    <AdminShell
      role={roleUsuario}
      title="Todos os Eventos"
      subtitle="Visao global da plataforma com todos os eventos cadastrados."
      breadcrumbs={[{ label: "Inicio", href: "/admin" }, { label: "Todos os Eventos" }]}
      backLink={{ href: "/admin", label: "Voltar para Inicio" }}
      aside={{
        title: "Todos os Eventos",
        description: "Esta tela mostra todos os eventos da plataforma, sem filtros por produtor ou usuario vinculado.",
      }}
    >
      <section className="space-y-5">
        <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total de eventos cadastrados</p>
          <h2 className="mt-2 text-4xl font-bold text-blue-900">{totalEventos}</h2>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-blue-100 bg-white shadow-sm">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-blue-50 text-slate-700">
              <tr>
                <th className="p-4 text-left">Banner</th>
                <th className="p-4 text-left">Nome do evento</th>
                <th className="p-4 text-left">Produtor responsavel</th>
                <th className="p-4 text-left">Data</th>
                <th className="p-4 text-left">Local</th>
                <th className="p-4 text-left">Quantidade de listas</th>
                <th className="p-4 text-left">Quantidade de participantes</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-left">Abrir</th>
              </tr>
            </thead>

            <tbody>
              {eventos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-sm text-slate-500">
                    Nenhum evento cadastrado.
                  </td>
                </tr>
              ) : (
                eventos.map((evento) => {
                  const slug = normalizarSlug(evento.slug);

                  return (
                    <tr key={evento.id} className="border-t border-slate-200">
                      <td className="p-4">
                        {evento.banner_url ? (
                          <img src={evento.banner_url} alt={evento.nome} className="h-14 w-24 rounded-lg object-cover" />
                        ) : (
                          <span className="inline-flex h-14 w-24 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">
                            Sem banner
                          </span>
                        )}
                      </td>

                      <td className="p-4 font-semibold text-slate-900">{evento.nome}</td>
                      <td className="p-4 text-slate-700">{evento.produtor}</td>
                      <td className="p-4 text-slate-700">{formatarDataHora(evento.data_evento, evento.hora_evento)}</td>
                      <td className="p-4 text-slate-700">{evento.local_evento || "-"}</td>
                      <td className="p-4 text-slate-700">{evento.quantidadeListas}</td>
                      <td className="p-4 text-slate-700">{evento.quantidadeParticipantes}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                            evento.status === "Em andamento"
                              ? "bg-emerald-100 text-emerald-700"
                              : evento.status === "Agendado"
                              ? "bg-blue-100 text-blue-700"
                              : evento.status === "Encerrado"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {evento.status}
                        </span>
                      </td>

                      <td className="p-4">
                        {slug ? (
                          <Link
                            href={`/admin/eventos/${slug}`}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500"
                          >
                            Abrir
                          </Link>
                        ) : (
                          <span className="text-xs font-semibold text-amber-700">Sem slug</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
