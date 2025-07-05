# Clarity Analytics Platform

Sistema simplificado de heatmap e analytics para monitoramento de interações do usuário em tempo real.

## 🚀 Funcionalidades

- **Script JavaScript Simplificado**: Captura movimento do mouse e cliques em intervalos de 1 segundo
- **Backend WebSocket**: Recebe dados via WebSocket e grava na pasta `uploads`
- **Interface Admin React**: Visualiza e reproduz sessões capturadas
- **Tempo Real**: Atualizações automáticas via WebSocket

## 📋 Pré-requisitos

- Node.js (versão 14 ou superior)
- npm
- Navegador moderno com suporte a WebSocket

## 🔧 Instalação e Uso

### 1. Iniciar o Sistema

```bash
# Dar permissão aos scripts
chmod +x start_all_services.sh stop_all_services.sh

# Iniciar todos os serviços
./start_all_services.sh
```

### 2. Acessar a Interface

- **Admin Interface**: http://localhost:3000
- **API Backend**: http://localhost:3001

### 3. Integrar o Script no seu Site

Adicione o script heatmap.js no seu site:

```html
<!-- Incluir html2canvas (dependência) -->
<script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>

<!-- Incluir o script do heatmap -->
<script src="http://localhost:3001/flutter_heatmap_tracker/web/heatmap.js"></script>

<!-- Configuração opcional -->
<script>
window.HEATMAP_CONFIG = {
    serverUrl: 'ws://localhost:3002',
    interval: 1000, // Intervalo em milissegundos (padrão: 1 segundo)
    userId: 'usuario-123' // ID do usuário (opcional)
};
</script>
```

### 4. Formato dos Dados

O script envia dados no seguinte formato:

```json
{
    "sessionId": "string_timestamp_random",
    "timestamp": 1640995200000,
    "url": "https://meusite.com/pagina",
    "base64": "data:image/webp;base64,UklGRi...",
    "positions": [
        {"x": 100, "y": 200, "timestamp": 1640995200000},
        {"x": 105, "y": 205, "timestamp": 1640995201000}
    ],
    "clickPoints": [
        {"x": 150, "y": 250, "timestamp": 1640995201500}
    ]
}
```

## 🗂️ Estrutura do Projeto

```
clarity/
├── heatmap-server/           # Servidor backend
│   ├── server.js            # Servidor principal simplificado
│   ├── uploads/             # Arquivos salvos (JSON + imagens)
│   └── public/              # Interface admin estática
├── admin-ui/                # Interface React do admin
│   └── src/
│       ├── App.js           # Aplicação principal
│       ├── components/      # Componentes React
│       └── pages/           # Páginas da aplicação
├── flutter_heatmap_tracker/
│   └── web/
│       └── heatmap.js       # Script simplificado
├── start_all_services.sh    # Script para iniciar
└── stop_all_services.sh     # Script para parar
```

## 📡 Endpoints da API

### GET /api/uploads
Retorna todos os arquivos agrupados por sessão:

```json
{
    "session_123": [
        {
            "filename": "session_123_1640995200000.webp",
            "sessionId": "session_123",
            "timestamp": 1640995200000,
            "url": "/uploads/session_123_1640995200000.webp"
        }
    ]
}
```

### DELETE /api/session/:sessionId
Deleta todos os arquivos de uma sessão específica.

## 🔧 Configuração

### Script JavaScript

```javascript
window.HEATMAP_CONFIG = {
    serverUrl: 'ws://localhost:3002',  // URL do WebSocket
    interval: 1000,                    // Intervalo de captura (ms)
    userId: null                       // ID do usuário
};
```

### Servidor Backend

O servidor roda nas seguintes portas:
- **3001**: HTTP Server (API + Admin)
- **3002**: WebSocket Server (recebe dados do script)
- **3004**: WebSocket Admin (comunica com React)

## 🛑 Parar o Sistema

```bash
./stop_all_services.sh
```

## 📊 Visualização dos Dados

1. Acesse http://localhost:3000
2. Navegue entre as páginas:
   - **Overview**: Estatísticas gerais
   - **Sessions**: Lista de sessões
   - **Player**: Reprodutor de sessões

## 🐛 Troubleshooting

### Porta já em uso
```bash
# Verificar processos nas portas
lsof -i :3001
lsof -i :3002
lsof -i :3004

# Matar processo específico
kill -9 <PID>
```

### WebSocket não conecta
- Verifique se o servidor está rodando na porta 3002
- Verifique se não há firewall bloqueando a conexão
- Confirme que o script está apontando para o servidor correto

### Dados não aparecem no admin
- Verifique o console do navegador para erros
- Confirme que o WebSocket admin (porta 3004) está conectado
- Verifique se os arquivos estão sendo salvos em `heatmap-server/uploads/`

## 🔒 Considerações de Segurança

- **Desenvolvimento**: Este sistema foi projetado para ambiente de desenvolvimento
- **Produção**: Para produção, configure HTTPS/WSS e autenticação
- **CORS**: Configure adequadamente para seu domínio
- **Dados Sensíveis**: O sistema captura screenshots - certifique-se de compliance

## 📝 Changelog

### v2.0.0 - Sistema Simplificado
- Removido código complexo de heatmap
- Simplificado para captura básica de mouse/cliques + screenshots
- Formato de dados padronizado
- Interface React modernizada
- Scripts de deploy simplificados

