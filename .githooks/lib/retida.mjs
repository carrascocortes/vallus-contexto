import { execFileSync } from 'node:child_process';
import {
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { contemUuid, ehUuidExato, lerCabecalho } from './cabecalho.mjs';
import { detectar } from './padroes.mjs';

const SEGMENTO = '[A-Za-z0-9._-]+';
const CAMINHO_DE_ENTRADA = new RegExp(`^frentes/(${SEGMENTO})/memoria/${SEGMENTO}\\.md$`);
const CAMINHO_DE_PASSAGEM = new RegExp(`^frentes/(${SEGMENTO})/passagem\\.md$`);

const DATA_E_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?$/;
const IDENTIFICACAO = /^[\p{L}\d ·.()-]{1,80}$/u;
const SEQUENCIA_LONGA_SEM_ESPACO = /[\p{L}\d]{20,}/u;

// O esboço volta a passar pela trava, que também roda o gitleaks: só entra o que tem formato de metadado.
const FORMATO_DO_CAMPO = {
  data: (valor) => DATA_E_HORA.test(valor),
  atualizada: (valor) => DATA_E_HORA.test(valor),
  ferramenta: (valor) => valor === 'claude-code' || valor === 'codex',
  modelo: (valor) => /^[a-z][a-z0-9.-]{1,39}$/.test(valor),
  sessao: ehUuidExato,
  sessao_aberta: (valor) => valor === 'sim' || valor === 'não',
  autor: (valor) => IDENTIFICACAO.test(valor) && !SEQUENCIA_LONGA_SEM_ESPACO.test(valor),
  por: (valor) => IDENTIFICACAO.test(valor) && !SEQUENCIA_LONGA_SEM_ESPACO.test(valor),
};

const CAMPOS_COPIADOS = {
  entrada: ['data', 'autor', 'ferramenta', 'modelo', 'sessao'],
  passagem: ['atualizada', 'por', 'sessao', 'sessao_aberta'],
};

function dois(numero) {
  return String(numero).padStart(2, '0');
}

function dataLocal(agora) {
  return `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`;
}

function horaLocalSemDoisPontos(agora) {
  return `${dataLocal(agora)}T${dois(agora.getHours())}-${dois(agora.getMinutes())}-${dois(agora.getSeconds())}`;
}

function falhaDeRetencao(mensagem, causa) {
  return Object.assign(new Error(mensagem, { cause: causa }), { code: 'RETENCAO_FALHOU' });
}

function tentarRemover(caminho, opcoes) {
  try {
    rmSync(caminho, { force: true, ...opcoes });
  } catch {
    // o erro que importa é o que levou à remoção
  }
}

export function ehRetivel(caminho) {
  const correspondencia = CAMINHO_DE_ENTRADA.exec(caminho) ?? CAMINHO_DE_PASSAGEM.exec(caminho);
  return correspondencia !== null && correspondencia[1] !== '.' && correspondencia[1] !== '..';
}

export function raizRetidasPadrao() {
  if (process.env.VALLUS_RETIDAS) return process.env.VALLUS_RETIDAS;
  const dadosLocais = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local');
  return join(dadosLocais, 'vallus-office', 'retidas');
}

function valorCopiavel(campo, valor) {
  if (valor === '' || !FORMATO_DO_CAMPO[campo](valor)) return false;
  return campo === 'sessao' || (detectar(valor).length === 0 && !contemUuid(valor));
}

function tipoDe(caminho) {
  return CAMINHO_DE_PASSAGEM.test(caminho) ? 'passagem' : 'entrada';
}

function montarEsboco(tipo, camposCopiados, padroes, agora) {
  const linhas = ['---', ...camposCopiados];
  if (tipo === 'entrada') {
    linhas.push('desfecho: retido', `motivo: trava: ${[...new Set(padroes)].join(', ')}`);
  }
  linhas.push('---', `Texto retido pela trava em ${dataLocal(agora)}. Está fora do repositório até o PO liberar.`, '');
  return linhas.join('\n');
}

export function esboco(caminho, original, padroes, agora) {
  const tipo = tipoDe(caminho);
  const campos = lerCabecalho(original)?.campos ?? new Map();
  const copiados = CAMPOS_COPIADOS[tipo]
    .filter((campo) => campos.has(campo) && valorCopiavel(campo, campos.get(campo)))
    .map((campo) => `${campo}: ${campos.get(campo)}`);
  return montarEsboco(tipo, copiados, padroes, agora);
}

// Para quando nem o esboço com campos copiados passa na validação: não leva nada do original.
export function esbocoMinimo(caminho, padroes, agora) {
  return montarEsboco(tipoDe(caminho), [], padroes, agora);
}

function restringirAoUsuario(pasta) {
  const { USERDOMAIN, USERNAME } = process.env;
  if (!USERDOMAIN || !USERNAME) throw new Error('USERDOMAIN e USERNAME são necessários para a ACL');
  execFileSync('icacls', [pasta, '/inheritance:r', '/grant:r', `${USERDOMAIN}\\${USERNAME}:(OI)(CI)F`], { stdio: 'pipe' });
}

// A raiz só aparece com o nome final já restrita: falha ou processo morto no meio não deixa pasta aberta.
function criarRaizRestrita(raiz) {
  mkdirSync(dirname(raiz), { recursive: true });
  const temporaria = mkdtempSync(join(dirname(raiz), '.retidas-'));
  try {
    restringirAoUsuario(temporaria);
    renameSync(temporaria, raiz);
  } catch (erro) {
    tentarRemover(temporaria, { recursive: true });
    // Outro processo pode ter criado a raiz primeiro; só se confere que ela existe e é pasta.
    if (!(existsSync(raiz) && statSync(raiz).isDirectory())) throw erro;
  }
}

export function garantirRaiz(raiz, { padrao }) {
  try {
    if (existsSync(raiz)) {
      if (!statSync(raiz).isDirectory()) throw new Error('a raiz das retidas existe e não é pasta');
    } else if (padrao) {
      criarRaizRestrita(raiz);
    } else {
      mkdirSync(raiz, { recursive: true });
    }
  } catch (erro) {
    throw falhaDeRetencao('não foi possível preparar a pasta das retidas', erro);
  }
}

function destinoLivre(raiz, slug, caminho, agora) {
  const extensao = extname(caminho);
  const base = join(raiz, slug, `${horaLocalSemDoisPontos(agora)}-${basename(caminho, extensao)}`);
  let candidato = `${base}${extensao}`;
  for (let sufixo = 2; existsSync(candidato); sufixo += 1) candidato = `${base}-${sufixo}${extensao}`;
  return candidato;
}

function estaDentro(pasta, caminho) {
  const relativo = relative(resolve(pasta), resolve(caminho));
  const saiDaPasta = relativo === '..' || relativo.startsWith(`..${sep}`) || isAbsolute(relativo);
  return relativo !== '' && !saiDaPasta;
}

export function reter({ raizClone, caminho, raizRetidas, padroes, agora, validarEsboco }) {
  const origem = join(raizClone, caminho);
  const temporario = `${origem}.retida.tmp`;
  try {
    if (typeof validarEsboco !== 'function') throw new Error('a validação do esboço é obrigatória');
    if (!ehRetivel(caminho)) throw new Error('o caminho não é de entrada nem de passagem');
    if (resolve(raizRetidas) === resolve(raizClone) || estaDentro(raizClone, raizRetidas)) {
      throw new Error('a pasta das retidas está dentro do clone');
    }
    const original = readFileSync(origem, 'utf8');
    const emPadrao = raizRetidas === raizRetidasPadrao() && !process.env.VALLUS_RETIDAS;
    garantirRaiz(raizRetidas, { padrao: emPadrao });
    const destino = destinoLivre(raizRetidas, caminho.split('/')[1], caminho, agora);
    if (!estaDentro(raizRetidas, destino)) throw new Error('o destino sai da pasta das retidas');
    mkdirSync(dirname(destino), { recursive: true });
    copyFileSync(origem, destino, constants.COPYFILE_EXCL);
    if (statSync(destino).size !== statSync(origem).size) {
      tentarRemover(destino);
      throw new Error('a cópia retida tem tamanho diferente do original');
    }
    const completo = esboco(caminho, original, padroes, agora);
    writeFileSync(temporario, validarEsboco(completo) === true ? completo : esbocoMinimo(caminho, padroes, agora));
    renameSync(temporario, origem);
    return { destino };
  } catch (erro) {
    tentarRemover(temporario);
    if (erro.code === 'RETENCAO_FALHOU') throw erro;
    throw falhaDeRetencao('não foi possível reter o arquivo', erro);
  }
}
