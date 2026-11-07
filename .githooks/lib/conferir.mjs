import { verificarUuid } from './cabecalho.mjs';
import { temExcecao } from './excecoes.mjs';
import { lerArquivo, lerSeExiste } from './git.mjs';
import { linhasComSegredo } from './gitleaks.mjs';
import { semIndice } from './indice.mjs';
import { detectar } from './padroes.mjs';

const CAMINHO_DO_INDICE = 'memoria/INDICE.md';
const SO_ASCII_IMPRIMIVEL = /^[\x20-\x7E]+$/;
const DECODIFICADOR = new TextDecoder('utf-8', { fatal: true });

/** O conteúdo todo: detectores próprios, regra do UUID e gitleaks. Devolve só padrão e linha, nunca o trecho. */
export function conferirTexto(texto) {
  const gitleaks = linhasComSegredo(texto).map((linha) => ({ padrao: 'gitleaks', linha }));
  return [...detectar(texto), ...verificarUuid(texto), ...gitleaks].sort((a, b) => a.linha - b.linha);
}

// UTF-8 válido, sem byte nulo; o BOM é descartado pelo decodificador.
function decodificar(bytes) {
  if (bytes.includes(0)) return null;
  try {
    return DECODIFICADOR.decode(bytes);
  } catch {
    return null;
  }
}

function achadosDoArquivo(caminho, bytes, excecoes) {
  const texto = decodificar(bytes);
  if (texto === null) return [{ caminho, padrao: 'encoding-invalido', conteudo: false }];
  if (temExcecao(excecoes, caminho, bytes)) return [];
  return conferirTexto(texto).map((achado) => ({ caminho, ...achado, conteudo: true }));
}

function achadosDeNome(caminhos) {
  return caminhos
    .filter((caminho) => !SO_ASCII_IMPRIMIVEL.test(caminho))
    .map((caminho) => ({ caminho, padrao: 'nome-com-acento', conteudo: false }));
}

function achadosDeIndice(caminhos, ref, cwd) {
  const indice = lerSeExiste(ref, CAMINHO_DO_INDICE, cwd)?.toString('utf8') ?? '';
  return semIndice(caminhos, indice).map((caminho) => ({ caminho, padrao: 'licao-sem-indice', conteudo: false }));
}

/** `ref` nulo confere o índice do momento; senão, o conteúdo do commit. Falha de leitura ou do gitleaks lança. */
export function conferirCaminhos({ ref, caminhos, cwd, excecoes }) {
  const achados = [...achadosDeNome(caminhos), ...achadosDeIndice(caminhos, ref, cwd)];
  for (const caminho of caminhos) {
    achados.push(...achadosDoArquivo(caminho, lerArquivo(ref, caminho, cwd), excecoes));
  }
  return achados;
}
