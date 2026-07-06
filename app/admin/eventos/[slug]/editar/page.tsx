"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { podeEditarEvento } from "@/lib/permissoes";

type Produtor = {
  id: string | number;
  email: string;
};

type Staff = {
  id: string | number;
  email: string;
};

type ListaEvento = {
  id: number;
  evento_id: number;
  nome: string;
  descricao: string | null;
  regra: string | null;
  visibilidade: string | null;
  valor: number | null;
  prazo: string | null;
  responsavel: string | null;
  slug?: string | null;
  ordem?: number | null;
  cor?: string | null;
  categoria?: string | null;
  origem_campanha?: string | null;
  tipo_lista?: string | null;
  responsavel_usuario_id?: string | null;
  ativa: boolean;
};

export default function EditarEventoPage() {

  const router = useRouter();
  const params = useParams();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
      ? params.slug[0]
      : "";

  const [loading, setLoading] =
    useState(true);

  const [salvando, setSalvando] =
    useState(false);

  const [acessoNegado, setAcessoNegado] =
    useState(false);

  const [mensagemAcesso, setMensagemAcesso] =
    useState("");

  const [eventoId, setEventoId] =
    useState<number | null>(null);

  const [slugEvento, setSlugEvento] =
    useState("");

  const [nome, setNome] =
    useState("");

  const [dataEvento, setDataEvento] =
    useState("");

  const [horaEvento, setHoraEvento] =
    useState("");

  const [localEvento, setLocalEvento] =
    useState("");

  const [mapsUrl, setMapsUrl] =
    useState("");

  const [bannerPosicao, setBannerPosicao] =
    useState("center");

  const [tipoLista, setTipoLista] =
    useState("simples");

  const [produtores, setProdutores] =
    useState<Produtor[]>([]);

  const [staffs, setStaffs] =
    useState<Staff[]>([]);

  const [
    produtoresSelecionados,
    setProdutoresSelecionados,
  ] = useState<Array<string | number>>([]);

  const [staffSelecionado, setStaffSelecionado] =
    useState<Array<string | number>>([]);
  const [listasEvento, setListasEvento] =
    useState<ListaEvento[]>([]);

  const [listaSelecionadaId,
    setListaSelecionadaId] =
    useState<number | null>(null);

  const [listaNome,
    setListaNome] =
    useState("");

  const [listaSlug, setListaSlug] = useState("");

  const [listaOrdem, setListaOrdem] = useState("");

  const [listaCor, setListaCor] = useState("");

  const [listaCategoria, setListaCategoria] = useState("personalizada");

  const [listaOrigemCampanha, setListaOrigemCampanha] = useState("");

  const [listaDescricao,
    setListaDescricao] =
    useState("");

  const [listaRegra,
    setListaRegra] =
    useState("");

  const [listaVisibilidade,
    setListaVisibilidade] =
    useState("publica");

  const [listaTipo,
    setListaTipo] =
    useState("simples");

  const [listaValor,
    setListaValor] =
    useState("");

  const [listaPrazo,
    setListaPrazo] =
    useState("");

  const [listaResponsavel,
    setListaResponsavel] =
    useState("");

  const [listaAtiva,
    setListaAtiva] =
    useState(true);

  const [listaSalvando,
    setListaSalvando] =
    useState(false);

  const [listaMensagem,
    setListaMensagem] =
    useState("");

  const carregarEvento = useCallback(async () => {
    setLoading(true);

    const { autorizado, evento, erro } =
      await podeEditarEvento(slug);

    if (!autorizado || !evento) {
      setAcessoNegado(true);
      setMensagemAcesso(erro || "Você não possui permissão para editar este evento.");
      setLoading(false);
      return;
    }

    setAcessoNegado(false);
    setMensagemAcesso("");
    setEventoId(evento.id);

    setSlugEvento(evento.slug);

    setNome(evento.nome);

    setDataEvento(
      evento.data_evento
    );

    setHoraEvento(
      evento.hora_evento
    );

    setLocalEvento(
      evento.local_evento
    );

    setMapsUrl(
      evento.maps_url || ""
    );

    setBannerPosicao(
      evento.banner_posicao ||
      "center"
    );

    setTipoLista(
      evento.tipo_lista ||
      "simples"
    );

    const {
      data: produtoresData,
    } = await supabase
      .from("usuarios")
      .select("id, email")
      .eq(
        "role",
        "produtor"
      )
      .order(
        "email"
      );

    if (produtoresData) {
      setProdutores(
        produtoresData as Produtor[]
      );
    }

    const {
      data: vinculados,
    } = await supabase
      .from(
        "evento_produtores"
      )
      .select(
        "usuario_id"
      )
      .eq(
        "evento_id",
        evento.id
      );

    if (vinculados) {
      setProdutoresSelecionados(
        vinculados
          .map((item) => item.usuario_id)
          .filter(Boolean) as Array<string | number>
      );
    }

    const {
      data: staffData,
    } = await supabase
      .from("usuarios")
      .select("id, email")
      .eq("role", "staff")
      .order("email");

    if (staffData) {
      setStaffs(staffData as Staff[]);
    }

    const {
      data: staffsVinculados,
    } = await supabase
      .from("evento_staff")
      .select("usuario_id")
      .eq("evento_id", evento.id);

    if (staffsVinculados) {
      setStaffSelecionado(
        staffsVinculados
          .map((item) => item.usuario_id)
          .filter(Boolean) as Array<string | number>
      );
    }

    const { data: listasData } = await supabase
      .from("listas_evento")
      .select("*")
      .eq("evento_id", evento.id)
      .order("id", { ascending: false });

    if (listasData) {
      setListasEvento(listasData as ListaEvento[]);
    }

    setLoading(false);
  }, [slug]);

  useEffect(() => {
    if (!slug) {
      return;
    }

    let ativo = true;

    async function carregar() {
      if (!ativo) {
        return;
      }

      await carregarEvento();
    }

    carregar();

    return () => {
      ativo = false;
    };
  }, [slug, carregarEvento]);

  if (acessoNegado) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900">
        <div className="text-center max-w-xl px-6">
          <h1 className="text-3xl font-bold">
            Acesso negado
          </h1>
          <p className="mt-3 text-slate-600">
            {mensagemAcesso || "Você não possui permissão para editar este evento."}
          </p>
        </div>
      </main>
    );
  }

  if (loading) {

    return (

      <main className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900">

        <h1 className="text-3xl font-bold">
          Carregando...
        </h1>

      </main>

    );

  }  async function salvarEvento(
    e: FormEvent
  ) {

    e.preventDefault();

    if (!eventoId) return;

    setSalvando(true);

    const { error } =
      await supabase
        .from("eventos")
        .update({

          nome,

          data_evento:
            dataEvento,

          hora_evento:
            horaEvento,

          local_evento:
            localEvento,

          maps_url:
            mapsUrl,

          banner_posicao:
            bannerPosicao,

          tipo_lista:
            tipoLista,

        })
        .eq(
          "id",
          eventoId
        );

    if (error) {

      console.log(error);

      alert(
        "Erro ao atualizar evento."
      );

      setSalvando(false);

      return;

    }

    const { error: deleteError } =
      await supabase
        .from(
          "evento_produtores"
        )
        .delete()
        .eq(
          "evento_id",
          eventoId
        );

    if (deleteError) {
      console.log(deleteError);
      alert("Erro ao atualizar produtores do evento.");
      setSalvando(false);
      return;
    }

    if (
      produtoresSelecionados.length > 0
    ) {
      const registros =
        produtoresSelecionados.map(
          (usuarioId) => ({
            evento_id:
              eventoId,
            usuario_id:
              usuarioId,
          })
        );

      const { error: insertError } =
        await supabase
          .from(
            "evento_produtores"
          )
          .insert(registros);

      if (insertError) {
        console.log(insertError);
        alert("Erro ao salvar produtores do evento.");
        setSalvando(false);
        return;
      }
    }

    const { error: deleteStaffError } =
      await supabase
        .from("evento_staff")
        .delete()
        .eq("evento_id", eventoId);

    if (deleteStaffError) {
      console.log(deleteStaffError);
      alert("Erro ao atualizar equipe de check-in.");
      setSalvando(false);
      return;
    }

    if (staffSelecionado.length > 0) {
      const registrosStaff =
        staffSelecionado.map((usuarioId) => ({
          evento_id: eventoId,
          usuario_id: usuarioId,
        }));

      const { error: insertStaffError } =
        await supabase
          .from("evento_staff")
          .insert(registrosStaff);

      if (insertStaffError) {
        console.log(insertStaffError);
        alert("Erro ao salvar equipe de check-in.");
        setSalvando(false);
        return;
      }
    }

    setSalvando(false);

    alert(
      "Evento atualizado com sucesso!"
    );

    router.push(
      `/admin/eventos/${slugEvento}`
    );

  }

  function limparFormularioLista() {
    setListaSelecionadaId(null);
    setListaNome("");
    setListaSlug("");
    setListaDescricao("");
    setListaRegra("");
    setListaVisibilidade("publica");
    setListaTipo("simples");
    setListaValor("");
    setListaPrazo("");
    setListaResponsavel("");
    setListaOrdem("");
    setListaCor("");
    setListaCategoria("personalizada");
    setListaOrigemCampanha("");
    setListaAtiva(true);
    setListaMensagem("");
  }

  function editarLista(lista: ListaEvento) {
    setListaSelecionadaId(lista.id);
    setListaNome(lista.nome);
    setListaDescricao(lista.descricao || "");
    setListaRegra(lista.regra || "");
    setListaVisibilidade(lista.visibilidade || "publica");
    setListaValor(lista.valor !== null ? String(lista.valor) : "");
    setListaPrazo(lista.prazo || "");
    setListaResponsavel(lista.responsavel || "");
    setListaAtiva(lista.ativa);
    setListaSlug(lista.slug || "");
    setListaOrdem(lista.ordem !== undefined && lista.ordem !== null ? String(lista.ordem) : "");
    setListaCor(lista.cor || "");
    setListaCategoria(lista.categoria || "personalizada");
    setListaOrigemCampanha(lista.origem_campanha || "");
    setListaTipo(lista.tipo_lista || "simples");
    setListaMensagem("Editando lista selecionada");
  }

  async function salvarLista(
    e: FormEvent
  ) {
    e.preventDefault();

    if (!eventoId) {
      return;
    }

    setListaSalvando(true);
    setListaMensagem("");

    const payload = {
      evento_id: eventoId,
      nome: listaNome,
      slug: listaSlug || null,
      descricao: listaDescricao || null,
      regra: listaRegra || null,
      visibilidade: listaVisibilidade || null,
      tipo_lista: listaTipo || 'simples',
      valor: listaValor ? Number(listaValor) : null,
      prazo: listaPrazo || null,
      responsavel: listaResponsavel || null,
      ordem: listaOrdem ? Number(listaOrdem) : 0,
      cor: listaCor || null,
      categoria: listaCategoria || "personalizada",
      origem_campanha: listaOrigemCampanha || null,
      responsavel_usuario_id: null,
      ativa: listaAtiva,
    };

    let error;

    // ensure slug exists: generate from name if empty
    function generateSlug(text: string) {
      return text
        .toLowerCase()
        .normalize("NFKD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 75);
    }

    async function ensureUniqueSlug(base: string) {
      let candidate = base;
      let suffix = 1;
      while (true) {
        const { data } = await supabase
          .from("listas_evento")
          .select("id")
          .eq("evento_id", eventoId)
          .eq("slug", candidate)
          .limit(1);

        if (!data || data.length === 0) return candidate;

        // if updating existing and found same record id, it's fine
        if (listaSelecionadaId && data[0].id === listaSelecionadaId) return candidate;

        candidate = `${base}-${suffix}`;
        suffix += 1;
      }
    }

    // prepare slug and enforce uniqueness within event
    let finalSlug = listaSlug && listaSlug.trim() ? listaSlug.trim() : generateSlug(listaNome || "");
    if (!finalSlug) {
      finalSlug = generateSlug(listaNome || "lista");
    }
    finalSlug = await ensureUniqueSlug(finalSlug);

    payload.slug = finalSlug;

    if (listaSelecionadaId) {
      const result = await supabase
        .from("listas_evento")
        .update(payload)
        .eq("id", listaSelecionadaId);

      error = result.error;
    } else {
      const result = await supabase
        .from("listas_evento")
        .insert([payload]);

      error = result.error;
    }

    if (error) {
      console.log(error);
      alert("Erro ao salvar lista do evento.");
      setListaSalvando(false);
      return;
    }

    const { data: listasData } = await supabase
      .from("listas_evento")
      .select("*")
      .eq("evento_id", eventoId)
      .order("id", { ascending: false });

    if (listasData) {
      setListasEvento(listasData as ListaEvento[]);
    }

    limparFormularioLista();
    setListaSalvando(false);
    setListaMensagem(
      listaSelecionadaId
        ? "Lista atualizada com sucesso."
        : "Lista criada com sucesso."
    );
  }

  async function excluirLista(id: number) {
    if (!confirm("Deseja remover esta lista do evento?")) {
      return;
    }

    const { error } = await supabase
      .from("listas_evento")
      .delete()
      .eq("id", id);

    if (error) {
      console.log(error);
      alert("Erro ao excluir lista do evento.");
      return;
    }

    setListasEvento((prev) => prev.filter((lista) => lista.id !== id));
    if (listaSelecionadaId === id) {
      limparFormularioLista();
    }
  }

  return (

    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 overflow-x-hidden">

      <div className="max-w-4xl mx-auto bg-white border border-blue-100 rounded-3xl p-5 sm:p-8 shadow-sm">

        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6 sm:mb-8">

          <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-900 break-words">
            Editar Evento
          </h1>

          <Link
            href={`/admin/eventos/${slugEvento}`}
            className="bg-blue-100 hover:bg-blue-200 text-blue-900 px-5 py-3 rounded-xl font-bold min-h-11 text-center"
          >
            Voltar
          </Link>

        </div>

        <form
          onSubmit={salvarEvento}
          className="space-y-5"
        >

          <input
            type="text"
            value={nome}
            onChange={(e) =>
              setNome(
                e.target.value
              )
            }
            placeholder="Nome do Evento"
            className="w-full p-4 rounded-xl bg-white text-black"
          />

          <input
            type="date"
            value={dataEvento}
            onChange={(e) =>
              setDataEvento(
                e.target.value
              )
            }
            className="w-full p-4 rounded-xl bg-white text-black"
          />

          <input
            type="time"
            value={horaEvento}
            onChange={(e) =>
              setHoraEvento(
                e.target.value
              )
            }
            className="w-full p-4 rounded-xl bg-white text-black"
          />

          <input
            type="text"
            value={localEvento}
            onChange={(e) =>
              setLocalEvento(
                e.target.value
              )
            }
            placeholder="Local do Evento"
            className="w-full p-4 rounded-xl bg-white text-black"
          />

          <input
            type="text"
            value={mapsUrl}
            onChange={(e) =>
              setMapsUrl(
                e.target.value
              )
            }
            placeholder="Google Maps"
            className="w-full p-4 rounded-xl bg-white text-black"
          />          <div>

            <p className="mb-2 text-blue-900 font-bold">
              Tipo da Lista
            </p>

            <select
              value={tipoLista}
              onChange={(e) =>
                setTipoLista(
                  e.target.value
                )
              }
              className="w-full p-4 rounded-xl bg-white text-black"
            >

              <option value="simples">
                Lista Simples
              </option>

              <option value="vip">
                Lista VIP
              </option>

            </select>

          </div>

          <div>

            <p className="mb-2 text-blue-900 font-bold">
              Posição do Banner
            </p>

            <select
              value={bannerPosicao}
              onChange={(e) =>
                setBannerPosicao(
                  e.target.value
                )
              }
              className="w-full p-4 rounded-xl bg-white text-black"
            >

              <option value="top">
                Topo
              </option>

              <option value="center">
                Centro
              </option>

              <option value="bottom">
                Baixo
              </option>

            </select>

          </div>

          <div className="border-t border-slate-200 pt-6">

            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              Listas do Evento
            </h2>

            <div className="grid gap-4 md:grid-cols-2 mb-6">

              <div className="space-y-3">

                <input
                  type="text"
                  placeholder="Nome da Lista"
                  value={listaNome}
                  onChange={(e) =>
                    setListaNome(e.target.value)
                  }
                  className="w-full p-4 rounded-xl bg-white text-black"
                />

                <input
                  type="text"
                  placeholder="Slug da Lista (opcional)"
                  value={listaSlug}
                  onChange={(e) => setListaSlug(e.target.value)}
                  className="w-full p-4 rounded-xl bg-white text-black"
                />

                <textarea
                  placeholder="Descrição"
                  value={listaDescricao}
                  onChange={(e) =>
                    setListaDescricao(e.target.value)
                  }
                  className="w-full p-4 rounded-xl bg-white text-black h-28"
                />

                <input
                  type="text"
                  placeholder="Regra (ex: VIP, Lista VIP, Entrada Livre)"
                  value={listaRegra}
                  onChange={(e) =>
                    setListaRegra(e.target.value)
                  }
                  className="w-full p-4 rounded-xl bg-white text-black"
                />

              </div>

              <div className="space-y-3">

                <select
                  value={listaVisibilidade}
                  onChange={(e) =>
                    setListaVisibilidade(e.target.value)
                  }
                  className="w-full p-4 rounded-xl bg-white text-black"
                >
                  <option value="publica">Visibilidade Pública</option>
                  <option value="privada">Visibilidade Privada</option>
                </select>

                <select
                  value={listaTipo}
                  onChange={(e) => setListaTipo(e.target.value)}
                  className="w-full p-4 rounded-xl bg-white text-black"
                >
                  <option value="simples">Lista Simples</option>
                  <option value="vip">Lista VIP</option>
                </select>

                <input
                  type="number"
                  placeholder="Valor"
                  value={listaValor}
                  onChange={(e) =>
                    setListaValor(e.target.value)
                  }
                  className="w-full p-4 rounded-xl bg-white text-black"
                />

                <input
                  type="date"
                  placeholder="Prazo"
                  value={listaPrazo}
                  onChange={(e) =>
                    setListaPrazo(e.target.value)
                  }
                  className="w-full p-4 rounded-xl bg-white text-black"
                />

                <div className="flex gap-3">
                  <input
                    type="number"
                    placeholder="Ordem"
                    value={listaOrdem}
                    onChange={(e) => setListaOrdem(e.target.value)}
                    className="w-1/2 p-4 rounded-xl bg-white text-black"
                  />

                  <input
                    type="color"
                    title="Cor"
                    value={listaCor || "#000000"}
                    onChange={(e) => setListaCor(e.target.value)}
                    className="w-1/2 p-2 rounded-xl bg-white"
                  />
                </div>

                <select
                  value={listaCategoria}
                  onChange={(e) => setListaCategoria(e.target.value)}
                  className="w-full p-4 rounded-xl bg-white text-black"
                >
                  <option value="promocional">promocional</option>
                  <option value="vip">vip</option>
                  <option value="aniversario">aniversario</option>
                  <option value="banda">banda</option>
                  <option value="influenciador">influenciador</option>
                  <option value="camarote">camarote</option>
                  <option value="staff">staff</option>
                  <option value="imprensa">imprensa</option>
                  <option value="patrocinador">patrocinador</option>
                  <option value="personalizada">personalizada</option>
                </select>

                <input
                  type="text"
                  placeholder="Origem da campanha"
                  value={listaOrigemCampanha}
                  onChange={(e) => setListaOrigemCampanha(e.target.value)}
                  className="w-full p-4 rounded-xl bg-white text-black"
                />

                <input
                  type="text"
                  placeholder="Responsável"
                  value={listaResponsavel}
                  onChange={(e) =>
                    setListaResponsavel(e.target.value)
                  }
                  className="w-full p-4 rounded-xl bg-white text-black"
                />

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={listaAtiva}
                    onChange={(e) =>
                      setListaAtiva(e.target.checked)
                    }
                  />
                  <span>Lista ativa</span>
                </label>

              </div>

            </div>

            <div className="flex gap-3 flex-wrap mb-4">
              <button
                type="button"
                onClick={salvarLista}
                disabled={listaSalvando}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-2xl font-bold transition disabled:bg-slate-300 min-h-11"
              >
                {listaSalvando ? "SALVANDO..." : listaSelecionadaId ? "ATUALIZAR LISTA" : "CRIAR LISTA"}
              </button>

              <button
                type="button"
                onClick={limparFormularioLista}
                className="bg-blue-100 hover:bg-blue-200 text-blue-900 px-5 py-3 rounded-2xl font-bold transition min-h-11"
              >
                Limpar
              </button>
            </div>

            {listaMensagem && (
              <div className="mb-4 text-sm text-green-400">
                {listaMensagem}
              </div>
            )}

            <div className="space-y-3">
              {listasEvento.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhuma lista criada para este evento.
                </p>
              ) : (
                listasEvento.map((lista) => (
                  <div
                    key={lista.id}
                    className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-blue-900">{lista.nome}</h3>
                        <p className="text-sm text-slate-600">{lista.descricao || "Sem descrição"}</p>
                        <p className="text-sm text-slate-500">Regra: {lista.regra || "-"}</p>
                        <p className="text-sm text-slate-500">Slug: {lista.slug || "-"}</p>
                        <p className="text-sm text-slate-500">Visibilidade: {lista.visibilidade || "-"}</p>
                        <p className="text-sm text-slate-500">Tipo: {lista.tipo_lista || "-"}</p>
                        <p className="text-sm text-slate-500">Ordem: {lista.ordem ?? 0}</p>
                        <p className="text-sm text-slate-500">Cor: {lista.cor || "-"}</p>
                        <p className="text-sm text-slate-500">Categoria: {lista.categoria || "-"}</p>
                        <p className="text-sm text-slate-500">Origem: {lista.origem_campanha || "-"}</p>
                        <p className="text-sm text-slate-500">Valor: {lista.valor !== null ? `R$ ${lista.valor}` : "-"}</p>
                        <p className="text-sm text-slate-500">Prazo: {lista.prazo || "-"}</p>
                        <p className="text-sm text-slate-500">Responsável: {lista.responsavel || "-"}</p>
                        <p className="text-sm text-slate-500">Ativa: {lista.ativa ? "Sim" : "Não"}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Link
                          href={`/admin/eventos/${slugEvento}/listas/${lista.id}`}
                          className="bg-green-500 hover:bg-green-400 text-white px-4 py-2 rounded-2xl font-bold transition min-h-10"
                        >
                          Ver Participantes
                        </Link>
                        <button
                          type="button"
                          onClick={() => editarLista(lista)}
                          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-2xl font-bold transition min-h-10"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => excluirLista(lista.id)}
                          className="bg-red-500 hover:bg-red-400 text-white px-4 py-2 rounded-2xl font-bold transition min-h-10"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>

          <div className="border-t border-slate-200 pt-6">

            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              Produtores com acesso
            </h2>

            <div className="space-y-3">

              {produtores.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhum produtor disponível no momento.
                </p>
              ) : (
                produtores.map((produtor) => (

                <label
                  key={produtor.id}
                  className="flex items-center gap-3 cursor-pointer"
                >

                  <input
                    type="checkbox"
                    checked={produtoresSelecionados.some(
                      (id) =>
                        String(id) ===
                        String(produtor.id)
                    )}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setProdutoresSelecionados(
                          (prev) => [
                            ...prev,
                            produtor.id,
                          ]
                        );
                      } else {
                        setProdutoresSelecionados(
                          (prev) =>
                            prev.filter(
                              (id) =>
                                String(id) !==
                                String(produtor.id)
                            )
                        );
                      }
                    }}
                  />

                  <span>
                    {produtor.email}
                  </span>

                </label>

              ))
              )}

            </div>

          </div>

          <div className="border-t border-slate-200 pt-6">

            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              Equipe de check-in
            </h2>

            <div className="space-y-3">

              {staffs.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Nenhum usuário staff disponível no momento.
                </p>
              ) : (
                staffs.map((staff) => (
                  <label
                    key={staff.id}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={staffSelecionado.some(
                        (id) => String(id) === String(staff.id)
                      )}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setStaffSelecionado((prev) => [...prev, staff.id]);
                        } else {
                          setStaffSelecionado((prev) =>
                            prev.filter((id) => String(id) !== String(staff.id))
                          );
                        }
                      }}
                    />
                    <span>{staff.email}</span>
                  </label>
                ))
              )}

            </div>

          </div>

          <div className="pt-6">

            <button
              type="submit"
              disabled={salvando}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white p-4 sm:p-5 rounded-xl font-extrabold text-base sm:text-lg transition min-h-11"
            >
              {salvando
                ? "SALVANDO..."
                : "SALVAR ALTERAÇÕES"}
            </button>

          </div>

        </form>

      </div>

    </main>

  );

}