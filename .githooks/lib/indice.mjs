const PASTAS_INDEXADAS = ['memoria/licoes/', 'memoria/referencias/'];
const COMENTARIO_HTML = /<!--[\s\S]*?-->/g;
const LINK = /\]\(\s*([^)\s#]+)(?:#[^)\s]*)?(?:\s+"[^"]*")?\s*\)/g;

function destinosDoIndice(indice) {
  const destinos = new Set();
  for (const [, destino] of indice.replace(COMENTARIO_HTML, '').matchAll(LINK)) {
    destinos.add(destino.replace(/^\.\//, ''));
  }
  return destinos;
}

export function semIndice(caminhos, indice) {
  const destinos = destinosDoIndice(indice);
  return caminhos.filter((caminho) => {
    const indexado = PASTAS_INDEXADAS.some((prefixo) => caminho.startsWith(prefixo));
    if (!indexado || caminho.endsWith('/.gitkeep')) return false;
    return !destinos.has(caminho.slice('memoria/'.length));
  });
}
