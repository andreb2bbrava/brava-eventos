export type SupabaseLikeError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
} | null;

export function normalizarNomeParticipante(valor: string | null | undefined) {
  return String(valor ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function extrairNomesUnicosPorLinha(texto: string) {
  const nomesOriginais: string[] = [];
  const nomesNormalizados = new Set<string>();

  texto
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .forEach((nomeLinha) => {
      const nomeNormalizado = normalizarNomeParticipante(nomeLinha);

      if (!nomeNormalizado || nomesNormalizados.has(nomeNormalizado)) {
        return;
      }

      nomesNormalizados.add(nomeNormalizado);
      nomesOriginais.push(nomeLinha);
    });

  return nomesOriginais;
}

export function erroEhDuplicidadeParticipante(error: SupabaseLikeError) {
  if (!error) {
    return false;
  }

  if (error.code === "23505") {
    return true;
  }

  const texto = `${error.message || ""} ${error.details || ""}`.toLowerCase();
  return texto.includes("duplicate key value") && texto.includes("unique constraint");
}

export function mensagemDuplicidadeEvento(nome: string, regraLista?: string | null) {
  const nomeAjustado = nome.trim() || "Este nome";
  const regra = (regraLista || "").trim();

  if (!regra) {
    return "Este nome já está cadastrado neste evento.";
  }

  return `${nomeAjustado} já está cadastrado neste evento com a regra: ${regra}.`;
}
