import {
  classificarSexo,
  SexoEstimadoParticipante,
  type ResultadoClassificacaoParticipante,
} from "./classificadorSexo";

export { SexoEstimadoParticipante };

export type ClassificacaoParticipante = ResultadoClassificacaoParticipante;

export function classificarParticipante(nomeCompleto: string, dataReferencia?: string | Date): ClassificacaoParticipante {
  return classificarSexo(nomeCompleto, dataReferencia);
}
