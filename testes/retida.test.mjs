import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectar } from '../.githooks/lib/padroes.mjs';
import { lerCabecalho, verificarUuid } from '../.githooks/lib/cabecalho.mjs';
import { ehRetivel, esboco, garantirRaiz, raizRetidasPadrao, reter } from '../.githooks/lib/retida.mjs';
import { cpfValido, emailDeFora, uuid } from './gerar.mjs';

const agora = new Date(2026, 10, 6, 14, 30, 5);
const ENTRADA = 'frentes/minha-frente/memoria/2026-11-05-turno.md';
const PASSAGEM = 'frentes/minha-frente/passagem.md';

function pastaTemporaria() {
  return mkdtempSync(join(tmpdir(), 'retida-'));
}

function entradaOriginal({ autor = 'sessão manual', sessao = uuid() } = {}) {
  return [
    '---',
    'data: 2026-11-05T22:10-03:00',
    `autor: ${autor}`,
    'ferramenta: claude-code',
    'modelo: claude-opus-5-5',
    `sessao: ${sessao}`,
    'desfecho: concluido',
    '---',
    '## Feito',
    `CPF do cliente: ${cpfValido()}`,
    '',
  ].join('\n');
}

function passagemOriginal() {
  return [
    '---',
    'atualizada: 2026-11-05T21:40-03:00',
    'por: claude-code · claude-opus-5-5',
    `sessao: ${uuid()}`,
    'sessao_aberta: sim',
    '---',
    '## Onde parou',
    `CPF do cliente: ${cpfValido()}`,
    '',
  ].join('\n');
}

function clone(arquivos) {
  const raiz = pastaTemporaria();
  for (const [caminho, conteudo] of Object.entries(arquivos)) {
    mkdirSync(join(raiz, caminho, '..'), { recursive: true });
    writeFileSync(join(raiz, caminho), conteudo);
  }
  return raiz;
}

test('ehRetivel aceita entrada e passagem e recusa o resto', () => {
  assert.equal(ehRetivel(ENTRADA), true);
  assert.equal(ehRetivel(PASSAGEM), true);
  assert.equal(ehRetivel('frentes/minha-frente/frente.md'), false);
  assert.equal(ehRetivel('memoria/licoes/algo.md'), false);
  assert.equal(ehRetivel('frentes/minha-frente/memoria/sub/algo.md'), false);
});

test('esboço de entrada passa na trava', () => {
  const sessao = uuid();
  const texto = esboco(ENTRADA, entradaOriginal({ sessao }), ['cpf'], agora);
  assert.deepEqual(detectar(texto), []);
  assert.deepEqual(verificarUuid(texto), []);
  const { campos } = lerCabecalho(texto);
  assert.equal(campos.get('desfecho'), 'retido');
  assert.equal(campos.get('motivo'), 'trava: cpf');
  assert.equal(campos.get('data'), '2026-11-05T22:10-03:00');
  assert.equal(campos.get('autor'), 'sessão manual');
  assert.equal(campos.get('ferramenta'), 'claude-code');
  assert.equal(campos.get('modelo'), 'claude-opus-5-5');
  assert.equal(campos.get('sessao'), sessao);
  assert.match(texto, /Texto retido pela trava em 2026-11-06\. Está fora do repositório até o PO liberar\./);
});

test('esboço descarta campo do cabeçalho que tem valor barrado', () => {
  const texto = esboco(ENTRADA, entradaOriginal({ autor: emailDeFora() }), ['email'], agora);
  assert.equal(lerCabecalho(texto).campos.has('autor'), false);
  assert.deepEqual(detectar(texto), []);
});

test('esboço descarta sessão que não é exatamente um UUID', () => {
  const texto = esboco(ENTRADA, entradaOriginal({ sessao: `${uuid()} ${uuid()}` }), ['uuid'], agora);
  assert.equal(lerCabecalho(texto).campos.has('sessao'), false);
  assert.deepEqual(verificarUuid(texto), []);
});

test('esboço de passagem traz só o cabeçalho e a nota de retida', () => {
  const texto = esboco(PASSAGEM, passagemOriginal(), ['cpf'], agora);
  assert.deepEqual(detectar(texto), []);
  assert.deepEqual(verificarUuid(texto), []);
  const { campos } = lerCabecalho(texto);
  assert.equal(campos.get('atualizada'), '2026-11-05T21:40-03:00');
  assert.equal(campos.get('por'), 'claude-code · claude-opus-5-5');
  assert.equal(campos.get('sessao_aberta'), 'sim');
  assert.ok(campos.has('sessao'));
  assert.doesNotMatch(texto, /## Onde parou/);
  assert.match(texto, /Texto retido pela trava em 2026-11-06\./);
});

test('reter move o arquivo para <raiz>/<slug>/<data>-<nome> e grava o esboço no lugar', () => {
  const original = entradaOriginal();
  const raizClone = clone({ [ENTRADA]: original });
  const raizRetidas = join(pastaTemporaria(), 'retidas');
  const { destino } = reter({ raizClone, caminho: ENTRADA, raizRetidas, padroes: ['cpf'], agora });
  assert.equal(destino, join(raizRetidas, 'minha-frente', '2026-11-06T14-30-05-2026-11-05-turno.md'));
  assert.equal(readFileSync(destino, 'utf8'), original);
  const noLugar = readFileSync(join(raizClone, ENTRADA), 'utf8');
  assert.equal(noLugar, esboco(ENTRADA, original, ['cpf'], agora));
  assert.deepEqual(detectar(noLugar), []);
  assert.deepEqual(readdirSync(join(raizClone, 'frentes/minha-frente/memoria')), ['2026-11-05-turno.md']);
});

test('reter não sobrescreve retida anterior', () => {
  const raizClone = clone({ [ENTRADA]: entradaOriginal() });
  const raizRetidas = join(pastaTemporaria(), 'retidas');
  const primeira = reter({ raizClone, caminho: ENTRADA, raizRetidas, padroes: ['cpf'], agora });
  const segundoOriginal = entradaOriginal();
  writeFileSync(join(raizClone, ENTRADA), segundoOriginal);
  const segunda = reter({ raizClone, caminho: ENTRADA, raizRetidas, padroes: ['cpf'], agora });
  assert.equal(segunda.destino, `${primeira.destino}-2`);
  assert.equal(readFileSync(segunda.destino, 'utf8'), segundoOriginal);
  assert.notEqual(readFileSync(primeira.destino, 'utf8'), segundoOriginal);
});

test('reter falha sem tocar no original quando a raiz é um arquivo', () => {
  const original = entradaOriginal();
  const raizClone = clone({ [ENTRADA]: original });
  const raizRetidas = join(pastaTemporaria(), 'arquivo');
  writeFileSync(raizRetidas, 'não é pasta');
  assert.throws(
    () => reter({ raizClone, caminho: ENTRADA, raizRetidas, padroes: ['cpf'], agora }),
    (erro) => erro.code === 'RETENCAO_FALHOU',
  );
  assert.equal(readFileSync(join(raizClone, ENTRADA), 'utf8'), original);
});

test('raizRetidasPadrao respeita VALLUS_RETIDAS', () => {
  const anterior = process.env.VALLUS_RETIDAS;
  process.env.VALLUS_RETIDAS = join(tmpdir(), 'outra-raiz');
  try {
    assert.equal(raizRetidasPadrao(), join(tmpdir(), 'outra-raiz'));
  } finally {
    if (anterior === undefined) delete process.env.VALLUS_RETIDAS;
    else process.env.VALLUS_RETIDAS = anterior;
  }
});

test('garantirRaiz com padrao deixa uma única entrada na ACL', { skip: process.platform !== 'win32' }, () => {
  const raiz = join(pastaTemporaria(), 'nova', 'retidas');
  try {
    garantirRaiz(raiz, { padrao: true });
    assert.ok(existsSync(raiz));
    const saida = execFileSync('icacls', [raiz], { encoding: 'utf8' });
    const usuario = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
    const entradas = saida.split(/\r?\n/).filter((linha) => /\(\w+\)/.test(linha));
    assert.equal(entradas.length, 1);
    assert.ok(entradas[0].includes(`${usuario}:(OI)(CI)(F)`));
    assert.doesNotMatch(saida, /\(I\)/);
  } finally {
    rmSync(join(raiz, '..', '..'), { recursive: true, force: true });
  }
});
