---
data: 2026-11-05T22:10-03:00
autor: sessão manual                          # ou o personagem do escritório
ferramenta: claude-code                       # o executor real: claude-code | codex; o personagem vai em autor
modelo: claude-opus-5-5                       # o modelo observado, não o pedido
# sessao é o único campo onde o UUID é aceito
sessao: <id>
desfecho: concluido                           # concluido | cortado | retido | migrado | registro (não é turno: a nota de visitante do adendo, 4.12)
motivo:                                       # quando não é concluido: cota, prazo, disjuntor, suspensão, reinício, sessão morta
---
## Feito
## Decisões
## Descartado                                 # o que tentou e descartou, com o motivo
## Pendências
## Estado no corte                            # só quando cortado: git status e commits locais
