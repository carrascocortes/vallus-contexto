import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { detectar } from '../.githooks/lib/padroes.mjs';
import * as gerar from './gerar.mjs';

const nomes = (texto) => detectar(texto).map((achado) => achado.padrao);

function comPontuacaoDeCpf(cpf) {
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

function comPontuacaoDeCnpj(cnpj) {
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

function comUltimoDigitoErrado(numero) {
  const ultimo = (Number(numero.at(-1)) + 1) % 10;
  return numero.slice(0, -1) + ultimo;
}

test('barra CPF com e sem pontuação', () => {
  const cpf = gerar.cpfValido();
  assert.deepEqual(nomes('x ' + cpf), ['cpf']);
  assert.deepEqual(nomes('x ' + comPontuacaoDeCpf(cpf)), ['cpf']);
});

test('não barra CPF com dígito verificador errado nem onze dígitos iguais', () => {
  assert.deepEqual(nomes('x ' + comUltimoDigitoErrado(gerar.cpfValido())), []);
  assert.deepEqual(nomes('x ' + '1'.repeat(11)), []);
});

test('barra CNPJ', () => {
  const cnpj = gerar.cnpjValido();
  assert.deepEqual(nomes('x ' + cnpj), ['cnpj']);
  assert.deepEqual(nomes('x ' + comPontuacaoDeCnpj(cnpj)), ['cnpj']);
});

test('não barra CNPJ com dígito errado', () => {
  assert.deepEqual(nomes('x ' + comUltimoDigitoErrado(gerar.cnpjValido())), []);
});

test('barra e-mail fora da lista', () => {
  assert.deepEqual(nomes('contato ' + gerar.emailDeFora()), ['email']);
});

test('não barra e-mail permitido', () => {
  const permitidos = [
    'alguem@vallusgrc.com.br',
    'alguem@verusgrc.com.br',
    'carrasco.cortes@gmail.com',
    'noreply@anthropic.com',
    '123+nome@users.noreply.github.com',
    'git@github.com',
  ];
  for (const email of permitidos) assert.deepEqual(nomes(`autor ${email}`), [], email);
});

test('barra cuid', () => {
  assert.deepEqual(nomes('id ' + gerar.cuid()), ['id-producao']);
});

test('não barra UUID', () => {
  assert.deepEqual(nomes('id ' + gerar.uuid()), []);
});

test('não barra SHA de 40 nem de 7 caracteres', () => {
  const sha = 'a' + randomBytes(20).toString('hex').slice(1);
  assert.equal(sha.length, 40);
  assert.deepEqual(nomes(`commit ${sha}`), []);
  assert.deepEqual(nomes(`commit ${sha.slice(0, 7)}`), []);
});

test('barra PEM', () => {
  assert.deepEqual(nomes(gerar.pem()), ['pem']);
});

test('barra JWT', () => {
  assert.deepEqual(nomes('token ' + gerar.jwt()), ['jwt']);
});

test('barra conexão com senha', () => {
  assert.deepEqual(nomes('url ' + gerar.conexaoComSenha()), ['conexao-com-senha']);
});

test('não barra URL sem senha', () => {
  assert.deepEqual(nomes('https://github.com/carrascocortes/vallus-contexto'), []);
});

test('barra chave de API de provedor', () => {
  for (const gerador of [gerar.chaveGithub, gerar.chaveAnthropic, gerar.chaveGoogle]) {
    assert.deepEqual(nomes('chave ' + gerador()), ['chave-api'], gerador.name);
  }
});

test('nunca devolve o valor', () => {
  const geradoresBarrados = Object.entries(gerar).filter(([nome]) => nome !== 'uuid');
  for (const [nome, gerador] of geradoresBarrados) {
    const valor = gerador();
    const achados = detectar(`antes ${valor} depois`);
    assert.ok(achados.length > 0, `${nome} não foi detectado`);
    assert.ok(!JSON.stringify(achados).includes(valor), `${nome} vazou no resultado`);
  }
});

test('informa a linha', () => {
  const achados = detectar(`a\nb\nx ${gerar.cpfValido()}\nd`);
  assert.equal(achados.length, 1);
  assert.equal(achados[0].linha, 3);
});
