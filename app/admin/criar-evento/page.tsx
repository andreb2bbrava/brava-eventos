"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AdminShell from "@/app/components/AdminShell";
import { gerarSlugUnicoEvento } from "@/lib/slug";

type RoleUsuario = "super_admin" | "produtor" | "staff";

function separarDataHora(dataHora: string) {
  if (!dataHora) {
    return { data: "", hora: "" };
  }

  const [data, hora] = dataHora.split("T");
  return { data: data || "", hora: hora || "" };
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

export default function CriarEventoPage() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [inicioEvento, setInicioEvento] = useState("");
  const [terminoEvento, setTerminoEvento] = useState("");
  const [localEvento, setLocalEvento] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [banner, setBanner] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");
  const [acessoNegado, setAcessoNegado] = useState(false);
  const [roleUsuario, setRoleUsuario] = useState<RoleUsuario | null>(null);

  useEffect(() => {
    async function verificarPermissao() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: usuarioData } = await supabase
        .from("usuarios")
        .select("role")
        .eq("id", user.id)
        .single();

      setRoleUsuario((usuarioData?.role as RoleUsuario | null) ?? null);

      if (!usuarioData || (usuarioData.role !== "super_admin" && usuarioData.role !== "produtor")) {
        setAcessoNegado(true);
        return;
      }

      setAcessoNegado(false);
    }

    verificarPermissao();
  }, [router]);

  async function criarEvento(e: React.FormEvent) {
    e.preventDefault();

    setMensagemErro("");
    setMensagemSucesso("");

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

    if (Number.isNaN(inicioDate.getTime())) {
      alert("Data/hora de inicio invalida.");
      return;
    }

    if (Number.isNaN(terminoDate.getTime())) {
      alert("Data/hora de termino invalida.");
      return;
    }

    if (terminoDate.getTime() <= inicioDate.getTime()) {
      alert("O termino deve ser posterior ao inicio.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Usuario nao autenticado.");
      return;
    }

    setSalvando(true);

    try {
      const slug = await gerarSlugUnicoEvento({
        supabase,
        titulo: nome,
      });

      if (!slug) {
        alert("Nao foi possivel gerar o link do evento. Verifique o titulo.");
        setSalvando(false);
        return;
      }

      const { data: slugExistente, error: erroSlug } = await supabase
        .from("eventos")
        .select("id")
        .eq("slug", slug)
        .limit(1);

      if (erroSlug) {
        logSupabaseError("VALIDAR SLUG CRIAR EVENTO", erroSlug);
        setMensagemErro(
          process.env.NODE_ENV !== "production"
            ? (erroSlug.message || "Erro ao validar slug do evento.")
            : "Nao foi possivel criar o evento. Tente novamente."
        );
        setSalvando(false);
        return;
      }

      if ((slugExistente || []).length > 0) {
        setMensagemErro("Nao foi possivel gerar um slug unico para este evento. Tente outro titulo.");
        setSalvando(false);
        return;
      }

      let bannerUrl: string | null = null;

      if (banner) {
        const nomeArquivo = `${Date.now()}-${banner.name}`;
        const { error: erroUpload } = await supabase.storage
          .from("banners")
          .upload(nomeArquivo, banner);

        if (erroUpload) {
          logSupabaseError("UPLOAD BANNER CRIAR EVENTO", erroUpload);
          setMensagemErro(
            process.env.NODE_ENV !== "production"
              ? (erroUpload.message || "Erro ao subir banner.")
              : "Nao foi possivel enviar o banner. Tente novamente."
          );
          setSalvando(false);
          return;
        } else {
          const { data } = supabase.storage.from("banners").getPublicUrl(nomeArquivo);
          bannerUrl = data.publicUrl;
        }
      }

      const inicio = separarDataHora(inicioEvento);
      const termino = separarDataHora(terminoEvento);

      const payload = {
        nome: nome.trim(),
        slug,
        criador_id: user.id,
        descricao: descricao.trim() || null,
        inicio_evento: inicioDate.toISOString(),
        termino_evento: terminoDate.toISOString(),
        data_evento: inicio.data || null,
        hora_evento: inicio.hora || null,
        local_evento: localEvento.trim(),
        maps_url: mapsUrl.trim() || null,
        banner_url: bannerUrl,
      };

      console.log("PAYLOAD CRIAR EVENTO:", payload);

      const { error } = await supabase.from("eventos").insert([payload]);

      if (error) {
        logSupabaseError("CRIAR EVENTO", error);

        const mensagemVisual = process.env.NODE_ENV !== "production"
          ? (error?.message || "Erro ao criar evento.")
          : "Nao foi possivel criar o evento. Tente novamente.";

        setMensagemErro(mensagemVisual);
        setSalvando(false);
        return;
      }

      setMensagemSucesso("Evento criado com sucesso.");
      router.push(`/admin/eventos/${slug}`);
    } catch (erro) {
      console.error("EXCEÇÃO AO CRIAR EVENTO:", erro);
      setMensagemErro(
        process.env.NODE_ENV !== "production"
          ? String((erro as Error)?.message || erro || "Erro ao criar evento.")
          : "Nao foi possivel criar o evento. Tente novamente."
      );
      setSalvando(false);
      return;
    }
  }

  if (acessoNegado) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-6">
        <div className="text-center max-w-xl">
          <h1 className="text-3xl font-bold">Acesso negado</h1>
          <p className="mt-3 text-slate-600">Seu perfil permite apenas acesso de check-in para eventos.</p>
        </div>
      </main>
    );
  }

  return (
    <AdminShell
      role={roleUsuario}
      title="Novo Evento"
      subtitle="Crie o evento, salve os dados principais e siga direto para a Central do Evento para montar suas listas."
      breadcrumbs={[
        { label: "Inicio", href: "/admin" },
        { label: "Meus Eventos", href: "/admin#todos-eventos" },
        { label: "Novo Evento" },
      ]}
      backLink={{ href: "/admin#todos-eventos", label: "Voltar para Meus Eventos" }}
      aside={{
        title: "Fluxo recomendado",
        description:
          "Depois de criar o evento, voce sera levado para a Central do Evento. A partir de la voce pode criar listas simples ou completas e preparar a operacao.",
      }}
    >
      <div className="max-w-3xl rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_20px_60px_rgba(148,163,184,0.16)] sm:p-8">
        {mensagemSucesso ? (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-sm font-semibold text-green-700">
            {mensagemSucesso}
          </div>
        ) : null}

        {mensagemErro ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-semibold text-red-700">
            {mensagemErro}
          </div>
        ) : null}

        <form onSubmit={criarEvento} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-bold text-blue-900">Titulo</label>
            <input
              type="text"
              placeholder="Ex: Brazuca 2026"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="ui-field"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-blue-900">Descricao do evento</label>
            <textarea
              placeholder="Descreva o evento, atracoes, regras e informacoes importantes."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="ui-field h-36"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
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
              placeholder="Ex: Caza Brava"
              value={localEvento}
              onChange={(e) => setLocalEvento(e.target.value)}
              className="ui-field"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-blue-900">Link do Google Maps</label>
            <input
              type="url"
              placeholder="Cole aqui o link do Google Maps"
              value={mapsUrl}
              onChange={(e) => setMapsUrl(e.target.value)}
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
              onChange={(e) => setBanner(e.target.files?.[0] || null)}
              className="ui-field"
            />
          </div>

          <button
            type="submit"
            disabled={salvando}
            className="w-full rounded-2xl bg-blue-600 px-6 py-4 text-base font-extrabold text-white transition hover:bg-blue-500 disabled:bg-slate-300 min-h-11"
          >
            {salvando ? "CRIANDO..." : "CRIAR EVENTO"}
          </button>
        </form>
      </div>
    </AdminShell>
  );
}
