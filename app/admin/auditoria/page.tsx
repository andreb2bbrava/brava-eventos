"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/app/components/AdminShell";
import { supabase } from "@/lib/supabase";
import { isPlatformOwner, roleLabel, type RoleUsuario } from "@/lib/roles";
import { resolverNomeExibicaoUsuario } from "@/lib/usuarios";

type AuditLogRow = {
  id: number;
  created_at: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  usuario_email: string | null;
  usuario_role: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  evento_id: number | null;
  lista_id: number | null;
  participante_id: number | null;
  descricao: string | null;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  evento_nome?: string | null;
};

const PAGE_SIZE = 20;

export default function AuditoriaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [carregandoTabela, setCarregandoTabela] = useState(false);
  const [nomeUsuarioLogado, setNomeUsuarioLogado] = useState("Usuario Brava");
  const [roleUsuarioLogado, setRoleUsuarioLogado] = useState<RoleUsuario | null>(null);
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [erro, setErro] = useState("");

  const [search, setSearch] = useState("");
  const [periodo, setPeriodo] = useState("7");
  const [usuarioFiltro, setUsuarioFiltro] = useState("");
  const [roleFiltro, setRoleFiltro] = useState("");
  const [acaoFiltro, setAcaoFiltro] = useState("");
  const [entidadeFiltro, setEntidadeFiltro] = useState("");
  const [eventoIdFiltro, setEventoIdFiltro] = useState("");

  const [logSelecionado, setLogSelecionado] = useState<AuditLogRow | null>(null);

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const paramsQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    if (search.trim()) params.set("search", search.trim());
    if (periodo) params.set("periodo", periodo);
    if (usuarioFiltro.trim()) params.set("usuario", usuarioFiltro.trim());
    if (roleFiltro.trim()) params.set("role", roleFiltro.trim());
    if (acaoFiltro.trim()) params.set("acao", acaoFiltro.trim());
    if (entidadeFiltro.trim()) params.set("entidade", entidadeFiltro.trim());
    if (eventoIdFiltro.trim()) params.set("eventoId", eventoIdFiltro.trim());
    return params.toString();
  }, [acaoFiltro, entidadeFiltro, eventoIdFiltro, page, periodo, roleFiltro, search, usuarioFiltro]);

  async function carregarLogs() {
    setCarregandoTabela(true);
    setErro("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      router.push("/login");
      return;
    }

    const response = await fetch(`/api/auditoria?${paramsQuery}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      setErro(result.error || "Nao foi possivel carregar os logs.");
      setLogs([]);
      setTotal(0);
      setCarregandoTabela(false);
      return;
    }

    setLogs((result.rows || []) as AuditLogRow[]);
    setTotal(Number(result.total || 0));
    setCarregandoTabela(false);
  }

  useEffect(() => {
    async function validarAcesso() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: usuarioData } = await supabase
        .from("usuarios")
        .select("role, nome, email")
        .eq("id", user.id)
        .single();

      setNomeUsuarioLogado(
        resolverNomeExibicaoUsuario({
          nome: usuarioData?.nome,
          email: usuarioData?.email || user.email || null,
          metadata: user.user_metadata,
        })
      );

      const role = (usuarioData?.role as RoleUsuario | null) ?? null;
      setRoleUsuarioLogado(role);

      if (!isPlatformOwner(role)) {
        router.push("/admin");
        return;
      }

      setLoading(false);
    }

    validarAcesso();
  }, [router]);

  useEffect(() => {
    if (!loading && isPlatformOwner(roleUsuarioLogado)) {
      carregarLogs();
    }
  }, [loading, paramsQuery, roleUsuarioLogado]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
        <h1 className="text-2xl font-bold">Carregando auditoria...</h1>
      </main>
    );
  }

  return (
    <AdminShell
      role={roleUsuarioLogado}
      userName={nomeUsuarioLogado}
      title="Logs de Auditoria"
      subtitle="Rastreie acoes criticas da plataforma com filtros, pesquisa e historico permanente."
      breadcrumbs={[{ label: "Inicio", href: "/admin" }, { label: "Auditoria" }]}
      backLink={{ href: "/admin", label: "Voltar para Inicio" }}
    >
      <div className="space-y-6">
        <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Total de registros</p>
          <h2 className="mt-2 text-4xl font-extrabold text-blue-900">{total}</h2>
        </section>

        <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-blue-900">Filtros</h2>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input className="ui-field" placeholder="Pesquisa geral" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="ui-field" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              <option value="7">Ultimos 7 dias</option>
              <option value="30">Ultimos 30 dias</option>
              <option value="90">Ultimos 90 dias</option>
              <option value="all">Todo periodo</option>
            </select>
            <input className="ui-field" placeholder="Usuario (nome/email)" value={usuarioFiltro} onChange={(e) => setUsuarioFiltro(e.target.value)} />
            <select className="ui-field" value={roleFiltro} onChange={(e) => setRoleFiltro(e.target.value)}>
              <option value="">Todas as funcoes</option>
              <option value="platform_owner">{roleLabel("platform_owner")}</option>
              <option value="super_admin">{roleLabel("super_admin")}</option>
              <option value="produtor">{roleLabel("produtor")}</option>
              <option value="staff">{roleLabel("staff")}</option>
            </select>
            <input className="ui-field" placeholder="Acao (ex: evento_criado)" value={acaoFiltro} onChange={(e) => setAcaoFiltro(e.target.value)} />
            <input className="ui-field" placeholder="Entidade (ex: evento)" value={entidadeFiltro} onChange={(e) => setEntidadeFiltro(e.target.value)} />
            <input className="ui-field" placeholder="Evento ID" value={eventoIdFiltro} onChange={(e) => setEventoIdFiltro(e.target.value)} />
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPeriodo("7");
                setUsuarioFiltro("");
                setRoleFiltro("");
                setAcaoFiltro("");
                setEntidadeFiltro("");
                setEventoIdFiltro("");
                setPage(1);
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Limpar filtros
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-blue-100 bg-white p-4 sm:p-6 shadow-sm">
          {erro ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{erro}</p> : null}

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="px-3 py-3">Data e horario</th>
                  <th className="px-3 py-3">Usuario</th>
                  <th className="px-3 py-3">Funcao</th>
                  <th className="px-3 py-3">Acao</th>
                  <th className="px-3 py-3">Entidade</th>
                  <th className="px-3 py-3">Evento</th>
                  <th className="px-3 py-3">Descricao</th>
                </tr>
              </thead>
              <tbody>
                {carregandoTabela ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-slate-500">Carregando registros...</td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-slate-500">Nenhum registro encontrado.</td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      className="cursor-pointer border-b border-slate-100 hover:bg-blue-50/40"
                      onClick={() => setLogSelecionado(log)}
                    >
                      <td className="px-3 py-3 text-sm text-slate-700">{new Date(log.created_at).toLocaleString("pt-BR")}</td>
                      <td className="px-3 py-3 text-sm text-slate-700">{log.usuario_nome || log.usuario_email || "Sistema"}</td>
                      <td className="px-3 py-3 text-sm text-slate-700">{roleLabel(log.usuario_role)}</td>
                      <td className="px-3 py-3 text-sm font-semibold text-blue-900">{log.acao}</td>
                      <td className="px-3 py-3 text-sm text-slate-700">{log.entidade}</td>
                      <td className="px-3 py-3 text-sm text-slate-700">{log.evento_nome || (log.evento_id ? `#${log.evento_id}` : "-")}</td>
                      <td className="px-3 py-3 text-sm text-slate-700">{log.descricao || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">Pagina {page} de {totalPaginas}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= totalPaginas}
                onClick={() => setPage((prev) => Math.min(totalPaginas, prev + 1))}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Proxima
              </button>
            </div>
          </div>
        </section>

        {logSelecionado ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onClick={() => setLogSelecionado(null)}>
            <div
              className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-2xl font-extrabold text-blue-900">Detalhes do Log</h3>
                <button type="button" onClick={() => setLogSelecionado(null)} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
                  Fechar
                </button>
              </div>

              <div className="mt-5 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                <p><strong>Data e horario:</strong> {new Date(logSelecionado.created_at).toLocaleString("pt-BR")}</p>
                <p><strong>Usuario:</strong> {logSelecionado.usuario_nome || "Sistema"}</p>
                <p><strong>Email:</strong> {logSelecionado.usuario_email || "-"}</p>
                <p><strong>Role:</strong> {roleLabel(logSelecionado.usuario_role)}</p>
                <p><strong>Acao:</strong> {logSelecionado.acao}</p>
                <p><strong>Entidade:</strong> {logSelecionado.entidade}</p>
                <p><strong>Entidade ID:</strong> {logSelecionado.entidade_id || "-"}</p>
                <p><strong>Evento ID:</strong> {logSelecionado.evento_id || "-"}</p>
                <p><strong>Lista ID:</strong> {logSelecionado.lista_id || "-"}</p>
                <p><strong>Participante ID:</strong> {logSelecionado.participante_id || "-"}</p>
                <p className="md:col-span-2"><strong>Descricao:</strong> {logSelecionado.descricao || "-"}</p>
                <p className="md:col-span-2"><strong>User Agent:</strong> {logSelecionado.user_agent || "-"}</p>
                <p className="md:col-span-2"><strong>IP:</strong> {logSelecionado.ip || "-"}</p>
              </div>

              {logSelecionado.dados_anteriores ? (
                <div className="mt-5">
                  <p className="mb-2 text-sm font-bold text-slate-700">Dados anteriores</p>
                  <pre className="overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                    {JSON.stringify(logSelecionado.dados_anteriores, null, 2)}
                  </pre>
                </div>
              ) : null}

              {logSelecionado.dados_novos ? (
                <div className="mt-5">
                  <p className="mb-2 text-sm font-bold text-slate-700">Dados novos</p>
                  <pre className="overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                    {JSON.stringify(logSelecionado.dados_novos, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
