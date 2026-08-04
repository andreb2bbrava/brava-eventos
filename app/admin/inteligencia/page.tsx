"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/app/components/AdminShell";
import { canEditEventRole, type RoleUsuario } from "@/lib/roles";

type ParticipanteIndeterminado = {
  id: number;
  nome: string;
  whatsapp: string;
  lista: string;
  evento: string;
  dataCadastro: string | null;
};

type RespostaRevisao = {
  items: ParticipanteIndeterminado[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string;
};

const PAGE_SIZE = 20;

function formatarDataHora(valor: string | null) {
  if (!valor) {
    return "-";
  }

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) {
    return "-";
  }

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InteligenciaRevisaoPage() {
  const [roleUsuario, setRoleUsuario] = useState<RoleUsuario | null>(null);
  const [carregandoPermissao, setCarregandoPermissao] = useState(true);
  const [acessoNegado, setAcessoNegado] = useState(false);

  const [itens, setItens] = useState<ParticipanteIndeterminado[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");

  const [carregando, setCarregando] = useState(false);
  const [processandoId, setProcessandoId] = useState<number | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  const podeRevisar = useMemo(() => canEditEventRole(roleUsuario), [roleUsuario]);

  const carregarDados = useCallback(
    async (pagina: number, termoBusca: string) => {
      setCarregando(true);
      setMensagem(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setCarregando(false);
        setMensagem({ tipo: "erro", texto: "Sua sessao expirou. Faca login novamente." });
        return;
      }

      const params = new URLSearchParams({
        page: String(pagina),
        pageSize: String(PAGE_SIZE),
      });

      if (termoBusca.trim()) {
        params.set("search", termoBusca.trim());
      }

      const response = await fetch(`/api/inteligencia/revisao?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = (await response.json()) as RespostaRevisao;

      if (!response.ok) {
        setCarregando(false);
        setMensagem({ tipo: "erro", texto: result.error || "Nao foi possivel carregar os dados." });
        return;
      }

      setItens(result.items || []);
      setTotal(result.total || 0);
      setTotalPaginas(result.totalPages || 0);
      setCarregando(false);
    },
    []
  );

  useEffect(() => {
    async function validarPermissao() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        setAcessoNegado(true);
        setCarregandoPermissao(false);
        return;
      }

      const { data: usuarioData } = await supabase.from("usuarios").select("role").eq("id", user.id).maybeSingle();

      const role = (usuarioData?.role as RoleUsuario | null) ?? null;
      setRoleUsuario(role);

      if (!canEditEventRole(role)) {
        setAcessoNegado(true);
        setCarregandoPermissao(false);
        return;
      }

      setAcessoNegado(false);
      setCarregandoPermissao(false);
    }

    validarPermissao();
  }, []);

  useEffect(() => {
    if (carregandoPermissao || !podeRevisar) {
      return;
    }

    carregarDados(paginaAtual, buscaAplicada);
  }, [carregandoPermissao, podeRevisar, paginaAtual, buscaAplicada, carregarDados]);

  async function corrigirParticipante(participanteId: number, sexo: "Masculino" | "Feminino") {
    setProcessandoId(participanteId);
    setMensagem(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setProcessandoId(null);
      setMensagem({ tipo: "erro", texto: "Sua sessao expirou. Faca login novamente." });
      return;
    }

    const response = await fetch("/api/inteligencia/revisao", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        participanteId,
        sexo,
      }),
    });

    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      setProcessandoId(null);
      setMensagem({ tipo: "erro", texto: result.error || "Nao foi possivel salvar a correcao manual." });
      return;
    }

    const paginaDestino = itens.length === 1 && paginaAtual > 1 ? paginaAtual - 1 : paginaAtual;

    setPaginaAtual(paginaDestino);
    await carregarDados(paginaDestino, buscaAplicada);
    setProcessandoId(null);
    setMensagem({ tipo: "sucesso", texto: "Correcao manual aplicada com sucesso." });
  }

  return (
    <AdminShell
      role={roleUsuario}
      title="Central de Revisão da Inteligência"
      subtitle="Revise participantes classificados como indeterminados e corrija manualmente quando necessario."
      breadcrumbs={[{ label: "Inicio", href: "/admin" }, { label: "Inteligência" }]}
      backLink={{ href: "/admin", label: "Voltar para o Painel" }}
      aside={{
        title: "Revisão de Inteligência",
        description:
          "Esta central exibe apenas participantes indeterminados. Ao corrigir, o sistema atualiza a classificacao e aprende o primeiro nome para usos futuros.",
      }}
    >
      {acessoNegado ? (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          <h2 className="text-xl font-extrabold">Acesso negado</h2>
          <p className="mt-2">Voce nao possui permissao para acessar a central de revisao de inteligencia.</p>
        </section>
      ) : carregandoPermissao ? (
        <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-600">Carregando permissao...</p>
        </section>
      ) : (
        <div className="space-y-5">
          <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-700">Resumo</p>
                <h2 className="mt-1 text-3xl font-extrabold text-blue-900">Total de indeterminados: {total}</h2>
              </div>

              <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-[340px]">
                <label className="text-sm font-semibold text-slate-700">Pesquisa por nome</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Digite o nome do participante"
                    className="ui-field"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPaginaAtual(1);
                      setBuscaAplicada(busca.trim());
                    }}
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
                  >
                    Buscar
                  </button>
                </div>
              </div>
            </div>
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

          <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-blue-50 text-left text-sm font-bold text-blue-900">
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">WhatsApp</th>
                    <th className="px-4 py-3">Lista</th>
                    <th className="px-4 py-3">Evento</th>
                    <th className="px-4 py-3">Data do cadastro</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {carregando ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-sm font-semibold text-slate-500">
                        Carregando participantes...
                      </td>
                    </tr>
                  ) : itens.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-sm font-semibold text-slate-500">
                        Nenhum participante indeterminado encontrado para os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    itens.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100 text-sm text-slate-700">
                        <td className="px-4 py-3 font-semibold text-slate-900">{item.nome}</td>
                        <td className="px-4 py-3">{item.whatsapp}</td>
                        <td className="px-4 py-3">{item.lista}</td>
                        <td className="px-4 py-3">{item.evento}</td>
                        <td className="px-4 py-3">{formatarDataHora(item.dataCadastro)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={processandoId === item.id}
                              onClick={() => void corrigirParticipante(item.id, "Masculino")}
                              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-sky-600 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              👨 Masculino
                            </button>
                            <button
                              type="button"
                              disabled={processandoId === item.id}
                              onClick={() => void corrigirParticipante(item.id, "Feminino")}
                              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-pink-600 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-pink-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              👩 Feminino
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Página {totalPaginas === 0 ? 0 : paginaAtual} de {totalPaginas}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={paginaAtual <= 1 || carregando}
                  onClick={() => setPaginaAtual((prev) => Math.max(1, prev - 1))}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anterior
                </button>

                <button
                  type="button"
                  disabled={paginaAtual >= totalPaginas || carregando || totalPaginas === 0}
                  onClick={() => setPaginaAtual((prev) => prev + 1)}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
