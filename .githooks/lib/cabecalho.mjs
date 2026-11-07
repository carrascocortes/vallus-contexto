const BOM = String.fromCharCode(0xfeff);
const DELIMITADOR = /^---[ \t]*$/;
const UUID = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
const LINHA_DE_SESSAO_VALIDA = new RegExp(`^sessao: ${UUID.source}$`);
const LINHA_QUE_PARECE_SESSAO = /^[#\s]*sessao\s*:/i;
const CAMPO = /^([^\s:#][^\s:]*):(.*)$/;
const COMENTARIO_DE_FIM_DE_LINHA = /\s+#.*$/;

const UUID_EXATO = new RegExp(`^${UUID.source}$`);

export function contemUuid(texto) {
  return UUID.test(texto);
}

export function ehUuidExato(valor) {
  return UUID_EXATO.test(valor);
}

function linhasDe(texto) {
  return (texto.startsWith(BOM) ? texto.slice(1) : texto).split(/\r?\n/);
}

// Números de linha começam em 1; `fim` é a linha do `---` que fecha o cabeçalho.
function limitesDoCabecalho(linhas) {
  if (!DELIMITADOR.test(linhas[0])) return null;
  const indiceDoFechamento = linhas.findIndex((linha, indice) => indice > 0 && DELIMITADOR.test(linha));
  return indiceDoFechamento === -1 ? null : { fim: indiceDoFechamento + 1 };
}

function valorDoCampo(resto) {
  const valor = resto.trim();
  return valor.startsWith('#') ? '' : valor.replace(COMENTARIO_DE_FIM_DE_LINHA, '');
}

export function lerCabecalho(texto) {
  const linhas = linhasDe(texto);
  const limites = limitesDoCabecalho(linhas);
  if (!limites) return null;
  const campos = new Map();
  for (const linha of linhas.slice(1, limites.fim - 1)) {
    const campo = CAMPO.exec(linha);
    if (!campo || campos.has(campo[1])) continue;
    campos.set(campo[1], valorDoCampo(campo[2]));
  }
  return { campos, fimDaLinha: limites.fim };
}

export function verificarUuid(texto) {
  const linhas = linhasDe(texto);
  const limites = limitesDoCabecalho(linhas);
  const achados = [];
  let sessaoJaDeclarada = false;
  linhas.forEach((conteudo, indice) => {
    const linha = indice + 1;
    const dentroDoCabecalho = limites !== null && linha > 1 && linha < limites.fim;
    const temUuid = contemUuid(conteudo);
    if (!dentroDoCabecalho) {
      if (temUuid) achados.push({ padrao: 'uuid-fora-do-cabecalho', linha });
      return;
    }
    if (conteudo.startsWith('sessao:')) {
      const invalida = sessaoJaDeclarada || (temUuid && !LINHA_DE_SESSAO_VALIDA.test(conteudo));
      sessaoJaDeclarada = true;
      if (invalida) achados.push({ padrao: 'sessao-invalida', linha });
    } else if (temUuid) {
      achados.push({ padrao: LINHA_QUE_PARECE_SESSAO.test(conteudo) ? 'sessao-invalida' : 'uuid-fora-do-cabecalho', linha });
    }
  });
  return achados;
}
