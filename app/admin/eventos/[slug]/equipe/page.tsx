"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AdminShell from "@/app/components/AdminShell";
import AdminEventTabs from "@/app/components/AdminEventTabs";
import { supabase } from "@/lib/supabase";
import { roleLabel, type RoleUsuario } from "@/lib/roles";

type EventoResumo = {
  id: number;
  slug: string;
  nome: string;
};

type UsuarioVinculado = {
  idVinculo: number;
  usuarioId: string;
  nome: string;
  email: string;
  role: string;
};

type UsuarioDisponivel = {
  id: string;
  nome: string;
  email: string;
  role: string;
};

type EquipePayload = {
  evento: EventoResumo;
  role: RoleUsuario;
  podeGerenciarProdutores: boolean;
  podeGerenciarStaff: boolean;
  produtoresVinculados: UsuarioVinculado[];
  staffsVinculados: UsuarioVinculado[];
  usuariosProdutores: UsuarioDisponivel[];
  usuariosStaff: UsuarioDisponivel[];
};

function ehEquipePayload(valor: unknown): valor is EquipePayload {
  if (!valor || typeof valor !== "object") {
    return false;
  }

  const payload = valor as { evento?: unknown; produtoresVinculados?: unknown; staffsVinculados?: unknown };
  return Boolean(payload.evento) && Array.isArray(payload.produtoresVinculados) && Array.isArray(payload.staffsVinculados);
}

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function EquipeEventoPage() {
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";

  const [loading, setLoading] = useState(true);
  const [acessoNegado, setAcessoNegado] = useState(false);
  const [mensagemAcesso, setMensagemAcesso] = useState("");
  const [evento, setEvento] = useState<EventoResumo | null>(null);
  const [roleUsuario, setRoleUsuario] = useState<RoleUsuario | null>(null);
  const [podeGerenciarProdutores, setPodeGerenciarProdutores] = useState(false);
  const [podeGerenciarStaff, setPodeGerenciarStaff] = useState(false);

  const [produtoresVinculados, setProdutoresVinculados] = useState<UsuarioVinculado[]>([]);
  const [staffsVinculados, setStaffsVinculados] = useState<UsuarioVinculado[]>([]);
  const [usuariosProdutores, setUsuariosProdutores] = useState<UsuarioDisponivel[]>([]);
  const [usuariosStaff, setUsuariosStaff] = useState<UsuarioDisponivel[]>([]);

  const [buscaProdutores, setBuscaProdutores] = useState("");
  const [buscaStaff, setBuscaStaff] = useState("");
  const [usuarioProdutorSelecionado, setUsuarioProdutorSelecionado] = useState("");
  const [usuarioStaffSelecionado, setUsuarioStaffSelecionado] = useState("");

  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  async function carregarEquipe() {
    if (!slug) {
      setAcessoNegado(true);
      setMensagemAcesso("Evento nao encontrado.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setMensagem(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setAcessoNegado(true);
      setMensagemAcesso("Sessao expirada. Faca login novamente.");
      setLoading(false);
      return;
    }

    const response = await fetch(`/api/admin/evento-equipe?slug=${encodeURIComponent(slug)}`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const result = (await response.json()) as unknown;

    if (!response.ok || !ehEquipePayload(result)) {
      setAcessoNegado(true);
      setMensagemAcesso("Voce nao possui permissao para acessar este evento.");
      setLoading(false);
      return;
    }

    setAcessoNegado(false);
    setMensagemAcesso("");
    setEvento(result.evento);
    setRoleUsuario(result.role);
    setPodeGerenciarProdutores(Boolean(result.podeGerenciarProdutores));
    setPodeGerenciarStaff(Boolean(result.podeGerenciarStaff));
    setProdutoresVinculados(result.produtoresVinculados);
    setStaffsVinculados(result.staffsVinculados);
    setUsuariosProdutores(result.usuariosProdutores);
    setUsuariosStaff(result.usuariosStaff);
    setLoading(false);
  }

  useEffect(() => {
    carregarEquipe();
  }, [slug]);

  async function vincularMembro(tipo: "produtor" | "staff", usuarioId: string) {
    if (!evento || !usuarioId) {
      return;
    }

    setProcessando(true);
    setMensagem(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setProcessando(false);
      setMensagem({ tipo: "erro", texto: "Sessao expirada. Faca login novamente." });
      return;
    }

    const response = await fetch("/api/admin/evento-equipe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ slug: evento.slug, tipo, usuarioId }),
    });

    const result = (await response.json()) as any;
    setProcessando(false);

    if (!response.ok || !ehEquipePayload(result)) {
      setMensagem({ tipo: "erro", texto: result?.message || result?.error || "Nao foi possivel vincular membro." });
      return;
    }

    setProdutoresVinculados(result.produtoresVinculados);
    setStaffsVinculados(result.staffsVinculados);
    setUsuariosProdutores(result.usuariosProdutores);
    setUsuariosStaff(result.usuariosStaff);
    setMensagem({ tipo: "sucesso", texto: "Membro vinculado com sucesso!" });
  }

  async function removerMembro(tipo: "produtor" | "staff", usuarioId: string) {
    if (!evento || !usuarioId) {
      return;
    }

    setProcessando(true);
    setMensagem(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setProcessando(false);
      setMensagem({ tipo: "erro", texto: "Sessao expirada. Faca login novamente." });
      return;
    }

    const response = await fetch("/api/admin/evento-equipe", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ slug: evento.slug, tipo, usuarioId }),
    });

    const result = (await response.json()) as any;
    setProcessando(false);

    if (!response.ok || !ehEquipePayload(result)) {
      setMensagem({ tipo: "erro", texto: result?.error || "Nao foi possivel remover membro." });
      return;
    }

    setProdutoresVinculados(result.produtoresVinculados);
    setStaffsVinculados(result.staffsVinculados);
    setUsuariosProdutores(result.usuariosProdutores);
    setUsuariosStaff(result.usuariosStaff);
    setMensagem({ tipo: "sucesso", texto: "Membro removido com sucesso!" });
  }

  const produtoresFiltrados = useMemo(() => {
    const termo = normalizarTexto(buscaProdutores);
    if (!termo) {
      return usuariosProdutores;
    }

    return usuariosProdutores.filter((usuario) => {
      const nome = normalizarTexto(usuario.nome);
      const email = normalizarTexto(usuario.email);
      return nome.includes(termo) || email.includes(termo);
    });
  }, [buscaProdutores, usuariosProdutores]);

  const staffFiltrados = useMemo(() => {
    const termo = normalizarTexto(buscaStaff);
    if (!termo) {
      return usuariosStaff;
    }

    return usuariosStaff.filter((usuario) => {
      const nome = normalizarTexto(usuario.nome);
      const email = normalizarTexto(usuario.email);
      return nome.includes(termo) || email.includes(termo);
    });
  }, [buscaStaff, usuariosStaff]);

  const idsProdutoresVinculados = useMemo(() => new Set(produtoresVinculados.map((item) => item.usuarioId)), [produtoresVinculados]);
  const idsStaffVinculados = useMemo(() => new Set(staffsVinculados.map((item) => item.usuarioId)), [staffsVinculados]);

  if (acessoNegado) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <div className="max-w-xl text-center">
          <h1 className="text-3xl font-bold">Acesso negado</h1>
          <p className="text-slate-600 mt-3">{mensagemAcesso || "Voce nao possui permissao para acessar este evento."}</p>
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

  if (loading || !evento) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <h1 className="text-3xl font-bold">Carregando equipe...</h1>
      </main>
    );
  }

  return (
    <AdminShell
      role={roleUsuario}
      title="Equipe do Evento"
      subtitle={`Gerencie produtores e staff do evento ${evento.nome}.`}
      breadcrumbs={[
        { label: "Inicio", href: "/admin" },
        { label: "Meus Eventos", href: "/admin#todos-eventos" },
        { label: evento.nome, href: `/admin/eventos/${evento.slug}` },
        { label: "Equipe" },
      ]}
      backLink={{ href: `/admin/eventos/${evento.slug}`, label: "Voltar para Central do Evento" }}
      aside={{
        title: "Equipe",
        description: "Vincule produtores e staff ao evento para organizar a operacao sem duplicidades.",
      }}
    >
      <div className="space-y-6">
        <AdminEventTabs slug={evento.slug} current="equipe" />

        <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">
            Seu perfil: <span className="font-semibold text-slate-900">{roleLabel(roleUsuario)}</span>
          </p>
          <p className="text-sm text-slate-600 mt-2">
            Permissoes: {podeGerenciarProdutores ? "pode gerenciar produtores e staff" : podeGerenciarStaff ? "pode gerenciar staff" : "somente visualizacao"}
          </p>
        </section>

        {mensagem ? (
          <p
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              mensagem.tipo === "erro" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {mensagem.texto}
          </p>
        ) : null}

        <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-2xl font-bold text-blue-900">👨‍💼 Produtores do Evento</h2>

          <input
            type="text"
            value={buscaProdutores}
            onChange={(e) => setBuscaProdutores(e.target.value)}
            placeholder="Pesquisar produtores por nome ou email"
            className="ui-field"
          />

          {podeGerenciarProdutores ? (
            <div className="flex flex-col gap-3 md:flex-row">
              <select
                value={usuarioProdutorSelecionado}
                onChange={(e) => setUsuarioProdutorSelecionado(e.target.value)}
                className="ui-field"
              >
                <option value="">Selecionar produtor</option>
                {produtoresFiltrados.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nome} ({usuario.email})
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={processando || !usuarioProdutorSelecionado || idsProdutoresVinculados.has(usuarioProdutorSelecionado)}
                onClick={() => void vincularMembro("produtor", usuarioProdutorSelecionado)}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Adicionar
              </button>
            </div>
          ) : null}

          <div className="space-y-2">
            {produtoresVinculados.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum produtor vinculado.</p>
            ) : (
              produtoresVinculados.map((produtor) => (
                <div key={produtor.usuarioId} className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{produtor.nome}</p>
                    <p className="text-sm text-slate-600">{produtor.email}</p>
                  </div>

                  {podeGerenciarProdutores ? (
                    <button
                      type="button"
                      disabled={processando}
                      onClick={() => void removerMembro("produtor", produtor.usuarioId)}
                      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-300 bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Remover
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-2xl font-bold text-blue-900">👷 Staff do Evento</h2>

          <input
            type="text"
            value={buscaStaff}
            onChange={(e) => setBuscaStaff(e.target.value)}
            placeholder="Pesquisar staff por nome ou email"
            className="ui-field"
          />

          {podeGerenciarStaff ? (
            <div className="flex flex-col gap-3 md:flex-row">
              <select
                value={usuarioStaffSelecionado}
                onChange={(e) => setUsuarioStaffSelecionado(e.target.value)}
                className="ui-field"
              >
                <option value="">Selecionar staff</option>
                {staffFiltrados.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nome} ({usuario.email})
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={processando || !usuarioStaffSelecionado || idsStaffVinculados.has(usuarioStaffSelecionado)}
                onClick={() => void vincularMembro("staff", usuarioStaffSelecionado)}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Adicionar
              </button>
            </div>
          ) : null}

          <div className="space-y-2">
            {staffsVinculados.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum staff vinculado.</p>
            ) : (
              staffsVinculados.map((staff) => (
                <div key={staff.usuarioId} className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{staff.nome}</p>
                    <p className="text-sm text-slate-600">{staff.email}</p>
                  </div>

                  {podeGerenciarStaff ? (
                    <button
                      type="button"
                      disabled={processando}
                      onClick={() => void removerMembro("staff", staff.usuarioId)}
                      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-300 bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Remover
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
