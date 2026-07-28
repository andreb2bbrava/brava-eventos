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

  return (
    <AdminShell
      role={roleUsuarioLogado}
      userName={nomeUsuarioLogado}
      title="Minha Equipe"
      subtitle="Gerencie as pessoas que tem acesso a plataforma. Administradores possuem acesso total, produtores gerenciam eventos e staff opera o check-in."
      breadcrumbs={[{ label: "Inicio", href: "/admin" }, { label: "Minha Equipe" }]}
      backLink={{ href: "/admin", label: "Voltar para Inicio" }}
      actions={
        <button
          onClick={logout}
          className="bg-red-500 hover:bg-red-400 text-white px-6 py-3 rounded-2xl font-bold transition min-h-11"
        >
          Sair
        </button>
      }
      aside={{
        title: "Equipe da operacao",
        description:
          "Use esta area para distribuir acessos com clareza. Produtores acompanham eventos, staff atua na operacao e o Administrador Geral organiza toda a plataforma.",
      }}
    >
      <div className="space-y-8">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <div className="bg-white border border-blue-100 rounded-3xl p-6 text-center shadow-sm">
            <p className="text-slate-500">Total Eventos</p>
            <h2 className="text-5xl font-bold text-blue-800 mt-3">{eventos.length}</h2>
          </div>

          <div className="bg-white border border-blue-100 rounded-3xl p-6 text-center shadow-sm">
            <p className="text-slate-500">Total de acessos</p>
            <h2 className="text-5xl font-bold text-blue-800 mt-3">{usuarios.length}</h2>
          </div>

          <div className="bg-white border border-green-200 rounded-3xl p-6 text-center shadow-sm">
            <p className="text-slate-500">Produtores</p>
            <h2 className="text-5xl font-bold text-green-600 mt-3">
              {usuarios.filter((u) => u.role === "produtor").length}
            </h2>
          </div>
        </div>

        <div className="bg-white border border-blue-100 rounded-3xl p-6 mb-8 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-blue-900">Meus Eventos</h2>
              <p className="text-sm text-slate-500 mt-1">Pesquise e abra rapidamente a Central do Evento correspondente.</p>
            </div>

            <input
              type="text"
              placeholder="Buscar evento por nome ou local"
              value={buscaEventos}
              onChange={(e) => setBuscaEventos(e.target.value)}
              className="w-full md:max-w-sm rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
            />
          </div>

          <div className="space-y-3">
            {eventosFiltrados.map((evento) => (
              <div
                key={evento.id}
                className="border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{evento.nome}</h3>
                  <p className="text-slate-600">{evento.local_evento}</p>
                </div>

                <Link
                  href={`/admin/eventos/${evento.slug}`}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-2xl font-bold transition text-center"
                >
                  Abrir Central do Evento
                </Link>
              </div>
            ))}

            {eventosFiltrados.length === 0 && <p className="text-slate-500">Nenhum evento encontrado.</p>}
          </div>
        </div>

        <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
            <div>
              <h2 className="text-2xl font-bold text-blue-900">Minha Equipe</h2>
              <p className="text-sm text-slate-500 mt-1">Encontre rapidamente um perfil e execute a acao correta sem sair do contexto.</p>
            </div>
            <button
              onClick={criarUsuario}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-2xl font-bold transition"
            >
              Novo Acesso
            </button>
          </div>

          <div className="mb-6">
            <input
              type="text"
              placeholder="Buscar por nome, e-mail ou funcao"
              value={buscaUsuarios}
              onChange={(e) => setBuscaUsuarios(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
            />
          </div>

          <div className="grid md:grid-cols-4 gap-3 mb-6">
            <input
              type="email"
              placeholder="E-mail"
              value={novoEmail}
              onChange={(e) => setNovoEmail(e.target.value)}
              className="p-3 rounded-xl border border-slate-300 bg-white text-slate-900"
            />

            <input
              type="text"
              placeholder="Nome completo"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              className="p-3 rounded-xl border border-slate-300 bg-white text-slate-900"
            />

            <input
              type="password"
              placeholder="Senha"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              className="p-3 rounded-xl border border-slate-300 bg-white text-slate-900"
            />

            <select
              value={novaRole}
              onChange={(e) => setNovaRole(e.target.value as RoleUsuario)}
              className="p-3 rounded-xl border border-slate-300 bg-white text-slate-900"
            >
              <option value="produtor">Produtor</option>
              <option value="staff">Staff</option>
              <option value="super_admin">Administrador Geral</option>
              {podeGerenciarPlatformOwner ? <option value="platform_owner">Proprietario da Plataforma</option> : null}
            </select>
          </div>

          <div className="space-y-3 md:hidden">
            {usuariosFiltrados.map((usuario) => (
              <article key={usuario.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                {usuarioEditandoId === usuario.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={nomeEdicao}
                      onChange={(e) => setNomeEdicao(e.target.value)}
                      placeholder="Nome completo"
                      className="w-full p-3 rounded-lg border border-slate-300"
                    />
                    <input
                      type="email"
                      value={emailEdicao}
                      onChange={(e) => setEmailEdicao(e.target.value)}
                      className="w-full p-3 rounded-lg border border-slate-300"
                    />
                    <select
                      value={roleEdicao}
                      onChange={(e) => setRoleEdicao(e.target.value as RoleUsuario)}
                      className="w-full p-3 rounded-lg border border-slate-300"
                    >
                      <option value="produtor">Produtor</option>
                      <option value="staff">Staff</option>
                      <option value="super_admin">Administrador Geral</option>
                      {podeGerenciarPlatformOwner ? <option value="platform_owner">Proprietario da Plataforma</option> : null}
                    </select>
                    <input
                      type="password"
                      placeholder="Nova senha (opcional)"
                      value={senhaEdicao}
                      onChange={(e) => setSenhaEdicao(e.target.value)}
                      className="w-full p-3 rounded-lg border border-slate-300"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={salvarEdicaoUsuario}
                        disabled={processandoId === usuario.id}
                        className="bg-green-500 hover:bg-green-400 text-white px-4 py-3 rounded-xl font-semibold min-h-11"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={cancelarEdicao}
                        className="bg-amber-500 hover:bg-amber-400 text-white px-4 py-3 rounded-xl font-semibold min-h-11"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
                        Ativo
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{roleAmigavel(usuario.role)}</span>
                    </div>
                    <p className="font-bold text-slate-900 break-all">{usuario.email}</p>
                    <p className="text-slate-700 font-semibold">{nomeCompletoUsuario(usuario)}</p>
                    <p className="text-slate-600">{roleAmigavel(usuario.role)}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => iniciarEdicao(usuario)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-semibold min-h-11"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => excluirUsuario(usuario)}
                        disabled={processandoId === usuario.id}
                        className="bg-red-500 hover:bg-red-400 text-white px-4 py-3 rounded-xl font-semibold min-h-11"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full border border-slate-200 rounded-2xl overflow-hidden">
              <thead className="bg-blue-50 text-slate-700">
                <tr>
                  <th className="text-left p-3">Nome completo</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Funcao</th>
                  <th className="text-left p-3">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map((usuario) => (
                  <tr key={usuario.id} className="border-t border-slate-200">
                    <td className="p-3 text-slate-800">
                      {usuarioEditandoId === usuario.id ? (
                        <input
                          type="text"
                          value={nomeEdicao}
                          onChange={(e) => setNomeEdicao(e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-300"
                        />
                      ) : (
                        nomeCompletoUsuario(usuario)
                      )}
                    </td>

                    <td className="p-3 text-slate-800">
                      {usuarioEditandoId === usuario.id ? (
                        <input
                          type="email"
                          value={emailEdicao}
                          onChange={(e) => setEmailEdicao(e.target.value)}
                          className="w-full p-2 rounded-lg border border-slate-300"
                        />
                      ) : (
                        usuario.email
                      )}
                    </td>

                    <td className="p-3 text-slate-700">
                      {usuarioEditandoId === usuario.id ? (
                        <div className="flex flex-col gap-2">
                          <select
                            value={roleEdicao}
                            onChange={(e) => setRoleEdicao(e.target.value as RoleUsuario)}
                            className="p-2 rounded-lg border border-slate-300"
                          >
                            <option value="produtor">Produtor</option>
                            <option value="staff">Staff</option>
                            <option value="super_admin">Administrador Geral</option>
                            {podeGerenciarPlatformOwner ? <option value="platform_owner">Proprietario da Plataforma</option> : null}
                          </select>
                          <input
                            type="password"
                            placeholder="Nova senha (opcional)"
                            value={senhaEdicao}
                            onChange={(e) => setSenhaEdicao(e.target.value)}
                            className="p-2 rounded-lg border border-slate-300"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-800">{roleAmigavel(usuario.role)}</p>
                          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
                            Ativo
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="p-3">
                      {usuarioEditandoId === usuario.id ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={salvarEdicaoUsuario}
                            disabled={processandoId === usuario.id}
                            className="bg-green-500 hover:bg-green-400 text-white px-3 py-2 rounded-xl font-semibold"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={cancelarEdicao}
                            className="bg-amber-500 hover:bg-amber-400 text-white px-3 py-2 rounded-xl font-semibold"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => iniciarEdicao(usuario)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl font-semibold"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => excluirUsuario(usuario)}
                            disabled={processandoId === usuario.id}
                            className="bg-red-500 hover:bg-red-400 text-white px-3 py-2 rounded-xl font-semibold"
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}