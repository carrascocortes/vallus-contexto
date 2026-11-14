## DF-1 · 2026-11-07 · Node para a trava e a tarefa
Quem decidiu: escolha do Claude não vetada pelo PO
A trava do pre-commit e do CI e a tarefa agendada usam um código só em Node, testado com `node:test`.
Origem: aprovação do plano no chat da sessão (memoria/2026-11-07T03-30-claude-code-sessao-manual.md)
Substituída por: —

## DF-2 · 2026-11-07 · gitleaks local na versão 8.30.1
Quem decidiu: escolha do Claude não vetada pelo PO
O `gitleaks` local é o do release oficial 8.30.1, com SHA-256 pinado em `ferramentas/`; sem o binário, a trava recusa
todo commit.
Origem: aprovação do plano no chat da sessão (memoria/2026-11-07T03-30-claude-code-sessao-manual.md)
Substituída por: —

## DF-3 · 2026-11-07 · Aviso da tarefa ao PO
Quem decidiu: escolha do Claude não vetada pelo PO
O aviso é uma notificação do Windows mais uma linha no log da tarefa; cada situação avisa uma vez, e o commit retido
avisa de novo uma vez por dia.
Origem: aprovação do plano no chat da sessão (memoria/2026-11-07T03-30-claude-code-sessao-manual.md)
Substituída por: DF-11

## DF-4 · 2026-11-07 · Modelos em modelos/
Quem decidiu: escolha do Claude não vetada pelo PO
Os formatos dos arquivos ficam na pasta `modelos/`, e o `LEIA-ME` aponta para ela em vez de repeti-los.
Origem: aprovação do plano no chat da sessão (memoria/2026-11-07T03-30-claude-code-sessao-manual.md)
Substituída por: —

## DF-5 · 2026-11-07 · Tarefa versionada e instalada por cópia
Quem decidiu: escolha do Claude não vetada pelo PO
A tarefa mora em `ferramentas/tarefa/` e é copiada para o perfil do PO; mudar a fonte não muda o que roda até o PO
reinstalar.
Origem: aprovação do plano no chat da sessão (memoria/2026-11-07T03-30-claude-code-sessao-manual.md)
Substituída por: —

## DF-6 · 2026-11-07 · Trabalho da F1 numa branch local
Quem decidiu: escolha do Claude não vetada pelo PO
O trabalho vai na branch local `f1`; o PO a revisa e avança o main local. A tarefa empurra o que vem antes do primeiro
commit em `.github/` ou `.githooks/`, e o PO empurra o resto.
Origem: aprovação do plano no chat da sessão (memoria/2026-11-07T03-30-claude-code-sessao-manual.md)
Substituída por: —

## DF-7 · 2026-11-07 · A retida não mexe no índice do Git
Quem decidiu: escolha do Claude não vetada pelo PO
A trava move o arquivo de trabalho, grava o esboço e recusa o commit; a sessão repete com `git add` e `git commit` por
caminho. O conteúdo barrado que já passou por `git add` fica como objeto solto até o próximo `git gc`.
Origem: aprovação do plano no chat da sessão (memoria/2026-11-07T03-30-claude-code-sessao-manual.md)
Substituída por: —

## DF-8 · 2026-11-07 · ferramentas/ entra nos caminhos vigiados
Quem decidiu: escolha do Claude não vetada pelo PO
Mudança em `ferramentas/` avisa o PO pelo CI, porque ali mora o script que roda de hora em hora com a chave. `testes/`
fica fora.
Origem: aprovação do plano no chat da sessão (memoria/2026-11-07T03-30-claude-code-sessao-manual.md)
Substituída por: —

## DF-9 · 2026-11-07 · Nenhum arquivo binário
Quem decidiu: escolha do Claude não vetada pelo PO
Todo arquivo do repositório é UTF-8 válido e sem byte nulo; o BOM UTF-8 é aceito. Imagem só entra por decisão do PO.
Origem: aprovação do plano no chat da sessão (memoria/2026-11-07T03-30-claude-code-sessao-manual.md)
Substituída por: —

## DF-10 · 2026-11-07 · A tarefa roda escondida
Quem decidiu: escolha do Claude não vetada pelo PO
O agendador chama `wscript.exe` com um `empurrar.vbs` que inicia o Node sem janela, para não piscar um console a cada
hora.
Origem: aprovação do plano no chat da sessão (memoria/2026-11-07T03-30-claude-code-sessao-manual.md)
Substituída por: —

## DF-11 · 2026-11-07 · O aviso da tarefa se repete uma vez por dia
Quem decidiu: escolha do Claude, vetável
Toda situação que avisa (tarefa parada, push que falhou, commit retido) avisa uma vez por dia enquanto durar, e a
tarefa só dá a situação por avisada se a notificação chegou. O log é `%USERPROFILE%\.vallus-contexto\empurrar.log`.
Origem: revisão da tarefa agendada na execução da F1 (memoria/2026-11-07T03-30-claude-code-sessao-manual.md)
Substituída por: DF-12

## DF-12 · 2026-11-08 · Um aviso por situação por dia, mesmo que a situação some e volte
Quem decidiu: PO
Toda situação que avisa (tarefa parada, push que falhou, commit retido) avisa uma vez por dia. Se some e volta no mesmo
dia, não avisa de novo; situação diferente avisa na hora. A tarefa só dá a situação por avisada se a notificação
chegou. O log é `%USERPROFILE%\.vallus-contexto\empurrar.log`.
Origem: revisão dos rulings da F1 (memoria/2026-11-14T01-00-claude-code-sessao-manual.md)
Substituída por: —

## DF-13 · 2026-11-08 · A tarefa grava a hora do último ciclo
Quem decidiu: PO; o formato do arquivo é escolha do Claude, vetável
A cada ciclo a tarefa grava em `%USERPROFILE%\.vallus-contexto\ultimo-ciclo.json` a hora do ciclo (`ultimoCiclo`) e a
do último ciclo sem problema (`ultimoOk`). O escritório mostra "última sincronização há X h" na barra do topo, em
âmbar depois de 6 h (projeto 2 do vallus-office). Assim aparece também a tarefa que parou de rodar, que não avisa nada,
e o commit retido que espera o PO há mais de 6 h.
Origem: revisão dos rulings da F1 (memoria/2026-11-14T01-00-claude-code-sessao-manual.md)
Substituída por: —

## DF-14 · 2026-11-08 · Carimbo de data e hora não conta como CNPJ
Quem decidiu: PO
Os 14 dígitos sem pontuação que formam data e hora válidas entre 2020 e 2039 (timestamps de migration), com o dia
conferido pelo mês, não contam como CNPJ. Custo aceito: de 0,02% a 0,04% dos CNPJs numéricos escritos sem pontuação
passam, quase todos de matriz (a filial 0001 vira "00:01"); em 14/11 o PO manteve o critério sem excluir o 0001. CNPJ
pontuado e CNPJ com letra continuam barrados.
Origem: revisão dos rulings da F1 (memoria/2026-11-14T01-00-claude-code-sessao-manual.md)
Substituída por: —

## DF-15 · 2026-11-08 · Código do clone no ciclo da tarefa: risco aceito
Quem decidiu: PO
A tarefa roda o Git com o clone como pasta de trabalho, e o que estiver no clone vale no ciclo dela (seção 7 da spec).
O PO aceitou: "só eu uso essa máquina".
Origem: revisão dos rulings da F1 (memoria/2026-11-14T01-00-claude-code-sessao-manual.md)
Substituída por: —
