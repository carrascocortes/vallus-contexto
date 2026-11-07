import { randomBytes, randomInt, randomUUID } from 'node:crypto';

const ALFANUMERICOS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const BASE64_URL = `${ALFANUMERICOS}_-`;
const MAIUSCULAS_E_DIGITOS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function sorteio(alfabeto, tamanho) {
  let saida = '';
  for (let i = 0; i < tamanho; i += 1) saida += alfabeto[randomInt(alfabeto.length)];
  return saida;
}

function digitosSorteados(quantidade) {
  let digitos;
  do {
    digitos = Array.from({ length: quantidade }, () => randomInt(10));
  } while (digitos.every((d) => d === digitos[0]));
  return digitos;
}

function digitoVerificador(valores, pesos) {
  const soma = valores.reduce((total, valor, i) => total + valor * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function comVerificadores(base, pesosPrimeiro, pesosSegundo) {
  const primeiro = digitoVerificador(base, pesosPrimeiro);
  const segundo = digitoVerificador([...base, primeiro], pesosSegundo);
  return [...base, primeiro, segundo];
}

const PESOS_CNPJ_PRIMEIRO = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_SEGUNDO = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function cpfValido() {
  const base = digitosSorteados(9);
  return comVerificadores(base, [10, 9, 8, 7, 6, 5, 4, 3, 2], [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]).join('');
}

export function cnpjValido() {
  const base = digitosSorteados(12);
  return comVerificadores(base, PESOS_CNPJ_PRIMEIRO, PESOS_CNPJ_SEGUNDO).join('');
}

export function cnpjAlfanumericoValido() {
  const letra = sorteio('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 1);
  const base = letra + sorteio(MAIUSCULAS_E_DIGITOS, 11);
  const valores = [...base].map((caractere) => caractere.charCodeAt(0) - 48);
  const verificadores = comVerificadores(valores, PESOS_CNPJ_PRIMEIRO, PESOS_CNPJ_SEGUNDO).slice(12);
  return base + verificadores.join('');
}

export function cuid() {
  return 'c' + sorteio('abcdefghijklmnopqrstuvwxyz0123456789', 24);
}

export function uuid() {
  return randomUUID();
}

export function chaveGithub(tipo = 'p') {
  return 'gh' + tipo + '_' + sorteio(ALFANUMERICOS, 36);
}

export function chaveGithubGranular() {
  return 'github_' + 'pat_' + sorteio(ALFANUMERICOS, 22) + '_' + sorteio(ALFANUMERICOS, 59);
}

export function chaveAnthropic() {
  return 'sk-' + 'ant-' + 'api03-' + sorteio(BASE64_URL, 48);
}

export function chaveGoogle() {
  return 'AI' + 'za' + sorteio(BASE64_URL, 35);
}

export function chaveSupabase() {
  return 'sb_' + 'secret_' + sorteio(BASE64_URL, 32);
}

export function chaveAsaas() {
  return '$aa' + 'ct_' + sorteio(ALFANUMERICOS + '_', 40);
}

export function chaveResend() {
  return 're' + '_' + sorteio(ALFANUMERICOS, 8) + '_' + sorteio(ALFANUMERICOS, 24);
}

export function chaveKimi() {
  return 'sk' + '-' + sorteio(ALFANUMERICOS, 48);
}

export function pem() {
  const borda = '-'.repeat(5);
  const tipo = 'RSA PRIVATE' + ' KEY';
  const corpo = randomBytes(48).toString('base64');
  return `${borda}BEGIN ${tipo}${borda}\n${corpo}\n${borda}END ${tipo}${borda}`;
}

export function jwt() {
  const parte = (objeto) => Buffer.from(JSON.stringify(objeto)).toString('base64url');
  const assinatura = randomBytes(32).toString('base64url');
  return [parte({ alg: 'HS256', typ: 'JWT' }), parte({ sub: sorteio(ALFANUMERICOS, 8) }), assinatura].join('.');
}

export function conexaoComSenha() {
  return 'postgres' + '://' + 'app' + ':' + sorteio(ALFANUMERICOS, 16) + '@' + 'banco.exemplo.test' + ':5432/db';
}

export function conexaoSemUsuario() {
  return 'redis' + '://' + ':' + sorteio(ALFANUMERICOS, 16) + '@' + 'cache.exemplo.test' + ':6379';
}

export function emailDeFora() {
  return sorteio('abcdefghijklmnopqrstuvwxyz', 8) + '@' + 'exemplo' + '.org';
}

export function chaveDeAcesso() {
  return 'AKI' + 'A' + sorteio(MAIUSCULAS_E_DIGITOS, 16);
}

export function chaveDatabricks() {
  return 'dapi' + randomBytes(16).toString('hex');
}
