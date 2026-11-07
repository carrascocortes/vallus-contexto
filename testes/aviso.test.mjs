import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { caminhoVigiado } from '../.githooks/lib/caminhos.mjs';
import { git, repoTemporario } from './git.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const aviso = join(raiz, '.githooks', 'aviso.mjs');
const ZEROS = '0'.repeat(40);
const DECISOES = 'frentes/minha-frente/decisoes.md';
const PASSAGEM = 'frentes/minha-frente/passagem.md';
const ENTRADA = 'frentes/minha-frente/memoria/2026-11-05-turno.md';

const pastas = [];
after(() => {
  for (const pasta of pastas) rmSync(pasta, { recursive: true, force: true });
});

test('caminhoVigiado vale para os caminhos que o PO precisa ver', () => {
  const vigiados = [
    'LEIA-ME.md',
    '.gitattributes',
    '.githooks/pre-commit',
    '.githooks/lib/git.mjs',
    '.github/workflows/ci.yml',
    'ferramentas/instalar.mjs',
    DECISOES,
    'decisoes/0001-algo.md',
    'memoria/INDICE.md',
    'memoria/licoes/uma.md',
    'memoria/referencias/outra.md',
  ];
  for (const caminho of vigiados) assert.equal(caminhoVigiado(caminho), true, caminho);
});

test('caminhoVigiado não vale para o que a sessão escreve sozinha', () => {
  const livres = [
    PASSAGEM,
    ENTRADA,
    'docs/nota.md',
    'testes/aviso.test.mjs',
    'memoria/outra.md',
    'frentes/minha-frente/sub/decisoes.md',
    'decisoes.md',
    'LEIA-ME.md.bak',
  ];
  for (const caminho of livres) assert.equal(caminhoVigiado(caminho), false, caminho);
});

function gravar(repo, caminho, texto) {
  mkdirSync(dirname(join(repo, caminho)), { recursive: true });
  writeFileSync(join(repo, caminho), texto);
}

function commitar(repo, caminho, texto, mensagem) {
  gravar(repo, caminho, texto);
  assert.equal(git(['add', '--', caminho], { cwd: repo }).status, 0);
  const resultado = git(['commit', '--quiet', '--no-verify', '-m', mensagem], { cwd: repo });
  assert.equal(resultado.status, 0, resultado.stderr);
  return git(['rev-parse', 'HEAD'], { cwd: repo }).stdout.toString('utf8').trim();
}

function novoRepo() {
  const repo = repoTemporario();
  pastas.push(repo);
  return repo;
}

function avisar(repo, before, depois) {
  const resultado = spawnSync(process.execPath, [aviso, before, depois], { cwd: repo, encoding: 'utf8' });
  return { status: resultado.status, saida: `${resultado.stdout}${resultado.stderr}` };
}

test('aviso sai 1 e cita só o commit que toca caminho vigiado', () => {
  const repo = novoRepo();
  const base = commitar(repo, 'docs/base.md', 'base\n', 'base');
  const primeiro = commitar(repo, DECISOES, 'decidi\n', 'decisao');
  commitar(repo, PASSAGEM, 'passei\n', 'passagem');
  const ultimo = commitar(repo, ENTRADA, 'entrada\n', 'entrada');
  const { status, saida } = avisar(repo, base, ultimo);
  assert.equal(status, 1, saida);
  assert.ok(saida.includes(primeiro), saida);
  assert.ok(saida.includes(DECISOES), saida);
  assert.ok(!saida.includes(PASSAGEM), saida);
});

test('aviso sai 0 quando os commits só tocam passagem e entrada', () => {
  const repo = novoRepo();
  const base = commitar(repo, 'docs/base.md', 'base\n', 'base');
  commitar(repo, PASSAGEM, 'passei\n', 'passagem');
  const ultimo = commitar(repo, ENTRADA, 'entrada\n', 'entrada');
  assert.equal(avisar(repo, base, ultimo).status, 0);
});

test('aviso com before zerado varre todos os commits', () => {
  const repo = novoRepo();
  const primeiro = commitar(repo, 'LEIA-ME.md', 'oi\n', 'raiz');
  const ultimo = commitar(repo, PASSAGEM, 'passei\n', 'passagem');
  const { status, saida } = avisar(repo, ZEROS, ultimo);
  assert.equal(status, 1, saida);
  assert.ok(saida.includes(primeiro), saida);
});

test('aviso lê o conteúdo próprio de um merge', () => {
  const repo = novoRepo();
  commitar(repo, 'docs/base.md', 'base\n', 'base');
  git(['checkout', '--quiet', '-b', 'lado'], { cwd: repo });
  commitar(repo, ENTRADA, 'lado\n', 'lado');
  git(['checkout', '--quiet', 'main'], { cwd: repo });
  const antes = commitar(repo, PASSAGEM, 'main\n', 'main');
  assert.equal(git(['merge', '--quiet', '--no-commit', '--no-ff', 'lado'], { cwd: repo }).status, 0);
  gravar(repo, DECISOES, 'so no merge\n');
  assert.equal(git(['add', '--', DECISOES], { cwd: repo }).status, 0);
  assert.equal(git(['commit', '--quiet', '--no-verify', '-m', 'merge'], { cwd: repo }).status, 0);
  const merge = git(['rev-parse', 'HEAD'], { cwd: repo }).stdout.toString('utf8').trim();
  const { status, saida } = avisar(repo, antes, merge);
  assert.equal(status, 1, saida);
  assert.ok(saida.includes(DECISOES), saida);
});

test('aviso sai 0 num push que só apaga a referência', () => {
  const repo = novoRepo();
  const base = commitar(repo, 'docs/base.md', 'base\n', 'base');
  assert.equal(avisar(repo, base, ZEROS).status, 0);
});

test('aviso sai 2 com hash inexistente e com argumento que não é hash', () => {
  const repo = novoRepo();
  const base = commitar(repo, 'docs/base.md', 'base\n', 'base');
  assert.equal(avisar(repo, base, 'f'.repeat(40)).status, 2);
  assert.equal(avisar(repo, base, '--help').status, 2);
});

test('aviso sai 2 quando não há commit novo com after real', () => {
  const repo = novoRepo();
  const base = commitar(repo, 'docs/base.md', 'base\n', 'base');
  assert.equal(avisar(repo, base, base).status, 2);
});
