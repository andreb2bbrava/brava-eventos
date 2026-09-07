"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/app/components/AdminShell";
import { resolverNomeExibicaoUsuario } from "@/lib/usuarios";
import { isAdminRole, isPlatformOwner, roleLabel, type RoleUsuario } from "@/lib/roles";

type UsuarioSistema = {
  id: string;
  nome: string | null;
  email: string;
  role: RoleUsuario;
  created_at?: string;
};

function roleAmigavel(role: string) {
  return roleLabel(role);
}

function nomeCompletoUsuario(usuario: UsuarioSistema) {
  return resolverNomeExibicaoUsuario({
    nome: usuario.nome,
    email: usuario.email,
  });
}

export default function SuperAdminPage() {
  const router = useRouter();

  const [eventos, setEventos] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [buscaEventos, setBuscaEventos] = useState("");
  const [buscaUsuarios, setBuscaUsuarios] = useState("");

  const [novoEmail, setNovoEmail] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [novaRole, setNovaRole] = useState<RoleUsuario>("produtor");

  const [usuarioEditandoId, setUsuarioEditandoId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [emailEdicao, setEmailEdicao] = useState("");
  const [senhaEdicao, setSenhaEdicao] = useState("");
  const [roleEdicao, setRoleEdicao] = useState<RoleUsuario>("produtor");
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [nomeUsuarioLogado, setNomeUsuarioLogado] = useState("Usuario Brava");
  const [roleUsuarioLogado, setRoleUsuarioLogado] = useState<RoleUsuario | null>(null);

  async function carregarDados() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("*")
      .eq("id", user.id)
      .single();

    setNomeUsuarioLogado(
      resolverNomeExibicaoUsuario({
        nome: usuario?.nome,
        email: usuario?.email || user.email || null,
        metadata: user.user_metadata,
      })
    );

    if (!isAdminRole(usuario?.role)) {
      router.push("/admin");
      return;
    }

    setRoleUsuarioLogado(usuario.role as RoleUsuario);

    const { data: eventosData } = await supabase
      .from("eventos")
      .select("*")
      .order("id", {
        ascending: false,
      });

    const { data: usuariosData } = await supabase
      .from("usuarios")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (eventosData) {
      setEventos(eventosData);
    }

    if (usuariosData) {
      setUsuarios(usuariosData as UsuarioSistema[]);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function criarUsuario() {
    if (!novoEmail || !novaSenha) {
      alert("Preencha email e senha.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert("Sua sessao expirou. Faca login novamente.");
      return;
    }

    const response = await fetch("/api/criar-usuario", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        nome: novoNome.trim() || null,
        email: novoEmail,
        password: novaSenha,
        role: novaRole,
      }),
    });

    const result = await response.json();

    if (result.error) {
      alert(result.error);
      return;
    }

    alert("Usuario criado com sucesso!");

    setNovoEmail("");
  setNovoNome("");
    setNovaSenha("");
    setNovaRole("produtor");

    await carregarDados();
  }

  function iniciarEdicao(usuario: UsuarioSistema) {
    setUsuarioEditandoId(usuario.id);
    setNomeEdicao(usuario.nome || "");
    setEmailEdicao(usuario.email);
    setSenhaEdicao("");
    setRoleEdicao(usuario.role);
  }

  const podeGerenciarPlatformOwner = isPlatformOwner(roleUsuarioLogado);

  function cancelarEdicao() {
    setUsuarioEditandoId(null);
    setNomeEdicao("");
    setEmailEdicao("");
    setSenhaEdicao("");
    setRoleEdicao("produtor");
  }

  async function salvarEdicaoUsuario() {
    if (!usuarioEditandoId) {
      return;
    }

    if (!emailEdicao.trim()) {
      alert("Email e obrigatorio.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert("Sua sessao expirou. Faca login novamente.");
      return;
    }

    setProcessandoId(usuarioEditandoId);

    const response = await fetch("/api/gerenciar-usuario", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        userId: usuarioEditandoId,
        nome: nomeEdicao.trim() || null,
        email: emailEdicao.trim(),
        password: senhaEdicao.trim() || null,
        role: roleEdicao,
      }),
    });

    const result = await response.json();

    setProcessandoId(null);

    if (result.error) {
      alert(result.error);
      return;
    }

    alert("Usuario atualizado com sucesso!");
    cancelarEdicao();
    await carregarDados();
  }

  async function excluirUsuario(usuario: UsuarioSistema) {
    if (!confirm(`Deseja excluir o usuario ${usuario.email}?`)) {
      return;
    }

    setProcessandoId(usuario.id);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setProcessandoId(null);
      alert("Sua sessao expirou. Faca login novamente.");
      return;
    }

    const response = await fetch("/api/gerenciar-usuario", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        userId: usuario.id,
      }),
    });

    const result = await response.json();

    setProcessandoId(null);

    if (result.error) {
      alert(result.error);
      return;
    }

    if (usuarioEditandoId === usuario.id) {
      cancelarEdicao();
    }

    alert("Usuario excluido com sucesso!");
    await carregarDados();
  }

  useEffect(() => {
    carregarDados();
  }, []);

  const eventosFiltrados = useMemo(() => {
    const termo = buscaEventos.trim().toLowerCase();

    if (!termo) {
      return eventos;
    }

    return eventos.filter((evento) => {
      const nome = String(evento?.nome || "").toLowerCase();
      const local = String(evento?.local_evento || "").toLowerCase();
      return nome.includes(termo) || local.includes(termo);
    });
  }, [buscaEventos, eventos]);

  const usuariosFiltrados = useMemo(() => {
    const termo = buscaUsuarios.trim().toLowerCase();

    if (!termo) {
      return usuarios;
    }

    return usuarios.filter((usuario) => {
      const nome = String(usuario.nome || "").toLowerCase();
      const email = usuario.email.toLowerCase();
      const funcao = roleAmigavel(usuario.role).toLowerCase();
      return nome.includes(termo) || email.includes(termo) || funcao.includes(termo);
    });
  }, [buscaUsuarios, usuarios]);

  const totalProdutores = usuarios.filter((u) => u.role === "produtor").length;
  const totalStaff = usuarios.filter((u) => u.role === "staff").length;
  const totalAdministradores = usuarios.filter(
    (u) => u.role === "super_admin" || u.role === "platform_owner"
  ).length;

  const distribuicaoEquipe = [
    { label: "Administradores", valor: totalAdministradores, classe: "bg-blue-600" },
    { label: "Produtores", valor: totalProdutores, classe: "bg-emerald-500" },
    { label: "Staff", valor: totalStaff, classe: "bg-amber-500" },
  ];

  const maiorGrupoEquipe = Math.max(1, ...distribuicaoEquipe.map((item) => item.valor));

  return (
    <AdminShell
      role={roleUsuarioLogado}
      userName={nomeUsuarioLogado}
      title="Visão Geral da Plataforma"
      subtitle="Acompanhe eventos, acessos e a estrutura operacional da Brava em um único painel."
      breadcrumbs={[{ label: "Início" }]}
      actions={
        <button
          onClick={logout}
          className="min-h-11 rounded-2xl bg-red-500 px-6 py-3 font-bold text-white transition hover:bg-red-400"
        >
          Sair
        </button>
      }
      aside={{
        title: "Central Brava",
        description:
          "Visão consolidada da plataforma para acompanhar eventos, equipe e acessos sem sair do contexto operacional.",
      }}
    >
      <div className="space-y-6">
        <section>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-blue-600">
                Inteligência da plataforma
              </p>
              <h2 className="mt-2 text-2xl font-black text-blue-950 sm:text-3xl">
                Visão geral da operação
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Indicadores consolidados dos eventos e da equipe Brava.
              </p>
            </div>

            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Dados atualizados
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <article className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-500">Eventos</p>
                  <p className="mt-3 text-4xl font-black text-blue-950">{eventos.length}</p>
                  <p className="mt-1 text-xs text-slate-400">cadastrados na plataforma</p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-xl">📅</span>
              </div>
            </article>

            <article className="rounded-3xl border border-indigo-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-500">Acessos</p>
                  <p className="mt-3 text-4xl font-black text-indigo-600">{usuarios.length}</p>
                  <p className="mt-1 text-xs text-slate-400">usuários cadastrados</p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-xl">👥</span>
              </div>
            </article>

            <article className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-500">Produtores</p>
                  <p className="mt-3 text-4xl font-black text-emerald-600">{totalProdutores}</p>
                  <p className="mt-1 text-xs text-slate-400">gestão de eventos</p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-xl">🎯</span>
              </div>
            </article>

            <article className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-500">Staff</p>
                  <p className="mt-3 text-4xl font-black text-amber-600">{totalStaff}</p>
                  <p className="mt-1 text-xs text-slate-400">operação e check-in</p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-xl">✓</span>
              </div>
            </article>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_0.75fr]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-400">Operação</p>
                <h3 className="mt-1 text-xl font-black text-blue-950">Eventos da plataforma</h3>
                <p className="mt-1 text-sm text-slate-500">Acesso rápido às Centrais dos Eventos.</p>
              </div>
              <input
                type="text"
                placeholder="Buscar evento por nome ou local"
                value={buscaEventos}
                onChange={(e) => setBuscaEventos(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white sm:max-w-xs"
              />
            </div>

            <div className="hidden md:block">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-6 py-4 text-left text-xs font-extrabold uppercase tracking-wider text-slate-400">Evento</th>
                    <th className="px-5 py-4 text-left text-xs font-extrabold uppercase tracking-wider text-slate-400">Local</th>
                    <th className="px-6 py-4 text-right text-xs font-extrabold uppercase tracking-wider text-slate-400">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {eventosFiltrados.map((evento) => (
                    <tr key={evento.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                      <td className="px-6 py-4">
                        <p className="font-extrabold text-blue-950">{evento.nome}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{evento.local_evento || "Local não informado"}</td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/eventos/${evento.slug}`}
                          className="inline-flex min-h-9 items-center justify-center rounded-xl bg-blue-700 px-4 text-xs font-extrabold text-white transition hover:bg-blue-600"
                        >
                          Abrir Central
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {eventosFiltrados.length === 0 ? (
                    <tr><td colSpan={3} className="px-6 py-10 text-center text-sm text-slate-500">Nenhum evento encontrado.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              {eventosFiltrados.map((evento) => (
                <article key={evento.id} className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-extrabold text-blue-950">{evento.nome}</p>
                  <p className="mt-1 text-sm text-slate-500">{evento.local_evento || "Local não informado"}</p>
                  <Link href={`/admin/eventos/${evento.slug}`} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-bold text-white">
                    Abrir Central
                  </Link>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-400">Equipe</p>
            <h3 className="mt-1 text-xl font-black text-blue-950">Distribuição de acessos</h3>
            <p className="mt-1 text-sm text-slate-500">Composição atual da operação.</p>

            <div className="mt-7 space-y-6">
              {distribuicaoEquipe.map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-slate-700">{item.label}</span>
                    <span className="text-lg font-black text-blue-950">{item.valor}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${item.classe}`}
                      style={{ width: `${Math.max(item.valor > 0 ? 8 : 0, (item.valor / maiorGrupoEquipe) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 rounded-2xl bg-blue-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-500">Total da equipe</p>
              <div className="mt-1 flex items-end justify-between gap-3">
                <p className="text-3xl font-black text-blue-950">{usuarios.length}</p>
                <p className="text-xs text-blue-700">acessos ativos cadastrados</p>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-400">Gestão de acessos</p>
                <h3 className="mt-1 text-xl font-black text-blue-950">Minha Equipe</h3>
                <p className="mt-1 text-sm text-slate-500">Cadastre, localize e gerencie os perfis da plataforma.</p>
              </div>
              <input
                type="text"
                placeholder="Buscar por nome, e-mail ou função"
                value={buscaUsuarios}
                onChange={(e) => setBuscaUsuarios(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white lg:max-w-sm"
              />
            </div>

            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-extrabold text-blue-950">Novo acesso</p>
                  <p className="text-xs text-slate-500">Preencha os dados e crie um novo usuário.</p>
                </div>
                <button onClick={criarUsuario} className="min-h-10 rounded-xl bg-blue-700 px-5 text-sm font-extrabold text-white transition hover:bg-blue-600">Criar acesso</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <input type="text" placeholder="Nome completo" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className="rounded-xl border border-slate-200 bg-white p-3 text-slate-900" />
                <input type="email" placeholder="E-mail" value={novoEmail} onChange={(e) => setNovoEmail(e.target.value)} className="rounded-xl border border-slate-200 bg-white p-3 text-slate-900" />
                <input type="password" placeholder="Senha" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} className="rounded-xl border border-slate-200 bg-white p-3 text-slate-900" />
                <select value={novaRole} onChange={(e) => setNovaRole(e.target.value as RoleUsuario)} className="rounded-xl border border-slate-200 bg-white p-3 text-slate-900">
                  <option value="produtor">Produtor</option>
                  <option value="staff">Staff</option>
                  <option value="super_admin">Administrador Geral</option>
                  {podeGerenciarPlatformOwner ? <option value="platform_owner">Proprietário da Plataforma</option> : null}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4 md:hidden">
            {usuariosFiltrados.map((usuario) => (
              <article key={usuario.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                {usuarioEditandoId === usuario.id ? (
                  <div className="space-y-3">
                    <input type="text" value={nomeEdicao} onChange={(e) => setNomeEdicao(e.target.value)} placeholder="Nome completo" className="w-full rounded-lg border border-slate-300 p-3" />
                    <input type="email" value={emailEdicao} onChange={(e) => setEmailEdicao(e.target.value)} className="w-full rounded-lg border border-slate-300 p-3" />
                    <select value={roleEdicao} onChange={(e) => setRoleEdicao(e.target.value as RoleUsuario)} className="w-full rounded-lg border border-slate-300 p-3">
                      <option value="produtor">Produtor</option>
                      <option value="staff">Staff</option>
                      <option value="super_admin">Administrador Geral</option>
                      {podeGerenciarPlatformOwner ? <option value="platform_owner">Proprietário da Plataforma</option> : null}
                    </select>
                    <input type="password" placeholder="Nova senha (opcional)" value={senhaEdicao} onChange={(e) => setSenhaEdicao(e.target.value)} className="w-full rounded-lg border border-slate-300 p-3" />
                    <div className="flex flex-wrap gap-2">
                      <button onClick={salvarEdicaoUsuario} disabled={processandoId === usuario.id} className="min-h-11 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white">Salvar</button>
                      <button onClick={cancelarEdicao} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-extrabold text-blue-950">{nomeCompletoUsuario(usuario)}</p>
                        <p className="mt-1 break-all text-sm text-slate-500">{usuario.email}</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Ativo</span>
                    </div>
                    <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-400">{roleAmigavel(usuario.role)}</p>
                    <div className="mt-4 flex gap-2">
                      <button onClick={() => iniciarEdicao(usuario)} className="min-h-10 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white">Editar</button>
                      <button onClick={() => excluirUsuario(usuario)} disabled={processandoId === usuario.id} className="min-h-10 rounded-xl border border-red-100 bg-red-50 px-4 text-sm font-bold text-red-600">Excluir</button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="px-6 py-4 text-left text-xs font-extrabold uppercase tracking-wider text-slate-400">Nome</th>
                  <th className="px-5 py-4 text-left text-xs font-extrabold uppercase tracking-wider text-slate-400">E-mail</th>
                  <th className="px-5 py-4 text-left text-xs font-extrabold uppercase tracking-wider text-slate-400">Função</th>
                  <th className="px-6 py-4 text-right text-xs font-extrabold uppercase tracking-wider text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map((usuario) => (
                  <tr key={usuario.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="px-6 py-4 text-sm font-bold text-blue-950">
                      {usuarioEditandoId === usuario.id ? <input type="text" value={nomeEdicao} onChange={(e) => setNomeEdicao(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2" /> : nomeCompletoUsuario(usuario)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {usuarioEditandoId === usuario.id ? <input type="email" value={emailEdicao} onChange={(e) => setEmailEdicao(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2" /> : usuario.email}
                    </td>
                    <td className="px-5 py-4">
                      {usuarioEditandoId === usuario.id ? (
                        <div className="flex flex-col gap-2">
                          <select value={roleEdicao} onChange={(e) => setRoleEdicao(e.target.value as RoleUsuario)} className="rounded-lg border border-slate-300 p-2">
                            <option value="produtor">Produtor</option>
                            <option value="staff">Staff</option>
                            <option value="super_admin">Administrador Geral</option>
                            {podeGerenciarPlatformOwner ? <option value="platform_owner">Proprietário da Plataforma</option> : null}
                          </select>
                          <input type="password" placeholder="Nova senha (opcional)" value={senhaEdicao} onChange={(e) => setSenhaEdicao(e.target.value)} className="rounded-lg border border-slate-300 p-2" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-700">{roleAmigavel(usuario.role)}</span>
                          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">Ativo</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {usuarioEditandoId === usuario.id ? (
                        <div className="flex justify-end gap-2 whitespace-nowrap">
                          <button onClick={salvarEdicaoUsuario} disabled={processandoId === usuario.id} className="h-9 rounded-lg bg-emerald-600 px-3.5 text-xs font-bold text-white">Salvar</button>
                          <button onClick={cancelarEdicao} className="h-9 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700">Cancelar</button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2 whitespace-nowrap">
                          <button onClick={() => iniciarEdicao(usuario)} className="h-9 rounded-lg bg-blue-700 px-3.5 text-xs font-bold text-white transition hover:bg-blue-600">Editar</button>
                          <button onClick={() => excluirUsuario(usuario)} disabled={processandoId === usuario.id} className="h-9 rounded-lg border border-red-100 bg-red-50 px-3.5 text-xs font-bold text-red-600 transition hover:bg-red-100">Excluir</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {usuariosFiltrados.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">Nenhum usuário encontrado.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
