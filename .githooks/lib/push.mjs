import { ehSoZeros, exigirObjeto, rodarGit } from './git.mjs';

// Um push que só apaga uma referência não traz commit novo: não há o que conferir.
export function commitsDoPush(before, after, cwd) {
  exigirObjeto(before);
  exigirObjeto(after);
  if (ehSoZeros(after)) return [];
  const alcance = ehSoZeros(before) ? after : `${before}..${after}`;
  const saida = rodarGit(['rev-list', '--reverse', '--topo-order', alcance], { cwd }).stdout;
  return saida.toString('utf8').split('\n').filter(Boolean);
}
