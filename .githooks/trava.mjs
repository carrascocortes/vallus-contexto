import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { conferirCaminhos, conferirMensagem, conferirMensagemDoCommit, conferirTexto } from './lib/conferir.mjs';
import { arquivosDaArvore, arquivosMudados, ehSoZeros, exigirObjeto, lerArquivo } from './lib/git.mjs';
import { commitsDoPush } from './lib/push.mjs';
import { ehRetivel, raizRetidasPadrao, reter } from './lib/retida.mjs';

const PASSA = 0;
const BARROU = 1;
const ERRO = 2;

const cwd = process.cwd();

function avisar(mensagem) {
  process.stderr.write(`trava: ${mensagem}\n`);
}

// O caminho de nome barrado pode carregar o próprio valor: nunca é impresso.
function descreverMensagem({ ref, linha, padrao }) {
  const commit = ref ? ` ${ref.slice(0, 7)}` : '';
  const onde = linha === undefined ? '' : `linha ${linha}: `;
  return `mensagem de commit${commit}: ${onde}${padrao}`;
}

function descrever({ caminho, linha, padrao, nomeBarrado, mensagem, ref }) {
  if (mensagem) return descreverMensagem({ ref, linha, padrao });
  const onde = nomeBarrado ? '(arquivo de nome barrado)' : caminho;
  return linha === undefined ? `${onde}: ${padrao}` : `${onde}:${linha}: ${padrao}`;
}

function comandoParaListarNomes(ref) {
  if (ref === null) return 'git diff --cached --name-only';
  if (ref === 'HEAD') return 'git ls-tree -r --name-only HEAD';
  return `git show --name-only ${ref}`;
}

function conferirIndice() {
  return conferirCaminhos({ ref: null, caminhos: arquivosMudados(null, cwd), cwd });
}

function conferirCommit(sha) {
  const ref = exigirObjeto(sha);
  return [...conferirMensagemDoCommit(ref, cwd), ...conferirCaminhos({ ref, caminhos: arquivosMudados(ref, cwd), cwd })];
}

// O Git passa ao commit-msg o arquivo com a mensagem inteira, inclusive as linhas de comentário que `-m` mantém.
function conferirArquivoDeMensagem(arquivo) {
  if (!arquivo) throw new Error('falta o arquivo da mensagem');
  return conferirMensagem(readFileSync(arquivo, 'utf8'));
}

function conferirArvore() {
  return conferirCaminhos({ ref: 'HEAD', caminhos: arquivosDaArvore('HEAD', cwd), cwd });
}

function conferirPush(before, after) {
  if (ehSoZeros(exigirObjeto(after))) return [];
  const commits = commitsDoPush(before, after, cwd);
  if (commits.length === 0) throw new Error('o push não traz commit para conferir');
  return commits.flatMap(conferirCommit);
}

function padroesPorCaminhoRetivel(achados) {
  const porCaminho = new Map();
  for (const { caminho, padrao, conteudo, nomeBarrado } of achados) {
    if (!conteudo || nomeBarrado || !ehRetivel(caminho)) continue;
    porCaminho.set(caminho, [...(porCaminho.get(caminho) ?? []), padrao]);
  }
  return porCaminho;
}

function esbocoSemAchados(texto) {
  return conferirTexto(texto).length === 0;
}

// A retida copia o disco; só é o texto barrado se o disco ainda tem o que está no índice (CRLF não conta).
function discoIgualAoIndice(caminho) {
  try {
    const noDisco = readFileSync(join(cwd, caminho));
    const noIndice = lerArquivo(null, caminho, cwd);
    return noDisco.equals(noIndice) || Buffer.from(noDisco.toString('utf8').replace(/\r\n/g, '\n')).equals(noIndice);
  } catch {
    return false;
  }
}

function reterCaminho(caminho, padroes) {
  if (!discoIgualAoIndice(caminho)) {
    avisar(`${caminho} difere do que está no índice e não foi retido. Rode git add -- ${caminho} e repita o commit.`);
    return;
  }
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

function avisarDosNomes(achados) {
  const referencias = new Set(achados.filter((achado) => achado.nomeBarrado).map((achado) => achado.ref));
  for (const ref of referencias) avisar(`liste os nomes barrados com: ${comandoParaListarNomes(ref)}`);
}

function executar(argumentos) {
  const [modo, primeiro, segundo] = argumentos;
  if (modo === '--staged') return { achados: conferirIndice(), podeReter: true };
  if (modo === '--commit') return { achados: conferirCommit(primeiro), podeReter: false };
  if (modo === '--push') return { achados: conferirPush(primeiro, segundo), podeReter: false };
  if (modo === '--arvore') return { achados: conferirArvore(), podeReter: false };
  if (modo === '--mensagem') return { achados: conferirArquivoDeMensagem(primeiro), podeReter: false };
  throw new Error('uso: trava.mjs --staged | --commit <sha> | --push <before> <after> | --arvore | --mensagem <arquivo>');
}

function main() {
  try {
    const { achados, podeReter } = executar(process.argv.slice(2));
    if (achados.length === 0) return PASSA;
    for (const achado of achados) avisar(descrever(achado));
    avisarDosNomes(achados);
    if (podeReter) reterOsRetiveis(achados);
    avisar(`barrado: ${achados.length} achado(s). O valor não é mostrado.`);
    return BARROU;
  } catch (erro) {
    avisar(`erro: ${erro.message}`);
    return ERRO;
  }
}

process.exitCode = main();
