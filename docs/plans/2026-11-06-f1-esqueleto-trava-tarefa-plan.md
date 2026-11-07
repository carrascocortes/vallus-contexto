# F1 do repositório de contexto: esqueleto, trava, CI e tarefa — plano de implementação

> **Para quem executa:** use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans,
> tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** deixar o `vallus-contexto` pronto para receber conteúdo: a estrutura e os modelos, a trava de pre-commit,
o CI com a segunda rede e o aviso, e a tarefa agendada que empurra o main de hora em hora.

**Arquitetura:** a trava e a tarefa são scripts Node sem dependência externa. A trava mora em `.githooks/` e é a
mesma no pre-commit e no CI: o pre-commit a roda sobre o que vai ser commitado, e o CI a roda sobre cada commit do push.
A tarefa mora fora do clone, no perfil do PO, e não importa nada do clone: o código que ela roda não pode ser o que um
agente acabou de editar. O código-fonte dela fica versionado em `ferramentas/tarefa/`, e a instalação copia.

**Tecnologia:** Node 24 na máquina do PO e o Node do runner `ubuntu-latest` no CI (só ESM, `node:test`,
`node:child_process`, `node:fs`, `node:crypto`; nada de npm); `gitleaks` 8.30.1 pinado por SHA-256; Git for Windows
2.55; Windows PowerShell 5.1 só para a notificação. O agendador recebe o comando pelo `schtasks` com `--%`.

**Spec:** `docs/specs/2026-11-05-repositorio-de-contexto-design.md` (seções 4.1 a 4.6, 6 e 8). Quem executa lê a spec
e este plano.

## Decisões deste plano (escolhas do Claude, vetáveis pelo PO antes de executar)

- **D-F1-1. Node para a trava e a tarefa.** Um código só no pre-commit e no CI, testado com `node:test`. O Node já está
  em `C:\Program Files\nodejs\node.exe`. Uma sessão Codex que faz commit precisa do Node no caminho dela.
- **D-F1-2. `gitleaks` local baixado do release oficial, versão 8.30.1** (a mesma do CI do `grc-saas`), em
  `%USERPROFILE%\.vallus-contexto\bin\gitleaks.exe`, com o SHA-256 pinado em `ferramentas/gitleaks-8.30.1.sha256`.
  Sem o binário, a trava recusa todo commit. O download é do coordenador, com o ok do PO.
- **D-F1-3. O aviso da tarefa ao PO é uma notificação do Windows**, mais uma linha no log
  `%USERPROFILE%\.vallus-contexto\tarefa.log`. Cada situação avisa uma vez; um commit retido volta a avisar uma vez
  por dia enquanto estiver retido. Uma prova real com o PO vendo a notificação entra nas Tarefas 10 e 11. O aviso de
  CI é o e-mail de falha de workflow que o GitHub manda a quem empurrou, que é o PO (o push pela chave aparece no nome
  dele).
- **D-F1-4. Modelos em `modelos/`**, uma pasta que a seção 4.1 não tem. O `LEIA-ME` aponta para eles em vez de
  repetir os formatos, e cabe nas 80 linhas.
- **D-F1-5. A tarefa é versionada em `ferramentas/tarefa/` e instalada por cópia** em
  `%USERPROFILE%\.vallus-contexto\tarefa\`. Mudar a fonte não muda o que roda: o PO reinstala.
- **D-F1-6. O trabalho vai numa branch local `f1`.** Ao fim, o PO revisa e avança o main local para ela
  (`git merge --ff-only f1`). A tarefa empurra o que vem antes do primeiro commit em `.github/` ou `.githooks/`, retém
  dali em diante e avisa; o PO empurra o resto com o próprio login (seção 4.6). O ruleset `so-main` impede a branch de
  subir.
- **D-F1-7. A retida não mexe no índice do Git.** A trava move o arquivo de trabalho, grava o esboço no lugar e recusa
  o commit; a sessão repete com `git add -- <caminho>` e `git commit -- <caminho>`. Mexer no índice dentro do hook
  esbarra no índice temporário do `git commit -- <caminhos>` e no `index.lock`. Consequência: o conteúdo barrado
  que já tinha passado por `git add` fica como objeto solto em `.git/objects` até o próximo `git gc`; fica registrado
  como limite, junto do da seção 4.3.
- **D-F1-8. `ferramentas/` entra nos caminhos vigiados pelo aviso do CI.** É a fonte do script que roda de hora em hora
  com a chave; o PO precisa saber quando ela muda antes de reinstalar. Amplia a lista da QC12, por isso é do PO.
  `testes/` fica fora: enfraquecer um teste não enfraquece a trava, que mora em `.githooks/` e já é vigiada.
- **D-F1-9. Nenhum arquivo binário no repositório.** Todo arquivo tem de ser UTF-8 válido e sem byte nulo; o BOM UTF-8
  é aceito. Sem isso, um `.md` gravado em UTF-16 (o que o `>` do Windows PowerShell 5.1 faz) passaria pela trava
  como binário. Se um dia entrar imagem, uma lista de extensões em `.githooks/` resolve, por decisão do PO.
- **D-F1-10. A tarefa roda escondida.** O agendador chama `wscript.exe` com um `empurrar.vbs` de duas linhas que inicia
  o Node sem janela; sem isso, uma janela de console pisca a cada hora.

## Restrições globais (valem para toda tarefa, copiadas da spec)

- Markdown puro, UTF-8, links relativos, nomes de arquivo sem acento (INV-C7). `.gitattributes`: LF em tudo.
- Tetos: `LEIA-ME.md` 80 linhas; `frente.md` 60; `passagem.md` 40; entrada 40; `decisoes/<decisão>.md` 30; lição 40.
- UUID só no campo `sessao:` do cabeçalho. O cabeçalho é só o bloco entre o `---` da primeira linha do arquivo e o
  `---` seguinte; `sessao:` aparece nele no máximo uma vez, com exatamente um UUID, e a linha inteira tem de casar com
  o formato do campo; fora do cabeçalho, todo UUID é barrado, inclusive numa linha `sessao:` no corpo ou num segundo
  bloco `---` no meio do arquivo.
- E-mail permitido: domínios da casa (`vallusgrc.com.br`, `verusgrc.com.br`), o do PO (`carrasco.cortes@gmail.com`) e
  `noreply`. Todo outro e-mail é barrado.
- Id de produção: o `grc-saas` usa cuid (`c` mais 24 caracteres de `a-z0-9`) em 116 modelos do Prisma, e o id de
  usuário é UUID.
- Falso positivo se resolve por exceção por arquivo e por hash do conteúdo, nunca afrouxando o padrão.
- Commit só dos próprios caminhos (`git commit -- <caminhos>`), nunca `git commit -a` nem `git add .`. Autor:
  ferramenta e modelo, com o e-mail do PO (`git -c user.name="claude-code · <modelo>" -c
  user.email=carrasco.cortes@gmail.com commit ...`). A única exceção é o commit do modo executável do `pre-commit`
  (Tarefa 6).
- Nenhuma sessão faz push. Nenhum rebase, amend ou push forçado no main. Pular o hook é proibido, salvo o
  `--no-verify` dos testes no repositório descartável.
- Valor plantado (CPF, chave, UUID no corpo) nunca vai ao main e nunca aparece literal em arquivo do repositório: os
  testes o constroem em tempo de execução. O plano e a spec citam os padrões só por descrição.
- A trava nunca imprime o valor que barrou: só o caminho, a linha e o nome do padrão.
- Toda listagem de caminhos do Git usa `-z` (sem ele, o Git escreve nome com acento entre aspas e em octal, e a
  checagem de nome deixa de pegar).
- Testes rodam com `node --test testes/*.test.mjs` (o Node 24 não aceita uma pasta como argumento) e não dependem da
  configuração do Git da máquina: todo Git dos testes passa pelo `testes/git.mjs` (Tarefa 1).
- Actions pinadas por SHA; `persist-credentials: false`; `permissions: contents: read`; `shell: bash`.

## Foco da revisão

1. **`git commit -- <caminhos>` usa um índice temporário** (`GIT_INDEX_FILE`). A trava tem de ler o conteúdo que vai
   ser commitado (`git show :<caminho>` respeita a variável), e não o índice real nem o disco. Teste na Tarefa 6.
2. **Arquivo escrito no Windows com BOM UTF-8 ou CRLF** tem de passar, e o cabeçalho tem de ser reconhecido; arquivo
   em UTF-16, em ANSI ou com byte nulo tem de ser recusado. Testes nas Tarefas 3 e 6.
3. **A pasta das retidas não existe, é um arquivo ou não aceita gravação.** A trava recusa sem mover e diz isso; nunca
   deixa de barrar. Duas retidas com o mesmo nome não se sobrescrevem. Testes na Tarefa 5.
4. **Rede caída, remoto vazio, remoto à frente, divergente ou com merge no meio.** A tarefa não empurra o que não deve,
   avisa uma vez por situação e volta a avisar quando a situação some e reaparece. Testes na Tarefa 8.
5. **Arquivo renomeado, apagado ou com nome acentuado.** Renomeado: vale o nome e o conteúdo novos. Apagado: nada a
   conferir. Acentuado: recusado também no CI. Testes nas Tarefas 1 e 6.

## Mapa dos aceites da F1 (seção 6 da spec)

| Aceite | Tarefa |
|---|---|
| Commit recusado com cada valor plantado: chave de API de provedor, PEM, JWT, conexão com senha, CPF, CNPJ, e-mail fora da lista, id de organização, UUID no corpo, nome com acento | 2, 3, 6 |
| UUID em `sessao:` passa; `sessao:` no corpo, segundo bloco `---` e dois UUIDs no campo dão vermelho | 3, 6 |
| O mesmo valor, empurrado ao descartável com `--no-verify`, faz o CI falhar | 6, 7, 11 |
| Aviso: `LEIA-ME`, `.githooks/`, `.gitattributes`, `.github/` (QC12); `decisoes.md` e `decisoes/` (QC11); `INDICE.md`, lição e referência (QC13); `passagem.md` e entrada não avisam | 7, 10, 11 |
| Push com 3 commits, só o primeiro em `decisoes.md`, avisa | 7, 11 |
| Plantar e apagar o CPF no mesmo push faz o CI falhar; `before` zerado com dois commits, só o primeiro plantado, falha | 6, 11 |
| Lição sem linha no `INDICE.md` é recusada | 4, 6 |
| A tarefa empurra só o main; a chave não cria branch (F0) nem tag | 8, 11 |
| Commit em `.github/` ou `.githooks/` retido, empurra até o anterior, avisa o PO; depois do push do PO, volta a empurrar | 8, 10 |
| A tarefa avisa quando o push falha, inclusive por histórico divergente; não empurra com `core.hooksPath` errado | 8, 11 |
| O repositório descartável foi apagado ao fim da F1 | 11 |

---

## Preparação (coordenador, antes da Tarefa 1)

- [ ] `git -C C:\dev\vallus-contexto branch --show-current` dá `main`, sem `MERGE_HEAD`; criar e trocar para a branch
  local `f1` (`git switch -c f1`); commitar este plano por caminho (`docs: plano da F1`).
- [ ] Com o ok do PO: baixar `gitleaks_8.30.1_windows_x64.zip` do release oficial do `gitleaks` no GitHub (por volta
  de 8 MB) e o `gitleaks_8.30.1_checksums.txt` da mesma release; conferir o SHA-256 do zip contra o arquivo de
  checksums; extrair só o `gitleaks.exe` para `%USERPROFILE%\.vallus-contexto\bin\` (a pasta herda a ACL só do PO);
  gravar o SHA-256 em `ferramentas/gitleaks-8.30.1.sha256`. Esperado: `gitleaks.exe version` imprime `8.30.1`.
- [ ] Conferir em `gitleaks.exe help stdin` os nomes do subcomando de entrada padrão e das opções `--redact`,
  `--exit-code`, `--report-format` e `--report-path`. A Tarefa 6 usa os nomes que esse help mostrar.

### Tarefa 1: Estrutura, `.gitattributes`, modelos e o Git dos testes

**Arquivos:**
- Criar: `.gitattributes`, `memoria/INDICE.md`, `memoria/licoes/.gitkeep`, `memoria/referencias/.gitkeep`,
  `decisoes/.gitkeep`, `frentes/.gitkeep`
- Criar: `modelos/frente.md`, `modelos/passagem.md`, `modelos/entrada.md`, `modelos/decisao-da-frente.md`,
  `modelos/decisao.md`, `modelos/licao.md`, `modelos/referencia.md`
- Criar: `testes/git.mjs`
- Teste: `testes/estrutura.test.mjs`

**Interfaces:**
- Produz: os modelos, que o `LEIA-ME` (Tarefa 9) cita e que a Tarefa 5 segue no esboço.
- Produz: `testes/git.mjs` com `git(args: string[], opcoes?: { cwd?: string, env?: object, input?: Buffer|string }):
  { status: number, stdout: Buffer, stderr: string }` e `repoTemporario(): string`. Todo Git dos testes passa por ele,
  com `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME` e `GIT_COMMITTER_EMAIL` fixos (e-mail `noreply`),
  `GIT_CONFIG_NOSYSTEM=1` e `GIT_CONFIG_GLOBAL` apontando para um arquivo vazio. As variáveis valem também para o Git
  que um hook chamar.

- [ ] **Passo 1: escrever o teste.** `testes/estrutura.test.mjs`:
  - `nenhum arquivo versionado tem acento no nome`: lê `git ls-files -z`; todo caminho casa com `/^[\x20-\x7E]+$/`;
  - `o teste de acento não é vazio`: num `repoTemporario()` com um arquivo de nome acentuado, a mesma função acusa;
  - `cada modelo respeita o teto`: `frente.md` ≤ 60 linhas, `passagem.md` ≤ 40, `entrada.md` ≤ 40, `decisao.md` ≤ 30,
    `licao.md` ≤ 40;
  - `todo arquivo versionado é UTF-8 em LF`: nenhum `\r\n`, nenhum byte nulo, decodificação UTF-8 estrita;
  - `o campo sessao dos modelos é o marcador <id>`.
- [ ] **Passo 2:** `node --test testes/estrutura.test.mjs` — FALHA (os modelos não existem).
- [ ] **Passo 3: escrever os arquivos.** `.gitattributes` com `* text=auto eol=lf`. `INDICE.md` com um título e a
  frase "uma linha por lição ou referência, com link relativo". Os modelos copiam os blocos da seção 4.2 da spec
  (cabeçalhos e seções, com os comentários), `decisao-da-frente.md` é o bloco `## DF-n`, e `decisao.md`, `licao.md` e
  `referencia.md` seguem o texto da 4.2 (lição e referência: `name`, `description`, `tipo`, corpo com o fato,
  **Por quê** e **Como aplicar**).
- [ ] **Passo 4:** `git ls-files --eol` mostra `i/lf` em todo arquivo; `node --test testes/*.test.mjs` PASSA.
- [ ] **Passo 5: commit** dos caminhos da tarefa, com o autor da restrição global: `feat: estrutura, modelos e o Git
  dos testes`.

### Tarefa 2: Detectores de conteúdo

**Arquivos:**
- Criar: `.githooks/lib/padroes.mjs`, `testes/gerar.mjs`
- Teste: `testes/padroes.test.mjs`

**Interfaces:**
- Produz: `detectar(texto: string): Array<{ padrao: string, linha: number }>`, com `padrao` em
  `'cpf' | 'cnpj' | 'email' | 'id-producao' | 'pem' | 'jwt' | 'conexao-com-senha' | 'chave-api'`. Nunca devolve o
  trecho casado.
- Produz (só para teste): `testes/gerar.mjs` com `cpfValido()`, `cnpjValido()`, `cuid()`, `uuid()`, `chaveGithub()`,
  `chaveAnthropic()`, `chaveGoogle()`, `pem()`, `jwt()`, `conexaoComSenha()`, `emailDeFora()`, todos montados em tempo
  de execução (concatenação e dígitos calculados), sem valor literal no arquivo.

- [ ] **Passo 1: escrever os testes**, um por padrão, para que tirar um padrão faça o teste dele falhar:
  - `barra CPF com e sem pontuação`: `detectar('x ' + cpfValido())` e o mesmo número com pontos e traço dão um achado
    `cpf`;
  - `não barra CPF com dígito verificador errado nem onze dígitos iguais`;
  - `barra CNPJ` / `não barra CNPJ com dígito errado`;
  - `barra e-mail fora da lista` (`emailDeFora()`);
  - `não barra e-mail permitido`: `alguem@vallusgrc.com.br`, `alguem@verusgrc.com.br`, `carrasco.cortes@gmail.com`,
    `noreply@anthropic.com`, `123+nome@users.noreply.github.com` e o endereço SSH do GitHub, `git@github.com`, que a
    tarefa usa na URL do remoto;
  - `barra cuid` e `não barra SHA de 40 nem de 7 caracteres` (hexadecimal);
  - `barra PEM`, `barra JWT`, `barra conexão com senha` e `não barra URL sem senha`
    (`https://github.com/carrascocortes/vallus-contexto`);
  - `barra chave de API de provedor`: os três geradores;
  - `nunca devolve o valor`: para cada gerador, `JSON.stringify(detectar(v))` não contém `v`;
  - `informa a linha`: o achado na 3ª linha traz `linha: 3`.
- [ ] **Passo 2:** `node --test testes/padroes.test.mjs` — FALHA.
- [ ] **Passo 3: implementar `detectar`.** CPF e CNPJ com dígito verificador calculado; candidato só com borda de
  palavra (`\b`), o que deixa de fora dígitos dentro de SHA. E-mail: local `noreply` ou `no-reply` em qualquer domínio,
  domínio terminado em `.noreply.github.com`, os dois domínios da casa, o e-mail do PO e `git@github.com`; todo o resto
  barra. Chave de API: `gh[pousr]_` com 36 alfanuméricos, `github_pat_`, `sk-ant-`, `AIza` com 35. PEM: a linha de
  abertura de chave privada (`BEGIN`, o tipo e `PRIVATE KEY` entre cinco hífens). JWT: três partes base64url começando
  por `eyJ`. Conexão: um esquema de URL seguido de usuário, dois-pontos, senha e arroba.
- [ ] **Passo 4:** os testes PASSAM.
- [ ] **Passo 5: commit** `feat(trava): detectores de conteúdo`.

### Tarefa 3: Cabeçalho e UUID

**Arquivos:**
- Criar: `.githooks/lib/cabecalho.mjs`
- Teste: `testes/cabecalho.test.mjs`

**Interfaces:**
- Produz: `lerCabecalho(texto: string): { campos: Map<string,string>, fimDaLinha: number } | null` (aceita BOM no início
  e CRLF) e `verificarUuid(texto: string): Array<{ padrao: string, linha: number }>`, com `padrao` em
  `'uuid-fora-do-cabecalho' | 'sessao-invalida'`.

- [ ] **Passo 1: escrever os testes** (UUID montado por `uuid()` de `testes/gerar.mjs`):
  - `aceita UUID no campo sessao do cabeçalho`: `---\nsessao: <uuid>\n---\ncorpo` → nenhum achado;
  - `barra UUID no corpo`;
  - `barra linha sessao com UUID no corpo` (`---\na: b\n---\nsessao: <uuid>`);
  - `barra UUID num segundo bloco ---` no meio do arquivo;
  - `barra dois UUIDs no campo` e `barra sessao repetida no cabeçalho`;
  - `barra linha sessao com texto além do UUID` (`sessao: <uuid> extra`);
  - `aceita sessao: <id> dos modelos` (sem UUID na linha, nada a barrar);
  - `aceita cabeçalho com BOM e CRLF`;
  - `arquivo sem cabeçalho: todo UUID é corpo`.
- [ ] **Passo 2:** FALHA.
- [ ] **Passo 3: implementar.** O cabeçalho só existe se a primeira linha (sem o BOM) for exatamente `---`; termina no
  `---` seguinte. Dentro dele, a linha `sessao:` que contém UUID tem de casar com
  `^sessao: [0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$` e aparecer uma vez; qualquer
  outro UUID do arquivo é achado.
- [ ] **Passo 4:** PASSA.
- [ ] **Passo 5: commit** `feat(trava): regra do UUID e do cabeçalho`.

### Tarefa 4: Lição sem linha no índice

**Arquivos:**
- Criar: `.githooks/lib/indice.mjs`
- Teste: `testes/indice.test.mjs`

**Interfaces:**
- Produz: `semIndice(caminhos: string[], indice: string): string[]` — os caminhos sob `memoria/licoes/` ou
  `memoria/referencias/` (exceto `.gitkeep`) cujo link relativo (`licoes/<nome>.md` ou `referencias/<nome>.md`) não
  aparece no texto do índice.

- [ ] **Passo 1: testes:** `lição sem linha é devolvida`; `lição com linha passa`; `referência idem`; `outros caminhos
  são ignorados`; `nome parecido não conta` (`licoes/abc.md` não é coberto por `licoes/abcd.md`).
- [ ] **Passo 2:** FALHA. **Passo 3:** implementar. **Passo 4:** PASSA.
- [ ] **Passo 5: commit** `feat(trava): lição sem linha no índice`.

### Tarefa 5: Retida

**Arquivos:**
- Criar: `.githooks/lib/retida.mjs`
- Teste: `testes/retida.test.mjs`

**Interfaces:**
- Consome: `detectar` (Tarefa 2), `verificarUuid` e `lerCabecalho` (Tarefa 3).
- Produz: `ehRetivel(caminho: string): boolean` (verdadeiro só para `frentes/<slug>/memoria/<nome>.md` e
  `frentes/<slug>/passagem.md`); `esboco(caminho: string, original: string, padroes: string[], agora: Date): string`;
  `raizRetidasPadrao(): string` = `process.env.VALLUS_RETIDAS` ou `%LOCALAPPDATA%\vallus-office\retidas`;
  `garantirRaiz(raiz: string, { padrao: boolean }): void`, que cria as pastas que faltam e, com `padrao` verdadeiro e a
  raiz recém-criada, roda `icacls <raiz> /inheritance:r /grant:r <USERDOMAIN>\<USERNAME>:(OI)(CI)F`;
  `reter(opcoes): { destino: string }`, com `opcoes = { raizClone: string, caminho: string, raizRetidas: string,
  padroes: string[], agora: Date }`, que chama `garantirRaiz` (com `padrao` verdadeiro só quando a raiz é a padrão e
  `VALLUS_RETIDAS` está vazio). Toda falha lança `Error` com `code = 'RETENCAO_FALHOU'` sem tocar no original.

- [ ] **Passo 1: testes** (pasta temporária como `raizRetidas`):
  - `ehRetivel` para entrada, passagem, `frente.md` (falso) e lição (falso);
  - `esboço de entrada passa na trava`: `detectar` e `verificarUuid` do esboço não dão achado, ele traz
    `desfecho: retido` e `motivo: trava: cpf`, e copia `data`, `autor`, `ferramenta`, `modelo` e `sessao` do original;
  - `esboço descarta campo do cabeçalho que tem valor barrado` (um `autor` com `emailDeFora()` não é copiado);
  - `esboço de passagem traz só o cabeçalho e a nota de retida`;
  - `reter move o arquivo para <raiz>/<slug>/<data>-<nome> e grava o esboço no lugar`;
  - `reter não sobrescreve retida anterior` (segunda retida do mesmo nome ganha sufixo `-2`);
  - `reter falha sem tocar no original quando a raiz é um arquivo` (código `RETENCAO_FALHOU`);
  - só no Windows: `garantirRaiz com padrao deixa uma única entrada na ACL`, a do usuário com `(OI)(CI)(F)`, sem
    entrada herdada `(I)`, numa pasta temporária nova.
- [ ] **Passo 2:** FALHA.
- [ ] **Passo 3: implementar.** Ordem do `reter`: copia para o destino, confere que a cópia tem o mesmo tamanho, grava o
  esboço num arquivo temporário ao lado do original e o renomeia por cima. O esboço segue `modelos/entrada.md` e
  `modelos/passagem.md`, com o texto "Texto retido pela trava em <data>. Está fora do repositório até o PO liberar."
- [ ] **Passo 4:** PASSA.
- [ ] **Passo 5: commit** `feat(trava): retida movida para fora do repositório`.

### Tarefa 6: A trava, o pre-commit e as exceções

**Arquivos:**
- Criar: `.githooks/trava.mjs`, `.githooks/pre-commit`, `.githooks/excecoes.txt`, `.githooks/lib/push.mjs`
- Teste: `testes/trava.test.mjs`

**Interfaces:**
- Consome: Tarefas 1 a 5.
- Produz `commitsDoPush(before: string, after: string, cwd: string): string[]` em `.githooks/lib/push.mjs`: os commits
  de `git rev-list --reverse --topo-order <before>..<after>`, do mais antigo ao mais novo; com `before` só de zeros,
  `git rev-list --reverse --topo-order <after>`. Falha do Git lança erro.
- Produz a linha de comando:
  - `node .githooks/trava.mjs --staged` (pre-commit): confere o que vai ser commitado;
  - `node .githooks/trava.mjs --commit <sha>`: confere os arquivos que o commit mudou, no conteúdo do commit;
  - `node .githooks/trava.mjs --push <before> <after>` (CI): roda o `--commit` em cada commit de `commitsDoPush`;
    lista vazia com `after` diferente de zero é erro;
  - `node .githooks/trava.mjs --arvore`: todos os arquivos versionados no HEAD (para a varredura da F3);
  - saída `0` (passa), `1` (barrou), `2` (erro, inclusive `gitleaks` ausente ou com erro: recusa, sem retida).
- `excecoes.txt`: uma linha por exceção, `<caminho>\t<sha256 do conteúdo>\t<motivo>`; `#` é comentário. O arquivo que
  casa caminho e hash pula os detectores próprios e o `gitleaks`.
- `gitleaks`: `VALLUS_GITLEAKS`, senão `%USERPROFILE%\.vallus-contexto\bin\gitleaks.exe`. Roda pela entrada padrão,
  um arquivo por vez, com `--redact`, `--exit-code 3`, relatório JSON num arquivo temporário, a pasta de trabalho numa
  pasta temporária vazia e sem `GITLEAKS_CONFIG` e `GITLEAKS_CONFIG_TOML` no ambiente do processo filho (só vale a
  configuração embutida). Saída `0` = limpo; `3` com achado no relatório = achado de conteúdo; qualquer outra coisa =
  erro (a trava sai `2`). O `gitleaks` 8.30.1 sai `1` tanto em achado quanto em erro, por isso o `--exit-code 3`.

- [ ] **Passo 1: testes de integração**, cada um num `repoTemporario()` com `.githooks/` copiado, o `pre-commit` com
  `chmod 755` depois da cópia (no Linux, o Git ignora hook sem o bit), `core.hooksPath=.githooks`, `VALLUS_RETIDAS` numa
  pasta temporária e o `gitleaks` real (sem o binário, o teste falha com mensagem; não pula):
  - `recusa cada valor plantado`: um commit por valor (os dez do mapa de aceites), cada um recusado com saída `1`;
  - `aceita UUID no campo sessao` e `recusa os três casos vermelhos do campo` (Tarefa 3);
  - `recusa lição sem linha no índice` e `aceita com a linha no mesmo commit`;
  - `retém entrada com CPF`: o commit é recusado, o arquivo some de `frentes/`, o esboço fica no lugar, e
    `git add -- <caminho>` mais `git commit -- <caminho>` passam com o esboço;
  - `retém passagem com e-mail fora da lista` do mesmo jeito;
  - `não retém lição barrada` (recusa sem mover);
  - `recusa sem mover quando a pasta das retidas falha`, e o texto continua em `frentes/`;
  - `lê o conteúdo do commit por caminho`: arquivo limpo no índice e com CPF no disco, `git commit -- <caminho>` é
    recusado (Foco 1);
  - `recusa .md em UTF-16LE com CPF` (bytes de `Buffer.from(texto, 'utf16le')` com o BOM), `recusa ANSI`
    (Windows-1252 com acento) e `recusa byte nulo num .md em UTF-8`, todos com saída `1` e sem retida; `aceita UTF-8
    com BOM e CRLF`;
  - `renomeado para nome com acento é recusado`; `apagado passa`;
  - `exceção por hash`: o arquivo exato passa; o mesmo caminho com outro conteúdo é recusado;
  - `sem gitleaks recusa` (`VALLUS_GITLEAKS` inexistente: saída `2`, sem commit) e `gitleaks com erro não retém`
    (`GITLEAKS_CONFIG` apontando para um TOML malformado no ambiente do teste: saída `2`, o arquivo continua em
    `frentes/`); `um .gitleaks.toml na raiz do repositório não muda o resultado`;
  - `a saída não mostra o valor`: em todos os casos acima, o stderr não contém o valor plantado;
  - `--commit` sobre um commit feito com `--no-verify` com CPF dá `1`; com um arquivo de nome acentuado dá `1` (e não
    `2`);
  - `--push`: num repositório com 3 commits, o primeiro planta um CPF e o segundo o apaga → `1`; `before` zerado com
    dois commits, só o primeiro plantado → `1`; push limpo → `0`; lista vazia com `after` diferente de zero → `2`;
  - `--arvore` acha um valor numa árvore já versionada.
- [ ] **Passo 2:** FALHA.
- [ ] **Passo 3: implementar.** `--staged` lista com `git diff --cached --name-status -z --diff-filter=ACMRT` e lê com
  `git show :<caminho>`; `--commit` lista com `git diff-tree --no-commit-id -r --name-status -z --root <sha>` e lê com
  `git show <sha>:<caminho>`; falha do `git show` é saída `2`. Antes dos detectores, todo conteúdo passa pela regra da
  D-F1-9 (`new TextDecoder('utf-8', { fatal: true })`, sem byte nulo, BOM UTF-8 removido); falhar é o achado
  `encoding-invalido`. O índice usado na regra da Tarefa 4 é o do mesmo momento (o do índice no pre-commit, o do commit
  no CI). Só achado de conteúdo em caminho retível dispara a retida; nome com acento, codificação, lição sem índice e
  achado em outro caminho só recusam. A mensagem diz o caminho, a linha, o padrão e, na retida, os dois comandos para
  repetir. `pre-commit`: `#!/bin/sh` e `exec node "$(git rev-parse --show-toplevel)/.githooks/trava.mjs" --staged`.
- [ ] **Passo 4:** `node --test testes/*.test.mjs` PASSA inteiro.
- [ ] **Passo 5: commit** por caminho: `feat(trava): pre-commit, exceções e gitleaks`.
- [ ] **Passo 6: modo executável na árvore** (para clones fora do Windows; com `core.filemode=false`, o
  `git commit -- <caminho>` descarta o bit): `git add --chmod=+x -- .githooks/pre-commit`, conferir que
  `git diff --cached --name-only` lista só esse caminho, `git commit -m "chore(trava): pre-commit executável"` sem
  pathspec, e conferir com `git ls-tree HEAD -- .githooks/pre-commit` que o modo é `100755`.

### Tarefa 7: CI

**Arquivos:**
- Criar: `.github/workflows/ci.yml`, `.githooks/lib/caminhos.mjs`, `.githooks/aviso.mjs`
- Apagar: `.github/workflows/aviso.yml` (o provisório da F0)
- Teste: `testes/aviso.test.mjs`

**Interfaces:**
- Consome: `commitsDoPush` (Tarefa 6).
- Produz: `caminhoVigiado(caminho: string): boolean` — verdadeiro para `LEIA-ME.md`, `.gitattributes`, tudo sob
  `.githooks/`, `.github/` e `ferramentas/` (D-F1-8), `frentes/<slug>/decisoes.md`, tudo sob `decisoes/`,
  `memoria/INDICE.md` e tudo sob `memoria/licoes/` e `memoria/referencias/`; falso para `passagem.md` e entradas.
- Produz: `node .githooks/aviso.mjs <before> <after>` — lista, por commit de `commitsDoPush`, os caminhos vigiados
  tocados (`git diff-tree --no-commit-id -r --name-only -z --root`); sai `1` se houver, `2` em erro do Git ou lista
  vazia com `after` diferente de zero.

- [ ] **Passo 1: testes:** `caminhoVigiado` para cada caminho da lista e para `passagem.md`, entrada, `docs/` e
  `testes/`; `aviso.mjs` com 3 commits em que só o primeiro toca um `decisoes.md` sai `1` e cita o primeiro; com 2
  commits só em `passagem.md` e numa entrada sai `0`; com `before` zerado varre todos.
- [ ] **Passo 2:** FALHA. **Passo 3:** implementar.
- [ ] **Passo 4: escrever `ci.yml`.** `on: push` (branches e tags), `permissions: contents: read`, `defaults: run:
  shell: bash`, dois jobs, cada passo uma chamada só (nada de `for x in $(...)` nem pipe para `while read`):
  - `trava`: checkout pinado por SHA (o do `grc-saas`: `actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5`),
    `fetch-depth: 0`, `persist-credentials: false`; baixa o `gitleaks` 8.30.1 linux x64 e confere o SHA-256
    `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb` em modo arquivo (`sha256sum -c`); com
    `VALLUS_GITLEAKS` apontando para o binário, roda `node --test testes/*.test.mjs` e
    `node .githooks/trava.mjs --push "$BEFORE" "$AFTER"`;
  - `aviso`: checkout igual; `node .githooks/aviso.mjs "$BEFORE" "$AFTER"`.
  `BEFORE` e `AFTER` entram por `env:` (`${{ github.event.before }}`, `${{ github.sha }}`), nunca interpolados no
  script.
- [ ] **Passo 5:** `node --test testes/*.test.mjs` PASSA. O CI só se prova no GitHub (Tarefas 10 e 11).
- [ ] **Passo 6: commit** `feat(ci): trava sobre cada commit do push e aviso dos caminhos vigiados`.

### Tarefa 8: A tarefa que empurra

**Arquivos:**
- Criar: `ferramentas/tarefa/empurrar.mjs`, `ferramentas/tarefa/avisar.ps1`, `ferramentas/tarefa/empurrar.vbs`
- Teste: `testes/tarefa.test.mjs`

**Interfaces (o arquivo não importa nada de `.githooks/`):**
- `decidir(estado): { acao: 'nada' | 'empurrar' | 'reter' | 'parar', alvo?: string, retido?: string, motivo?: string }`,
  com `estado = { hooksPath: string, local: string, remoto: string | '' | null, remotoEhAncestral: boolean,
  merges: string[], commits: Array<{ sha: string, arquivos: string[] }>, erroDeLeitura?: string }` (commits do mais
  antigo ao mais novo; `remoto` `''` = main vazio no GitHub, `null` = não foi possível ler). Regras, nesta ordem:
  1. `erroDeLeitura` → `parar`, motivo `erro do Git: <erroDeLeitura>`;
  2. `hooksPath !== '.githooks'` → `parar`, motivo `hook desligado`;
  3. `remoto === null` → `parar`, motivo `GitHub inacessível`;
  4. `remoto === local` → `nada`;
  5. `remoto !== ''` e não ancestral → `parar`, motivo `histórico divergente`;
  6. `merges` não vazio → `parar`, motivo `merge no main` (a tarefa não raciocina sobre merge; o PO resolve);
  7. primeiro commit que toca `.github/` ou `.githooks/` → se for o primeiro da lista, `reter` com `retido` = ele e
     sem `alvo`; senão `empurrar` com `alvo` = o anterior e `retido` = ele;
  8. senão `empurrar` com `alvo = local`.
- `main(argv)`: opções `--clone`, `--url`, `--chave`, `--known-hosts`, `--ssh-config`, `--estado`, `--log`,
  `--avisar` (caminho do `avisar.ps1`); os padrões apontam para `C:\dev\vallus-contexto`,
  `git@github.com:carrascocortes/vallus-contexto.git` e os arquivos de `%USERPROFILE%\.vallus-contexto\`. Leituras:
  `core.hooksPath`; `refs/heads/main` local (nunca o HEAD); remoto por `git ls-remote <url> refs/heads/main`. Com
  remoto vazio: commits de `git rev-list --reverse --topo-order refs/heads/main`, sem `merge-base`. Com remoto
  preenchido: `git merge-base --is-ancestor <remoto> refs/heads/main` (saída `0` = verdadeiro; qualquer outra, inclusive
  `128` de objeto ausente, = falso); só com verdadeiro, commits de `git rev-list --reverse --topo-order
  <remoto>..refs/heads/main` e merges de `git rev-list --min-parents=2 <remoto>..refs/heads/main`. Arquivos por
  `git diff-tree --no-commit-id -r --name-only -z --root <sha>`. Qualquer falha de Git na leitura vira `erroDeLeitura`.
  Empurra com `git push <url> <alvo>:refs/heads/main`, nunca `--force`; com a URL SSH, usa o mesmo `GIT_SSH_COMMAND`
  da F0 (chave, `known_hosts` próprio, `ssh_config` vazio, `BatchMode=yes`); com URL de pasta (os testes), não usa SSH.
  Depois de empurrar, atualiza `refs/remotes/origin/main`. Falha do push gera a situação `falha-push`.
- **Aviso:** a cada ciclo, a tarefa calcula a chave da situação e grava em `--estado`, inclusive quando não há nada a
  avisar (`ok`). Chaves: `parar|<motivo>|<main local>`; `retido|<sha do retido>|<data AAAA-MM-DD>` (vale para `reter`
  e para `empurrar` com `retido`, e a data faz o retido voltar a avisar uma vez por dia); `falha-push|<primeira linha do
  erro>|<alvo>`. Avisa quando a chave é dessas três e difere da gravada no ciclo anterior. O aviso chama
  `powershell.exe -NoProfile -ExecutionPolicy Bypass -File <avisar.ps1> -Titulo <t> -Texto <x>`; saída diferente de
  zero vira linha `falha do canal de aviso` no log. Todo ciclo grava uma linha no `--log`.
- `avisar.ps1`: notificação do Windows pela API de notificações do WinRT com o identificador de aplicativo do Windows
  PowerShell (o GUID da pasta System32 entre chaves, seguido de `\WindowsPowerShell\v1.0\powershell.exe`), título e
  texto recebidos por parâmetro. O GUID tem o formato de UUID, que a trava barra fora do cabeçalho: o script o monta
  por partes, em vez de escrevê-lo inteiro, e a varredura da Tarefa 10 confirma que o arquivo passa.
- `empurrar.vbs`: inicia `node.exe` com `empurrar.mjs` (caminho relativo à pasta do próprio `.vbs`) com a janela
  escondida e sem esperar.

- [ ] **Passo 1: testes.**
  - Tabela de `decidir`: um caso por regra, mais `remoto vazio empurra tudo` e `commit em .githooks no meio: empurrar
    com alvo e retido preenchidos`.
  - Integração, com um repositório nu numa pasta temporária como remoto e o aviso injetado contando as chamadas:
    `empurra o main`; `retém o commit em .github, empurra só até o anterior e avisa uma vez`; `no ciclo seguinte, com o
    mesmo retido, não avisa de novo`; `depois que o remoto avança até o retido (push feito por outro clone), volta a
    empurrar o resto`; `remoto vazio com commit em .github retém a partir dele`; `não empurra com core.hooksPath errado
    e avisa`; `hook desligado, consertado e desligado de novo avisa duas vezes`; `remoto à frente, com o objeto ausente
    no clone (avançado por um segundo clone), não muda, não lança e avisa`; `merge no intervalo para e avisa`;
    `push recusado por um hook pre-receive no remoto avisa e grava falha-push`; `GitHub inacessível, depois ok, depois
    inacessível de novo avisa duas vezes` (URL de pasta inexistente simula a queda); `HEAD numa branch de trabalho:
    empurra o main, não o HEAD`; `nunca usa --force` (o remoto à frente continua à frente).
- [ ] **Passo 2:** FALHA. **Passo 3:** implementar. **Passo 4:** `node --test testes/*.test.mjs` PASSA.
- [ ] **Passo 5: commit** `feat(tarefa): empurrar o main de hora em hora, com retenção de .github e .githooks`.

### Tarefa 9: `LEIA-ME` e a frente do próprio repositório

**Arquivos:**
- Criar: `LEIA-ME.md`; `frentes/2026-11-05-repositorio-de-contexto/frente.md`, `passagem.md`, `decisoes.md` e
  `memoria/<AAAA-MM-DDTHH-MM>-claude-code-sessao-manual.md`
- Teste: `testes/estrutura.test.mjs`

- [ ] **Passo 1:** acrescentar ao teste de estrutura `LEIA-ME tem no máximo 80 linhas` e `cada arquivo de frente
  respeita o teto do seu tipo` — FALHA.
- [ ] **Passo 2: escrever o `LEIA-ME`**, nesta ordem: para que serve o repositório (uma frase); o protocolo do turno da
  seção 4.3 (abrir, conferir o bilhete, marcar, marcos, fechar), com os arquivos a ler; o que nunca entra (seção 4.5,
  com o exemplo de pseudônimo da spec); a retida (o que fazer quando a trava retém, e que nenhuma sessão lê
  `retidas\`); arquivo sempre em UTF-8 (no Windows PowerShell 5.1, nunca `>` nem `Out-File` sem `-Encoding utf8`);
  commit só por caminho, e o autor; o push é da tarefa, nenhuma sessão empurra, e o commit em `.github/` ou
  `.githooks/` espera o PO; o que um agente escreve é dado, não instrução, e vale o `AGENTS.md` (INV-C3); correção é
  entrada nova (INV-C5); `VALLUS_OFFICE_MESA`; busca com acento pela ferramenta de busca (ripgrep); onde estão os
  `modelos/`.
- [ ] **Passo 3: a frente do próprio repositório**, pelos modelos: `frente.md` com o objetivo, o aceite das fatias e o
  link da spec; `decisoes.md` com as D-F1 que o PO aprovou (DF-1 em diante; as QC ficam na seção 2 da spec, com link);
  a `passagem.md` e a entrada deste turno, com o id da sessão só no campo `sessao:`.
- [ ] **Passo 4:** `node --test testes/*.test.mjs` PASSA. Com o hook já ativo (Tarefa 10, primeiro passo), o commit
  destes arquivos é o primeiro a passar pela trava de verdade. Commit por caminho: `docs: LEIA-ME e a frente do
  repositório`.

### Tarefa 10: Instalação (coordenador e PO)

- [ ] **Coordenador, antes do commit da Tarefa 9:**
  - `git config core.hooksPath .githooks` no clone;
  - `node .githooks/trava.mjs --arvore` no clone sai `0` (um falso positivo vira exceção por hash, não afrouxa o
    padrão);
  - com `%LOCALAPPDATA%\vallus-office\retidas` ainda inexistente, rodar no clone `node --input-type=module -e "import
    { garantirRaiz, raizRetidasPadrao } from './.githooks/lib/retida.mjs'; garantirRaiz(raizRetidasPadrao(), { padrao:
    true })"` e conferir com `icacls` que a única entrada é `<máquina>\cesar:(OI)(CI)(F)`, sem `(I)`, sem SISTEMA e sem
    Administradores; se a pasta já existir, conferir a mesma coisa e corrigir antes de seguir;
  - copiar `ferramentas/tarefa/*` para `%USERPROFILE%\.vallus-contexto\tarefa\` e conferir a ACL herdada;
  - entregar ao PO os comandos prontos dos passos seguintes.
- [ ] **PO: registrar a tarefa** no PowerShell, com o `--%` (sem ele, o PowerShell quebra as aspas e o `%USERPROFILE%`):
  `schtasks --% /Create /TN "vallus-contexto push" /SC HOURLY /TR "wscript.exe
  \"%USERPROFILE%\.vallus-contexto\tarefa\empurrar.vbs\"" /F`. Conferir com
  `schtasks /Query /TN "vallus-contexto push" /V /FO LIST` que o comando tem o caminho absoluto do `.vbs`.
- [ ] **PO: revisar a branch `f1` e avançar o main** (`git merge --ff-only f1`). Disparar a tarefa
  (`schtasks /Run /TN "vallus-contexto push"`). Esperado: ela empurra os commits anteriores ao primeiro em
  `.githooks/` (o do plano e o da Tarefa 1), retém a partir dele, e o PO vê a notificação na tela e na central de
  notificações; o log tem a linha da retenção. É a prova real do canal de aviso.
- [ ] **PO: empurrar o resto com o próprio login** (`git -C C:\dev\vallus-contexto push origin main`). Esse push roda o
  CI novo: o job `aviso` falha listando `LEIA-ME.md`, `.githooks/`, `.gitattributes`, `.github/` e `ferramentas/`
  (aceite da QC12), e o job `trava` passa. Disparar a tarefa de novo: o log diz `nada`.

### Tarefa 11: Aceites no GitHub e registro na spec

O coordenador escreve um roteiro PowerShell como o da F0 (`f1-testes.ps1`, fora do repositório) que para antes de cada
passo do PO e grava os resultados num arquivo com data. Quem roda é o PO: nenhum push é do coordenador, e nenhum leva
valor plantado para o main.

- [ ] **Repositório descartável:** o PO cria `carrascocortes/vallus-contexto-descartavel`, privado, e cadastra com
  escrita a chave `descartavel_key` que o coordenador gera em `%USERPROFILE%\.vallus-contexto\`. O roteiro monta um
  clone de teste numa pasta temporária com o conteúdo do main.
  - Primeiro push do descartável, com `before` zerado, feito pelo PO com o login dele (leva `.github/`): dois commits,
    o primeiro com o conteúdo do main e um CPF plantado (`--no-verify`), o segundo apagando o CPF → o job `trava`
    falha no passo da trava (o roteiro registra em qual passo, para provar que não foi o `node --test`). O mesmo push
    prova os dois aceites: `before` zerado com só o primeiro plantado, e plantar e apagar no mesmo push.
  - Disparo de teste da tarefa (`empurrar.mjs --clone <teste> --url <descartável> --chave <descartavel_key>`): um
    commit com chave de API plantada por `--no-verify` → `trava` falha.
  - Canal de aviso real, no clone de teste: com `core.hooksPath` errado, o disparo de teste dá `parar` e o PO confirma
    a notificação; com o descartável avançado por outro clone, o disparo dá `parar` por histórico divergente e o PO
    confirma a notificação.
- [ ] **Aviso no main, com conteúdo real da frente.** Antes de cada caso, o roteiro desliga a tarefa
  (`schtasks /Change /TN "vallus-contexto push" /DISABLE`), o coordenador faz os commits, o roteiro confere a contagem
  com `git rev-list --count origin/main..main`, o PO dispara a tarefa uma vez pelo roteiro e a religa; o PO copia a URL
  da execução:
  - um commit só na `passagem.md` e numa entrada → `aviso` passa;
  - um no `decisoes.md` da frente → `aviso` falha;
  - uma lição real desta frente com a linha no `INDICE.md` → `aviso` falha;
  - três commits num push, só o primeiro no `decisoes.md` (contagem `3`) → `aviso` falha e cita o primeiro.
- [ ] **Ruleset de tag (PO):** `New tag ruleset`, nome `sem-tag`, Active, alvo todas as tags, regra Restrict
  creations; o roteiro tenta criar uma tag pela chave → recusada com `GH013`.
- [ ] **Fim:** o PO apaga o repositório descartável; o coordenador apaga `descartavel_key` e `descartavel_key.pub`.
- [ ] **Registro:** a seção 6 da spec recebe o resultado da F1, como a F0 recebeu, com as evidências do roteiro e as
  decisões D-F1 que o PO vetou ou manteve. Commit por caminho em `docs/`, que a tarefa empurra sozinha.
