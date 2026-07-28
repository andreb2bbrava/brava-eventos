"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  type MarketingConsentStatus,
  readMarketingConsentFromStorage,
  writeMarketingConsentToStorage,
} from "@/lib/metaPixel";

type MarketingConsentBannerProps = {
  onStatusChange?: (status: MarketingConsentStatus) => void;
};

export default function MarketingConsentBanner({ onStatusChange }: MarketingConsentBannerProps) {
  const [status, setStatus] = useState<MarketingConsentStatus>("unknown");

  useEffect(() => {
    const stored = readMarketingConsentFromStorage();
    setStatus(stored);
    onStatusChange?.(stored);
  }, [onStatusChange]);

  function atualizarConsentimento(nextStatus: Exclude<MarketingConsentStatus, "unknown">) {
    writeMarketingConsentToStorage(nextStatus);
    setStatus(nextStatus);
    onStatusChange?.(nextStatus);

    if (process.env.NODE_ENV !== "production") {
      if (nextStatus === "accepted") {
        console.log("[META PIXEL] Consentimento aceito");
      }
    }
  }

  if (status !== "unknown") {
    return null;
  }

  return (
    <section className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-900">Cookies de marketing</p>
          <p className="text-sm text-slate-600">
            Usamos cookies de marketing para medir acessos e cadastros nesta página. Você pode aceitar ou recusar.
          </p>
          <p className="text-xs text-slate-500">
            <Link href="/politica-de-privacidade" className="underline decoration-slate-400 underline-offset-2 hover:text-slate-700">
              Politica de Privacidade
            </Link>
            {" · "}
            <Link href="/politica-de-cookies" className="underline decoration-slate-400 underline-offset-2 hover:text-slate-700">
              Politica de Cookies
            </Link>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => atualizarConsentimento("rejected")}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={() => atualizarConsentimento("accepted")}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500"
          >
            Aceitar
          </button>
        </div>
      </div>
    </section>
  );
}
