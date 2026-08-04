# Modulo de Inteligencia de Participantes

Este diretorio centraliza toda inteligencia relacionada aos participantes.

## Fachada publica

Todo o restante do sistema deve consumir apenas:

```ts
import { classificarParticipante, SexoEstimadoParticipante } from "@/lib/inteligencia";
```

Nenhum arquivo fora deste modulo deve importar classificadores internos.

## Estrutura

- `classificadorSexo.ts`
  Contem somente a logica de classificacao de sexo estimado.

- `dados/nomesMasculinos.json`
  Base local de nomes masculinos.

- `dados/nomesFemininos.json`
  Base local de nomes femininos.

- `index.ts`
  Fachada publica do modulo.

- `README.md`
  Documentacao arquitetural.

## Evolucao futura

Novos classificadores devem ser adicionados como arquivos isolados:

- `classificadorIdade.ts`
- `classificadorPerfil.ts`
- `classificadorCRM.ts`

O `index.ts` permanece como ponto unico de integracao com o restante do sistema.

## Reclassificacao

A fachada publica aceita data de referencia opcional:

```ts
classificarParticipante(nomeCompleto, dataReferencia?)
```

Se `dataReferencia` nao for informada, o modulo utiliza a data atual.
