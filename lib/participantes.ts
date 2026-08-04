export type SupabaseLikeError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
} | null;

export type ParticipanteIndicadoresBase = {
  sexo_estimado?: string | null;
  presente?: boolean | null;
  entrada_confirmada_em?: string | null;
};

export type IndicadoresParticipantes = {
  totalInscritos: number;
  totalPresentes: number;
  totalPendentes: number;
  porcentagemComparecimento: number;
  horarioMaisQuente: string;
  homens: number;
  mulheres: number;
  indeterminado: number;
  homensPresentes: number;
  mulheresPresentes: number;
  homensPendentes: number;
  mulheresPendentes: number;
  indeterminadosPresentes: number;
  indeterminadosPendentes: number;
};

function normalizarSexoEstimado(valor: string | null | undefined) {
  return String(valor || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function classificarSexoIndicador(valor: string | null | undefined) {
  const sexoNormalizado = normalizarSexoEstimado(valor);

  if (sexoNormalizado === "masculino") {
    return "masculino" as const;
  }

  if (sexoNormalizado === "feminino") {
    return "feminino" as const;
  }

  return "indeterminado" as const;
}

export function calcularIndicadoresParticipantes(participantes: ParticipanteIndicadoresBase[]) {
  const indicadores: IndicadoresParticipantes = {
    totalInscritos: participantes.length,
    totalPresentes: 0,
    totalPendentes: 0,
    porcentagemComparecimento: 0,
    horarioMaisQuente: "-",
    homens: 0,
    mulheres: 0,
    indeterminado: 0,
    homensPresentes: 0,
    mulheresPresentes: 0,
    homensPendentes: 0,
    mulheresPendentes: 0,
    indeterminadosPresentes: 0,
    indeterminadosPendentes: 0,
  };

  const horarios: Record<string, number> = {};

  participantes.forEach((participante) => {
    const presente = Boolean(participante.presente);
    const sexo = classificarSexoIndicador(participante.sexo_estimado);

    if (presente) {
      indicadores.totalPresentes += 1;
    }

    if (sexo === "masculino") {
      indicadores.homens += 1;
      if (presente) {
        indicadores.homensPresentes += 1;
      } else {
        indicadores.homensPendentes += 1;
      }
    } else if (sexo === "feminino") {
      indicadores.mulheres += 1;
      if (presente) {
        indicadores.mulheresPresentes += 1;
      } else {
        indicadores.mulheresPendentes += 1;
      }
    } else {
      indicadores.indeterminado += 1;
      if (presente) {
        indicadores.indeterminadosPresentes += 1;
      } else {
        indicadores.indeterminadosPendentes += 1;
      }
    }

    if (!participante.entrada_confirmada_em) {
      return;
    }

    const hora = new Date(participante.entrada_confirmada_em).getHours();

    if (Number.isNaN(hora)) {
      return;
    }

    const label = `${hora}:00`;
    horarios[label] = (horarios[label] || 0) + 1;
  });

  indicadores.totalPendentes = indicadores.totalInscritos - indicadores.totalPresentes;
  indicadores.porcentagemComparecimento =
    indicadores.totalInscritos > 0
      ? Math.round((indicadores.totalPresentes / indicadores.totalInscritos) * 100)
      : 0;

  let maiorQuantidade = 0;

  Object.entries(horarios).forEach(([hora, quantidade]) => {
    if (quantidade > maiorQuantidade) {
      maiorQuantidade = quantidade;
      indicadores.horarioMaisQuente = hora;
    }
  });

  return indicadores;
}

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

type ResultadoValidacaoNomeParticipante =
  | { valido: true; nomeAjustado: string }
  | { valido: false; motivo: string };

function normalizarTextoSimples(valor: string) {
  return String(valor || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const termosBloqueadosNomeCompleto = new Set(["teste", "test", "aaaa"]);

export function validarNomeCompletoParticipante(valor: string): ResultadoValidacaoNomeParticipante {
  const nomeAjustado = String(valor || "").replace(/\s+/g, " ").trim();

  if (!nomeAjustado) {
    return { valido: false, motivo: "Informe nome e sobrenome." };
  }

  if (/\d/.test(nomeAjustado)) {
    return { valido: false, motivo: "Use apenas letras no nome completo." };
  }

  const partes = nomeAjustado.split(" ").filter(Boolean);

  if (partes.length < 2) {
    return { valido: false, motivo: "Informe nome e sobrenome." };
  }

  if (partes.some((parte) => parte.replace(/[-'’]/g, "").length < 2)) {
    return { valido: false, motivo: "Nome completo invalido." };
  }

  if (!/[\p{L}]/u.test(nomeAjustado)) {
    return { valido: false, motivo: "Nome completo invalido." };
  }

  const textoNormalizado = normalizarTextoSimples(nomeAjustado);
  const textoSemEspaco = textoNormalizado.replace(/\s+/g, "");

  if (/^([a-z])\1+$/i.test(textoSemEspaco)) {
    return { valido: false, motivo: "Nome completo invalido." };
  }

  if (termosBloqueadosNomeCompleto.has(textoNormalizado)) {
    return { valido: false, motivo: "Nome completo invalido." };
  }

  return { valido: true, nomeAjustado };
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
