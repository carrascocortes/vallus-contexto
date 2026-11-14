import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

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
const MAX_BUFFER = 64 * 1024 * 1024;
const TIMEOUT_MS = 5 * 60 * 1000;
const TOCA_CI = /^\.(github|githooks)\//;
const MAX_COMMITS_POR_CICLO = 30;
const MAX_ARQUIVOS_POR_CICLO = 150;
const PASTA_DA_TRAVA = '.githooks';

// O maior prefixo que cabe nos dois tetos, para a trava terminar dentro do prazo mesmo com muito atraso.
// O primeiro commit sobe sozinho ainda que passe do teto de arquivos: sem ele o ciclo nunca andaria.
function ultimoDoLote(commits) {
  let arquivos = 0;
  let ultimo = commits[0];
  for (const [i, commit] of commits.entries()) {
    arquivos += commit.arquivos.length;
    if (i >= MAX_COMMITS_POR_CICLO || (i > 0 && arquivos > MAX_ARQUIVOS_POR_CICLO)) break;
    ultimo = commit;
  }
  return ultimo.sha;
}

function motivoDeRemotoForaDoLocal(estado) {
  return estado.localEhAncestral ? 'o GitHub está à frente do main local' : 'histórico divergente';
}

/** Decide a ação do ciclo só a partir do estado já lido; não faz I/O. */
export function decidir(estado) {
  if (estado.erroDeLeitura) return { acao: 'parar', motivo: `erro do Git: ${estado.erroDeLeitura}` };
  if (estado.hooksPath !== '.githooks') return { acao: 'parar', motivo: 'hook desligado' };
  if (estado.remoto === null) return { acao: 'parar', motivo: 'GitHub inacessível' };
  if (estado.remoto === estado.local) return { acao: 'nada' };
  if (estado.remoto !== '' && !estado.remotoEhAncestral) {
    return { acao: 'parar', motivo: motivoDeRemotoForaDoLocal(estado) };
  }
  if (estado.merges.length > 0) return { acao: 'parar', motivo: 'merge no main' };

  const posicao = estado.commits.findIndex((commit) => commit.arquivos.some((arquivo) => TOCA_CI.test(arquivo)));
  const retido = posicao === -1 ? undefined : estado.commits[posicao].sha;
  if (posicao === 0) return { acao: 'reter', retido };
  const sobem = posicao === -1 ? estado.commits : estado.commits.slice(0, posicao);
  const alvo = sobem.length === 0 ? estado.local : ultimoDoLote(sobem);
  return retido === undefined ? { acao: 'empurrar', alvo } : { acao: 'empurrar', alvo, retido };
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

// Sem git replace: o objeto que o Git lê é o que o GitHub tem, e não um que uma sessão tenha trocado no clone.
function ambienteDoGit() {
  const env = { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' };
  delete env.GIT_SSH_COMMAND;
  return env;
}

function rodarGit(opcoes, args, { rede = false } = {}) {
  const env = ambienteDoGit();
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
    const estado = {
      hooksPath,
      local,
      remoto,
      detalheDoRemoto,
      remotoEhAncestral: false,
      localEhAncestral: false,
      merges: [],
      commits: [],
    };
    if (remoto === null || remoto === local) return estado;

    // Tudo daqui em diante usa o SHA lido acima, e não o nome do main: se a sessão mexer no main durante o
    // ls-remote, o alvo continua sendo o que foi varrido.
    let alcance = local;
    if (remoto !== '') {
      estado.remotoEhAncestral = rodarGit(opcoes, ['merge-base', '--is-ancestor', remoto, local]).status === 0;
      if (!estado.remotoEhAncestral) {
        estado.localEhAncestral = rodarGit(opcoes, ['merge-base', '--is-ancestor', local, remoto]).status === 0;
        return estado;
      }
      alcance = `${remoto}..${local}`;
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

function lerBlob(opcoes, sha) {
  const resultado = spawnSync('git', ['cat-file', 'blob', sha], {
    cwd: opcoes.clone,
    env: ambienteDoGit(),
    maxBuffer: opcoes.maxBuffer,
    windowsHide: true,
  });
  if (resultado.error) throw new ErroDeLeitura(`falha ao executar o Git: ${resultado.error.code ?? resultado.error.message}`);
  if (resultado.status !== 0) throw new ErroDeLeitura(`cat-file saiu com ${resultado.status}`);
  return resultado.stdout;
}

// Grava os arquivos de .githooks do commit dado numa pasta nova, sem tocar no índice nem na árvore do clone.
// Só arquivo comum entra: link simbólico e submódulo não são código que a trava possa precisar.
function extrairHooksDoCommit(opcoes, commit, pasta) {
  const saida = lerOuFalhar(opcoes, ['ls-tree', '-r', '-z', commit, '--', PASTA_DA_TRAVA]);
  let gravouATrava = false;
  for (const entrada of saida.split('\0').filter(Boolean)) {
    const tabulacao = entrada.indexOf('\t');
    const [modo, tipo, sha] = entrada.slice(0, tabulacao).split(' ');
    const caminho = entrada.slice(tabulacao + 1);
    if (tipo !== 'blob' || (modo !== '100644' && modo !== '100755')) continue;
    const destino = resolve(pasta, caminho);
    if (!destino.startsWith(`${resolve(pasta)}${sep}`)) throw new ErroDeLeitura('caminho fora da pasta temporária');
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, lerBlob(opcoes, sha));
    if (caminho === `${PASTA_DA_TRAVA}/trava.mjs`) gravouATrava = true;
  }
  return gravouATrava;
}

/**
 * Roda a trava do último commit que já está no GitHub, e nunca a do disco: uma sessão que afrouxe a trava sem
 * commitar não pode desligar a conferência antes do push. A mudança em .githooks só chega ao GitHub pelo PO.
 */
function rodarTrava(opcoes, remoto, alvo) {
  if (!remoto) return { semTrava: true };
  const pasta = mkdtempSync(join(tmpdir(), 'vallus-trava-'));
  try {
    if (!extrairHooksDoCommit(opcoes, remoto, pasta)) return { semTrava: true };
    const env = ambienteDoGit();
    const resultado = spawnSync(process.execPath, [join(pasta, PASTA_DA_TRAVA, 'trava.mjs'), '--push', remoto, alvo], {
      cwd: opcoes.clone,
      env,
      encoding: 'utf8',
      timeout: opcoes.tempoDaTrava,
      windowsHide: true,
    });
    if (resultado.error?.code === 'ETIMEDOUT') return { passouDoTempo: true };
    return { status: resultado.error ? null : resultado.status };
  } catch (erro) {
    if (!(erro instanceof ErroDeLeitura)) throw erro;
    return { status: null };
  } finally {
    // Se o sistema ainda segura um arquivo da pasta, o resíduo fica na pasta temporária do sistema.
    try {
      rmSync(pasta, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
      // nada a fazer além de seguir
    }
  }
}

function motivoDaTrava(resultado) {
  if (resultado.semTrava) return 'a trava não está no GitHub';
  if (resultado.passouDoTempo) return 'a trava passou do tempo';
  return resultado.status === 1 ? 'a trava recusou o intervalo' : 'a trava falhou';
}

// A primeira linha do Git que não é o "To <url>" do cabeçalho do push.
function motivoDoPush(erro, status) {
  const linha = erro.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('To '));
  return linha ?? `o push saiu com ${status}`;
}

function empurrar(opcoes, alvo) {
  try {
    const resultado = rodarGit(opcoes, ['push', '--quiet', opcoes.url, `${alvo}:${MAIN}`], { rede: true });
    if (resultado.status !== 0) return motivoDoPush(resultado.erro, resultado.status);
    rodarGit(opcoes, ['update-ref', 'refs/remotes/origin/main', alvo]);
    return undefined;
  } catch (erro) {
    if (!(erro instanceof ErroDeLeitura)) throw erro;
    return erro.message;
  }
}

// --- aviso e registro ---

// A chave da situação não pode mudar a cada alvo: o mesmo motivo de recusa avisa uma vez por dia.
function semSha(texto) {
  return texto.replace(/\b[0-9a-f]{7,40}\b/g, '');
}

function chaveDaSituacao({ decisao, falhaDoPush, dia }) {
  if (falhaDoPush !== undefined) return `falha-push|${semSha(falhaDoPush)}|${dia}`;
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

// Uma chave por linha; só vale a do dia de hoje (toda chave que não é `ok` termina em `|<dia>`).
function lerChavesDoDia(arquivo, dia) {
  try {
    const linhas = readFileSync(arquivo, 'utf8').split('\n').map((linha) => linha.trim());
    return new Set(linhas.filter((linha) => linha.endsWith(`|${dia}`)));
  } catch (erro) {
    if (erro.code === 'ENOENT') return new Set();
    throw erro;
  }
}

function lerUltimoOk(arquivo) {
  try {
    const lido = JSON.parse(readFileSync(arquivo, 'utf8'));
    return typeof lido?.ultimoOk === 'string' ? lido.ultimoOk : null;
  } catch (erro) {
    if (erro.code === 'ENOENT' || erro instanceof SyntaxError) return null;
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
  const chaves = lerChavesDoDia(opcoes.estado, diaLocal(agora));
  const precisaAvisar = chave !== 'ok' && !chaves.has(chave);
  let canalFalhou = false;
  if (precisaAvisar) {
    const { titulo, texto } = textoDoAviso(chave);
    canalFalhou = avisar(titulo, texto) !== 0;
    // Sem o aviso entregue a chave não entra, e o ciclo seguinte tenta de novo.
    if (!canalFalhou) chaves.add(chave);
  }
  gravar(opcoes.estado, [...chaves].map((linha) => `${linha}\n`).join(''));
  const linhaDoCanal = canalFalhou ? `${agora.toISOString()} falha do canal de aviso\n` : '';
  gravar(opcoes.log, `${agora.toISOString()} ${descricao}\n${linhaDoCanal}`, { anexar: true });
  try {
    gravarBatimento(opcoes, { agora, ok: chave === 'ok' });
  } catch {
    // O batimento é só informativo: a falha vira linha no log e o ciclo segue com o mesmo código e os mesmos avisos.
    gravar(opcoes.log, `${agora.toISOString()} falha ao gravar o batimento\n`, { anexar: true });
  }
}

// A hora do último ciclo e do último ok, para o escritório mostrar há quanto tempo o backup não anda.
function gravarBatimento(opcoes, { agora, ok }) {
  const arquivo = join(dirname(opcoes.estado), 'ultimo-ciclo.json');
  const ultimoOk = ok ? agora.toISOString() : lerUltimoOk(arquivo);
  gravar(arquivo, `${JSON.stringify({ ultimoCiclo: agora.toISOString(), ultimoOk })}\n`);
}

function ciclo(opcoes, { avisar, agora }) {
  const dia = diaLocal(agora);
  const estado = lerEstado(opcoes);
  let decisao = decidir(estado);

  if (decisao.acao === 'empurrar') {
    const resultado = rodarTrava(opcoes, estado.remoto, decisao.alvo);
    if (resultado.status !== 0) decisao = { acao: 'parar', motivo: motivoDaTrava(resultado) };
  }

  const falhaDoPush = decisao.acao === 'empurrar' ? empurrar(opcoes, decisao.alvo) : undefined;
  const chave = chaveDaSituacao({ decisao, falhaDoPush, dia });
  const detalheDoRemoto = estado.remoto === null ? estado.detalheDoRemoto : undefined;
  const empurrado = decisao.acao === 'empurrar' && falhaDoPush === undefined ? `empurrado ${decisao.alvo}` : undefined;
  const descricao = [decisao.acao, decisao.motivo, empurrado, detalheDoRemoto, falhaDoPush, `chave=${chave}`]
    .filter(Boolean)
    .join(' | ');
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
export function main(argv, { avisar, agora = new Date(), maxBuffer = MAX_BUFFER, tempoDaTrava = TIMEOUT_MS }) {
  const { opcoes: lidas, erro } = lerOpcoes(argv);
  if (erro) {
    registrarOpcaoInvalida(argv, erro, agora);
    return 2;
  }
  const opcoes = { ...lidas, maxBuffer, tempoDaTrava };
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
