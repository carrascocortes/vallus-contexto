---
data: 2026-11-14T01:00-03:00
autor: sessão manual
ferramenta: claude-code
modelo: claude-opus-5-5
sessao: 275070d0-6d83-4962-a976-2e532ffe1515
desfecho: concluido
motivo:
---
## Feito
- Revisão adversarial dos 36 rulings da F1 (três lentes Sonnet, gate Opus): nada leva dado de cliente nem segredo ao
  GitHub.
- Correções na `f1`, de `ba03ef4` a `c20d788`: placeholder de senha em string de conexão, `noreply` em lista fechada,
  carimbo de data e hora fora do CNPJ, dica do `git commit -v` e do formato da linha `sessao:`, um aviso por situação
  por dia e o batimento da tarefa. Revisão do delta (três lentes, gate e re-gate Opus); suíte 260, `--arvore` 0.

## Decisões
As do PO estão em `decisoes.md` (DF-12 a DF-15). Do coordenador: a isenção de placeholder não vale se outro `@` vem
logo depois (a busca olha 400 caracteres, por custo linear); a falha ao gravar o batimento vira linha no log, sem
derrubar o ciclo; o retido não avança o `ultimoOk`.

## Descartado
- Cortar a conferência na linha de corte do `git commit -v`: com `-m` ou `-F` o Git não corta ali.
- `noreply` só do GitHub: barraria o `Co-Authored-By` dos commits do Claude.
- Exceção para loopback na string de conexão: túnel aparece como `127.0.0.1`, e o gitleaks não pega conexão.
- Regex de conexão gulosa até o último `@`: esconderia e-mail que vem depois na mesma URI.
- Não isentar o carimbo com hora e minuto 0001: o PO manteve o critério em 14/11.

## Pendências
- Tarefa 10 com o PO. A cópia da tarefa em `%USERPROFILE%\.vallus-contexto\tarefa\` é anterior a estas correções;
  o passo de copiar da Tarefa 10 a substitui.
- Tarefa 11: ruleset de tag (mensagem de tag anotada e `mergetag` não são conferidas).
- `VALLUS_RETIDAS` e `VALLUS_GITLEAKS` valem em produção (D3): documentar no `LEIA-ME` ou restringir aos testes.
- Senha com `/` literal escapa do detector de conexão; o `LEIA-ME` promete mais que as mensagens (nome barrado, tetos).
- Limpeza: comentário de `trava.mjs` acima da função errada; trio repetido em `conferirMensagem` e
  `conferirIdentidades`; `dataLocal` igual a `diaLocal`; bloco do gitleaks repetido no `ci.yml`.
- Commit com mais de 150 arquivos pode estourar o tempo da trava; teste "a pasta temporária da trava não sobra" falha
  com outra suíte rodando em paralelo.
