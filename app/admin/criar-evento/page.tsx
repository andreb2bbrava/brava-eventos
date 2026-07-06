"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function CriarEventoPage() {

  const [nome, setNome] =
    useState("");

  const [dataEvento,
    setDataEvento] =
    useState("");

  const [horaEvento,
    setHoraEvento] =
    useState("");

  const [localEvento,
    setLocalEvento] =
    useState("");

  const [mapsUrl,
    setMapsUrl] =
    useState("");

  const [banner,
    setBanner] =
    useState<File | null>(null);

  const [bannerPosicao,
    setBannerPosicao] =
    useState("center");

  const [tipoLista,
    setTipoLista] =
    useState("simples");

  const [acessoNegado, setAcessoNegado] =
    useState(false);

  const router = useRouter();

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

      if (!usuarioData || (usuarioData.role !== "super_admin" && usuarioData.role !== "produtor")) {
        setAcessoNegado(true);
        return;
      }

      setAcessoNegado(false);
    }

    verificarPermissao();
  }, [router]);

  async function criarEvento(
    e: React.FormEvent
  ) {

    e.preventDefault();

    if (!banner) {

      alert(
        "Selecione um banner."
      );

      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {

      alert(
        "Usuário não autenticado."
      );

      return;
    }

    const slug =
      nome
        .toLowerCase()
        .replaceAll(" ", "-");

    const nomeArquivo =
      `${Date.now()}-${banner.name}`;

    const { error: erroUpload } =
      await supabase.storage
        .from("banners")
        .upload(
          nomeArquivo,
          banner
        );

    if (erroUpload) {

      console.log(
        erroUpload
      );

      alert(
        "Erro ao subir banner."
      );

      return;
    }

    const { data } =
      supabase.storage
        .from("banners")
        .getPublicUrl(
          nomeArquivo
        );

    const bannerUrl =
      data.publicUrl;

    const { error } =
      await supabase
        .from("eventos")
        .insert([

          {
            nome,

            slug,

            criador_id:
              user.id,

            data_evento:
              dataEvento,

            hora_evento:
              horaEvento,

            local_evento:
              localEvento,

            maps_url:
              mapsUrl,

            banner_url:
              bannerUrl,

            banner_posicao:
              bannerPosicao,

            tipo_lista:
              tipoLista,
          },

        ]);

    if (error) {

      console.log(error);

      alert(
        "Erro ao criar evento"
      );

      return;
    }

    alert(
      "Evento criado com sucesso!"
    );

    setNome("");

    setDataEvento("");

    setHoraEvento("");

    setLocalEvento("");

    setMapsUrl("");

    setBanner(null);

    setBannerPosicao(
      "center"
    );

    setTipoLista(
      "simples"
    );
  }

  if (acessoNegado) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-6">
        <div className="text-center max-w-xl">
          <h1 className="text-3xl font-bold">Acesso negado</h1>
          <p className="mt-3 text-slate-600">
            Seu perfil permite apenas acesso de check-in para eventos.
          </p>
        </div>
      </main>
    );
  }

  return (

    <main className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 overflow-x-hidden">

      <div className="max-w-2xl mx-auto bg-white border border-blue-100 rounded-3xl p-5 sm:p-8 shadow-sm">

        <h1 className="text-3xl sm:text-5xl font-extrabold text-blue-900 text-center mb-6 sm:mb-8 break-words">
          Criar Evento
        </h1>

        <form
          onSubmit={
            criarEvento
          }
          className="space-y-5"
        >

          <input
            type="text"
            placeholder="Nome do Evento"
            value={nome}
            onChange={(e) =>
              setNome(
                e.target.value
              )
            }
            className="w-full p-4 rounded-xl bg-white text-slate-900 border border-slate-200 text-base"
          />

          <input
            type="date"
            value={dataEvento}
            onChange={(e) =>
              setDataEvento(
                e.target.value
              )
            }
            className="w-full p-4 rounded-xl bg-white text-slate-900 border border-slate-200 text-base"
          />

          <input
            type="time"
            value={horaEvento}
            onChange={(e) =>
              setHoraEvento(
                e.target.value
              )
            }
            className="w-full p-4 rounded-xl bg-white text-slate-900 border border-slate-200 text-base"
          />

          <input
            type="text"
            placeholder="Local do Evento"
            value={localEvento}
            onChange={(e) =>
              setLocalEvento(
                e.target.value
              )
            }
            className="w-full p-4 rounded-xl bg-white text-slate-900 border border-slate-200 text-base"
          />

          <input
            type="text"
            placeholder="Link Google Maps"
            value={mapsUrl}
            onChange={(e) =>
              setMapsUrl(
                e.target.value
              )
            }
            className="w-full p-4 rounded-xl bg-white text-slate-900 border border-slate-200 text-base"
          />

          <div>

            <p className="mb-3 text-blue-900 font-semibold">
              Tipo de Lista
            </p>

            <select
              value={tipoLista}
              onChange={(e) =>
                setTipoLista(
                  e.target.value
                )
              }
              className="w-full p-4 rounded-xl bg-white text-slate-900 border border-slate-200 text-base"
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

            <p className="mb-3 text-blue-900 font-semibold">
              Banner do Evento
            </p>

            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setBanner(
                  e.target.files?.[0] ||
                    null
                )
              }
              className="w-full p-4 rounded-xl bg-white text-slate-900 border border-slate-200 text-base"
            />

          </div>

          <div>

            <p className="mb-3 text-blue-900 font-semibold">
              Posição do Banner
            </p>

            <select
              value={
                bannerPosicao
              }
              onChange={(e) =>
                setBannerPosicao(
                  e.target.value
                )
              }
              className="w-full p-4 rounded-xl bg-white text-slate-900 border border-slate-200 text-base"
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

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white transition p-4 sm:p-5 rounded-xl font-extrabold text-base sm:text-lg min-h-11"
          >
            CRIAR EVENTO 🚀
          </button>

        </form>

      </div>

    </main>
  );
}