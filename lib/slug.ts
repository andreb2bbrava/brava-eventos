import type { SupabaseClient } from "@supabase/supabase-js";

const LIMITE_SLUG = 80;

export function gerarSlugBase(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LIMITE_SLUG)
    .replace(/-+$/g, "");
}

function montarCandidato(base: string, numero: number) {
  const sufixo = numero <= 1 ? "" : `-${numero}`;
  const tamanhoBase = Math.max(1, LIMITE_SLUG - sufixo.length);
  const baseAjustada = base.slice(0, tamanhoBase).replace(/-+$/g, "");

  if (!baseAjustada) {
    return "";
  }

  return `${baseAjustada}${sufixo}`;
}

export async function gerarSlugUnicoEvento({
  supabase,
  titulo,
  eventoIdAtual,
}: {
  supabase: SupabaseClient;
  titulo: string;
  eventoIdAtual?: number | null;
}) {
  const base = gerarSlugBase(titulo || "");

  if (!base) {
    return null;
  }

  for (let numero = 1; numero <= 500; numero += 1) {
    const candidato = montarCandidato(base, numero);

    if (!candidato) {
      continue;
    }

    const { data, error } = await supabase.from("eventos").select("id").eq("slug", candidato).limit(1);

    if (error) {
      return null;
    }

    if (!data || data.length === 0) {
      return candidato;
    }

    if (eventoIdAtual && data[0]?.id === eventoIdAtual) {
      return candidato;
    }
  }

  return null;
}

export async function gerarSlugUnicoLista({
  supabase,
  titulo,
  eventoId,
  listaIdAtual,
}: {
  supabase: SupabaseClient;
  titulo: string;
  eventoId: number;
  listaIdAtual?: number | null;
}) {
  const base = gerarSlugBase(titulo || "");

  if (!base) {
    return null;
  }

  for (let numero = 1; numero <= 500; numero += 1) {
    const candidato = montarCandidato(base, numero);

    if (!candidato) {
      continue;
    }

    const { data, error } = await supabase
      .from("listas_evento")
      .select("id")
      .eq("evento_id", eventoId)
      .eq("slug", candidato)
      .limit(1);

    if (error) {
      return null;
    }

    if (!data || data.length === 0) {
      return candidato;
    }

    if (listaIdAtual && data[0]?.id === listaIdAtual) {
      return candidato;
    }
  }

  return null;
}