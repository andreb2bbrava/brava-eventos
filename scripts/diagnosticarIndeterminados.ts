import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TAMANHO_LOTE = 1000;
const LIMITE_TERMINAL = 100;
const CAMINHO_CSV = join(process.cwd(), "reports", "diagnostico-indeterminados.csv");

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

function normalizarPrimeiroNome(nome: string | null) {
  const nomeLimpo = String(nome || "").trim();
  if (!nomeLimpo) {
    return "";
  }

  const primeiroNome = nomeLimpo.split(/\s+/)[0] || "";

  return primeiroNome
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function formatarNomeExibicao(primeiroNomeNormalizado: string) {
  if (!primeiroNomeNormalizado) {
    return "(sem nome)";
  }

  return primeiroNomeNormalizado.charAt(0).toUpperCase() + primeiroNomeNormalizado.slice(1);
}

async function main() {
  let pagina = 0;
  const frequencias = new Map<string, number>();

  for (;;) {
    const inicio = pagina * TAMANHO_LOTE;
    const fim = inicio + TAMANHO_LOTE - 1;

    const { data, error } = await supabaseAdmin
      .from("participantes")
      .select("nome")
      .eq("sexo_estimado", "Indeterminado")
      .order("id", { ascending: true })
      .range(inicio, fim);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const participante of data) {
      const primeiroNome = normalizarPrimeiroNome(participante.nome);
      if (!primeiroNome) {
        continue;
      }

      frequencias.set(primeiroNome, (frequencias.get(primeiroNome) || 0) + 1);
    }

    pagina += 1;
  }

  const ranking = Array.from(frequencias.entries()).sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1];
    }

    return a[0].localeCompare(b[0], "pt-BR");
  });

  const linhasCsv = ["primeiro_nome,quantidade"];

  for (const [primeiroNome, quantidade] of ranking) {
    linhasCsv.push(`${formatarNomeExibicao(primeiroNome)},${quantidade}`);
  }

  mkdirSync(join(process.cwd(), "reports"), { recursive: true });
  writeFileSync(CAMINHO_CSV, `${linhasCsv.join("\n")}\n`, "utf8");

  const top100 = ranking.slice(0, LIMITE_TERMINAL);

  for (const [primeiroNome, quantidade] of top100) {
    console.log(`${formatarNomeExibicao(primeiroNome)} - ${quantidade}`);
  }

  console.log(`CSV gerado em: ${CAMINHO_CSV}`);
}

main().catch((error) => {
  console.error("Erro ao diagnosticar indeterminados:", error);
  process.exitCode = 1;
});
