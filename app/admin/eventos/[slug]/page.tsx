"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { validarAcessoEvento } from "@/lib/permissoes";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export default function EventoDashboard() {
  const params = useParams();
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

  const [listasEvento, setListasEvento] =
    useState<Array<{ id: number; nome: string; tipo_lista: string | null }>>([]);

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

    const { data: listasData } = await supabase
      .from("listas_evento")
      .select("id, nome, tipo_lista")
      .eq("evento_id", eventoData.id);

    if (listasData) {
      setListasEvento(listasData as Array<{ id: number; nome: string; tipo_lista: string | null }>);
    }
  }

  async function fazerCheckin(
  id: number
) {
  console.log(
    "CHECK-IN INICIADO:",
    id
  );

  const { data, error } =
    await supabase
      .from("participantes")
      .update({
        presente: true,
        entrada_confirmada_em:
          new Date().toISOString(),
      })
      .eq("id", id)
      .select();

  console.log(
    "CHECK-IN DATA:",
    data
  );

  console.log(
    "CHECK-IN ERROR:",
    error
  );

  if (error) {
    console.error(
      "Erro ao realizar check-in:",
      error
    );

    alert(
      "Erro ao fazer check-in: " +
      error.message
    );

    return;
  }

  if (!data || data.length === 0) {
    alert(
      "Nenhum participante foi atualizado. Pode ser RLS/permissão ou ID inválido."
    );

    return;
  }

  await carregarDados();

  alert(
    "Check-in realizado com sucesso!"
  );
}

  // EXPORTAR EXCEL

  function exportarExcel() {

    const dados =
      participantes.map((p) => ({

        Nome: p.nome,

        WhatsApp:
          p.whatsapp || "",

        Email:
          p.email || "",

        Status:
          p.presente
            ? "PRESENTE"
            : "PENDENTE",

        Entrada:
          p.entrada_confirmada_em
            ? new Date(
                p.entrada_confirmada_em
              ).toLocaleTimeString(
                "pt-BR"
              )
            : "",

      }));

    const worksheet =
      XLSX.utils.json_to_sheet(
        dados
      );

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Participantes"
    );

    const excelBuffer =
      XLSX.write(
        workbook,
        {
          bookType: "xlsx",
          type: "array",
        }
      );

    const fileData =
      new Blob(
        [excelBuffer],
        {
          type:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
        }
      );

    saveAs(
      fileData,
      `${evento.slug}.xlsx`
    );
  }

  // EXPORTAR XML

  function exportarXML() {

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

  return (

    <main className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden">

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
  Dashboard do Evento
</p>

<div className="flex gap-3 mt-5 flex-wrap justify-center w-full px-2">

  {(roleUsuario === "super_admin" || roleUsuario === "produtor") && (
    <a
      href={`/admin/eventos/${evento.slug}/editar`}
      className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-2xl font-bold transition min-h-11"
    >
      Editar Evento
    </a>
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

  <button
    onClick={() => {

      navigator.clipboard.writeText(
        `${window.location.origin}/evento/${evento.slug}`
      );

      alert("Link copiado!");
    }}
    className="bg-green-500 hover:bg-green-400 text-white px-5 py-3 rounded-2xl font-bold transition min-h-11"
  >
    Copiar Link
  </button>

</div>

        </div>

      </section>

      <section className="p-4 sm:p-6">

        {/* CARDS */}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 sm:gap-6 mb-8">

          <div className="bg-white border border-blue-100 rounded-3xl p-6 text-center shadow-sm">

            <p className="text-slate-500">
              Total Confirmados
            </p>

            <h2 className="text-4xl sm:text-5xl font-bold text-blue-900 mt-3">
              {totalConfirmados}
            </h2>

          </div>

          <div className="bg-white border border-green-200 rounded-3xl p-6 text-center shadow-sm">

            <p className="text-slate-500">
              Presentes
            </p>

            <h2 className="text-4xl sm:text-5xl font-bold text-green-600 mt-3">
              {totalPresentes}
            </h2>

          </div>

          <div className="bg-white border border-amber-200 rounded-3xl p-6 text-center shadow-sm">

            <p className="text-slate-500">
              Pendentes
            </p>

            <h2 className="text-4xl sm:text-5xl font-bold text-amber-600 mt-3">
              {totalPendentes}
            </h2>

          </div>

          <div className="bg-white border border-blue-100 rounded-3xl p-6 text-center shadow-sm">

            <p className="text-slate-500">
              Comparecimento
            </p>

            <h2 className="text-4xl sm:text-5xl font-bold text-blue-500 mt-3">
              {porcentagemComparecimento}%
            </h2>

          </div>

          <div className="bg-white border border-amber-200 rounded-3xl p-6 text-center shadow-sm">

            <p className="text-slate-500">
              Horário Mais Quente
            </p>

            <h2 className="text-3xl sm:text-4xl font-bold text-orange-500 mt-3">
              🔥 {horarioMaisQuente}
            </h2>

          </div>

        </div>

        {/* EXPORTAÇÃO */}

        <div className="flex gap-3 mb-6 flex-wrap">

          <button
            onClick={exportarExcel}
            className="bg-green-500 hover:bg-green-400 text-white px-5 py-3 rounded-2xl font-bold transition min-h-11"
          >
            Exportar Excel
          </button>

          <button
            onClick={exportarXML}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-2xl font-bold transition min-h-11"
          >
            Exportar XML
          </button>

        </div>

        {/* BUSCA */}

        <input
          type="text"
          placeholder="Buscar participante..."
          value={busca}
          onChange={(e) =>
            setBusca(
              e.target.value
            )
          }
          className="w-full p-4 rounded-xl bg-white text-black mb-6 text-base"
        />

        {/* FILTROS */}

        <div className="flex gap-3 mb-6 flex-wrap">

          <button
            onClick={() =>
              setFiltro("todos")
            }
            className={`px-4 sm:px-5 py-3 rounded-xl font-bold transition min-h-11 ${
              filtro === "todos"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-700 border border-slate-200"
            }`}
          >
            Todos
          </button>

          <button
            onClick={() =>
              setFiltro("presentes")
            }
            className={`px-4 sm:px-5 py-3 rounded-xl font-bold transition min-h-11 ${
              filtro === "presentes"
                ? "bg-green-500 text-white"
                : "bg-white text-slate-700 border border-slate-200"
            }`}
          >
            Presentes
          </button>

          <button
            onClick={() =>
              setFiltro("pendentes")
            }
            className={`px-4 sm:px-5 py-3 rounded-xl font-bold transition min-h-11 ${
              filtro === "pendentes"
                ? "bg-amber-500 text-white"
                : "bg-white text-slate-700 border border-slate-200"
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
                  <p className="text-sm text-slate-600">Lista: {lista.nome}</p>
                  <p className="text-sm text-slate-600">Tipo: {lista.tipo}</p>
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
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-bold min-h-11"
                    >
                      Confirmar Entrada
                    </button>
                  ) : (
                    <span className="text-green-600 font-bold">✔ Confirmado</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {/* TABELA DESKTOP */}

        <div className="hidden md:block overflow-auto rounded-3xl border border-blue-100 bg-white shadow-sm">

          <table className="w-full">

            <thead className="bg-blue-50 text-slate-700">

              <tr>

                <th className="p-4 text-left">
                  Nome
                </th>

                <th className="p-4 text-left">
                  WhatsApp
                </th>

                <th className="p-4 text-left">
                  Status
                </th>

                <th className="p-4 text-left">
                  Horário Entrada
                </th>

                <th className="p-4 text-left">
                  Check-in
                </th>

              </tr>

            </thead>

            <tbody>

              {participantesFiltrados.map(
                (participante) => (

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

                    <td className="p-4">
                      {participante.nome}
                    </td>

                    <td className="p-4">
                      {participante.whatsapp || "-"}
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

                    <td className="p-4">

                      {!participante.presente ? (

                        <button
                          onClick={() =>
                            fazerCheckin(
                              participante.id
                            )
                          }
                          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl font-bold transition"
                        >
                          Fazer Check-in
                        </button>

                      ) : (

                        <span className="text-green-600 font-bold">
                          ✔ Confirmado
                        </span>

                      )}

                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>

      </section>

    </main>
  );
}