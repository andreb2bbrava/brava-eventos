import { createClient } from "@supabase/supabase-js";
import { classificarParticipante } from "../lib/inteligencia";

const TAMANHO_LOTE = 500;

function carregarVariavelAmbiente(chave: string) {
  const valor = process.env[chave];
  if (!valor) {
    throw new Error(`Variavel de ambiente ausente: ${chave}`);
  }
  return valor;
}

const supabaseAdmin = createClient(
  carregarVariavelAmbiente("NEXT_PUBLIC_SUPABASE_URL"),
  carregarVariavelAmbiente("SUPABASE_SERVICE_ROLE_KEY")
);

async function atualizarParticipante(id: number, nome: string | null) {
  const classificacao = classificarParticipante(nome || "", new Date());

  const { error } = await supabaseAdmin
    .from("participantes")
    .update({
      sexo_estimado: classificacao.sexoEstimado,
      confianca_sexo: classificacao.confiancaSexo,
      metodo_classificacao: classificacao.metodoClassificacao,
      motor_inteligencia: classificacao.motorInteligencia,
      versao_motor: classificacao.versaoMotor,
      classificado_em: classificacao.classificadoEm,
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

async function main() {
  let pagina = 0;
  let totalAtualizado = 0;

  for (;;) {
    const inicio = pagina * TAMANHO_LOTE;
    const fim = inicio + TAMANHO_LOTE - 1;

    const { data, error } = await supabaseAdmin
      .from("participantes")
      .select("id, nome")
      .order("id", { ascending: true })
      .range(inicio, fim);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const participante of data) {
      await atualizarParticipante(participante.id, participante.nome);
      totalAtualizado += 1;
    }

    pagina += 1;
  }

  console.log(`Participantes classificados: ${totalAtualizado}`);
}

main().catch((error) => {
  console.error("Erro ao classificar participantes existentes:", error);
  process.exitCode = 1;
});
