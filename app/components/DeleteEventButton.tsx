"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SupabaseErrorShape = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

type DeleteEventButtonProps = {
  eventoId: number;
  eventoNome: string;
  canDelete: boolean;
  redirectToAdmin?: boolean;
  onDeleted?: () => void | Promise<void>;
  className?: string;
  buttonLabel?: string;
  title?: string;
};

type EventoAntesExclusao = {
  id: number;
  nome: string;
  banner_url: string | null;
};

function logSupabaseError(contexto: string, error: SupabaseErrorShape | null) {
  console.error(`ERRO BRUTO ${contexto}:`, error);
  console.error("MESSAGE:", error?.message);
  console.error("DETAILS:", error?.details);
  console.error("HINT:", error?.hint);
  console.error("CODE:", error?.code);
  console.error("JSON:", JSON.stringify(error, null, 2));
}

function extrairCaminhoBanner(bannerUrl: string | null) {
  if (!bannerUrl) {
    return null;
  }

  const marcador = "/storage/v1/object/public/banners/";
  const indice = bannerUrl.indexOf(marcador);

  if (indice < 0) {
    return null;
  }

  const caminhoBruto = bannerUrl.slice(indice + marcador.length).trim();

  if (!caminhoBruto) {
    return null;
  }

  return decodeURIComponent(caminhoBruto);
}

export default function DeleteEventButton({
  eventoId,
  eventoNome,
  canDelete,
  redirectToAdmin = false,
  onDeleted,
  className,
  buttonLabel = "Excluir Evento",
  title = "Excluir evento definitivamente?",
}: DeleteEventButtonProps) {
  const router = useRouter();
  const [modalAberto, setModalAberto] = useState(false);
  const [confirmacaoNome, setConfirmacaoNome] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState("");

  const nomeCorresponde = useMemo(() => confirmacaoNome === eventoNome, [confirmacaoNome, eventoNome]);

  if (!canDelete) {
    return null;
  }

  async function excluirEventoConfirmado() {
    if (!nomeCorresponde || excluindo) {
      return;
    }

    setExcluindo(true);
    setErro("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const usuarioId = user?.id || null;

    let role: string | null = null;

    if (usuarioId) {
      const { data: usuarioData } = await supabase
        .from("usuarios")
        .select("role")
        .eq("id", usuarioId)
        .maybeSingle();

      role = usuarioData?.role || null;
    }

    console.log("TENTANDO EXCLUIR EVENTO:", {
      eventoId,
      usuarioId,
      role,
    });

    const { data: eventoAntes, error: erroBusca } = await supabase
      .from("eventos")
      .select("id, nome, banner_url")
      .eq("id", eventoId)
      .maybeSingle();

    if (erroBusca) {
      logSupabaseError("BUSCAR EVENTO ANTES DE EXCLUIR", erroBusca);
      setErro("Não foi possível excluir o evento.");
      setExcluindo(false);
      return;
    }

    if (!eventoAntes) {
      setErro("Evento não encontrado.");
      setExcluindo(false);
      return;
    }

    const { error: erroExclusao, count } = await supabase.from("eventos").delete({ count: "exact" }).eq("id", eventoId);

    if (erroExclusao) {
      logSupabaseError("EXCLUIR EVENTO", erroExclusao);
      setErro("Não foi possível excluir o evento.");
      setExcluindo(false);
      return;
    }

    if (count === 0) {
      const { data: eventoDepois, error: erroVerificacao } = await supabase
        .from("eventos")
        .select("id")
        .eq("id", eventoId)
        .maybeSingle();

      if (erroVerificacao) {
        logSupabaseError("VERIFICAR EVENTO APOS DELETE", erroVerificacao);
        setErro("Não foi possível excluir o evento.");
        setExcluindo(false);
        return;
      }

      if (eventoDepois) {
        console.error("DELETE bloqueado por RLS ou policy.", {
          eventoId,
          usuarioId,
          role,
        });
        setErro("Você não possui permissão para excluir este evento.");
        setExcluindo(false);
        return;
      }

      console.log("DELETE sem retorno explícito, mas evento não existe mais.", {
        eventoId,
        usuarioId,
        role,
      });
    }

    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("evento_excluido_feedback", "Evento excluído com sucesso.");
      }
    } catch (storageWriteError) {
      console.warn("Falha ao salvar feedback de exclusao em sessionStorage:", storageWriteError);
    }

    const bannerPath = extrairCaminhoBanner((eventoAntes as EventoAntesExclusao | null)?.banner_url || null);

    if (bannerPath) {
      const { error: storageError } = await supabase.storage.from("banners").remove([bannerPath]);

      if (storageError) {
        logSupabaseError("LIMPEZA STORAGE BANNER EVENTO", storageError);
      }
    }

    if (onDeleted) {
      await onDeleted();
    }

    setExcluindo(false);
    setModalAberto(false);

    if (redirectToAdmin) {
      router.push("/admin");
      router.refresh();
      return;
    }

    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setConfirmacaoNome("");
          setErro("");
          setModalAberto(true);
        }}
        className={
          className ||
          "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-400"
        }
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M9 3.5h6a1 1 0 0 1 1 1V6h4v2h-1v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8H4V6h4V4.5a1 1 0 0 1 1-1Zm1 2V6h4V5.5h-4ZM7 8v11h10V8H7Zm2 2h2v7H9v-7Zm4 0h2v7h-2v-7Z" />
        </svg>
        <span>{buttonLabel}</span>
      </button>

      {modalAberto ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-red-200 bg-white p-5 shadow-2xl sm:p-6">
            <h2 className="text-2xl font-extrabold text-red-700">{title}</h2>

            <p className="mt-3 text-sm text-slate-700">
              Esta ação removerá permanentemente:
            </p>

            <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-slate-700">
              <li>evento</li>
              <li>listas</li>
              <li>participantes</li>
              <li>check-ins</li>
              <li>vínculos de produtores</li>
            </ul>

            <p className="mt-3 text-sm text-slate-700">Esta ação não poderá ser desfeita.</p>

            <p className="mt-3 text-sm text-slate-700">
              Evento: <span className="font-extrabold text-slate-900">{eventoNome}</span>
            </p>

            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">Digite exatamente para confirmar:</p>
              <p className="mt-1 break-words text-base font-extrabold text-red-800">{eventoNome}</p>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Confirmação do nome do evento</label>
              <input
                type="text"
                value={confirmacaoNome}
                onChange={(event) => setConfirmacaoNome(event.target.value)}
                placeholder="Digite o nome exato do evento"
                className="ui-field"
                autoFocus
              />
            </div>

            {erro ? <p className="mt-4 text-sm font-semibold text-red-600">{erro}</p> : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (excluindo) {
                    return;
                  }

                  setModalAberto(false);
                  setConfirmacaoNome("");
                  setErro("");
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={!nomeCorresponde || excluindo}
                onClick={() => void excluirEventoConfirmado()}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-red-600 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {excluindo ? "Excluindo..." : "Excluir definitivamente"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
