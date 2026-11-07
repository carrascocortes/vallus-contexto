import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
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
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conferirCaminhos } from '../.githooks/lib/conferir.mjs';
import { arquivosMudados } from '../.githooks/lib/git.mjs';
import { commitsDoPush } from '../.githooks/lib/push.mjs';
import { git, repoTemporario } from './git.mjs';
import * as gerar from './gerar.mjs';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ZEROS = '0'.repeat(40);
const ENTRADA = 'frentes/minha-frente/memoria/2026-11-05-turno.md';
const PASSAGEM = 'frentes/minha-frente/passagem.md';

const pastas = [];

function pastaTemporaria() {
  const pasta = mkdtempSync(join(tmpdir(), 'trava-'));
  pastas.push(pasta);
  return pasta;
}

after(() => {
  for (const pasta of pastas) rmSync(pasta, { recursive: true, force: true });
});

function binarioDoGitleaks() {
  const padrao = join(homedir(), '.vallus-contexto', 'bin', process.platform === 'win32' ? 'gitleaks.exe' : 'gitleaks');
  return process.env.VALLUS_GITLEAKS ?? padrao;
}

test('o gitleaks real está disponível', () => {
  const resultado = spawnSync(binarioDoGitleaks(), ['version'], { encoding: 'utf8' });
  assert.equal(resultado.status, 0, `sem gitleaks em ${binarioDoGitleaks()}: instale-o antes de rodar os testes`);
});

// Cada repositório leva uma cópia do .githooks e uma pasta própria de retidas.
function repoComTrava({ comHook = false } = {}) {
  const repo = repoTemporario();
  cpSync(join(raiz, '.githooks'), join(repo, '.githooks'), { recursive: true });
  for (const gancho of ['pre-commit', 'commit-msg']) chmodSync(join(repo, '.githooks', gancho), 0o755);
  if (comHook) git(['config', 'core.hooksPath', '.githooks'], { cwd: repo });
  return { repo, retidas: join(pastaTemporaria(), 'retidas') };
}

const IDENTIDADE_DE_TESTE = {
  GIT_AUTHOR_NAME: 'teste',
  GIT_AUTHOR_EMAIL: 'noreply@example.invalid',
  GIT_COMMITTER_NAME: 'teste',
  GIT_COMMITTER_EMAIL: 'noreply@example.invalid',
};

function ambiente({ retidas, extra = {} }) {
  return { ...process.env, ...IDENTIDADE_DE_TESTE, VALLUS_RETIDAS: retidas, ...extra };
}

function trava(contexto, args, extra) {
  const resultado = spawnSync(process.execPath, [join(contexto.repo, '.githooks', 'trava.mjs'), ...args], {
    cwd: contexto.repo,
    env: ambiente({ retidas: contexto.retidas, extra }),
    encoding: 'utf8',
  });
  return { status: resultado.status, saida: `${resultado.stdout}${resultado.stderr}` };
}

function gravar(repo, caminho, conteudo) {
  const completo = join(repo, caminho);
  mkdirSync(dirname(completo), { recursive: true });
  writeFileSync(completo, conteudo);
}

function adicionar(repo, ...caminhos) {
  const resultado = git(['add', '--', ...caminhos], { cwd: repo });
  assert.equal(resultado.status, 0, resultado.stderr);
}

function commitar(contexto, args, extra) {
  const resultado = spawnSync('git', ['commit', '--quiet', '-m', 'teste', ...args], {
    cwd: contexto.repo,
    env: {
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(pastaTemporaria(), 'config'),
      ...ambiente({ retidas: contexto.retidas, extra }),
    },
    encoding: 'utf8',
  });
  return { status: resultado.status, saida: `${resultado.stdout}${resultado.stderr}` };
}

function commitSemHook(repo, mensagem = 'c') {
  const resultado = git(['commit', '--quiet', '--no-verify', '--allow-empty', '-m', mensagem], { cwd: repo });
  assert.equal(resultado.status, 0, resultado.stderr);
  return git(['rev-parse', 'HEAD'], { cwd: repo }).stdout.toString('utf8').trim();
}

function cabecalhoDeEntrada({ autor = 'sessão manual', sessao = gerar.uuid(), modelo = 'claude-opus-5-5' } = {}) {
  return [
    '---',
    'data: 2026-11-05T22:10-03:00',
    `autor: ${autor}`,
    'ferramenta: claude-code',
    `modelo: ${modelo}`,
    `sessao: ${sessao}`,
    'desfecho: concluido',
    '---',
    '## Feito',
  ];
}

function entradaComCpf(opcoes) {
  return [...cabecalhoDeEntrada(opcoes), `CPF do cliente: ${gerar.cpfValido()}`, ''].join('\n');
}

function passagemComEmail(email) {
  return [
    '---',
    'atualizada: 2026-11-05T21:40-03:00',
    'por: claude-code · claude-opus-5-5',
    `sessao: ${gerar.uuid()}`,
    'sessao_aberta: sim',
    '---',
    `Contato: ${email}`,
    '',
  ].join('\n');
}

function arquivosRetidos(retidas) {
  if (!existsSync(retidas)) return [];
  return readdirSync(retidas, { recursive: true, withFileTypes: true })
    .filter((entrada) => entrada.isFile())
    .map((entrada) => join(entrada.parentPath, entrada.name));
}

function temCommit(contexto) {
  return git(['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: contexto.repo }).status === 0;
}

const VALORES_PLANTADOS = {
  'chave de API': () => `token = ${gerar.chaveGithub()}`,
  PEM: () => gerar.pem(),
  JWT: () => `jwt ${gerar.jwt()}`,
  'conexão com senha': () => gerar.conexaoComSenha(),
  CPF: () => `cpf ${gerar.cpfValido()}`,
  CNPJ: () => `cnpj ${gerar.cnpjValido()}`,
  'e-mail fora da lista': () => `contato ${gerar.emailDeFora()}`,
  'id de organização': () => `org ${gerar.cuid()}`,
  'UUID no corpo': () => `sessao ${gerar.uuid()}`,
};

for (const [nome, plantar] of Object.entries(VALORES_PLANTADOS)) {
  test(`recusa ${nome} plantado`, () => {
    const contexto = repoComTrava();
    const valor = plantar();
    gravar(contexto.repo, 'docs/nota.md', `# nota\n${valor}\n`);
    adicionar(contexto.repo, 'docs/nota.md');
    const { status, saida } = trava(contexto, ['--staged']);
    assert.equal(status, 1, saida);
    assert.ok(saida.includes('docs/nota.md'));
    for (const trecho of valor.split(/\s+/)) {
      if (trecho.length >= 8) assert.ok(!saida.includes(trecho), 'a saída repetiu o valor plantado');
    }
  });
}

test('recusa nome de arquivo com acento', () => {
  const contexto = repoComTrava();
  gravar(contexto.repo, 'docs/ação.md', '# nota\n');
  adicionar(contexto.repo, 'docs/ação.md');
  const { status, saida } = trava(contexto, ['--staged']);
  assert.equal(status, 1, saida);
  assert.match(saida, /nome-com-acento/);
});

test('aceita arquivo limpo', () => {
  const contexto = repoComTrava();
  gravar(contexto.repo, 'docs/nota.md', '# nota\ntexto limpo\n');
  adicionar(contexto.repo, 'docs/nota.md');
  assert.equal(trava(contexto, ['--staged']).status, 0);
});

test('aceita UUID no campo sessao e recusa os três casos vermelhos do campo', () => {
  const contexto = repoComTrava();
  const caminho = 'docs/nota.md';
  const caso = (corpo) => {
    gravar(contexto.repo, caminho, corpo);
    adicionar(contexto.repo, caminho);
    return trava(contexto, ['--staged']).status;
  };
  assert.equal(caso(`---\nsessao: ${gerar.uuid()}\n---\ntexto\n`), 0);
  assert.equal(caso(`---\ncampo: x\n---\nsessao: ${gerar.uuid()}\n`), 1);
  assert.equal(caso(`---\nsessao: ${gerar.uuid()}\n---\n---\nsessao: ${gerar.uuid()}\n---\n`), 1);
  assert.equal(caso(`---\nsessao: ${gerar.uuid()} ${gerar.uuid()}\n---\ntexto\n`), 1);
});

test('recusa lição sem linha no índice e aceita com a linha no mesmo commit', () => {
  const contexto = repoComTrava();
  gravar(contexto.repo, 'memoria/INDICE.md', '# Índice\n');
  gravar(contexto.repo, 'memoria/licoes/algo.md', '# algo\n');
  adicionar(contexto.repo, 'memoria/INDICE.md', 'memoria/licoes/algo.md');
  const recusada = trava(contexto, ['--staged']);
  assert.equal(recusada.status, 1, recusada.saida);
  assert.match(recusada.saida, /licao-sem-indice/);
  gravar(contexto.repo, 'memoria/INDICE.md', '# Índice\n- [algo](licoes/algo.md)\n');
  adicionar(contexto.repo, 'memoria/INDICE.md');
  assert.equal(trava(contexto, ['--staged']).status, 0);
});

test('retém entrada com CPF e deixa o esboço passar no commit seguinte', () => {
  const contexto = repoComTrava({ comHook: true });
  const original = entradaComCpf();
  gravar(contexto.repo, ENTRADA, original);
  adicionar(contexto.repo, ENTRADA);
  const recusado = commitar(contexto, []);
  assert.notEqual(recusado.status, 0, recusado.saida);
  assert.equal(temCommit(contexto), false);
  const noLugar = readFileSync(join(contexto.repo, ENTRADA), 'utf8');
  assert.match(noLugar, /desfecho: retido/);
  assert.match(noLugar, /motivo: trava: cpf/);
  const retidos = arquivosRetidos(contexto.retidas);
  assert.equal(retidos.length, 1);
  assert.equal(readFileSync(retidos[0], 'utf8'), original);
  assert.match(recusado.saida, /git add -- frentes\/minha-frente\/memoria\/2026-11-05-turno\.md/);
  assert.match(recusado.saida, /git commit -- frentes\/minha-frente\/memoria\/2026-11-05-turno\.md/);
  adicionar(contexto.repo, ENTRADA);
  const aceito = commitar(contexto, ['--', ENTRADA]);
  assert.equal(aceito.status, 0, aceito.saida);
  assert.equal(temCommit(contexto), true);
});

test('retém passagem com e-mail fora da lista', () => {
  const contexto = repoComTrava({ comHook: true });
  const email = gerar.emailDeFora();
  gravar(contexto.repo, PASSAGEM, passagemComEmail(email));
  adicionar(contexto.repo, PASSAGEM);
  const recusado = commitar(contexto, []);
  assert.notEqual(recusado.status, 0, recusado.saida);
  const noLugar = readFileSync(join(contexto.repo, PASSAGEM), 'utf8');
  assert.ok(!noLugar.includes(email));
  assert.equal(arquivosRetidos(contexto.retidas).length, 1);
  adicionar(contexto.repo, PASSAGEM);
  assert.equal(commitar(contexto, ['--', PASSAGEM]).status, 0);
});

test('retém entrada com CPF no corpo e valor que só o gitleaks barra no autor', () => {
  const contexto = repoComTrava({ comHook: true });
  const chave = gerar.chaveDatabricks();
  gravar(contexto.repo, ENTRADA, entradaComCpf({ autor: chave }));
  adicionar(contexto.repo, ENTRADA);
  const recusado = commitar(contexto, []);
  assert.notEqual(recusado.status, 0, recusado.saida);
  const noLugar = readFileSync(join(contexto.repo, ENTRADA), 'utf8');
  assert.ok(!noLugar.includes(chave));
  assert.ok(!recusado.saida.includes(chave));
  assert.match(noLugar, /motivo: trava: gitleaks, cpf/);
  adicionar(contexto.repo, ENTRADA);
  assert.equal(commitar(contexto, ['--', ENTRADA]).status, 0);
});

test('não retém lição barrada', () => {
  const contexto = repoComTrava();
  const caminho = 'memoria/licoes/algo.md';
  const original = `# algo\ncpf ${gerar.cpfValido()}\n`;
  gravar(contexto.repo, 'memoria/INDICE.md', '- [algo](licoes/algo.md)\n');
  gravar(contexto.repo, caminho, original);
  adicionar(contexto.repo, 'memoria/INDICE.md', caminho);
  assert.equal(trava(contexto, ['--staged']).status, 1);
  assert.equal(readFileSync(join(contexto.repo, caminho), 'utf8'), original);
  assert.deepEqual(arquivosRetidos(contexto.retidas), []);
});

test('recusa sem mover quando a pasta das retidas falha', () => {
  const contexto = repoComTrava();
  const original = entradaComCpf();
  writeFileSync((contexto.retidas = join(pastaTemporaria(), 'arquivo')), 'não é pasta');
  gravar(contexto.repo, ENTRADA, original);
  adicionar(contexto.repo, ENTRADA);
  const { status, saida } = trava(contexto, ['--staged']);
  assert.equal(status, 1, saida);
  assert.equal(readFileSync(join(contexto.repo, ENTRADA), 'utf8'), original);
});

test('lê o conteúdo do commit por caminho, e não o do disco nem o do índice comum', () => {
  const contexto = repoComTrava({ comHook: true });
  gravar(contexto.repo, 'docs/a.md', 'limpo\n');
  adicionar(contexto.repo, 'docs/a.md');
  assert.equal(commitar(contexto, []).status, 0);
  gravar(contexto.repo, 'docs/a.md', `cpf ${gerar.cpfValido()}\n`);
  const recusado = commitar(contexto, ['--', 'docs/a.md']);
  assert.notEqual(recusado.status, 0, recusado.saida);
  assert.equal(git(['rev-list', '--count', 'HEAD'], { cwd: contexto.repo }).stdout.toString().trim(), '1');
});

test('o hook roda no git commit e barra o valor', () => {
  const contexto = repoComTrava({ comHook: true });
  gravar(contexto.repo, 'docs/a.md', `cpf ${gerar.cpfValido()}\n`);
  adicionar(contexto.repo, 'docs/a.md');
  const recusado = commitar(contexto, []);
  assert.notEqual(recusado.status, 0);
  assert.match(recusado.saida, /cpf/);
  assert.equal(temCommit(contexto), false);
});

const COM_BOM = String.fromCharCode(0xfeff);

function recusaSemRetida(nome, bytes) {
  test(nome, () => {
    const contexto = repoComTrava();
    gravar(contexto.repo, ENTRADA, bytes);
    adicionar(contexto.repo, ENTRADA);
    const { status, saida } = trava(contexto, ['--staged']);
    assert.equal(status, 1, saida);
    assert.match(saida, /encoding-invalido/);
    assert.deepEqual(arquivosRetidos(contexto.retidas), []);
    assert.deepEqual(readFileSync(join(contexto.repo, ENTRADA)), bytes);
  });
}

recusaSemRetida(
  'recusa .md em UTF-16LE com CPF',
  Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(`cpf ${gerar.cpfValido()}\n`, 'utf16le')]),
);
recusaSemRetida('recusa ANSI', Buffer.from('ação do dia\n', 'latin1'));
recusaSemRetida('recusa byte nulo num .md em UTF-8', Buffer.from('a\0b\n', 'utf8'));

test('aceita UTF-8 com BOM e CRLF', () => {
  const contexto = repoComTrava();
  gravar(contexto.repo, 'docs/a.md', `${COM_BOM}# título\r\nlinha\r\n`);
  adicionar(contexto.repo, 'docs/a.md');
  assert.equal(trava(contexto, ['--staged']).status, 0);
});

test('BOM e CRLF não escondem um valor', () => {
  const contexto = repoComTrava();
  gravar(contexto.repo, 'docs/a.md', `${COM_BOM}# título\r\ncpf ${gerar.cpfValido()}\r\n`);
  adicionar(contexto.repo, 'docs/a.md');
  assert.equal(trava(contexto, ['--staged']).status, 1);
});

test('renomeado para nome com acento é recusado e apagado passa', () => {
  const contexto = repoComTrava();
  gravar(contexto.repo, 'docs/a.md', 'limpo\n');
  gravar(contexto.repo, 'docs/b.md', 'outro\n');
  adicionar(contexto.repo, 'docs/a.md', 'docs/b.md');
  commitSemHook(contexto.repo);
  assert.equal(git(['mv', 'docs/a.md', 'docs/ação.md'], { cwd: contexto.repo }).status, 0);
  assert.equal(trava(contexto, ['--staged']).status, 1);
  assert.equal(git(['reset', '--quiet', '--hard'], { cwd: contexto.repo }).status, 0);
  assert.equal(git(['rm', '--quiet', '--', 'docs/b.md'], { cwd: contexto.repo }).status, 0);
  assert.equal(trava(contexto, ['--staged']).status, 0);
});

function hashDe(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const EXCECOES = '.githooks/excecoes.txt';

function anexarExcecao(repo, linha) {
  appendFileSync(join(repo, EXCECOES), linha);
}

test('exceção por hash: o arquivo exato passa e o mesmo caminho com outro conteúdo é recusado', () => {
  const contexto = repoComTrava();
  const conteudo = `exemplo ${gerar.cpfValido()}\n`;
  gravar(contexto.repo, 'docs/exemplo.md', conteudo);
  anexarExcecao(contexto.repo, `docs/exemplo.md\t${hashDe(Buffer.from(conteudo))}\texemplo documentado\n`);
  adicionar(contexto.repo, EXCECOES, 'docs/exemplo.md');
  assert.equal(trava(contexto, ['--staged']).status, 0);
  gravar(contexto.repo, 'docs/exemplo.md', `exemplo ${gerar.cpfValido()}\n`);
  adicionar(contexto.repo, 'docs/exemplo.md');
  assert.equal(trava(contexto, ['--staged']).status, 1);
});

test('exceção só vale se o excecoes.txt estiver no índice, e não só no disco', () => {
  const contexto = repoComTrava();
  const conteudo = `exemplo ${gerar.cpfValido()}\n`;
  gravar(contexto.repo, 'docs/exemplo.md', conteudo);
  anexarExcecao(contexto.repo, `docs/exemplo.md\t${hashDe(Buffer.from(conteudo))}\texemplo documentado\n`);
  adicionar(contexto.repo, 'docs/exemplo.md');
  assert.equal(trava(contexto, ['--staged']).status, 1);
});

test('exceção do --commit vem do commit', () => {
  const contexto = repoComTrava();
  const conteudo = `exemplo ${gerar.cpfValido()}\n`;
  gravar(contexto.repo, 'docs/exemplo.md', conteudo);
  anexarExcecao(contexto.repo, `docs/exemplo.md\t${hashDe(Buffer.from(conteudo))}\texemplo documentado\n`);
  adicionar(contexto.repo, EXCECOES, 'docs/exemplo.md');
  assert.equal(trava(contexto, ['--commit', commitSemHook(contexto.repo)]).status, 0);
});

test('excecoes.txt com BOM UTF-8 é interpretado', () => {
  const contexto = repoComTrava();
  const conteudo = `exemplo ${gerar.cpfValido()}\n`;
  const linha = `docs/exemplo.md\t${hashDe(Buffer.from(conteudo))}\texemplo documentado\n`;
  writeFileSync(join(contexto.repo, EXCECOES), `${COM_BOM}# comentário\n${linha}`);
  gravar(contexto.repo, 'docs/exemplo.md', conteudo);
  adicionar(contexto.repo, EXCECOES, 'docs/exemplo.md');
  assert.equal(trava(contexto, ['--staged']).status, 0);
});

test('linha malformada em excecoes.txt é erro, não exceção', () => {
  const contexto = repoComTrava();
  anexarExcecao(contexto.repo, 'docs/exemplo.md\tsem-hash\n');
  gravar(contexto.repo, 'docs/a.md', 'limpo\n');
  adicionar(contexto.repo, EXCECOES, 'docs/a.md');
  assert.equal(trava(contexto, ['--staged']).status, 2);
});

const NOMES_COM_VALOR = {
  CPF: () => gerar.cpfValido(),
  'e-mail de fora': () => gerar.emailDeFora(),
  UUID: () => gerar.uuid(),
};

for (const [nome, plantar] of Object.entries(NOMES_COM_VALOR)) {
  test(`recusa ${nome} no nome do arquivo sem mostrar o valor`, () => {
    const contexto = repoComTrava();
    const valor = plantar();
    gravar(contexto.repo, `docs/${valor}.md`, 'limpo\n');
    adicionar(contexto.repo, `docs/${valor}.md`);
    const { status, saida } = trava(contexto, ['--staged']);
    assert.equal(status, 1, saida);
    assert.ok(!saida.includes(valor), 'a saída repetiu o valor do nome');
    assert.match(saida, /nome-com-/);
    assert.match(saida, /git diff --cached --name-only/);
    const commit = commitSemHook(contexto.repo);
    const doCommit = trava(contexto, ['--commit', commit]);
    assert.equal(doCommit.status, 1);
    assert.ok(!doCommit.saida.includes(valor));
    assert.match(doCommit.saida, new RegExp(`git show --name-only ${commit}`));
  });
}

test('nome com valor e conteúdo com valor não mostram o nome e não retêm', () => {
  const contexto = repoComTrava();
  const cpfDoNome = gerar.cpfValido();
  const caminho = `frentes/${cpfDoNome}/passagem.md`;
  const original = passagemComEmail(gerar.emailDeFora());
  gravar(contexto.repo, caminho, original);
  adicionar(contexto.repo, caminho);
  const { status, saida } = trava(contexto, ['--staged']);
  assert.equal(status, 1, saida);
  assert.ok(!saida.includes(cpfDoNome));
  assert.equal(readFileSync(join(contexto.repo, caminho), 'utf8'), original);
  assert.deepEqual(arquivosRetidos(contexto.retidas), []);
});

function repoComMergeSujo() {
  const contexto = repoComTrava();
  const base = commitSemHook(contexto.repo, 'base');
  assert.equal(git(['checkout', '--quiet', '-b', 'lado'], { cwd: contexto.repo }).status, 0);
  gravar(contexto.repo, 'docs/lado.md', 'limpo\n');
  adicionar(contexto.repo, 'docs/lado.md');
  commitSemHook(contexto.repo, 'lado');
  assert.equal(git(['checkout', '--quiet', 'main'], { cwd: contexto.repo }).status, 0);
  gravar(contexto.repo, 'docs/principal.md', 'limpo\n');
  adicionar(contexto.repo, 'docs/principal.md');
  commitSemHook(contexto.repo, 'principal');
  const juncao = git(['merge', '--quiet', '--no-commit', '--no-ff', 'lado'], { cwd: contexto.repo });
  assert.equal(juncao.status, 0, juncao.stderr);
  const cpf = gerar.cpfValido();
  gravar(contexto.repo, 'docs/so-no-merge.md', `cpf ${cpf}\n`);
  adicionar(contexto.repo, 'docs/so-no-merge.md');
  return { contexto, base, cpf, merge: commitSemHook(contexto.repo, 'merge') };
}

test('--commit confere o conteúdo próprio de um merge', () => {
  const { contexto, merge, cpf } = repoComMergeSujo();
  const { status, saida } = trava(contexto, ['--commit', merge]);
  assert.equal(status, 1, saida);
  assert.ok(!saida.includes(cpf));
});

test('--push confere o conteúdo próprio de um merge', () => {
  const { contexto, base, merge, cpf } = repoComMergeSujo();
  const { status, saida } = trava(contexto, ['--push', base, merge]);
  assert.equal(status, 1, saida);
  assert.ok(!saida.includes(cpf));
});

test('a retida só acontece quando o disco é o que está no índice', () => {
  const contexto = repoComTrava();
  const cpf = gerar.cpfValido();
  gravar(contexto.repo, ENTRADA, [...cabecalhoDeEntrada(), `CPF do cliente: ${cpf}`, ''].join('\n'));
  adicionar(contexto.repo, ENTRADA);
  const alterado = [...cabecalhoDeEntrada(), 'texto novo, ainda sem git add', ''].join('\n');
  gravar(contexto.repo, ENTRADA, alterado);
  const { status, saida } = trava(contexto, ['--staged']);
  assert.equal(status, 1, saida);
  assert.match(saida, /git add -- frentes\/minha-frente\/memoria\/2026-11-05-turno\.md/);
  assert.equal(readFileSync(join(contexto.repo, ENTRADA), 'utf8'), alterado);
  assert.deepEqual(arquivosRetidos(contexto.retidas), []);
});

test('disco com CRLF e índice com LF ainda retém', () => {
  const contexto = repoComTrava();
  const original = entradaComCpf();
  gravar(contexto.repo, ENTRADA, original);
  adicionar(contexto.repo, ENTRADA);
  gravar(contexto.repo, ENTRADA, original.replace(/\n/g, '\r\n'));
  assert.equal(trava(contexto, ['--staged']).status, 1);
  assert.equal(arquivosRetidos(contexto.retidas).length, 1);
});

test('a saída da retida não mostra o CPF nem o e-mail, e o esboço também não', () => {
  const contexto = repoComTrava();
  const cpf = gerar.cpfValido();
  const email = gerar.emailDeFora();
  gravar(contexto.repo, ENTRADA, [...cabecalhoDeEntrada(), `CPF do cliente: ${cpf}`, ''].join('\n'));
  gravar(contexto.repo, PASSAGEM, passagemComEmail(email));
  adicionar(contexto.repo, ENTRADA, PASSAGEM);
  const { status, saida } = trava(contexto, ['--staged']);
  assert.equal(status, 1, saida);
  assert.equal(arquivosRetidos(contexto.retidas).length, 2);
  for (const valor of [cpf, email]) {
    assert.ok(!saida.includes(valor));
    for (const caminho of [ENTRADA, PASSAGEM]) assert.ok(!readFileSync(join(contexto.repo, caminho), 'utf8').includes(valor));
  }
});

test('--commit e --push não mostram o valor', () => {
  const { contexto, base, primeiro } = repoComTresCommits();
  const cpf = git(['show', `${primeiro}:docs/a.md`], { cwd: contexto.repo }).stdout.toString('utf8').replace('cpf ', '').trim();
  for (const args of [['--commit', primeiro], ['--push', base, primeiro]]) {
    const { status, saida } = trava(contexto, args);
    assert.equal(status, 1, saida);
    assert.ok(!saida.includes(cpf));
  }
});

test('GITLEAKS_CONFIG em minúsculas também não chega ao gitleaks', () => {
  const contexto = repoComTrava();
  const configuracao = join(pastaTemporaria(), 'frouxa.toml');
  writeFileSync(configuracao, "[allowlist]\nregexes = ['.*']\n");
  gravar(contexto.repo, 'docs/a.md', `chave = ${gerar.chaveDatabricks()}\n`);
  adicionar(contexto.repo, 'docs/a.md');
  const { status, saida } = trava(contexto, ['--staged'], { gitleaks_config: configuracao, Gitleaks_Config_Toml: "[allowlist]\nregexes = ['.*']\n" });
  assert.equal(status, 1, saida);
});

test('sem gitleaks a trava recusa com saída 2', () => {
  const contexto = repoComTrava({ comHook: true });
  gravar(contexto.repo, 'docs/a.md', 'limpo\n');
  adicionar(contexto.repo, 'docs/a.md');
  const ausente = join(pastaTemporaria(), 'nao-existe');
  assert.equal(trava(contexto, ['--staged'], { VALLUS_GITLEAKS: ausente }).status, 2);
  assert.notEqual(commitar(contexto, [], { VALLUS_GITLEAKS: ausente }).status, 0);
  assert.equal(temCommit(contexto), false);
});

test('gitleaks com erro não retém', () => {
  const contexto = repoComTrava();
  const original = entradaComCpf();
  gravar(contexto.repo, ENTRADA, original);
  adicionar(contexto.repo, ENTRADA);
  const { status } = trava(contexto, ['--staged'], { VALLUS_GITLEAKS: process.execPath });
  assert.equal(status, 2);
  assert.equal(readFileSync(join(contexto.repo, ENTRADA), 'utf8'), original);
  assert.deepEqual(arquivosRetidos(contexto.retidas), []);
});

test('GITLEAKS_CONFIG malformado no ambiente de quem chama não chega ao gitleaks', () => {
  const contexto = repoComTrava();
  const configuracao = join(pastaTemporaria(), 'ruim.toml');
  writeFileSync(configuracao, '[[rules\nid = ');
  const extra = { GITLEAKS_CONFIG: configuracao, GITLEAKS_CONFIG_TOML: 'nao = [valido' };
  gravar(contexto.repo, 'docs/a.md', 'limpo\n');
  adicionar(contexto.repo, 'docs/a.md');
  assert.equal(trava(contexto, ['--staged'], extra).status, 0);
  gravar(contexto.repo, 'docs/a.md', `chave = ${gerar.chaveDatabricks()}\n`);
  adicionar(contexto.repo, 'docs/a.md');
  assert.equal(trava(contexto, ['--staged'], extra).status, 1);
});

test('um .gitleaks.toml na raiz do repositório não muda o resultado', () => {
  const contexto = repoComTrava();
  gravar(contexto.repo, '.gitleaks.toml', '[allowlist]\nregexes = [\'.*\']\n');
  gravar(contexto.repo, 'docs/a.md', `chave = ${gerar.chaveDatabricks()}\n`);
  adicionar(contexto.repo, 'docs/a.md');
  assert.equal(trava(contexto, ['--staged']).status, 1);
});

test('gitleaks:allow na linha não esconde a chave', () => {
  const contexto = repoComTrava();
  gravar(contexto.repo, 'docs/a.md', `chave = ${gerar.chaveDatabricks()} # gitleaks:allow\n`);
  adicionar(contexto.repo, 'docs/a.md');
  assert.equal(trava(contexto, ['--staged']).status, 1);
});

test('chave de acesso que só o gitleaks reconhece é barrada', () => {
  const contexto = repoComTrava();
  gravar(contexto.repo, 'docs/a.md', `acesso = ${gerar.chaveDeAcesso()}\n`);
  adicionar(contexto.repo, 'docs/a.md');
  const { status, saida } = trava(contexto, ['--staged']);
  assert.equal(status, 1);
  assert.match(saida, /docs\/a\.md:1: gitleaks/);
});

test('--commit confere um commit feito com --no-verify', () => {
  const contexto = repoComTrava();
  gravar(contexto.repo, 'docs/a.md', `cpf ${gerar.cpfValido()}\n`);
  adicionar(contexto.repo, 'docs/a.md');
  const { status, saida } = trava(contexto, ['--commit', commitSemHook(contexto.repo)]);
  assert.equal(status, 1, saida);
});

test('--commit com arquivo de nome acentuado dá 1 e não 2', () => {
  const contexto = repoComTrava();
  gravar(contexto.repo, 'docs/ação.md', 'limpo\n');
  adicionar(contexto.repo, 'docs/ação.md');
  const { status, saida } = trava(contexto, ['--commit', commitSemHook(contexto.repo)]);
  assert.equal(status, 1, saida);
});

test('--commit recusa argumento que não é um commit', () => {
  const contexto = repoComTrava();
  commitSemHook(contexto.repo);
  assert.equal(trava(contexto, ['--commit', '--help']).status, 2);
  assert.equal(trava(contexto, ['--commit']).status, 2);
});

function repoComTresCommits() {
  const contexto = repoComTrava();
  const base = commitSemHook(contexto.repo, 'base');
  gravar(contexto.repo, 'docs/a.md', `cpf ${gerar.cpfValido()}\n`);
  adicionar(contexto.repo, 'docs/a.md');
  const primeiro = commitSemHook(contexto.repo, 'planta');
  assert.equal(git(['rm', '--quiet', '--', 'docs/a.md'], { cwd: contexto.repo }).status, 0);
  const segundo = commitSemHook(contexto.repo, 'apaga');
  gravar(contexto.repo, 'docs/b.md', 'limpo\n');
  adicionar(contexto.repo, 'docs/b.md');
  const terceiro = commitSemHook(contexto.repo, 'limpo');
  return { contexto, base, primeiro, segundo, terceiro };
}

test('--push falha quando um commit do meio planta o valor e o seguinte o apaga', () => {
  const { contexto, base, terceiro } = repoComTresCommits();
  assert.equal(trava(contexto, ['--push', base, terceiro]).status, 1);
});

test('--push com before zerado confere o histórico inteiro', () => {
  const { contexto, terceiro } = repoComTresCommits();
  assert.equal(trava(contexto, ['--push', ZEROS, terceiro]).status, 1);
});

test('--push limpo passa', () => {
  const { contexto, segundo, terceiro } = repoComTresCommits();
  assert.equal(trava(contexto, ['--push', segundo, terceiro]).status, 0);
});

test('--push com lista vazia e after real é erro; after zerado não confere nada', () => {
  const { contexto, terceiro } = repoComTresCommits();
  assert.equal(trava(contexto, ['--push', terceiro, terceiro]).status, 2);
  assert.equal(trava(contexto, ['--push', terceiro, ZEROS]).status, 0);
});

test('--push recusa argumentos que não são commits', () => {
  const { contexto, terceiro } = repoComTresCommits();
  assert.equal(trava(contexto, ['--push', '--all', terceiro]).status, 2);
  assert.equal(trava(contexto, ['--push', terceiro]).status, 2);
});

test('commitsDoPush lista do mais antigo ao mais novo', () => {
  const { contexto, base, primeiro, segundo, terceiro } = repoComTresCommits();
  assert.deepEqual(commitsDoPush(base, terceiro, contexto.repo), [primeiro, segundo, terceiro]);
  assert.equal(commitsDoPush(ZEROS, terceiro, contexto.repo).length, 4);
  assert.deepEqual(commitsDoPush(base, ZEROS, contexto.repo), []);
  assert.deepEqual(commitsDoPush(terceiro, terceiro, contexto.repo), []);
  assert.throws(() => commitsDoPush(base, 'f'.repeat(40), contexto.repo));
});

test('--arvore acha um valor numa árvore já versionada', () => {
  const contexto = repoComTrava();
  gravar(contexto.repo, 'docs/a.md', `cpf ${gerar.cpfValido()}\n`);
  adicionar(contexto.repo, 'docs/a.md');
  commitSemHook(contexto.repo);
  assert.equal(trava(contexto, ['--arvore']).status, 1);
});

test('--arvore passa numa árvore limpa e falha sem commit', () => {
  const contexto = repoComTrava();
  assert.equal(trava(contexto, ['--arvore']).status, 2);
  gravar(contexto.repo, 'docs/a.md', 'limpo\n');
  adicionar(contexto.repo, 'docs/a.md');
  commitSemHook(contexto.repo);
  assert.equal(trava(contexto, ['--arvore']).status, 0);
});

test('modo desconhecido é erro', () => {
  const contexto = repoComTrava();
  assert.equal(trava(contexto, ['--nada']).status, 2);
  assert.equal(trava(contexto, []).status, 2);
});

function mensagemComValor(nome, plantar) {
  test(`o hook commit-msg recusa ${nome} na mensagem sem mostrar o valor`, () => {
    const contexto = repoComTrava({ comHook: true });
    const valor = plantar();
    const { status, saida } = commitar(contexto, ['--allow-empty', '-m', `nota ${valor}`]);
    assert.notEqual(status, 0, saida);
    assert.equal(temCommit(contexto), false);
    assert.match(saida, /mensagem de commit: linha \d+: /);
    assert.ok(!saida.includes(valor), 'a saída repetiu o valor da mensagem');
  });
}

mensagemComValor('CPF', () => gerar.cpfValido());
mensagemComValor('UUID', () => gerar.uuid());
mensagemComValor('valor que só o gitleaks barra', () => `chave = ${gerar.chaveDatabricks()}`);

test('o hook commit-msg aceita mensagem limpa, também com linha de comentário', () => {
  const contexto = repoComTrava({ comHook: true });
  const { status, saida } = commitar(contexto, ['--allow-empty', '-m', '# titulo\n\ntexto limpo']);
  assert.equal(status, 0, saida);
});

test('--mensagem lê o arquivo e recusa arquivo ausente', () => {
  const contexto = repoComTrava();
  const arquivo = join(pastaTemporaria(), 'msg.txt');
  const cpf = gerar.cpfValido();
  writeFileSync(arquivo, `texto\n# cpf ${cpf}\n`);
  const { status, saida } = trava(contexto, ['--mensagem', arquivo]);
  assert.equal(status, 1, saida);
  assert.match(saida, /mensagem de commit: linha 2: cpf/);
  assert.ok(!saida.includes(cpf));
  assert.equal(trava(contexto, ['--mensagem', join(pastaTemporaria(), 'nao-existe.txt')]).status, 2);
});

test('--commit confere a mensagem de um commit feito com --no-verify', () => {
  const contexto = repoComTrava();
  const cpf = gerar.cpfValido();
  const { status, saida } = trava(contexto, ['--commit', commitSemHook(contexto.repo, `nota ${cpf}`)]);
  assert.equal(status, 1, saida);
  assert.match(saida, /mensagem de commit [0-9a-f]{7}: linha 1: cpf/);
  assert.ok(!saida.includes(cpf));
});

test('--push recusa o intervalo em que só a mensagem de um commit tem o valor', () => {
  const contexto = repoComTrava();
  const base = commitSemHook(contexto.repo, 'base');
  commitSemHook(contexto.repo, 'limpo');
  const cpf = gerar.cpfValido();
  commitSemHook(contexto.repo, `nota ${cpf}`);
  const ultimo = commitSemHook(contexto.repo, 'limpo de novo');
  const { status, saida } = trava(contexto, ['--push', base, ultimo]);
  assert.equal(status, 1, saida);
  assert.ok(!saida.includes(cpf));
});

test('nome de arquivo com valor que só o gitleaks barra é escondido', () => {
  const contexto = repoComTrava();
  const chave = gerar.chaveDeAcesso();
  gravar(contexto.repo, `docs/${chave}.md`, 'limpo\n');
  adicionar(contexto.repo, `docs/${chave}.md`);
  const { status, saida } = trava(contexto, ['--staged']);
  assert.equal(status, 1, saida);
  assert.ok(!saida.includes(chave));
  assert.match(saida, /\(arquivo de nome barrado\): nome-com-gitleaks/);
});

test('gitlink de nome barrado dá 2 e não repete o nome na saída', () => {
  const contexto = repoComTrava();
  const cpf = gerar.cpfValido();
  const registro = git(['update-index', '--add', '--cacheinfo', `160000,${'a'.repeat(40)},docs/${cpf}`], { cwd: contexto.repo });
  assert.equal(registro.status, 0, registro.stderr);
  const { status, saida } = trava(contexto, ['--staged']);
  assert.equal(status, 2, saida);
  assert.ok(!saida.includes(cpf), 'a saída repetiu o nome barrado');
});

function commitComCodificacao(repo, codificacao, mensagem) {
  const resultado = git(
    ['-c', `i18n.commitEncoding=${codificacao}`, 'commit', '--quiet', '--no-verify', '--allow-empty', '-m', mensagem],
    { cwd: repo },
  );
  assert.equal(resultado.status, 0, resultado.stderr);
  return git(['rev-parse', 'HEAD'], { cwd: repo }).stdout.toString('utf8').trim();
}

test('mensagem com codificação declarada que não é UTF-8 é recusada no --commit e no --push, sem o valor', () => {
  const contexto = repoComTrava();
  const base = commitSemHook(contexto.repo, 'base');
  const cpf = gerar.cpfValido();
  const estranho = commitComCodificacao(contexto.repo, 'CP037', `nota cpf ${cpf}`);
  for (const args of [['--commit', estranho], ['--push', base, estranho]]) {
    const { status, saida } = trava(contexto, args);
    assert.equal(status, 1, saida);
    assert.match(saida, /mensagem de commit [0-9a-f]{7}: encoding-invalido/);
    assert.ok(!saida.includes(cpf));
  }
});

test('mensagem em UTF-8 declarado de outras grafias e limpa passa', () => {
  const contexto = repoComTrava();
  const base = commitSemHook(contexto.repo, 'base');
  const limpo = commitComCodificacao(contexto.repo, 'UTF8', 'ação concluída');
  assert.equal(trava(contexto, ['--commit', limpo]).status, 0);
  assert.equal(trava(contexto, ['--push', base, limpo]).status, 0);
});

test('mensagem de commit que não é UTF-8 válido é encoding-invalido', () => {
  const contexto = repoComTrava();
  const base = commitSemHook(contexto.repo, 'base');
  const arvore = git(['rev-parse', 'HEAD^{tree}'], { cwd: contexto.repo }).stdout.toString('utf8').trim();
  const bruto = Buffer.concat([
    Buffer.from(`tree ${arvore}\nparent ${base}\nauthor t <noreply@example.invalid> 1 +0000\ncommitter t <noreply@example.invalid> 1 +0000\n\n`),
    Buffer.from('a\xe7\xe3o\n', 'latin1'),
  ]);
  const criado = git(['hash-object', '-t', 'commit', '-w', '--stdin'], { cwd: contexto.repo, input: bruto });
  assert.equal(criado.status, 0, criado.stderr);
  const sha = criado.stdout.toString('utf8').trim();
  const { status, saida } = trava(contexto, ['--commit', sha]);
  assert.equal(status, 1, saida);
  assert.match(saida, /encoding-invalido/);
});

test('com dois nomes, só o segundo barrado, o achado volta ao caminho certo e o caminho não aparece', () => {
  const contexto = repoComTrava();
  const chave = gerar.chaveDeAcesso();
  const limpo = 'docs/limpo.md';
  const barrado = `docs/${chave}.md`;
  gravar(contexto.repo, limpo, 'limpo\n');
  gravar(contexto.repo, barrado, 'limpo\n');
  adicionar(contexto.repo, limpo, barrado);
  const caminhos = arquivosMudados(null, contexto.repo);
  assert.deepEqual([...caminhos].sort(), [limpo, barrado].sort());
  const doGitleaks = conferirCaminhos({ ref: null, caminhos, cwd: contexto.repo })
    .filter((achado) => achado.padrao === 'nome-com-gitleaks');
  assert.deepEqual(doGitleaks.map((achado) => achado.caminho), [barrado]);
  const { status, saida } = trava(contexto, ['--staged']);
  assert.equal(status, 1, saida);
  assert.ok(!saida.includes(chave));
  assert.equal((saida.match(/nome-com-gitleaks/g) ?? []).length, 1);
});

// --- só o --staged move arquivo ---

test('o esboço passa pelo validador: valor que só o gitleaks barra num campo do cabeçalho é retido', () => {
  const contexto = repoComTrava({ comHook: true });
  const chave = gerar.chaveDatabricks();
  const original = [...cabecalhoDeEntrada({ modelo: chave }), 'texto limpo', ''].join('\n');
  gravar(contexto.repo, ENTRADA, original);
  adicionar(contexto.repo, ENTRADA);
  const recusado = commitar(contexto, []);
  assert.notEqual(recusado.status, 0, recusado.saida);
  const noLugar = readFileSync(join(contexto.repo, ENTRADA), 'utf8');
  assert.ok(!noLugar.includes(chave), 'o esboço levou o valor');
  assert.ok(!recusado.saida.includes(chave));
  assert.match(noLugar, /desfecho: retido/);
  const retidos = arquivosRetidos(contexto.retidas);
  assert.equal(retidos.length, 1);
  assert.equal(readFileSync(retidos[0], 'utf8'), original);
  adicionar(contexto.repo, ENTRADA);
  const aceito = commitar(contexto, ['--', ENTRADA]);
  assert.equal(aceito.status, 0, aceito.saida);
});

function recusaSemMoverArquivo(nome, preparar, args) {
  test(`${nome} recusa o valor sem mover o arquivo de trabalho`, () => {
    const contexto = repoComTrava();
    const original = entradaComCpf();
    gravar(contexto.repo, ENTRADA, original);
    adicionar(contexto.repo, ENTRADA);
    const resultado = git(['commit', '--quiet', '--no-verify', '-m', 'c'], { cwd: contexto.repo });
    assert.equal(resultado.status, 0, resultado.stderr);
    const sha = git(['rev-parse', 'HEAD'], { cwd: contexto.repo }).stdout.toString('utf8').trim();
    const { status, saida } = trava(contexto, args(sha, preparar(contexto)));
    assert.equal(status, 1, saida);
    assert.equal(readFileSync(join(contexto.repo, ENTRADA), 'utf8'), original);
    assert.deepEqual(arquivosRetidos(contexto.retidas), []);
  });
}

recusaSemMoverArquivo('--commit', () => undefined, (sha) => ['--commit', sha]);
recusaSemMoverArquivo('--push', () => undefined, (sha) => ['--push', ZEROS, sha]);
recusaSemMoverArquivo('--arvore', () => undefined, () => ['--arvore']);
recusaSemMoverArquivo(
  '--mensagem',
  () => {
    const arquivo = join(pastaTemporaria(), 'msg.txt');
    writeFileSync(arquivo, `nota ${gerar.cpfValido()}\n`);
    return arquivo;
  },
  (_sha, arquivo) => ['--mensagem', arquivo],
);

// --- autor e committer ---

function identidade(email) {
  return { GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_EMAIL: email };
}

function commitSemHookComo(repo, env) {
  const resultado = git(['commit', '--quiet', '--no-verify', '--allow-empty', '-m', 'c'], { cwd: repo, env });
  assert.equal(resultado.status, 0, resultado.stderr);
  return git(['rev-parse', 'HEAD'], { cwd: repo }).stdout.toString('utf8').trim();
}

test('o hook commit-msg vê o autor de fora dado com --author e não mostra o e-mail', () => {
  const contexto = repoComTrava({ comHook: true });
  const email = gerar.emailDeFora();
  const { status, saida } = commitar(contexto, ['--allow-empty', '--author', `Alguém <${email}>`]);
  assert.notEqual(status, 0, saida);
  assert.equal(temCommit(contexto), false);
  assert.match(saida, /autor do commit: email/);
  assert.ok(!saida.includes(email), 'a saída repetiu o e-mail');
});

test('o hook commit-msg vê o committer de fora e não mostra o e-mail', () => {
  const contexto = repoComTrava({ comHook: true });
  const email = gerar.emailDeFora();
  const { status, saida } = commitar(contexto, ['--allow-empty'], { GIT_COMMITTER_EMAIL: email });
  assert.notEqual(status, 0, saida);
  assert.equal(temCommit(contexto), false);
  assert.match(saida, /committer do commit: email/);
  assert.ok(!saida.includes(email));
});

test('--commit recusa o autor de fora de um commit feito com --no-verify', () => {
  const contexto = repoComTrava();
  const email = gerar.emailDeFora();
  const sha = commitSemHookComo(contexto.repo, { GIT_AUTHOR_EMAIL: email });
  const { status, saida } = trava(contexto, ['--commit', sha]);
  assert.equal(status, 1, saida);
  assert.match(saida, /autor do commit: email/);
  assert.ok(!saida.includes(email));
});

test('--commit recusa o committer de fora', () => {
  const contexto = repoComTrava();
  const email = gerar.emailDeFora();
  const sha = commitSemHookComo(contexto.repo, { GIT_COMMITTER_EMAIL: email });
  const { status, saida } = trava(contexto, ['--commit', sha]);
  assert.equal(status, 1, saida);
  assert.match(saida, /committer do commit: email/);
  assert.ok(!saida.includes(email));
});

test('--commit recusa CPF no nome do autor, sem mostrá-lo', () => {
  const contexto = repoComTrava();
  const cpf = gerar.cpfValido();
  const sha = commitSemHookComo(contexto.repo, { GIT_AUTHOR_NAME: `Fulano ${cpf}` });
  const { status, saida } = trava(contexto, ['--commit', sha]);
  assert.equal(status, 1, saida);
  assert.match(saida, /autor do commit: cpf/);
  assert.ok(!saida.includes(cpf));
});

test('--push recusa o intervalo em que só o autor de um commit do meio é de fora', () => {
  const contexto = repoComTrava();
  const base = commitSemHook(contexto.repo, 'base');
  commitSemHook(contexto.repo, 'limpo');
  const email = gerar.emailDeFora();
  commitSemHookComo(contexto.repo, { GIT_AUTHOR_EMAIL: email });
  const ultimo = commitSemHook(contexto.repo, 'limpo de novo');
  const { status, saida } = trava(contexto, ['--push', base, ultimo]);
  assert.equal(status, 1, saida);
  assert.match(saida, /autor do commit: email/);
  assert.ok(!saida.includes(email));
});

test('o e-mail do PO, o noreply e o noreply do GitHub passam como autor e committer', () => {
  const contexto = repoComTrava();
  const base = commitSemHook(contexto.repo, 'base');
  commitSemHookComo(contexto.repo, identidade('carrasco.cortes@gmail.com'));
  commitSemHookComo(contexto.repo, identidade('noreply@anthropic.com'));
  const ultimo = commitSemHookComo(contexto.repo, identidade('12345+alguem@users.noreply.github.com'));
  assert.equal(trava(contexto, ['--commit', ultimo]).status, 0);
  assert.equal(trava(contexto, ['--push', base, ultimo]).status, 0);
});

// --- índice inteiro ---

const LICAO = 'memoria/licoes/algo.md';
const INDICE = 'memoria/INDICE.md';

function repoComLicaoIndexada() {
  const contexto = repoComTrava();
  gravar(contexto.repo, INDICE, '# Índice\n- [algo](licoes/algo.md)\n');
  gravar(contexto.repo, LICAO, '# algo\n');
  adicionar(contexto.repo, INDICE, LICAO);
  const base = commitSemHook(contexto.repo, 'com lição e índice');
  return { contexto, base };
}

test('--staged recusa o índice que perdeu a linha de uma lição existente', () => {
  const { contexto } = repoComLicaoIndexada();
  gravar(contexto.repo, INDICE, '# Índice\n');
  adicionar(contexto.repo, INDICE);
  const { status, saida } = trava(contexto, ['--staged']);
  assert.equal(status, 1, saida);
  assert.match(saida, /memoria\/licoes\/algo\.md: licao-sem-indice/);
});

test('--commit e --push recusam o commit que tira a linha de uma lição existente', () => {
  const { contexto, base } = repoComLicaoIndexada();
  gravar(contexto.repo, INDICE, '# Índice\n');
  adicionar(contexto.repo, INDICE);
  assert.equal(git(['commit', '--quiet', '--no-verify', '-m', 'tira a linha'], { cwd: contexto.repo }).status, 0);
  const sha = git(['rev-parse', 'HEAD'], { cwd: contexto.repo }).stdout.toString('utf8').trim();
  const doCommit = trava(contexto, ['--commit', sha]);
  assert.equal(doCommit.status, 1, doCommit.saida);
  assert.match(doCommit.saida, /licao-sem-indice/);
  assert.equal(trava(contexto, ['--push', base, sha]).status, 1);
});

test('--staged recusa apagar o índice quando há lição', () => {
  const { contexto } = repoComLicaoIndexada();
  assert.equal(git(['rm', '--quiet', '--', INDICE], { cwd: contexto.repo }).status, 0);
  assert.equal(trava(contexto, ['--staged']).status, 1);
});

test('mexer em outro arquivo não confere o índice inteiro', () => {
  const { contexto } = repoComLicaoIndexada();
  gravar(contexto.repo, 'memoria/licoes/outra.md', '# outra\n');
  adicionar(contexto.repo, 'memoria/licoes/outra.md');
  const { saida } = trava(contexto, ['--staged']);
  assert.match(saida, /outra\.md: licao-sem-indice/);
  assert.ok(!saida.includes('algo.md'));
});
