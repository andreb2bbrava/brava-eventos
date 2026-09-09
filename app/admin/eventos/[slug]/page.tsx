"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { validarAcessoEvento } from "@/lib/permissoes";
import { calcularIndicadoresParticipantes } from "@/lib/participantes";
import AdminShell from "@/app/components/AdminShell";
import AdminEventTabs from "@/app/components/AdminEventTabs";
import CopyLinkButton from "@/app/components/CopyLinkButton";
import DeleteEventButton from "@/app/components/DeleteEventButton";
import { gerarSlugUnicoLista } from "@/lib/slug";
import { sanitizeMetaPixelId } from "@/lib/metaPixel";
import {
  canCreateListRole,
  canDeleteEventRole,
  canDeleteListRole,
  canEditEventRole,
  canEditListRole,
  canExportParticipantsRole,
  isAdminRole,
  type RoleUsuario,
} from "@/lib/roles";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

type ListaEventoResumo = {
  id: number;
  nome: string;
  tipo_lista: string | null;
  tipo_visibilidade?: string | null;
  visibilidade?: string | null;
  regra: string | null;
  ativa: boolean;
  slug: string | null;
  meta_pixel_id?: string | null;
  created_at?: string | null;
};

type EscopoExportacaoExcel = "evento-completo" | "lista-atual";

type LinhaParticipanteExportacao = {
  ordemCadastro: number;
  nome: string;
  whatsapp: string;
  email: string;
  lista: string;
  regraLista: string;
  status: string;
  checkin: string;
  observacoes: string;
};

type ColunaExportacao<Row> = {
  cabecalho: string;
  valor: (row: Row) => string;
};

const colunasParticipantesExportacao: ColunaExportacao<LinhaParticipanteExportacao>[] = [
  { cabecalho: "Ordem Cadastro", valor: (row) => String(row.ordemCadastro) },
  { cabecalho: "Nome", valor: (row) => row.nome },
  { cabecalho: "WhatsApp", valor: (row) => row.whatsapp },
  { cabecalho: "Email", valor: (row) => row.email },
  { cabecalho: "Lista", valor: (row) => row.lista },
  { cabecalho: "Regra da Lista", valor: (row) => row.regraLista },
  { cabecalho: "Status", valor: (row) => row.status },
  { cabecalho: "Check-in", valor: (row) => row.checkin },
  { cabecalho: "Observações", valor: (row) => row.observacoes },
];

function rotuloTipoLista(tipoLista: string | null) {
  return tipoLista === "vip" ? "Lista Completa" : "Lista Simples";
}

function rotuloVisibilidadeLista(lista: ListaEventoResumo) {
  return visibilidadeEhPublica(lista.tipo_visibilidade || lista.visibilidade) ? "Pública" : "Privada";
}

function normalizarVisibilidadeLista(valor: string | null | undefined) {
  return (valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function visibilidadeEhPublica(valor: string | null | undefined) {
  const normalizado = normalizarVisibilidadeLista(valor);
  return normalizado === "publica" || normalizado === "lista publica";
}

function normalizarNomeLista(valor: string) {
  return valor.trim().toLowerCase();
}

function slugListaEhValido(valor: string | null | undefined) {
  const slug = (valor || "").trim();
  if (!slug) {
    return false;
  }

  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function normalizarTextoBusca(valor: unknown) {
  return String(valor || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function sexoParticipanteFiltro(valor: unknown) {
  const sexo = normalizarTextoBusca(valor);

  if (sexo === "masculino") {
    return "masculino" as const;
  }

  if (sexo === "feminino") {
    return "feminino" as const;
  }

  return "indeterminado" as const;
}

export default function EventoDashboard() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";

  const [evento, setEvento] =
    useState<any>(null);

  const [participantes, setParticipantes] =
    useState<any[]>([]);

  const [busca, setBusca] =
    useState("");

  const [filtroStatus, setFiltroStatus] =
    useState<"todos" | "presentes" | "pendentes">("todos");

  const [filtroSexo, setFiltroSexo] =
    useState<"todos" | "homens" | "mulheres" | "indeterminados">("todos");

  const [filtroListaAtivo, setFiltroListaAtivo] =
    useState(false);

  const [filtroListaId, setFiltroListaId] =
    useState<number | null>(null);

  const [ordenacaoParticipantes, setOrdenacaoParticipantes] =
    useState<"cadastro_antigos" | "cadastro_recentes" | "nome_az" | "nome_za">("cadastro_recentes");

  const [acessoNegado, setAcessoNegado] =
    useState(false);

  const [roleUsuario, setRoleUsuario] =
    useState<string | null>(null);

  const [listasEvento, setListasEvento] =
    useState<ListaEventoResumo[]>([]);

  const [mostrarCriarLista, setMostrarCriarLista] = useState(false);
  const [listaNome, setListaNome] = useState("");
  const [listaRegra, setListaRegra] = useState("");
  const [listaTipo, setListaTipo] = useState("simples");
  const [listaVisibilidade, setListaVisibilidade] = useState("privada");
  const [listaMetaPixelId, setListaMetaPixelId] = useState("");
  const [listaMetaPixelInvalido, setListaMetaPixelInvalido] = useState(false);
  const [listaAtiva, setListaAtiva] = useState(true);
  const [listaEditandoId, setListaEditandoId] = useState<number | null>(null);
  const [salvandoLista, setSalvandoLista] = useState(false);
  const [mensagemLista, setMensagemLista] = useState("");
  const [mensagemParticipante, setMensagemParticipante] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  const [processandoParticipanteId, setProcessandoParticipanteId] = useState<number | null>(null);
  const [listaAtualExportacaoId, setListaAtualExportacaoId] = useState<number | null>(null);

  const mostrarMensagemCriacao = useMemo(() => searchParams.get("criado") === "1", [searchParams]);

  async function garantirSlugsListasLegadas(eventoId: number, listas: ListaEventoResumo[]) {
    let listasAtualizadas = [...listas];

    for (const lista of listas) {
      if (slugListaEhValido(lista.slug)) {
        continue;
      }

      const slugGerado = await gerarSlugUnicoLista({
        supabase,
        titulo: lista.nome || "lista",
        eventoId,
        listaIdAtual: lista.id,
      });

      if (!slugGerado) {
        continue;
      }

      const { data: listaAtualizada, error } = await supabase
        .from("listas_evento")
        .update({ slug: slugGerado })
        .eq("id", lista.id)
        .eq("evento_id", eventoId)
        .select("*")
        .single();

      if (error || !listaAtualizada) {
        console.error("Erro ao gerar slug automático de lista legada:", error);
        continue;
      }

      listasAtualizadas = listasAtualizadas.map((item) =>
        item.id === lista.id ? (listaAtualizada as ListaEventoResumo) : item
      );
    }

    return listasAtualizadas;
  }

  async function carregarListas(eventoId: number, podeCorrigirSlugLegado: boolean, role: string | null) {
    const selectComPixel = "*";
    const selectSemPixel = "id,nome,tipo_lista,tipo_visibilidade,visibilidade,regra,ativa,slug,created_at";

    const consultaBase = supabase.from("listas_evento");

    const { data: listasData } =
      isAdminRole(role) || role === "produtor"
        ? await consultaBase.select(selectComPixel).eq("evento_id", eventoId).order("created_at", { ascending: false })
        : await consultaBase.select(selectSemPixel).eq("evento_id", eventoId).order("created_at", { ascending: false });

    if (!listasData) {
      setListasEvento([]);
      return;
    }

    const listasBase = listasData as ListaEventoResumo[];

    if (!podeCorrigirSlugLegado) {
      setListasEvento(listasBase);
      return;
    }

    const listasComSlug = await garantirSlugsListasLegadas(eventoId, listasBase);
    setListasEvento(listasComSlug);
  }

  async function carregarDados() {
    if (!slug) {
      return;
    }

    const { autorizado, evento: eventoData, erro, role } =
      await validarAcessoEvento(slug);

    if (!autorizado || !eventoData) {
      setAcessoNegado(true);
      setEvento(null);
      setRoleUsuario(role ?? null);
      return;
    }

    setAcessoNegado(false);
    setRoleUsuario(role ?? null);
    setEvento(eventoData);

    // PARTICIPANTES

    const { data } =
      await supabase
        .from("participantes")
        .select("*")
        .eq(
          "evento_id",
          eventoData.id
        )
        .order("id", {
          ascending: false,
        });

    if (data) {

      setParticipantes(data);
    }

    const podeCorrigirSlugLegado = canEditEventRole(role);
    await carregarListas(eventoData.id, podeCorrigirSlugLegado, role ?? null);
  }

  async function salvarListaEvento(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSalvandoLista(true);
    setMensagemLista("");

    try {
      if (!evento?.id) {
        setMensagemLista("Evento não identificado. Recarregue a página e tente novamente.");
        return;
      }

      if (!listaNome.trim()) {
        setMensagemLista("Informe o nome da lista para continuar.");
        return;
      }

      const pixelIdInformado = (listaMetaPixelId || "").replace(/\s+/g, "").trim();
      const pixelIdValido = sanitizeMetaPixelId(pixelIdInformado);
      const possuiPixelInformado = pixelIdInformado.length > 0;

      if (possuiPixelInformado && !pixelIdValido) {
        setListaMetaPixelInvalido(true);
        setMensagemLista("Informe um ID de Pixel válido.");
        return;
      }

      setListaMetaPixelInvalido(false);

      const nomeNormalizado = normalizarNomeLista(listaNome);

      const { data: listasMesmoEvento, error: erroBuscaDuplicidade } = await supabase
        .from("listas_evento")
        .select("id, nome")
        .eq("evento_id", evento.id);

      if (erroBuscaDuplicidade) {
        console.error("Erro ao validar duplicidade de lista:", erroBuscaDuplicidade);
        setMensagemLista("Não foi possível criar a lista. Verifique os dados e tente novamente.");
        return;
      }

      const duplicada = (listasMesmoEvento || []).some((listaExistente) => {
        const mesmoNome = normalizarNomeLista(listaExistente.nome || "") === nomeNormalizado;
        const mesmaLista = listaEditandoId && listaExistente.id === listaEditandoId;
        return mesmoNome && !mesmaLista;
      });

      if (duplicada) {
        setMensagemLista("Já existe uma lista com esse nome neste evento.");
        return;
      }

      const editandoLista = Boolean(listaEditandoId);

      if (editandoLista && !canEditListRole(roleUsuario)) {
        setMensagemLista("Seu perfil não possui permissão para editar listas.");
        return;
      }

      if (!editandoLista && !canCreateListRole(roleUsuario)) {
        setMensagemLista("Seu perfil não possui permissão para criar listas.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setMensagemLista("Sua sessão expirou. Faça login novamente.");
        return;
      }

      const listaAtual = listaEditandoId ? listasEvento.find((item) => item.id === listaEditandoId) : null;
      const slugExistente = (listaAtual?.slug || "").trim();
      const precisaGerarSlug = !slugExistente;

      const slugGerado = precisaGerarSlug
        ? (await gerarSlugUnicoLista({
            supabase,
            titulo: listaNome,
            eventoId: evento.id,
            listaIdAtual: listaEditandoId,
          })) || null
        : slugExistente;

      const payload: Record<string, unknown> = {
        evento_id: evento.id,
        nome: listaNome.trim(),
        regra: listaRegra.trim() || null,
        tipo_visibilidade: (listaVisibilidade || "privada").trim() || "privada",
        tipo_lista: (listaTipo || "simples").trim() || "simples",
        meta_pixel_id: pixelIdValido || null,
        ativa: typeof listaAtiva === "boolean" ? listaAtiva : true,
        slug: slugGerado,
      };

      if (!payload.evento_id) {
        setMensagemLista("Evento não identificado. Recarregue a página e tente novamente.");
        return;
      }

      const response = await fetch("/api/admin/listas", {
        method: listaEditandoId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          eventoId: evento.id,
          listaId: listaEditandoId || undefined,
          nome: String(payload.nome || ""),
          regra: payload.regra ?? null,
          tipoVisibilidade: payload.tipo_visibilidade,
          tipoLista: payload.tipo_lista,
          metaPixelId: payload.meta_pixel_id,
          ativa: payload.ativa,
          slug: payload.slug,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        console.error("Erro ao salvar lista:", result);
        setMensagemLista(
          result.error ||
            (listaEditandoId
              ? "Não foi possível atualizar a lista. Tente novamente."
              : "Não foi possível criar a lista. Verifique os dados e tente novamente.")
        );
        return;
      }

      const listaPersistida = result.lista as ListaEventoResumo;

      if (listaPersistida) {
        if (listaEditandoId) {
          setListasEvento((prev) => prev.map((item) => (item.id === listaEditandoId ? listaPersistida : item)));
        } else {
          setListasEvento((prev) => [listaPersistida, ...prev]);
        }
      } else {
        const podeCorrigirSlugLegado = canEditEventRole(roleUsuario);
        await carregarListas(evento.id, podeCorrigirSlugLegado, roleUsuario ?? null);
      }

      setListaNome("");
      setListaRegra("");
      setListaTipo("simples");
      setListaVisibilidade("privada");
      setListaMetaPixelId("");
      setListaMetaPixelInvalido(false);
      setListaAtiva(true);
      setListaEditandoId(null);
      setMostrarCriarLista(false);
      setMensagemLista(listaEditandoId ? "Lista atualizada com sucesso." : "Lista criada com sucesso.");
    } catch (erroCatch) {
      console.error("Erro capturado no catch:", erroCatch);
      setMensagemLista("Não foi possível criar a lista. Verifique os dados e tente novamente.");
    } finally {
      setSalvandoLista(false);
    }
  }

  function abrirCriacaoLista() {
    if (!canCreateListRole(roleUsuario)) {
      setMensagemLista("Seu perfil não possui permissão para criar listas.");
      return;
    }

    setMostrarCriarLista(true);
    setMensagemLista("");
    setListaEditandoId(null);
    setListaNome("");
    setListaRegra("");
    setListaTipo("simples");
    setListaVisibilidade("privada");
    setListaMetaPixelId("");
    setListaMetaPixelInvalido(false);
    setListaAtiva(true);

    requestAnimationFrame(() => {
      const secao = document.getElementById("listas-evento");
      if (secao) {
        secao.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  function abrirEdicaoLista(lista: ListaEventoResumo) {
    if (!canEditListRole(roleUsuario)) {
      setMensagemLista("Seu perfil não possui permissão para editar listas.");
      return;
    }

    setMostrarCriarLista(true);
    setMensagemLista("");
    setListaEditandoId(lista.id);
    setListaNome(lista.nome || "");
    setListaRegra(lista.regra || "");
    setListaTipo(lista.tipo_lista || "simples");
    setListaVisibilidade((lista.tipo_visibilidade || lista.visibilidade || "privada").toLowerCase());
    setListaMetaPixelId((lista.meta_pixel_id || "").trim());
    setListaMetaPixelInvalido(false);
    setListaAtiva(lista.ativa);

    requestAnimationFrame(() => {
      const secao = document.getElementById("listas-evento");
      if (secao) {
        secao.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  async function excluirListaCentral(listaId: number) {
    if (!evento?.id || !canDeleteListRole(roleUsuario)) {
      setMensagemLista("Somente administradores podem excluir listas.");
      return;
    }

    if (
      !confirm(
        "Deseja excluir esta lista definitivamente? Esta ação é exclusiva de administradores e não poderá ser desfeita."
      )
    ) {
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setMensagemLista("Sua sessão expirou. Faça login novamente.");
      return;
    }

    const response = await fetch("/api/admin/listas", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        eventoId: evento.id,
        listaId,
      }),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      console.error("Erro ao excluir lista:", result);
      setMensagemLista(result.error || "Não foi possível excluir a lista. Tente novamente.");
      return;
    }

    setListasEvento((prev) => prev.filter((lista) => lista.id !== listaId));

    if (listaEditandoId === listaId) {
      setListaEditandoId(null);
      setListaNome("");
      setListaRegra("");
      setListaTipo("simples");
      setListaVisibilidade("privada");
      setListaMetaPixelId("");
      setListaMetaPixelInvalido(false);
      setListaAtiva(true);
      setMostrarCriarLista(false);
    }

    setMensagemLista("Lista excluída com sucesso.");
  }

  async function atualizarCheckinParticipante(id: number, action: "checkin" | "undo-checkin") {
    if (!evento?.id) {
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setMensagemParticipante({ tipo: "erro", texto: "Sua sessao expirou. Faca login novamente." });
      return;
    }

    setProcessandoParticipanteId(id);

    const response = await fetch("/api/participantes", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        participanteId: id,
        eventoId: evento.id,
        action,
      }),
    });

    const result = await response.json();
    setProcessandoParticipanteId(null);

    if (!response.ok || result.error) {
      setMensagemParticipante({ tipo: "erro", texto: result.error || "Nao foi possivel atualizar o check-in." });
      return;
    }

    const participanteAtualizado = result.participante as { id: number; presente: boolean; entrada_confirmada_em: string | null };

    setParticipantes((prev) =>
      prev.map((item) =>
        item.id === participanteAtualizado.id
          ? {
              ...item,
              presente: participanteAtualizado.presente,
              entrada_confirmada_em: participanteAtualizado.entrada_confirmada_em,
            }
          : item
      )
    );

    setMensagemParticipante({
      tipo: "sucesso",
      texto: action === "checkin" ? "Check-in realizado com sucesso!" : "Check-in desfeito com sucesso.",
    });
  }

  async function fazerCheckin(id: number) {
    await atualizarCheckinParticipante(id, "checkin");
  }

  async function desfazerCheckin(id: number) {
    const participante = participantes.find((item) => item.id === id);

    if (!participante) {
      return;
    }

    if (!confirm(`Deseja desfazer o check-in de ${participante.nome}?`)) {
      return;
    }

    await atualizarCheckinParticipante(id, "undo-checkin");
  }

  async function excluirParticipante(id: number) {
    if (!evento?.id) {
      return;
    }

    const participante = participantes.find((item) => item.id === id);

    if (!participante) {
      return;
    }

    if (!confirm(`Deseja excluir ${participante.nome} deste evento? Esta acao removera o participante e seu historico de check-in.`)) {
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setMensagemParticipante({ tipo: "erro", texto: "Sua sessao expirou. Faca login novamente." });
      return;
    }

    setProcessandoParticipanteId(id);

    const response = await fetch("/api/participantes", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        participanteId: id,
        eventoId: evento.id,
      }),
    });

    const result = await response.json();
    setProcessandoParticipanteId(null);

    if (!response.ok || result.error) {
      setMensagemParticipante({ tipo: "erro", texto: result.error || "Nao foi possivel excluir participante." });
      return;
    }

    setParticipantes((prev) => prev.filter((item) => item.id !== id));
    setMensagemParticipante({ tipo: "sucesso", texto: "Participante excluido com sucesso." });
  }

  // EXPORTAR EXCEL

  function montarLinhasParticipantesExportacao(participantesBase: any[]): LinhaParticipanteExportacao[] {
    return participantesBase.map((participante, index) => {
      const dadosLista = infoLista(participante);
      return {
        ordemCadastro: index + 1,
        nome: participante.nome || "",
        whatsapp: participante.whatsapp || "",
        email: participante.email || "",
        lista: dadosLista.nome,
        regraLista: dadosLista.regra,
        status: participante.presente ? "PRESENTE" : "PENDENTE",
        checkin: participante.entrada_confirmada_em
          ? new Date(participante.entrada_confirmada_em).toLocaleTimeString("pt-BR")
          : "",
        observacoes: "",
      };
    });
  }

  function normalizarNomeArquivo(valor: string) {
    return (valor || "")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function montarNomeArquivoExportacao(escopo: EscopoExportacaoExcel, listaAtualSelecionada: ListaEventoResumo | null) {
    const nomeEvento = normalizarNomeArquivo(evento?.nome || "Evento");

    if (escopo === "evento-completo") {
      return `${nomeEvento} - Evento Completo.xlsx`;
    }

    const nomeLista = normalizarNomeArquivo(listaAtualSelecionada?.nome || "Lista");
    return `${nomeEvento} - Lista ${nomeLista}.xlsx`;
  }

  function validarPermissaoExportacaoParticipantes() {
    if (canExportParticipantsRole(roleUsuario)) {
      return true;
    }

    setMensagemParticipante({
      tipo: "erro",
      texto: "Seu perfil nao possui permissao para exportar participantes deste evento.",
    });
    return false;
  }

  function exportarExcel(escopo: EscopoExportacaoExcel) {
    if (!validarPermissaoExportacaoParticipantes()) {
      return;
    }

    const listaAtualSelecionada =
      escopo === "lista-atual"
        ? listasEvento.find((lista) => lista.id === listaAtualExportacaoId) || null
        : null;

    const participantesBase =
      escopo === "lista-atual" && listaAtualSelecionada
        ? participantes.filter((participante) => Number(participante.lista_id) === Number(listaAtualSelecionada.id))
        : participantes;

    const linhasParticipantes = montarLinhasParticipantesExportacao(participantesBase);
    const totalInscritos = participantesBase.length;
    const totalPresentes = participantesBase.filter((participante) => participante.presente).length;
    const dataHoraExportacao = new Date().toLocaleString("pt-BR");

    const nomeListaCabecalho =
      escopo === "lista-atual"
        ? listaAtualSelecionada?.nome || "Sem lista selecionada"
        : "Evento completo";

    const regraListaCabecalho =
      escopo === "lista-atual"
        ? (listaAtualSelecionada?.regra || "").trim() || "Sem regra definida"
        : "Regras por participante";

    const cabecalho = [
      ["BRAVA EVENTOS", ""],
      [],
      ["Evento", evento?.nome || "-"],
      ["Lista", nomeListaCabecalho],
      ["Regra da Lista", regraListaCabecalho],
      ["Data e hora da exportação", dataHoraExportacao],
      ["Total de inscritos", String(totalInscritos)],
      ["Total de presentes", String(totalPresentes)],
      [],
    ];

    const cabecalhoTabela = colunasParticipantesExportacao.map((coluna) => coluna.cabecalho);
    const linhasTabela = linhasParticipantes.map((linha) =>
      colunasParticipantesExportacao.map((coluna) => coluna.valor(linha))
    );

    const worksheet = XLSX.utils.aoa_to_sheet([...cabecalho, cabecalhoTabela, ...linhasTabela]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Participantes");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const fileData = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });

    saveAs(fileData, montarNomeArquivoExportacao(escopo, listaAtualSelecionada));
  }

  // EXPORTAR XML

  function exportarXML() {
    if (!validarPermissaoExportacaoParticipantes()) {
      return;
    }

    let xml =
      `<?xml version="1.0" encoding="UTF-8"?>`;

    xml += `<participantes>`;

    participantes.forEach((p) => {

      xml += `
        <participante>
          <nome>${p.nome}</nome>
          <whatsapp>${p.whatsapp || ""}</whatsapp>
          <email>${p.email || ""}</email>
          <status>${
            p.presente
              ? "PRESENTE"
              : "PENDENTE"
          }</status>
        </participante>
      `;
    });

    xml += `</participantes>`;

    const blob =
      new Blob(
        [xml],
        {
          type:
            "application/xml",
        }
      );

    saveAs(
      blob,
      `${evento.slug}.xml`
    );
  }

  useEffect(() => {
    if (slug) {
      carregarDados();
    }
  }, [slug]);

  useEffect(() => {
    if (mostrarMensagemCriacao) {
      setMostrarCriarLista(true);
    }
  }, [mostrarMensagemCriacao]);

  useEffect(() => {
    if (listasEvento.length === 0) {
      setListaAtualExportacaoId(null);
      return;
    }

    const listaSelecionadaExiste = listasEvento.some((lista) => lista.id === listaAtualExportacaoId);
    if (!listaSelecionadaExiste) {
      setListaAtualExportacaoId(listasEvento[0].id);
    }
  }, [listasEvento, listaAtualExportacaoId]);

  // FILTRO + BUSCA

  const participantesFiltrados = useMemo(() => {
    const termoBusca = normalizarTextoBusca(busca);

    const filtrados = participantes.filter((participante) => {
      const nome = normalizarTextoBusca(participante.nome);
      const whatsapp = normalizarTextoBusca(participante.whatsapp);
      const passaBusca = !termoBusca || nome.includes(termoBusca) || whatsapp.includes(termoBusca);

      if (!passaBusca) {
        return false;
      }

      if (filtroStatus === "presentes" && !participante.presente) {
        return false;
      }

      if (filtroStatus === "pendentes" && participante.presente) {
        return false;
      }

      const sexo = sexoParticipanteFiltro(participante.sexo_estimado);

      if (filtroSexo === "homens" && sexo !== "masculino") {
        return false;
      }

      if (filtroSexo === "mulheres" && sexo !== "feminino") {
        return false;
      }

      if (filtroSexo === "indeterminados" && sexo !== "indeterminado") {
        return false;
      }

      if (filtroListaAtivo && filtroListaId !== null && Number(participante.lista_id) !== Number(filtroListaId)) {
        return false;
      }

      return true;
    });

    return filtrados.sort((a, b) => {
      if (ordenacaoParticipantes === "cadastro_antigos") {
        return Number(a.id) - Number(b.id);
      }

      if (ordenacaoParticipantes === "cadastro_recentes") {
        return Number(b.id) - Number(a.id);
      }

      const nomeA = String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", { sensitivity: "base" });

      if (ordenacaoParticipantes === "nome_az") {
        return nomeA;
      }

      return nomeA * -1;
    });
  }, [busca, filtroListaAtivo, filtroListaId, filtroSexo, filtroStatus, ordenacaoParticipantes, participantes]);

  function infoLista(participante: any) {
    const lista = listasEvento.find((item) => item.id === participante.lista_id);

    return {
      nome: lista?.nome || "Sem lista",
      tipo: lista?.tipo_lista || "simples",
      regra: (lista?.regra || "").trim() || "Sem regra definida",
    };
  }

  // ANALÍTICOS

  const indicadoresParticipantes = useMemo(
    () => calcularIndicadoresParticipantes(participantes),
    [participantes]
  );

  const cardsIndicadores = [
    {
      titulo: "👥 Total de inscritos",
      valor: indicadoresParticipantes.totalInscritos,
      valorClassName: "text-blue-900 sm:text-5xl",
      cardClassName: "border-blue-100",
    },
    {
      titulo: "Presentes",
      valor: indicadoresParticipantes.totalPresentes,
      valorClassName: "text-green-600 sm:text-5xl",
      cardClassName: "border-green-200",
    },
    {
      titulo: "Pendentes",
      valor: indicadoresParticipantes.totalPendentes,
      valorClassName: "text-amber-600 sm:text-5xl",
      cardClassName: "border-amber-200",
    },
    {
      titulo: "Comparecimento",
      valor: `${indicadoresParticipantes.porcentagemComparecimento}%`,
      valorClassName: "text-blue-500 sm:text-5xl",
      cardClassName: "border-blue-100",
    },
    {
      titulo: "Horário Mais Quente",
      valor: `🔥 ${indicadoresParticipantes.horarioMaisQuente}`,
      valorClassName: "text-orange-500 sm:text-4xl",
      cardClassName: "border-orange-200",
    },
    {
      titulo: "👨 Homens",
      valor: indicadoresParticipantes.homens,
      valorClassName: "text-sky-600 sm:text-5xl",
      cardClassName: "border-sky-200",
    },
    {
      titulo: "👩 Mulheres",
      valor: indicadoresParticipantes.mulheres,
      valorClassName: "text-pink-600 sm:text-5xl",
      cardClassName: "border-pink-200",
    },
    {
      titulo: "❓ Indeterminado",
      valor: indicadoresParticipantes.indeterminado,
      valorClassName: "text-slate-600 sm:text-5xl",
      cardClassName: "border-slate-200",
    },
    {
      titulo: "✅ Homens presentes",
      valor: indicadoresParticipantes.homensPresentes,
      valorClassName: "text-emerald-600 sm:text-5xl",
      cardClassName: "border-emerald-200",
    },
    {
      titulo: "✅ Mulheres presentes",
      valor: indicadoresParticipantes.mulheresPresentes,
      valorClassName: "text-teal-600 sm:text-5xl",
      cardClassName: "border-teal-200",
    },
    {
      titulo: "⏳ Homens pendentes",
      valor: indicadoresParticipantes.homensPendentes,
      valorClassName: "text-yellow-700 sm:text-5xl",
      cardClassName: "border-yellow-200",
    },
    {
      titulo: "⏳ Mulheres pendentes",
      valor: indicadoresParticipantes.mulheresPendentes,
      valorClassName: "text-orange-700 sm:text-5xl",
      cardClassName: "border-orange-200",
    },
    {
      titulo: "❓ Indeterminados presentes",
      valor: indicadoresParticipantes.indeterminadosPresentes,
      valorClassName: "text-violet-600 sm:text-5xl",
      cardClassName: "border-violet-200",
    },
    {
      titulo: "❓ Indeterminados pendentes",
      valor: indicadoresParticipantes.indeterminadosPendentes,
      valorClassName: "text-purple-700 sm:text-5xl",
      cardClassName: "border-purple-200",
    },
  ];
  const totalClassificados =
  indicadoresParticipantes.homens +
  indicadoresParticipantes.mulheres +
  indicadoresParticipantes.indeterminado;

const percentualHomens =
  totalClassificados > 0
    ? Math.round((indicadoresParticipantes.homens / totalClassificados) * 100)
    : 0;

const percentualMulheres =
  totalClassificados > 0
    ? Math.round((indicadoresParticipantes.mulheres / totalClassificados) * 100)
    : 0;

const percentualIndeterminado =
  totalClassificados > 0
    ? Math.max(0, 100 - percentualHomens - percentualMulheres)
    : 0;

const desempenhoListas = listasEvento
  .map((lista) => {
    const participantesLista = participantes.filter(
      (participante) => Number(participante.lista_id) === Number(lista.id)
    );

    const inscritos = participantesLista.length;
    const presentes = participantesLista.filter(
      (participante) => participante.presente
    ).length;

    const comparecimento =
      inscritos > 0 ? Math.round((presentes / inscritos) * 100) : 0;

    return {
      id: lista.id,
      nome: lista.nome,
      inscritos,
      presentes,
      comparecimento,
      ativa: lista.ativa,
    };
  })
  .sort((a, b) => b.inscritos - a.inscritos);

  if (acessoNegado) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
        <h1 className="text-4xl font-bold">
          Você não possui permissão para acessar este evento.
        </h1>
      </main>
    );
  }

  if (!evento) {

    return (

      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">

        <h1 className="text-4xl font-bold">
          Carregando evento...
        </h1>

      </main>
    );
  }

  const podeExcluirEvento = canDeleteEventRole(roleUsuario);
  const podeExportarParticipantes = canExportParticipantsRole(roleUsuario);

  return (

    <AdminShell
      role={(roleUsuario as RoleUsuario | null) ?? null}
      title="Central do Evento"
      subtitle={evento ? `Acompanhe convidados, check-in e performance operacional de ${evento.nome}.` : "Acompanhe o evento em tempo real."}
      breadcrumbs={[
        { label: "Inicio", href: "/admin" },
        { label: "Meus Eventos", href: "/admin#todos-eventos" },
        { label: evento?.nome || "Evento" },
      ]}
      backLink={{ href: "/admin#todos-eventos", label: "Voltar para Meus Eventos" }}
      aside={{
        title: "Central do Evento",
        description:
          "Use esta central para acompanhar convidados, validar entradas, navegar para listas e manter a operacao do evento organizada em um unico lugar.",
      }}
    >
      <div className="space-y-6">
        <AdminEventTabs slug={evento.slug} current="visao-geral" />

        {mostrarMensagemCriacao ? (
          <section className="rounded-3xl border border-green-200 bg-green-50 px-5 py-4 text-green-700 shadow-sm">
            <p className="font-semibold">Evento criado com sucesso. Agora crie suas listas.</p>
          </section>
        ) : null}

      {/* HERO */}

      <section className="relative min-h-[300px] md:h-[320px] border-b border-blue-100 bg-white">

        <img
          src={evento.banner_url}
          alt={evento.nome}
          className={`w-full h-full object-cover ${
            evento.banner_posicao ===
            "top"
              ? "object-top"
              : evento.banner_posicao ===
                "bottom"
              ? "object-bottom"
              : "object-center"
          } opacity-35`}
        />

        <div className="absolute inset-0 bg-white/55" />

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 md:p-6">

          <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold text-blue-900 break-words">
            {evento.nome}
          </h1>

          <p className="mt-3 text-lg sm:text-2xl">
  Central do Evento
</p>

<div className="flex gap-3 mt-5 flex-wrap justify-center w-full px-2">

  {canEditEventRole(roleUsuario) ? (
    <Link
      href={`/admin/eventos/${evento.slug}/editar`}
      className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-2xl font-bold transition min-h-11"
    >
      Editar Evento
    </Link>
  ) : null}

  {canCreateListRole(roleUsuario) ? (
    <button
      type="button"
      onClick={abrirCriacaoLista}
      className="bg-blue-800 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-extrabold shadow-lg shadow-blue-200 transition min-h-11"
    >
      Criar Lista
    </button>
  ) : null}

  {roleUsuario === "staff" && (
    <span className="bg-orange-100 text-orange-700 px-4 py-3 rounded-2xl font-semibold">
      Acesso operacional: listas, participantes e check-in
    </span>
  )}

  <a
    href={`/evento/${evento.slug}`}
    target="_blank"
    className="bg-blue-100 hover:bg-blue-200 text-blue-900 px-5 py-3 rounded-2xl font-bold transition min-h-11"
  >
    Página Pública
  </a>

  <CopyLinkButton
    link={() => `${window.location.origin}/evento/${evento.slug}`}
    idleLabel="Copiar Link"
    copiedLabel="Copiado ✓"
    className="bg-green-500 hover:bg-green-400 text-white px-5 py-3 rounded-2xl font-bold transition min-h-11"
  />

</div>

        </div>

      </section>

      {podeExcluirEvento ? (
        <section className="rounded-3xl border border-red-200 bg-red-50/60 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-red-700">Zona de perigo</h2>
              <p className="mt-1 text-sm text-red-700/90">
                Exclui definitivamente o evento e todos os dados vinculados.
              </p>
            </div>

            <DeleteEventButton
              eventoId={evento.id}
              eventoNome={evento.nome}
              canDelete={podeExcluirEvento}
              redirectToAdmin
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-300"
            />
          </div>

        </section>
      ) : null}

      <section id="listas-evento" className="rounded-3xl border border-blue-100 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-blue-900">Listas do Evento</h2>
            <p className="mt-1 text-sm text-slate-500">Crie e abra listas diretamente da Central do Evento.</p>
          </div>

          {canCreateListRole(roleUsuario) && !mostrarCriarLista ? (
            <button
              type="button"
              onClick={abrirCriacaoLista}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-700 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-blue-600"
            >
              Criar Lista
            </button>
          ) : null}
        </div>

        {mostrarCriarLista && (listaEditandoId ? canEditListRole(roleUsuario) : canCreateListRole(roleUsuario)) ? (
          <form onSubmit={salvarListaEvento} className="mt-5 rounded-3xl border border-blue-100 bg-blue-50/40 p-4 sm:p-5">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-blue-900">Nome da Lista</label>
                <input
                  type="text"
                  value={listaNome}
                  onChange={(e) => setListaNome(e.target.value)}
                  placeholder="Nome da lista"
                  className="ui-field"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-blue-900">Tipo da Lista</label>
                <select
                  value={listaTipo}
                  onChange={(e) => setListaTipo(e.target.value)}
                  className="ui-field"
                >
                  <option value="simples">Lista Simples</option>
                  <option value="vip">Lista Completa</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-blue-900">Visibilidade</label>
                <select
                  value={listaVisibilidade}
                  onChange={(e) => setListaVisibilidade(e.target.value)}
                  className="ui-field"
                >
                  <option value="publica">Lista Pública</option>
                  <option value="privada">Lista Privada</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-blue-900">Regra da Lista</label>
                <input
                  type="text"
                  value={listaRegra}
                  onChange={(e) => setListaRegra(e.target.value)}
                  placeholder="Ex: VIP, Entrada ate 22h"
                  className="ui-field"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-blue-900">Meta Pixel ID</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={listaMetaPixelId}
                  onChange={(e) => {
                    setListaMetaPixelId(e.target.value.replace(/\s+/g, ""));
                    if (listaMetaPixelInvalido) {
                      setListaMetaPixelInvalido(false);
                    }
                    if (mensagemLista === "Informe um ID de Pixel válido.") {
                      setMensagemLista("");
                    }
                  }}
                  placeholder="123456789012345"
                  className={`ui-field ${listaMetaPixelInvalido ? "ui-field-error" : ""}`}
                />
                <p className="mt-2 text-xs text-slate-500">
                  Informe apenas o número do Pixel da Meta. Exemplo: 123456789012345.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Este Pixel registrará acessos e cadastros realizados nesta lista pública.
                </p>
                {listaMetaPixelInvalido ? (
                  <p className="mt-2 text-sm font-semibold text-red-600">Informe um ID de Pixel válido.</p>
                ) : null}
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={listaAtiva}
                  onChange={(e) => setListaAtiva(e.target.checked)}
                />
                Lista ativa
              </label>

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="submit"
                  disabled={salvandoLista}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-700 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {salvandoLista ? "Salvando..." : listaEditandoId ? "Salvar Alterações" : "Salvar Lista"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarCriarLista(false);
                    setListaEditandoId(null);
                    setListaNome("");
                    setListaRegra("");
                    setListaTipo("simples");
                    setListaVisibilidade("privada");
                    setListaMetaPixelId("");
                    setListaMetaPixelInvalido(false);
                    setListaAtiva(true);
                  }}
                  className="ui-btn-secondary inline-flex min-h-11 items-center justify-center rounded-2xl px-5 py-3 text-sm font-bold transition"
                >
                  Fechar
                </button>
              </div>
            </div>

            {mensagemLista ? (
              <p className={`mt-4 text-sm font-semibold ${mensagemLista.includes("Não foi possível") ? "text-red-600" : "text-green-700"}`}>
                {mensagemLista}
              </p>
            ) : null}
          </form>
        ) : null}

        {roleUsuario === "staff" ? (
          <p className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
            Staff pode criar listas e gerenciar participantes, mas não pode editar nem excluir listas.
          </p>
        ) : null}

<div className="mt-5">

  {/* DESKTOP */}

  <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

    <table className="w-full table-fixed">

      <colgroup>
  <col className="w-[32%]" />
  <col className="w-[11%]" />
  <col className="w-[10%]" />
  <col className="w-[10%]" />
  <col className="w-[11%]" />
  <col className="w-[26%]" />
</colgroup>

      <thead className="bg-slate-50">
        <tr className="border-b border-slate-200">
          <th className="px-5 py-4 text-left text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Lista
          </th>

          <th className="px-4 py-4 text-center text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Tipo
          </th>

          <th className="px-4 py-4 text-center text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Inscritos
          </th>

          <th className="px-4 py-4 text-center text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Presentes
          </th>

          <th className="px-4 py-4 text-center text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Status
          </th>

          <th className="px-5 py-4 text-right text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Ações
          </th>
        </tr>
      </thead>

      <tbody>

        {listasEvento.length === 0 ? (

          <tr>
            <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
              Nenhuma lista criada para este evento.
            </td>
          </tr>

        ) : (

          listasEvento.map((lista) => {

            const desempenho = desempenhoListas.find(
              (item) => item.id === lista.id
            );

            const listaPublica =
              visibilidadeEhPublica(
                lista.tipo_visibilidade || lista.visibilidade
              );

            const listaPublicaAtivaComSlug =
              listaPublica && !!lista.ativa && !!lista.slug;

            return (

              <tr
                key={lista.id}
                className="border-b border-slate-100 last:border-0 transition hover:bg-slate-50/70"
              >

                {/* LISTA */}

                <td className="px-5 py-4 align-top">

                  <div className="flex items-start gap-3">

                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm">
                      📋
                    </div>

                    <div className="min-w-0">

                      <p className="break-words font-extrabold text-blue-950">
                        {lista.nome}
                      </p>

                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                        {(lista.regra || "").trim()
                          ? lista.regra
                          : "Sem regra definida"}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">

                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            listaPublica
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {listaPublica ? "Pública" : "Privada"}
                        </span>

                        {(canEditEventRole(roleUsuario)) &&
                        sanitizeMetaPixelId(lista.meta_pixel_id) ? (
                          <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                            Pixel ativo
                          </span>
                        ) : null}

                      </div>

                    </div>

                  </div>

                </td>

                {/* TIPO */}

                <td className="px-4 py-4 text-center align-middle">
                  <span className="text-sm font-semibold text-slate-600">
                    {rotuloTipoLista(lista.tipo_lista ?? null)}
                  </span>
                </td>

                {/* INSCRITOS */}

                <td className="px-4 py-4 text-center align-middle">
                  <span className="text-lg font-black text-blue-700">
                    {desempenho?.inscritos ?? 0}
                  </span>
                </td>

                {/* PRESENTES */}

                <td className="px-4 py-4 text-center align-middle">
                  <span className="text-lg font-black text-emerald-600">
                    {desempenho?.presentes ?? 0}
                  </span>
                </td>

                {/* STATUS */}

                <td className="px-4 py-4 text-center align-middle">

                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${
                      lista.ativa
                        ? "bg-green-50 text-green-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        lista.ativa
                          ? "bg-green-500"
                          : "bg-slate-400"
                      }`}
                    />

                    {lista.ativa ? "Ativa" : "Inativa"}

                  </span>

                </td>

                {/* AÇÕES */}

                <td className="px-5 py-4 align-middle">

                  <div className="flex items-center justify-end gap-2 whitespace-nowrap">

                    <Link
                      href={`/admin/eventos/${evento.slug}/listas/${lista.id}`}
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-700 px-3.5 text-xs font-extrabold text-white transition hover:bg-blue-600"
                    >
                      Abrir
                    </Link>

                    {canEditListRole(roleUsuario) ? (

                      <>
                        <button
                          type="button"
                          onClick={() => abrirEdicaoLista(lista)}
                          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                        >
                          Editar
                        </button>

                      </>

                    ) : null}

                    {canDeleteListRole(roleUsuario) ? (
                      <button
                        type="button"
                        onClick={() => void excluirListaCentral(lista.id)}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-red-100 bg-red-50 px-3.5 text-xs font-bold text-red-600 transition hover:bg-red-100"
                      >
                        Excluir
                      </button>
                    ) : null}

                    {listaPublicaAtivaComSlug ? (

                      <CopyLinkButton
                        link={() =>
                          `${window.location.origin}/evento/${evento.slug}/${lista.slug}`
                        }
                        idleLabel="Link"
                        copiedLabel="Copiado ✓"
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 px-3.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                      />

                    ) : null}

                  </div>

                </td>

              </tr>

            );

          })

        )}

      </tbody>

    </table>

  </div>

  {/* MOBILE / TABLET */}

  <div className="space-y-3 lg:hidden">

    {listasEvento.length === 0 ? (

      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Nenhuma lista criada para este evento.
      </div>

    ) : (

      listasEvento.map((lista) => {

        const desempenho = desempenhoListas.find(
          (item) => item.id === lista.id
        );

        const listaPublica =
          visibilidadeEhPublica(
            lista.tipo_visibilidade || lista.visibilidade
          );

        const listaPublicaAtivaComSlug =
          listaPublica && !!lista.ativa && !!lista.slug;

        return (

          <article
            key={lista.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >

            <div className="flex items-start justify-between gap-3">

              <div className="min-w-0">

                <p className="break-words font-extrabold text-blue-950">
                  {lista.nome}
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {(lista.regra || "").trim()
                    ? lista.regra
                    : "Sem regra definida"}
                </p>

              </div>

              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                  lista.ativa
                    ? "bg-green-50 text-green-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {lista.ativa ? "Ativa" : "Inativa"}
              </span>

            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">

              <div className="rounded-xl bg-blue-50 p-3 text-center">
                <p className="text-[11px] font-bold uppercase text-blue-500">
                  Inscritos
                </p>

                <p className="mt-1 text-xl font-black text-blue-700">
                  {desempenho?.inscritos ?? 0}
                </p>
              </div>

              <div className="rounded-xl bg-emerald-50 p-3 text-center">
                <p className="text-[11px] font-bold uppercase text-emerald-600">
                  Presentes
                </p>

                <p className="mt-1 text-xl font-black text-emerald-700">
                  {desempenho?.presentes ?? 0}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-[11px] font-bold uppercase text-slate-500">
                  Presença
                </p>

                <p className="mt-1 text-xl font-black text-slate-700">
                  {desempenho?.comparecimento ?? 0}%
                </p>
              </div>

            </div>

            <div className="mt-4 flex flex-wrap gap-2">

              <Link
                href={`/admin/eventos/${evento.slug}/listas/${lista.id}`}
                className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-extrabold text-white"
              >
                Abrir lista
              </Link>

              {canEditListRole(roleUsuario) ? (

                <button
                  type="button"
                  onClick={() => abrirEdicaoLista(lista)}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
                >
                  Editar
                </button>

              ) : null}

              {listaPublicaAtivaComSlug ? (

                <CopyLinkButton
                  link={() =>
                    `${window.location.origin}/evento/${evento.slug}/${lista.slug}`
                  }
                  idleLabel="Copiar link"
                  copiedLabel="Copiado ✓"
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700"
                />

              ) : null}

              {canDeleteListRole(roleUsuario) ? (

                <button
                  type="button"
                  onClick={() => void excluirListaCentral(lista.id)}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-bold text-red-600"
                >
                  Excluir
                </button>

              ) : null}

            </div>

          </article>

        );

      })

    )}

  </div>

</div>

       {/* DASHBOARD BI */}

<div className="mb-8 space-y-5">

  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-600">
        Inteligência do Evento
      </p>

      <h2 className="mt-1 text-2xl font-black text-blue-950">
        Visão geral da operação
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Acompanhe inscrições, presença e comportamento do público em tempo real.
      </p>
    </div>

    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
      <span className="h-2 w-2 rounded-full bg-green-500" />
      Dados atualizados
    </div>
  </div>

  {/* KPIs PRINCIPAIS */}

  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">

    <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-500">
          Total de inscritos
        </p>

        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg">
          👥
        </span>
      </div>

      <p className="mt-3 text-3xl font-black text-blue-950 sm:text-4xl">
        {indicadoresParticipantes.totalInscritos}
      </p>

      <p className="mt-1 text-xs text-slate-400">
        participantes cadastrados
      </p>
    </div>

    <div className="rounded-2xl border border-green-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-500">
          Presentes
        </p>

        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-lg">
          ✓
        </span>
      </div>

      <p className="mt-3 text-3xl font-black text-green-600 sm:text-4xl">
        {indicadoresParticipantes.totalPresentes}
      </p>

      <p className="mt-1 text-xs text-slate-400">
        check-ins realizados
      </p>
    </div>

    <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-500">
          Pendentes
        </p>

        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-lg">
          ⏳
        </span>
      </div>

      <p className="mt-3 text-3xl font-black text-amber-600 sm:text-4xl">
        {indicadoresParticipantes.totalPendentes}
      </p>

      <p className="mt-1 text-xs text-slate-400">
        ainda não entraram
      </p>
    </div>

    <div className="rounded-2xl border border-sky-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-500">
          Comparecimento
        </p>

        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-lg">
          📈
        </span>
      </div>

      <p className="mt-3 text-3xl font-black text-blue-600 sm:text-4xl">
        {indicadoresParticipantes.porcentagemComparecimento}%
      </p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-600"
          style={{
            width: `${Math.min(
              100,
              indicadoresParticipantes.porcentagemComparecimento
            )}%`,
          }}
        />
      </div>
    </div>

  </div>

  {/* SEGUNDA LINHA */}

  <div className="grid gap-4 lg:grid-cols-3">

    {/* PERFIL DO PÚBLICO */}

    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Perfil do público
        </p>

        <h3 className="mt-1 text-lg font-black text-blue-950">
          Distribuição estimada
        </h3>
      </div>

      <div className="mt-5 space-y-5">

        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-600">
              👨 Homens
            </span>

            <span className="font-black text-sky-600">
              {indicadoresParticipantes.homens} · {percentualHomens}%
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-sky-500"
              style={{ width: `${percentualHomens}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-600">
              👩 Mulheres
            </span>

            <span className="font-black text-pink-600">
              {indicadoresParticipantes.mulheres} · {percentualMulheres}%
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-pink-500"
              style={{ width: `${percentualMulheres}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-600">
              ❓ Indeterminado
            </span>

            <span className="font-black text-slate-600">
              {indicadoresParticipantes.indeterminado} · {percentualIndeterminado}%
            </span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-400"
              style={{ width: `${percentualIndeterminado}%` }}
            />
          </div>
        </div>

      </div>
    </div>

    {/* CHECK-IN POR PERFIL */}

    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
        Check-in por perfil
      </p>

      <h3 className="mt-1 text-lg font-black text-blue-950">
        Presença do público
      </h3>

      <div className="mt-5 grid grid-cols-2 gap-3">

        <div className="rounded-xl bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-700">
            Homens presentes
          </p>
          <p className="mt-1 text-2xl font-black text-emerald-600">
            {indicadoresParticipantes.homensPresentes}
          </p>
        </div>

        <div className="rounded-xl bg-teal-50 p-3">
          <p className="text-xs font-semibold text-teal-700">
            Mulheres presentes
          </p>
          <p className="mt-1 text-2xl font-black text-teal-600">
            {indicadoresParticipantes.mulheresPresentes}
          </p>
        </div>

        <div className="rounded-xl bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-700">
            Homens pendentes
          </p>
          <p className="mt-1 text-2xl font-black text-amber-600">
            {indicadoresParticipantes.homensPendentes}
          </p>
        </div>

        <div className="rounded-xl bg-orange-50 p-3">
          <p className="text-xs font-semibold text-orange-700">
            Mulheres pendentes
          </p>
          <p className="mt-1 text-2xl font-black text-orange-600">
            {indicadoresParticipantes.mulheresPendentes}
          </p>
        </div>

      </div>
    </div>

    {/* HORÁRIO */}

    <div className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
        Movimento da portaria
      </p>

      <h3 className="mt-1 text-lg font-black text-blue-950">
        Horário mais quente
      </h3>

      <div className="mt-7 text-center">
        <div className="text-4xl">
          🔥
        </div>

        <p className="mt-3 text-4xl font-black text-orange-500">
          {indicadoresParticipantes.horarioMaisQuente}
        </p>

        <p className="mt-2 text-sm text-slate-500">
          maior concentração de entradas
        </p>
      </div>
    </div>

  </div>

  {/* DESEMPENHO DAS LISTAS */}

  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Comparativo
        </p>

        <h3 className="mt-1 text-lg font-black text-blue-950">
          Desempenho das listas
        </h3>
      </div>

      <p className="text-xs text-slate-400">
        Ordenado por número de inscritos
      </p>
    </div>

    <div className="mt-5 overflow-x-auto">

      <table className="w-full min-w-[650px]">

        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
            <th className="pb-3">Lista</th>
            <th className="pb-3 text-center">Inscritos</th>
            <th className="pb-3 text-center">Presentes</th>
            <th className="pb-3 text-center">Comparecimento</th>
            <th className="pb-3 text-center">Status</th>
          </tr>
        </thead>

        <tbody>

          {desempenhoListas.map((lista) => (

            <tr
              key={lista.id}
              className="border-b border-slate-100 last:border-0"
            >

              <td className="py-3 pr-4 font-bold text-slate-800">
                {lista.nome}
              </td>

              <td className="py-3 text-center font-bold text-blue-700">
                {lista.inscritos}
              </td>

              <td className="py-3 text-center font-bold text-green-600">
                {lista.presentes}
              </td>

              <td className="py-3 text-center">
                <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                  {lista.comparecimento}%
                </span>
              </td>

              <td className="py-3 text-center">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                    lista.ativa
                      ? "bg-green-50 text-green-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {lista.ativa ? "Ativa" : "Inativa"}
                </span>
              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  </div>

</div>

        {/* EXPORTAÇÃO */}

        {podeExportarParticipantes ? (
          <div className="flex gap-3 mb-6 flex-wrap items-center">

            <select
              value={listaAtualExportacaoId ?? ""}
              onChange={(e) => setListaAtualExportacaoId(e.target.value ? Number(e.target.value) : null)}
              className="ui-field max-w-xs"
            >
              {listasEvento.length === 0 ? (
                <option value="">Sem listas</option>
              ) : (
                listasEvento.map((lista) => (
                  <option key={lista.id} value={lista.id}>
                    {lista.nome}
                  </option>
                ))
              )}
            </select>

            <button
              onClick={() => exportarExcel("evento-completo")}
              className="bg-green-500 hover:bg-green-400 text-white px-5 py-3 rounded-2xl font-bold transition min-h-11"
            >
              Exportar Evento Completo
            </button>

            <button
              onClick={() => exportarExcel("lista-atual")}
              disabled={!listaAtualExportacaoId}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-2xl font-bold transition min-h-11 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Exportar Apenas a Lista Atual
            </button>

            <button
              onClick={exportarXML}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-2xl font-bold transition min-h-11"
            >
              Exportar XML
            </button>

          </div>
        ) : null}

        {/* PORTARIA / CHECK-IN SEPARADO */}

        <div className="mb-2 rounded-3xl border border-blue-200 bg-blue-50/60 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-600">
                Operação de entrada
              </p>
              <h2 className="mt-1 text-2xl font-black text-blue-950">
                Portaria / Check-in
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                O check-in agora possui uma tela própria, mais leve e otimizada para celular.
                Use-a na entrada do evento para localizar convidados e confirmar a presença com rapidez.
              </p>
            </div>

            <Link
              href={`/admin/eventos/${evento.slug}/checkin`}
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-2xl bg-blue-700 px-6 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-600"
            >
              Abrir Portaria
            </Link>
          </div>
        </div>

      </section>

      </div>
    </AdminShell>
  );
}