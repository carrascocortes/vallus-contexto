import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contemUuid, lerCabecalho, verificarUuid } from '../.githooks/lib/cabecalho.mjs';
import { uuid } from './gerar.mjs';

const BOM = String.fromCharCode(0xfeff);
const padroes = (texto) => verificarUuid(texto).map((achado) => achado.padrao);
const modelo = (nome) => readFileSync(new URL(`../modelos/${nome}.md`, import.meta.url), 'utf8');

test('aceita UUID no campo sessao do cabeçalho', () => {
  assert.deepEqual(verificarUuid(`---\nsessao: ${uuid()}\n---\ncorpo`), []);
});

test('aceita UUID maiúsculo no campo e barra no corpo', () => {
  const maiusculo = uuid().toUpperCase();
  assert.deepEqual(verificarUuid(`---\nsessao: ${maiusculo}\n---\ncorpo`), []);
  assert.deepEqual(padroes(`---\na: b\n---\n${maiusculo}`), ['uuid-fora-do-cabecalho']);
});

test('barra UUID no corpo', () => {
  assert.deepEqual(verificarUuid(`---\na: b\n---\nid ${uuid()}`), [{ padrao: 'uuid-fora-do-cabecalho', linha: 4 }]);
});

test('barra UUID colado em texto', () => {
  assert.deepEqual(padroes(`---\na: b\n---\nx${uuid()}y`), ['uuid-fora-do-cabecalho']);
});

test('barra linha sessao com UUID no corpo', () => {
  assert.deepEqual(padroes(`---\na: b\n---\nsessao: ${uuid()}`), ['uuid-fora-do-cabecalho']);
});

test('barra UUID num segundo bloco ---', () => {
  assert.deepEqual(padroes(`---\na: b\n---\ncorpo\n---\nsessao: ${uuid()}\n---\n`), ['uuid-fora-do-cabecalho']);
});

test('fechamento com espaço no fim ainda fecha o cabeçalho', () => {
  assert.deepEqual(padroes(`---\ndata: x\n--- \ncorpo\nsessao: ${uuid()}\n---\n`), ['uuid-fora-do-cabecalho']);
  assert.equal(lerCabecalho('---\ndata: x\n---\t\ncorpo\n---\n').fimDaLinha, 3);
});

test('abertura com espaço no fim abre o cabeçalho', () => {
  assert.deepEqual(verificarUuid(`--- \nsessao: ${uuid()}\n---\n`), []);
});

test('barra UUID em linha comentada de sessao dentro do cabeçalho', () => {
  assert.deepEqual(padroes(`---\n# sessao: ${uuid()}\n---\n`), ['sessao-invalida']);
});

test('barra UUID em outro campo do cabeçalho', () => {
  assert.deepEqual(padroes(`---\nautor: ${uuid()}\n---\n`), ['uuid-fora-do-cabecalho']);
});

test('barra sessao com maiúscula ou espaço antes dos dois-pontos', () => {
  assert.deepEqual(padroes(`---\nSessao: ${uuid()}\n---\n`), ['sessao-invalida']);
  assert.deepEqual(padroes(`---\nsessao : ${uuid()}\n---\n`), ['sessao-invalida']);
});

test('barra dois UUIDs no campo', () => {
  assert.deepEqual(padroes(`---\nsessao: ${uuid()} ${uuid()}\n---\n`), ['sessao-invalida']);
});

test('barra sessao repetida no cabeçalho', () => {
  assert.deepEqual(verificarUuid(`---\nsessao: ${uuid()}\nsessao: ${uuid()}\n---\n`), [{ padrao: 'sessao-invalida', linha: 3 }]);
});

test('barra sessao com UUID depois de sessao sem UUID', () => {
  assert.deepEqual(verificarUuid(`---\nsessao: <id>\nsessao: ${uuid()}\n---\n`), [{ padrao: 'sessao-invalida', linha: 3 }]);
});

test('barra linha sessao com texto além do UUID', () => {
  assert.deepEqual(padroes(`---\nsessao: ${uuid()} extra\n---\n`), ['sessao-invalida']);
  assert.deepEqual(padroes(`---\nsessao: ${uuid()} # nota\n---\n`), ['sessao-invalida']);
});

test('aceita sessao: <id> dos modelos', () => {
  assert.deepEqual(verificarUuid('---\n# sessao é o único campo onde o UUID é aceito\nsessao: <id>\n---\ncorpo'), []);
});

test('aceita cabeçalho com BOM e CRLF', () => {
  assert.deepEqual(verificarUuid(`${BOM}---\r\nsessao: ${uuid()}\r\n---\r\ncorpo`), []);
});

test('arquivo sem cabeçalho: todo UUID é corpo', () => {
  assert.deepEqual(padroes(`sessao: ${uuid()}\n---\nsessao: ${uuid()}\n---\n`), ['uuid-fora-do-cabecalho', 'uuid-fora-do-cabecalho']);
});

test('cabeçalho sem fechamento não existe', () => {
  assert.equal(lerCabecalho(`---\nsessao: ${uuid()}\n`), null);
  assert.deepEqual(padroes(`---\nsessao: ${uuid()}\n`), ['uuid-fora-do-cabecalho']);
});

test('lerCabecalho devolve campos sem comentários e a linha do fechamento', () => {
  const lido = lerCabecalho(`${BOM}---\r\n# comentário\r\n\r\nautor: sessão manual   # ou outro\r\nmotivo:\r\nautor: depois\r\n---\r\ncorpo`);
  assert.equal(lido.fimDaLinha, 7);
  assert.deepEqual([...lido.campos], [['autor', 'sessão manual'], ['motivo', '']]);
});

test('lerCabecalho devolve vazio para campo que só tem comentário', () => {
  const lido = lerCabecalho('---\na: # só comentário\nb:# colado\nc: valor # nota\n---\n');
  assert.deepEqual([...lido.campos], [['a', ''], ['b', ''], ['c', 'valor']]);
});

test('lerCabecalho lê vazios os campos opcionais dos modelos', () => {
  assert.equal(lerCabecalho(modelo('entrada')).campos.get('motivo'), '');
  assert.equal(lerCabecalho(modelo('decisao')).campos.get('substituida_por'), '');
  assert.equal(lerCabecalho(modelo('frente')).campos.get('encerrada'), '');
});

test('lerCabecalho devolve null sem a abertura exata', () => {
  assert.equal(lerCabecalho('corpo\n---\na: b\n---\n'), null);
  assert.equal(lerCabecalho('----\na: b\n---\n'), null);
});

test('contemUuid reconhece UUID em qualquer posição', () => {
  assert.equal(contemUuid(`x ${uuid()} y`), true);
  assert.equal(contemUuid('sessao: <id>'), false);
});
