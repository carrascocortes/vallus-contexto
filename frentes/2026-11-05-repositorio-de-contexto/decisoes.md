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
Substituída por: —
