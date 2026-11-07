import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const HASH = /^[0-9a-f]{64}$/;

/** Lê `<caminho>\t<sha256>\t<motivo>`, uma por linha; `#` abre comentário. Linha fora do formato é erro. */
export function lerExcecoes(arquivo) {
  const excecoes = new Map();
  readFileSync(arquivo, 'utf8').split(/\r?\n/).forEach((linha, indice) => {
    if (linha.trim() === '' || linha.startsWith('#')) return;
    const [caminho, hash, motivo] = linha.split('\t');
    if (!caminho || !HASH.test(hash ?? '') || !motivo?.trim()) {
      throw new Error(`excecoes.txt, linha ${indice + 1}: esperado caminho, sha256 e motivo separados por tabulação`);
    }
    excecoes.set(`${hash}\t${caminho}`, motivo);
  });
  return excecoes;
}

export function temExcecao(excecoes, caminho, bytes) {
  const hash = createHash('sha256').update(bytes).digest('hex');
  return excecoes.has(`${hash}\t${caminho}`);
}
