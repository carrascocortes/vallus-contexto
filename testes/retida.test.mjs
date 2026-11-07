import { after, test } from 'node:test';
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
const NO_WINDOWS = { skip: process.platform !== 'win32' };

const pastasCriadas = [];

function pastaTemporaria() {
  const pasta = mkdtempSync(join(tmpdir(), 'retida-'));
  pastasCriadas.push(pasta);
  return pasta;
}

after(() => {
  for (const pasta of pastasCriadas) rmSync(pasta, { recursive: true, force: true });
});

function comAmbiente(alteracoes, corpo) {
  const anterior = Object.fromEntries(Object.keys(alteracoes).map((chave) => [chave, process.env[chave]]));
  const aplicar = (valores) => {
    for (const [chave, valor] of Object.entries(valores)) {
      if (valor === undefined) delete process.env[chave];
      else process.env[chave] = valor;
    }
  };
  aplicar(alteracoes);
  try {
    return corpo();
  } finally {
    aplicar(anterior);
  }
}

function entradasDaAcl(raiz) {
  const saida = execFileSync('icacls', [raiz], { encoding: 'utf8' });
  return { saida, entradas: saida.split(/\r?\n/).filter((linha) => /\(\w+\)/.test(linha)) };
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

function passagemOriginal(sessao = uuid()) {
  return [
    '---',
    'atualizada: 2026-11-05T21:40-03:00',
    'por: claude-code · claude-opus-5-5',
    `sessao: ${sessao}`,
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
  assert.equal(ehRetivel('frentes/../passagem.md'), false);
  assert.equal(ehRetivel('frentes/./passagem.md'), false);
  assert.equal(ehRetivel('frentes/a b/passagem.md'), false);
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

test('esboço descarta campo que só o gitleaks barraria', () => {
  const chaveDeAcesso = 'AKI' + 'A' + 'ABCDEFGHIJKLMNOP';
  const texto = esboco(ENTRADA, entradaOriginal({ autor: chaveDeAcesso }), ['cpf'], agora);
  assert.equal(lerCabecalho(texto).campos.has('autor'), false);
  assert.ok(!texto.includes(chaveDeAcesso));
});

test('esboço descarta campo fora do formato estrito', () => {
  const original = entradaOriginal()
    .replace('ferramenta: claude-code', 'ferramenta: outra')
    .replace('data: 2026-11-05T22:10-03:00', 'data: ontem');
  const { campos } = lerCabecalho(esboco(ENTRADA, original, ['cpf'], agora));
  assert.equal(campos.has('ferramenta'), false);
  assert.equal(campos.has('data'), false);
  assert.equal(campos.get('modelo'), 'claude-opus-5-5');
});

test('esboço descarta sessão que não é exatamente um UUID', () => {
  const texto = esboco(ENTRADA, entradaOriginal({ sessao: `${uuid()} ${uuid()}` }), ['uuid'], agora);
  assert.equal(lerCabecalho(texto).campos.has('sessao'), false);
  assert.deepEqual(verificarUuid(texto), []);
});

test('esboço lista cada padrão uma vez no motivo', () => {
  const texto = esboco(ENTRADA, entradaOriginal(), ['cpf', 'email', 'cpf'], agora);
  assert.equal(lerCabecalho(texto).campos.get('motivo'), 'trava: cpf, email');
});

test('esboço de passagem traz só o cabeçalho e a nota de retida', () => {
  const sessao = uuid();
  const texto = esboco(PASSAGEM, passagemOriginal(sessao), ['cpf'], agora);
  assert.equal(
    texto,
    [
      '---',
      'atualizada: 2026-11-05T21:40-03:00',
      'por: claude-code · claude-opus-5-5',
      `sessao: ${sessao}`,
      'sessao_aberta: sim',
      '---',
      'Texto retido pela trava em 2026-11-06. Está fora do repositório até o PO liberar.',
      '',
    ].join('\n'),
  );
  const { campos } = lerCabecalho(texto);
  assert.equal(campos.has('desfecho'), false);
  assert.equal(campos.has('motivo'), false);
  assert.deepEqual(detectar(texto), []);
  assert.deepEqual(verificarUuid(texto), []);
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
  assert.equal(segunda.destino, primeira.destino.replace(/\.md$/, '-2.md'));
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

test('reter recusa caminho que não é entrada nem passagem', () => {
  const raizClone = clone({ 'frentes/minha-frente/frente.md': 'texto' });
  assert.throws(
    () => reter({ raizClone, caminho: 'frentes/minha-frente/frente.md', raizRetidas: join(pastaTemporaria(), 'r'), padroes: ['cpf'], agora }),
    (erro) => erro.code === 'RETENCAO_FALHOU',
  );
});

test('reter recusa raizRetidas dentro do clone', () => {
  const original = entradaOriginal();
  const raizClone = clone({ [ENTRADA]: original });
  assert.throws(
    () => reter({ raizClone, caminho: ENTRADA, raizRetidas: join(raizClone, 'retidas'), padroes: ['cpf'], agora }),
    (erro) => erro.code === 'RETENCAO_FALHOU',
  );
  assert.equal(readFileSync(join(raizClone, ENTRADA), 'utf8'), original);
  assert.equal(existsSync(join(raizClone, 'retidas')), false);
});

test('raizRetidasPadrao respeita VALLUS_RETIDAS', () => {
  const outra = join(tmpdir(), 'outra-raiz');
  comAmbiente({ VALLUS_RETIDAS: outra }, () => assert.equal(raizRetidasPadrao(), outra));
});

test('garantirRaiz com padrao deixa uma única entrada na ACL', NO_WINDOWS, () => {
  const raiz = join(pastaTemporaria(), 'nova', 'retidas');
  garantirRaiz(raiz, { padrao: true });
  const { saida, entradas } = entradasDaAcl(raiz);
  assert.equal(entradas.length, 1);
  assert.ok(entradas[0].includes(`${process.env.USERDOMAIN}\\${process.env.USERNAME}:(OI)(CI)(F)`));
  assert.doesNotMatch(saida, /\(I\)/);
  assert.deepEqual(readdirSync(join(raiz, '..')), ['retidas']);
});

test('garantirRaiz com padrao falha sem deixar a raiz e acerta na chamada seguinte', NO_WINDOWS, () => {
  const raiz = join(pastaTemporaria(), 'retidas');
  assert.throws(
    () => comAmbiente({ USERNAME: '' }, () => garantirRaiz(raiz, { padrao: true })),
    (erro) => erro.code === 'RETENCAO_FALHOU',
  );
  assert.equal(existsSync(raiz), false);
  assert.deepEqual(readdirSync(join(raiz, '..')), []);
  garantirRaiz(raiz, { padrao: true });
  assert.equal(entradasDaAcl(raiz).entradas.length, 1);
});

test('reter na raiz padrão aplica a ACL, sem tocar a raiz real', NO_WINDOWS, () => {
  const dadosLocais = pastaTemporaria();
  const raizClone = clone({ [ENTRADA]: entradaOriginal() });
  comAmbiente({ LOCALAPPDATA: dadosLocais, VALLUS_RETIDAS: undefined }, () => {
    const raizRetidas = raizRetidasPadrao();
    assert.equal(raizRetidas, join(dadosLocais, 'vallus-office', 'retidas'));
    reter({ raizClone, caminho: ENTRADA, raizRetidas, padroes: ['cpf'], agora });
    assert.equal(entradasDaAcl(raizRetidas).entradas.length, 1);
  });
});
