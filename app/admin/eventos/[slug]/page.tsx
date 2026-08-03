"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { podeEditarEvento, validarAcessoEvento } from "@/lib/permissoes";
import AdminShell from "@/app/components/AdminShell";
import AdminEventTabs from "@/app/components/AdminEventTabs";
import CopyLinkButton from "@/app/components/CopyLinkButton";
import DeleteEventButton from "@/app/components/DeleteEventButton";
import { gerarSlugUnicoLista } from "@/lib/slug";
import { sanitizeMetaPixelId } from "@/lib/metaPixel";
import { canEditEventRole, canExportParticipantsRole, isAdminRole, type RoleUsuario } from "@/lib/roles";

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

  const [filtro, setFiltro] =
    useState("todos");

  const [acessoNegado, setAcessoNegado] =
    useState(false);

  const [roleUsuario, setRoleUsuario] =
    useState<string | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);

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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUsuarioId(user?.id || null);

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

      const {
        data: { user },
        error: erroAuth,
      } = await supabase.auth.getUser();

      if (erroAuth || !user?.id) {
        console.error("Erro capturado no catch:", erroAuth || { message: "Usuário não autenticado." });
        setMensagemLista("Usuário não autenticado.");
        return;
      }

      const permissaoCriar = await podeEditarEvento(slug);
      if (!permissaoCriar.autorizado) {
        console.error("Erro capturado no catch:", {
          message: "Usuário sem permissão para criar listas neste evento.",
          details: permissaoCriar.erro || null,
          code: "APP_FORBIDDEN_CREATE_LISTA",
          error: permissaoCriar,
        });
        setMensagemLista("Não foi possível criar a lista. Verifique os dados e tente novamente.");
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
        criado_por: user.id,
      };

      if (!payload.evento_id) {
        setMensagemLista("Evento não identificado. Recarregue a página e tente novamente.");
        return;
      }

      console.log("Payload enviado para listas_evento:", payload);

      const operacaoLista = listaEditandoId
        ? await supabase
            .from("listas_evento")
            .update(payload)
            .eq("id", listaEditandoId)
            .eq("evento_id", evento.id)
            .select("*")
            .single()
        : await supabase.from("listas_evento").insert([payload]).select("*").single();

      const erroSupabase = operacaoLista.error;

      if (erroSupabase) {
        console.error("Erro bruto Supabase:", erroSupabase);
        console.error("Erro Supabase message:", erroSupabase?.message);
        console.error("Erro Supabase details:", erroSupabase?.details);
        console.error("Erro Supabase hint:", erroSupabase?.hint);
        console.error("Erro Supabase code:", erroSupabase?.code);
        console.error("Erro Supabase JSON:", JSON.stringify(erroSupabase, null, 2));

        setMensagemLista("Não foi possível criar a lista. Verifique os dados e tente novamente.");
        return;
      }

      const listaPersistida = operacaoLista.data as ListaEventoResumo;

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
    if (!confirm("Deseja remover esta lista do evento?")) {
      return;
    }

    const { error } = await supabase.from("listas_evento").delete().eq("id", listaId);

    if (error) {
      console.error("Erro ao excluir lista:", error);
      setMensagemLista("Não foi possível excluir a lista. Tente novamente.");
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

  const participantesFiltrados =
    participantes.filter((p) => {

      const buscaMatch =
        p.nome
          ?.toLowerCase()
          .includes(
            busca.toLowerCase()
          );

      if (
        filtro === "presentes"
      ) {

        return (
          buscaMatch &&
          p.presente
        );
      }

      if (
        filtro === "pendentes"
      ) {

        return (
          buscaMatch &&
          !p.presente
        );
      }

      return buscaMatch;
    });

  function infoLista(participante: any) {
    const lista = listasEvento.find((item) => item.id === participante.lista_id);

    return {
      nome: lista?.nome || "Sem lista",
      tipo: lista?.tipo_lista || "simples",
      regra: (lista?.regra || "").trim() || "Sem regra definida",
    };
  }

  // ANALÍTICOS

  const totalConfirmados =
    participantes.length;

  const totalPresentes =
    participantes.filter(
      (p) => p.presente
    ).length;

  const totalPendentes =
    totalConfirmados -
    totalPresentes;

  const porcentagemComparecimento =
    totalConfirmados > 0
      ? Math.round(
          (
            totalPresentes /
            totalConfirmados
          ) * 100
        )
      : 0;

  // HORÁRIO MAIS QUENTE

  const horarios: Record<
    string,
    number
  > = {};

  participantes.forEach((p) => {

    if (
      p.entrada_confirmada_em
    ) {

      const hora =
        new Date(
          p.entrada_confirmada_em
        ).getHours();

      const label =
        `${hora}:00`;

      horarios[label] =
        (horarios[label] || 0)
        + 1;
    }
  });

  let horarioMaisQuente =
    "-";

  let maiorQuantidade = 0;

  Object.entries(horarios)
    .forEach(([hora, qtd]) => {

      if (
        qtd > maiorQuantidade
      ) {

        maiorQuantidade =
          qtd;

        horarioMaisQuente =
          hora;
      }
    });

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

  const podeExcluirEvento =
    isAdminRole(roleUsuario) ||
    (roleUsuario === "produtor" && Boolean(usuarioId) && String(evento.criador_id) === String(usuarioId));
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

  {(canEditEventRole(roleUsuario)) && (
    <>
      <Link
        href={`/admin/eventos/${evento.slug}/editar`}
        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-2xl font-bold transition min-h-11"
      >
        Editar Evento
      </Link>

      <button
        type="button"
        onClick={abrirCriacaoLista}
        className="bg-blue-800 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-extrabold shadow-lg shadow-blue-200 transition min-h-11"
      >
        Criar Lista
      </button>
    </>
  )}

  {roleUsuario === "staff" && (
    <span className="bg-orange-100 text-orange-700 px-4 py-3 rounded-2xl font-semibold">
      Acesso de check-in apenas
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

      {(canEditEventRole(roleUsuario)) ? (
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

          {!podeExcluirEvento ? (
            <p className="mt-3 text-sm font-semibold text-red-700">
              Somente Administrador Geral ou produtor criador deste evento pode excluir.
            </p>
          ) : null}
        </section>
      ) : null}

      <section id="listas-evento" className="rounded-3xl border border-blue-100 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-blue-900">Listas do Evento</h2>
            <p className="mt-1 text-sm text-slate-500">Crie e abra listas diretamente da Central do Evento.</p>
          </div>

          {(canEditEventRole(roleUsuario)) && !mostrarCriarLista ? (
            <button
              type="button"
              onClick={abrirCriacaoLista}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-700 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-blue-600"
            >
              Criar Lista
            </button>
          ) : null}
        </div>

        {(canEditEventRole(roleUsuario)) && mostrarCriarLista ? (
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
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
            Seu perfil possui acesso focado em check-in e nao permite criar listas.
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {listasEvento.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma lista criada para este evento.</p>
          ) : (
            listasEvento.map((lista) => (
              <article key={lista.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {(() => {
                  const visibilidade = (lista.tipo_visibilidade || lista.visibilidade || "privada").toLowerCase();
                  const listaPublica = visibilidadeEhPublica(lista.tipo_visibilidade || lista.visibilidade);
                  const listaPublicaAtivaComSlug = listaPublica && !!lista.ativa && !!lista.slug;

                  return (
                    <>
                <h3 className="text-base font-bold text-blue-900 break-words">{lista.nome}</h3>
                <p className="mt-1 text-sm text-slate-500">Tipo: {rotuloTipoLista(lista.tipo_lista ?? null)}</p>
                <p className="mt-1 text-sm text-slate-500">Visibilidade: {rotuloVisibilidadeLista(lista)}</p>
                <p className="mt-1 text-sm text-slate-500">Regra: {lista.regra || "-"}</p>
                <p className="mt-1 text-sm text-slate-500">Status: {lista.ativa ? "Ativa" : "Inativa"}</p>
                {(canEditEventRole(roleUsuario)) && sanitizeMetaPixelId(lista.meta_pixel_id) ? (
                  <p className="mt-1 text-sm font-semibold text-blue-700">Meta Pixel configurado</p>
                ) : null}

                <div className="mt-2">
                  {listaPublicaAtivaComSlug ? (
                    <CopyLinkButton
                      link={() => `${window.location.origin}/evento/${evento.slug}/${lista.slug}`}
                      idleLabel="Copiar Link Público"
                      copiedLabel="Copiado ✓"
                      className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-200"
                    />
                  ) : listaPublica && !!lista.ativa && !lista.slug ? (
                    <p className="text-sm font-semibold text-amber-700">Esta lista ainda não possui link público.</p>
                  ) : !listaPublica ? (
                    <span className="inline-flex rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                      Lista privada
                    </span>
                  ) : (
                    <span className="inline-flex rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                      Lista inativa
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/eventos/${evento.slug}/listas/${lista.id}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-green-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-400"
                  >
                    Abrir Lista
                  </Link>

                  {(canEditEventRole(roleUsuario)) ? (
                    <>
                      <button
                        type="button"
                        onClick={() => abrirEdicaoLista(lista)}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-100 px-4 py-2 text-sm font-bold text-blue-900 transition hover:bg-blue-200"
                      >
                        Editar Lista
                      </button>

                      <button
                        type="button"
                        onClick={() => void excluirListaCentral(lista.id)}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-400"
                      >
                        Excluir Lista
                      </button>
                    </>
                  ) : null}
                </div>
                    </>
                  );
                })()}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="p-4 sm:p-6" id="check-in">

        {/* CARDS */}

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5 sm:gap-5">

          <div className="flex min-h-[168px] h-full flex-col items-center justify-center rounded-3xl border border-blue-100 bg-white p-6 text-center shadow-sm">

            <p className="min-h-6 text-slate-500">
              Total Confirmados
            </p>

            <h2 className="mt-3 text-4xl font-bold text-blue-900 sm:text-5xl">
              {totalConfirmados}
            </h2>

          </div>

          <div className="flex min-h-[168px] h-full flex-col items-center justify-center rounded-3xl border border-green-200 bg-white p-6 text-center shadow-sm">

            <p className="min-h-6 text-slate-500">
              Presentes
            </p>

            <h2 className="mt-3 text-4xl font-bold text-green-600 sm:text-5xl">
              {totalPresentes}
            </h2>

          </div>

          <div className="flex min-h-[168px] h-full flex-col items-center justify-center rounded-3xl border border-amber-200 bg-white p-6 text-center shadow-sm">

            <p className="min-h-6 text-slate-500">
              Pendentes
            </p>

            <h2 className="mt-3 text-4xl font-bold text-amber-600 sm:text-5xl">
              {totalPendentes}
            </h2>

          </div>

          <div className="flex min-h-[168px] h-full flex-col items-center justify-center rounded-3xl border border-blue-100 bg-white p-6 text-center shadow-sm">

            <p className="min-h-6 text-slate-500">
              Comparecimento
            </p>

            <h2 className="mt-3 text-4xl font-bold text-blue-500 sm:text-5xl">
              {porcentagemComparecimento}%
            </h2>

          </div>

          <div className="flex min-h-[168px] h-full flex-col items-center justify-center rounded-3xl border border-orange-200 bg-white p-6 text-center shadow-sm">

            <p className="min-h-6 text-slate-500">
              Horário Mais Quente
            </p>

            <h2 className="mt-3 text-3xl font-bold text-orange-500 sm:text-4xl">
              🔥 {horarioMaisQuente}
            </h2>

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

        {/* BUSCA */}

        <div id="convidados" className="mb-6 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-blue-900">Convidados e check-in</h2>
              <p className="mt-1 text-sm text-slate-500">Busque um participante para agilizar o atendimento na porta.</p>
            </div>

            <input
              type="text"
              placeholder="Buscar participante..."
              value={busca}
              onChange={(e) =>
                setBusca(
                  e.target.value
                )
              }
              className="ui-field text-base md:max-w-md"
            />
          </div>
        </div>

        {mensagemParticipante ? (
          <p
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm font-semibold ${
              mensagemParticipante.tipo === "erro"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {mensagemParticipante.texto}
          </p>
        ) : null}

        {/* FILTROS */}

        <div className="flex gap-3 mb-6 flex-wrap">

          <button
            onClick={() =>
              setFiltro("todos")
            }
            className={`ui-toggle-btn px-4 sm:px-5 py-3 rounded-xl font-bold transition min-h-11 ${
              filtro === "todos" ? "ui-toggle-btn-active" : ""
            }`}
          >
            Todos
          </button>

          <button
            onClick={() =>
              setFiltro("presentes")
            }
            className={`ui-toggle-btn px-4 sm:px-5 py-3 rounded-xl font-bold transition min-h-11 ${
              filtro === "presentes" ? "ui-toggle-btn-active" : ""
            }`}
          >
            Presentes
          </button>

          <button
            onClick={() =>
              setFiltro("pendentes")
            }
            className={`ui-toggle-btn px-4 sm:px-5 py-3 rounded-xl font-bold transition min-h-11 ${
              filtro === "pendentes" ? "ui-toggle-btn-active" : ""
            }`}
          >
            Pendentes
          </button>

        </div>

        {/* CHECK-IN MOBILE */}

        <div className="space-y-3 md:hidden">
          {participantesFiltrados.map((participante) => {
            const lista = infoLista(participante);

            return (
              <article
                key={participante.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 break-words">{participante.nome}</h3>
                  <p className="text-sm text-slate-600">Regra da Lista: {lista.regra}</p>
                  <p className="text-sm text-slate-600">WhatsApp: {participante.whatsapp || "-"}</p>
                  <p className="text-sm text-slate-600">Horário: {participante.entrada_confirmada_em
                    ? new Date(participante.entrada_confirmada_em).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"}</p>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className={participante.presente ? "text-green-600 font-bold" : "text-amber-600 font-bold"}>
                    {participante.presente ? "PRESENTE" : "PENDENTE"}
                  </p>

                  {!participante.presente ? (
                    <button
                      onClick={() => fazerCheckin(participante.id)}
                      disabled={processandoParticipanteId === participante.id}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-bold min-h-11"
                    >
                      Fazer Check-in
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 font-bold">✓ Confirmado</span>
                      <button
                        onClick={() => desfazerCheckin(participante.id)}
                        disabled={processandoParticipanteId === participante.id}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        Desfazer Check-in
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => void excluirParticipante(participante.id)}
                    disabled={processandoParticipanteId === participante.id}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-300 bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Excluir participante
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* TABELA DESKTOP */}

        <div className="hidden md:block overflow-x-auto rounded-3xl border border-blue-100 bg-white shadow-sm">

          <table className="w-full min-w-[1050px] table-fixed">

            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[16%]" />
              <col className="w-[25%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[13%]" />
            </colgroup>

            <thead className="bg-blue-50 text-slate-700">

              <tr>

                <th className="p-4 text-left">
                  Nome
                </th>

                <th className="p-4 text-left">
                  WhatsApp
                </th>

                <th className="p-4 text-left">
                  Regra da Lista
                </th>

                <th className="p-4 text-left">
                  Status
                </th>

                <th className="p-4 text-left whitespace-nowrap">
                  Horário Entrada
                </th>

                <th className="p-4 text-left">
                  Ação
                </th>

              </tr>

            </thead>

            <tbody>

              {participantesFiltrados.map(
                (participante) => (

                  (() => {
                    const lista = infoLista(participante);

                    return (

                  <tr
                    key={
                      participante.id
                    }
                    className={`border-t border-slate-200 ${
                      participante.presente
                        ? "bg-green-50"
                        : ""
                    }`}
                  >

                    <td className="p-4 break-words">
                      {participante.nome}
                    </td>

                    <td className="p-4">
                      {participante.whatsapp || "-"}
                    </td>

                    <td className="p-4 break-words">
                      {lista.regra}
                    </td>

                    <td className="p-4">

                      {participante.presente ? (

                        <span className="text-green-600 font-bold">
                          PRESENTE
                        </span>

                      ) : (

                        <span className="text-amber-600 font-bold">
                          PENDENTE
                        </span>

                      )}

                    </td>

                    <td className="p-4">

                      {participante.entrada_confirmada_em
                        ? new Date(
                            participante.entrada_confirmada_em
                          ).toLocaleTimeString(
                            "pt-BR",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : "-"}

                    </td>

                    <td className="p-4 whitespace-nowrap">

                      {!participante.presente ? (

                        <button
                          onClick={() =>
                            fazerCheckin(
                              participante.id
                            )
                          }
                          disabled={processandoParticipanteId === participante.id}
                          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl font-bold transition"
                        >
                          Fazer Check-in
                        </button>

                      ) : (

                        <div className="flex items-center gap-2">
                          <span className="text-green-600 font-bold">
                            ✓ Confirmado
                          </span>
                          <button
                            onClick={() =>
                              desfazerCheckin(
                                participante.id
                              )
                            }
                            disabled={processandoParticipanteId === participante.id}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700 transition hover:bg-slate-50"
                          >
                            Desfazer Check-in
                          </button>
                        </div>

                      )}

                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => void excluirParticipante(participante.id)}
                          disabled={processandoParticipanteId === participante.id}
                          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-300 bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          Excluir participante
                        </button>
                      </div>

                    </td>

                  </tr>

                    );
                  })()

                )
              )}

            </tbody>

          </table>

        </div>

      </section>

      </div>
    </AdminShell>
  );
}