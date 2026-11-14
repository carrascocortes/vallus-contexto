import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decidir, main } from '../ferramentas/tarefa/empurrar.mjs';
import { git, repoTemporario } from './git.mjs';
import * as gerar from './gerar.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pastas = [];
const ambienteOriginal = {
  GIT_CONFIG_NOSYSTEM: process.env.GIT_CONFIG_NOSYSTEM,
  GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL,
};

function pastaTemporaria() {
  const pasta = mkdtempSync(join(tmpdir(), 'tarefa-'));
  pastas.push(pasta);
  return pasta;
}

process.env.GIT_CONFIG_NOSYSTEM = '1';
process.env.GIT_CONFIG_GLOBAL = join(pastaTemporaria(), 'config-vazio');
writeFileSync(process.env.GIT_CONFIG_GLOBAL, '');

after(() => {
  for (const [nome, valor] of Object.entries(ambienteOriginal)) {
    if (valor === undefined) delete process.env[nome];
    else process.env[nome] = valor;
  }
  for (const pasta of pastas) rmSync(pasta, { recursive: true, force: true });
});

function estadoBase(sobrepor = {}) {
  return {
    hooksPath: '.githooks',
    local: 'c3',
    remoto: 'c1',
    remotoEhAncestral: true,
    merges: [],
    commits: [
      { sha: 'c2', arquivos: ['docs/a.md'] },
      { sha: 'c3', arquivos: ['docs/b.md'] },
    ],
    ...sobrepor,
  };
}

test('decidir: erro de leitura para', () => {
  assert.deepEqual(decidir(estadoBase({ erroDeLeitura: 'boom' })), { acao: 'parar', motivo: 'erro do Git: boom' });
});

test('decidir: hook desligado para', () => {
  assert.deepEqual(decidir(estadoBase({ hooksPath: '' })), { acao: 'parar', motivo: 'hook desligado' });
});

test('decidir: GitHub inacessível para', () => {
  assert.deepEqual(decidir(estadoBase({ remoto: null })), { acao: 'parar', motivo: 'GitHub inacessível' });
});

test('decidir: remoto igual ao local não faz nada', () => {
  assert.deepEqual(decidir(estadoBase({ remoto: 'c3', commits: [] })), { acao: 'nada' });
});

test('decidir: histórico divergente para', () => {
  assert.deepEqual(decidir(estadoBase({ remotoEhAncestral: false })), { acao: 'parar', motivo: 'histórico divergente' });
});

test('decidir: merge no main para', () => {
  assert.deepEqual(decidir(estadoBase({ merges: ['c3'] })), { acao: 'parar', motivo: 'merge no main' });
});

test('decidir: empurra até o local quando nada é retido', () => {
  assert.deepEqual(decidir(estadoBase()), { acao: 'empurrar', alvo: 'c3' });
});

test('decidir: remoto vazio empurra tudo', () => {
  const estado = estadoBase({ remoto: '', remotoEhAncestral: false });
  assert.deepEqual(decidir(estado), { acao: 'empurrar', alvo: 'c3' });
});

test('decidir: primeiro commit da lista em .github é retido sem alvo', () => {
  const commits = [{ sha: 'c2', arquivos: ['.github/workflows/x.yml'] }, { sha: 'c3', arquivos: ['docs/b.md'] }];
  assert.deepEqual(decidir(estadoBase({ commits })), { acao: 'reter', retido: 'c2' });
});

test('decidir: commit em .githooks no meio empurra até o anterior e informa o retido', () => {
  const commits = [
    { sha: 'c2', arquivos: ['docs/a.md'] },
    { sha: 'c3', arquivos: ['.githooks/pre-commit', 'docs/b.md'] },
    { sha: 'c4', arquivos: ['docs/c.md'] },
  ];
  assert.deepEqual(decidir(estadoBase({ commits, local: 'c4' })), { acao: 'empurrar', alvo: 'c2', retido: 'c3' });
});

test('decidir: a ordem das regras põe o erro de leitura antes do hook', () => {
  const resultado = decidir(estadoBase({ erroDeLeitura: 'x', hooksPath: '' }));
  assert.equal(resultado.motivo, 'erro do Git: x');
});

// --- integração: remoto nu em pasta temporária, aviso injetado ---

function commitar(repo, caminho, conteudo = `${caminho}\n`) {
  const completo = join(repo, caminho);
  mkdirSync(dirname(completo), { recursive: true });
  writeFileSync(completo, conteudo);
  assert.equal(git(['add', '--', caminho], { cwd: repo }).status, 0);
  const resultado = git(['commit', '--quiet', '--no-verify', '-m', `muda ${caminho}`], { cwd: repo });
  assert.equal(resultado.status, 0, resultado.stderr);
  return git(['rev-parse', 'HEAD'], { cwd: repo }).stdout.toString('utf8').trim();
}

function principalDe(repo) {
  const resultado = git(['rev-parse', '--verify', '--quiet', 'refs/heads/main'], { cwd: repo });
  return resultado.status === 0 ? resultado.stdout.toString('utf8').trim() : '';
}

// Por padrão o GitHub já tem a trava: a semente é o commit com .githooks, empurrado antes do primeiro ciclo.
// `trava` troca o conteúdo de trava.mjs na semente.
function cenario({ hooksPath = '.githooks', semeado = true, trava } = {}) {
  const base = pastaTemporaria();
  const remoto = join(base, 'remoto.git');
  assert.equal(git(['init', '--bare', '--quiet', '--initial-branch=main', remoto]).status, 0);
  const clone = repoTemporario();
  pastas.push(clone);
  cpSync(join(raiz, '.githooks'), join(clone, '.githooks'), { recursive: true });
  for (const gancho of ['pre-commit', 'commit-msg']) chmodSync(join(clone, '.githooks', gancho), 0o755);
  if (trava !== undefined) writeFileSync(join(clone, '.githooks', 'trava.mjs'), trava);
  if (hooksPath) git(['config', 'core.hooksPath', hooksPath], { cwd: clone });
  let semente = '';
  if (semeado) {
    assert.equal(git(['add', '--', '.githooks'], { cwd: clone }).status, 0);
    const feito = git(['commit', '--quiet', '--no-verify', '-m', 'semente'], { cwd: clone });
    assert.equal(feito.status, 0, feito.stderr);
    semente = principalDe(clone);
    assert.equal(git(['push', '--quiet', remoto, `${semente}:refs/heads/main`], { cwd: clone }).status, 0);
    assert.equal(git(['update-ref', 'refs/remotes/origin/main', semente], { cwd: clone }).status, 0);
  }
  const avisos = [];
  const estado = join(base, 'estado', 'ultimo');
  const log = join(base, 'log', 'empurrar.log');
  const contexto = {
    remoto,
    clone,
    semente,
    avisos,
    estado,
    log,
    rodar({ url = remoto, agora = new Date('2026-11-07T10:00:00Z'), canal = () => 0, maxBuffer, tempoDaTrava } = {}) {
      const argv = ['--clone', clone, '--url', url, '--estado', estado, '--log', log];
      const avisar = (titulo, texto) => {
        avisos.push({ titulo, texto });
        return canal(avisos.length);
      };
      return main(argv, { avisar, agora, maxBuffer, tempoDaTrava });
    },
    remotoMain: () => principalDe(remoto),
    estadoGravado: () => (existsSync(estado) ? readFileSync(estado, 'utf8').trim() : ''),
  };
  return contexto;
}

test('empurra o main', () => {
  const c = cenario();
  commitar(c.clone, 'docs/a.md');
  const topo = commitar(c.clone, 'docs/b.md');
  c.rodar();
  assert.equal(c.remotoMain(), topo);
  assert.equal(c.avisos.length, 0);
  assert.equal(principalDe(c.clone), topo);
  const rastreado = git(['rev-parse', 'refs/remotes/origin/main'], { cwd: c.clone }).stdout.toString('utf8').trim();
  assert.equal(rastreado, topo);
  assert.match(readFileSync(c.log, 'utf8'), /\S/);
});

function trioComRetido(c) {
  const a = commitar(c.clone, 'docs/a.md');
  const b = commitar(c.clone, '.github/workflows/x.yml');
  const d = commitar(c.clone, 'docs/d.md');
  return { a, b, d };
}

test('retém o commit em .github, empurra só até o anterior e avisa uma vez', () => {
  const c = cenario();
  const { a } = trioComRetido(c);
  c.rodar();
  assert.equal(c.remotoMain(), a);
  assert.equal(c.avisos.length, 1);
  assert.match(c.estadoGravado(), /^retido\|/);
});

test('no ciclo seguinte, com o mesmo retido, não avisa de novo', () => {
  const c = cenario();
  trioComRetido(c);
  c.rodar();
  c.rodar();
  assert.equal(c.avisos.length, 1);
});

test('o retido volta a avisar no dia seguinte', () => {
  const c = cenario();
  trioComRetido(c);
  c.rodar({ agora: new Date('2026-11-07T10:00:00Z') });
  c.rodar({ agora: new Date('2026-11-08T10:00:00Z') });
  assert.equal(c.avisos.length, 2);
});

test('depois que o remoto avança até o retido, volta a empurrar o resto', () => {
  const c = cenario();
  const { b, d } = trioComRetido(c);
  c.rodar();
  assert.equal(git(['push', '--quiet', c.remoto, `${b}:refs/heads/main`], { cwd: c.clone }).status, 0);
  c.rodar();
  assert.equal(c.remotoMain(), d);
  assert.equal(c.avisos.length, 1);
  assert.match(c.estadoGravado(), /^retido\|\S+$/);
});

test('remoto vazio com commit em .github retém a partir dele', () => {
  const c = cenario({ semeado: false });
  commitar(c.clone, '.github/workflows/x.yml');
  commitar(c.clone, 'docs/a.md');
  c.rodar();
  assert.equal(c.remotoMain(), '');
  assert.equal(c.avisos.length, 1);
});

test('não empurra com core.hooksPath errado e avisa', () => {
  const c = cenario({ hooksPath: 'outro' });
  commitar(c.clone, 'docs/a.md');
  c.rodar();
  assert.equal(c.remotoMain(), c.semente);
  assert.equal(c.avisos.length, 1);
  assert.match(c.estadoGravado(), /^parar\|hook desligado\|/);
});

test('hook desligado, consertado e desligado de novo avisa uma vez no dia e outra no dia seguinte', () => {
  const c = cenario({ hooksPath: 'outro' });
  const hoje = new Date(2026, 10, 7, 12);
  commitar(c.clone, 'docs/a.md');
  c.rodar({ agora: hoje });
  git(['config', 'core.hooksPath', '.githooks'], { cwd: c.clone });
  c.rodar({ agora: hoje });
  git(['config', 'core.hooksPath', 'outro'], { cwd: c.clone });
  commitar(c.clone, 'docs/b.md');
  c.rodar({ agora: hoje });
  assert.equal(c.avisos.length, 1);
  c.rodar({ agora: new Date(2026, 10, 8, 12) });
  assert.equal(c.avisos.length, 2);
});

test('remoto à frente com o objeto ausente no clone não muda, não lança e avisa', () => {
  const c = cenario();
  const a = commitar(c.clone, 'docs/a.md');
  c.rodar();
  const segundo = join(pastaTemporaria(), 'segundo');
  assert.equal(git(['clone', '--quiet', c.remoto, segundo]).status, 0);
  const adiante = commitar(segundo, 'docs/outro.md');
  assert.equal(git(['push', '--quiet', 'origin', 'main'], { cwd: segundo }).status, 0);
  commitar(c.clone, 'docs/b.md');
  assert.doesNotThrow(() => c.rodar());
  assert.equal(c.remotoMain(), adiante);
  assert.notEqual(c.remotoMain(), a);
  assert.equal(c.avisos.length, 1);
  assert.match(c.estadoGravado(), /^parar\|histórico divergente\|/);
});

test('merge no intervalo para e avisa', () => {
  const c = cenario();
  const a = commitar(c.clone, 'docs/a.md');
  c.rodar();
  git(['checkout', '--quiet', '-b', 'lateral'], { cwd: c.clone });
  commitar(c.clone, 'docs/lateral.md');
  git(['checkout', '--quiet', 'main'], { cwd: c.clone });
  commitar(c.clone, 'docs/principal.md');
  assert.equal(git(['merge', '--quiet', '--no-ff', '--no-verify', '-m', 'junta', 'lateral'], { cwd: c.clone }).status, 0);
  c.rodar();
  assert.equal(c.remotoMain(), a);
  assert.equal(c.avisos.length, 1);
  assert.match(c.estadoGravado(), /^parar\|merge no main\|/);
});

test('push recusado por um hook pre-receive no remoto avisa e grava falha-push', () => {
  const c = cenario();
  const gancho = join(c.remoto, 'hooks', 'pre-receive');
  writeFileSync(gancho, '#!/bin/sh\necho "recusado de proposito" >&2\nexit 1\n');
  chmodSync(gancho, 0o755);
  commitar(c.clone, 'docs/a.md');
  c.rodar();
  assert.equal(c.remotoMain(), c.semente);
  assert.equal(c.avisos.length, 1);
  assert.match(c.estadoGravado(), /^falha-push\|/);
});

test('GitHub inacessível, depois ok, depois inacessível de novo avisa uma vez no dia e outra no dia seguinte', () => {
  const c = cenario();
  const queda = join(pastaTemporaria(), 'nao-existe.git');
  const hoje = new Date(2026, 10, 7, 12);
  commitar(c.clone, 'docs/a.md');
  c.rodar({ url: queda, agora: hoje });
  c.rodar({ agora: hoje });
  commitar(c.clone, 'docs/b.md');
  c.rodar({ url: queda, agora: hoje });
  assert.equal(c.avisos.length, 1);
  c.rodar({ url: queda, agora: new Date(2026, 10, 8, 12) });
  assert.equal(c.avisos.length, 2);
});

test('situação A, depois B, depois A de novo no mesmo dia avisa A e B, só', () => {
  const c = cenario({ hooksPath: 'outro' });
  const queda = join(pastaTemporaria(), 'nao-existe.git');
  const hoje = new Date(2026, 10, 7, 12);
  commitar(c.clone, 'docs/a.md');
  c.rodar({ agora: hoje });
  git(['config', 'core.hooksPath', '.githooks'], { cwd: c.clone });
  c.rodar({ url: queda, agora: hoje });
  git(['config', 'core.hooksPath', 'outro'], { cwd: c.clone });
  c.rodar({ agora: hoje });
  assert.deepEqual(c.avisos.map((aviso) => aviso.titulo), ['Backup do contexto parado', 'Backup do contexto parado']);
  assert.match(c.avisos[0].texto, /hook desligado/);
  assert.match(c.avisos[1].texto, /GitHub inacessível/);
  assert.equal(c.estadoGravado().split('\n').length, 2);
});

test('o arquivo de estado do dia seguinte não guarda as chaves do dia anterior', () => {
  const c = cenario({ hooksPath: 'outro' });
  commitar(c.clone, 'docs/a.md');
  c.rodar({ agora: new Date(2026, 10, 7, 12) });
  assert.match(c.estadoGravado(), /\|2026-11-07$/);
  c.rodar({ agora: new Date(2026, 10, 8, 12) });
  assert.match(c.estadoGravado(), /^parar\|hook desligado\|2026-11-08$/);
  git(['config', 'core.hooksPath', '.githooks'], { cwd: c.clone });
  c.rodar({ agora: new Date(2026, 10, 9, 12) });
  assert.equal(c.estadoGravado(), '');
});

test('HEAD numa branch de trabalho: empurra o main, não o HEAD', () => {
  const c = cenario();
  const topo = commitar(c.clone, 'docs/a.md');
  git(['checkout', '--quiet', '-b', 'trabalho'], { cwd: c.clone });
  commitar(c.clone, 'docs/so-no-trabalho.md');
  c.rodar();
  assert.equal(c.remotoMain(), topo);
});

test('nunca usa --force: o remoto à frente continua à frente', () => {
  const c = cenario();
  const a = commitar(c.clone, 'docs/a.md');
  const b = commitar(c.clone, 'docs/b.md');
  assert.equal(git(['push', '--quiet', c.remoto, `${b}:refs/heads/main`], { cwd: c.clone }).status, 0);
  assert.equal(git(['update-ref', 'refs/heads/main', a], { cwd: c.clone }).status, 0);
  c.rodar();
  assert.equal(c.remotoMain(), b);
  assert.equal(c.avisos.length, 1);
});

test('um commit com CPF feito com --no-verify não é empurrado e avisa', () => {
  const c = cenario();
  const limpo = commitar(c.clone, 'docs/a.md');
  c.rodar();
  commitar(c.clone, 'docs/cpf.md', `cpf ${gerar.cpfValido()}\n`);
  c.rodar();
  assert.equal(c.remotoMain(), limpo);
  assert.equal(c.avisos.length, 1);
  assert.match(c.estadoGravado(), /^parar\|a trava recusou o intervalo\|/);
});

test('falha ao ler o Git (saída grande demais) avisa e grava a situação, sem lançar', () => {
  const c = cenario();
  for (let i = 0; i < 200; i += 1) {
    const caminho = join(c.clone, 'docs', `${'n'.repeat(60)}-${i}.md`);
    mkdirSync(dirname(caminho), { recursive: true });
    writeFileSync(caminho, 'x\n');
  }
  assert.equal(git(['add', '--', 'docs'], { cwd: c.clone }).status, 0);
  assert.equal(git(['commit', '--quiet', '--no-verify', '-m', 'muitos'], { cwd: c.clone }).status, 0);
  assert.doesNotThrow(() => c.rodar({ maxBuffer: 4096 }));
  assert.equal(c.avisos.length, 1);
  assert.match(c.estadoGravado(), /^parar\|erro do Git: falha ao executar o Git: ENOBUFS\|/);
  c.rodar({ maxBuffer: 4096 });
  assert.equal(c.avisos.length, 1);
});

test('a ref-isca refs/foo/refs/heads/main não vale como o main do remoto', () => {
  const c = cenario();
  const a = commitar(c.clone, 'docs/a.md');
  c.rodar();
  commitar(c.clone, 'docs/cpf.md', `cpf ${gerar.cpfValido()}\n`);
  const isca = git(['rev-parse', 'HEAD'], { cwd: c.clone }).stdout.toString('utf8').trim();
  assert.equal(git(['push', '--quiet', c.remoto, `${isca}:refs/foo/refs/heads/main`], { cwd: c.clone }).status, 0);
  commitar(c.clone, 'docs/limpo.md');
  c.rodar();
  assert.equal(c.remotoMain(), a);
  assert.match(c.estadoGravado(), /^parar\|a trava recusou o intervalo\|/);
});

test('parada persistente com commits novos no mesmo dia avisa uma vez', () => {
  const c = cenario({ hooksPath: 'outro' });
  for (const nome of ['a', 'b', 'c']) {
    commitar(c.clone, `docs/${nome}.md`);
    c.rodar();
  }
  assert.equal(c.avisos.length, 1);
});

test('parada persistente volta a avisar no dia seguinte', () => {
  const c = cenario({ hooksPath: 'outro' });
  commitar(c.clone, 'docs/a.md');
  c.rodar({ agora: new Date(2026, 10, 7, 12) });
  c.rodar({ agora: new Date(2026, 10, 8, 12) });
  assert.equal(c.avisos.length, 2);
});

test('canal de aviso que falha: a chave não é gravada e o ciclo seguinte avisa de novo', () => {
  const c = cenario({ hooksPath: 'outro' });
  commitar(c.clone, 'docs/a.md');
  c.rodar({ canal: (n) => (n === 1 ? 1 : 0) });
  assert.equal(c.estadoGravado(), '');
  c.rodar({ canal: (n) => (n === 1 ? 1 : 0) });
  assert.equal(c.avisos.length, 2);
  assert.match(c.estadoGravado(), /^parar\|hook desligado\|/);
  assert.match(readFileSync(c.log, 'utf8'), /falha do canal de aviso/);
  c.rodar();
  assert.equal(c.avisos.length, 2);
});

test('motivo com barra vertical não é cortado no texto do aviso', () => {
  const c = cenario();
  const gancho = join(c.remoto, 'hooks', 'pre-receive');
  writeFileSync(gancho, '#!/bin/sh\necho "recusado | por regra" >&2\nexit 1\n');
  chmodSync(gancho, 0o755);
  commitar(c.clone, 'docs/a.md');
  c.rodar();
  assert.match(c.avisos[0].texto, /recusado \| por regra/);
});

test('o erro do ls-remote vai para o log', () => {
  const c = cenario();
  commitar(c.clone, 'docs/a.md');
  c.rodar({ url: join(pastaTemporaria(), 'nao-existe.git') });
  assert.match(readFileSync(c.log, 'utf8'), /GitHub inacessível \| \S.*nao-existe/);
});

test('opção desconhecida, sem valor ou com sinal de igual sai 2, sem ciclo, e registra no log', () => {
  const c = cenario();
  commitar(c.clone, 'docs/a.md');
  const avisar = () => 0;
  for (const argv of [
    ['--clone', c.clone, '--url=' + c.remoto, '--log', c.log],
    ['--clone', c.clone, '--desconhecida', 'x', '--log', c.log],
    ['--log', c.log, '--clone'],
  ]) {
    assert.equal(main(argv, { avisar }), 2);
  }
  assert.equal(c.remotoMain(), c.semente);
  assert.equal(readFileSync(c.log, 'utf8').trim().split('\n').length, 3);
});

// --- o alvo sai do conjunto varrido ---

// O remoto nomeado roda um script no lugar do upload-pack: na primeira listagem do ls-remote o main do clone muda.
function remotoQueMudaOMainNoLsRemote(c, destino) {
  const pasta = pastaTemporaria();
  const marca = join(pasta, 'feito');
  const script = join(pasta, 'gancho.mjs');
  writeFileSync(
    script,
    [
      "import { spawnSync } from 'node:child_process';",
      "import { existsSync, writeFileSync } from 'node:fs';",
      `const marca = ${JSON.stringify(marca)};`,
      'if (!existsSync(marca)) {',
      "  writeFileSync(marca, '');",
      `  spawnSync('git', ['-C', ${JSON.stringify(c.clone)}, 'update-ref', 'refs/heads/main', ${JSON.stringify(destino)}]);`,
      '}',
      "const resultado = spawnSync('git', ['upload-pack', ...process.argv.slice(2)], { stdio: 'inherit' });",
      'process.exitCode = resultado.status ?? 1;',
      '',
    ].join('\n'),
  );
  assert.equal(git(['remote', 'add', 'alvo', c.remoto], { cwd: c.clone }).status, 0);
  const comando = `"${process.execPath.replaceAll('\\', '/')}" "${script.replaceAll('\\', '/')}"`;
  assert.equal(git(['config', 'remote.alvo.uploadpack', comando], { cwd: c.clone }).status, 0);
  return 'alvo';
}

test('o main reescrito para trás durante o ls-remote não faz subir o commit que não foi varrido', () => {
  const c = cenario();
  const anterior = commitar(c.clone, 'docs/a.md');
  commitar(c.clone, '.githooks/excecoes.txt', '# trocado\n');
  const url = remotoQueMudaOMainNoLsRemote(c, anterior);
  c.rodar({ url });
  assert.equal(c.remotoMain(), anterior);
  assert.equal(c.avisos.length, 1);
  assert.match(c.estadoGravado(), /^retido\|/);
});

test('o main trocado por outro commit durante o ls-remote não faz subir o commit em .github', () => {
  const c = cenario();
  git(['checkout', '--quiet', '-b', 'lado'], { cwd: c.clone });
  const lado = commitar(c.clone, 'docs/lado.md');
  git(['checkout', '--quiet', 'main'], { cwd: c.clone });
  commitar(c.clone, '.github/workflows/x.yml');
  const url = remotoQueMudaOMainNoLsRemote(c, lado);
  c.rodar({ url });
  assert.equal(c.remotoMain(), c.semente);
  assert.equal(c.avisos.length, 1);
  assert.match(c.estadoGravado(), /^retido\|/);
});

// --- a trava é a que está no GitHub ---

function pastasDaTrava() {
  return readdirSync(tmpdir()).filter((nome) => nome.startsWith('vallus-trava-'));
}

test('a trava do disco trocada por uma que sai 0 não deixa subir um commit com CPF', () => {
  const c = cenario();
  writeFileSync(join(c.clone, '.githooks', 'trava.mjs'), 'process.exitCode = 0;\n');
  commitar(c.clone, 'docs/cpf.md', `cpf ${gerar.cpfValido()}\n`);
  c.rodar();
  assert.equal(c.remotoMain(), c.semente);
  assert.equal(c.avisos.length, 1);
  assert.match(c.estadoGravado(), /^parar\|a trava recusou o intervalo\|/);
});

test('remoto sem .githooks para com o motivo de que a trava não está no GitHub', () => {
  const c = cenario({ semeado: false });
  const a = commitar(c.clone, 'docs/a.md');
  assert.equal(git(['push', '--quiet', c.remoto, `${a}:refs/heads/main`], { cwd: c.clone }).status, 0);
  commitar(c.clone, 'docs/b.md');
  c.rodar();
  assert.equal(c.remotoMain(), a);
  assert.match(c.estadoGravado(), /^parar\|a trava não está no GitHub\|/);
});

test('remoto vazio para com o motivo de que a trava não está no GitHub', () => {
  const c = cenario({ semeado: false });
  commitar(c.clone, 'docs/a.md');
  c.rodar();
  assert.equal(c.remotoMain(), '');
  assert.match(c.estadoGravado(), /^parar\|a trava não está no GitHub\|/);
});

test('a pasta temporária da trava não sobra, nem quando a trava falha', () => {
  const antes = pastasDaTrava();
  const limpo = cenario();
  commitar(limpo.clone, 'docs/a.md');
  limpo.rodar();
  assert.equal(limpo.remotoMain(), principalDe(limpo.clone));
  const quebrado = cenario({ trava: 'process.exitCode = 2;\n' });
  commitar(quebrado.clone, 'docs/a.md');
  quebrado.rodar();
  assert.match(quebrado.estadoGravado(), /^parar\|a trava falhou\|/);
  assert.deepEqual(pastasDaTrava(), antes);
});

// --- motivos que dizem a causa ---

test('trava que estoura o tempo para com o motivo próprio', () => {
  const c = cenario({ trava: 'await new Promise((resolver) => setTimeout(resolver, 30000));\n' });
  commitar(c.clone, 'docs/a.md');
  c.rodar({ tempoDaTrava: 500 });
  assert.equal(c.remotoMain(), c.semente);
  assert.match(c.estadoGravado(), /^parar\|a trava passou do tempo\|/);
});

test('push recusado sem texto do remoto dá o motivo do Git, e não a linha To', () => {
  const c = cenario();
  const gancho = join(c.remoto, 'hooks', 'pre-receive');
  writeFileSync(gancho, '#!/bin/sh\nexit 1\n');
  chmodSync(gancho, 0o755);
  commitar(c.clone, 'docs/a.md');
  c.rodar();
  assert.match(c.estadoGravado(), /^falha-push\|/);
  assert.doesNotMatch(c.avisos[0].texto, /^To /);
  assert.match(c.avisos[0].texto, /pre-receive hook declined/);
});

test('o log do push bem-sucedido leva o commit empurrado', () => {
  const c = cenario();
  commitar(c.clone, 'docs/a.md');
  const topo = commitar(c.clone, 'docs/b.md');
  c.rodar();
  assert.ok(readFileSync(c.log, 'utf8').includes(topo));
});

test('o GitHub à frente do main local tem motivo próprio, e o divergente segue como estava', () => {
  const c = cenario();
  const a = commitar(c.clone, 'docs/a.md');
  const b = commitar(c.clone, 'docs/b.md');
  assert.equal(git(['push', '--quiet', c.remoto, `${b}:refs/heads/main`], { cwd: c.clone }).status, 0);
  assert.equal(git(['update-ref', 'refs/heads/main', a], { cwd: c.clone }).status, 0);
  c.rodar();
  assert.match(c.estadoGravado(), /^parar\|o GitHub está à frente do main local\|/);
  git(['update-ref', 'refs/heads/main', c.semente], { cwd: c.clone });
  commitar(c.clone, 'docs/outro.md');
  c.rodar({ agora: new Date('2026-11-08T10:00:00Z') });
  assert.match(c.estadoGravado(), /^parar\|histórico divergente\|/);
});

// --- lote por ciclo ---

function commitsDe(quantidade, arquivosPorCommit = 1) {
  return Array.from({ length: quantidade }, (_, i) => ({
    sha: `s${i + 1}`,
    arquivos: Array.from({ length: arquivosPorCommit }, (_, j) => `docs/${i}-${j}.md`),
  }));
}

test('decidir: 31 commits sobem em lote de 30', () => {
  const commits = commitsDe(31);
  assert.deepEqual(decidir(estadoBase({ commits, local: 's31' })), { acao: 'empurrar', alvo: 's30' });
});

test('decidir: commits de 100 arquivos sobem um por ciclo', () => {
  const commits = commitsDe(3, 100);
  assert.deepEqual(decidir(estadoBase({ commits, local: 's3' })), { acao: 'empurrar', alvo: 's1' });
});

test('decidir: um commit de 200 arquivos sobe sozinho', () => {
  const commits = commitsDe(2, 200);
  assert.deepEqual(decidir(estadoBase({ commits, local: 's2' })), { acao: 'empurrar', alvo: 's1' });
});

test('decidir: o lote soma os arquivos de commits menores até 150', () => {
  const commits = [
    { sha: 's1', arquivos: commitsDe(1, 100)[0].arquivos },
    { sha: 's2', arquivos: commitsDe(1, 50)[0].arquivos },
    { sha: 's3', arquivos: commitsDe(1, 1)[0].arquivos },
  ];
  assert.deepEqual(decidir(estadoBase({ commits, local: 's3' })), { acao: 'empurrar', alvo: 's2' });
});

test('decidir: commit em .github na posição 40 limita o lote a 30 e continua retido', () => {
  const commits = commitsDe(45);
  commits[39] = { sha: 's40', arquivos: ['.github/workflows/x.yml'] };
  assert.deepEqual(decidir(estadoBase({ commits, local: 's45' })), { acao: 'empurrar', alvo: 's30', retido: 's40' });
});

// --- o Agendador espera o ciclo ---

test('o empurrar.vbs espera o node terminar, para o IgnoreNew do Agendador valer', () => {
  const vbs = readFileSync(join(raiz, 'ferramentas', 'tarefa', 'empurrar.vbs'), 'utf8');
  assert.match(vbs, /, 0, True\s*$/);
});

// --- ajustes residuais ---

test('um git replace do blob da trava no GitHub não troca a trava que roda', () => {
  const c = cenario();
  const blobDaTrava = git(['rev-parse', `${c.semente}:.githooks/trava.mjs`], { cwd: c.clone }).stdout.toString('utf8').trim();
  const frouxa = git(['hash-object', '-w', '--stdin'], { cwd: c.clone, input: 'process.exitCode = 0;\n' });
  assert.equal(frouxa.status, 0, frouxa.stderr);
  assert.equal(git(['replace', blobDaTrava, frouxa.stdout.toString('utf8').trim()], { cwd: c.clone }).status, 0);
  commitar(c.clone, 'docs/cpf.md', `cpf ${gerar.cpfValido()}\n`);
  c.rodar();
  assert.equal(c.remotoMain(), c.semente);
  assert.equal(c.avisos.length, 1);
  assert.match(c.estadoGravado(), /^parar\|a trava recusou o intervalo\|/);
});

test('push recusado duas vezes no mesmo dia, com alvos diferentes e o mesmo motivo, avisa uma vez', () => {
  const c = cenario();
  const gancho = join(c.remoto, 'hooks', 'pre-receive');
  writeFileSync(gancho, '#!/bin/sh\nwhile read antigo novo ref; do echo "recusado $novo" >&2; done\nexit 1\n');
  chmodSync(gancho, 0o755);
  commitar(c.clone, 'docs/a.md');
  c.rodar();
  commitar(c.clone, 'docs/b.md');
  c.rodar();
  assert.equal(c.avisos.length, 1);
  assert.match(readFileSync(c.log, 'utf8'), /recusado [0-9a-f]{40}/);
});

test('o rodar.mjs dá prazo ao aviso do Windows', () => {
  const rodar = readFileSync(join(raiz, 'ferramentas', 'tarefa', 'rodar.mjs'), 'utf8');
  assert.match(rodar, /timeout: 60_000/);
});

// --- batimento: a hora do último ciclo ---

const batimentoDe = (c) => join(dirname(c.estado), 'ultimo-ciclo.json');

test('ciclo ok grava o batimento com ultimoCiclo e ultimoOk iguais a agora', () => {
  const c = cenario();
  const agora = new Date('2026-11-07T10:00:00Z');
  c.rodar({ agora });
  const iso = agora.toISOString();
  assert.equal(readFileSync(batimentoDe(c), 'utf8'), `{"ultimoCiclo":"${iso}","ultimoOk":"${iso}"}\n`);
});

test('ciclo parado depois avança ultimoCiclo e mantém ultimoOk', () => {
  const c = cenario();
  const primeiro = new Date('2026-11-07T10:00:00Z');
  const segundo = new Date('2026-11-07T11:00:00Z');
  c.rodar({ agora: primeiro });
  git(['config', 'core.hooksPath', 'outro'], { cwd: c.clone });
  commitar(c.clone, 'docs/a.md');
  c.rodar({ agora: segundo });
  assert.deepEqual(JSON.parse(readFileSync(batimentoDe(c), 'utf8')), {
    ultimoCiclo: segundo.toISOString(),
    ultimoOk: primeiro.toISOString(),
  });
});

test('batimento com JSON inválido não lança e vira ultimoOk nulo no ciclo parado', () => {
  const c = cenario({ hooksPath: 'outro' });
  mkdirSync(dirname(batimentoDe(c)), { recursive: true });
  writeFileSync(batimentoDe(c), 'isto não é json');
  commitar(c.clone, 'docs/a.md');
  const agora = new Date('2026-11-07T10:00:00Z');
  assert.doesNotThrow(() => c.rodar({ agora }));
  assert.deepEqual(JSON.parse(readFileSync(batimentoDe(c), 'utf8')), { ultimoCiclo: agora.toISOString(), ultimoOk: null });
});

test('opção inválida não cria o arquivo de batimento', () => {
  const c = cenario();
  const argv = ['--clone', c.clone, '--estado', c.estado, '--log', c.log, '--desconhecida', 'x'];
  assert.equal(main(argv, { avisar: () => 0 }), 2);
  assert.equal(existsSync(batimentoDe(c)), false);
});

test('falha ao gravar o batimento não derruba o ciclo: um aviso só, código do ciclo e linha no log', () => {
  const c = cenario({ hooksPath: 'outro' });
  mkdirSync(batimentoDe(c), { recursive: true });
  commitar(c.clone, 'docs/a.md');
  assert.equal(c.rodar(), 0);
  assert.equal(c.avisos.length, 1);
  assert.match(c.avisos[0].texto, /hook desligado/);
  assert.match(readFileSync(c.log, 'utf8'), /^\S+ falha ao gravar o batimento$/m);
  assert.doesNotMatch(readFileSync(c.log, 'utf8'), /erro inesperado/);
});
