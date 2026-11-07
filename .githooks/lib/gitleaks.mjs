import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { TAMANHO_MAXIMO } from './git.mjs';

const CODIGO_DE_ACHADO = 3;

function binario() {
  if (process.env.VALLUS_GITLEAKS) return process.env.VALLUS_GITLEAKS;
  const nome = process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks';
  return join(homedir(), '.vallus-contexto', 'bin', nome);
}

// Só vale a configuração embutida: nada do ambiente de quem chama pode afrouxar a varredura. No Windows o nome de
// variável não tem caixa, então a comparação também não.
function ambienteSemConfiguracao() {
  return Object.fromEntries(Object.entries(process.env).filter(([nome]) => !nome.toUpperCase().startsWith('GITLEAKS_')));
}

function linhasDoRelatorio(caminhoDoRelatorio) {
  const achados = JSON.parse(readFileSync(caminhoDoRelatorio, 'utf8'));
  if (!Array.isArray(achados) || achados.length === 0) throw new Error('o gitleaks sinalizou achado sem relatório');
  return achados.map((achado) => (Number.isInteger(achado.StartLine) && achado.StartLine > 0 ? achado.StartLine : 1));
}

function rodar(texto, pastaDeTrabalho, relatorio) {
  const resultado = spawnSync(
    binario(),
    [
      'stdin',
      '--redact',
      '--no-banner',
      '--ignore-gitleaks-allow',
      '--exit-code', String(CODIGO_DE_ACHADO),
      '--report-format', 'json',
      '--report-path', relatorio,
    ],
    { input: texto, cwd: pastaDeTrabalho, env: ambienteSemConfiguracao(), maxBuffer: TAMANHO_MAXIMO },
  );
  if (resultado.error) throw new Error(`não foi possível rodar o gitleaks: ${resultado.error.code ?? resultado.error.message}`);
  if (resultado.status === 0) return [];
  if (resultado.status === CODIGO_DE_ACHADO) return linhasDoRelatorio(relatorio);
  throw new Error(`o gitleaks terminou com a saída ${resultado.status}`);
}

/**
 * Passa o texto pelo gitleaks e devolve as linhas com achado (vazio: limpo). O gitleaks sai 1 tanto em achado quanto
 * em erro, por isso o código de achado é outro; qualquer saída fora de 0 e 3 lança.
 */
export function linhasComSegredo(texto) {
  let pastaDeTrabalho;
  let pastaDoRelatorio;
  try {
    pastaDeTrabalho = mkdtempSync(join(tmpdir(), 'gitleaks-cwd-'));
    pastaDoRelatorio = mkdtempSync(join(tmpdir(), 'gitleaks-rel-'));
    return rodar(texto, pastaDeTrabalho, join(pastaDoRelatorio, 'relatorio.json'));
  } finally {
    for (const pasta of [pastaDeTrabalho, pastaDoRelatorio]) {
      if (pasta) rmSync(pasta, { recursive: true, force: true });
    }
  }
}
