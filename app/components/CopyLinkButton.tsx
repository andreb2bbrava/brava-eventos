"use client";

import { useEffect, useRef, useState } from "react";

type CopyLinkButtonProps = {
  link: string | (() => string);
  idleLabel?: string;
  copiedLabel?: string;
  className?: string;
  toastDurationMs?: number;
};

export default function CopyLinkButton({
  link,
  idleLabel = "Copiar Link",
  copiedLabel = "Copiado ✓",
  className,
  toastDurationMs = 2400,
}: CopyLinkButtonProps) {
  const [copiado, setCopiado] = useState(false);
  const [toastMensagem, setToastMensagem] = useState("");
  const [toastErro, setToastErro] = useState(false);
  const timerBotaoRef = useRef<number | null>(null);
  const timerToastRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerBotaoRef.current) {
        window.clearTimeout(timerBotaoRef.current);
      }

      if (timerToastRef.current) {
        window.clearTimeout(timerToastRef.current);
      }
    };
  }, []);

  async function copiarLink() {
    if (timerBotaoRef.current) {
      window.clearTimeout(timerBotaoRef.current);
    }

    if (timerToastRef.current) {
      window.clearTimeout(timerToastRef.current);
    }

    try {
      const linkResolvido = typeof link === "function" ? link() : link;
      await navigator.clipboard.writeText(linkResolvido);

      setCopiado(true);
      setToastErro(false);
      setToastMensagem("Link copiado com sucesso!");

      timerBotaoRef.current = window.setTimeout(() => {
        setCopiado(false);
      }, 2000);
    } catch (error) {
      console.error("Erro ao copiar link:", error);
      setCopiado(false);
      setToastErro(true);
      setToastMensagem("Não foi possível copiar o link. Tente novamente.");
    }

    timerToastRef.current = window.setTimeout(() => {
      setToastMensagem("");
      setToastErro(false);
    }, toastDurationMs);
  }

  return (
    <>
      <button type="button" onClick={() => void copiarLink()} className={className}>
        {copiado ? copiedLabel : idleLabel}
      </button>

      {toastMensagem ? (
        <div
          aria-live="polite"
          role={toastErro ? "alert" : "status"}
          className={`pointer-events-none fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
            toastErro ? "bg-red-600" : "bg-emerald-600"
          }`}
        >
          {toastMensagem}
        </div>
      ) : null}
    </>
  );
}