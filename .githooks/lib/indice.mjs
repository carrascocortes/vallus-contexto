const PASTAS_INDEXADAS = ['memoria/licoes/', 'memoria/referencias/'];

export function semIndice(caminhos, indice) {
  return caminhos.filter((caminho) => {
    const pasta = PASTAS_INDEXADAS.find((prefixo) => caminho.startsWith(prefixo));
    if (!pasta || caminho.endsWith('/.gitkeep')) return false;
    const link = `(${caminho.slice('memoria/'.length)})`;
    return !indice.includes(link);
  });
}
