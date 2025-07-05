# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

## [1.0.0] - 2024-06-07
### Adicionado
- Primeira versão pública do plugin.
- Rastreamento de mouse, cliques e screenshots.
- Envio de dados para servidor via HTTP e WebSocket.
- Visualização em tempo real via admin-ui.
- Exemplo de uso e documentação inicial.

### Avisos
- Projeto em desenvolvimento. Falta tratamento de dados sensíveis e otimização de código.

## [1.0.1] - 2025-01-07

### ✨ Adicionado
- **Tracking de mouse em tempo real**: Captura automática de movimentos do mouse
- **Detecção de cliques**: Registro preciso de cliques com posição e timestamp
- **Sistema de capturas automáticas**: Screenshots periódicas com mapas de calor
- **Captura rápida inteligente**: Screenshots frequentes quando mouse está ativo
- **Gerenciamento de sessões**: Sistema completo de sessões de usuário
- **Detecção de mudanças de URL**: Tracking automático de navegação SPA
- **Armazenamento local**: Persistência de dados no localStorage do navegador
- **Sistema de eventos**: Stream de eventos para monitoramento em tempo real
- **Configuração flexível**: Múltiplas opções de configuração
- **Sistema de logs**: Logs detalhados para debug e monitoramento
- **Exemplo completo**: App demonstrativo com interface de monitoramento
- **Documentação completa**: README detalhado com exemplos

### 🏗️ Arquitetura
- **HeatmapTracker**: Classe principal singleton para gerenciamento
- **HeatmapConfig**: Sistema de configuração type-safe
- **HeatmapSession**: Gerenciamento de sessões com metadados
- **HeatmapModels**: Modelos para posições, cliques e rastros
- **HeatmapUtils**: Utilitários para storage, URLs e manipulação de dados

### 📦 Release Inicial
- Biblioteca Flutter completa para tracking de heatmap
- Conversão do sistema JavaScript original para Dart
- API limpa e bem documentada
- Exemplo funcional de uso
- Compatibilidade com servidor Node.js existente