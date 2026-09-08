import Link from "next/link";

const eventosMock = [
  {
    id: 1,
    nome: "Brava Stage Festival",
    data: "12 SET",
    local: "Vitória - ES",
    preco: "A partir de R$ 50",
    imagem:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: 2,
    nome: "Samba In Caza",
    data: "20 SET",
    local: "Vila Velha - ES",
    preco: "A partir de R$ 45",
    imagem:
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: 3,
    nome: "Baile da Favorita",
    data: "04 OUT",
    local: "Serra - ES",
    preco: "A partir de R$ 60",
    imagem:
      "https://images.unsplash.com/photo-1521337581100-8ca9a73a5f79?auto=format&fit=crop&w=1200&q=80",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Brava Eventos"
              className="h-11 w-11 rounded-xl object-contain"
            />

            <div className="leading-tight">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">
                Brava
              </p>
              <p className="text-lg font-black text-slate-950">Ingressos</p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-700 md:flex">
            <Link href="/" className="transition hover:text-blue-600">
              Eventos
            </Link>

            <Link href="/listas" className="transition hover:text-blue-600">
              Listas
            </Link>

            <Link href="/acessar" className="transition hover:text-blue-600">
              Área Administrativa
            </Link>
          </nav>

          <Link
            href="/listas"
            className="rounded-xl border border-blue-600 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50 md:hidden"
          >
            Listas
          </Link>
        </div>
      </header>

      <section className="bg-slate-950">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 md:items-center md:py-20">
          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.24em] text-blue-400">
              Brava Entretenimento
            </p>

            <h1 className="max-w-xl text-4xl font-black leading-tight text-white sm:text-5xl md:text-6xl">
              Viva o evento.
              <span className="block text-blue-400">Comece pelo ingresso.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Encontre os melhores eventos, compre seus ingressos e acompanhe tudo
              em um só lugar.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="#eventos"
                className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-6 py-4 font-extrabold text-white transition hover:bg-blue-500"
              >
                Explorar eventos
              </Link>

              <Link
                href="/listas"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-700 px-6 py-4 font-extrabold text-white transition hover:bg-slate-900"
              >
                Ver listas
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
            <img
              src="https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=1400&q=85"
              alt="Evento em destaque"
              className="h-[320px] w-full object-cover sm:h-[420px]"
            />

            <div className="p-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
                Em destaque
              </p>

              <h2 className="mt-2 text-2xl font-black text-white">
                Brava Stage Festival
              </h2>

              <p className="mt-2 text-sm text-slate-300">
                Vitória • 12 de setembro
              </p>

              <Link
                href="#eventos"
                className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950"
              >
                Comprar ingresso
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="-mt-6 relative z-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-xl sm:p-5">
            <label
              htmlFor="busca"
              className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-slate-500"
            >
              Pesquisar eventos
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="busca"
                type="text"
                placeholder="Qual evento você procura?"
                className="min-h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
              />

              <button
                type="button"
                className="min-h-12 rounded-2xl bg-blue-600 px-6 font-extrabold text-white transition hover:bg-blue-500"
              >
                Buscar
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="eventos" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-700">
              Próximos eventos
            </p>

            <h2 className="mt-2 text-3xl font-black text-slate-950">
              Eventos em destaque
            </h2>
          </div>

          <Link
            href="/eventos"
            className="hidden text-sm font-bold text-blue-700 hover:text-blue-500 sm:block"
          >
            Ver todos
          </Link>
        </div>

        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {eventosMock.map((evento) => (
            <article
              key={evento.id}
              className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="relative overflow-hidden">
                <img
                  src={evento.imagem}
                  alt={evento.nome}
                  className="h-52 w-full object-cover transition duration-500 group-hover:scale-105"
                />

                <div className="absolute left-4 top-4 rounded-2xl bg-white px-3 py-2 text-center shadow-lg">
                  <span className="block text-xs font-black text-blue-700">
                    {evento.data.split(" ")[1]}
                  </span>
                  <span className="block text-xl font-black text-slate-950">
                    {evento.data.split(" ")[0]}
                  </span>
                </div>

                <div className="absolute right-4 top-4 rounded-full bg-slate-950/85 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                  🎟️ Ingressos
                </div>
              </div>

              <div className="p-6">
                <p className="text-sm font-semibold text-slate-500">
                  {evento.local}
                </p>

                <h3 className="mt-2 text-2xl font-black text-slate-950">
                  {evento.nome}
                </h3>

                <p className="mt-4 text-sm font-bold text-blue-700">
                  {evento.preco}
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-blue-500"
                  >
                    Comprar
                  </button>

                  <Link
                    href="/listas"
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50"
                  >
                    Ver listas
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 sm:hidden">
          <Link
            href="/eventos"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700"
          >
            Ver todos os eventos
          </Link>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div>
            <p className="text-2xl font-black text-slate-950">Compra simples</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Escolha seu evento, seu ingresso e finalize em poucos passos.
            </p>
          </div>

          <div>
            <p className="text-2xl font-black text-slate-950">
              Ingresso digital
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Seu ingresso ficará disponível no celular para acesso ao evento.
            </p>
          </div>

          <div>
            <p className="text-2xl font-black text-slate-950">
              Tudo na Brava
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Ingressos, listas e gestão de eventos integrados em uma única
              plataforma.
            </p>
          </div>
        </div>
      </section>

      <footer className="bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-400 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>© 2026 Brava Entretenimento</p>

          <div className="flex flex-wrap gap-5">
            <Link href="/listas" className="hover:text-white">
              Listas
            </Link>

            <Link href="/politica-de-privacidade" className="hover:text-white">
              Privacidade
            </Link>

            <Link href="/acessar" className="hover:text-white">
              Área Administrativa
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}