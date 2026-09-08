"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/app/components/AdminShell";
import { supabase } from "@/lib/supabase";
import { resolverNomeExibicaoUsuario } from "@/lib/usuarios";
import {
  isAdminRole,
  resolverRoleUsuario,
  type RoleUsuario,
} from "@/lib/roles";

type Operacao = {
  id: number;
  nome: string;
  slug: string;
  descricao: string | null;
  responsavel_id: string | null;
  ativa: boolean;
  created_at: string;
};

type Projeto = {
  id: number;
  operacao_id: number;
  nome: string;
  slug: string;
  descricao: string | null;
  responsavel_id: string | null;
  ativo: boolean;
  created_at: string;
};

type Modal =
  | { tipo: "nova-operacao" }
  | { tipo: "editar-operacao"; item: Operacao }
  | { tipo: "novo-projeto" }
  | { tipo: "editar-projeto"; item: Projeto }
  | null;

export default function OperacoesPage() {
  const router = useRouter();

  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [role, setRole] = useState<RoleUsuario | null>(null);
  const [nomeUsuario, setNomeUsuario] = useState("Usuario Brava");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [processando, setProcessando] = useState(false);

  const [nomeFormulario, setNomeFormulario] = useState("");
  const [descricaoFormulario, setDescricaoFormulario] = useState("");
  const [operacaoFormulario, setOperacaoFormulario] = useState<number | "">("");

  async function tokenSessao() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token || "";
  }

  async function carregarDados() {
    try {
      setLoading(true);
      setErro("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: usuario } = await supabase
        .from("usuarios")
        .select("id, nome, email, role")
        .eq("id", user.id)
        .single();

      const roleResolvida = resolverRoleUsuario(usuario?.role);

      if (!roleResolvida || !isAdminRole(roleResolvida)) {
        router.push("/admin");
        return;
      }

      setRole(roleResolvida);

      setNomeUsuario(
        resolverNomeExibicaoUsuario({
          nome: usuario?.nome,
          email: usuario?.email || user.email || null,
          metadata: user.user_metadata,
        })
      );

      const token = await tokenSessao();

      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/admin/operacoes", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Erro ao carregar operacoes.");
      }

      setOperacoes(result.operacoes || []);
      setProjetos(result.projetos || []);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao carregar estrutura operacional."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  const totalAtivos = useMemo(() => {
    return (
      operacoes.filter((item) => item.ativa).length +
      projetos.filter((item) => item.ativo).length
    );
  }, [operacoes, projetos]);

  function quantidadeProjetos(operacaoId: number) {
    return projetos.filter(
      (projeto) => projeto.operacao_id === operacaoId
    ).length;
  }

  function nomeOperacao(operacaoId: number) {
    return (
      operacoes.find((operacao) => operacao.id === operacaoId)?.nome ||
      "Operacao"
    );
  }

  function limparFormulario() {
    setNomeFormulario("");
    setDescricaoFormulario("");
    setOperacaoFormulario("");
  }

  function abrirNovaOperacao() {
    limparFormulario();
    setModal({ tipo: "nova-operacao" });
  }

  function abrirEdicaoOperacao(item: Operacao) {
    setNomeFormulario(item.nome);
    setDescricaoFormulario(item.descricao || "");
    setOperacaoFormulario("");
    setModal({ tipo: "editar-operacao", item });
  }

  function abrirNovoProjeto() {
    limparFormulario();
    setOperacaoFormulario(operacoes[0]?.id || "");
    setModal({ tipo: "novo-projeto" });
  }

  function abrirEdicaoProjeto(item: Projeto) {
    setNomeFormulario(item.nome);
    setDescricaoFormulario(item.descricao || "");
    setOperacaoFormulario(item.operacao_id);
    setModal({ tipo: "editar-projeto", item });
  }

  function fecharModal() {
    if (processando) return;
    setModal(null);
    limparFormulario();
  }

  function fecharModalAposSalvar() {
    setModal(null);
    limparFormulario();
  }

  async function salvarFormulario(event: FormEvent) {
    event.preventDefault();

    if (!modal || !nomeFormulario.trim()) {
      return;
    }

    const token = await tokenSessao();

    if (!token) {
      alert("Sua sessao expirou. Faca login novamente.");
      router.push("/login");
      return;
    }

    try {
      setProcessando(true);

      const editandoOperacao = modal.tipo === "editar-operacao";
      const criandoOperacao = modal.tipo === "nova-operacao";
      const ehOperacao = editandoOperacao || criandoOperacao;

      const endpoint = ehOperacao
        ? "/api/admin/operacoes"
        : "/api/admin/projetos";

      const method =
        modal.tipo === "editar-operacao" ||
        modal.tipo === "editar-projeto"
          ? "PATCH"
          : "POST";

      const body = ehOperacao
        ? {
            ...(editandoOperacao ? { id: modal.item.id } : {}),
            nome: nomeFormulario.trim(),
            descricao: descricaoFormulario.trim(),
          }
        : {
            ...(modal.tipo === "editar-projeto"
              ? { id: modal.item.id }
              : {}),
            operacaoId: Number(operacaoFormulario),
            nome: nomeFormulario.trim(),
            descricao: descricaoFormulario.trim(),
          };

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Nao foi possivel salvar.");
      }

      fecharModalAposSalvar();
      await carregarDados();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Erro ao salvar informacoes."
      );
    } finally {
      setProcessando(false);
    }
  }

  async function alternarOperacao(item: Operacao) {
    const token = await tokenSessao();

    if (!token) {
      alert("Sua sessao expirou. Faca login novamente.");
      router.push("/login");
      return;
    }

    const response = await fetch("/api/admin/operacoes", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: item.id,
        ativa: !item.ativa,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result?.error || "Nao foi possivel atualizar a operacao.");
      return;
    }

    await carregarDados();
  }

  async function alternarProjeto(item: Projeto) {
    const token = await tokenSessao();

    if (!token) {
      alert("Sua sessao expirou. Faca login novamente.");
      router.push("/login");
      return;
    }

    const response = await fetch("/api/admin/projetos", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: item.id,
        ativo: !item.ativo,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result?.error || "Nao foi possivel atualizar o projeto.");
      return;
    }

    await carregarDados();
  }

  return (
    <>
      <AdminShell
        role={role}
        userName={nomeUsuario}
        title="Gestão de Operações"
        subtitle="Estrutura administrativa da Tiketeira Brava."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Operações" },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={abrirNovaOperacao}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              + Nova Operação
            </button>

            <button
              type="button"
              onClick={abrirNovoProjeto}
              disabled={operacoes.length === 0}
              className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Novo Projeto
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          {erro ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
              {erro}
            </div>
          ) : null}

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Operações
              </p>
              <p className="mt-3 text-4xl font-black text-slate-950">
                {loading ? "—" : operacoes.length}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Estruturas operacionais cadastradas
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Projetos / Labels
              </p>
              <p className="mt-3 text-4xl font-black text-blue-700">
                {loading ? "—" : projetos.length}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Projetos vinculados às operações
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Estruturas Ativas
              </p>
              <p className="mt-3 text-4xl font-black text-emerald-600">
                {loading ? "—" : totalAtivos}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Operações e projetos ativos
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                Estrutura
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                Operações
              </h2>
            </div>

            {loading ? (
              <div className="p-8 text-sm text-slate-500">
                Carregando operações...
              </div>
            ) : operacoes.length === 0 ? (
              <div className="p-8 text-sm text-slate-500">
                Nenhuma operação cadastrada.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-6 py-4">Operação</th>
                      <th className="px-6 py-4">Projetos</th>
                      <th className="px-6 py-4">Responsável</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {operacoes.map((operacao) => (
                      <tr key={operacao.id} className="hover:bg-slate-50">
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-950">
                            {operacao.nome}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {operacao.slug}
                          </p>
                        </td>

                        <td className="px-6 py-5 font-semibold text-slate-700">
                          {quantidadeProjetos(operacao.id)}
                        </td>

                        <td className="px-6 py-5 text-sm text-slate-600">
                          {operacao.responsavel_id
                            ? "Responsável definido"
                            : "Não definido"}
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                              operacao.ativa
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {operacao.ativa ? "Ativa" : "Inativa"}
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => abrirEdicaoOperacao(operacao)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => alternarOperacao(operacao)}
                              className={`rounded-xl px-3 py-2 text-xs font-bold ${
                                operacao.ativa
                                  ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {operacao.ativa ? "Inativar" : "Reativar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                Organização
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                Projetos / Labels
              </h2>
            </div>

            {loading ? (
              <div className="p-8 text-sm text-slate-500">
                Carregando projetos...
              </div>
            ) : projetos.length === 0 ? (
              <div className="p-8 text-sm text-slate-500">
                Nenhum projeto cadastrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-6 py-4">Projeto</th>
                      <th className="px-6 py-4">Operação</th>
                      <th className="px-6 py-4">Responsável</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {projetos.map((projeto) => (
                      <tr key={projeto.id} className="hover:bg-slate-50">
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-950">
                            {projeto.nome}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {projeto.slug}
                          </p>
                        </td>

                        <td className="px-6 py-5 font-semibold text-slate-700">
                          {nomeOperacao(projeto.operacao_id)}
                        </td>

                        <td className="px-6 py-5 text-sm text-slate-600">
                          {projeto.responsavel_id
                            ? "Responsável definido"
                            : "Não definido"}
                        </td>

                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                              projeto.ativo
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {projeto.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => abrirEdicaoProjeto(projeto)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => alternarProjeto(projeto)}
                              className={`rounded-xl px-3 py-2 text-xs font-bold ${
                                projeto.ativo
                                  ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {projeto.ativo ? "Inativar" : "Reativar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </AdminShell>

      {modal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
                  Tiketeira Brava
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  {modal.tipo === "nova-operacao"
                    ? "Nova Operação"
                    : modal.tipo === "editar-operacao"
                    ? "Editar Operação"
                    : modal.tipo === "novo-projeto"
                    ? "Novo Projeto / Label"
                    : "Editar Projeto / Label"}
                </h2>
              </div>

              <button
                type="button"
                onClick={fecharModal}
                className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-600 hover:bg-slate-200"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={salvarFormulario} className="mt-6 space-y-5">
              {modal.tipo === "novo-projeto" ||
              modal.tipo === "editar-projeto" ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">
                    Operação
                  </span>
                  <select
                    required
                    value={operacaoFormulario}
                    onChange={(e) =>
                      setOperacaoFormulario(Number(e.target.value))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Selecione...</option>
                    {operacoes.map((operacao) => (
                      <option key={operacao.id} value={operacao.id}>
                        {operacao.nome}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Nome
                </span>
                <input
                  required
                  value={nomeFormulario}
                  onChange={(e) => setNomeFormulario(e.target.value)}
                  placeholder={
                    modal.tipo === "nova-operacao" ||
                    modal.tipo === "editar-operacao"
                      ? "Ex.: CAZA BRAVA"
                      : "Ex.: Samba in CAZA"
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Descrição
                </span>
                <textarea
                  value={descricaoFormulario}
                  onChange={(e) => setDescricaoFormulario(e.target.value)}
                  rows={4}
                  placeholder="Descrição opcional"
                  className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={fecharModal}
                  disabled={processando}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={processando}
                  className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {processando ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
