import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from './empurrar.mjs';

const PADRAO_DO_AVISO = join(dirname(fileURLToPath(import.meta.url)), 'avisar.ps1');

function opcaoAvisar(argv) {
  const posicao = argv.indexOf('--avisar');
  return posicao === -1 ? PADRAO_DO_AVISO : argv[posicao + 1];
}

function avisarPelaNotificacaoDoWindows(caminhoDoScript) {
  return (titulo, texto) =>
    spawnSync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', caminhoDoScript, '-Titulo', titulo, '-Texto', texto],
      { encoding: 'utf8', windowsHide: true, timeout: 60_000 },
    ).status;
}

const argv = process.argv.slice(2);
const opcoesDoCiclo = argv.filter((_, i) => argv[i] !== '--avisar' && argv[i - 1] !== '--avisar');
process.exitCode = main(opcoesDoCiclo, { avisar: avisarPelaNotificacaoDoWindows(opcaoAvisar(argv)) });
