#!/bin/bash

echo "🚀 Iniciando Clarity Analytics Platform..."

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Por favor, instale o Node.js primeiro."
    exit 1
fi

# Verificar se o npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado. Por favor, instale o npm primeiro."
    exit 1
fi

# Função para verificar se uma porta está em uso
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Porta $port já está em uso."
        return 1
    fi
    return 0
}

# Verificar portas necessárias
echo "🔍 Verificando portas..."
if ! check_port 3001; then
    echo "❌ Porta 3001 (servidor principal) já está em uso. Por favor, libere a porta."
    exit 1
fi

if ! check_port 3002; then
    echo "❌ Porta 3002 (WebSocket heatmap) já está em uso. Por favor, libere a porta."
    exit 1
fi

if ! check_port 3004; then
    echo "❌ Porta 3004 (WebSocket admin) já está em uso. Por favor, libere a porta."
    exit 1
fi

if ! check_port 3000; then
    echo "❌ Porta 3000 (React admin) já está em uso. Por favor, libere a porta."
    exit 1
fi

# Instalar dependências do servidor se necessário
echo "📦 Verificando dependências do servidor..."
cd heatmap-server
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências do servidor..."
    npm install
fi

# Iniciar servidor em background
echo "🔧 Iniciando servidor backend..."
node server.js &
SERVER_PID=$!
echo "✅ Servidor backend iniciado (PID: $SERVER_PID)"

# Aguardar servidor inicializar
sleep 2

# Voltar para o diretório raiz
cd ..

# Instalar dependências do admin React se necessário
echo "📦 Verificando dependências do admin React..."
cd admin-ui
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências do admin React..."
    npm install
fi

# Iniciar admin React em background
echo "🎨 Iniciando admin React..."
npm start &
ADMIN_PID=$!
echo "✅ Admin React iniciado (PID: $ADMIN_PID)"

# Voltar para o diretório raiz
cd ..

# Aguardar um pouco para tudo inicializar
sleep 3

echo ""
echo "🎉 Clarity Analytics Platform iniciado com sucesso!"
echo ""
echo "📋 Serviços em execução:"
echo "   🔧 Servidor Backend: http://localhost:3001"
echo "   🎨 Admin Interface: http://localhost:3000"
echo "   📡 WebSocket Heatmap: ws://localhost:3002"
echo "   📡 WebSocket Admin: ws://localhost:3004"
echo ""
echo "🌐 Para acessar o admin, abra: http://localhost:3000"
echo ""
echo "📝 Para parar os serviços, execute: ./stop_all_services.sh"
echo ""

# Salvar PIDs em arquivo para facilitar o stop
echo "$SERVER_PID" > .server_pid
echo "$ADMIN_PID" > .admin_pid

# Aguardar até que o usuário pressione Ctrl+C
echo "⏳ Pressione Ctrl+C para parar todos os serviços..."
wait 