import { spawnSync } from 'node:child_process';

export const TAMANHO_MAXIMO = 512 * 1024 * 1024;
const SO_ZEROS = /^0+$/;
const OBJETO = /^[0-9a-f]{4,64}$/i;

// O ambiente segue como veio: dentro do hook de `git commit -- <caminhos>`, `GIT_INDEX_FILE` aponta para o índice
// temporário, e é só assim que a leitura do índice enxerga o que vai ser commitado.
export function rodarGit(args, { cwd, tolerarFalha = false } = {}) {
  const resultado = spawnSync('git', args, { cwd, maxBuffer: TAMANHO_MAXIMO });
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0 && !tolerarFalha) {
    throw new Error(`o subcomando ${args[0]} do Git falhou: ${resultado.stderr.toString('utf8').trim()}`);
  }
  return { status: resultado.status, stdout: resultado.stdout };
}

export function ehSoZeros(objeto) {
  return SO_ZEROS.test(objeto);
}

// Um argumento que não seja o hash de um objeto nunca chega ao Git, que o leria como opção.
export function exigirObjeto(valor) {
  if (!OBJETO.test(valor ?? '')) throw new Error('o argumento não é o hash de um commit');
  return valor;
}

function separarPorNulo(saida) {
  return saida.toString('utf8').split('\0').filter(Boolean);
}

// `--name-status -z` traz "STATUS\0caminho\0"; para R e C, "STATUS\0origem\0destino\0". Só o destino interessa.
function caminhosDoNameStatus(saida) {
  const campos = separarPorNulo(saida);
  const caminhos = [];
  for (let i = 0; i < campos.length; ) {
    const status = campos[i];
    const consome = status.startsWith('R') || status.startsWith('C') ? 2 : 1;
    if (status[0] !== 'D') caminhos.push(campos[i + consome]);
    i += 1 + consome;
  }
  return caminhos;
}

// `--diff-merges=first-parent` faz o merge listar o que trouxe de próprio; sem ele não lista nada.
function argumentosDoDiffTree(formato, ref) {
  return ['diff-tree', '--no-commit-id', '--diff-merges=first-parent', '-r', formato, '-z', '--root', ref];
}

/** `ref` nulo é o índice do momento; senão, o commit dado. */
export function arquivosMudados(ref, cwd) {
  const args = ref === null
    ? ['diff', '--cached', '--name-status', '-z', '--diff-filter=ACMRT']
    : argumentosDoDiffTree('--name-status', ref);
  return caminhosDoNameStatus(rodarGit(args, { cwd }).stdout);
}

/** `ref` nulo é o índice do momento. */
export function arquivosDaArvore(ref, cwd) {
  const args = ref === null ? ['ls-files', '-z'] : ['ls-tree', '-r', '-z', '--name-only', ref];
  return separarPorNulo(rodarGit(args, { cwd }).stdout);
}

function especificacao(ref, caminho) {
  return `${ref ?? ''}:${caminho}`;
}

export function lerArquivo(ref, caminho, cwd) {
  return rodarGit(['show', especificacao(ref, caminho)], { cwd }).stdout;
}

export function lerSeExiste(ref, caminho, cwd) {
  const existe = rodarGit(['cat-file', '-e', especificacao(ref, caminho)], { cwd, tolerarFalha: true }).status === 0;
  return existe ? lerArquivo(ref, caminho, cwd) : null;
}

// Ao contrário de `arquivosMudados`, conta também o que o commit apagou: apagar um caminho vigiado é tocar nele.
export function caminhosTocados(ref, cwd) {
  const args = ref === null ? ['diff', '--cached', '--name-only', '-z'] : argumentosDoDiffTree('--name-only', ref);
  return separarPorNulo(rodarGit(args, { cwd }).stdout);
}

const ENCODING_DO_CABECALHO = /^encoding (.+)$/gm;
const DECODIFICADOR_ESTRITO = new TextDecoder('utf-8', { fatal: true });

function encodingEhUtf8(valor) {
  return valor.trim().toLowerCase().replace(/-/g, '') === 'utf8';
}

/**
 * Lê a mensagem do objeto bruto: `git log` a reconverte pelo cabeçalho `encoding` e pode devolver vazio para um texto
 * legível. `{ invalida: true }` quando o commit declara outra codificação ou a mensagem não é UTF-8 válido.
 */
export function mensagemDoCommit(ref, cwd) {
  const bruto = rodarGit(['cat-file', 'commit', exigirObjeto(ref)], { cwd }).stdout;
  const separador = bruto.indexOf('\n\n');
  const cabecalho = bruto.subarray(0, separador === -1 ? bruto.length : separador).toString('latin1');
  const corpo = separador === -1 ? Buffer.alloc(0) : bruto.subarray(separador + 2);
  const declarados = [...cabecalho.matchAll(ENCODING_DO_CABECALHO)].map((achado) => achado[1]);
  if (!declarados.every(encodingEhUtf8)) return { invalida: true };
  try {
    return { texto: DECODIFICADOR_ESTRITO.decode(corpo) };
  } catch {
    return { invalida: true };
  }
}

const CARIMBO_DE_DATA = / \d+ [+-]\d{4}$/;

function semCarimbo(identidade) {
  return identidade.replace(CARIMBO_DE_DATA, '');
}

/** Autor e committer de um commit já feito, lidos do objeto bruto, como `Nome <e-mail>` sem a data. */
export function identidadesDoCommit(ref, cwd) {
  const bruto = rodarGit(['cat-file', 'commit', exigirObjeto(ref)], { cwd }).stdout;
  const separador = bruto.indexOf('\n\n');
  const cabecalho = bruto.subarray(0, separador === -1 ? bruto.length : separador).toString('utf8').split('\n');
  const linhaDe = (campo) => cabecalho.find((linha) => linha.startsWith(`${campo} `))?.slice(campo.length + 1);
  const autor = linhaDe('author');
  const committer = linhaDe('committer');
  if (autor === undefined || committer === undefined) throw new Error('o commit não traz autor e committer');
  return { autor: semCarimbo(autor), committer: semCarimbo(committer) };
}

/** A identidade com que o commit em curso vai sair, vista de dentro do hook (inclui `--author`). */
export function identidadesDoCommitEmCurso(cwd) {
  const ler = (variavel) => semCarimbo(rodarGit(['var', variavel], { cwd }).stdout.toString('utf8').trim());
  return { autor: ler('GIT_AUTHOR_IDENT'), committer: ler('GIT_COMMITTER_IDENT') };
}
