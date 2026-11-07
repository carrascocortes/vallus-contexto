const EMAILS_PERMITIDOS = new Set(['carrasco.cortes@gmail.com', 'git@github.com']);
const DOMINIOS_DA_CASA = new Set(['vallusgrc.com.br', 'verusgrc.com.br']);
const LOCAIS_SEM_PESSOA = new Set(['noreply', 'no-reply']);

const PADROES_POR_FORMATO = [
  ['id-producao', /\bc[a-z0-9]{24}\b/g],
  ['id-producao', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi],
  ['pem', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ['jwt', /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g],
  ['chave-api', /(?<![A-Za-z0-9])[g][h][pousr]_[A-Za-z0-9]{36}(?![A-Za-z0-9])/g],
  ['chave-api', /(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{22,}/g],
  ['chave-api', /(?<![A-Za-z0-9])sk-ant-[A-Za-z0-9_-]{20,}/g],
  ['chave-api', /(?<![A-Za-z0-9])AIza[A-Za-z0-9_-]{35}(?![A-Za-z0-9_-])/g],
];

const CONEXAO_COM_SENHA = /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@/]+@/gi;
const CANDIDATO_A_CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const CANDIDATO_A_CNPJ = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
const CANDIDATO_A_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

function digitosDe(texto) {
  return [...texto.replace(/\D/g, '')].map(Number);
}

function digitoVerificador(digitos, pesos) {
  const soma = digitos.reduce((total, digito, i) => total + digito * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function verificadoresConferem(digitos, tamanhoBase, pesosPrimeiro, pesosSegundo) {
  const base = digitos.slice(0, tamanhoBase);
  const primeiro = digitoVerificador(base, pesosPrimeiro);
  const segundo = digitoVerificador([...base, primeiro], pesosSegundo);
  return digitos[tamanhoBase] === primeiro && digitos[tamanhoBase + 1] === segundo;
}

function cpfValido(candidato) {
  const digitos = digitosDe(candidato);
  if (digitos.every((digito) => digito === digitos[0])) return false;
  return verificadoresConferem(digitos, 9, [10, 9, 8, 7, 6, 5, 4, 3, 2], [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
}

function cnpjValido(candidato) {
  const digitos = digitosDe(candidato);
  if (digitos.every((digito) => digito === digitos[0])) return false;
  return verificadoresConferem(
    digitos,
    12,
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
}

function emailPermitido(email) {
  const minusculo = email.toLowerCase();
  if (EMAILS_PERMITIDOS.has(minusculo)) return true;
  const arroba = minusculo.lastIndexOf('@');
  const local = minusculo.slice(0, arroba);
  const dominio = minusculo.slice(arroba + 1);
  return LOCAIS_SEM_PESSOA.has(local) || DOMINIOS_DA_CASA.has(dominio) || dominio.endsWith('.noreply.github.com');
}

function ocorrencias(texto, regex) {
  return [...texto.matchAll(regex)].map((ocorrencia) => ({
    inicio: ocorrencia.index,
    fim: ocorrencia.index + ocorrencia[0].length,
    trecho: ocorrencia[0],
  }));
}

function linhaDe(texto, posicao) {
  let linha = 1;
  for (let i = texto.indexOf('\n'); i !== -1 && i < posicao; i = texto.indexOf('\n', i + 1)) linha += 1;
  return linha;
}

/**
 * Procura conteúdo que não pode entrar no histórico. Devolve só o nome do padrão e a linha:
 * o trecho casado nunca sai daqui, para que a mensagem da trava não republique o segredo.
 */
export function detectar(texto) {
  const achados = [];
  const registrar = (padrao, inicio) => achados.push({ padrao, linha: linhaDe(texto, inicio) });

  const conexoes = ocorrencias(texto, CONEXAO_COM_SENHA);
  for (const { inicio } of conexoes) registrar('conexao-com-senha', inicio);

  for (const { inicio, trecho } of ocorrencias(texto, CANDIDATO_A_CPF)) {
    if (cpfValido(trecho)) registrar('cpf', inicio);
  }
  for (const { inicio, trecho } of ocorrencias(texto, CANDIDATO_A_CNPJ)) {
    if (cnpjValido(trecho)) registrar('cnpj', inicio);
  }
  for (const { inicio, trecho } of ocorrencias(texto, CANDIDATO_A_EMAIL)) {
    const dentroDeConexao = conexoes.some((conexao) => inicio >= conexao.inicio && inicio < conexao.fim);
    if (!dentroDeConexao && !emailPermitido(trecho)) registrar('email', inicio);
  }
  for (const [padrao, regex] of PADROES_POR_FORMATO) {
    for (const { inicio } of ocorrencias(texto, regex)) registrar(padrao, inicio);
  }

  return achados.sort((a, b) => a.linha - b.linha);
}
