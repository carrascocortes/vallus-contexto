---
frente: 2026-11-05-repositorio-de-contexto
titulo: Repositório de contexto das frentes
criada: 2026-11-05
repositorios: [vallus-contexto, grc-saas, vallus-office]
encerrada:
---
## Objetivo
Um repositório privado e versionado onde Claude, Codex e o escritório guardam descrição, passagem de turno, memória e
decisões das frentes, com a mesma regra para todos, sem dado de cliente nem segredo, e com backup no GitHub.

## Aceite
- F0: repositório criado, chave de deploy, rulesets `main` e `so-main` e testes de proteção. Cumprida em 2026-11-06.
- F1: esqueleto de pastas e modelos, `LEIA-ME`, trava de commit (segredo e dado de cliente), CI com aviso e tarefa
  agendada de push, tudo com teste.
- F2: ponteiro nos dois `AGENTS.md` e nos arquivos globais das ferramentas; permissões do Claude e do Codex.
- F3: migração por triagem da memória do Claude, com a tabela revisada pelo PO.
- F4: restauração provada num clone novo.
- Os aceites completos de cada fatia estão na seção 6 da spec.

## Limites
Não migra a memória do Codex (fica como cache). Não guarda código, ADR nem estado de tarefa. Nenhuma sessão faz push.

## Onde está o trabalho
- Spec: [repositório de contexto](../../docs/specs/2026-11-05-repositorio-de-contexto-design.md); as decisões QC1 a QC13
  estão na seção 2.
- Plano da F1: [plano](../../docs/plans/2026-11-06-f1-esqueleto-trava-tarefa-plan.md).
- Branch local `f1`; decisões desta frente em [decisoes.md](decisoes.md).
