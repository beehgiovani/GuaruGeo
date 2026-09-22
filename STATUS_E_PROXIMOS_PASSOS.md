# Status e próximos passos — GuarujaGeo legado

> Auditoria de 22/09/2026. Esta é uma fotografia baseada em arquivos, Git, artefatos e endpoints observáveis. Nenhum build completo foi executado nesta classificação.

## Classificação

- **Estado:** legado com trabalho local não consolidado
- **Confiança:** alta
- **Natureza:** implementação antiga do mapa e integrações imobiliárias

## Evidências observadas

- O último commit é de janeiro de 2026, mas existem 28 mudanças locais.
- O Firebase relacionado ainda responde HTTP 200.
- A pasta está em `legado` e compartilha finalidade com versões mais novas.

## Diagnóstico franco

Pode conter melhorias não migradas. Não deve ser apagado nem retomado diretamente até que o diff seja triado.

## Upgrades previstos

### P0 — preservar e tornar retomável

- Salvar e revisar as mudanças locais antes de qualquer atualização.
- Classificar cada mudança como migrar, preservar como histórico ou descartar depois de confirmação.
- Remover dependência de dados privados do fluxo de comparação.

### P1 — estabilizar

- Migrar somente funções ausentes na versão canônica, com testes.
- Atualizar README para indicar substituição e limites do deploy antigo.

### P2 — evoluir

- Congelar e arquivar após a migração seletiva.

## Critério para considerar retomado

O projeto será considerado retomado quando não restar código exclusivo útil sem decisão documentada, e nenhuma mudança local ficar sem backup.

## Prompt de retomada para o Codex

> Retome o projeto **GuarujaGeo legado** nesta pasta. Leia este arquivo e o README, inspecione o Git e preserve todo trabalho local. Comece somente pelo P0, valide com evidências e não implemente P1/P2 antes de apresentar o diagnóstico atualizado.

