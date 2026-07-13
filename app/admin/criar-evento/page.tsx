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

    if (!nome.trim()) {
      alert("Preencha o titulo do evento.");
      return;
    }

    if (!inicioEvento) {
      alert("Informe o inicio do evento.");
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

    const slug = await gerarSlugUnicoEvento({
      supabase,
      titulo: nome,
    });

    if (!slug) {
      alert("Nao foi possivel gerar o link do evento. Verifique o titulo.");
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
        console.log(erroUpload);
        alert("Erro ao subir banner.");
        setSalvando(false);
        return;
      }

      const { data } = supabase.storage.from("banners").getPublicUrl(nomeArquivo);
      bannerUrl = data.publicUrl;
    }

    const inicio = separarDataHora(inicioEvento);
    const termino = separarDataHora(terminoEvento);

    const payload = {
      nome: nome.trim(),
      slug,
      criador_id: user.id,
      descricao: descricao.trim() || null,
      inicio_evento: inicioEvento ? new Date(inicioEvento).toISOString() : null,
      termino_evento: terminoEvento ? new Date(terminoEvento).toISOString() : null,
      data_evento: inicio.data || null,
      hora_evento: inicio.hora || null,
      local_evento: localEvento.trim() || null,
      maps_url: mapsUrl.trim() || null,
      banner_url: bannerUrl,
    };

    const { error } = await supabase.from("eventos").insert([payload]);

    if (error) {
      console.log(error);
      alert("Erro ao criar evento.");
      setSalvando(false);
      return;
    }

    setMensagemSucesso("Evento criado com sucesso. Agora crie suas listas.");
    router.push(`/admin/eventos/${slug}?criado=1`);
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

        <form onSubmit={criarEvento} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-bold text-blue-900">Titulo</label>
            <input
              type="text"
              placeholder="Ex: Brazuca 2026"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-900"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-blue-900">Descricao do evento</label>
            <textarea
              placeholder="Descreva o evento, atracoes, regras e informacoes importantes."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="h-36 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-900"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-blue-900">Inicio do evento</label>
              <input
                type="datetime-local"
                value={inicioEvento}
                onChange={(e) => setInicioEvento(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-blue-900">Termino do evento</label>
              <input
                type="datetime-local"
                value={terminoEvento}
                onChange={(e) => setTerminoEvento(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-900"
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
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-900"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-blue-900">Link do Google Maps</label>
            <input
              type="url"
              placeholder="Cole aqui o link do Google Maps"
              value={mapsUrl}
              onChange={(e) => setMapsUrl(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-900"
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
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-slate-900"
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
