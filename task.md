# 📋 Plano de Trabalho - GuaruGeo

## 🚀 Próximos Passos (Ação Requerida)
- [ ] **Deploy da SQL**: O usuário deve executar o script `enable_realtime.sql` no Supabase para ativar os alertas ao vivo.
- [ ] **Deploy da Função**: O usuário deve fazer o deploy da função `infosimples-api` atualizada para que a PGFN volte a funcionar com os dados completos.

## 🛠️ O Que Foi Feito Hoje

### 1. Automação Jurídica (Infosimples)
- [x] **Correção PGFN**: Restaurado suporte a Nome e Nascimento, e retorno ao endpoint estável.
- [x] **Salvamento Robusto**: PDFs e HTMLs agora são salvos no Storage e vinculados ao proprietário.
- [x] **Visualizador Integrado**: Modal premium para ver e imprimir certidões sem sair do site.

### 2. Sistema de Notificações (Sininho)
- [x] **Real-time**: Alerts via Supabase Realtime integrados ao backend monitor.
- [x] **UX Premium**: Balões (Toasts) clicáveis e ícone de sino dourado com contador.
- [x] **Histórico**: Acesso rápido aos documentos recentes via menu de notificações.

### 3. Melhoria de Dados
- [x] **Proprietário 360°**: Abas separadas para Relacionamentos (Empresas/Família) e Jurídico.
- [x] **Edição de Bairros**: Labels de bairros agora podem ser arrastadas e ocultadas no mapa.

### 4. Documentação Exaustiva
- [x] **README.md**: Atualizado com nova arquitetura e handlers.
- [x] **MANUAL_USUARIO.md**: Guia prático do novo sistema jurídico e sininho.
- [x] **MANUAL_TECNICO.md**: Detalhamento técnico da stack e fluxos de dados.
- [x] **SCHEMA_COMPLETO_V2.sql**: Script SQL mestre com todas as tabelas e views do sistema.
- [x] **FUNCIONALIDADES**: Listas dedicadas para perfis Leigo e Técnico.

---
**Status Final**: Sistema atualizado, documentado e pronto para uso em produção. 🚀
