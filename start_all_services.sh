#!/bin/bash

echo "🚀 Starting Pulsalytics Analytics Platform..."

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi

# Verificar se o npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm first."
    exit 1
fi

# Função para verificar se uma porta está em uso
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Port $port is already in use."
        return 1
    fi
    return 0
}

# Verificar portas necessárias
echo "🔍 Checking ports..."
if ! check_port 3001; then
    echo "❌ Port 3001 (main server) is already in use. Please free the port."
    exit 1
fi

if ! check_port 3002; then
    echo "❌ Port 3002 (WebSocket heatmap) is already in use. Please free the port."
    exit 1
fi

if ! check_port 3004; then
    echo "❌ Port 3004 (WebSocket admin) is already in use. Please free the port."
    exit 1
fi

if ! check_port 3000; then
    echo "❌ Port 3000 (React admin) is already in use. Please free the port."
    exit 1
fi

# Instalar dependências do servidor se necessário
echo "📦 Checking server dependencies..."
cd heatmap-server
if [ ! -d "node_modules" ]; then
    echo "📦 Installing server dependencies..."
    npm install
fi

# Iniciar servidor em background
echo "🔧 Starting backend server..."
node server.js &
SERVER_PID=$!
echo "✅ Backend server started (PID: $SERVER_PID)"

# Aguardar servidor inicializar
sleep 2

# Voltar para o diretório raiz
cd ..

# Instalar dependências do admin React se necessário
echo "📦 Checking React admin dependencies..."
cd admin-ui
if [ ! -d "node_modules" ]; then
    echo "📦 Installing React admin dependencies..."
    npm install
fi

# Iniciar admin React em background
echo "🎨 Starting admin React..."
npm start &
ADMIN_PID=$!
echo "✅ Admin React started (PID: $ADMIN_PID)"

# Voltar para o diretório raiz
cd ..

# Aguardar um pouco para tudo inicializar
sleep 3

echo ""
echo "🎉 Pulsalytics Analytics Platform started successfully!"
echo ""
echo "📋 Services in execution:"
echo "   🔧 Backend Server: http://localhost:3001"
echo "   🎨 Admin Interface: http://localhost:3000"
echo "   📡 WebSocket Heatmap: ws://localhost:3002"
echo "   📡 WebSocket Admin: ws://localhost:3004"
echo ""
echo "🌐 To access the admin, open: http://localhost:3000"
echo ""
echo "📝 To stop the services, execute: ./stop_all_services.sh"
echo ""

# Salvar PIDs em arquivo para facilitar o stop
echo "$SERVER_PID" > .server_pid
echo "$ADMIN_PID" > .admin_pid

# Aguardar até que o usuário pressione Ctrl+C
echo "⏳ Pressione Ctrl+C para parar todos os serviços..."
wait 