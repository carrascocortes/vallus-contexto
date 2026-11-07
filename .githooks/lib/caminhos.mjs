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

/** Caminho cuja mudança o PO precisa ver: por isso o CI avisa quando um commit o toca. */
export function caminhoVigiado(caminho) {
  return VIGIADOS.some((padrao) => padrao.test(caminho));
}
