"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useState,
} from "react";

type EventoPedido = {
  id: number;
  nome: string;
  slug: string;
  data_evento: string | null;
  hora_evento: string | null;
  local_evento: string | null;
  inicio_evento: string | null;
};

type ItemPedido = {
  id: number;
  tipoIngressoId: number;
  loteId: number;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  tipoIngresso: {
    id: number;
    nome: string;
  };
  lote: {
    id: number;
    nome: string;
  };
};

type Pedido = {
  id: number;
  codigo: string;
  eventoId: number;
  comprador: {
    nome: string;
    email: string;
    cpf: string | null;
    telefone: string | null;
  };
  subtotal: number;
  taxa: number;
  total: number;
  status: string;
  formaPagamento: string | null;
  pagoEm: string | null;
  createdAt: string;
  quantidade: number;
  evento: EventoPedido;
  itens: ItemPedido[];
};

type RespostaPedido = {
  pedido?: Pedido;
  error?: string;
};

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarData(evento: EventoPedido) {
  if (evento.inicio_evento) {
    const data = new Date(evento.inicio_evento);

    if (!Number.isNaN(data.getTime())) {
      return data.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    }
  }

  return evento.data_evento || "Data a definir";
}

function CarregandoPedido() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-900">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

        <p className="mt-4 font-bold text-slate-600">
          Carregando pedido...
        </p>
      </div>
    </main>
  );
}

function PedidoConfirmadoContent() {
  const searchParams = useSearchParams();

  const pedidoId = searchParams.get("pedido")?.trim() || "";
  const codigo = searchParams.get("codigo")?.trim() || "";

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarPedido() {
      setCarregando(true);
      setErro("");

      if (!pedidoId || !codigo) {
        if (ativo) {
          setErro("Pedido não informado.");
          setCarregando(false);
        }

        return;
      }

      try {
        const resposta = await fetch(
          `/api/tiketeira/pedidos/${encodeURIComponent(
            pedidoId
          )}?codigo=${encodeURIComponent(codigo)}`,
          {
            cache: "no-store",
          }
        );

        const dados = (await resposta.json()) as RespostaPedido;

        if (!resposta.ok || !dados.pedido) {
          throw new Error(
            dados.error || "Não foi possível consultar o pedido."
          );
        }

        if (ativo) {
          setPedido(dados.pedido);
        }
      } catch (error) {
        console.error("Erro ao consultar pedido:", error);

        if (ativo) {
          setPedido(null);
          setErro(
            error instanceof Error
              ? error.message
              : "Não foi possível consultar o pedido."
          );
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    carregarPedido();

    return () => {
      ativo = false;
    };
  }, [pedidoId, codigo]);

  if (carregando) {
    return <CarregandoPedido />;
  }

  if (erro || !pedido) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl">
            ⚠️
          </div>

          <h1 className="mt-5 text-3xl font-black text-slate-950">
            Pedido não encontrado
          </h1>

          <p className="mt-3 text-slate-500">
            {erro || "Não foi possível localizar este pedido."}
          </p>

          <Link
            href="/"
            className="mt-7 inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-6 font-black text-white transition hover:bg-blue-500"
          >
            Voltar para eventos
          </Link>
        </div>
      </main>
    );
  }

  const primeiroNome =
    pedido.comprador.nome.split(" ")[0] || "Comprador";

  const pedidoPago = pedido.status === "pago";

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

              <p className="font-black text-slate-950">
                Ingressos
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-2 text-sm font-bold sm:flex">
            <span className="text-slate-400">
              1. Ingressos
            </span>

            <span className="text-slate-300">→</span>

            <span className="text-slate-400">
              2. Identificação
            </span>

            <span className="text-slate-300">→</span>

            <span className="text-blue-600">
              3. Pedido
            </span>
          </div>
        </div>
      </header>

      <section className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-10 text-center sm:px-6 sm:py-14">
          <div
            className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-4xl text-white shadow-lg ${
              pedidoPago
                ? "bg-emerald-500 shadow-emerald-950/30"
                : "bg-blue-600 shadow-blue-950/30"
            }`}
          >
            {pedidoPago ? "✓" : "⌛"}
          </div>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-blue-400">
            {pedidoPago ? "Pagamento confirmado" : "Pedido criado"}
          </p>

          <h1 className="mt-3 text-3xl font-black text-white sm:text-5xl">
            {pedidoPago
              ? `Tudo certo, ${primeiroNome}!`
              : `Pedido recebido, ${primeiroNome}!`}
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
            {pedidoPago
              ? "Seu pagamento foi confirmado."
              : "Seu pedido foi registrado com sucesso. Agora falta a confirmação do pagamento para liberar os ingressos."}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                  Resumo do pedido
                </p>

                <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
                  {pedido.evento.nome}
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  {formatarData(pedido.evento)}
                  {" • "}
                  {pedido.evento.local_evento || "Local a definir"}
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Código do pedido:{" "}
                  <span className="font-black text-slate-700">
                    {pedido.codigo}
                  </span>
                </p>
              </div>

              {pedidoPago ? (
                <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
                  ✓ Pagamento confirmado
                </div>
              ) : (
                <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-black text-amber-700">
                  ⏳ Aguardando pagamento
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Comprador
              </p>

              <p className="mt-2 text-lg font-black text-slate-950">
                {pedido.comprador.nome}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {pedido.comprador.email}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Ingressos
              </p>

              <p className="mt-2 text-lg font-black text-slate-950">
                {pedido.quantidade} ingresso
                {pedido.quantidade !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Pedido
              </p>

              <p className="mt-2 text-lg font-black text-slate-950">
                #{pedido.id}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                Forma de pagamento
              </p>

              <p className="mt-2 text-lg font-black uppercase text-slate-950">
                {pedido.formaPagamento || "—"}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 px-6 py-6 sm:px-8">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Itens do pedido
            </p>

            <div className="mt-4 space-y-3">
              {pedido.itens.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4"
                >
                  <div>
                    <p className="font-black text-slate-950">
                      {item.tipoIngresso.nome}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {item.lote.nome} • {item.quantidade} ×{" "}
                      {moeda(item.valorUnitario)}
                    </p>
                  </div>

                  <p className="font-black text-slate-950">
                    {moeda(item.valorTotal)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 px-6 py-6 sm:px-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-500">
                  Valor do pedido
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  {pedidoPago
                    ? "Pagamento confirmado"
                    : "Pagamento pendente via PIX"}
                </p>
              </div>

              <p className="text-3xl font-black text-slate-950">
                {moeda(pedido.total)}
              </p>
            </div>
          </div>
        </div>

        {!pedidoPago ? (
          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-xl text-white">
                ⏳
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-950">
                  Aguardando pagamento
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Seu pedido já está registrado. Os ingressos serão liberados
                  somente depois que o pagamento for confirmado.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-xl text-white">
                🎟️
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-950">
                  Pagamento confirmado
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  O pagamento deste pedido foi confirmado.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-blue-600 px-7 font-black text-white transition hover:bg-blue-500"
          >
            Voltar para eventos
          </Link>

          <Link
            href={`/ingressos/${pedido.evento.slug}`}
            className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-slate-300 bg-white px-7 font-black text-slate-700 transition hover:bg-slate-50"
          >
            Ver evento
          </Link>
        </div>

        <div className="mt-8 text-center text-xs font-semibold text-slate-400">
          🔒 Ambiente seguro • Brava Ingressos
        </div>
      </section>
    </main>
  );
}

export default function PedidoConfirmadoPage() {
  return (
    <Suspense fallback={<CarregandoPedido />}>
      <PedidoConfirmadoContent />
    </Suspense>
  );
}