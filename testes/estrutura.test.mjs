import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, repoTemporario } from './git.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function caminhosVersionados(cwd) {
  const { status, stdout, stderr } = git(['ls-files', '-z'], { cwd });
  assert.equal(status, 0, `git ls-files falhou: ${stderr}`);
  return stdout.toString('utf8').split('\0').filter(Boolean);
}

function caminhosComAcento(caminhos) {
  return caminhos.filter((caminho) => !/^[\x20-\x7E]+$/.test(caminho));
}

test('nenhum arquivo versionado tem acento no nome', () => {
  const caminhos = caminhosVersionados(raiz);
  assert.ok(caminhos.includes('.gitattributes'), 'a lista da raiz não traz o .gitattributes');
  assert.deepEqual(caminhosComAcento(caminhos), []);
});

test('o teste de acento não é vazio', () => {
  const repo = repoTemporario();
  writeFileSync(join(repo, 'ação.txt'), 'x\n');
  assert.equal(git(['add', '--all'], { cwd: repo }).status, 0);
  assert.deepEqual(caminhosComAcento(caminhosVersionados(repo)), ['ação.txt']);
});

test('cada modelo respeita o teto', () => {
  const tetos = { 'frente.md': 60, 'passagem.md': 40, 'entrada.md': 40, 'decisao.md': 30, 'licao.md': 40 };
  for (const [modelo, teto] of Object.entries(tetos)) {
    const texto = readFileSync(join(raiz, 'modelos', modelo), 'utf8');
    const linhas = texto.split('\n').length - (texto.endsWith('\n') ? 1 : 0);
    assert.ok(linhas <= teto, `${modelo} tem ${linhas} linhas, teto ${teto}`);
  }
});

test('todo arquivo versionado é UTF-8 em LF', () => {
  const decodificador = new TextDecoder('utf-8', { fatal: true });
  for (const caminho of caminhosVersionados(raiz)) {
    const bytes = readFileSync(join(raiz, caminho));
    assert.ok(!bytes.includes(0), `${caminho} tem byte nulo`);
    assert.ok(!bytes.includes('\r\n'), `${caminho} tem CRLF`);
    assert.doesNotThrow(() => decodificador.decode(bytes), `${caminho} não é UTF-8`);
  }
});

test('o campo sessao dos modelos é o marcador <id>', () => {
  for (const modelo of ['passagem.md', 'entrada.md', 'licao.md', 'referencia.md']) {
    const linhas = readFileSync(join(raiz, 'modelos', modelo), 'utf8').split('\n');
    assert.ok(linhas.includes('sessao: <id>'), `${modelo} sem a linha exata "sessao: <id>"`);
  }
});
