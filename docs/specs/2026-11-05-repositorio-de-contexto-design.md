# Repositório de contexto: frentes, memória e passagem de turno para Claude, Codex e o escritório

**Data:** 2026-11-05
**Estado:** proposta do Claude. O PO decidiu as perguntas QC1 a QC13 em 2026-11-05 (seção 2). Está neste
repositório desde o primeiro commit, feito pelo PO na F0 (QC10). A F0 terminou em 2026-11-06, com todos os aceites
cumpridos (seção 6). As escolhas marcadas como do Claude seguem vetáveis.
**Frente própria**, decidida pelo PO em 05/11 (D9 do adendo do projeto 2). Não faz parte do projeto 2, mas a pasta da
frente do projeto 2 passa a morar aqui (seção 4.8), e a F1 dele depende disso.
**Fontes lidas em 05/11:** o adendo do projeto 2 na versão do commit `ffc33c5` (21:31, já com a D3 e a D7 a D9
decididas), em `C:\dev\vallus-office\.worktrees\v1-1\docs\specs\2026-11-04-projeto-2-contexto-e-troca-de-ia-design.md`
(só leitura); a spec principal do escritório (seções 1.1, 11, 13.1a e 15); o `CLAUDE.md` do `vallus-office`; o
`AGENTS.md` e o `docs/operations/ciclo-agentes.md` do `grc-saas`; a medição da seção 1.2.
**Convenção de autoria:** a do escritório. **(decisão do PO)** é do PO; **(escolha do Claude, vetável)** é do Claude;
**(QCn)** cita a decisão n da seção 2. As decisões se chamam QC para não colidir com as Q1 a Q9 da spec principal, e as
decisões de cada frente se chamam DF para não colidir com as D1 a D9 do adendo.

---

## 1. Premissa

Esta seção descreve o problema e o que foi medido. Não desenha nada: o desenho começa na seção 4.

### 1.1 A dor

O PO perdeu 13 sessões manuais de Claude e Codex porque o contexto de cada uma morava dentro dela. A sessão parava, a
prioridade mudava e ninguém, nem outra sessão nem outra ferramenta, sabia retomar de onde ela tinha parado. O adendo do
projeto 2 resolve isso para as frentes que a esteira despacha; as sessões que o PO abre à mão, que são as que se
perderam, ficam de fora dele (adendo, 1.2 e D9).

### 1.2 O que existe hoje (medido em 05/11)

Há pelo menos quatro lugares de contexto, e nenhum é lido por todas as ferramentas:

| Lugar | Quem lê | Tamanho | Histórico e backup |
|---|---|---|---|
| Memória automática do Claude, `C:\Users\cesar\.claude\projects\C--dev-grc-saas\memory\` | Só o Claude, e só sessões que começam no `grc-saas` ou num worktree dele | 251 arquivos (05/11) mais o índice `MEMORY.md`, 2,0 MB | Fora do Git, sem backup |
| Memória própria do Codex, `C:\Users\cesar\.codex\memories\` (`features.memories = true` no `config.toml`) | Só o Codex | 59 arquivos, 1,4 MB | Git local sem remoto, um commit só (19/10) |
| Pasta da frente do adendo, `%LOCALAPPDATA%\vallus-office\frentes\` | Só os agentes despachados pelo escritório | Ainda não existe | Fora do Git, sem backup |
| Pasta de notas do app do Claude (`side-session-notes`) | Só sessões Claude do mesmo grupo | — | Fora do Git |

Quatro detalhes que mudam o desenho:

- **A memória do Claude é por pasta, e não por PO.** Os worktrees do `grc-saas` não ganham memória própria e usam a do
  `grc-saas`. Mas a sessão que começa em `C:\dev\vallus-office` lê uma memória vazia (0 arquivos), embora a memória do
  escritório exista: ela mora na do `grc-saas` (`project_the_office_by_vallus.md`). Há também memórias separadas em
  `C:\dev` (27 arquivos), na pasta de desenvolvimento do OneDrive (24) e no `vallus-site` (5). O Claude não compartilha
  contexto nem consigo mesmo entre pastas.
- **O Codex tem a memória dele, que o Claude não lê.** A frase "o Codex não lê a memória" é metade do problema: são dois
  silos, e não um. A memória do Codex parou de mudar em 19/10, embora o registro do Codex mostre uso até 26/10; o
  motivo não foi investigado.
- **O `vallus-office` não tem `AGENTS.md`.** Tem só `CLAUDE.md`. O Codex lê `AGENTS.md`; aberto no `vallus-office`, ele
  não recebe hoje nenhuma instrução do projeto. O ponteiro pedido para o `AGENTS.md` do `vallus-office` exige criar o
  arquivo.
- **As mesas do escritório são clones do `grc-saas`.** Um ponteiro no `AGENTS.md` do `grc-saas` chega também aos agentes
  das mesas, onde o Toby nega leitura fora da mesa (spec principal, 11.3a). Sem cuidado, todo despacho viraria uma
  pergunta em "Esperando você".

### 1.3 Descoberta material: a memória de hoje não pode ir inteira para um repositório

A varredura por padrões na memória do Claude (sem abrir o conteúdo além do necessário para classificar) achou:

- 2 arquivos sobre um parceiro (aqui, Parceiro A) com o id da organização dele em produção e o nome de usuário de um
  administrador do parceiro, além da reconstrução do que esse usuário fez em produção;
- 5 arquivos com ids no formato dos ids de organização e de registro em produção;
- 235 arquivos com `originSessionId` no cabeçalho, em UUID, o mesmo formato do id de usuário em produção
  (`Profile.id` = `auth.users.id`);
- 3 arquivos com e-mails de domínio pessoal;
- nenhuma senha nem chave (a única ocorrência com cara de chave era o texto `task-…`, falso positivo).

Consequências:

- Migrar a memória é triagem, arquivo por arquivo, e não cópia.
- A regra "nunca entra dado de cliente" precisa valer para o que a sessão manual escreve. A INV-3 do adendo cobre o
  caminho da Pam (etiqueta `origem/externa`, D8), e os arquivos do Parceiro A mostram que é a sessão manual quem escreve
  esse tipo de dado.
- Regex pega e-mail, CPF, CNPJ e chave. Não pega prosa de cliente ("o parceiro disse que..."). Esse resto é regra e
  revisão, não trava.

### 1.4 O que já está decidido

No adendo, em 05/11 **(decisão do PO)**:

- **D9:** um repositório privado de contexto, neutro e versionado, como frente própria; a pasta da frente do adendo
  "passa a morar nele ou a apontar para ele" (adendo, 6.2).
- **D7:** o escritório escreve a memória em campos (`feito`, `decisoes`, `descartado`, `pendencias`, adendo 4.11),
  grava como texto, sem o filtro de conteúdo do cartão e só com o filtro de segredo, e escreve ele mesmo a entrada do
  turno cortado, com o motivo, a ferramenta, o modelo e o estado da mesa no corte (adendo, 4.10).
- **D3:** o isolamento das mesas fica como risco aceito até a fase remota, com o alcance registrado.
- **D8:** cartão de origem externa leva a etiqueta `origem/externa` e só ganha pasta depois de "Liberar para a esteira".

Fora do adendo, no pedido desta spec: sem dado de cliente e sem segredo, com histórico e backup.

Sobre o vídeo (Murilo, Zas OS): o adendo registra pastas com descrição e memória, "legíveis por qualquer ferramenta e
por qualquer editor" (1.2), e a "saída fácil" (4.10). Que o vídeo guarda isso versionado no Git vem do resumo da sessão
que pediu esta spec; não foi conferido na transcrição. O Git, aqui, vale por ser decisão do PO (D9).

### 1.5 O que a premissa não decide

Nome e dono do repositório, o que conta como dado de cliente, o destino de cada silo de memória, quem faz push, onde fica
o ponteiro, quando uma sessão manual abre uma frente e como a D7 convive com "sem dado de cliente". O PO decidiu cada uma
em 2026-11-05 (seção 2).

---

## 2. Decisões do PO

O PO decidiu as treze perguntas em 2026-11-05, todas pela recomendação do Claude. A QC11, a QC12 e a QC13 foram achadas
ao revisar a spec antes do primeiro commit. Cada item guarda a pergunta, a decisão com as palavras do PO e o que ficou
descartado. As demais escolhas desta spec são técnicas, estão marcadas como escolha do Claude e o PO pode vetar.

- **QC1. Nome, dono e lugar. Decisão do PO (2026-11-05): "vallus-contexto, privado".** O repositório é
  `carrascocortes/vallus-contexto`, privado, clonado em `C:\dev\vallus-contexto`. Trocar o nome depois custa um PR em
  cada um dos dois `AGENTS.md` e uma mudança à mão nos arquivos globais das ferramentas, nas configurações de permissão
  (seção 4.4) e na tarefa agendada (seção 4.6).
- **QC2. O que conta como dado de cliente aqui. Decisão do PO (2026-11-05): "Só pseudônimo".** Nunca entra nome, e-mail
  ou usuário de pessoa do cliente, nenhum id de produção (organização, usuário, registro) e nenhum texto escrito pelo
  cliente, nem citado. A empresa cliente ou parceira aparece só por pseudônimo estável ("Parceiro A"), e a tabela que
  liga pseudônimo a nome fica fora do repositório. Descartado: permitir o nome da empresa, que faria o repositório dizer
  quem são os clientes.
- **QC3. A memória do Claude migra ou é espelhada. Decisão do PO (2026-11-05): "Migra por triagem".** Cada arquivo vai
  para a frente dele, para as lições compartilhadas, fica na ferramenta (o que é só do Claude) ou é descartado; o que
  sai da memória do Claude sai de lá (seção 4.7). Descartados:
  - **junção:** a pasta da memória do Claude virar uma junção do Windows para uma pasta do repositório. A memória
    automática gravaria sem filtro (o caso do Parceiro A), e o formato ficaria preso ao do Claude, que pode mudar sem
    aviso;
  - **espelho:** um script copiar a memória para o repositório. Seriam duas cópias que divergem, e o script copiaria dado
    de cliente sem ver.
- **QC4. A memória do Codex. Decisão do PO (2026-11-05): "Manter como cache".** Fica ligada, como cache privado do Codex,
  sem migrar: ela é gerada pela ferramenta, sem controle do que guarda, e está parada desde 19/10. Uma leitura única
  pesca pendências de frentes ainda abertas. Descartado: desligar `features.memories`.
- **QC5. Quem faz push. Decisão do PO (2026-11-05): "Tarefa agendada".** Uma tarefa agendada do Windows, a cada hora,
  com uma chave de deploy que só escreve neste repositório. Não depende do escritório estar aberto e não é agente. O push
  deste repositório deixa de pedir o ok do PO a cada vez: é uma exceção à regra da casa, restrita a este repositório e
  ao main sem push forçado. Nenhuma sessão nem agente faz push. Descartados: o escritório com a App dele instalada aqui
  (o backup pararia com o escritório fechado) e o PO à mão.
- **QC6. Onde fica o ponteiro. Decisão do PO (2026-11-05): "AGENTS.md + globais".** No `AGENTS.md` do `grc-saas` e do
  `vallus-office`, e o mesmo texto nos arquivos globais das ferramentas (`C:\Users\cesar\.claude\CLAUDE.md` e
  `C:\Users\cesar\.codex\AGENTS.md`), porque o PO também abre sessões em `C:\dev`, no `vallus-site` e no OneDrive
  (seção 1.2).
- **QC7. Quando uma sessão manual abre uma frente. Decisão do PO (2026-11-05): "Arquivo, commit ou 1h".** Toda sessão que
  grava arquivo em repositório, faz commit ou passa de uma hora abre ou entra numa frente. Uma pergunta rápida não abre
  frente.
- **QC8. A D7 contra "sem dado de cliente". Decisão do PO (2026-11-05): "Passa pela trava".** A D7 manda gravar a
  memória do escritório só com o filtro de segredo; com a memória indo para o GitHub, a regra de dado de cliente (QC2)
  também vale para ela. A entrada do escritório passa pela mesma trava de dado de cliente do repositório (seção 4.5); a
  entrada que a trava segura não se perde, fica retida no PC e vai para "Esperando você" (seção 4.3). Isso não traz de
  volta o filtro de conteúdo do cartão (menção, imagem, tag HTML, URL), que a D7 tirou. Descartado: manter a D7 literal,
  com a memória do escritório entrando sem essa trava.
- **QC9. Sessão manual grava a própria entrada. Decisão do PO (2026-11-05): "Grava, com autor".** A D7 recusou o agente
  do escritório escrevendo direto na memória, para que texto de agente não vire instrução sem autor nem conferência
  (adendo, 6.1). Na sessão manual não há escritório no meio: ela grava a própria entrada, com autor, e o que ela escreve
  é dado, não instrução (INV-C3); o PO está no chat e é ele quem dá as ordens. Descartado: só o PO gravar, o que na
  prática faria a memória das sessões manuais não existir.
- **QC10. Onde esta spec é versionada. Decisão do PO (2026-11-05): "No próprio repositório".** No primeiro commit do
  repositório de contexto, em `docs/specs/`, feito pelo PO na F0. Antes dele, a spec ficava na pasta de notas da
  sessão (seção 9). Descartados: `docs/specs/` do `vallus-office` e `docs/specs/parking-lot/` do `grc-saas`.
- **QC11. Decisão falsa gravada no clone. Decisão do PO (2026-11-05): "Aviso também nas decisões".** O `decisoes.md` de
  cada frente registra o que vincula a frente, toda sessão o lê antes de trabalhar (4.2, 4.3), e quem grava é quem está
  com a frente. Os agentes rodam com o mesmo usuário do Windows do PO (D3, aceito), e `C:\dev` dá "Modificar" a todo
  usuário autenticado (adendo, D3). Um agente pode, então, gravar no clone uma decisão falsa assinada "Quem decidiu: PO",
  e o push agendado (QC5) a publica sem o ok do PO. O aviso do CI, que cobria só o `LEIA-ME`, `.githooks/` e
  `.gitattributes`, passa a cobrir também o `decisoes.md` de toda frente e a pasta `decisoes/` (seção 4.5). É detecção
  depois do push, não prevenção: reduz, não fecha (seção 7).
- **QC12. Proteger o próprio CI. Decisão do PO (2026-11-05): "Vigiar e testar na F0".** O aviso roda num workflow do
  próprio repositório, e no push o GitHub roda o workflow do commit enviado. Um commit que apaga o job de aviso junto com
  uma decisão falsa sobe, e nada dispara. O `.github/` entra na lista vigiada (seção 4.5). O aviso pega mudança
  descuidada, não quem quer burlar, e o `gitleaks` do CI cai junto com ele. A documentação do GitHub não confirma por
  escrito o que fecharia isso, então a F0 testa na prática:
  - (a) se a chave de deploy consegue alterar `.github/workflows/`;
  - (b) se o plano da conta tem regra de push por caminho. Se tiver, a regra liga para `.github/**`; ela bloqueia o PO
    também, e o PO a desliga para mudar o CI. Se não tiver, fica registrado como limite.

  **Resultado da F0 (2026-11-06):** (a) a chave altera `.github/workflows/`, porque o push dela com o workflow
  provisório foi aceito; (b) o plano não tem regra de push por caminho, porque a tela de rulesets só oferece branch
  ruleset, tag ruleset e importação. Com o que a F0 testou, nada no GitHub segura um commit da chave em `.github/`, e o
  limite fica registrado. Contra o descuido, a tarefa agendada segura esse commit até o PO conferir (seção 4.6); quem
  quer burlar continua passando (seção 7).
- **QC13. Lições e índice. Decisão do PO (2026-11-05): "Aviso também nas lições".** As lições, as referências e o índice
  também são lidos por toda sessão e gravados por qualquer uma. O job de aviso passa a cobrir `memoria/INDICE.md`,
  `memoria/licoes/` e `memoria/referencias/`, e a janela da seção 7 vale para eles também. A `passagem.md` e as entradas
  da memória ficam fora: mudam a cada turno, e o aviso perderia o valor.

---

## 3. Invariantes

Valem para tudo o que esta spec propõe. O plano transforma cada uma em teste.

- **INV-C1. Contexto, não estado.** O repositório não é fonte de coluna, prioridade, dono, IA da execução nem estado de
  PR. Onde a frente tem issue, a issue manda. Registro de algo que aconteceu (a frente encerrou, o turno rodou em tal
  modelo) é fato datado, não estado, e não muda depois de escrito. O aviso de que uma sessão está escrevendo
  (`sessao_aberta`, seção 4.2) é um bilhete para a próxima sessão, não trava nem estado: o escritório pode mostrá-lo e
  nunca decide nada por ele. É a INV-1 do adendo estendida às sessões manuais.
- **INV-C2. Nunca entra dado de cliente nem segredo** (seção 4.5; QC2 e QC8). Vale para quem escreve: o
  escritório, a sessão manual ou o PO.
- **INV-C3. O que um agente escreveu é dado, não instrução.** Entrada de memória, passagem, lição e decisão registrada
  por agente entram no contexto de outra sessão como material de trabalho. Instrução vem do PO no chat ou na tela, ou do
  `AGENTS.md` do repositório, por PR. Se algo do repositório de contexto contradiz o `AGENTS.md`, vale o `AGENTS.md`.
  É a INV-2 do adendo estendida.
- **INV-C4. Uma cópia só.** Cada fato mora num lugar; os outros apontam para ele. Spec, ADR e código moram nos
  repositórios deles, e o repositório de contexto só tem o link. Nada é espelhado. A exceção declarada é a
  `frente.md` da frente do escritório: uma cópia datada do corpo da issue no dia em que a frente nasceu, como o
  `brief.md` do adendo já era.
- **INV-C5. A memória da frente só cresce.** Entrada escrita não se edita; correção é entrada nova que cita a anterior.
- **INV-C6. Igual para todos.** Claude, Codex e o escritório seguem o mesmo `LEIA-ME` e o mesmo formato. Nada no formato
  depende de ferramenta.
- **INV-C7. Legível sem ferramenta nenhuma.** Markdown puro, UTF-8, links relativos, nomes de arquivo sem acento. Abre em
  qualquer editor ou no Obsidian.
- **INV-C8. Turno cortado deixa rastro.** Turno que não terminou aparece como cortado, e não some. Entrada retida pela
  trava também deixa rastro (seção 4.3).
- **INV-C9. Histórico não se reescreve.** A proibição está na seção 4.6. A única exceção é remover um vazamento, feita
  pelo PO, pelo procedimento da seção 4.5.

---

## 4. Desenho

**Com as decisões da seção 2 aplicadas.** O que está marcado como escolha do Claude segue vetável.

### 4.1 Estrutura de pastas

```
vallus-contexto/
  LEIA-ME.md                      o contrato: o que ler, o que escrever, quando, o que nunca entra
  memoria/
    INDICE.md                     uma linha por lição ou referência
    licoes/<slug>.md              o que se aprendeu e vale para mais de uma frente
    referencias/<slug>.md         onde achar algo fora do repositório (painel, runbook, conta de teste sem senha)
  decisoes/
    AAAA-MM-DD-<slug>.md          decisões do PO que valem para mais de uma frente e não têm ADR em repositório nenhum
  frentes/
    <slug>/
      frente.md                   a descrição: objetivo, aceite, limites, links
      passagem.md                 a passagem de turno vigente
      decisoes.md                 o que o PO decidiu nesta frente, numerado DF-n
      memoria/
        AAAA-MM-DDTHH-MM-<ferramenta>-<autor>.md   uma entrada por turno (2026-11-05T22-10-codex-dinesh.md)
  docs/specs/                     a spec deste repositório (QC10)
  .githooks/pre-commit            a trava de segredo e de dado de cliente (seção 4.5)
  .github/workflows/              o CI: a segunda rede e o aviso (seção 4.5)
  .gitattributes                  LF em tudo
```

**Escolhas do Claude, vetáveis:**

- **Slug da frente.** Com issue: `<repositório>-<número>` (`grc-saas-1234`), como no adendo. Sem issue:
  `AAAA-MM-DD-<tema>` (`2026-11-05-repositorio-de-contexto`). Quando uma frente sem issue ganha issue, a pasta não muda
  de nome (links quebrariam): `frente.md` ganha o campo `issue:`. O escritório procura primeiro uma `frente.md` com
  aquela issue e só cria pasta nova se não achar.
- **Uma entrada por arquivo, e não um `memoria.md` só.** Várias sessões e o escritório escrevem no mesmo clone. Arquivo
  por entrada não tem conflito de escrita e dispensa o `memoria-arquivo.md` do adendo: o despacho leva as últimas N
  entradas. No nome do arquivo, `<ferramenta>` é o executor real e `<autor>` é o personagem do escritório ou
  `sessao-manual`.
- **Frente encerrada fica no lugar.** `frente.md` ganha `encerrada: <data>`. Mover a pasta quebraria links. Na frente com
  issue, o escritório escreve esse campo quando a issue fecha, como registro, e nunca decide nada por ele (INV-C1).

### 4.2 Contrato de cada arquivo

| Arquivo | Quem escreve | Quando | Muda depois? | Teto |
|---|---|---|---|---|
| `LEIA-ME.md`, `.githooks/`, `.gitattributes`, `.github/` | Só o PO | Raramente | Sim; o CI avisa o PO de toda mudança (seção 4.5; QC12 para o `.github/`) | 80 linhas no `LEIA-ME` |
| `frente.md` | Quem abre a frente; o escritório, a partir do corpo da issue | Na abertura | Sim, e a mudança de objetivo ou aceite gera entrada na memória | 60 linhas |
| `passagem.md` | A sessão ou o escritório que está com a frente | Ao abrir, a cada marco e ao fechar | Sim, é sobrescrito; o Git guarda as versões. Fora do aviso do CI (QC13) | 40 linhas |
| `memoria/<entrada>.md` | O escritório, pelos agentes dele (D7); a sessão manual, sobre o próprio turno (QC9) | Ao fim do turno, ou quando o turno é cortado | Nunca. Fora do aviso do CI (QC13) | 40 linhas |
| `decisoes.md` da frente | Quem estava com a frente quando o PO decidiu | Na hora | Só acréscimo; a única edição é a marca "substituída por DF-n". O CI avisa o PO de toda mudança (QC11, seção 4.5) | — |
| `decisoes/<decisão>.md` | Idem, para decisão que vale para mais de uma frente | Na hora | Só a marca "substituída por". O CI avisa o PO de toda mudança (QC11) | 30 linhas |
| `memoria/INDICE.md`, `memoria/licoes/` e `memoria/referencias/` | Qualquer sessão; o PO aprova na revisão periódica | Quando a lição aparece | Sim (é conhecimento, não registro). O CI avisa o PO de toda mudança (QC13) | 40 linhas por lição |

**`frente.md`**

```
---
frente: grc-saas-1234
titulo: Arquivar indicador
criada: 2026-11-05
repositorios: [grc-saas]
issue: carrascocortes/GRC-SaaS#1234        # opcional; quando existe, é a fonte do estado
copiado_da_issue_em: 2026-11-05            # só na frente do escritório (INV-C4)
encerrada:                                  # data, quando encerrar
---
## Objetivo
## Aceite
## Limites                                  # fora de escopo, o que não tocar
## Onde está o trabalho                     # spec, branch, worktree e PR, só como links
```

Na frente do escritório, o corpo vem do corpo da issue e substitui o `brief.md` do adendo. Vale a INV-3 do adendo: o
cartão com a etiqueta `origem/externa` não ganha `frente.md` até o PO usar "Liberar para a esteira" (D8). A Q1 da spec
principal não tira a etiqueta: ela muda quem pode ler o texto, não o que pode entrar neste repositório (QC2).

**`passagem.md`**

```
---
atualizada: 2026-11-05T21:40-03:00
por: claude-code · claude-opus-5-5          # ou codex · k3.1-pro, ou Dinesh (escritório) · codex · kimi-for-coding
sessao: <id>                                 # o único campo onde o UUID é aceito (seção 4.5)
sessao_aberta: sim                           # bilhete, não trava (INV-C1)
---
## Onde parou
## Próximo passo
## Estado do código        # branch, git status, commits locais, PR, worktree, cada um com link ou SHA
## Não fazer               # o que já se sabe que dá errado
## Esperando o PO
```

É o cursor da frente e o arquivo que salva o trabalho se a sessão cair: por isso se reescreve a cada marco, e não só no
fim. O id da sessão, no campo `sessao:`, permite ao PO retomar a sessão da ferramenta se quiser; não é segredo. Na
frente do escritório, o escritório a reescreve ao fim de cada turno a partir das `pendencias` e do estado da mesa, para
que uma sessão manual consiga pegar a frente. Ele a reescreve depois do commit da entrada: se a entrada foi retida, a
passagem não leva o texto das `pendencias`, só a nota de que estão retidas (seção 4.3).

**Entrada da memória**

```
---
data: 2026-11-05T22:10-03:00
autor: sessão manual                          # ou o personagem do escritório
ferramenta: claude-code                       # o executor real: claude-code | codex; o personagem vai em autor
modelo: claude-opus-5-5                       # o modelo observado, não o pedido
sessao: <id>                                  # o único campo onde o UUID é aceito (seção 4.5)
desfecho: concluido                           # concluido | cortado | retido | migrado | registro (não é turno: a nota de visitante do adendo, 4.12)
motivo:                                       # quando não é concluido: cota, prazo, disjuntor, suspensão, reinício, sessão morta
---
## Feito
## Decisões
## Descartado                                 # o que tentou e descartou, com o motivo
## Pendências
## Estado no corte                            # só quando cortado: git status e commits locais
```

Os quatro campos são os da D7 e do contrato de devolução do adendo (4.11); o escritório os grava como texto, como o
agente devolveu. Na entrada do turno cortado, o escritório escreve o motivo e o estado da mesa (adendo, 4.10). O modelo
é o observado no turno (`turn_context.model` no Codex), como manda o `ciclo-agentes.md`.

**Decisões da frente (`decisoes.md`)**

```
## DF-3 · 2026-11-05 · Uma entrada por arquivo
Quem decidiu: PO | escolha do Claude não vetada pelo PO
Decisão, em uma a três frases.
Origem: resposta em Esperando você | chat da sessão, citado pela entrada do turno (memoria/<entrada>.md)
Substituída por: —
```

O campo `decisoes` da entrada registra o que o agente diz ter decidido no turno. O `decisoes.md` registra só o que
vincula a frente: a resposta do PO (pela tela ou no chat) e a escolha vetável que o PO não vetou. O prefixo DF evita a
colisão com as D1 a D9 do adendo. Na frente do escritório, o escritório grava ali as respostas do PO em "Esperando
você". Decisão de arquitetura de um repositório vira ADR naquele repositório, no mesmo PR; aqui fica só o link
(INV-C4). Como toda sessão lê o `decisoes.md` antes de trabalhar e qualquer processo do usuário do PO consegue gravar
nele, todo commit que toca um `decisoes.md` ou a pasta `decisoes/` dispara o aviso do CI (QC11, seção 4.5).

**Lição e referência** usam o formato que a memória do Claude já usa, porque ele funciona: `name`, `description` e
`tipo` no cabeçalho, mais `sessao:` quando a lição veio migrada com o `originSessionId` (seção 4.7); no corpo, o fato, **Por quê** e **Como aplicar**. O `INDICE.md` tem uma linha por arquivo, e o
pre-commit recusa lição sem linha no índice. Lição que deve virar regra sobe para o `AGENTS.md` do repositório certo,
por PR (INV-C3). Toda mudança em lição, referência ou índice dispara o aviso do CI (QC13).

### 4.3 Protocolo do turno

**Sessão manual (Claude ou Codex):**

1. **Abrir.** Achar a frente (o PO a nomeia, ou a sessão procura em `frentes/`) ou criar uma (QC7: quando a sessão grava
   arquivo em repositório, faz commit ou passa de uma hora). Ler `LEIA-ME.md`, `memoria/INDICE.md`, `frente.md`,
   `passagem.md`, `decisoes.md` e as três últimas entradas. Entradas mais antigas, só se precisar.
2. **Conferir o bilhete.** Se `passagem.md` diz `sessao_aberta: sim` e foi outra sessão, a sessão nova só lê e pergunta
   ao PO. Se o PO diz que a outra morreu, a sessão nova escreve por ela uma entrada com `desfecho: cortado`, motivo
   "sessão morta" e o estado do código tirado do Git, e assume. Um escritor por frente, por combinação com o PO.
3. **Marcar.** Reescrever `passagem.md` com `sessao_aberta: sim` e a identificação da sessão.
4. **Marcos.** A cada commit, PR, decisão ou antes de comando longo, reescrever `passagem.md`. Decisão do PO entra em
   `decisoes.md` na hora.
5. **Fechar.** Escrever a entrada do turno, reescrever `passagem.md` com `sessao_aberta: não` e fazer commit.

**Agente do escritório:** o escritório faz os passos por ele. No início do turno, copia `frente.md`, `passagem.md`,
`decisoes.md` e as últimas entradas para a pasta de cópia da mesa (adendo, 4.9). Ao fim, grava a entrada com os campos
do contrato de devolução e reescreve a passagem. Se o turno não terminou, grava `desfecho: cortado` com o motivo e o
estado da mesa (D7). O agente não toca o repositório: o Toby nega leitura fora da mesa, e a seção 4.4 fecha o caminho
que sobra.

**Entrada retida (QC8):** se o pre-commit recusa a entrada, ela não se perde. O mesmo vale para a `passagem.md`, que
leva as `pendencias` do turno.

- **Quem move é a própria trava (escolha do Claude, vetável).** O pre-commit recusa o commit, move o arquivo barrado
  para `%LOCALAPPDATA%\vallus-office\retidas\`, grava no lugar dele um esboço sem o texto e diz para repetir o commit.
  Na entrada, o esboço é `desfecho: retido`, com o autor, a data e o motivo da trava; na passagem, só o cabeçalho e a
  nota de retida. O commit repetido leva só o esboço. É igual nos dois
  caminhos, o do escritório e o da sessão manual, e nenhuma sessão ganha permissão em `retidas\`. A pasta tem ACL só do
  usuário do PO.
- A retida nunca fica em `frentes/`: a sessão seguinte lê as três últimas entradas do disco e leria o texto retido.
- **O `LEIA-ME` diz que nenhuma sessão lê `retidas\`,** salvo quando o PO pede ajuda para reescrever uma retida.
- **Limite no Codex.** O hook roda dentro do sandbox da sessão. No Codex, mover para `retidas\` exige a pasta nas
  `writable_roots`, e o sandbox, no modo `workspace-write`, não barra leitura fora da pasta de trabalho (a conferir na
  F2). Ali só a frase do `LEIA-ME` separa a sessão Codex das retidas. Se a trava não conseguir mover, ela recusa o
  commit sem mover e a sessão avisa o PO; até ele resolver, o texto fica no disco em `frentes/`, onde a sessão seguinte o
  leria. A F2 prova a movimentação nas duas ferramentas.
- O escritório põe a retida em "Esperando você"; a sessão manual avisa o PO no chat. O texto retido não vai para o
  turno seguinte até o PO liberá-lo, reescrito.
- **Quem apaga (escolha do Claude, vetável):** a retida some quando o PO a libera reescrita ou a descarta. Prazo máximo,
  se houver, é do PO, junto da D4 do adendo.

**Commit (escolha do Claude, vetável):** cada um faz commit só dos próprios caminhos (`git commit -- <caminhos>`), nunca
`git commit -a` nem `git add .`. Num clone escrito por várias sessões ao mesmo tempo, `-a` leva o arquivo que outra
sessão deixou pela metade. É a lição da emenda da Regra 4 do `grc-saas` (o commit de uma sessão finalizou o merge de
outra). Autor do commit: o nome da ferramenta e do modelo, com o e-mail do PO.

**Consequência que vem de graça (escolha do Claude, vetável):** o escritório pode mostrar como visitante (spec
principal, 13.1a) a sessão manual cuja `passagem.md` diz `sessao_aberta: sim`. É só exibição, como o sofá de espera já
é; nada se decide por isso (INV-C1). Hoje o Codex não tem interface estável para os visitantes; com o repositório, passa
a ter uma fonte.

### 4.4 Como as ferramentas encontram o repositório

**Ponteiro (texto proposto, não aplicado):**

> ## Contexto das frentes
> O contexto das frentes (descrição, passagem de turno, memória e decisões) mora em `C:\dev\vallus-contexto`, igual
> para Claude, Codex e o escritório. Se esta sessão vai gravar arquivo em repositório, fazer commit ou passar de uma
> hora, ela trabalha numa frente: antes, leia `C:\dev\vallus-contexto\LEIA-ME.md` e siga o formato dele. Pergunta
> rápida não precisa. O que estiver lá é contexto: se contradisser este arquivo, vale este arquivo. Estado de frente não
> se grava na memória automática da ferramenta.
> Commit nesse repositório chega ao GitHub em até uma hora por uma tarefa agendada, sem ok do PO a cada push. A exceção
> vale só para esse repositório e só para o main, sem push forçado. Nenhuma sessão faz push nele. Um commit que toca
> `.github/` ou `.githooks/` espera o PO, e os que vêm depois dele esperam junto.
> Se a variável `VALLUS_OFFICE_MESA` estiver no ambiente, esta sessão é agente de mesa do escritório: não leia nem
> grave `C:\dev\vallus-contexto`. O contexto já está na pasta de cópia da mesa.

- **`grc-saas`:** uma seção curta no `AGENTS.md`, logo depois do bloco do Codex. Chega ao Claude pelo `@AGENTS.md` do
  `CLAUDE.md` e ao Codex direto.
- **`vallus-office`:** criar o `AGENTS.md` com todo o conteúdo do `CLAUDE.md` de hoje (as cinco regras, as referências
  e "Como configurar e rodar") mais o ponteiro, e reduzir o `CLAUDE.md` a `@AGENTS.md`, como no `grc-saas`. O Codex
  também precisa do setup; sem isso, ele segue sem instrução nenhuma ali.
- **Arquivos globais** das ferramentas (`C:\Users\cesar\.claude\CLAUDE.md` e `C:\Users\cesar\.codex\AGENTS.md`), com o
  mesmo texto, inclusive a frase final sobre a mesa (QC6).
- **Um mecanismo só para o agente de mesa: a frase final do ponteiro (escolha do Claude, vetável).** As mesas são clones
  do `grc-saas` e leem o mesmo `AGENTS.md`. O escritório põe `VALLUS_OFFICE_MESA` no ambiente de cada despacho
  (adendo, 4.9). O nome fica fixado aqui, e não na construção, porque o ponteiro precisa citá-lo. O agente que obedece à
  frase não abre o repositório, nem o `LEIA-ME`.
- **A fonte `user` do Claude na mesa (escolha do Claude, vetável).** O adendo (4.7) tira da mesa só as fontes `project` e
  `local` (`--setting-sources`). A fonte `user` continua: ela traz o `CLAUDE.md` global, com o ponteiro, e as
  `permissions.additionalDirectories` que a F2 grava nas configurações do usuário. Sem mais nada, o Claude da mesa lê e
  grava `C:\dev\vallus-contexto` sem passar pelo Toby. Por isso o `--settings` do escritório nega explicitamente
  `C:\dev\vallus-contexto` e `%LOCALAPPDATA%\vallus-office\retidas\`.
  - A regra de negação governa as ferramentas de arquivo (Read, Write, Edit). O Bash e o PowerShell nesses caminhos são
    barrados pelo Toby.
  - A sonda da INV-7 do adendo tenta ler e gravar os dois caminhos por Read, Write ou Edit, Bash e PowerShell. Cada
    caminho vai expandido (sem `%LOCALAPPDATA%`) e com as duas barras (`\` e `/`), e cada tentativa tem de ser negada.
    Reduz, não fecha: um caminho escrito de um jeito que a sonda não testa pode passar.
- **O Codex da mesa** roda com um `CODEX_HOME` próprio do escritório (spec principal, 11.3a). Isso isola a
  configuração: ele não lê o `AGENTS.md` global nem as `writable_roots` do PO, e lê o `AGENTS.md` da mesa, onde vale a
  frase final. A leitura fora da mesa depende do hook PreToolUse do Toby (adendo, 4.7) e da sonda, com as mesmas
  tentativas.

**Permissões, a conferir em cada ferramenta (escolha do Claude, vetável):**

- **Claude Code:** o repositório fica fora da pasta de trabalho das sessões. Para ler e escrever sem pedido de
  permissão, ele entra em `permissions.additionalDirectories` das configurações do usuário. `retidas\` não entra: quem
  move para lá é a trava (seção 4.3). O hook `github-write-guard` não atrapalha: commit passa, push é negado ou
  perguntado, e nesta spec nenhuma sessão faz push.
- **Codex:** no modo `workspace-write`, o sandbox só escreve na pasta de trabalho. O repositório entra em
  `writable_roots`, e `retidas\` também, só para a trava conseguir mover a entrada barrada; é o limite da seção 4.3. O
  sandbox do Codex no Windows não foi verificado nesta máquina (adendo, D3).
- **Escritório:** o processo Node lê e escreve o repositório. O repositório nunca vira mesa nem é clonado numa mesa,
  como o `vallus-office` e a pasta de dados (adendo, 4.8).

### 4.5 O que nunca entra, e como se garante

**Nunca entra (QC2):**

- **Dado de cliente:** nome, e-mail, telefone ou usuário de pessoa do cliente ou do parceiro; CPF e CNPJ; id de
  produção (o de organização e de registro, e o de usuário, que é UUID); texto escrito pelo cliente, nem citado; o nome
  da empresa cliente ou parceira, que aparece só por pseudônimo estável, também em nome de arquivo. Inclui o que a INV-3
  do adendo já proíbe.
- **Segredo:** chave de API, token, senha (também de conta de teste, como a casa já manda), string de conexão com
  senha, cookie e token de sessão, chave PEM, conteúdo de `.env*`, valores do cofre do escritório (a chave da App, a da
  API da Anthropic, a do Kimi e, quando entrar, o token da Vercel), segredo de bypass da Vercel.
- **O que tem casa própria:** código, spec, ADR, runbook (moram nos repositórios); estado do trabalho (issue e banco
  local); saída bruta das execuções e artefatos do QA (ficam no PC, seção 4.8).

**Pode entrar:** ref de projeto do Supabase e nome de conta de seed, que já estão no `AGENTS.md`; id de sessão de
ferramenta, só no campo `sessao:` do cabeçalho; SHA, número de PR e de issue; os ids numéricos da App (o adendo já diz
que não são segredo); o e-mail do PO como autor de commit.

**Camadas (escolha do Claude, vetável):**

1. **Regra no `LEIA-ME`,** com exemplos do que não pode ("o Parceiro A pediu..." sim; o nome do usuário do parceiro,
   não).
2. **Pre-commit** em `.githooks/` (ativado por `core.hooksPath` uma vez no clone): `gitleaks` para segredo, e padrões
   próprios para CPF, CNPJ, e-mail fora de uma lista (domínios da casa, o do PO e `noreply`), id de produção e nome de
   arquivo com acento. Pular o hook é proibido, como já é no `grc-saas`. O `gitleaks` local ainda não foi conferido
   nesta máquina.
   - **Id de produção:** o padrão cobre o formato dos ids de organização e de registro e o UUID. O UUID é aceito só no
     campo `sessao:` do cabeçalho e barrado no resto, porque o id de sessão das ferramentas tem o mesmo formato do id de
     usuário em produção. Para a trava:
     - o cabeçalho é só o bloco entre o `---` da primeira linha do arquivo e o `---` seguinte;
     - `sessao:` aparece no cabeçalho no máximo uma vez, com exatamente um UUID, e a linha inteira tem de casar com o
       formato do campo;
     - fora do cabeçalho, todo UUID é barrado, inclusive numa linha `sessao:` no corpo ou num segundo bloco `---` no meio
       do arquivo;
     - o campo vale em entradas, passagens, lições e referências, porque a migração leva o `originSessionId` para ele
       (seção 4.7).
   - **Falso positivo:** resolve-se com exceção por arquivo e por hash do conteúdo, gravada em `.githooks/` e coberta
     pelo aviso do CI, e nunca afrouxando o padrão. Tirar ou afrouxar o padrão de id é decisão do PO (QC2); a F3 leva a
     ele o número de falsos positivos no conteúdo migrado.
   - **A tarefa agendada confere a trava:** antes de cada push, ela verifica que `core.hooksPath` vale `.githooks`. Se
     não valer, não empurra e avisa o PO. Essa conferência pega descuido; um hook alterado é pego pelo aviso em
     `.githooks/` e pelos padrões que o CI roda (camada 4). Reduz, não fecha.
3. **Filtro do cofre** do escritório antes de gravar a entrada, como a D7 manda.
4. **CI do repositório**, a cada push:
   - roda os mesmos padrões do pre-commit, e não só o `gitleaks` padrão, como segunda rede;
   - avisa o PO (o job falha) a cada commit que toca um caminho vigiado: `LEIA-ME.md`, `.githooks/`, `.gitattributes` e
     `.github/` (QC12); o `decisoes.md` de toda frente e a pasta `decisoes/` (QC11); `memoria/INDICE.md`,
     `memoria/licoes/` e `memoria/referencias/` (QC13). A `passagem.md` e as entradas da memória ficam fora: mudam a
     cada turno, e o aviso perderia o valor (QC13);
   - percorre cada commit do intervalo `before..after` do push, e não o último commit nem o diff final. Com `before`
     zerado (o primeiro push do repositório ou uma branch nova), varre todo commit alcançável a partir de `after`. A
     tarefa empurra de hora em hora, então um push leva vários commits, e um commit seguinte pode apagar o que o anterior
     trouxe. É a mesma lição da INV-4 do adendo.

   **Limites:** é detecção depois do push, não prevenção. Quem escreve no clone consegue mudar esses arquivos, e as
   sessões os leem antes de o aviso existir (seção 7). No push, o GitHub roda o workflow na versão do commit enviado, e
   o push pela chave de deploy dispara o workflow (documentação do Actions e aba Actions, seção 6): um commit que apaga
   o job de aviso junto com a mudança que ele avisaria sobe sem disparar nada, e o `gitleaks` do CI cai junto (QC12).
   Se o CI ler os padrões de `.githooks/`, uma mudança ali enfraquece o pre-commit e o CI juntos; é mais um motivo para
   a tarefa reter o commit em `.githooks/` (seção 4.6). O aviso pega mudança descuidada, não quem quer burlar. A F0
   mostrou que a chave de deploy altera o workflow e que o plano não tem regra de push por caminho; com o que ela
   testou, nada no GitHub reduz isso (QC12). O push protection de segredo do GitHub em repositório privado pessoal pode
   ser pago; fica para o checklist de fornecedor (skill `fornecedor`), e não se conta com ele.
5. **Revisão periódica do PO** sobre as lições e uma amostra das entradas. É a única camada que pega prosa de cliente.

**Se vazar:** segredo é tratado como comprometido e rotacionado na hora, antes de qualquer limpeza. Tirar do histórico
exige reescrever o main e forçar o push, um ato do PO com a proteção do main desligada por alguns minutos (INV-C9). O
clone local e o GitHub guardam a versão vazada até lá: é por isso que o pre-commit é a camada que importa.

### 4.6 Histórico e backup

- **Histórico:** o Git. Commits pequenos, um por marco ou por entrada, autor identificando ferramenta e modelo. Nenhum
  rebase, amend ou push forçado no main.
- **Backup:** o remoto privado `carrascocortes/vallus-contexto` no GitHub (QC1), com o main protegido contra push
  forçado e contra deleção. A F0 conferiu: o ruleset `main` recusa o push forçado. A deleção do main é recusada pela
  trava da branch padrão do GitHub antes de chegar ao ruleset, então a regra de deleção do ruleset não foi exercida;
  ela só pesa se a branch padrão mudar.
- **Push (QC5):** uma tarefa agendada do Windows, a cada hora, com uma chave de deploy que só escreve neste repositório.
  A perda máxima com o disco perdido é a última hora de commits, ou, com um commit retido pela trava de `.github/` e
  `.githooks/` (abaixo), tudo desde o último push. O `LEIA-ME` e o ponteiro (seção 4.4) registram a exceção: o commit
  neste repositório chega ao GitHub em até uma hora, sem ok do PO a cada push, só neste repositório e só no main, sem
  push forçado, salvo o que espera atrás de um commit retido. Sem ADR. **Escolhas do Claude, vetáveis:**
  - a chave e o script da tarefa ficam no perfil do PO, fora de `C:\dev` e do clone, no mesmo lugar e com a mesma ACL,
    só do usuário dele;
  - a tarefa empurra só o main; o ruleset `so-main` barra criar branch, e a F0 provou que a chave não cria outra;
  - antes de empurrar, a tarefa confere o `core.hooksPath` (seção 4.5);
  - a tarefa fala com o GitHub só pela chave, com um `known_hosts` próprio na mesma pasta e sem ler o `~/.ssh`;
  - quando o push falha, inclusive por histórico divergente ou por regra do GitHub, ou quando a tarefa retém um commit,
    ela avisa o PO. O canal do aviso fica para a construção, mas tem de chegar ao PO, e não só a um log: com um commit
    retido, só o PO destrava o backup;
  - a tarefa tem um disparo manual de teste, que empurra para o repositório descartável da F1, e nunca para o main, o
    que leva valor plantado (seção 6).
- **Mudar o CI (QC12; escolha do Claude, vetável).** A F0 mostrou que o plano não tem regra de push por caminho: não há
  regra para desligar e religar, e, com o que a F0 testou, nada no GitHub segura um commit da chave em `.github/`. No
  lugar da regra, a tarefa não empurra commit que toque `.github/` ou `.githooks/`:
  - ela empurra só até o commit anterior e avisa o PO;
  - o histórico é uma linha só, então todo commit posterior ao retido, de qualquer frente, espera junto, e o prazo
    passa a ser o do PO;
  - o PO confere os commits retidos e empurra com o próprio login até o último que conferiu, pelo SHA dele
    (`<sha>:main`), e não o HEAD, se houver commit não conferido depois; daí em diante a tarefa volta a empurrar
    sozinha;
  - a retenção se repete a cada mudança em `.githooks/`, inclusive a exceção de falso positivo da seção 4.5;
  - vale também para os commits da F1 que criam o pre-commit e que trocam o workflow provisório da F0 pelo de verdade.

  Essa trava mora no script da tarefa, que um agente do mesmo usuário altera (D3), e a chave empurra sem passar por ela:
  pega o descuido, não quem quer burlar. Enquanto um commit está retido, o backup volta a depender do PO, o que a QC5
  quis evitar; a outra saída é a tarefa empurrar tudo e confiar só no aviso do CI, que um commit em `.github/` pode
  apagar.

  **Alternativa avaliada e não adotada (escolha do Claude, vetável): trocar a chave por uma credencial sem a permissão
  de workflows**, um GitHub App só deste repositório ou um fine-grained token sem "Workflows". O GitHub recusa que ela
  crie ou altere arquivo em `.github/workflows/` (documentado para o GitHub App; para o fine-grained token, só relatos).
  Ficam três buracos:
  - nenhuma fonte diz se ela consegue apagar um workflow, e apagar o job de aviso é justamente o ataque da QC12;
  - a recusa não cobre `.githooks/` nem script fora de `.github/workflows/` que o workflow chame;
  - um agente do mesmo usuário (D3) alcança a credencial de login do PO no gerenciador de credenciais do Windows, que
    tem permissão de workflows.

  O ganho sobre a trava da tarefa é pequeno. A troca volta à mesa se a fase remota tirar os agentes do usuário do PO,
  e antes dela um teste num repositório descartável tem de mostrar se apagar workflow é recusado.
- **Um clone só.** Ninguém faz pull: o único clone é o da máquina do PO, e o remoto só recebe. Uma segunda máquina, ou
  o escritório na fase remota, reabre esta seção (merge, conflito, quem puxa).
- **Restauração:** clonar do GitHub e reativar o hook (`git config core.hooksPath .githooks`); o clone novo nasce sem
  ele. O aceite da F4 prova isso rodando no clone novo os casos de pre-commit do teste da F1.
- **O que fica sem backup, de propósito:** a saída bruta das execuções e os artefatos do QA, com a retenção da D4 do
  adendo (seção 4.8); as entradas retidas, até o PO liberar ou descartar (seção 4.3); os commits que esperam atrás de
  um commit retido em `.github/` ou `.githooks/`, até o PO empurrar; e as memórias das ferramentas.

### 4.7 A memória de hoje: migra por triagem (QC3 e QC4)

Pela QC3, cada arquivo de tópico da memória do Claude ganha um destino numa tabela que o PO revisa antes do primeiro
movimento. Na medição de 05/11 eram 251; a pasta muda todo dia, então o N da tabela sai da listagem da pasta no dia em
que ela é montada, menos o `MEMORY.md`, e o relatório informa o N. O índice `MEMORY.md` não migra: é refeito no fim
(abaixo).

| Tipo hoje | Destino | Exemplo |
|---|---|---|
| `project_*` de frente aberta (89 dos 135 não dizem "encerrada" na descrição; a contagem real sai da triagem) | `frentes/<slug>/`: o conteúdo vira `frente.md`, `passagem.md` e uma entrada inicial com `desfecho: migrado` | `project_a2_7_rls_real.md` |
| `project_*` de frente encerrada | Uma entrada só na frente, encerrada; o que já está no `delivery-log` do repositório não se copia (INV-C4) | `project_next_16_4_2.md` |
| `feedback_*` que vale para qualquer ferramenta | `memoria/licoes/` | `feedback_checkout_de_arquivo_apaga_trabalho.md` |
| `feedback_*` que já virou regra no `AGENTS.md` | Descarte, com o link para a regra | — |
| `reference_*` da casa | `memoria/referencias/` | `reference_verus_itest_container.md` |
| Fato só do Claude (comportamento do app, do hook, do harness) | Fica na memória do Claude | `reference_claude_desktop_gpu_crash.md` |
| Arquivo com dado de cliente | Reescrito sem o dado antes de entrar, com o nome do arquivo pseudonimizado, ou fica só na memória do Claude | os do Parceiro A |

Regras da triagem (escolha do Claude, vetável):

- **Provado cobre N.** A tabela tem N linhas, uma por arquivo, e o relatório diz quantos foram para cada destino. As
  memórias das outras pastas (`C:\dev` 27, OneDrive 24, `vallus-site` 5) entram na mesma tabela se o PO quiser.
- **A tabela e os rascunhos ficam fora.** A tabela de triagem e os rascunhos da reescrita trazem nomes de cliente: ficam
  fora do repositório e fora de `C:\dev`, e são apagados ao fim da F3.
- **O `originSessionId`** dos 235 arquivos que o têm vira o campo `sessao:` do cabeçalho ou sai; nunca vai para o corpo.
- **O que migra sai de lá.** Depois do corte, o `MEMORY.md` do Claude guarda só os fatos que são do Claude e uma linha
  apontando para o repositório. Senão são duas cópias, contra a INV-C4.
- **Prova de que o corte pegou:** duas semanas depois, nenhum `project_*` novo na memória do Claude. A memória
  automática vai continuar tentando gravar ali por hábito do harness; o ponteiro manda gravar no repositório.
- **Memória do Codex (QC4):** fica como cache do Codex e não migra. Uma leitura única dos 59 arquivos procura
  pendências de frentes ainda abertas, que vão para a frente certa como entrada `desfecho: migrado`.

### 4.8 A pasta da frente do adendo do projeto 2 (seção 4.10) passa a morar aqui

A pasta do adendo se divide assim:

| Parte | Onde fica | Por quê |
|---|---|---|
| `brief.md` (vira `frente.md`), `memoria.md` (vira `memoria/`), `passagem.md` e `decisoes.md` (novos) | `C:\dev\vallus-contexto\frentes\<repositório>-<issue>\` | É o contexto que as sessões manuais e outras ferramentas precisam ler |
| `execucoes\` e `qa\` | Continuam em `%LOCALAPPDATA%\vallus-office\frentes\<repositório>-<issue>\` | A saída bruta é grande e só fica segura depois do filtro; o trace do QA leva o cookie da conta de teste e não sai do PC (INV-8 do adendo) |
| `retidas\` (nova) | `%LOCALAPPDATA%\vallus-office\retidas\` | A entrada que a trava segurou nunca entra no repositório (seção 4.3) |

O que muda no adendo, para a sessão do projeto 2 aplicar quando o PO aprovar esta spec (esta sessão não escreve no
worktree `v1-1`):

- **4.10, "Onde":** a parte versionada vai para o repositório de contexto; `execucoes\` e `qa\` ficam onde estão, e
  `retidas\` nasce na pasta de dados. A frase "Nenhuma raiz nova" deixa de valer: o escritório passa a ter duas raízes,
  a pasta de dados e o repositório de contexto.
- **4.14:** "Nenhuma mudança cria uma segunda raiz de dados ou um segundo registro" passa a citar a exceção do
  repositório de contexto, que guarda contexto e não estado (INV-C1). O registro de eventos continua um só. Sobre a
  variável que marca o agente de mesa, a 4.14 passa a dizer que o despacho usa o nome fixado na seção 4.4 desta spec
  (`VALLUS_OFFICE_MESA`).
- **4.10, "Na tela":** o manifesto passa a ter uma entrada por raiz. A regra "só entrega arquivo cujo caminho real fica
  dentro da pasta da frente" vale para cada raiz, com o id dizendo a raiz.
- **4.10, `memoria.md`:** vira uma pasta com uma entrada por arquivo, no formato da seção 4.2, que já usa os campos da
  D7 e da 4.11. O teto de tamanho vira "o despacho leva as últimas N entradas", e o `memoria-arquivo.md` some. A
  entrada passa pela trava de dado de cliente, e a retida segue a seção 4.3 (QC8).
- **4.10, "Retenção" (D4):** vale só para `execucoes\` e `qa\`. As retidas seguem a seção 4.3, e o repositório de
  contexto não apaga nada sozinho.
- **4.7 (configuração do Claude fora da mesa):** o `--settings` do escritório nega explicitamente `C:\dev\vallus-contexto`
  e `%LOCALAPPDATA%\vallus-office\retidas\`, porque a fonte `user` continua carregada (seção 4.4). A negação governa as
  ferramentas de arquivo; o Bash e o PowerShell nesses caminhos ficam com o Toby. **INV-7:** a sonda de contenção tenta
  ler e gravar os dois caminhos por Read, Write ou Edit, Bash e PowerShell, com o caminho expandido e com as duas
  barras, no Claude e no Codex, e cada tentativa tem de ser negada.
- **4.9:** a cópia para a mesa leva `frente.md`, `passagem.md`, `decisoes.md` e as últimas entradas, e não mais o brief
  e a memória. O despacho marca o ambiente do agente com `VALLUS_OFFICE_MESA` (seção 4.4).
- **4.6 (tabela "o que mora onde"):** a linha "Contexto e artefatos da frente" se divide nas três partes acima.
- **4.8:** o repositório de contexto entra na lista do que nunca vira mesa.
- **Três obrigações do escritório:** escrever `encerrada` na `frente.md` quando a issue fecha (seção 4.1); reescrever a
  `passagem.md` ao fim de cada turno a partir das `pendencias` e do estado da mesa (seção 4.2); gravar no `decisoes.md`,
  como DF-n, as respostas do PO em "Esperando você" (seção 4.2).
- **INV-1:** passa a citar a INV-C1 desta spec. **INV-3:** vale também para a `frente.md`.
- **INV-4:** continua valendo como está, para a cópia da mesa e o repositório do produto. Acrescenta-se uma frase: a
  pasta da frente passa a ser publicada no repositório privado de contexto, pela tarefa agendada (QC5), nunca pelo
  commit do agente.
- **6.2:** o item "Repositório de contexto neutro e versionado" passa a apontar para esta spec.
- **F1 do projeto 2:** o aceite "um cartão que entra em Spec ganha a pasta" passa a conferir as três partes e o commit
  da parte versionada. Entram também, no despacho de teste:
  - o despacho chega à mesa com `VALLUS_OFFICE_MESA` no ambiente;
  - uma entrada do escritório com um CPF plantado vai para `retidas\`, aparece em "Esperando você", e o repositório
    recebe só a entrada `desfecho: retido`;
  - cada uma das três obrigações do escritório tem o seu caso: a issue fechada grava `encerrada`, o fim do turno
    reescreve a `passagem.md`, e a resposta em "Esperando você" vira um DF-n.

  O resto do aceite fica.

Se o projeto 2 começar antes deste repositório existir, a F1 constrói a pasta local do adendo como está e migra para cá
depois. É o caminho mais caro, e a recomendação é a ordem inversa.

---

## 5. Fora de escopo

- Criar o repositório, editar qualquer `AGENTS.md` ou `CLAUDE.md` e mudar configuração de ferramenta: esta spec só
  desenha.
- Código do escritório: as mudanças do adendo listadas na seção 4.8 são da sessão do projeto 2.
- Contexto por cliente, operação e growth: projeto 4 do escritório, sem Git local para dado de cliente (adendo, 6.2).
- Mais de uma máquina e a fase remota (seção 4.6).
- Investigar por que a memória do Codex parou em 19/10.
- O estado do trabalho: continua nas issues e no banco local do escritório (INV-C1).

---

## 6. Fatias

Cada fatia tem aceite verificável. A ordem importa: a F1 vem antes da F3, para que a trava exista antes do primeiro
conteúdo migrado.

- **F0. Criar o repositório e a chave (PO).** A chave de deploy nasce aqui, e não na F1, onde nasce a tarefa que a usa,
  porque o teste da QC12 precisa dela. Aceite:
  - `carrascocortes/vallus-contexto` existe, privado (QC1); push forçado e deleção do main são recusados pelo GitHub; o
    clone está em `C:\dev\vallus-contexto`;
  - a chave de deploy existe, com escrita só neste repositório, guardada no perfil do PO fora de `C:\dev` e do clone,
    com ACL só do usuário dele;
  - esta spec está em `docs/specs/` no primeiro commit, sem o caminho da pasta de notas, que leva um id em UUID (QC10,
    seção 9);
  - teste empírico da QC12, com o resultado registrado: (a) a chave consegue ou não alterar `.github/workflows/`, com um
    workflow provisório que só imprime uma linha e que a F1 substitui; (b) o plano da conta tem ou não regra de push por
    caminho. Se tiver, a regra está ligada para `.github/**`, com a chave fora da lista de exceções, e um push da chave
    que toca `.github/**` é recusado pelo GitHub; o resultado fica registrado. Se não tiver, o limite está registrado;
  - o plano permite ou não um ruleset que barre criar branch, com o resultado registrado (seção 4.6).

  **Resultado (2026-11-06).** O Claude preparou os dois commits, a chave e a pasta dela; o PO rodou os testes com um
  roteiro que empurra pela chave e cadastrou a chave e os rulesets no GitHub. Todos os aceites foram cumpridos:
  - o repositório existe, privado, com o clone em `C:\dev\vallus-contexto`. O primeiro commit (`281d7a7`) leva esta
    spec, sem nenhum UUID, e subiu com o login do PO;
  - a chave de deploy é ed25519, sem senha, e mora em `%USERPROFILE%\.vallus-contexto\`, fora de `C:\dev` e do clone. A
    pasta tem ACL só do usuário do PO, sem herança. O PO conferiu na tela que a chave foi cadastrada com escrita. Na
    mesma pasta fica o `known_hosts` do GitHub, tirado da API do GitHub e conferido com a página oficial de impressões
    digitais;
  - (a) a chave altera `.github/workflows/`: o push dela com o workflow provisório (`44ead89`) foi aceito;
  - o push forçado no main foi recusado pelo ruleset `main` (`GH013`, "Cannot force-push to this branch");
  - a deleção do main foi recusada pela trava da branch padrão do GitHub ("refusing to delete the current branch"),
    antes de chegar ao ruleset. A regra de deleção do ruleset `main` não foi exercida (seção 4.6);
  - criar branch pela chave foi recusado pelo ruleset `so-main` (`GH013`, "Cannot create ref due to creations being
    restricted"), que vale para toda branch menos o main. Criar tag não foi testado, e um branch ruleset não alcança
    tag (seção 7);
  - (b) o plano não tem regra de push por caminho: a tela de rulesets só oferece "New branch ruleset", "New tag
    ruleset" e "Import a ruleset". O limite fica registrado, e a seção 4.6 diz o que entra no lugar;
  - no fim, o main do GitHub ficou no `44ead89`, igual ao clone, sem branch nem commit de teste sobrando.

  O que a documentação do GitHub diz sobre esses resultados (consultada em 2026-11-06):
  - o evento de push usa o workflow na versão do commit enviado (página "Workflows", seção dos gatilhos), e a página de
    eventos descreve o push feito por chave de deploy disparando o workflow;
  - rulesets de branch e de tag valem em repositório privado de conta pessoal só no plano Pro (pelo relato de um
    usuário, no Free a tela avisa que não serão aplicados). O push ruleset só existe no plano Team, que é de
    organização (seção 7);
  - chave de deploy com escrita age como colaborador e não tem restrição de workflow, o que bate com o teste (a).

  Fora dos aceites, o PO conferiu a aba Actions do repositório no mesmo dia: o workflow provisório `aviso` rodou uma vez
  (execução 1), no push do `44ead89`, no main, e terminou verde em 6 s. O GitHub mostra o push como feito pela conta do
  PO, porque a documentação de eventos atribui o push por chave de deploy ao administrador que a cadastrou. Isso
  confirma neste repositório as duas premissas da seção 4.5: o push pela chave dispara o workflow, e roda o workflow
  do commit enviado, porque antes desse push o main não tinha workflow nenhum.
- **F1. Esqueleto, contrato e tarefa.** `LEIA-ME.md`, estrutura da seção 4.1, `.gitattributes`, pre-commit, CI, modelos
  de `frente.md`, `passagem.md`, entrada, decisão e lição, e a tarefa agendada.
  - **A tarefa nasce aqui** (QC5), com a chave da F0, antes dos aceites que dependem de push: nenhuma sessão faz push. O
    script fica no mesmo lugar e com a mesma ACL da chave (seção 4.6).
  - **Os commits que criam o pre-commit e que trocam o workflow provisório da F0** pelo de verdade seguem o procedimento
    de mudar o CI da seção 4.6: a tarefa os retém, e o PO os empurra.
  - **Pushes de teste com valor plantado** vão para um repositório descartável, com o mesmo `.github/` e `.githooks/`,
    criado e apagado pelo PO na F1, e não para o main, onde o valor ficaria no histórico. Quem empurra é a tarefa, no
    disparo manual de teste, com uma chave de deploy do descartável, ou o PO. Os casos de aviso sem valor plantado
    rodam no main.
  - **O teste com o hook desligado usa `git commit --no-verify`,** porque a tarefa recusa empurrar com o
    `core.hooksPath` errado.
  - **Ruleset de tag (escolha do Claude, vetável):** o PO cria um tag ruleset com "Restrict creations" para todas as
    tags, como fez com o `so-main` para as branches. A F0 não testou tag, e o `so-main` não alcança tag (seção 7).

  Aceite:
  - o commit é recusado com cada um destes plantados num arquivo: chave de API no formato de um provedor, chave PEM,
    JWT, string de conexão com senha, CPF, CNPJ, e-mail fora da lista, id de organização no formato de produção, UUID
    no corpo e nome de arquivo com acento;
  - o mesmo UUID no campo `sessao:` do cabeçalho passa; dão vermelho uma linha `sessao: <uuid>` no corpo, um segundo
    bloco `---` no meio do arquivo e dois UUIDs no campo;
  - o mesmo valor, empurrado ao descartável com `--no-verify`, faz o job do CI falhar;
  - um commit que toca o `LEIA-ME`, `.githooks/`, `.gitattributes` ou `.github/` faz o job de aviso falhar (QC12); os
    de `.github/` e `.githooks/` seguem o procedimento da seção 4.6 (a tarefa os retém, e o PO os empurra);
  - um commit que toca o `decisoes.md` de uma frente, ou um arquivo da pasta `decisoes/`, faz o job de aviso falhar
    (QC11);
  - um commit que toca `memoria/INDICE.md`, uma lição ou uma referência faz o job de aviso falhar (QC13);
  - um commit que toca só a `passagem.md` ou uma entrada da memória não faz o job de aviso falhar (QC13);
  - um push com 3 commits, em que só o primeiro toca um `decisoes.md`, faz o job de aviso falhar;
  - no descartável, com `--no-verify`, um push em que um commit planta um CPF e o seguinte o apaga faz o job do CI
    falhar;
  - no descartável, um push com `before` zerado e dois commits, só o primeiro com CPF plantado, faz o job do CI falhar;
  - lição sem linha no `INDICE.md` é recusada;
  - a tarefa empurra só o main, e a chave não cria outra branch (o ruleset `so-main` recusa, como na F0) nem tag (o
    ruleset de tag recusa);
  - com um commit que toca `.github/` ou `.githooks/` no meio do intervalo, a tarefa empurra só até o commit anterior e
    avisa o PO; depois que o PO empurra esse commit com o próprio login, a tarefa volta a empurrar o resto (seção 4.6);
  - a tarefa avisa o PO quando o push falha, inclusive por histórico divergente;
  - com `core.hooksPath` diferente de `.githooks`, a tarefa não empurra e avisa o PO;
  - o repositório descartável foi apagado ao fim da F1.
- **F2. Ponteiros e permissões.** A seção do `AGENTS.md` do `grc-saas`, o `AGENTS.md` novo do `vallus-office` com o
  `CLAUDE.md` reduzido a `@AGENTS.md`, os arquivos globais (QC6), `additionalDirectories` do Claude e `writable_roots`
  do Codex, com o repositório (e, no Codex, `retidas\`, seção 4.3). Aceite:
  - uma sessão nova em cada combinação (Claude ou Codex, no `grc-saas` ou no `vallus-office`) responde qual é o próximo
    passo de uma frente de teste a partir da `passagem.md`, e grava uma entrada, sem pedido de permissão e sem bloqueio
    do sandbox;
  - uma sessão Claude e uma Codex abertas em `C:\dev` ou no `vallus-site` acham a frente de teste só pelo ponteiro
    global;
  - uma sessão sem frente nomeada que grava um arquivo abre uma frente; uma pergunta rápida não abre (QC7);
  - uma sessão Codex no `vallus-office` cita o comando de setup do `AGENTS.md` novo;
  - uma sessão com `VALLUS_OFFICE_MESA` no ambiente não lê nem grava o repositório;
  - um despacho real do escritório, ou a sonda da INV-7, tenta, de dentro da mesa, no Claude e no Codex, ler e gravar
    `C:\dev\vallus-contexto` e `retidas\` por Read, Write ou Edit, Bash e PowerShell, com o caminho expandido (sem
    `%LOCALAPPDATA%`) e com as duas barras, e cada tentativa é negada;
  - a trava move a entrada barrada para `retidas\` numa sessão Claude e numa Codex; a sessão Claude não lê `retidas\`
    sem pedido de permissão; na sessão Codex, o resultado da leitura em `retidas\` fica registrado (limite da seção 4.3).
- **F3. Migração por triagem.** Aceite:
  - o PO revisou a tabela antes do primeiro movimento; ela tem N linhas, com o N tirado da listagem da pasta no dia da
    montagem, menos o `MEMORY.md`, e o relatório informa o N e soma N;
  - uma contagem mostra que nenhum arquivo com destino fora da memória do Claude continua na pasta dela;
  - a varredura do pre-commit sobre o repositório inteiro dá zero, e o relatório leva ao PO quantos falsos positivos o
    padrão de id deu;
  - o PO lê uma amostra que inclui os arquivos do Parceiro A e aprova;
  - a leitura cobriu os 59 arquivos da memória do Codex, e o relatório diz quantas pendências migraram e para onde;
  - a tabela de triagem e os rascunhos da reescrita, fora do repositório e de `C:\dev`, foram apagados;
  - o `MEMORY.md` do Claude ficou com os fatos só do Claude e o ponteiro.
- **F4. Protocolo em uso, restauração e a conferência de uma hora.** Aceite:
  - uma sessão manual morta no meio do turno deixa a `passagem.md` com `sessao_aberta: sim`, e a sessão seguinte, com o
    ok do PO, grava a entrada `desfecho: cortado` e assume;
  - uma entrada de sessão manual com um CPF plantado é movida pela trava para `retidas\`; o commit repetido leva só o
    esboço `desfecho: retido`, e o texto não fica em `frentes/` (QC8);
  - duas sessões em frentes diferentes fazendo commit ao mesmo tempo não levam o arquivo uma da outra;
  - os commits chegam ao GitHub em até uma hora, pela tarefa agendada (QC5), salvo os que esperam atrás de um commit
    retido em `.github/` ou `.githooks/`;
  - um clone novo do GitHub numa pasta vazia, com o hook reativado, tem o mesmo conteúdo do clone local no último commit
    enviado, e os casos de pre-commit do teste da F1 passam nele;
  - duas semanas depois do corte, nenhum `project_*` novo na memória do Claude.

---

## 7. Riscos

- **A memória automática continua gravando onde gravava.** O harness do Claude manda gravar lá. Coberto pelo ponteiro e
  pela medição de duas semanas (F4).
- **Prosa de cliente escapa do regex.** Coberto só pela regra e pela revisão do PO. É risco que fica.
- **Vazamento no histórico é permanente até o PO reescrever.** Por isso a F1 vem antes da F3.
- **O `LEIA-ME` é editável por quem escreve no clone.** Ele diz o que cada sessão lê primeiro; uma mudança maliciosa ou
  descuidada chega a todas. Coberto pelo aviso do CI e pela frase do ponteiro (vale o `AGENTS.md`). Reduz, não fecha.
- **Decisão falsa gravada no clone (QC11), e o mesmo nas lições (QC13).** Um agente, com o mesmo usuário do Windows do PO
  (D3) e com o "Modificar" que `C:\dev` dá a todo usuário autenticado, pode gravar num `decisoes.md`, em `decisoes/`,
  numa lição, numa referência ou no índice um texto falso, por exemplo uma decisão assinada "Quem decidiu: PO". A tarefa
  agendada o publica sem o ok do PO (QC5).
  - **A janela:** o aviso do CI só dispara depois do push, e as sessões leem o clone local, não o GitHub. Entre a
    gravação e o próximo push (até uma hora, ou mais, se houver commit retido em `.github/` ou `.githooks/` antes dele),
    e daí até o PO ler o aviso, toda sessão que abre a frente já lê o texto falso como contexto.
  - **O aviso pode nem disparar:** o commit que apaga o job de aviso junto com o texto falso sobe sem disparar nada, e o
    `gitleaks` do CI cai junto (QC12). O aviso pega mudança descuidada, não quem quer burlar. Com o que a F0 testou,
    nada no GitHub reduz isso: a chave altera o workflow e o plano não tem regra por caminho. A tarefa segurar o commit
    em `.github/` (seção 4.6) pega o descuido; um agente que altera o script dela ou usa a chave passa.
  - A frase do ponteiro (vale o `AGENTS.md`) e a INV-C3 limitam o que o texto falso consegue mandar, mas não impedem que
    oriente o trabalho. Reduz, não fecha: fica junto do risco aceito na D3.
- **Duas sessões na mesma frente.** O bilhete `sessao_aberta` e a combinação com o PO (seção 4.3). Duas gravando o mesmo
  arquivo no mesmo instante perdem uma das gravações; o Git não avisa, porque é o mesmo clone.
- **Sandbox do Codex no Windows** com `writable_roots` não verificado (F2 prova).
- **O ponteiro chega às mesas** pelos clones do `grc-saas` (seção 4.4). No Claude, a fonte `user` continua carregada na
  mesa e traz o ponteiro global e as `additionalDirectories` que dão acesso ao repositório sem passar pelo Toby. Coberto
  pela negação explícita no `--settings` do escritório, que governa as ferramentas de arquivo, e pelo Toby, que barra o
  Bash e o PowerShell, conferidos pela sonda da INV-7 (F2). No Codex, o `CODEX_HOME` do escritório isola a
  configuração; a leitura fora da mesa depende do hook PreToolUse do Toby e da sonda. Nos dois vale a frase de
  `VALLUS_OFFICE_MESA` no `AGENTS.md` da mesa. Reduz, não fecha.
- **`retidas\` guarda o texto que a trava barrou.** A pasta não está coberta pela INV-C2 e cai no alcance aceito da D3:
  qualquer processo do usuário do PO a lê. A ACL só protege contra outros usuários do Windows. No Codex, só a frase do
  `LEIA-ME` separa a sessão das retidas (seção 4.3).
- **Mesmo usuário do Windows que o cofre** (D3, aceito até a fase remota): um agente determinado lê o repositório de
  contexto. O impacto é pequeno porque o repositório não tem segredo nem dado de cliente por construção: a INV-C2
  limita o alcance do risco aceito.
- **Chave de deploy e script da tarefa no disco** (QC5): ficam no perfil do PO, fora de `C:\dev` e do clone, com ACL só
  do usuário. Um agente do mesmo usuário os lê e pode alterar o script (D3). O impacto fica no que a chave consegue e o
  GitHub aceita, medido na F0: avançar o main, inclusive com mudança no `.github/`, sem push forçado e sem criar branch.
  Criar tag não foi testado: o `so-main` é branch ruleset e não alcança tag, então, até o ruleset de tag da F1, a chave
  provavelmente cria tag apontando para um commit qualquer, e um workflow `on: push` sem filtro de branch roda nesse
  push.
- **Os rulesets dependem do plano Pro.** Em repositório privado de conta pessoal, rulesets só valem no Pro (seção 6). Se
  a conta voltar ao Free, eles deixam de valer, e a tela só avisa quando alguém a abre. O main fica protegido apenas
  pela trava da branch padrão contra deleção, e o push forçado e a branch nova passam. A tarefa não percebe a mudança.
- **Busca com acento no Windows:** o `grep` do git-bash erra com `ç`, `ã` e `é`. O `LEIA-ME` manda usar a ferramenta de
  busca da sessão (ripgrep).

## 8. Plano de teste

O que só se pega com teste próprio, porque nenhum compilador olha estes arquivos:

- os valores plantados da F1, um por padrão, e cada um tem de dar vermelho; tirar um padrão do hook tem de fazer o
  teste dele falhar;
- o UUID em par: no corpo dá vermelho; o mesmo UUID no campo `sessao:` do cabeçalho dá verde; dão vermelho também uma
  linha `sessao: <uuid>` no corpo, um segundo bloco `---` no meio do arquivo e dois UUIDs no campo (F1);
- o aviso do CI em cada caminho vigiado: `LEIA-ME`, `.githooks/`, `.gitattributes`, `.github/` (QC12), o `decisoes.md`
  de uma frente e `decisoes/` (QC11), `memoria/INDICE.md`, uma lição e uma referência (QC13); tirar um desses caminhos
  do job tem de fazer o teste dele falhar; um commit só na `passagem.md` ou numa entrada não dispara o aviso (F1);
- o intervalo `before..after` do push: 3 commits em que só o primeiro toca um `decisoes.md`; com `--no-verify`, um
  commit que planta um CPF e o seguinte que o apaga; e, com `before` zerado, dois commits em que só o primeiro planta um
  CPF. Os três têm de fazer o CI falhar, e os dois com valor plantado rodam no repositório descartável (F1);
- a tarefa que segura o commit em `.github/` ou `.githooks/`, empurra só até o anterior e avisa o PO (F1, QC12). O
  teste empírico da chave e da regra de push por caminho foi feito na F0 (seção 6);
- a sessão com `VALLUS_OFFICE_MESA` que não lê o repositório, e as tentativas de dentro da mesa, no Claude e no Codex,
  de ler e gravar o repositório e as retidas por Read, Write ou Edit, Bash e PowerShell, com o caminho expandido e as
  duas barras, cada uma negada (F2);
- a sessão sem frente nomeada que abre uma frente ao gravar arquivo, e a pergunta rápida que não abre (F2);
- a sessão cortada que vira entrada `desfecho: cortado` (F4);
- a entrada retida nos dois caminhos, separados: a da sessão manual (F4) e a do escritório (F1 do projeto 2, seção 4.8);
  nos dois, a trava move o texto para `retidas\`, nunca o deixa em `frentes/`, e o repositório recebe só o esboço
  `desfecho: retido`; a movimentação provada no Claude e no Codex (F2);
- o commit por caminho que não leva o arquivo de outra sessão (F4);
- o push agendado: só no main, outra branch recusada (ou o limite registrado), o aviso ao PO quando o push falha,
  inclusive por histórico divergente, e a recusa de empurrar com `core.hooksPath` errado (F1);
- a restauração por clone novo, com o hook reativado e os casos de pre-commit da F1 rodando nele (F4);
- a cobertura da triagem: N de N, e não uma amostra, e os 59 arquivos do Codex lidos (F3).

## 9. Onde esta spec mora

Decidido (QC10): neste repositório, em `docs/specs/`, desde o primeiro commit, feito pelo PO na F0. Antes dele, a spec
ficava na pasta de notas do app do Claude. O caminho de lá saiu do texto porque leva um id em UUID, que a trava barra
fora do cabeçalho (seção 4.5). A cópia da pasta de notas deixou de ser a fonte: daqui em diante a spec muda por commit
neste repositório.
