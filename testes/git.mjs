import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pastaConfigVazia = mkdtempSync(join(tmpdir(), 'git-config-'));
const configVazia = join(pastaConfigVazia, 'config');
writeFileSync(configVazia, '');

const identidade = {
  GIT_AUTHOR_NAME: 'teste',
  GIT_AUTHOR_EMAIL: 'noreply@example.invalid',
  GIT_COMMITTER_NAME: 'teste',
  GIT_COMMITTER_EMAIL: 'noreply@example.invalid',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: configVazia,
  XDG_CONFIG_HOME: pastaConfigVazia,
};

const variaveisDeHook = /^(GIT_DIR|GIT_WORK_TREE|GIT_INDEX_FILE|GIT_CONFIG_PARAMETERS|GIT_CONFIG_COUNT|GIT_CONFIG_KEY_\d+|GIT_CONFIG_VALUE_\d+)$/;

function ambienteBase() {
  return Object.fromEntries(Object.entries(process.env).filter(([nome]) => !variaveisDeHook.test(nome)));
}

export function git(args, { cwd, env, input } = {}) {
  const resultado = spawnSync('git', args, {
    cwd,
    input,
    env: { ...ambienteBase(), ...identidade, ...env },
  });
  if (resultado.error) throw resultado.error;
  if (resultado.status === null) {
    throw new Error(`o git ${args.join(' ')} terminou por sinal ${resultado.signal}`);
  }
  return {
    status: resultado.status,
    stdout: resultado.stdout,
    stderr: resultado.stderr.toString('utf8'),
  };
}

export function repoTemporario() {
  const pasta = mkdtempSync(join(tmpdir(), 'repo-'));
  const resultado = git(['init', '--quiet', '--initial-branch=main'], { cwd: pasta });
  if (resultado.status !== 0) throw new Error(`git init falhou: ${resultado.stderr}`);
  return pasta;
}
