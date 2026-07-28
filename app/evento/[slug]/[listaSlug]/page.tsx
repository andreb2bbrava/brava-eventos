"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import MetaPixel from "@/app/components/MetaPixel";
import MarketingConsentBanner from "@/app/components/MarketingConsentBanner";
import {
  erroEhDuplicidadeParticipante,
  extrairNomesUnicosPorLinha,
  mensagemDuplicidadeEvento,
  normalizarNomeParticipante,
} from "@/lib/participantes";
import {
  type MarketingConsentStatus,
  sanitizeMetaPixelId,
  trackMetaCompleteRegistration,
} from "@/lib/metaPixel";

type EventoPublico = {
  id: number;
  slug: string;
  nome: string;
  descricao: string | null;
  inicio_evento: string | null;
  termino_evento: string | null;
  data_evento: string | null;
  hora_evento: string | null;
  banner_url: string | null;
  banner_posicao: string | null;
  local_evento: string | null;
  maps_url: string | null;
};

type ListaPublica = {
  id: number;
  evento_id: number;
  nome: string;
  slug: string | null;
  regra: string | null;
  tipo_lista: string | null;
  tipo_visibilidade: string | null;
  visibilidade: string | null;
  meta_pixel_id: string | null;
  ativa: boolean;
};

type ParticipanteDuplicidadeRow = {
  id: number;
  nome: string | null;
  nome_normalizado: string | null;
  lista_id: number | null;
  listas_evento?: { regra: string | null } | Array<{ regra: string | null }> | null;
};

function formatarDataHora(valor: string | null | undefined) {
  if (!valor) {
    return "-";
  }

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) {
    return valor;
  }

  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function obterInicioEvento(evento: EventoPublico | null) {
  if (!evento) {
    return null;
  }

  return evento.inicio_evento || (evento.data_evento && evento.hora_evento ? `${evento.data_evento}T${evento.hora_evento}` : null);
}

function normalizarComparacaoTexto(valor: string) {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function obterRegraExibicao(nomeLista: string | null | undefined, regraLista: string | null | undefined) {
  const regra = (regraLista || "").trim();
  if (!regra) {
    return null;
  }

  const nomeNormalizado = normalizarComparacaoTexto(nomeLista || "");
  const regraNormalizada = normalizarComparacaoTexto(regra);

  if (!regraNormalizada) {
    return null;
  }

  if (nomeNormalizado === regraNormalizada || nomeNormalizado.includes(regraNormalizada)) {
    return null;
  }

  return regra;
}

function debugLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
}

function logSupabaseError(contexto: string, error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
} | null) {
  if (process.env.NODE_ENV === "production" || !error) {
    return;
  }

  console.error(`[SUPABASE][${contexto}] message:`, error.message || "-");
  console.error(`[SUPABASE][${contexto}] details:`, error.details || "-");
  console.error(`[SUPABASE][${contexto}] hint:`, error.hint || "-");
  console.error(`[SUPABASE][${contexto}] code:`, error.code || "-");
}

function obterRegraDuplicada(row: ParticipanteDuplicidadeRow) {
  if (!row.listas_evento) {
    return null;
  }

  if (Array.isArray(row.listas_evento)) {
    return (row.listas_evento[0]?.regra || "").trim() || null;
  }

  return (row.listas_evento.regra || "").trim() || null;
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

function normalizarVisibilidade(valor: string | null | undefined) {
  return (valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function visibilidadeEhPublica(valor: string | null | undefined) {
  const normalizado = normalizarVisibilidade(valor);
  return normalizado === "publica" || normalizado === "lista publica";
}

export default function ListaPublicaPage() {
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";

  const listaSlug =
    typeof params?.listaSlug === "string"
      ? params.listaSlug
      : Array.isArray(params?.listaSlug)
      ? params.listaSlug[0]
      : "";

  const [loading, setLoading] = useState(true);
  const [evento, setEvento] = useState<EventoPublico | null>(null);
  const [lista, setLista] = useState<ListaPublica | null>(null);
  const [mensagemErro, setMensagemErro] = useState("");

  const [nome, setNome] = useState("");
  const [nomesEmMassa, setNomesEmMassa] = useState("");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [sexo, setSexo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [marketingConsentStatus, setMarketingConsentStatus] = useState<MarketingConsentStatus>("unknown");

  const pixelIdValido = sanitizeMetaPixelId(lista?.meta_pixel_id);
  const listaPublicaAtiva = Boolean(lista && lista.ativa && visibilidadeEhPublica(lista.tipo_visibilidade || lista.visibilidade));
  const podeCarregarPixel = Boolean(listaPublicaAtiva && pixelIdValido && marketingConsentStatus === "accepted");

  function registrarCompleteRegistration(numItems: number) {
    if (!lista || !podeCarregarPixel || numItems <= 0) {
      return;
    }

    const eventKey = `${lista.id}:${Date.now()}:${numItems}`;
    trackMetaCompleteRegistration({
      pixelId: pixelIdValido,
      listaNome: lista.nome,
      quantidade: numItems,
      eventKey,
    });
  }

  useEffect(() => {
    async function carregarDados() {
      debugLog("PUBLIC PARAMS", { slug, listaSlug });

      if (!slug || !listaSlug) {
        setMensagemErro("Lista não encontrada.");
        setLoading(false);
        return;
      }

      const { data: eventoData, error: erroEvento } = await supabase
        .from("eventos")
        .select("*")
        .eq("slug", slug)
        .single();

      debugLog("EVENTO PUBLICO", eventoData);
      debugLog("ERRO EVENTO PUBLICO", erroEvento);

      if (erroEvento || !eventoData) {
        setMensagemErro("Lista não encontrada.");
        setLoading(false);
        return;
      }

      const { data: listaData, error: erroLista } = await supabase
        .from("listas_evento")
        .select(
          `
            id,
            evento_id,
            nome,
            slug,
            regra,
            tipo_lista,
            tipo_visibilidade,
            visibilidade,
            ativa,
            meta_pixel_id
          `
        )
        .eq("evento_id", eventoData.id)
        .eq("slug", listaSlug)
        .single();

      debugLog("LISTA PUBLICA", listaData);
      debugLog("ERRO LISTA PUBLICA", erroLista);

      if (erroLista || !listaData) {
        setMensagemErro("Lista não encontrada.");
        setLoading(false);
        return;
      }

      if (!listaData.ativa) {
        setMensagemErro("Lista indisponível.");
        setLoading(false);
        return;
      }

      const visibilidadeAtiva = listaData.tipo_visibilidade || listaData.visibilidade;
      if (!visibilidadeEhPublica(visibilidadeAtiva)) {
        setMensagemErro("Esta lista não está disponível publicamente.");
        setLoading(false);
        return;
      }

      setEvento(eventoData as EventoPublico);
      setLista(listaData as ListaPublica);
      setMensagemErro("");
      setLoading(false);
    }

    carregarDados();
  }, [slug, listaSlug]);

  async function entrarNaLista(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!evento || !lista) {
      return;
    }

    const listaCompleta = lista.tipo_lista === "vip";

    if (!listaCompleta) {
      const nomesValidos = extrairNomesUnicosPorLinha(nomesEmMassa);

      if (nomesValidos.length === 0) {
        setMensagemSucesso("");
        setMensagemErro("Digite pelo menos um nome para continuar.");
        return;
      }

      if (nomesValidos.length > 30) {
        setMensagemSucesso("");
        setMensagemErro("Você pode cadastrar até 30 nomes por vez.");
        return;
      }

      setSalvando(true);
      setMensagemErro("");
      setMensagemSucesso("");

      const nomesNormalizadosInformados = nomesValidos
        .map((nomeLinha) => normalizarNomeParticipante(nomeLinha))
        .filter(Boolean);

      debugLog("EVENTO PARA VALIDACAO:", evento.id);
      debugLog("NOMES INFORMADOS:", nomesValidos);

      const { data: participantesData, error: erroParticipantes } = await supabase
        .from("participantes")
        .select("id, nome, nome_normalizado, lista_id, listas_evento(regra)")
        .eq("evento_id", evento.id)
        .in("nome_normalizado", nomesNormalizadosInformados);

      if (erroParticipantes) {
        const contexto = erroParticipantes?.code === "PGRST204" ? "ERRO TECNICO VALIDACAO DUPLICIDADE (PGRST204)" : "ERRO VALIDACAO DUPLICIDADE";
        console.error(contexto, {
          message: erroParticipantes?.message,
          details: erroParticipantes?.details,
          hint: erroParticipantes?.hint,
          code: erroParticipantes?.code,
          error: erroParticipantes,
        });
        setSalvando(false);
        setMensagemErro("Não foi possível verificar os participantes deste evento. Tente novamente.");
        return;
      }

      const participantesExistentes = (participantesData || []) as ParticipanteDuplicidadeRow[];
      const { nomesExistentes, participantePorNome } = criarIndiceParticipantesEvento(participantesExistentes);

      debugLog("PARTICIPANTES EXISTENTES:", participantesExistentes);
      debugLog("NOMES NORMALIZADOS EXISTENTES:", Array.from(nomesExistentes));

      const payload: Array<{ evento_id: number; lista_id: number; nome: string; nome_normalizado: string; presente: boolean }> = [];
      let ignorados = 0;
      const nomesNovos: string[] = [];
      const duplicados: Array<{ nome: string; participante: ParticipanteDuplicidadeRow | null }> = [];

      nomesValidos.forEach((nomeLinha) => {
        const nomeNormalizado = normalizarNomeParticipante(nomeLinha);

        if (!nomeNormalizado) {
          ignorados += 1;
          return;
        }

        if (nomesExistentes.has(nomeNormalizado)) {
          duplicados.push({
            nome: nomeLinha,
            participante: participantePorNome.get(nomeNormalizado) || null,
          });
          ignorados += 1;
          return;
        }

        nomesExistentes.add(nomeNormalizado);
        nomesNovos.push(nomeLinha);

        payload.push({
          evento_id: evento.id,
          lista_id: lista.id,
          nome: nomeLinha,
          nome_normalizado: nomeNormalizado,
          presente: false,
        });
      });

      debugLog("NOMES NOVOS:", nomesNovos);
      debugLog(
        "DUPLICADOS REAIS:",
        duplicados.map((item) => ({
          nome: item.nome,
          participanteId: item.participante?.id || null,
          regra: item.participante ? obterRegraDuplicada(item.participante) : null,
        }))
      );

      if (payload.length === 0) {
        setSalvando(false);
        setMensagemErro("");
        setMensagemSucesso("Todos os nomes informados já estão cadastrados neste evento.");
        return;
      }

      const { error: erroInsert } = await supabase.from("participantes").insert(payload);

      setSalvando(false);

      if (erroInsert) {
        logSupabaseError("inserir-participantes-publico-simples", erroInsert);
        if (erroEhDuplicidadeParticipante(erroInsert)) {
          setMensagemErro("Este nome já está cadastrado neste evento.");
          return;
        }
        setMensagemErro("Não foi possível concluir o cadastro. Tente novamente.");
        return;
      }

      setNomesEmMassa("");

      if (ignorados === 0) {
        registrarCompleteRegistration(payload.length);
        setMensagemSucesso(`${payload.length} nomes foram adicionados com sucesso.`);
        return;
      }

      registrarCompleteRegistration(payload.length);
      setMensagemSucesso(`${payload.length} nomes foram adicionados. ${ignorados} nomes já estavam cadastrados neste evento e foram ignorados.`);
      return;
    }

    if (!nome.trim()) {
      setMensagemSucesso("");
      setMensagemErro("Informe o nome para continuar.");
      return;
    }

    if (lista.tipo_lista === "vip" && !celular.trim()) {
      setMensagemSucesso("");
      setMensagemErro("Informe o celular para a Lista Completa.");
      return;
    }

    setSalvando(true);
    setMensagemErro("");
    setMensagemSucesso("");

    const nomeNormalizado = normalizarNomeParticipante(nome);
    const nomesInformados = [nome.trim()];

    debugLog("EVENTO PARA VALIDACAO:", evento.id);
    debugLog("NOMES INFORMADOS:", nomesInformados);

    const { data: participantesData, error: erroParticipantes } = await supabase
      .from("participantes")
      .select("id, nome, nome_normalizado, lista_id, listas_evento(regra)")
      .eq("evento_id", evento.id)
      .eq("nome_normalizado", nomeNormalizado)
      .limit(1);

    if (erroParticipantes) {
      const contexto = erroParticipantes?.code === "PGRST204" ? "ERRO TECNICO VALIDACAO DUPLICIDADE (PGRST204)" : "ERRO VALIDACAO DUPLICIDADE";
      console.error(contexto, {
        message: erroParticipantes?.message,
        details: erroParticipantes?.details,
        hint: erroParticipantes?.hint,
        code: erroParticipantes?.code,
        error: erroParticipantes,
      });
      setSalvando(false);
      setMensagemErro("Não foi possível verificar os participantes deste evento. Tente novamente.");
      return;
    }

    const participantesExistentes = (participantesData || []) as ParticipanteDuplicidadeRow[];
    const duplicado = participantesExistentes[0] || null;
    const jaExiste = !!duplicado;

    const { nomesExistentes } = criarIndiceParticipantesEvento(participantesExistentes);
    debugLog("PARTICIPANTES EXISTENTES:", participantesExistentes);
    debugLog("NOMES NORMALIZADOS EXISTENTES:", Array.from(nomesExistentes));
    debugLog("NOMES NOVOS:", jaExiste ? [] : nomesInformados);
    debugLog(
      "DUPLICADOS REAIS:",
      jaExiste
        ? [
            {
              nome: nome.trim(),
              participanteId: duplicado.id,
              regra: obterRegraDuplicada(duplicado),
            },
          ]
        : []
    );

    if (jaExiste) {
      setSalvando(false);
      setMensagemErro(mensagemDuplicidadeEvento(nome.trim(), obterRegraDuplicada(duplicado)));
      return;
    }

    const payload = {
      evento_id: evento.id,
      lista_id: lista.id,
      nome: nome.trim(),
      nome_normalizado: nomeNormalizado,
      telefone: celular.trim() || null,
      whatsapp: celular.trim() || null,
      email: email.trim() || null,
      data_nascimento: dataNascimento || null,
      sexo: sexo.trim() || null,
      presente: false,
    };

    const { error: erroInsert } = await supabase.from("participantes").insert([payload]);

    setSalvando(false);

    if (erroInsert) {
      logSupabaseError("inserir-participante-publico-vip", erroInsert);
      if (erroEhDuplicidadeParticipante(erroInsert)) {
        setMensagemErro("Este nome já está cadastrado neste evento.");
        return;
      }
      setMensagemErro("Não foi possível concluir o cadastro. Tente novamente.");
      return;
    }

    setNome("");
    setCelular("");
    setEmail("");
    setDataNascimento("");
    setSexo("");
    registrarCompleteRegistration(1);
    setMensagemSucesso("Cadastro realizado com sucesso!");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-4">
        <h1 className="text-2xl sm:text-4xl font-bold text-blue-900 text-center">Carregando lista...</h1>
      </main>
    );
  }

  if (!evento || !lista) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <div className="max-w-xl text-center">
          <h1 className="text-3xl font-bold">{mensagemErro || "Lista não encontrada."}</h1>
          <Link
            href={slug ? `/evento/${slug}` : "/eventos"}
            className="inline-block mt-6 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold"
          >
            Voltar
          </Link>
        </div>
      </main>
    );
  }

  const regraExibicao = obterRegraExibicao(lista.nome, lista.regra);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden">
      {podeCarregarPixel ? <MetaPixel pixelId={pixelIdValido} /> : null}
      <section className="w-full border-b border-blue-100 bg-white">
        {evento.banner_url ? (
          <img
            src={evento.banner_url}
            alt={evento.nome}
            className={`w-full h-auto max-h-[600px] object-cover ${
              evento.banner_posicao === "top"
                ? "object-top"
                : evento.banner_posicao === "bottom"
                ? "object-bottom"
                : "object-center"
            }`}
          />
        ) : (
          <div className="h-[220px] sm:h-[320px] w-full bg-blue-100" />
        )}
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="text-center text-3xl sm:text-5xl font-extrabold text-blue-900 leading-tight break-words">
          {evento.nome}
        </h1>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="rounded-3xl border border-blue-100 bg-white p-5 sm:p-7 shadow-sm space-y-2">
          <p className="text-base sm:text-lg text-slate-700">Início: {formatarDataHora(obterInicioEvento(evento))}</p>
          <p className="text-base sm:text-lg text-slate-700">Término: {formatarDataHora(evento.termino_evento)}</p>
          <p className="text-base sm:text-lg text-slate-700 break-words">Local: {evento.local_evento || "-"}</p>

          {evento.maps_url ? (
            <a
              href={evento.maps_url}
              target="_blank"
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 text-sm sm:text-base font-bold text-white transition hover:bg-blue-500"
            >
              Ver no Google Maps
            </a>
          ) : null}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-10">
        <div className="rounded-3xl border border-blue-100 bg-white p-5 sm:p-7 shadow-sm">
          <h2 className="text-2xl sm:text-3xl font-bold text-blue-900">Sobre o evento</h2>
          <p className="mt-4 whitespace-pre-line text-left text-base sm:text-lg leading-relaxed text-slate-700">
            {evento.descricao || "Descrição não informada."}
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="rounded-3xl border border-blue-100 bg-white p-6 sm:p-8 shadow-sm">
          <h2 className="text-2xl sm:text-4xl font-bold text-blue-900 break-words">{lista.nome}</h2>
          {regraExibicao ? <p className="mt-2 text-slate-600">Regra: {regraExibicao}</p> : null}

          <form onSubmit={entrarNaLista} className="mt-6 space-y-4">
            {lista.tipo_lista === "vip" ? (
              <>
                <input
                  type="text"
                  placeholder="Nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="ui-field"
                />

                <input
                  type="text"
                  placeholder="Celular"
                  value={celular}
                  onChange={(e) => setCelular(e.target.value)}
                  className="ui-field"
                />

                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="ui-field"
                />

                <input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="ui-field"
                />

                <input
                  type="text"
                  placeholder="Sexo"
                  value={sexo}
                  onChange={(e) => setSexo(e.target.value)}
                  className="ui-field"
                />
              </>
            ) : (
              <>
                <h3 className="text-xl sm:text-2xl font-bold text-blue-900">Adicionar nomes à lista</h3>
                <p className="text-slate-600">Digite um nome por linha.</p>

                <textarea
                  placeholder={"Maria Souza\nJoão Pedro\nCarlos Oliveira"}
                  value={nomesEmMassa}
                  onChange={(e) => setNomesEmMassa(e.target.value)}
                  rows={9}
                  className="ui-field min-h-[220px]"
                />
              </>
            )}

            {mensagemErro ? <p className="text-sm font-semibold text-red-600">{mensagemErro}</p> : null}
            {mensagemSucesso ? <p className="text-sm font-semibold text-green-700">{mensagemSucesso}</p> : null}

            <button
              type="submit"
              disabled={salvando}
              className="w-full min-h-11 rounded-2xl bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {salvando ? "Salvando..." : "Inscreva-se"}
            </button>
          </form>
        </div>
      </section>

      {pixelIdValido ? <MarketingConsentBanner onStatusChange={setMarketingConsentStatus} /> : null}
    </main>
  );
}
