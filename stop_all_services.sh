#!/bin/bash

echo "🛑 Parando todos os serviços do Clarity Analytics..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para matar processo em uma porta específica
kill_port() {
    local port=$1
    local name=$2
    local pids=$(lsof -ti :$port)
    if [ ! -z "$pids" ]; then
        echo -e "${YELLOW}⚠️  Matando $name na porta $port (PIDs: $pids)${NC}"
        echo $pids | xargs kill -9 2>/dev/null || true
        sleep 1
        
        # Verificar se realmente parou
        local remaining_pids=$(lsof -ti :$port)
        if [ -z "$remaining_pids" ]; then
            echo -e "${GREEN}✅ $name parado com sucesso${NC}"
        else
            echo -e "${RED}❌ $name ainda está rodando${NC}"
        fi
    else
        echo -e "${BLUE}ℹ️  $name não está rodando na porta $port${NC}"
    fi
}

# Parar todos os serviços
echo -e "${BLUE}🔍 Parando serviços...${NC}"

kill_port 3000 "Admin UI"
kill_port 3001 "Backend Principal"
kill_port 3002 "WebSocket Server"
kill_port 3004 "WebSocket Admin"
kill_port 5000 "Flutter App"

# Parar processos específicos do Flutter
echo -e "${BLUE}🦋 Parando processos Flutter...${NC}"
pkill -f "flutter run" 2>/dev/null || true
pkill -f "dart" 2>/dev/null || true

# Parar processos Node.js específicos
echo -e "${BLUE}🟢 Parando processos Node.js...${NC}"
pkill -f "node server.js" 2>/dev/null || true
pkill -f "node websocket-server.js" 2>/dev/null || true

# Parar processos React
echo -e "${BLUE}⚛️  Parando processos React...${NC}"
pkill -f "react-scripts" 2>/dev/null || true

echo -e "${GREEN}🎉 Todos os serviços foram parados!${NC}"

# Verificar se algum processo ainda está rodando
echo -e "${BLUE}🔍 Verificação final...${NC}"
REMAINING_PORTS=(3000 3001 3002 3004 5000)

for port in "${REMAINING_PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${YELLOW}⚠️  Porta $port ainda está ocupada${NC}"
    else
        echo -e "${GREEN}✅ Porta $port liberada${NC}"
    fi
done

echo -e "${GREEN}🛑 Sistema parado com sucesso!${NC}" 