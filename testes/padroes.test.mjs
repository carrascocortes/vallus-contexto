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

test('barra CNPJ alfanumérico com e sem pontuação', () => {
  const cnpj = gerar.cnpjAlfanumericoValido();
  assert.deepEqual(nomes('x ' + cnpj), ['cnpj']);
  assert.deepEqual(nomes('x ' + comPontuacaoDeCnpj(cnpj)), ['cnpj']);
});

test('não barra CNPJ alfanumérico com dígito verificador errado', () => {
  assert.deepEqual(nomes('x ' + comUltimoDigitoErrado(gerar.cnpjAlfanumericoValido())), []);
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

test('não barra pacote@versão', () => {
  for (const referencia of ['next@16.4.2', '@sentry/nextjs@10.76.2', 'actions/checkout@v4.2.2']) {
    assert.deepEqual(nomes(`dependência ${referencia}`), [], referencia);
  }
});

test('barra cuid', () => {
  assert.deepEqual(nomes('id ' + gerar.cuid()), ['id-producao']);
});

test('não barra UUID', () => {
  assert.deepEqual(nomes('id ' + gerar.uuid()), []);
});

test('não barra SHA de 40 nem de 7 caracteres', () => {
  const sha = 'c' + randomBytes(20).toString('hex').slice(1);
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

test('barra conexão com senha, com e sem usuário', () => {
  assert.deepEqual(nomes('url ' + gerar.conexaoComSenha()), ['conexao-com-senha']);
  assert.deepEqual(nomes('url ' + gerar.conexaoSemUsuario()), ['conexao-com-senha']);
});

test('não barra URL sem senha', () => {
  assert.deepEqual(nomes('https://github.com/carrascocortes/vallus-contexto'), []);
});

test('barra chave de API de provedor', () => {
  const geradores = {
    github: gerar.chaveGithub,
    'github com prefixo gho': () => gerar.chaveGithub('o'),
    'github granular': gerar.chaveGithubGranular,
    anthropic: gerar.chaveAnthropic,
    google: gerar.chaveGoogle,
    supabase: gerar.chaveSupabase,
    asaas: gerar.chaveAsaas,
    resend: gerar.chaveResend,
    kimi: gerar.chaveKimi,
  };
  for (const [provedor, gerador] of Object.entries(geradores)) {
    assert.deepEqual(nomes('chave ' + gerador()), ['chave-api'], provedor);
  }
});

test('nunca devolve o valor', () => {
  const soOGitleaksBarra = ['uuid', 'chaveDeAcesso', 'chaveDatabricks'];
  const geradoresBarrados = Object.entries(gerar).filter(([nome]) => !soOGitleaksBarra.includes(nome));
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

test('entrada hostil de 400 mil caracteres termina em menos de 2 s', () => {
  const entradas = {
    'só a': 'a'.repeat(400_000),
    'base64 sem barra': randomBytes(300_000).toString('base64').replaceAll('/', 'A'),
    'eyJ- repetido': 'eyJ-'.repeat(100_000),
    'a. repetido': 'a.'.repeat(200_000),
  };
  for (const [nome, texto] of Object.entries(entradas)) {
    const inicio = performance.now();
    detectar(texto);
    const duracao = performance.now() - inicio;
    assert.ok(duracao < 2000, `${nome} levou ${Math.round(duracao)} ms`);
  }
});

const montar = (...partes) => partes.join('');

test('não barra string de conexão com placeholder no lugar da senha', () => {
  const passam = [
    'postgres://app:<senha>@db.exemplo.com:5432/x',
    'postgresql://u:[senha]@host/db',
    'mysql://root:${DB_PASSWORD}@127.0.0.1/x',
    'redis://:$REDIS_PASS@localhost:6379',
    'postgres://joao.silva:<senha>@empresa.com.br/db',
  ];
  for (const conexao of passam) assert.deepEqual(nomes(`url ${conexao}`), [], conexao);
});

test('barra conexão cuja senha só lembra um placeholder, e senha real em loopback', () => {
  const barradas = {
    'dígito no placeholder': montar('postgres', '://', 'app', ':', '<senha1>', '@', 'host/db'),
    'placeholder de 31 letras': montar('postgres', '://', 'app', ':', '<', 'a'.repeat(31), '>', '@', 'host/db'),
    'variável minúscula': montar('postgres', '://', 'app', ':', '$db_pass', '@', 'host/db'),
    'variável entre chaves minúscula': montar('postgres', '://', 'app', ':', '${db_pass}', '@', 'host/db'),
    'senha real em loopback': montar('postgres', '://', 'app', ':', gerar.conexaoComSenha().split(':')[2].split('@')[0], '@', '127.0.0.1:5432/db'),
  };
  for (const [nome, conexao] of Object.entries(barradas)) {
    assert.deepEqual(nomes(`url ${conexao}`), ['conexao-com-senha'], nome);
  }
});

test('noreply só passa nos dois endereços exatos', () => {
  for (const email of ['noreply@anthropic.com', 'noreply@github.com', 'NoReply@GitHub.com']) {
    assert.deepEqual(nomes(`autor ${email}`), [], email);
  }
  const alheios = [montar('no-reply', '@', 'servico.exemplo.org'), montar('noreply', '@', 'cliente', '.com.br'), montar('no-reply', '@', 'github.com')];
  for (const email of alheios) assert.deepEqual(nomes(`autor ${email}`), ['email'], email);
});

test('carimbo de data e hora de 14 dígitos não conta como CNPJ', () => {
  assert.deepEqual(nomes('migration 20261103120100'), []);
  assert.deepEqual(nomes('migration 20261024120000'), []);
});

test('CNPJ de 14 dígitos fora da janela de data e hora continua barrado', () => {
  assert.deepEqual(nomes('x ' + montar('11222333', '000181')), ['cnpj']);
  assert.deepEqual(nomes('x ' + montar('20260230', '000016')), ['cnpj']);
  const pontuado = montar('20', '.', '261', '.', '103', '/', '1201', '-', '00');
  assert.deepEqual(nomes('x ' + pontuado), ['cnpj']);
});
