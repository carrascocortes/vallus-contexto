import { test } from 'node:test';
import assert from 'node:assert/strict';
import { semIndice } from '../.githooks/lib/indice.mjs';

const indice = '- [Uma](licoes/abc.md) — quando vale\n- [Outra](referencias/ref.md) — onde está\n';

test('lição sem linha é devolvida', () => {
  assert.deepEqual(semIndice(['memoria/licoes/nova.md'], indice), ['memoria/licoes/nova.md']);
});

test('lição com linha passa', () => {
  assert.deepEqual(semIndice(['memoria/licoes/abc.md'], indice), []);
});

test('referência com linha passa e sem linha é devolvida', () => {
  assert.deepEqual(semIndice(['memoria/referencias/ref.md', 'memoria/referencias/solta.md'], indice), ['memoria/referencias/solta.md']);
});

test('outros caminhos são ignorados', () => {
  assert.deepEqual(semIndice(['memoria/licoes/.gitkeep', 'memoria/referencias/.gitkeep', 'memoria/entrada.md', 'docs/licoes/x.md'], indice), []);
});

test('nome parecido não conta', () => {
  assert.deepEqual(semIndice(['memoria/licoes/ab.md'], indice), ['memoria/licoes/ab.md']);
  assert.deepEqual(semIndice(['memoria/licoes/abcd.md'], indice), ['memoria/licoes/abcd.md']);
});

test('pasta ou extensão parecida não conta', () => {
  const parecido = '- [A](sublicoes/abc.md)\n- [B](licoes/abc.md.old)\n';
  assert.deepEqual(semIndice(['memoria/licoes/abc.md'], parecido), ['memoria/licoes/abc.md']);
});

test('link com ./, âncora ou título conta', () => {
  assert.deepEqual(semIndice(['memoria/licoes/x.md'], '- [X](./licoes/x.md)'), []);
  assert.deepEqual(semIndice(['memoria/licoes/x.md'], '- [X](licoes/x.md#ancora)'), []);
  assert.deepEqual(semIndice(['memoria/licoes/x.md'], '- [X](licoes/x.md "titulo")'), []);
});

test('link dentro de comentário HTML não conta', () => {
  assert.deepEqual(semIndice(['memoria/licoes/x.md'], '<!--\n- [X](licoes/x.md)\n-->\n'), ['memoria/licoes/x.md']);
});
