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

/** `ref` nulo é o índice do momento; senão, o commit dado. */
export function arquivosMudados(ref, cwd) {
  const args = ref === null
    ? ['diff', '--cached', '--name-status', '-z', '--diff-filter=ACMRT']
    : ['diff-tree', '--no-commit-id', '--diff-merges=first-parent', '-r', '--name-status', '-z', '--root', ref];
  return caminhosDoNameStatus(rodarGit(args, { cwd }).stdout);
}

export function arquivosDaArvore(ref, cwd) {
  return separarPorNulo(rodarGit(['ls-tree', '-r', '-z', '--name-only', ref], { cwd }).stdout);
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
  const args = ['diff-tree', '--no-commit-id', '--diff-merges=first-parent', '-r', '--name-only', '-z', '--root', ref];
  return separarPorNulo(rodarGit(args, { cwd }).stdout);
}
