"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type RoleUsuario = "super_admin" | "produtor" | "staff";

type UsuarioSistema = {
  id: string;
  email: string;
  role: RoleUsuario;
  created_at?: string;
};

function roleAmigavel(role: string) {
  if (role === "super_admin") {
    return "Administrador Geral";
  }

  if (role === "produtor") {
    return "Produtor";
  }

  if (role === "staff") {
    return "Staff";
  }

  return role;
}

export default function SuperAdminPage() {
  const router = useRouter();

  const [eventos, setEventos] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);

  const [novoEmail, setNovoEmail] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [novaRole, setNovaRole] = useState<RoleUsuario>("produtor");

  const [usuarioEditandoId, setUsuarioEditandoId] = useState<string | null>(null);
  const [emailEdicao, setEmailEdicao] = useState("");
  const [senhaEdicao, setSenhaEdicao] = useState("");
  const [roleEdicao, setRoleEdicao] = useState<RoleUsuario>("produtor");
  const [processandoId, setProcessandoId] = useState<string | null>(null);

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

    if (usuario?.role !== "super_admin") {
      router.push("/admin");
      return;
    }

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

    const response = await fetch("/api/criar-usuario", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
    setNovaSenha("");
    setNovaRole("produtor");

    await carregarDados();
  }

  function iniciarEdicao(usuario: UsuarioSistema) {
    setUsuarioEditandoId(usuario.id);
    setEmailEdicao(usuario.email);
    setSenhaEdicao("");
    setRoleEdicao(usuario.role);
  }

  function cancelarEdicao() {
    setUsuarioEditandoId(null);
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

    setProcessandoId(usuarioEditandoId);

    const response = await fetch("/api/gerenciar-usuario", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: usuarioEditandoId,
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

    const response = await fetch("/api/gerenciar-usuario", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Brava Entretenimento"
              className="h-12 w-12 rounded-xl border border-blue-200 bg-white p-1"
            />
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-900 break-words">Administrador Geral</h1>
              <p className="text-slate-600 mt-1">Controle completo da plataforma</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="bg-blue-100 hover:bg-blue-200 text-blue-900 px-5 py-3 rounded-2xl font-bold transition"
            >
              Ir para Painel
            </Link>
            <button
              onClick={logout}
              className="bg-red-500 hover:bg-red-400 text-white px-6 py-3 rounded-2xl font-bold transition"
            >
              Sair
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <div className="bg-white border border-blue-100 rounded-3xl p-6 text-center shadow-sm">
            <p className="text-slate-500">Total Eventos</p>
            <h2 className="text-5xl font-bold text-blue-800 mt-3">{eventos.length}</h2>
          </div>

          <div className="bg-white border border-blue-100 rounded-3xl p-6 text-center shadow-sm">
            <p className="text-slate-500">Total Usuarios</p>
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
          <h2 className="text-2xl font-bold text-blue-900 mb-4">Eventos</h2>

          <div className="space-y-3">
            {eventos.map((evento) => (
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
                  Abrir Dashboard
                </Link>
              </div>
            ))}

            {eventos.length === 0 && <p className="text-slate-500">Nenhum evento cadastrado.</p>}
          </div>
        </div>

        <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
            <h2 className="text-2xl font-bold text-blue-900">Usuarios</h2>
            <button
              onClick={criarUsuario}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-2xl font-bold transition"
            >
              Criar Usuario
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-3 mb-6">
            <input
              type="email"
              placeholder="E-mail"
              value={novoEmail}
              onChange={(e) => setNovoEmail(e.target.value)}
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
            </select>
          </div>

          <div className="space-y-3 md:hidden">
            {usuarios.map((usuario) => (
              <article key={usuario.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                {usuarioEditandoId === usuario.id ? (
                  <div className="space-y-3">
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
                    <p className="font-bold text-slate-900 break-all">{usuario.email}</p>
                    <p className="text-slate-600">{roleAmigavel(usuario.role)}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        onClick={() => iniciarEdicao(usuario)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-semibold min-h-11"
                      >
                        Editar Usuario
                      </button>
                      <button
                        onClick={() => excluirUsuario(usuario)}
                        disabled={processandoId === usuario.id}
                        className="bg-red-500 hover:bg-red-400 text-white px-4 py-3 rounded-xl font-semibold min-h-11"
                      >
                        Excluir Usuario
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
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Funcao</th>
                  <th className="text-left p-3">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((usuario) => (
                  <tr key={usuario.id} className="border-t border-slate-200">
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
                        roleAmigavel(usuario.role)
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
                            Editar Usuario
                          </button>
                          <button
                            onClick={() => excluirUsuario(usuario)}
                            disabled={processandoId === usuario.id}
                            className="bg-red-500 hover:bg-red-400 text-white px-3 py-2 rounded-xl font-semibold"
                          >
                            Excluir Usuario
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
    </main>
  );
}