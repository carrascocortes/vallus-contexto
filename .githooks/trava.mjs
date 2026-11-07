import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conferirCaminhos, conferirTexto } from './lib/conferir.mjs';
import { lerExcecoes } from './lib/excecoes.mjs';
import { arquivosDaArvore, arquivosMudados, ehSoZeros, exigirObjeto } from './lib/git.mjs';
import { commitsDoPush } from './lib/push.mjs';
import { ehRetivel, raizRetidasPadrao, reter } from './lib/retida.mjs';

const PASSA = 0;
const BARROU = 1;
const ERRO = 2;

const pastaDaTrava = dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();

function avisar(mensagem) {
  process.stderr.write(`trava: ${mensagem}\n`);
}

function descrever({ caminho, linha, padrao }) {
  return linha === undefined ? `${caminho}: ${padrao}` : `${caminho}:${linha}: ${padrao}`;
}

function conferirIndice(excecoes) {
  return conferirCaminhos({ ref: null, caminhos: arquivosMudados(null, cwd), cwd, excecoes });
}

function conferirCommit(sha, excecoes) {
  const ref = exigirObjeto(sha);
  return conferirCaminhos({ ref, caminhos: arquivosMudados(ref, cwd), cwd, excecoes });
}

function conferirArvore(excecoes) {
  return conferirCaminhos({ ref: 'HEAD', caminhos: arquivosDaArvore('HEAD', cwd), cwd, excecoes });
}

function conferirPush(before, after, excecoes) {
  if (ehSoZeros(exigirObjeto(after))) return [];
  const commits = commitsDoPush(before, after, cwd);
  if (commits.length === 0) throw new Error('o push não traz commit para conferir');
  return commits.flatMap((sha) => conferirCommit(sha, excecoes));
}

function padroesPorCaminhoRetivel(achados) {
  const porCaminho = new Map();
  for (const { caminho, padrao, conteudo } of achados) {
    if (!conteudo || !ehRetivel(caminho)) continue;
    porCaminho.set(caminho, [...(porCaminho.get(caminho) ?? []), padrao]);
  }
  return porCaminho;
}

function esbocoSemAchados(texto) {
  return conferirTexto(texto).length === 0;
}

function reterCaminho(caminho, padroes) {
  try {
    reter({
      raizClone: cwd,
      caminho,
      raizRetidas: raizRetidasPadrao(),
      padroes,
      agora: new Date(),
      validarEsboco: esbocoSemAchados,
    });
    avisar(`${caminho} foi retido fora do repositório e trocado por um esboço.`);
    avisar(`para repetir: git add -- ${caminho}  e  git commit -- ${caminho}`);
  } catch (erro) {
    if (erro.code !== 'RETENCAO_FALHOU') throw erro;
    avisar(`${caminho} não foi retido (${erro.cause?.message ?? erro.message}); o texto continua onde estava.`);
  }
}

function reterOsRetiveis(achados) {
  for (const [caminho, padroes] of padroesPorCaminhoRetivel(achados)) reterCaminho(caminho, padroes);
}

function executar(argumentos) {
  const [modo, primeiro, segundo] = argumentos;
  const excecoes = lerExcecoes(join(pastaDaTrava, 'excecoes.txt'));
  if (modo === '--staged') return { achados: conferirIndice(excecoes), podeReter: true };
  if (modo === '--commit') return { achados: conferirCommit(primeiro, excecoes), podeReter: false };
  if (modo === '--push') return { achados: conferirPush(primeiro, segundo, excecoes), podeReter: false };
  if (modo === '--arvore') return { achados: conferirArvore(excecoes), podeReter: false };
  throw new Error('uso: trava.mjs --staged | --commit <sha> | --push <before> <after> | --arvore');
}

function main() {
  try {
    const { achados, podeReter } = executar(process.argv.slice(2));
    if (achados.length === 0) return PASSA;
    for (const achado of achados) avisar(descrever(achado));
    if (podeReter) reterOsRetiveis(achados);
    avisar(`barrado: ${achados.length} achado(s). O valor não é mostrado.`);
    return BARROU;
  } catch (erro) {
    avisar(`erro: ${erro.message}`);
    return ERRO;
  }
}

process.exitCode = main();
