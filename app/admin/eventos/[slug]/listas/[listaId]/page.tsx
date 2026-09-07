"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/app/components/AdminShell";
import AdminEventTabs from "@/app/components/AdminEventTabs";
import {
  erroEhDuplicidadeParticipante,
  mensagemDuplicidadeEvento,
  normalizarNomeParticipante,
  validarNomeCompletoParticipante,
} from "@/lib/participantes";
import { canEditEventRole, canCheckinRole, isAdminRole, resolverRoleUsuario, type RoleUsuario } from "@/lib/roles";

type EventoResumo = {
  id: number;
  slug: string;
  nome: string;
};

type ListaEvento = {
  id: number;
  evento_id: number;
  nome: string;
  descricao: string | null;
  regra: string | null;
  tipo_lista: string | null;
};

type ParticipanteLista = {
  id: number;
  nome: string;
  whatsapp: string | null;
  email: string | null;
  presente: boolean;
  entrada_confirmada_em: string | null;
};

type ParticipanteDuplicidadeRow = {
  id: number;
  nome: string | null;
  nome_normalizado: string | null;
  lista_id: number | null;
  listas_evento?: { regra: string | null } | Array<{ regra: string | null }> | null;
};

type ResumoImportacao = {
  inseridos: number;
  ignorados: number;
  ignoradosNomes: string[];
};

function obterRegraDuplicada(row: ParticipanteDuplicidadeRow | null | undefined) {
  if (!row?.listas_evento) {
    return null;
  }

  if (Array.isArray(row.listas_evento)) {
    return (row.listas_evento[0]?.regra || "").trim() || null;
  }

  return (row.listas_evento.regra || "").trim() || null;
}

function rotuloTipoLista(tipoLista: string | null) {
  return tipoLista === "vip" ? "Lista Completa" : "Lista Simples";
}

function debugLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
}

function limparMarcadorInicialNome(valor: string) {
  return valor
    .replace(/^\s*[-–—•·▪◦*]+\s*/u, "")
    .replace(/^\s*\(?\d{1,3}\)?(?:[.)\-:])?\s+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairItensNumeradosNaMesmaLinha(linha: string) {
  const marcador = /(?:^|\s)(\d{1,3})(?:[.)\-:])?\s+(?=\p{L})/gu;
  const encontrados = [...linha.matchAll(marcador)];

  if (encontrados.length < 2) {
    return null;
  }

  const itens: string[] = [];

  for (let index = 0; index < encontrados.length; index += 1) {
    const atual = encontrados[index];
    const proximo = encontrados[index + 1];

    if (atual.index === undefined) continue;

    const inicio = atual.index + atual[0].length;
    const fim = proximo?.index ?? linha.length;
    const item = limparMarcadorInicialNome(linha.slice(inicio, fim));

    if (item) itens.push(item);
  }

  return itens.length > 0 ? itens : null;
}

function extrairItensSeparadosPorTracoNaMesmaLinha(linha: string) {
  const linhaSemMarcadorInicial = linha.replace(/^\s*[-–—•·▪◦*]+\s*/u, "");
  const separadores = linhaSemMarcadorInicial.match(/\s+[-–—•·▪◦*]\s+/gu) || [];

  if (separadores.length < 2) {
    return null;
  }

  const itens = linhaSemMarcadorInicial
    .split(/\s+[-–—•·▪◦*]\s+/gu)
    .map(limparMarcadorInicialNome)
    .filter(Boolean);

  return itens.length > 0 ? itens : null;
}

function extrairNomesFlexiveisParaImportacao(texto: string) {
  const candidatos: string[] = [];

  const linhas = texto
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean);

  for (const linhaOriginal of linhas) {
    const numerados = extrairItensNumeradosNaMesmaLinha(linhaOriginal);

    if (numerados) {
      candidatos.push(...numerados);
      continue;
    }

    const separadosPorTraco = extrairItensSeparadosPorTracoNaMesmaLinha(linhaOriginal);

    if (separadosPorTraco) {
      candidatos.push(...separadosPorTraco);
      continue;
    }

    candidatos.push(limparMarcadorInicialNome(linhaOriginal));
  }

  const unicos: string[] = [];
  const nomesNormalizados = new Set<string>();

  for (const candidato of candidatos) {
    const nomeLimpo = limparMarcadorInicialNome(candidato);

    if (!nomeLimpo) continue;

    const chave = normalizarNomeParticipante(nomeLimpo);

    if (!chave || nomesNormalizados.has(chave)) continue;

    nomesNormalizados.add(chave);
    unicos.push(nomeLimpo);
  }

  return unicos;
}

function criarIndiceParticipantesEvento(participantes: ParticipanteDuplicidadeRow[]) {
  const nomesExistentes = new Set<string>();
  const participantePorNome = new Map<string, ParticipanteDuplicidadeRow>();

  participantes.forEach((participante) => {
    const nomeNormalizado = participante.nome_normalizado || normalizarNomeParticipante(participante.nome || "");
    if (!nomeNormalizado) {
      return;
    }

    nomesExistentes.add(nomeNormalizado);
    if (!participantePorNome.has(nomeNormalizado)) {
      participantePorNome.set(nomeNormalizado, participante);
    }
  });

  return { nomesExistentes, participantePorNome };
}

export default function ParticipantesDaListaPage() {
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";

  const listaIdRaw =
    typeof params?.listaId === "string"
      ? params.listaId
      : Array.isArray(params?.listaId)
      ? params.listaId[0]
      : "";

  const listaId = Number(listaIdRaw);

  const [loading, setLoading] = useState(true);
  const [acessoNegado, setAcessoNegado] = useState(false);
  const [mensagemAcesso, setMensagemAcesso] = useState("");
  const [roleUsuario, setRoleUsuario] = useState<RoleUsuario | null>(null);

  const [evento, setEvento] = useState<EventoResumo | null>(null);
  const [lista, setLista] = useState<ListaEvento | null>(null);
  const [participantes, setParticipantes] = useState<ParticipanteLista[]>([]);
  const [buscaParticipantes, setBuscaParticipantes] = useState("");

  const [nomesEmMassa, setNomesEmMassa] = useState("");
  const [salvandoSimples, setSalvandoSimples] = useState(false);
  const [salvandoVip, setSalvandoVip] = useState(false);
  const [mensagemCadastro, setMensagemCadastro] = useState("");
  const [erroCadastro, setErroCadastro] = useState(false);
  const [excluindoParticipanteId, setExcluindoParticipanteId] = useState<number | null>(null);
  const [resumoImportacao, setResumoImportacao] = useState<ResumoImportacao | null>(null);
  const [mostrarIgnorados, setMostrarIgnorados] = useState(false);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [sexo, setSexo] = useState("");

  const carregarParticipantes = useCallback(async (eventoId: number, listaIdAtual: number) => {
    const { data: participantesData } = await supabase
      .from("participantes")
      .select("id, nome, whatsapp, email, presente, entrada_confirmada_em")
      .eq("evento_id", eventoId)
      .eq("lista_id", listaIdAtual)
      .order("id", { ascending: false });

    if (participantesData) {
      setParticipantes(participantesData as ParticipanteLista[]);
    }
  }, []);

  const carregarDados = useCallback(async () => {
    debugLog("PARAMS LISTA", { slug, listaId });

    if (!slug) {
      setAcessoNegado(true);
      setMensagemAcesso("Evento não encontrado.");
      setLoading(false);
      return;
    }

    if (!Number.isFinite(listaId) || listaId <= 0) {
      setAcessoNegado(true);
      setMensagemAcesso("Lista inválida.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: eventoData, error: erroEvento } = await supabase
      .from("eventos")
      .select("*")
      .eq("slug", slug)
      .single();

    debugLog("EVENTO ENCONTRADO", eventoData);
    debugLog("ERRO EVENTO", erroEvento);

    if (erroEvento || !eventoData) {
      setAcessoNegado(true);
      setMensagemAcesso("Evento não encontrado.");
      setLoading(false);
      return;
    }

    const { data: listaData, error: erroLista } = await supabase
      .from("listas_evento")
      .select("*")
      .eq("id", Number(listaId))
      .single();

    debugLog("LISTA ENCONTRADA", listaData);
    debugLog("ERRO LISTA", erroLista);

    if (erroLista) {
      const erroPermissaoLista = erroLista.code === "42501" || erroLista.code === "PGRST301";
      setAcessoNegado(true);
      setMensagemAcesso(erroPermissaoLista ? "Você não possui permissão para acessar esta lista." : "Lista não encontrada.");
      setLoading(false);
      return;
    }

    if (!listaData) {
      setAcessoNegado(true);
      setMensagemAcesso("Lista não encontrada.");
      setLoading(false);
      return;
    }

    if (Number(listaData.evento_id) !== Number(eventoData.id)) {
      setAcessoNegado(true);
      setMensagemAcesso("Esta lista não pertence a este evento.");
      setLoading(false);
      return;
    }

    const {
      data: { user },
      error: erroAuth,
    } = await supabase.auth.getUser();

    debugLog("USUARIO", user?.id);

    if (erroAuth || !user?.id) {
      setAcessoNegado(true);
      setMensagemAcesso("Você não possui permissão para acessar esta lista.");
      setLoading(false);
      return;
    }

    const { data: usuarioData, error: usuarioError } = await supabase
      .from("usuarios")
      .select("role")
      .eq("id", user.id)
      .single();

    const usuario = usuarioData;
    debugLog("ROLE", usuario?.role);

    const role = resolverRoleUsuario(usuarioData?.role || null);
    setRoleUsuario(role);

    if (usuarioError || !role) {
      setAcessoNegado(true);
      setMensagemAcesso("Você não possui permissão para acessar esta lista.");
      setLoading(false);
      return;
    }

    let autorizado = isAdminRole(role);

    if (!autorizado && role === "produtor") {
      const { data: vinculacaoProdutor, error: vinculacaoProdutorError } = await supabase
        .from("evento_produtores")
        .select("id")
        .eq("evento_id", eventoData.id)
        .eq("usuario_id", user.id)
        .maybeSingle();

      autorizado = !vinculacaoProdutorError && !!vinculacaoProdutor;
    }

    if (!autorizado && role === "staff") {
      const { data: vinculacaoStaff, error: vinculacaoStaffError } = await supabase
        .from("evento_staff")
        .select("id")
        .eq("evento_id", eventoData.id)
        .eq("usuario_id", user.id)
        .maybeSingle();

      autorizado = !vinculacaoStaffError && !!vinculacaoStaff;
    }

    if (!autorizado) {
      setAcessoNegado(true);
      setMensagemAcesso("Você não possui permissão para acessar esta lista.");
      setLoading(false);
      return;
    }

    setAcessoNegado(false);
    setMensagemAcesso("");
    setEvento({
      id: eventoData.id,
      slug: eventoData.slug,
      nome: eventoData.nome,
    });
    setLista(listaData as ListaEvento);

    await carregarParticipantes(eventoData.id, listaId);

    setLoading(false);
  }, [carregarParticipantes, listaId, slug]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const podeCadastrarParticipante = canEditEventRole(roleUsuario);
  const podeExcluirParticipante = canCheckinRole(roleUsuario);

  async function importarParticipantesSimples(e: FormEvent) {
    e.preventDefault();

    setMensagemCadastro("");
    setErroCadastro(false);
    setResumoImportacao(null);
    setMostrarIgnorados(false);

    if (!evento || !lista) {
      setErroCadastro(true);
      setMensagemCadastro("Evento ou lista não identificados. Recarregue a página e tente novamente.");
      return;
    }

    if (!podeCadastrarParticipante) {
      setErroCadastro(true);
      setMensagemCadastro("Você não possui permissão para cadastrar participantes nesta lista.");
      return;
    }

    const nomes = extrairNomesFlexiveisParaImportacao(nomesEmMassa);

    if (nomes.length === 0) {
      setErroCadastro(true);
      setMensagemCadastro("Digite pelo menos um nome para importar.");
      return;
    }

    setSalvandoSimples(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setSalvandoSimples(false);
      setErroCadastro(true);
      setMensagemCadastro("Sua sessao expirou. Faca login novamente.");
      return;
    }

    const nomesValidos: string[] = [];
    const ignoradosNomes: string[] = [];

    nomes.forEach((nomeItem) => {
      const validacao = validarNomeCompletoParticipante(nomeItem);
      if (!validacao.valido) {
        ignoradosNomes.push(`${nomeItem} (nome invalido)`);
        return;
      }

      nomesValidos.push(validacao.nomeAjustado);
    });

    let inseridos = 0;

    for (const nomeValido of nomesValidos) {
      try {
        const response = await fetch("/api/participantes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            modo: "single",
            eventoId: evento.id,
            listaId: lista.id,
            participante: {
              nome: nomeValido,
              whatsapp: null,
              email: null,
            },
          }),
        });

        const result = await response.json();

        if (response.ok && !result.error) {
          inseridos += 1;
          continue;
        }

        if (response.status === 409 || String(result.error || "").toLowerCase().includes("ja cadastrado")) {
          ignoradosNomes.push(nomeValido);
          continue;
        }

        ignoradosNomes.push(`${nomeValido} (erro ao importar)`);
      } catch {
        ignoradosNomes.push(`${nomeValido} (erro ao importar)`);
      }
    }

    setSalvandoSimples(false);

    if (inseridos > 0) {
      await carregarParticipantes(evento.id, lista.id);
    }

    setNomesEmMassa("");
    setErroCadastro(false);
    setMensagemCadastro("Importacao concluida.");
    setResumoImportacao({
      inseridos,
      ignorados: ignoradosNomes.length,
      ignoradosNomes,
    });
  }

  async function adicionarParticipanteCompleto(e: FormEvent) {
    e.preventDefault();

    setMensagemCadastro("");
    setErroCadastro(false);
    setResumoImportacao(null);
    setMostrarIgnorados(false);

    if (!evento || !lista) {
      setErroCadastro(true);
      setMensagemCadastro("Evento ou lista não identificados. Recarregue a página e tente novamente.");
      return;
    }

    if (!podeCadastrarParticipante) {
      setErroCadastro(true);
      setMensagemCadastro("Você não possui permissão para cadastrar participantes nesta lista.");
      return;
    }

    const validacaoNome = validarNomeCompletoParticipante(nome);

    if (!validacaoNome.valido) {
      setErroCadastro(true);
      setMensagemCadastro(validacaoNome.motivo);
      return;
    }

    setSalvandoVip(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setSalvandoVip(false);
      setErroCadastro(true);
      setMensagemCadastro("Sua sessao expirou. Faca login novamente.");
      return;
    }

    const response = await fetch("/api/participantes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        modo: "single",
        eventoId: evento.id,
        listaId: lista.id,
        participante: {
          nome: validacaoNome.nomeAjustado,
          whatsapp: telefone.trim() || null,
          email: email.trim() || null,
        },
      }),
    });

    const result = await response.json();

    setSalvandoVip(false);

    if (!response.ok || result.error) {
      setErroCadastro(true);
      setMensagemCadastro(result.error || "Erro ao adicionar participante da Lista Completa.");
      return;
    }

    setNome("");
    setTelefone("");
    setEmail("");
    setDataNascimento("");
    setSexo("");

    await carregarParticipantes(evento.id, lista.id);
    setErroCadastro(false);
    setMensagemCadastro("Cadastro realizado com sucesso!");
  }

  function nomeCompleto(participante: ParticipanteLista) {
    return participante.nome || "";
  }

  function telefoneExibicao(participante: ParticipanteLista) {
  return participante.whatsapp || "-";
}

  async function excluirParticipante(participante: ParticipanteLista) {
    if (!evento || !podeExcluirParticipante) {
      return;
    }

    const confirmou = confirm(
      `Deseja excluir ${participante.nome} deste evento? Esta acao removera o participante e seu historico de check-in.`
    );

    if (!confirmou) {
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert("Sua sessao expirou. Faca login novamente.");
      return;
    }

    setExcluindoParticipanteId(participante.id);

    const response = await fetch("/api/participantes", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        participanteId: participante.id,
        eventoId: evento.id,
      }),
    });

    const result = await response.json();
    setExcluindoParticipanteId(null);

    if (!response.ok || result.error) {
      alert(result.error || "Nao foi possivel excluir participante.");
      return;
    }

    setParticipantes((prev) => prev.filter((item) => item.id !== participante.id));
    setErroCadastro(false);
    setMensagemCadastro("Participante excluido com sucesso.");
  }

  const participantesFiltrados = useMemo(() => {
    const termo = buscaParticipantes.trim().toLowerCase();

    if (!termo) {
      return participantes;
    }

    return participantes.filter((participante) => {
      const nomeBase = nomeCompleto(participante).toLowerCase();
      const emailBase = (participante.email || "").toLowerCase();
      const telefoneBase = telefoneExibicao(participante).toLowerCase();
      return nomeBase.includes(termo) || emailBase.includes(termo) || telefoneBase.includes(termo);
    });
  }, [buscaParticipantes, participantes]);

  const totalCadastrados = participantes.length;
  const presentes = participantes.filter((item) => item.presente).length;
  const pendentes = totalCadastrados - presentes;

  if (acessoNegado) {
    const tituloErroAcesso = mensagemAcesso === "Você não possui permissão para acessar esta lista." ? "Acesso negado" : "Lista não encontrada";

    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <div className="max-w-xl text-center">
          <h1 className="text-3xl font-bold">{tituloErroAcesso}</h1>
          <p className="text-slate-600 mt-3">{mensagemAcesso || "Você não possui permissão para acessar esta lista."}</p>
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

  if (loading || !evento || !lista) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <h1 className="text-3xl font-bold">Carregando lista...</h1>
      </main>
    );
  }

  return (
    <AdminShell
      role={roleUsuario}
      title="Convidados da Lista"
      subtitle={`Gerencie a lista ${lista.nome} com contexto completo do evento ${evento.nome}.`}
      breadcrumbs={[
        { label: "Inicio", href: "/admin" },
        { label: "Meus Eventos", href: "/admin#todos-eventos" },
        { label: evento.nome, href: `/admin/eventos/${evento.slug}` },
        { label: "Listas", href: `/admin/eventos/${evento.slug}#listas-evento` },
        { label: lista.nome },
      ]}
      backLink={{ href: `/admin/eventos/${evento.slug}#listas-evento`, label: "Voltar para Listas" }}
      aside={{
        title: "Gestao da lista",
        description:
          "Nesta tela voce importa nomes, cadastra VIPs individualmente e acompanha quem ja entrou para manter a operacao da porta organizada.",
      }}
    >
      <div className="space-y-6">
        <AdminEventTabs slug={evento.slug} current="convidados" />

        <section className="bg-white border border-blue-100 rounded-3xl p-6 space-y-2 shadow-sm">
          <p className="text-sm text-slate-600">Nome da lista: <span className="text-slate-900 font-semibold">{lista.nome}</span></p>
          <p className="text-sm text-slate-600">Tipo da lista: <span className="text-slate-900 font-semibold">{rotuloTipoLista(lista.tipo_lista)}</span></p>
          <p className="text-sm text-slate-600">Descrição: <span className="text-slate-900">{lista.descricao || "-"}</span></p>
          <p className="text-sm text-slate-600">Regra: <span className="text-slate-900">{lista.regra || "-"}</span></p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="bg-white border border-blue-100 rounded-2xl p-5 text-center shadow-sm">
            <p className="text-slate-500">Total cadastrados</p>
            <h2 className="text-4xl font-bold text-blue-900 mt-2">{totalCadastrados}</h2>
          </div>
          <div className="bg-white border border-green-200 rounded-2xl p-5 text-center shadow-sm">
            <p className="text-slate-500">Presentes</p>
            <h2 className="text-4xl font-bold text-green-600 mt-2">{presentes}</h2>
          </div>
          <div className="bg-white border border-amber-200 rounded-2xl p-5 text-center shadow-sm">
            <p className="text-slate-500">Pendentes</p>
            <h2 className="text-4xl font-bold text-amber-600 mt-2">{pendentes}</h2>
          </div>
        </section>

        <section className="bg-white border border-blue-100 rounded-3xl p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-blue-900">Buscar convidados</h2>
              <p className="mt-1 text-sm text-slate-500">Filtre por nome, e-mail ou telefone para localizar rapidamente um participante.</p>
            </div>

            <input
              type="text"
              value={buscaParticipantes}
              onChange={(e) => setBuscaParticipantes(e.target.value)}
              placeholder="Buscar participante"
              className="ui-field md:max-w-md"
            />
          </div>
        </section>

        {lista.tipo_lista === "simples" ? (
          <section className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-blue-900 mb-4">Cadastro em massa</h2>

            {!podeCadastrarParticipante ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                Seu perfil não pode cadastrar participantes nesta lista.
              </p>
            ) : null}

            {mensagemCadastro ? (
              <p className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ${erroCadastro ? "border border-red-200 bg-red-50 text-red-700" : "border border-green-200 bg-green-50 text-green-700"}`}>
                {mensagemCadastro}
              </p>
            ) : null}

            {resumoImportacao ? (
              <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 space-y-2">
                <p>Importacao concluida.</p>
                <p>✔ {resumoImportacao.inseridos} participantes adicionados.</p>
                <p>⚠ {resumoImportacao.ignorados} participantes ignorados.</p>

                {resumoImportacao.ignorados > 0 ? (
                  <button
                    type="button"
                    onClick={() => setMostrarIgnorados((prev) => !prev)}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl border border-amber-300 bg-amber-100 px-4 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-200"
                  >
                    {mostrarIgnorados ? "Ocultar participantes ignorados" : "Ver participantes ignorados"}
                  </button>
                ) : null}

                {mostrarIgnorados && resumoImportacao.ignoradosNomes.length > 0 ? (
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    <ul className="space-y-1 text-xs">
                      {resumoImportacao.ignoradosNomes.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            <p className="mb-4 text-sm text-slate-500">
              O sistema remove automaticamente marcadores como traços, bullets e
              numeração de lista antes de validar os nomes.
            </p>

            <form onSubmit={importarParticipantesSimples} className="space-y-4">
              <textarea
                value={nomesEmMassa}
                onChange={(e) => setNomesEmMassa(e.target.value)}
                placeholder={"Cole a lista como recebeu. Ex.:\n- Andre Souza\n- Dayane Silva\n\nou\n1 Andre Souza 2 Dayane Silva 3 Lorenzo Oliveira"}
                className="ui-field h-48"
                disabled={!podeCadastrarParticipante || salvandoSimples}
              />

              <button
                type="submit"
                disabled={!podeCadastrarParticipante || salvandoSimples}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white px-6 py-3 rounded-2xl font-bold min-h-11"
              >
                {salvandoSimples ? "IMPORTANDO..." : "Importar Participantes"}
              </button>
            </form>
          </section>
        ) : (
          <section className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-blue-900 mb-4">Cadastro individual da Lista Completa</h2>

            {!podeCadastrarParticipante ? (
              <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                Seu perfil não pode cadastrar participantes nesta lista.
              </p>
            ) : null}

            {mensagemCadastro ? (
              <p className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ${erroCadastro ? "border border-red-200 bg-red-50 text-red-700" : "border border-green-200 bg-green-50 text-green-700"}`}>
                {mensagemCadastro}
              </p>
            ) : null}

            <form onSubmit={adicionarParticipanteCompleto} className="grid gap-4 md:grid-cols-2">
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome *"
                className="ui-field"
                disabled={!podeCadastrarParticipante || salvandoVip}
              />

              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Telefone / WhatsApp"
                className="ui-field"
                disabled={!podeCadastrarParticipante || salvandoVip}
              />

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="ui-field"
                disabled={!podeCadastrarParticipante || salvandoVip}
              />

              <input
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                placeholder="Data de nascimento"
                className="ui-field"
                disabled={!podeCadastrarParticipante || salvandoVip}
              />

              <input
                type="text"
                value={sexo}
                onChange={(e) => setSexo(e.target.value)}
                placeholder="Sexo"
                className="ui-field"
                disabled={!podeCadastrarParticipante || salvandoVip}
              />

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={!podeCadastrarParticipante || salvandoVip}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white px-6 py-3 rounded-2xl font-bold min-h-11"
                >
                  {salvandoVip ? "ADICIONANDO..." : "Adicionar Participante"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">Participantes da Lista</h2>

          {participantesFiltrados.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum participante cadastrado nesta lista.</p>
          ) : (
            <div className="space-y-3">
              {participantesFiltrados.map((participante) => (
                <div
                  key={participante.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{nomeCompleto(participante)}</h3>
                    <p className="text-sm text-slate-600">Telefone: {telefoneExibicao(participante)}</p>
                    <p className="text-sm text-slate-600">Email: {participante.email || "-"}</p>
                  </div>

                  <div className="text-sm md:text-right">
                    <p className={participante.presente ? "text-green-600 font-bold" : "text-amber-600 font-bold"}>
                      {participante.presente ? "PRESENTE" : "PENDENTE"}
                    </p>
                    <p className="text-slate-500 mt-1">
                      Check-in: {participante.entrada_confirmada_em
                        ? new Date(participante.entrada_confirmada_em).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </p>
                  </div>

                  {podeExcluirParticipante ? (
                    <button
                      type="button"
                      onClick={() => void excluirParticipante(participante)}
                      disabled={excluindoParticipanteId === participante.id}
                      className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl border border-red-300 bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {excluindoParticipanteId === participante.id ? "Excluindo..." : "Excluir participante"}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
