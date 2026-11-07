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
const MAX_BUFFER = 64 * 1024 * 1024;
const TIMEOUT_MS = 5 * 60 * 1000;
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
  const caminho = (valor) => `'${valor.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`;
  return [
    'ssh',
    `-i ${caminho(chave)}`,
    '-o IdentitiesOnly=yes',
    `-o UserKnownHostsFile=${caminho(knownHosts)}`,
    `-F ${caminho(sshConfig)}`,
    '-o BatchMode=yes',
    '-o StrictHostKeyChecking=yes',
    '-o ConnectTimeout=30',
    '-o ServerAliveInterval=15',
    '-o ServerAliveCountMax=4',
  ].join(' ');
}

function ehUrlSsh(url) {
  return url.startsWith('git@') || url.startsWith('ssh://');
}

function rodarGit(opcoes, args, { rede = false } = {}) {
  const env = { ...process.env };
  delete env.GIT_SSH_COMMAND;
  if (rede && ehUrlSsh(opcoes.url)) env.GIT_SSH_COMMAND = comandoSsh(opcoes);
  const resultado = spawnSync('git', args, {
    cwd: opcoes.clone,
    env,
    encoding: 'utf8',
    maxBuffer: opcoes.maxBuffer,
    timeout: rede ? TIMEOUT_MS : undefined,
    windowsHide: true,
  });
  if (resultado.error) throw new ErroDeLeitura(`falha ao executar o Git: ${resultado.error.code ?? resultado.error.message}`);
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

// O padrão do ls-remote também casa refs como refs/foo/refs/heads/main: só vale a linha da referência exata.
function lerRemoto(opcoes) {
  const resultado = rodarGit(opcoes, ['ls-remote', opcoes.url, MAIN], { rede: true });
  if (resultado.status !== 0) return { sha: null, detalhe: primeiraLinha(resultado.erro) || `saiu com ${resultado.status}` };
  const linha = linhas(resultado.saida).map((l) => l.split('\t')).find(([, nome]) => nome === MAIN);
  return { sha: linha?.[0] ?? '' };
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
    const { sha: remoto, detalhe: detalheDoRemoto } = lerRemoto(opcoes);
    const estado = { hooksPath, local, remoto, detalheDoRemoto, remotoEhAncestral: false, merges: [], commits: [] };
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
    { cwd: opcoes.clone, env, encoding: 'utf8', timeout: TIMEOUT_MS, windowsHide: true },
  );
  return resultado.error ? null : resultado.status;
}

function empurrar(opcoes, alvo) {
  try {
    const resultado = rodarGit(opcoes, ['push', '--quiet', opcoes.url, `${alvo}:${MAIN}`], { rede: true });
    if (resultado.status !== 0) return primeiraLinha(resultado.erro) || `o push saiu com ${resultado.status}`;
    rodarGit(opcoes, ['update-ref', 'refs/remotes/origin/main', alvo]);
    return undefined;
  } catch (erro) {
    if (!(erro instanceof ErroDeLeitura)) throw erro;
    return erro.message;
  }
}

// --- aviso e registro ---

function chaveDaSituacao({ decisao, falhaDoPush, dia }) {
  if (falhaDoPush !== undefined) return `falha-push|${falhaDoPush}|${dia}`;
  if (decisao.acao === 'parar') return `parar|${decisao.motivo}|${dia}`;
  if (decisao.retido) return `retido|${decisao.retido}|${dia}`;
  return 'ok';
}

function textoDoAviso(chave) {
  const tipo = chave.slice(0, chave.indexOf('|'));
  const meio = chave.slice(tipo.length + 1);
  const detalhe = meio.slice(0, meio.lastIndexOf('|'));
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

const OPCOES = {
  '--clone': 'clone',
  '--url': 'url',
  '--chave': 'chave',
  '--known-hosts': 'knownHosts',
  '--ssh-config': 'sshConfig',
  '--estado': 'estado',
  '--log': 'log',
};

function lerOpcoes(argv) {
  const opcoes = { ...PADROES };
  for (let i = 0; i < argv.length; i += 2) {
    const nome = OPCOES[argv[i]];
    if (!nome) return { erro: `opção desconhecida: ${argv[i]}` };
    if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) return { erro: `falta o valor de ${argv[i]}` };
    opcoes[nome] = argv[i + 1];
  }
  return { opcoes };
}

function diaLocal(data) {
  const dois = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`;
}

function registrar(opcoes, { avisar, agora, chave, descricao }) {
  const precisaAvisar = chave !== 'ok' && chave !== lerChaveAnterior(opcoes.estado);
  let canalFalhou = false;
  if (precisaAvisar) {
    const { titulo, texto } = textoDoAviso(chave);
    canalFalhou = avisar(titulo, texto) !== 0;
  }
  // Sem o aviso entregue a chave não é gravada, e o ciclo seguinte tenta de novo.
  if (!canalFalhou) gravar(opcoes.estado, `${chave}\n`);
  const linhaDoCanal = canalFalhou ? `${agora.toISOString()} falha do canal de aviso\n` : '';
  gravar(opcoes.log, `${agora.toISOString()} ${descricao}\n${linhaDoCanal}`, { anexar: true });
}

function ciclo(opcoes, { avisar, agora }) {
  const dia = diaLocal(agora);
  const estado = lerEstado(opcoes);
  let decisao = decidir(estado);

  if (decisao.acao === 'empurrar') {
    const saida = rodarTrava(opcoes, estado.remoto, decisao.alvo);
    if (saida !== 0) {
      decisao = { acao: 'parar', motivo: saida === 1 ? 'a trava recusou o intervalo' : 'a trava falhou' };
    }
  }

  const falhaDoPush = decisao.acao === 'empurrar' ? empurrar(opcoes, decisao.alvo) : undefined;
  const chave = chaveDaSituacao({ decisao, falhaDoPush, dia });
  const detalheDoRemoto = estado.remoto === null ? estado.detalheDoRemoto : undefined;
  const descricao = [decisao.acao, decisao.motivo, detalheDoRemoto, falhaDoPush, `chave=${chave}`].filter(Boolean).join(' | ');
  registrar(opcoes, { avisar, agora, chave, descricao });
}

function registrarOpcaoInvalida(argv, erro, agora) {
  const posicao = argv.indexOf('--log');
  const arquivo = posicao === -1 ? undefined : argv[posicao + 1];
  if (!arquivo || arquivo.startsWith('--')) return;
  try {
    gravar(arquivo, `${agora.toISOString()} ${erro}\n`, { anexar: true });
  } catch {
    // sem onde registrar, nada mais a fazer
  }
}

/** Um ciclo da tarefa agendada. Não lança: o que der errado vira aviso e linha de log. Saída 2 = opção inválida. */
export function main(argv, { avisar, agora = new Date(), maxBuffer = MAX_BUFFER }) {
  const { opcoes: lidas, erro } = lerOpcoes(argv);
  if (erro) {
    registrarOpcaoInvalida(argv, erro, agora);
    return 2;
  }
  const opcoes = { ...lidas, maxBuffer };
  try {
    ciclo(opcoes, { avisar, agora });
    return 0;
  } catch (falha) {
    try {
      registrar(opcoes, {
        avisar,
        agora,
        chave: `parar|erro inesperado|${diaLocal(agora)}`,
        descricao: `erro inesperado: ${primeiraLinha(String(falha.message))}`,
      });
    } catch {
      // sem onde registrar, nada mais a fazer
    }
    return 1;
  }
}
