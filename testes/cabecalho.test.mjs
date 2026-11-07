import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerCabecalho, verificarUuid } from '../.githooks/lib/cabecalho.mjs';
import { uuid } from './gerar.mjs';

const padroes = (texto) => verificarUuid(texto).map((achado) => achado.padrao);

test('aceita UUID no campo sessao do cabeçalho', () => {
  assert.deepEqual(verificarUuid(`---\nsessao: ${uuid()}\n---\ncorpo`), []);
});

test('barra UUID no corpo', () => {
  assert.deepEqual(verificarUuid(`---\na: b\n---\nid ${uuid()}`), [{ padrao: 'uuid-fora-do-cabecalho', linha: 4 }]);
});

test('barra linha sessao com UUID no corpo', () => {
  assert.deepEqual(padroes(`---\na: b\n---\nsessao: ${uuid()}`), ['uuid-fora-do-cabecalho']);
});

test('barra UUID num segundo bloco ---', () => {
  assert.deepEqual(padroes(`---\na: b\n---\ncorpo\n---\nsessao: ${uuid()}\n---\n`), ['uuid-fora-do-cabecalho']);
});

test('barra UUID em comentário dentro do cabeçalho', () => {
  assert.deepEqual(padroes(`---\n# sessao: ${uuid()}\n---\n`), ['uuid-fora-do-cabecalho']);
});

test('barra dois UUIDs no campo', () => {
  assert.deepEqual(padroes(`---\nsessao: ${uuid()} ${uuid()}\n---\n`), ['sessao-invalida']);
});

test('barra sessao repetida no cabeçalho', () => {
  assert.deepEqual(verificarUuid(`---\nsessao: ${uuid()}\nsessao: ${uuid()}\n---\n`), [{ padrao: 'sessao-invalida', linha: 3 }]);
});

test('barra linha sessao com texto além do UUID', () => {
  assert.deepEqual(padroes(`---\nsessao: ${uuid()} extra\n---\n`), ['sessao-invalida']);
  assert.deepEqual(padroes(`---\nsessao: ${uuid()} # nota\n---\n`), ['sessao-invalida']);
});

test('aceita sessao: <id> dos modelos', () => {
  assert.deepEqual(verificarUuid('---\n# sessao é o único campo onde o UUID é aceito\nsessao: <id>\n---\ncorpo'), []);
});

test('aceita cabeçalho com BOM e CRLF', () => {
  assert.deepEqual(verificarUuid(`﻿---\r\nsessao: ${uuid()}\r\n---\r\ncorpo`), []);
});

test('arquivo sem cabeçalho: todo UUID é corpo', () => {
  assert.deepEqual(padroes(`sessao: ${uuid()}\n---\nsessao: ${uuid()}\n---\n`), ['uuid-fora-do-cabecalho', 'uuid-fora-do-cabecalho']);
});

test('cabeçalho sem fechamento não existe', () => {
  assert.equal(lerCabecalho(`---\nsessao: ${uuid()}\n`), null);
  assert.deepEqual(padroes(`---\nsessao: ${uuid()}\n`), ['uuid-fora-do-cabecalho']);
});

test('lerCabecalho devolve campos sem comentários e a linha do fechamento', () => {
  const lido = lerCabecalho('﻿---\r\n# comentário\r\n\r\nautor: sessão manual   # ou outro\r\nmotivo:\r\nautor: depois\r\n---\r\ncorpo');
  assert.equal(lido.fimDaLinha, 7);
  assert.deepEqual([...lido.campos], [['autor', 'sessão manual'], ['motivo', '']]);
});

test('lerCabecalho devolve null sem a abertura exata', () => {
  assert.equal(lerCabecalho('corpo\n---\na: b\n---\n'), null);
  assert.equal(lerCabecalho('--- \na: b\n---\n'), null);
});
