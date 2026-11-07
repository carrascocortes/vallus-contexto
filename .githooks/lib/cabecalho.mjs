const BOM = '﻿';
const DELIMITADOR = '---';
const UUID = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
const LINHA_DE_SESSAO_VALIDA = new RegExp(`^sessao: ${UUID.source}$`);
const CAMPO = /^([^\s:#][^\s:]*):[ \t]*(.*)$/;
const COMENTARIO_DE_FIM_DE_LINHA = /\s+#.*$/;

function linhasDe(texto) {
  return (texto.startsWith(BOM) ? texto.slice(1) : texto).split(/\r?\n/);
}

// Números de linha começam em 1; `fim` é a linha do `---` que fecha o cabeçalho.
function limitesDoCabecalho(linhas) {
  if (linhas[0] !== DELIMITADOR) return null;
  const indiceDoFechamento = linhas.indexOf(DELIMITADOR, 1);
  return indiceDoFechamento === -1 ? null : { fim: indiceDoFechamento + 1 };
}

export function lerCabecalho(texto) {
  const linhas = linhasDe(texto);
  const limites = limitesDoCabecalho(linhas);
  if (!limites) return null;
  const campos = new Map();
  for (const linha of linhas.slice(1, limites.fim - 1)) {
    const campo = CAMPO.exec(linha);
    if (!campo || campos.has(campo[1])) continue;
    campos.set(campo[1], campo[2].replace(COMENTARIO_DE_FIM_DE_LINHA, '').trim());
  }
  return { campos, fimDaLinha: limites.fim };
}

export function verificarUuid(texto) {
  const linhas = linhasDe(texto);
  const limites = limitesDoCabecalho(linhas);
  const achados = [];
  let sessaoJaDeclarada = false;
  linhas.forEach((conteudo, indice) => {
    if (!UUID.test(conteudo)) return;
    const linha = indice + 1;
    const dentroDoCabecalho = limites !== null && linha > 1 && linha < limites.fim;
    if (!dentroDoCabecalho || !conteudo.startsWith('sessao:')) {
      achados.push({ padrao: 'uuid-fora-do-cabecalho', linha });
      return;
    }
    if (sessaoJaDeclarada || !LINHA_DE_SESSAO_VALIDA.test(conteudo)) {
      achados.push({ padrao: 'sessao-invalida', linha });
    }
    sessaoJaDeclarada = true;
  });
  return achados;
}
