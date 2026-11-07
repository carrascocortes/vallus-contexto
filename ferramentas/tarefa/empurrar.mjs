import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const PASTA_DO_PERFIL = join(homedir(), '.vallus-contexto');
const PADROES = {
  clone: 'C:\\dev\\vallus-contexto',
  url: 'git@github.com:carrascocortes/vallus-contexto.git',
  chave: join(PASTA_DO_PERFIL, 'deploy_key'),
  knownHosts: join(PASTA_DO_PERFIL, 'known_hosts'),
  sshConfig: join(PASTA_DO_PERFIL, 'ssh_config'),
  estado: join(PASTA_DO_PERFIL, 'ultimo-aviso'),
  log: join(PASTA_DO_PERFIL, 'empurrar.log'),
};
const MAIN = 'refs/heads/main';
const ZEROS = '0'.repeat(40);
const TOCA_CI = /^\.(github|githooks)\//;

/** Decide a ação do ciclo só a partir do estado já lido; não faz I/O. */
export function decidir(estado) {
  if (estado.erroDeLeitura) return { acao: 'parar', motivo: `erro do Git: ${estado.erroDeLeitura}` };
  if (estado.hooksPath !== '.githooks') return { acao: 'parar', motivo: 'hook desligado' };
  if (estado.remoto === null) return { acao: 'parar', motivo: 'GitHub inacessível' };
  if (estado.remoto === estado.local) return { acao: 'nada' };
  if (estado.remoto !== '' && !estado.remotoEhAncestral) return { acao: 'parar', motivo: 'histórico divergente' };
  if (estado.merges.length > 0) return { acao: 'parar', motivo: 'merge no main' };

  const posicao = estado.commits.findIndex((commit) => commit.arquivos.some((arquivo) => TOCA_CI.test(arquivo)));
  if (posicao === -1) return { acao: 'empurrar', alvo: estado.local };
  const retido = estado.commits[posicao].sha;
  if (posicao === 0) return { acao: 'reter', retido };
  return { acao: 'empurrar', alvo: estado.commits[posicao - 1].sha, retido };
}

// --- Git ---

function comandoSsh({ chave, knownHosts, sshConfig }) {
  const caminho = (valor) => `"${valor.replaceAll('\\', '/')}"`;
  return [
    'ssh',
    `-i ${caminho(chave)}`,
    '-o IdentitiesOnly=yes',
    `-o UserKnownHostsFile=${caminho(knownHosts)}`,
    `-F ${caminho(sshConfig)}`,
    '-o BatchMode=yes',
    '-o StrictHostKeyChecking=yes',
  ].join(' ');
}

function ehUrlSsh(url) {
  return url.startsWith('git@') || url.startsWith('ssh://');
}

function rodarGit(opcoes, args, { rede = false } = {}) {
  const env = { ...process.env };
  delete env.GIT_SSH_COMMAND;
  if (rede && ehUrlSsh(opcoes.url)) env.GIT_SSH_COMMAND = comandoSsh(opcoes);
  const resultado = spawnSync('git', args, { cwd: opcoes.clone, env, encoding: 'utf8' });
  if (resultado.error) throw resultado.error;
  return { status: resultado.status, saida: resultado.stdout, erro: resultado.stderr };
}

function primeiraLinha(texto) {
  return texto.split('\n').map((linha) => linha.trim()).find(Boolean) ?? '';
}

class ErroDeLeitura extends Error {}

function lerOuFalhar(opcoes, args) {
  const resultado = rodarGit(opcoes, args);
  if (resultado.status !== 0) {
    throw new ErroDeLeitura(`${args[0]} saiu com ${resultado.status}: ${primeiraLinha(resultado.erro)}`);
  }
  return resultado.saida;
}

function linhas(texto) {
  return texto.split('\n').filter(Boolean);
}

function lerRemoto(opcoes) {
  const resultado = rodarGit(opcoes, ['ls-remote', opcoes.url, MAIN], { rede: true });
  if (resultado.status !== 0) return null;
  return linhas(resultado.saida)[0]?.split('\t')[0] ?? '';
}

function arquivosDoCommit(opcoes, sha) {
  const saida = lerOuFalhar(opcoes, ['diff-tree', '--no-commit-id', '-r', '--name-only', '-z', '--root', sha]);
  return saida.split('\0').filter(Boolean);
}

function lerHooksPath(opcoes) {
  const resultado = rodarGit(opcoes, ['config', '--get', 'core.hooksPath']);
  if (resultado.status === 1) return '';
  if (resultado.status !== 0) throw new ErroDeLeitura(`git config saiu com ${resultado.status}`);
  return resultado.saida.trim();
}

function lerEstado(opcoes) {
  try {
    const hooksPath = lerHooksPath(opcoes);
    const local = lerOuFalhar(opcoes, ['rev-parse', '--verify', MAIN]).trim();
    const remoto = lerRemoto(opcoes);
    const estado = { hooksPath, local, remoto, remotoEhAncestral: false, merges: [], commits: [] };
    if (remoto === null || remoto === local) return estado;

    let alcance = MAIN;
    if (remoto !== '') {
      estado.remotoEhAncestral = rodarGit(opcoes, ['merge-base', '--is-ancestor', remoto, MAIN]).status === 0;
      if (!estado.remotoEhAncestral) return estado;
      alcance = `${remoto}..${MAIN}`;
    }
    estado.merges = linhas(lerOuFalhar(opcoes, ['rev-list', '--min-parents=2', alcance]));
    const shas = linhas(lerOuFalhar(opcoes, ['rev-list', '--reverse', '--topo-order', alcance]));
    estado.commits = shas.map((sha) => ({ sha, arquivos: arquivosDoCommit(opcoes, sha) }));
    return estado;
  } catch (erro) {
    if (!(erro instanceof ErroDeLeitura)) throw erro;
    return { hooksPath: '', local: '', remoto: null, remotoEhAncestral: false, merges: [], commits: [], erroDeLeitura: erro.message };
  }
}

/** Roda a trava do clone sobre o intervalo que vai subir; cherry-pick -e, revert -e e --no-verify pulam os hooks. */
function rodarTrava(opcoes, remoto, alvo) {
  const env = { ...process.env };
  delete env.GIT_SSH_COMMAND;
  const resultado = spawnSync(
    process.execPath,
    [join(opcoes.clone, '.githooks', 'trava.mjs'), '--push', remoto || ZEROS, alvo],
    { cwd: opcoes.clone, env, encoding: 'utf8' },
  );
  if (resultado.error) throw resultado.error;
  return resultado.status;
}

function empurrar(opcoes, alvo) {
  const resultado = rodarGit(opcoes, ['push', '--quiet', opcoes.url, `${alvo}:${MAIN}`], { rede: true });
  if (resultado.status === 0) {
    rodarGit(opcoes, ['update-ref', 'refs/remotes/origin/main', alvo]);
    return undefined;
  }
  return primeiraLinha(resultado.erro) || `o push saiu com ${resultado.status}`;
}

// --- aviso e registro ---

function chaveDaSituacao({ decisao, estado, falhaDoPush, alvo, dia }) {
  if (falhaDoPush !== undefined) return `falha-push|${falhaDoPush}|${alvo}`;
  if (decisao.acao === 'parar') return `parar|${decisao.motivo}|${estado.local}`;
  if (decisao.retido) return `retido|${decisao.retido}|${dia}`;
  return 'ok';
}

function textoDoAviso(chave) {
  const [tipo, detalhe] = chave.split('|');
  if (tipo === 'parar') return { titulo: 'Backup do contexto parado', texto: detalhe };
  if (tipo === 'retido') {
    return { titulo: 'Commit retido no backup', texto: `O commit ${detalhe.slice(0, 7)} mexe em .github ou .githooks. Confira e empurre.` };
  }
  return { titulo: 'Push do backup falhou', texto: detalhe };
}

function lerChaveAnterior(arquivo) {
  try {
    return readFileSync(arquivo, 'utf8').trim();
  } catch (erro) {
    if (erro.code === 'ENOENT') return '';
    throw erro;
  }
}

function gravar(arquivo, conteudo, { anexar = false } = {}) {
  mkdirSync(dirname(arquivo), { recursive: true });
  if (anexar) appendFileSync(arquivo, conteudo);
  else writeFileSync(arquivo, conteudo);
}

function lerOpcoes(argv) {
  const valores = {};
  for (let i = 0; i < argv.length; i += 2) valores[argv[i]] = argv[i + 1];
  return {
    clone: valores['--clone'] ?? PADROES.clone,
    url: valores['--url'] ?? PADROES.url,
    chave: valores['--chave'] ?? PADROES.chave,
    knownHosts: valores['--known-hosts'] ?? PADROES.knownHosts,
    sshConfig: valores['--ssh-config'] ?? PADROES.sshConfig,
    estado: valores['--estado'] ?? PADROES.estado,
    log: valores['--log'] ?? PADROES.log,
  };
}

function ciclo(opcoes, { avisar, agora }) {
  const dia = agora.toISOString().slice(0, 10);
  const estado = lerEstado(opcoes);
  let decisao = decidir(estado);

  if (decisao.acao === 'empurrar') {
    const saida = rodarTrava(opcoes, estado.remoto, decisao.alvo);
    if (saida !== 0) {
      decisao = { acao: 'parar', motivo: saida === 1 ? 'a trava recusou o intervalo' : 'a trava falhou' };
    }
  }

  const falhaDoPush = decisao.acao === 'empurrar' ? empurrar(opcoes, decisao.alvo) : undefined;
  const chave = chaveDaSituacao({ decisao, estado, falhaDoPush, alvo: decisao.alvo, dia });
  const registro = [`${agora.toISOString()} ${decisao.acao}`, decisao.motivo, falhaDoPush, `chave=${chave}`]
    .filter(Boolean)
    .join(' | ');

  const anterior = lerChaveAnterior(opcoes.estado);
  const precisaAvisar = chave !== 'ok' && chave !== anterior;
  gravar(opcoes.estado, `${chave}\n`);

  let linhaDoCanal = '';
  if (precisaAvisar) {
    const { titulo, texto } = textoDoAviso(chave);
    if (avisar(titulo, texto) !== 0) linhaDoCanal = `${agora.toISOString()} falha do canal de aviso\n`;
  }
  gravar(opcoes.log, `${registro}\n${linhaDoCanal}`, { anexar: true });
}

/** Um ciclo da tarefa agendada. Nunca lança: o que der errado vai para o log. */
export function main(argv, { avisar, agora = new Date() }) {
  const opcoes = lerOpcoes(argv);
  try {
    ciclo(opcoes, { avisar, agora });
    return 0;
  } catch (erro) {
    try {
      gravar(opcoes.log, `${agora.toISOString()} erro inesperado: ${erro.message}\n`, { anexar: true });
    } catch {
      // sem onde registrar, nada mais a fazer
    }
    return 1;
  }
}
