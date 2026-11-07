import { createHash } from 'node:crypto';
import { lerSeExiste } from './git.mjs';

const CAMINHO_DAS_EXCECOES = '.githooks/excecoes.txt';
const HASH = /^[0-9a-f]{64}$/;
const BOM = String.fromCharCode(0xfeff);

/** Lê `<caminho>\t<sha256>\t<motivo>`, uma por linha; `#` abre comentário. Linha fora do formato é erro. */
export function interpretarExcecoes(texto) {
  const excecoes = new Map();
  const semBom = texto.startsWith(BOM) ? texto.slice(1) : texto;
  semBom.split(/\r?\n/).forEach((linha, indice) => {
    if (linha.trim() === '' || linha.startsWith('#')) return;
    const [caminho, hash, motivo] = linha.split('\t');
    if (!caminho || !HASH.test(hash ?? '') || !motivo?.trim()) {
      throw new Error(`excecoes.txt, linha ${indice + 1}: esperado caminho, sha256 e motivo separados por tabulação`);
    }
    excecoes.set(`${hash}\t${caminho}`, motivo);
  });
  return excecoes;
}

/** As exceções valem como estão no que está sendo conferido (índice ou commit); sem o arquivo, não há exceção. */
export function excecoesDe(ref, cwd) {
  const bytes = lerSeExiste(ref, CAMINHO_DAS_EXCECOES, cwd);
  return bytes === null ? new Map() : interpretarExcecoes(bytes.toString('utf8'));
}

export function temExcecao(excecoes, caminho, bytes) {
  const hash = createHash('sha256').update(bytes).digest('hex');
  return excecoes.has(`${hash}\t${caminho}`);
}
