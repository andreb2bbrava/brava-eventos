"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type EventoPublico = {
  id: number;
  slug: string;
  nome: string;
  descricao: string | null;
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
  ativa: boolean;
};

function normalizarNome(valor: string) {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
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

function extrairNomesUnicosPorLinha(texto: string) {
  const nomesOriginais: string[] = [];
  const nomesNormalizados = new Set<string>();

  texto
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .forEach((nomeLinha) => {
      const nomeNormalizado = normalizarNome(nomeLinha);

      if (!nomeNormalizado || nomesNormalizados.has(nomeNormalizado)) {
        return;
      }

      nomesNormalizados.add(nomeNormalizado);
      nomesOriginais.push(nomeLinha);
    });

  return nomesOriginais;
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
        .select("*")
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

      const { data: participantesData, error: erroParticipantes } = await supabase
        .from("participantes")
        .select("nome")
        .eq("evento_id", evento.id)
        .eq("lista_id", lista.id);

      if (erroParticipantes) {
        logSupabaseError("selecionar-participantes-publico-simples", erroParticipantes);
        setSalvando(false);
        setMensagemErro("Não foi possível concluir o cadastro. Tente novamente.");
        return;
      }

      const nomesExistentes = new Set(
        (participantesData || []).map((participante) => normalizarNome(participante.nome || ""))
      );

      const payload: Array<{ evento_id: number; lista_id: number; nome: string; presente: boolean }> = [];
      let ignorados = 0;

      nomesValidos.forEach((nomeLinha) => {
        const nomeNormalizado = normalizarNome(nomeLinha);

        if (!nomeNormalizado || nomesExistentes.has(nomeNormalizado)) {
          ignorados += 1;
          return;
        }

        payload.push({
          evento_id: evento.id,
          lista_id: lista.id,
          nome: nomeLinha,
          presente: false,
        });
      });

      if (payload.length === 0) {
        setSalvando(false);
        setMensagemErro("");
        setMensagemSucesso("Todos os nomes informados já estão cadastrados nesta lista.");
        return;
      }

      const { error: erroInsert } = await supabase.from("participantes").insert(payload);

      setSalvando(false);

      if (erroInsert) {
        logSupabaseError("inserir-participantes-publico-simples", erroInsert);
        setMensagemErro("Não foi possível concluir o cadastro. Tente novamente.");
        return;
      }

      setNomesEmMassa("");

      if (ignorados === 0) {
        setMensagemSucesso(`Cadastro realizado com sucesso! ${payload.length} nomes foram adicionados à lista.`);
        return;
      }

      setMensagemSucesso(`${payload.length} nomes foram adicionados. ${ignorados} nomes já estavam cadastrados e foram ignorados.`);
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

    const { data: participantesData, error: erroParticipantes } = await supabase
      .from("participantes")
      .select("nome")
      .eq("evento_id", evento.id)
      .eq("lista_id", lista.id);

    if (erroParticipantes) {
      logSupabaseError("selecionar-participantes-publico-vip", erroParticipantes);
      setSalvando(false);
      setMensagemErro("Não foi possível concluir o cadastro. Tente novamente.");
      return;
    }

    const nomeNovo = normalizarNome(nome);
    const jaExiste = (participantesData || []).some((participante) => normalizarNome(participante.nome || "") === nomeNovo);

    if (jaExiste) {
      setSalvando(false);
      setMensagemErro("Este nome já está cadastrado nesta lista.");
      return;
    }

    const payload = {
      evento_id: evento.id,
      lista_id: lista.id,
      nome: nome.trim(),
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
      setMensagemErro("Não foi possível concluir o cadastro. Tente novamente.");
      return;
    }

    setNome("");
    setCelular("");
    setEmail("");
    setDataNascimento("");
    setSexo("");
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

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden">
      <div className="relative min-h-[320px] md:h-[420px] border-b border-blue-100 bg-white">
        {evento.banner_url ? (
          <img
            src={evento.banner_url}
            alt={evento.nome}
            className={`w-full h-full object-cover ${
              evento.banner_posicao === "top"
                ? "object-top"
                : evento.banner_posicao === "bottom"
                ? "object-bottom"
                : "object-center"
            }`}
          />
        ) : null}

        <div className="absolute inset-0 bg-white/65" />

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 sm:p-6">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-blue-900 break-words">{evento.nome}</h1>
          {evento.descricao ? <p className="mt-3 max-w-3xl text-slate-700">{evento.descricao}</p> : null}
          <p className="mt-3 text-base sm:text-lg text-slate-700">Local: {evento.local_evento || "-"}</p>
          {evento.maps_url ? (
            <a
              href={evento.maps_url}
              target="_blank"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-2xl bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-500"
            >
              Ver no Google Maps
            </a>
          ) : null}
        </div>
      </div>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="bg-white border border-blue-100 rounded-3xl p-6 sm:p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">{lista.tipo_lista === "vip" ? "Lista Completa" : "Lista Simples"}</p>
          <h2 className="mt-2 text-2xl sm:text-4xl font-bold text-blue-900">{lista.nome}</h2>
          <p className="mt-2 text-slate-600">Regra: {lista.regra || "-"}</p>

          <form onSubmit={entrarNaLista} className="mt-6 space-y-4">
            {lista.tipo_lista === "vip" ? (
              <>
                <input
                  type="text"
                  placeholder="Nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-4 text-slate-900"
                />

                <input
                  type="text"
                  placeholder="Celular"
                  value={celular}
                  onChange={(e) => setCelular(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-4 text-slate-900"
                />

                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-4 text-slate-900"
                />

                <input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-4 text-slate-900"
                />

                <input
                  type="text"
                  placeholder="Sexo"
                  value={sexo}
                  onChange={(e) => setSexo(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-4 text-slate-900"
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
                  className="w-full rounded-xl border border-slate-200 bg-white p-4 text-slate-900"
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
              {salvando ? "Salvando..." : "Entrar na Lista"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
