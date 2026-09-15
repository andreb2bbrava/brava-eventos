"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

const tipos = [
  { chave: "pista", nome: "Pista", lote: "1º Lote", preco: 50 },
  { chave: "vip", nome: "Área VIP", lote: "1º Lote", preco: 90 },
  { chave: "camarote", nome: "Camarote Brava", lote: "1º Lote", preco: 150 },
] as const;

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function quantidadeSegura(valor: string | null) {
  const numero = Number(valor || 0);
  if (!Number.isFinite(numero)) return 0;
  return Math.max(0, Math.min(10, Math.trunc(numero)));
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const slug =
    typeof params.slug === "string" ? params.slug : "brava-stage-festival";

  const itens = useMemo(
    () =>
      tipos
        .map((tipo) => ({
          ...tipo,
          quantidade: quantidadeSegura(searchParams.get(tipo.chave)),
        }))
        .filter((item) => item.quantidade > 0),
    [searchParams]
  );

  const quantidadeTotal = useMemo(
    () => itens.reduce((total, item) => total + item.quantidade, 0),
    [itens]
  );

  const subtotal = useMemo(
    () =>
      itens.reduce(
        (total, item) => total + item.preco * item.quantidade,
        0
      ),
    [itens]
  );

  const taxaServico = 0;
  const total = subtotal + taxaServico;

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [celular, setCelular] = useState("");
  const [aceitou, setAceitou] = useState(false);

  function finalizar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!nome.trim() || !email.trim() || !cpf.trim() || !celular.trim() || !aceitou) {
      return;
    }

    const query = new URLSearchParams({
      evento: slug,
      ingressos: String(quantidadeTotal),
      total: total.toFixed(2),
      nome: nome.trim(),
    });

    router.push(`/pedido/confirmado?${query.toString()}`);
  }

  if (itens.length === 0) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-16 text-slate-900">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl">
            🎟️
          </div>
          <h1 className="mt-5 text-3xl font-black text-slate-950">
            Nenhum ingresso selecionado
          </h1>
          <p className="mt-3 text-slate-500">
            Volte ao evento e escolha pelo menos um ingresso para continuar.
          </p>
          <Link
            href={`/ingressos/${slug}`}
            className="mt-7 inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-6 font-black text-white transition hover:bg-blue-500"
          >
            Escolher ingressos
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Brava"
              className="h-10 w-10 rounded-xl object-contain"
            />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
                Brava
              </p>
              <p className="font-black text-slate-950">Ingressos</p>
            </div>
          </Link>

          <div className="hidden items-center gap-2 text-sm font-bold text-slate-500 sm:flex">
            <span className="text-blue-700">1. Ingressos</span>
            <span>→</span>
            <span className="text-blue-700">2. Identificação</span>
            <span>→</span>
            <span>3. Pagamento</span>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <Link
            href={`/ingressos/${slug}`}
            className="text-sm font-bold text-blue-300 transition hover:text-white"
          >
            ← Voltar para ingressos
          </Link>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-blue-400">
            Finalizar compra
          </p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
            Brava Stage Festival
          </h1>
          <p className="mt-2 text-slate-400">
            12 de setembro de 2026 • Vitória - ES
          </p>
        </div>
      </section>

      <form
        onSubmit={finalizar}
        className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_380px]"
      >
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 font-black text-blue-700">
                1
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                  Comprador
                </p>
                <h2 className="text-2xl font-black text-slate-950">
                  Seus dados
                </h2>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-500">
              Informe os dados do responsável pela compra. Os ingressos digitais
              serão vinculados a este pedido.
            </p>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Nome completo
                </span>
                <input
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Digite seu nome completo"
                  className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  CPF
                </span>
                <input
                  required
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  Celular
                </span>
                <input
                  required
                  value={celular}
                  onChange={(e) => setCelular(e.target.value)}
                  placeholder="(27) 99999-9999"
                  inputMode="tel"
                  className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  E-mail
                </span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 font-black text-blue-700">
                2
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                  Pagamento
                </p>
                <h2 className="text-2xl font-black text-slate-950">
                  Forma de pagamento
                </h2>
              </div>
            </div>

            <div className="mt-7 rounded-2xl border-2 border-blue-600 bg-blue-50 p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                  ◈
                </div>
                <div className="flex-1">
                  <p className="font-black text-slate-950">PIX</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Aprovação rápida após a confirmação do pagamento.
                  </p>
                </div>
                <div className="h-5 w-5 rounded-full border-[6px] border-blue-600 bg-white" />
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              Demonstração da jornada de checkout. A integração com o gateway de
              pagamento será conectada na etapa de pagamentos da Tiketeira.
            </div>
          </section>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <input
              type="checkbox"
              checked={aceitou}
              onChange={(e) => setAceitou(e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <span className="text-sm leading-relaxed text-slate-600">
              Confirmo que os dados informados estão corretos e concordo com os
              termos da plataforma para prosseguir com este pedido.
            </span>
          </label>
        </div>

        <aside>
          <div className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Seu pedido
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Resumo da compra
            </h2>

            <div className="mt-6 space-y-4">
              {itens.map((item) => (
                <div
                  key={item.chave}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-black text-slate-900">{item.nome}</p>
                      <p className="mt-1 text-xs font-bold text-blue-700">
                        {item.lote}
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        {item.quantidade} × {moeda(item.preco)}
                      </p>
                    </div>
                    <p className="font-black text-slate-950">
                      {moeda(item.quantidade * item.preco)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3 border-y border-slate-200 py-5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">
                  {quantidadeTotal} ingresso{quantidadeTotal !== 1 ? "s" : ""}
                </span>
                <span className="font-bold">{moeda(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Taxa de serviço</span>
                <span className="font-bold text-emerald-600">
                  {taxaServico === 0 ? "R$ 0,00" : moeda(taxaServico)}
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-end justify-between">
              <span className="font-bold text-slate-600">Total</span>
              <span className="text-3xl font-black text-slate-950">
                {moeda(total)}
              </span>
            </div>

            <button
              type="submit"
              disabled={!aceitou}
              className="mt-6 min-h-14 w-full rounded-2xl bg-blue-600 px-5 font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Gerar pedido demonstrativo
            </button>

            <div className="mt-5 text-center text-xs font-semibold text-slate-400">
              🔒 Ambiente seguro • Brava Ingressos
            </div>
          </div>
        </aside>
      </form>
    </main>
  );
}
