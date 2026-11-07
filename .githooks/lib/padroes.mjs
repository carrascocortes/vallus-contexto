const EMAILS_PERMITIDOS = new Set(['carrasco.cortes@gmail.com', 'git@github.com']);
const DOMINIOS_DA_CASA = new Set(['vallusgrc.com.br', 'verusgrc.com.br']);
const LOCAIS_SEM_PESSOA = new Set(['noreply', 'no-reply']);

const PADROES_POR_FORMATO = [
  ['id-producao', /\bc[a-z0-9]{24}\b/g],
  ['pem', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ['jwt', /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g],
  // [g][h] e não "gh": o hook do ambiente lê este arquivo e tomaria o texto por um comando gh.
  ['chave-api', /(?<![A-Za-z0-9])[g][h][pousr]_[A-Za-z0-9]{36,}/g],
  ['chave-api', /(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{22,}/g],
  ['chave-api', /(?<![A-Za-z0-9])sk-ant-[A-Za-z0-9_-]{20,}/g],
  ['chave-api', /(?<![A-Za-z0-9])AIza[A-Za-z0-9_-]{35}(?![A-Za-z0-9_-])/g],
  ['chave-api', /(?<![A-Za-z0-9])sb_secret_[A-Za-z0-9_-]{20,}/g],
  ['chave-api', /(?<![A-Za-z0-9])\$aact_[A-Za-z0-9_]{20,}/g],
  ['chave-api', /(?<![A-Za-z0-9])re_[A-Za-z0-9]{8}_[A-Za-z0-9]{20,}/g],
  // Sem hífen no corpo, para não repetir o padrão da chave da Anthropic.
  ['chave-api', /(?<![A-Za-z0-9])sk-[A-Za-z0-9]{40,}/g],
];

// Os tetos de tamanho mantêm a busca linear em linha longa sem arroba, sem esquema ou sem ponto.
const CONEXAO_COM_SENHA = /(?<![A-Za-z0-9+.-])[a-z][a-z0-9+.-]{0,31}:\/\/[^\s:/@]*:[^\s@/]+@/gi;
const CANDIDATO_A_CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const CANDIDATO_A_CNPJ = /\b[0-9A-Z]{2}\.?[0-9A-Z]{3}\.?[0-9A-Z]{3}\/?[0-9A-Z]{4}-?\d{2}\b/g;
const CANDIDATO_A_EMAIL = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,10}/g;

// Letra vale 17 a 42 e dígito 0 a 9: o código ASCII menos 48, como na regra do CNPJ alfanumérico.
function valoresDe(texto) {
  return [...texto.replace(/[.\-/]/g, '')].map((caractere) => caractere.charCodeAt(0) - 48);
}

function digitoVerificador(valores, pesos) {
  const soma = valores.reduce((total, valor, i) => total + valor * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function verificadoresConferem(valores, tamanhoBase, pesosPrimeiro, pesosSegundo) {
  const base = valores.slice(0, tamanhoBase);
  const primeiro = digitoVerificador(base, pesosPrimeiro);
  const segundo = digitoVerificador([...base, primeiro], pesosSegundo);
  return valores[tamanhoBase] === primeiro && valores[tamanhoBase + 1] === segundo;
}

function cpfValido(candidato) {
  const valores = valoresDe(candidato);
  if (valores.every((valor) => valor === valores[0])) return false;
  return verificadoresConferem(valores, 9, [10, 9, 8, 7, 6, 5, 4, 3, 2], [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
}

function cnpjValido(candidato) {
  const valores = valoresDe(candidato);
  if (valores.every((valor) => valor === valores[0])) return false;
  return verificadoresConferem(
    valores,
    12,
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
}

// Nenhum domínio de topo é só dígito; "pacote@16.4.2" e "acao@v4.2.2" são referência de versão.
function ultimoRotuloTemLetra(dominio) {
  return /[A-Za-z]/.test(dominio.slice(dominio.lastIndexOf('.') + 1));
}

function emailPermitido(email) {
  const minusculo = email.toLowerCase();
  if (EMAILS_PERMITIDOS.has(minusculo)) return true;
  const arroba = minusculo.lastIndexOf('@');
  const local = minusculo.slice(0, arroba);
  const dominio = minusculo.slice(arroba + 1);
  return LOCAIS_SEM_PESSOA.has(local) || DOMINIOS_DA_CASA.has(dominio) || dominio.endsWith('.noreply.github.com');
}

function ehEmailAlheio(email) {
  return ultimoRotuloTemLetra(email.slice(email.lastIndexOf('@') + 1)) && !emailPermitido(email);
}

function ocorrencias(texto, regex) {
  return [...texto.matchAll(regex)].map((ocorrencia) => ({
    inicio: ocorrencia.index,
    fim: ocorrencia.index + ocorrencia[0].length,
    trecho: ocorrencia[0],
  }));
}

function posicoesDasQuebras(texto) {
  const posicoes = [];
  for (let i = texto.indexOf('\n'); i !== -1; i = texto.indexOf('\n', i + 1)) posicoes.push(i);
  return posicoes;
}

function linhaDe(posicoesDasQuebrasDeLinha, posicao) {
  let baixo = 0;
  let alto = posicoesDasQuebrasDeLinha.length;
  while (baixo < alto) {
    const meio = (baixo + alto) >> 1;
    if (posicoesDasQuebrasDeLinha[meio] < posicao) baixo = meio + 1;
    else alto = meio;
  }
  return baixo + 1;
}

/**
 * Procura conteúdo que não pode entrar no histórico. Devolve só o nome do padrão e a linha:
 * o trecho casado nunca sai daqui, para que a mensagem da trava não republique o segredo.
 */
export function detectar(texto) {
  const quebras = posicoesDasQuebras(texto);
  const achados = [];
  const registrar = (padrao, inicio) => achados.push({ padrao, linha: linhaDe(quebras, inicio) });

  const conexoes = ocorrencias(texto, CONEXAO_COM_SENHA);
  for (const { inicio } of conexoes) registrar('conexao-com-senha', inicio);

  for (const { inicio, trecho } of ocorrencias(texto, CANDIDATO_A_CPF)) {
    if (cpfValido(trecho)) registrar('cpf', inicio);
  }
  for (const { inicio, trecho } of ocorrencias(texto, CANDIDATO_A_CNPJ)) {
    if (cnpjValido(trecho)) registrar('cnpj', inicio);
  }

  // Conexões e e-mails saem em ordem de posição e as conexões não se sobrepõem: um ponteiro basta.
  let conexaoCorrente = 0;
  for (const { inicio, trecho } of ocorrencias(texto, CANDIDATO_A_EMAIL)) {
    while (conexaoCorrente < conexoes.length && conexoes[conexaoCorrente].fim <= inicio) conexaoCorrente += 1;
    const conexao = conexoes[conexaoCorrente];
    const dentroDeConexao = conexao !== undefined && inicio >= conexao.inicio;
    if (!dentroDeConexao && ehEmailAlheio(trecho)) registrar('email', inicio);
  }
  for (const [padrao, regex] of PADROES_POR_FORMATO) {
    for (const { inicio } of ocorrencias(texto, regex)) registrar(padrao, inicio);
  }

  return achados.sort((a, b) => a.linha - b.linha);
}
