const VIGIADOS = [
  /^LEIA-ME\.md$/,
  /^\.gitattributes$/,
  /^\.githooks\//,
  /^\.github\//,
  /^ferramentas\//,
  /^frentes\/[^/]+\/decisoes\.md$/,
  /^decisoes\//,
  /^memoria\/INDICE\.md$/,
  /^memoria\/licoes\//,
  /^memoria\/referencias\//,
];

/** Caminho que só o PO muda de propósito: a sessão escreve passagem e entradas, nunca estes. */
export function caminhoVigiado(caminho) {
  return VIGIADOS.some((padrao) => padrao.test(caminho));
}
