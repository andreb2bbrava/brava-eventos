import Link from "next/link";
import PublicEventsList from "@/app/components/PublicEventsList";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <section className="border-b border-blue-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
            <img
              src="/logo.png"
              alt="Brava Entretenimento"
              className="h-14 w-14 rounded-2xl border border-blue-100 bg-white p-1"
            />
            <div>
              <p className="text-xs sm:text-sm uppercase tracking-[0.2em] sm:tracking-[0.28em] text-blue-700 font-semibold break-words">
                Brava Entretenimento
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-blue-900 mt-2 break-words">
                Eventos disponiveis
              </h1>
              <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-2xl">
                Encontre o evento e faca sua inscricao. Acesse a area administrativa se precisar gerenciar seu evento.
              </p>
            </div>
          </div>
          <div className="w-full md:w-auto">
            <Link
              href="/acessar"
              className="inline-flex w-full md:w-auto items-center justify-center rounded-2xl bg-blue-600 px-6 py-4 text-white font-extrabold transition hover:bg-blue-500 min-h-11"
            >
              Area Administrativa
            </Link>
          </div>
        </div>
      </section>
      <PublicEventsList hideHeader />
    </div>
  );
}