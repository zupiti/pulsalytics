#!/bin/bash

echo "🚀 Iniciando todos os serviços do Clarity Analytics..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para verificar se uma porta está disponível
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${YELLOW}⚠️  Porta $port já está em uso${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Porta $port disponível${NC}"
        return 0
    fi
}

# Função para matar processo em uma porta específica
kill_port() {
    local port=$1
    local pids=$(lsof -ti :$port)
    if [ ! -z "$pids" ]; then
        echo -e "${YELLOW}⚠️  Matando processos na porta $port: $pids${NC}"
        echo $pids | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Verificar portas necessárias
echo -e "${BLUE}🔍 Verificando portas necessárias...${NC}"
PORTS=(3000 3001 3002 3004 5000)

for port in "${PORTS[@]}"; do
    if ! check_port $port; then
        echo -e "${RED}❌ Porta $port ocupada. Deseja matar o processo? (y/n)${NC}"
        read -r response
        if [[ "$response" == "y" || "$response" == "Y" ]]; then
            kill_port $port
        else
            echo -e "${RED}❌ Abortando devido à porta ocupada${NC}"
            exit 1
        fi
    fi
done

echo -e "${GREEN}✅ Todas as portas estão disponíveis${NC}"

# Criar diretórios necessários
echo -e "${BLUE}📁 Criando diretórios necessários...${NC}"
mkdir -p heatmap-server/uploads
mkdir -p heatmap-server/logs

# Iniciar WebSocket Server (porta 3002)
echo -e "${BLUE}🔌 Iniciando WebSocket Server (porta 3002)...${NC}"
cd heatmap-server
npm run websocket > logs/websocket.log 2>&1 &
WEBSOCKET_PID=$!
echo "WebSocket PID: $WEBSOCKET_PID"
cd ..

# Aguardar WebSocket inicializar
sleep 3

# Iniciar Backend Principal (porta 3001)
echo -e "${BLUE}🖥️  Iniciando Backend Principal (porta 3001)...${NC}"
cd heatmap-server
npm run dev > logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..

# Aguardar Backend inicializar
sleep 3

# Iniciar Admin UI (porta 3000)
echo -e "${BLUE}🎨 Iniciando Admin UI (porta 3000)...${NC}"
cd admin-ui
npm start > ../heatmap-server/logs/admin-ui.log 2>&1 &
ADMIN_UI_PID=$!
echo "Admin UI PID: $ADMIN_UI_PID"
cd ..

# Aguardar Admin UI inicializar
sleep 5

# Iniciar Flutter App (porta 5000)
echo -e "${BLUE}🦋 Iniciando Flutter App (porta 5000)...${NC}"
cd flutter_heatmap_tracker/example
flutter run -d chrome --web-port=5000 > ../../heatmap-server/logs/flutter.log 2>&1 &
FLUTTER_PID=$!
echo "Flutter PID: $FLUTTER_PID"
cd ../..

# Aguardar um pouco para todos os serviços iniciarem
sleep 10

# Verificar se todos os serviços estão funcionando
echo -e "${BLUE}🔍 Verificando serviços...${NC}"

check_service() {
    local url=$1
    local name=$2
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    if [ "$response" == "200" ] || [ "$response" == "304" ]; then
        echo -e "${GREEN}✅ $name está funcionando${NC}"
    else
        echo -e "${RED}❌ $name não está respondendo (HTTP $response)${NC}"
    fi
}

check_service "http://localhost:3001/admin" "Backend Principal"
check_service "http://localhost:3000" "Admin UI"
check_service "http://localhost:5000" "Flutter App"

# Informações finais
echo -e "${GREEN}🎉 Todos os serviços iniciados!${NC}"
echo -e "${BLUE}📊 URLs dos serviços:${NC}"
echo -e "  • Admin UI: ${GREEN}http://localhost:3000${NC}"
echo -e "  • Backend API: ${GREEN}http://localhost:3001/admin${NC}"
echo -e "  • Flutter App: ${GREEN}http://localhost:5000${NC}"
echo -e "  • WebSocket Server: ${GREEN}ws://localhost:3002${NC}"
echo -e "  • WebSocket Admin: ${GREEN}ws://localhost:3004${NC}"

echo -e "${BLUE}📋 PIDs dos processos:${NC}"
echo -e "  • WebSocket: $WEBSOCKET_PID"
echo -e "  • Backend: $BACKEND_PID"
echo -e "  • Admin UI: $ADMIN_UI_PID"
echo -e "  • Flutter: $FLUTTER_PID"

echo -e "${BLUE}📄 Logs disponíveis em:${NC}"
echo -e "  • WebSocket: heatmap-server/logs/websocket.log"
echo -e "  • Backend: heatmap-server/logs/backend.log"
echo -e "  • Admin UI: heatmap-server/logs/admin-ui.log"
echo -e "  • Flutter: heatmap-server/logs/flutter.log"

echo -e "${YELLOW}💡 Para parar todos os serviços, execute:${NC}"
echo -e "  kill $WEBSOCKET_PID $BACKEND_PID $ADMIN_UI_PID $FLUTTER_PID"

echo -e "${GREEN}🚀 Sistema iniciado com sucesso!${NC}"
echo -e "${BLUE}🎯 Agora visite o Admin UI em http://localhost:3000${NC}" 