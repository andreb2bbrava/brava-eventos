import nomesFemininos from "./dados/nomesFemininos.json";
import nomesMasculinos from "./dados/nomesMasculinos.json";

export const SexoEstimadoParticipante = {
  MASCULINO: "Masculino",
  FEMININO: "Feminino",
  INDETERMINADO: "Indeterminado",
} as const;

export type SexoEstimadoParticipante =
  (typeof SexoEstimadoParticipante)[keyof typeof SexoEstimadoParticipante];

export type OrigemResultadoSexo = "Base Masculina" | "Base Feminina" | "Não Encontrado";

export type ResultadoClassificacaoParticipante = {
  sexoEstimado: SexoEstimadoParticipante;
  confiancaSexo: number;
  metodoClassificacao: string;
  motorInteligencia: string;
  versaoMotor: string;
  origemResultado: OrigemResultadoSexo;
  classificadoEm: string;
};

const MOTOR_INTELIGENCIA = "Base Local";
const VERSAO_MOTOR = "1.0";

const CONFIANCA_CLASSIFICACAO = {
  baseLocalCorrespondencia: 99,
  naoEncontrado: 50,
} as const;

const baseNomesMasculinos = new Set(nomesMasculinos.map((nome) => normalizarNome(nome)));
const baseNomesFemininos = new Set(nomesFemininos.map((nome) => normalizarNome(nome)));

function normalizarNome(valor: string) {
  return String(valor || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function extrairPrimeiroNome(nomeCompleto: string) {
  const nomeLimpo = String(nomeCompleto || "").trim();
  if (!nomeLimpo) {
    return "";
  }

  return nomeLimpo.split(/\s+/)[0] || "";
}

function obterConfiancaClassificacao(origemResultado: OrigemResultadoSexo) {
  if (origemResultado === "Base Masculina" || origemResultado === "Base Feminina") {
    return CONFIANCA_CLASSIFICACAO.baseLocalCorrespondencia;
  }

  return CONFIANCA_CLASSIFICACAO.naoEncontrado;
}

function resolverDataClassificacao(dataReferencia?: string | Date) {
  if (dataReferencia instanceof Date) {
    return dataReferencia.toISOString();
  }

  if (typeof dataReferencia === "string" && dataReferencia.trim()) {
    const data = new Date(dataReferencia);
    if (!Number.isNaN(data.getTime())) {
      return data.toISOString();
    }
  }

  return new Date().toISOString();
}

function criarResultadoClassificacao(
  sexoEstimado: SexoEstimadoParticipante,
  origemResultado: OrigemResultadoSexo,
  metodoClassificacao: string,
  dataReferencia?: string | Date
): ResultadoClassificacaoParticipante {
  return {
    sexoEstimado,
    confiancaSexo: obterConfiancaClassificacao(origemResultado),
    metodoClassificacao,
    motorInteligencia: MOTOR_INTELIGENCIA,
    versaoMotor: VERSAO_MOTOR,
    origemResultado,
    classificadoEm: resolverDataClassificacao(dataReferencia),
  };
}

export function classificarSexo(nomeCompleto: string, dataReferencia?: string | Date): ResultadoClassificacaoParticipante {
  const primeiroNomeNormalizado = normalizarNome(extrairPrimeiroNome(nomeCompleto));

  if (primeiroNomeNormalizado && baseNomesMasculinos.has(primeiroNomeNormalizado)) {
    return criarResultadoClassificacao(
      SexoEstimadoParticipante.MASCULINO,
      "Base Masculina",
      "Primeiro nome encontrado na base local masculina",
      dataReferencia
    );
  }

  if (primeiroNomeNormalizado && baseNomesFemininos.has(primeiroNomeNormalizado)) {
    return criarResultadoClassificacao(
      SexoEstimadoParticipante.FEMININO,
      "Base Feminina",
      "Primeiro nome encontrado na base local feminina",
      dataReferencia
    );
  }

  return criarResultadoClassificacao(
    SexoEstimadoParticipante.INDETERMINADO,
    "Não Encontrado",
    "Primeiro nome não encontrado nas bases locais",
    dataReferencia
  );
}
