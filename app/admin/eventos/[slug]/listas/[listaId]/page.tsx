"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { podeEditarEvento } from "@/lib/permissoes";

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
  sobrenome: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  presente: boolean;
  entrada_confirmada_em: string | null;
};

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

  const [evento, setEvento] = useState<EventoResumo | null>(null);
  const [lista, setLista] = useState<ListaEvento | null>(null);
  const [participantes, setParticipantes] = useState<ParticipanteLista[]>([]);

  const [nomesEmMassa, setNomesEmMassa] = useState("");
  const [salvandoSimples, setSalvandoSimples] = useState(false);
  const [salvandoVip, setSalvandoVip] = useState(false);

  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [sexo, setSexo] = useState("");
  const [cidade, setCidade] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const carregarParticipantes = useCallback(async (eventoId: number, listaIdAtual: number) => {
    const { data: participantesData } = await supabase
      .from("participantes")
      .select("id, nome, sobrenome, telefone, whatsapp, email, presente, entrada_confirmada_em")
      .eq("evento_id", eventoId)
      .eq("lista_id", listaIdAtual)
      .order("id", { ascending: false });

    if (participantesData) {
      setParticipantes(participantesData as ParticipanteLista[]);
    }
  }, []);

  const carregarDados = useCallback(async () => {
    if (!slug || !Number.isFinite(listaId) || listaId <= 0) {
      setAcessoNegado(true);
      setMensagemAcesso("Lista inválida.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const { autorizado, evento: eventoData, erro } = await podeEditarEvento(slug);

    if (!autorizado || !eventoData) {
      setAcessoNegado(true);
      setMensagemAcesso(erro || "Você não possui permissão para gerenciar participantes desta lista.");
      setLoading(false);
      return;
    }

    const { data: listaData, error: listaError } = await supabase
      .from("listas_evento")
      .select("id, evento_id, nome, descricao, regra, tipo_lista")
      .eq("id", listaId)
      .eq("evento_id", eventoData.id)
      .maybeSingle();

    if (listaError || !listaData) {
      setAcessoNegado(true);
      setMensagemAcesso("Lista não encontrada para este evento.");
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

  async function importarParticipantesSimples(e: FormEvent) {
    e.preventDefault();

    if (!evento || !lista) {
      return;
    }

    const nomes = nomesEmMassa
      .split("\n")
      .map((linha) => linha.trim())
      .filter(Boolean);

    if (nomes.length === 0) {
      alert("Digite pelo menos um nome para importar.");
      return;
    }

    setSalvandoSimples(true);

    const payload = nomes.map((nomeLinha) => ({
      evento_id: evento.id,
      lista_id: lista.id,
      nome: nomeLinha,
      presente: false,
    }));

    const { error } = await supabase.from("participantes").insert(payload);

    setSalvandoSimples(false);

    if (error) {
      console.log(error);
      alert("Erro ao importar participantes desta lista.");
      return;
    }

    setNomesEmMassa("");
    await carregarParticipantes(evento.id, lista.id);
    alert("Participantes importados com sucesso!");
  }

  async function adicionarParticipanteVip(e: FormEvent) {
    e.preventDefault();

    if (!evento || !lista) {
      return;
    }

    if (!nome.trim()) {
      alert("O nome é obrigatório para a lista VIP.");
      return;
    }

    setSalvandoVip(true);

    const payload = {
      evento_id: evento.id,
      lista_id: lista.id,
      nome: nome.trim(),
      sobrenome: sobrenome.trim() || null,
      telefone: telefone.trim() || null,
      whatsapp: telefone.trim() || null,
      email: email.trim() || null,
      data_nascimento: dataNascimento || null,
      sexo: sexo.trim() || null,
      cidade: cidade.trim() || null,
      observacoes: observacoes.trim() || null,
      presente: false,
    };

    const { error } = await supabase.from("participantes").insert([payload]);

    setSalvandoVip(false);

    if (error) {
      console.log(error);
      alert("Erro ao adicionar participante VIP.");
      return;
    }

    setNome("");
    setSobrenome("");
    setTelefone("");
    setEmail("");
    setDataNascimento("");
    setSexo("");
    setCidade("");
    setObservacoes("");

    await carregarParticipantes(evento.id, lista.id);
    alert("Participante adicionado com sucesso!");
  }

  const totalCadastrados = participantes.length;
  const presentes = participantes.filter((item) => item.presente).length;
  const pendentes = totalCadastrados - presentes;

  function nomeCompleto(participante: ParticipanteLista) {
    const nomeBase = participante.nome || "";
    const sobrenomeBase = participante.sobrenome || "";
    return `${nomeBase} ${sobrenomeBase}`.trim();
  }

  function telefoneExibicao(participante: ParticipanteLista) {
    return participante.telefone || participante.whatsapp || "-";
  }

  if (acessoNegado) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <div className="max-w-xl text-center">
          <h1 className="text-3xl font-bold">Acesso negado</h1>
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
    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 overflow-x-hidden">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-slate-500 text-sm">Evento: {evento.nome}</p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-900 break-words">Participantes da Lista</h1>
          </div>

          <Link
            href={`/admin/eventos/${evento.slug}/editar`}
            className="bg-blue-100 hover:bg-blue-200 text-blue-900 px-5 py-3 rounded-2xl font-bold min-h-11 text-center"
          >
            Voltar para edição
          </Link>
        </div>

        <section className="bg-white border border-blue-100 rounded-3xl p-6 space-y-2 shadow-sm">
          <p className="text-sm text-slate-600">Nome da lista: <span className="text-slate-900 font-semibold">{lista.nome}</span></p>
          <p className="text-sm text-slate-600">Tipo da lista: <span className="text-slate-900 font-semibold uppercase">{lista.tipo_lista || "simples"}</span></p>
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

        {lista.tipo_lista === "simples" ? (
          <section className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-blue-900 mb-4">Cadastro em massa</h2>

            <form onSubmit={importarParticipantesSimples} className="space-y-4">
              <textarea
                value={nomesEmMassa}
                onChange={(e) => setNomesEmMassa(e.target.value)}
                placeholder="Digite um nome por linha"
                className="w-full p-4 rounded-xl bg-white text-black h-48"
              />

              <button
                type="submit"
                disabled={salvandoSimples}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white px-6 py-3 rounded-2xl font-bold min-h-11"
              >
                {salvandoSimples ? "IMPORTANDO..." : "Importar Participantes"}
              </button>
            </form>
          </section>
        ) : (
          <section className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-blue-900 mb-4">Cadastro individual VIP</h2>

            <form onSubmit={adicionarParticipanteVip} className="grid gap-4 md:grid-cols-2">
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome *"
                className="w-full p-4 rounded-xl bg-white text-black"
              />

              <input
                type="text"
                value={sobrenome}
                onChange={(e) => setSobrenome(e.target.value)}
                placeholder="Sobrenome"
                className="w-full p-4 rounded-xl bg-white text-black"
              />

              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Telefone / WhatsApp"
                className="w-full p-4 rounded-xl bg-white text-black"
              />

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full p-4 rounded-xl bg-white text-black"
              />

              <input
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                placeholder="Data de nascimento"
                className="w-full p-4 rounded-xl bg-white text-black"
              />

              <input
                type="text"
                value={sexo}
                onChange={(e) => setSexo(e.target.value)}
                placeholder="Sexo"
                className="w-full p-4 rounded-xl bg-white text-black"
              />

              <input
                type="text"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Cidade"
                className="w-full p-4 rounded-xl bg-white text-black"
              />

              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações"
                className="w-full p-4 rounded-xl bg-white text-black md:col-span-2 h-28"
              />

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={salvandoVip}
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

          {participantes.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum participante cadastrado nesta lista.</p>
          ) : (
            <div className="space-y-3">
              {participantes.map((participante) => (
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
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
