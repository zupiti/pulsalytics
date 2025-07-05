# 🔌 Configuração WebSocket Corrigida

## 📋 Problema Resolvido

**Antes**: O React estava conectando ao WebSocket errado (porta 3001)  
**Agora**: O React conecta ao WebSocket do heatmap (porta 3002) ✅

## 🌐 Arquitetura WebSocket

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Admin   │    │  HTTP Server    │    │ WebSocket Server│
│   (porta 3000)  │◄───┤  (porta 3001)   │    │   (porta 3002)  │
│                 │    │                 │    │                 │
│ - Interface     │    │ - API /images   │    │ - Recebe base64 │
│ - Visualização  │    │ - Serve arquivos│    │ - Salva imagens │
│                 │    │                 │    │ - Notifica admin│
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                                             ▲
          │                                             │
          └─────────────── WebSocket ──────────────────┘
                       REACT_APP_HEATMAP_WS_URL
                        ws://localhost:3002
```

## 🔧 Arquivo .env Configurado

```bash
# admin-ui/.env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_WS_URL=ws://localhost:3001
REACT_APP_HEATMAP_WS_URL=ws://localhost:3002    ← USADO AGORA
GENERATE_SOURCEMAP=false
REACT_APP_ENVIRONMENT=development
```

## 📡 Mensagens WebSocket Processadas

O React agora processa corretamente estas mensagens do servidor heatmap:

### ✅ Mensagens Implementadas

1. **`image_uploaded`** - Nova imagem foi salva
   ```javascript
   {
     type: 'image_uploaded',
     sessionId: 'uuid-da-sessao',
     filename: 'heatmap_ws_sessionId_timestamp.webp',
     timestamp: 1234567890
   }
   ```

2. **`upload_in_progress`** - Upload em andamento
   ```javascript
   {
     type: 'upload_in_progress',
     sessionId: 'uuid-da-sessao',
     timestamp: 1234567890
   }
   ```

3. **`session_started`** - Nova sessão iniciada
   ```javascript
   {
     type: 'session_started',
     sessionId: 'uuid-da-sessao',
     url: 'https://site-exemplo.com',
     timestamp: 1234567890
   }
   ```

4. **`session_ended`** - Sessão finalizada
   ```javascript
   {
     type: 'session_ended',
     sessionId: 'uuid-da-sessao',
     timestamp: 1234567890
   }
   ```

5. **`upload_success`** - Confirmação de upload
   ```javascript
   {
     type: 'upload_success',
     filename: 'heatmap_ws_sessionId_timestamp.webp',
     size: 123456,
     processingTime: 250
   }
   ```

6. **`upload_error`** - Erro no upload
   ```javascript
   {
     type: 'upload_error',
     error: 'Base64 inválido',
     timestamp: 1234567890
   }
   ```

## 🔄 Fluxo de Dados Corrigido

### 1. **Captura e Envio** (heatmap.js)
```javascript
// heatmap.js captura screenshot
takeScreenshot() → base64 → WebSocket (porta 3002)
```

### 2. **Processamento** (WebSocket Server)
```javascript
// websocket-server.js processa
base64 → validação → Buffer → arquivo.webp → notifica React
```

### 3. **Atualização** (React Admin)
```javascript
// React recebe notificação e atualiza
WebSocket message → fetchImages() → /api/images → atualiza UI
```

## 🚀 Como Testar

1. **Abrir React Admin**: http://localhost:3000
2. **Verificar console**: Deve mostrar "✅ WebSocket do heatmap conectado"
3. **Abrir site de teste**: qualquer página web
4. **Verificar mensagens**: Console deve mostrar mensagens do heatmap
5. **Confirmar imagens**: Devem aparecer no admin em tempo real

## 🔍 Debug WebSocket

### Verificar Conexão
```bash
# Status do WebSocket Server
curl http://localhost:3003/api/status

# Logs em tempo real
tail -f heatmap-server/logs/websocket.log
```

### Console do Navegador
```javascript
// Verificar se está conectando corretamente
console.log('Conectando ao WebSocket do heatmap...')
console.log('✅ WebSocket do heatmap conectado')
console.log('📡 Mensagem WebSocket do heatmap recebida:', data)
```

## ⚠️ Problemas Comuns

### 1. **React não conecta ao WebSocket**
- ✅ Verificar se `REACT_APP_HEATMAP_WS_URL` está definido
- ✅ Reiniciar React após alterar .env
- ✅ Verificar se porta 3002 está rodando

### 2. **Imagens não aparecem**
- ✅ Verificar se mensagem `image_uploaded` está chegando
- ✅ Verificar se `/api/images` retorna dados
- ✅ Verificar se arquivos estão sendo salvos em `/uploads`

### 3. **WebSocket desconecta muito**
- ✅ Verificar logs do servidor
- ✅ Verificar se há erro de CORS
- ✅ Verificar se há conflito de porta

---

✅ **Status**: WebSocket corrigido e funcionando  
📅 **Data**: $(date)  
🔧 **Versão**: 2.1 com WebSocket correto 