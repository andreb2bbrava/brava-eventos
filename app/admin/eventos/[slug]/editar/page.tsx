"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { podeEditarEvento } from "@/lib/permissoes";
import AdminShell from "@/app/components/AdminShell";
import AdminEventTabs from "@/app/components/AdminEventTabs";
import DeleteEventButton from "@/app/components/DeleteEventButton";
import { gerarSlugUnicoEvento } from "@/lib/slug";
import { canEditEventRole, isAdminRole, type RoleUsuario } from "@/lib/roles";

type Produtor = {
  id: string | number;
  email: string;
};

type Staff = {
  id: string | number;
  email: string;
};

function separarDataHora(dataHora: string | null) {
  if (!dataHora) {
    return { data: "", hora: "" };
  }

  const dataObj = new Date(dataHora);

  if (Number.isNaN(dataObj.getTime())) {
    return { data: "", hora: "" };
  }

  const data = dataObj.toISOString().slice(0, 10);
  const hora = dataObj.toISOString().slice(11, 16);
  return { data, hora };
}

function logSupabaseError(contexto: string, error: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
} | null) {
  console.error(`ERRO BRUTO ${contexto}:`, error);
  console.error("MESSAGE:", error?.message);
  console.error("DETAILS:", error?.details);
  console.error("HINT:", error?.hint);
  console.error("CODE:", error?.code);
  console.error("JSON:", JSON.stringify(error, null, 2));
}

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

  const [roleUsuario, setRoleUsuario] = useState<RoleUsuario | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [criadorId, setCriadorId] = useState<string | null>(null);

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

  const [descricao, setDescricao] =
    useState("");

  const [inicioEvento, setInicioEvento] =
    useState("");

  const [terminoEvento, setTerminoEvento] =
    useState("");

  const [dataEvento, setDataEvento] =
    useState("");

  const [horaEvento, setHoraEvento] =
    useState("");

  const [localEvento, setLocalEvento] =
    useState("");

  const [mapsUrl, setMapsUrl] =
    useState("");

  const [bannerUrl, setBannerUrl] = useState("");

  const [bannerArquivo, setBannerArquivo] = useState<File | null>(null);

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

  const carregarEvento = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUsuarioId(user?.id || null);

    const { autorizado, evento, erro, role } =
      await podeEditarEvento(slug);

    if (!autorizado || !evento) {
      setAcessoNegado(true);
      setMensagemAcesso(erro || "Você não possui permissão para editar este evento.");
      setRoleUsuario((role as RoleUsuario | null) ?? null);
      setLoading(false);
      return;
    }

    setAcessoNegado(false);
    setMensagemAcesso("");
    setRoleUsuario((role as RoleUsuario | null) ?? null);
    setEventoId(evento.id);
    setCriadorId(evento.criador_id ? String(evento.criador_id) : null);

    setSlugEvento(evento.slug || "");

    setNome(evento.nome);

    setDescricao(evento.descricao || "");

    const inicioCalculado = evento.inicio_evento || (evento.data_evento && evento.hora_evento ? `${evento.data_evento}T${evento.hora_evento}` : null);
    const partesInicio = separarDataHora(inicioCalculado);
    setInicioEvento(partesInicio.data && partesInicio.hora ? `${partesInicio.data}T${partesInicio.hora}` : "");

    const partesTermino = separarDataHora(evento.termino_evento || null);
    setTerminoEvento(partesTermino.data && partesTermino.hora ? `${partesTermino.data}T${partesTermino.hora}` : "");

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

    setBannerUrl(evento.banner_url || "");

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

    if (!nome.trim()) {
      alert("Preencha o titulo do evento.");
      return;
    }

    if (!inicioEvento) {
      alert("Informe o inicio do evento.");
      return;
    }

    if (!terminoEvento) {
      alert("Informe o termino do evento.");
      return;
    }

    if (!localEvento.trim()) {
      alert("Informe o local do evento.");
      return;
    }

    const inicioDate = new Date(inicioEvento);
    const terminoDate = new Date(terminoEvento);

    if (Number.isNaN(inicioDate.getTime()) || Number.isNaN(terminoDate.getTime())) {
      alert("Datas invalidas. Verifique inicio e termino.");
      return;
    }

    if (terminoDate.getTime() <= inicioDate.getTime()) {
      alert("O termino deve ser posterior ao inicio.");
      return;
    }

    setSalvando(true);

    let proximoSlugEvento = (slugEvento || "").trim();

    if (!proximoSlugEvento) {
      const slugGerado = await gerarSlugUnicoEvento({
        supabase,
        titulo: nome,
        eventoIdAtual: eventoId,
      });

      if (!slugGerado) {
        alert("Nao foi possivel gerar o link do evento. Verifique o titulo.");
        setSalvando(false);
        return;
      }

      proximoSlugEvento = slugGerado;
    }

    let proximaBannerUrl = bannerUrl || null;

    if (bannerArquivo) {
      const nomeArquivo = `${Date.now()}-${bannerArquivo.name}`;
      const { error: erroUpload } = await supabase.storage
        .from("banners")
        .upload(nomeArquivo, bannerArquivo);

      if (erroUpload) {
        logSupabaseError("UPLOAD BANNER EDITAR EVENTO", erroUpload);
        alert(process.env.NODE_ENV !== "production" ? (erroUpload.message || "Erro ao subir banner do evento.") : "Erro ao subir banner do evento.");
        setSalvando(false);
        return;
      }

      const { data } = supabase.storage.from("banners").getPublicUrl(nomeArquivo);
      proximaBannerUrl = data.publicUrl;
    }

    const partesInicio = separarDataHora(inicioDate.toISOString());

    const payload = {
      nome: nome.trim(),
      slug: proximoSlugEvento,
      descricao: descricao.trim() || null,
      inicio_evento: inicioDate.toISOString(),
      termino_evento: terminoDate.toISOString(),
      data_evento: partesInicio.data || null,
      hora_evento: partesInicio.hora || null,
      local_evento: localEvento.trim(),
      maps_url: mapsUrl.trim() || null,
      banner_url: proximaBannerUrl,
    };

    console.log("PAYLOAD EDITAR EVENTO:", payload);

    const { error } =
      await supabase
        .from("eventos")
        .update(payload)
        .eq(
          "id",
          eventoId
        );

    if (error) {

      logSupabaseError("ATUALIZAR EVENTO", error);

      alert(
        process.env.NODE_ENV !== "production" ? (error.message || "Erro ao atualizar evento.") : "Erro ao atualizar evento."
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

    setSlugEvento(proximoSlugEvento);

    alert(
      "Evento atualizado com sucesso!"
    );

    router.push(
      `/admin/eventos/${proximoSlugEvento}`
    );

  }

  const podeExcluirEvento =
    isAdminRole(roleUsuario) ||
    (roleUsuario === "produtor" && Boolean(usuarioId) && Boolean(criadorId) && String(usuarioId) === String(criadorId));

  const nomeEventoExibicao = nome.trim() || slugEvento || "Evento";

  return (

    <AdminShell
      role={roleUsuario}
      title="Configuracoes do Evento"
      subtitle="Edite informacoes principais e acessos sem perder o contexto da Central do Evento."
      breadcrumbs={[
        { label: "Inicio", href: "/admin" },
        { label: "Meus Eventos", href: "/admin#todos-eventos" },
        { label: nome || slugEvento || "Evento", href: slugEvento ? `/admin/eventos/${slugEvento}` : undefined },
        { label: "Configuracoes" },
      ]}
      backLink={{ href: slugEvento ? `/admin/eventos/${slugEvento}` : "/admin", label: "Voltar para Central do Evento" }}
      aside={{
        title: "Configuracoes do evento",
        description:
          "Edite os dados principais do evento e gerencie acessos de produtores e staff sem sair do fluxo administrativo.",
      }}
    >
      <div className="space-y-6">
        {slugEvento ? <AdminEventTabs slug={slugEvento} current="configuracoes" /> : null}

        <div className="max-w-4xl bg-white border border-blue-100 rounded-3xl p-5 sm:p-8 shadow-sm">

        <form
          onSubmit={salvarEvento}
          className="space-y-5"
        >

          <div id="configuracoes-evento" />

          <input
            type="text"
            value={nome}
            onChange={(e) =>
              setNome(
                e.target.value
              )
            }
            placeholder="Ex: Brazuca 2026"
            className="ui-field"
          />

          <div>
            <label className="mb-2 block text-sm font-bold text-blue-900">Descricao do evento</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o evento, atracoes, regras e informacoes importantes."
              className="ui-field h-32"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-blue-900">Inicio do evento</label>
              <input
                type="datetime-local"
                value={inicioEvento}
                onChange={(e) => setInicioEvento(e.target.value)}
                className="ui-field"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-blue-900">Termino do evento</label>
              <input
                type="datetime-local"
                value={terminoEvento}
                onChange={(e) => setTerminoEvento(e.target.value)}
                className="ui-field"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-blue-900">Local</label>
            <input
              type="text"
              value={localEvento}
              onChange={(e) =>
                setLocalEvento(
                  e.target.value
                )
              }
              placeholder="Ex: Caza Brava"
              className="ui-field"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-blue-900">Link do Google Maps</label>
            <input
              type="url"
              value={mapsUrl}
              onChange={(e) =>
                setMapsUrl(
                  e.target.value
                )
              }
              placeholder="Cole aqui o link do Google Maps"
              className="ui-field"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-blue-900">Banner do evento</label>
            <p className="text-sm text-slate-500">Tamanho recomendado: 1920 × 600 px</p>
            <p className="mb-3 text-sm text-slate-500">Formatos: JPG ou PNG</p>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => setBannerArquivo(e.target.files?.[0] || null)}
              className="ui-field"
            />
            {bannerUrl ? (
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <img src={bannerUrl} alt={nome || "Banner do evento"} className="h-40 w-full object-cover" />
              </div>
            ) : null}
          </div>

          <div id="equipe-acessos" className="border-t border-slate-200 pt-6">

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

        {(canEditEventRole(roleUsuario)) && eventoId ? (
          <section className="max-w-4xl rounded-3xl border border-red-200 bg-red-50/60 p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-red-700">Zona de perigo</h2>
                <p className="mt-1 text-sm text-red-700/90">
                  Exclui o evento e todos os dados vinculados de forma definitiva.
                </p>
              </div>

              <DeleteEventButton
                eventoId={eventoId}
                eventoNome={nomeEventoExibicao}
                canDelete={podeExcluirEvento}
                redirectToAdmin
                buttonLabel="🗑 Excluir Evento"
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
      </div>

    </AdminShell>

  );

}