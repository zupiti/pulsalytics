# 🎬 Sistema de Heatmap com Vídeo - COMPLETO

## ✅ Sistema Totalmente Implementado

### 🔧 Problemas Resolvidos:
1. ✅ **Conflito de portas** - Cada serviço tem sua porta
2. ✅ **Agrupamento de sessões** - SessionID corrigido e melhorado
3. ✅ **Funcionalidade de vídeo** - Player completo implementado

### 🚀 Serviços Ativos:

| Serviço | Porta | URL | Status |
|---------|-------|-----|--------|
| **Flutter App** | 5000 | http://localhost:5000 | ✅ Rodando |
| **React Admin** | 3005 | http://localhost:3005 | ✅ Rodando |
| **Node.js API** | 3001 | http://localhost:3001 | ✅ Rodando |

## 🎯 Funcionalidades Implementadas

### 📊 **Agrupamento Inteligente de Sessões**
- SessionID agora inclui informações da URL base
- Agrupa corretamente todas as imagens da mesma sessão
- Formato: `[url_base]_[id_único]_[timestamp_inicial]`

### 🎬 **Player de Vídeo Completo**
- ▶️ Play/Pause com controle de velocidade
- ⏹️ Stop e reset
- 🎚️ Slider de progresso para navegar entre frames
- ⚡ Controle de velocidade (0.5 - 10 FPS)
- 📊 Informações de frame e timestamp
- 🖼️ Visualização em alta qualidade

### 🔄 **Fluxo de Dados Otimizado**
```
Flutter (5000) → Captura mouse movements
     ↓
JavaScript → Envia para API (3001)
     ↓
Node.js API → Agrupa por sessão
     ↓
React Admin (3000) → Exibe com player de vídeo
```

## 🎮 Como Usar o Sistema

### 1. **Capturar Heatmaps**
- Acesse http://localhost:5000
- Navegue pelo app Flutter
- Movimentos do mouse são automaticamente capturados
- Screenshots são enviadas a cada 10 segundos

### 2. **Visualizar Admin**
- Acesse http://localhost:3000
- Veja sessões organizadas no menu lateral
- Clique em uma sessão para ver imagens

### 3. **Criar e Assistir Vídeos**
- **Opção 1**: Clique no ícone 📹 ao lado de uma sessão
- **Opção 2**: Clique no botão "Criar Vídeo" na visualização da sessão
- Use os controles: ▶️ Play, ⏸️ Pause, ⏹️ Stop
- Ajuste velocidade com o slider

## 🎛️ Controles do Player de Vídeo

### **Botões de Controle**
- ▶️ **Play**: Inicia reprodução automática
- ⏸️ **Pause**: Pausa na imagem atual  
- ⏹️ **Stop**: Para e volta ao início

### **Sliders**
- **Progresso**: Navega diretamente para qualquer frame
- **Velocidade**: 0.5 FPS (lento) até 10 FPS (rápido)

### **Informações Exibidas**
- Frame atual / Total de frames
- Timestamp de cada imagem
- Velocidade atual de reprodução

## 📋 Endpoints da API

### **GET /api/images**
Lista todas as sessões agrupadas:
```json
{
  "sessionId": [
    {
      "filename": "heatmap_...webp",
      "timestamp": 1751642242514,
      "url": "/uploads/heatmap_...webp"
    }
  ]
}
```

### **GET /api/video/:sessionId**
Dados para reprodução de vídeo:
```json
{
  "sessionId": "session_name",
  "images": [...],
  "totalImages": 45
}
```

## 🔄 Funcionalidades em Tempo Real

### **WebSocket**
- Atualização automática quando novas imagens chegam
- Interface atualiza sem refresh
- Conexão automática entre React e Node.js

### **Auto-refresh**
- Lista de sessões atualiza automaticamente
- Novos frames aparecem instantaneamente no player

## 🛠️ Comandos de Debug

### **No Console do Flutter (F12)**
```javascript
// Ver dados da sessão atual
showHeatmapData()

// Informações da sessão
getSessionInfo()

// Resetar sessão (requer reload)
resetSession()

// Captura manual
manualCapture()
```

## 📁 Estrutura de Arquivos

### **Padrão de Nomes**
```
heatmap_[sessionInfo]_[timestamp]_[id].webp
```

### **Exemplo**
```
heatmap_http_localhost_5000_bviitz_1751642242514__1751642255478_1751642255487.webp
         └─────────┬─────────┘  └──┬──┘ └─────┬────┘  └─────┬────┘
            sessionInfo        userId   timestamp    uploadId
```

## 🎉 Sistema Completo e Funcional!

Todas as funcionalidades estão implementadas e testadas:
- ✅ Captura de heatmaps em tempo real
- ✅ Agrupamento correto por sessão 
- ✅ Player de vídeo com controles completos
- ✅ Interface moderna e responsiva
- ✅ Atualização em tempo real via WebSocket
- ✅ Sistema sem conflitos de porta

**🎬 Aproveite o sistema de vídeo para visualizar a jornada completa do usuário!**
