#!/bin/bash

# Script para reiniciar todos os serviços com otimizações
echo "🔄 Reiniciando sistema heatmap com otimizações..."

# Parar todos os serviços existentes
echo "🛑 Parando serviços existentes..."
pkill -f "node.*server\.js" 2>/dev/null || true
pkill -f "node.*websocket-server\.js" 2>/dev/null || true
pkill -f "npm.*start" 2>/dev/null || true
pkill -f "react-scripts" 2>/dev/null || true

# Aguardar um pouco para garantir que os processos foram terminados
sleep 2

# Iniciar servidor WebSocket (porta 3002)
echo "🚀 Iniciando servidor WebSocket (porta 3002)..."
cd heatmap-server
node websocket-server.js &
WS_PID=$!

# Aguardar 2 segundos
sleep 2

# Iniciar servidor HTTP principal (porta 3001)
echo "🚀 Iniciando servidor HTTP principal (porta 3001)..."
node server.js &
HTTP_PID=$!

# Aguardar 2 segundos
sleep 2

# Iniciar interface React admin (porta 3000)
echo "🚀 Iniciando interface React admin (porta 3000)..."
cd ../admin-ui
npm start &
REACT_PID=$!

# Voltar ao diretório principal
cd ..

# Aguardar 5 segundos para tudo inicializar
sleep 5

# Verificar se os serviços estão rodando
echo "🔍 Verificando serviços..."

# Verificar WebSocket Server
if curl -s "http://localhost:3003/api/status" > /dev/null 2>&1; then
    echo "✅ WebSocket Server (porta 3003) - OK"
else
    echo "❌ WebSocket Server (porta 3003) - ERRO"
fi

# Verificar HTTP Server
if curl -s "http://localhost:3001/api/images" > /dev/null 2>&1; then
    echo "✅ HTTP Server (porta 3001) - OK"
else
    echo "❌ HTTP Server (porta 3001) - ERRO"
fi

# Verificar React Admin
if curl -s "http://localhost:3000" > /dev/null 2>&1; then
    echo "✅ React Admin (porta 3000) - OK"
else
    echo "❌ React Admin (porta 3000) - ERRO"
fi

echo ""
echo "🎉 Sistema iniciado com otimizações!"
echo ""
echo "📊 URLs disponíveis:"
echo "   • Admin React: http://localhost:3000"
echo "   • API HTTP: http://localhost:3001"
echo "   • WebSocket: ws://localhost:3002"
echo "   • Status WebSocket: http://localhost:3003/api/status"
echo ""
echo "🔧 Otimizações implementadas:"
echo "   • Throttling de chamadas /api/images (2s)"
echo "   • Processamento otimizado de base64 → imagem"
echo "   • Retry automático para envio de screenshots"
echo "   • Validação de base64 no backend"
echo "   • Captura de screenshots com fallback"
echo "   • Intervalo de atualização aumentado (30s)"
echo ""
echo "📝 PIDs dos processos:"
echo "   • WebSocket Server: $WS_PID"
echo "   • HTTP Server: $HTTP_PID"
echo "   • React Admin: $REACT_PID"
echo ""
echo "🛑 Para parar todos os serviços, execute:"
echo "   kill $WS_PID $HTTP_PID $REACT_PID"
echo ""
echo "📋 Logs em tempo real:"
echo "   • WebSocket: tail -f heatmap-server/logs/websocket.log"
echo "   • HTTP: tail -f heatmap-server/logs/server.log"
echo "   • React: abrir DevTools no navegador" 