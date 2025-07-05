#!/bin/bash

echo "🛑 Parando Pulsalytics Analytics Platform..."

# Função para matar processo por PID
kill_process() {
    local pid=$1
    local name=$2
    
    if [ ! -z "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        echo "🔄 Parando $name (PID: $pid)..."
        kill -TERM "$pid" 2>/dev/null
        
        # Aguardar 5 segundos para processo parar graciosamente
        sleep 5
        
        # Se ainda estiver rodando, força a parada
        if kill -0 "$pid" 2>/dev/null; then
            echo "⚠️  Forçando parada do $name..."
            kill -KILL "$pid" 2>/dev/null
        fi
        
        echo "✅ $name parado"
    else
        echo "⚠️  $name não estava rodando ou já foi parado"
    fi
}

# Função para matar processos por porta
kill_port() {
    local port=$1
    local name=$2
    
    local pids=$(lsof -ti :$port 2>/dev/null)
    if [ ! -z "$pids" ]; then
        echo "🔄 Parando processos na porta $port ($name)..."
        echo $pids | xargs kill -TERM 2>/dev/null
        sleep 3
        
        # Verificar se ainda há processos na porta
        local remaining_pids=$(lsof -ti :$port 2>/dev/null)
        if [ ! -z "$remaining_pids" ]; then
            echo "⚠️  Forçando parada dos processos na porta $port..."
            echo $remaining_pids | xargs kill -KILL 2>/dev/null
        fi
        
        echo "✅ Processos na porta $port parados"
    else
        echo "⚠️  Nenhum processo encontrado na porta $port"
    fi
}

# Ler PIDs salvos durante o start
if [ -f ".server_pid" ]; then
    SERVER_PID=$(cat .server_pid)
    kill_process "$SERVER_PID" "Servidor Backend"
    rm -f .server_pid
fi

if [ -f ".admin_pid" ]; then
    ADMIN_PID=$(cat .admin_pid)
    kill_process "$ADMIN_PID" "Admin React"
    rm -f .admin_pid
fi

# Garantir que as portas estejam livres
echo "🔍 Verificando e limpando portas..."
kill_port 3001 "Servidor Backend"
kill_port 3000 "Admin React"
kill_port 3002 "WebSocket Heatmap"
kill_port 3004 "WebSocket Admin"

# Aguardar um pouco para garantir que tudo parou
sleep 2

echo ""
echo "✅ Pulsalytics Analytics Platform stopped successfully!"
echo "" 