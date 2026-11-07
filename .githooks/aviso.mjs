import { caminhosTocados, ehSoZeros } from './lib/git.mjs';
import { commitsDoPush } from './lib/push.mjs';
import { caminhoVigiado } from './lib/caminhos.mjs';
import { nomeBarrado } from './lib/conferir.mjs';

const LIMPO = 0;
const TOCOU = 1;
const ERRO = 2;

const cwd = process.cwd();

function main() {
  try {
    const [before, after] = process.argv.slice(2);
    const commits = commitsDoPush(before, after, cwd);
    if (commits.length === 0 && ehSoZeros(after)) return LIMPO;
    if (commits.length === 0) throw new Error('o push não traz commit para conferir');
    let tocou = false;
    for (const commit of commits) {
      const vigiados = caminhosTocados(commit, cwd).filter(caminhoVigiado);
      for (const caminho of vigiados) {
        const nome = nomeBarrado(caminho) ? '(arquivo de nome barrado)' : caminho;
        process.stdout.write(`aviso: ${commit} toca ${nome}\n`);
      }
      if (vigiados.length > 0) tocou = true;
    }
    return tocou ? TOCOU : LIMPO;
  } catch (erro) {
    process.stderr.write(`aviso: erro: ${erro.message}\n`);
    return ERRO;
  }
}

process.exitCode = main();
