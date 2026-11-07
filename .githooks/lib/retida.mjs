import { execFileSync } from 'node:child_process';
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { contemUuid, lerCabecalho } from './cabecalho.mjs';
import { detectar } from './padroes.mjs';

const CAMINHO_DE_ENTRADA = /^frentes\/[^/]+\/memoria\/[^/]+\.md$/;
const CAMINHO_DE_PASSAGEM = /^frentes\/[^/]+\/passagem\.md$/;
const UUID_INTEIRO = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const CAMPOS_COPIADOS = {
  entrada: ['data', 'autor', 'ferramenta', 'modelo', 'sessao'],
  passagem: ['atualizada', 'por', 'sessao', 'sessao_aberta'],
};

export function ehRetivel(caminho) {
  return CAMINHO_DE_ENTRADA.test(caminho) || CAMINHO_DE_PASSAGEM.test(caminho);
}

export function raizRetidasPadrao() {
  if (process.env.VALLUS_RETIDAS) return process.env.VALLUS_RETIDAS;
  const dadosLocais = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local');
  return join(dadosLocais, 'vallus-office', 'retidas');
}

function falhaDeRetencao(mensagem, causa) {
  return Object.assign(new Error(mensagem, { cause: causa }), { code: 'RETENCAO_FALHOU' });
}

function dataLocal(agora) {
  const dois = (numero) => String(numero).padStart(2, '0');
  return `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`;
}

function horaLocalSemDoisPontos(agora) {
  const dois = (numero) => String(numero).padStart(2, '0');
  return `${dataLocal(agora)}T${dois(agora.getHours())}-${dois(agora.getMinutes())}-${dois(agora.getSeconds())}`;
}

// O esboço é lido pela sessão seguinte: só entra campo que a própria trava não barraria.
function valorCopiavel(campo, valor) {
  if (valor === '') return false;
  if (campo === 'sessao' && UUID_INTEIRO.test(valor)) return true;
  return detectar(valor).length === 0 && !contemUuid(valor);
}

export function esboco(caminho, original, padroes, agora) {
  const tipo = CAMINHO_DE_PASSAGEM.test(caminho) ? 'passagem' : 'entrada';
  const campos = lerCabecalho(original)?.campos ?? new Map();
  const linhas = ['---'];
  for (const campo of CAMPOS_COPIADOS[tipo]) {
    const valor = campos.get(campo);
    if (valor !== undefined && valorCopiavel(campo, valor)) linhas.push(`${campo}: ${valor}`);
  }
  if (tipo === 'entrada') {
    linhas.push('desfecho: retido', `motivo: trava: ${padroes.join(', ')}`);
  }
  linhas.push('---', `Texto retido pela trava em ${dataLocal(agora)}. Está fora do repositório até o PO liberar.`, '');
  return linhas.join('\n');
}

export function garantirRaiz(raiz, { padrao }) {
  const jaExistia = existsSync(raiz);
  try {
    mkdirSync(raiz, { recursive: true });
    if (padrao && !jaExistia) {
      const usuario = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
      execFileSync('icacls', [raiz, '/inheritance:r', '/grant:r', `${usuario}:(OI)(CI)F`], { stdio: 'pipe' });
    }
  } catch (erro) {
    throw falhaDeRetencao('não foi possível preparar a pasta das retidas', erro);
  }
}

function destinoLivre(raiz, slug, nome, agora) {
  const base = join(raiz, slug, `${horaLocalSemDoisPontos(agora)}-${nome}`);
  let candidato = base;
  for (let sufixo = 2; existsSync(candidato); sufixo += 1) candidato = `${base}-${sufixo}`;
  return candidato;
}

export function reter({ raizClone, caminho, raizRetidas, padroes, agora }) {
  const origem = join(raizClone, caminho);
  const temporario = `${origem}.retida.tmp`;
  try {
    const original = readFileSync(origem, 'utf8');
    const emPadrao = raizRetidas === raizRetidasPadrao() && !process.env.VALLUS_RETIDAS;
    garantirRaiz(raizRetidas, { padrao: emPadrao });
    const slug = caminho.split('/')[1];
    const destino = destinoLivre(raizRetidas, slug, basename(caminho), agora);
    mkdirSync(dirname(destino), { recursive: true });
    copyFileSync(origem, destino, constants.COPYFILE_EXCL);
    if (statSync(destino).size !== statSync(origem).size) {
      rmSync(destino, { force: true });
      throw new Error('a cópia retida tem tamanho diferente do original');
    }
    writeFileSync(temporario, esboco(caminho, original, padroes, agora));
    renameSync(temporario, origem);
    return { destino };
  } catch (erro) {
    rmSync(temporario, { force: true });
    if (erro.code === 'RETENCAO_FALHOU') throw erro;
    throw falhaDeRetencao('não foi possível reter o arquivo', erro);
  }
}
