export function nomeFallbackPorEmail(email: string | null | undefined) {
  const base = (email || "").split("@")[0]?.trim() || "";
  if (!base) {
    return "Usuario Brava";
  }

  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function primeiroNome(valor: string | null | undefined) {
  const nome = (valor || "").trim();
  if (!nome) {
    return "";
  }

  return nome.split(/\s+/)[0] || "";
}

export function resolverNomeExibicaoUsuario(params: {
  nome?: string | null;
  email?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const nomeBanco = (params.nome || "").trim();
  if (nomeBanco) {
    return nomeBanco;
  }

  const fullName = typeof params.metadata?.full_name === "string" ? params.metadata.full_name.trim() : "";
  if (fullName) {
    return fullName;
  }

  const firstName = typeof params.metadata?.first_name === "string" ? params.metadata.first_name.trim() : "";
  if (firstName) {
    return firstName;
  }

  return nomeFallbackPorEmail(params.email);
}
