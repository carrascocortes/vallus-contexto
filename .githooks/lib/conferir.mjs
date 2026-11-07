import { contemUuid, verificarUuid } from './cabecalho.mjs';
import { excecoesDe, temExcecao } from './excecoes.mjs';
import {
  arquivosDaArvore,
  caminhosTocados,
  identidadesDoCommit,
  identidadesDoCommitEmCurso,
  lerArquivo,
  lerSeExiste,
  mensagemDoCommit,
} from './git.mjs';
import { linhasComSegredo } from './gitleaks.mjs';
import { semIndice } from './indice.mjs';
import { detectar } from './padroes.mjs';

const CAMINHO_DO_INDICE = 'memoria/INDICE.md';
const SO_ASCII_IMPRIMIVEL = /^[\x20-\x7E]+$/;
const PREFIXO_DE_NOME = 'nome-com-';
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

// Uma única chamada ao gitleaks para todos os nomes, uma linha por caminho; o achado volta ao caminho pela linha.
// Nome com quebra de linha desalinharia a contagem, mas já é barrado antes (não é ASCII imprimível).
function caminhosComSegredo(caminhos) {
  const candidatos = caminhos.filter((caminho) => SO_ASCII_IMPRIMIVEL.test(caminho));
  if (candidatos.length === 0) return new Set();
  return new Set(linhasComSegredo(candidatos.join('\n')).map((linha) => candidatos[linha - 1]));
}

// O nome do arquivo também não pode carregar dado de cliente nem segredo.
function padroesDoNome(caminho, comSegredo) {
  const padroes = detectar(caminho).map(({ padrao }) => `${PREFIXO_DE_NOME}${padrao}`);
  if (contemUuid(caminho)) padroes.push(`${PREFIXO_DE_NOME}uuid`);
  if (comSegredo.has(caminho)) padroes.push(`${PREFIXO_DE_NOME}gitleaks`);
  if (!SO_ASCII_IMPRIMIVEL.test(caminho)) padroes.push(`${PREFIXO_DE_NOME}acento`);
  return [...new Set(padroes)];
}

/** O nome que a trava barra: quem imprime caminhos não o mostra. */
export function nomeBarrado(caminho) {
  return padroesDoNome(caminho, caminhosComSegredo([caminho])).length > 0;
}

/**
 * A mensagem de commit entra no histórico como o resto: detectores, UUID em qualquer posição (não há campo sessao:
 * numa mensagem) e gitleaks. Nunca é retida; o achado diz só o padrão e a linha.
 */
export function conferirMensagem(texto, ref = null) {
  const uuids = texto.split(/\r?\n/).flatMap((linha, indice) =>
    contemUuid(linha) ? [{ padrao: 'uuid', linha: indice + 1 }] : [],
  );
  const achados = [...detectar(texto), ...uuids, ...linhasComSegredo(texto).map((linha) => ({ padrao: 'gitleaks', linha }))];
  return achados.sort((a, b) => a.linha - b.linha).map((achado) => ({ ...achado, mensagem: true, conteudo: false, ref }));
}

/** A mensagem de um commit já feito, lida do objeto bruto; codificação que não é UTF-8 é achado. */
export function conferirMensagemDoCommit(ref, cwd) {
  const mensagem = mensagemDoCommit(ref, cwd);
  if (mensagem.invalida) return [{ mensagem: true, padrao: 'encoding-invalido', conteudo: false, ref }];
  return conferirMensagem(mensagem.texto, ref);
}

const PAPEIS_DA_IDENTIDADE = ['autor', 'committer'];

/**
 * Autor e committer (`Nome <e-mail>`, sem a data) passam pela mesma conferência da mensagem; o e-mail só vale se
 * estiver na lista permitida. O achado diz o papel e o padrão, nunca o valor.
 */
export function conferirIdentidades({ autor, committer }, ref = null) {
  const texto = `${autor}\n${committer}`;
  const uuids = [autor, committer].flatMap((linha, indice) =>
    contemUuid(linha) ? [{ padrao: 'uuid', linha: indice + 1 }] : [],
  );
  const gitleaks = linhasComSegredo(texto).map((linha) => ({ padrao: 'gitleaks', linha }));
  return [...detectar(texto), ...uuids, ...gitleaks].map(({ padrao, linha }) => ({
    padrao,
    papel: PAPEIS_DA_IDENTIDADE[linha - 1],
    conteudo: false,
    ref,
  }));
}

export function conferirIdentidadesDoCommit(ref, cwd) {
  return conferirIdentidades(identidadesDoCommit(ref, cwd), ref);
}

export function conferirIdentidadesDoCommitEmCurso(cwd) {
  return conferirIdentidades(identidadesDoCommitEmCurso(cwd));
}

function achadosDeNome(caminhos) {
  const comSegredo = caminhosComSegredo(caminhos);
  return caminhos.flatMap((caminho) =>
    padroesDoNome(caminho, comSegredo).map((padrao) => ({ caminho, padrao, conteudo: false })),
  );
}

// Quando o commit mexe no índice, toda lição da árvore resultante é conferida contra ele, e não só a que o commit tocou.
function caminhosAConferirNoIndice(caminhos, ref, cwd) {
  if (!caminhosTocados(ref, cwd).includes(CAMINHO_DO_INDICE)) return caminhos;
  return [...new Set([...caminhos, ...arquivosDaArvore(ref, cwd)])];
}

function achadosDeIndice(caminhos, ref, cwd) {
  const indice = lerSeExiste(ref, CAMINHO_DO_INDICE, cwd)?.toString('utf8') ?? '';
  const sem = semIndice(caminhosAConferirNoIndice(caminhos, ref, cwd), indice);
  return sem.map((caminho) => ({ caminho, padrao: 'licao-sem-indice', conteudo: false }));
}

// O erro do Git traz o caminho; se o nome é barrado, a mensagem não pode repeti-lo.
function lerSemRepetirONome(ref, caminho, cwd, nomesBarrados) {
  try {
    return lerArquivo(ref, caminho, cwd);
  } catch (erro) {
    if (!nomesBarrados.has(caminho)) throw erro;
    throw new Error('o Git não leu (arquivo de nome barrado)');
  }
}

/**
 * `ref` nulo confere o índice do momento; senão, o conteúdo do commit. Falha de leitura ou do gitleaks lança.
 * Todo achado de um caminho de nome barrado leva `nomeBarrado`: quem imprime não mostra esse caminho.
 */
export function conferirCaminhos({ ref, caminhos, cwd }) {
  const excecoes = excecoesDe(ref, cwd);
  const achados = [...achadosDeNome(caminhos), ...achadosDeIndice(caminhos, ref, cwd)];
  const nomesBarrados = new Set(
    achados.filter((achado) => achado.padrao.startsWith(PREFIXO_DE_NOME)).map((achado) => achado.caminho),
  );
  // A lição que o commit não tocou vem da árvore: se o nome dela é barrado, também não pode ser impresso.
  for (const { caminho, padrao } of achados) {
    if (padrao === 'licao-sem-indice' && !caminhos.includes(caminho) && nomeBarrado(caminho)) nomesBarrados.add(caminho);
  }
  for (const caminho of caminhos) {
    achados.push(...achadosDoArquivo(caminho, lerSemRepetirONome(ref, caminho, cwd, nomesBarrados), excecoes));
  }
  return achados.map((achado) => ({ ...achado, ref, nomeBarrado: nomesBarrados.has(achado.caminho) }));
}
